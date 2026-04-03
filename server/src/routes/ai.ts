import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AiUserContext } from '../lib/aiContext.js';
import { executeAiTool, getAiToolDefinitions } from '../lib/aiTools.js';
import {
  buildCampusAssistantSystemPrompt,
  buildSessionBrief,
  sessionBriefToSystemContent,
} from '../lib/aiSession.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TOOL_ROUNDS = 6;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

const rateBuckets = new Map<string, number[]>();

function allowRateLimit(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  rateBuckets.set(userId, arr);
  return true;
}

const clientMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('user'), content: z.string().max(8000) }),
  z.object({ role: z.literal('assistant'), content: z.string().max(16000) }),
]);

const clientContextSchema = z
  .object({
    screen: z.string().max(120).optional(),
    platform: z.string().max(64).optional(),
  })
  .optional();

const chatBodySchema = z.object({
  messages: z.array(clientMessageSchema).min(1).max(40),
  client_context: clientContextSchema,
});

type ToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

type ApiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

async function openRouterChat(
  messages: ApiMessage[],
  tools: ReturnType<typeof getAiToolDefinitions>
): Promise<{
  message: { role: string; content: string | null; tool_calls?: ToolCall[] };
}> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

  // Default to OpenRouter free tier router (paid models like gpt-4o-mini fail on free-only keys).
  const model = process.env.OPENROUTER_MODEL ?? 'openrouter/free';
  const referer = process.env.OPENROUTER_HTTP_REFERER;
  const title = process.env.OPENROUTER_APP_TITLE ?? 'Lecture Room Status';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (referer) headers.Referer = referer;
  headers['X-Title'] = title;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.4,
    }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('OpenRouter returned non-JSON');
  }

  if (!res.ok) {
    const err = data as {
      error?: string | { message?: string };
      message?: string;
    } | null;
    let msg: string | undefined;
    if (err?.error != null) {
      msg = typeof err.error === 'string' ? err.error : err.error.message;
    }
    msg = msg ?? err?.message ?? text.slice(0, 200);
    throw new Error(msg || `OpenRouter HTTP ${res.status}`);
  }

  const parsed = data as {
    choices?: { message?: { role: string; content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const message = parsed.choices?.[0]?.message;
  if (!message) throw new Error('OpenRouter returned no message');

  return { message: message as { role: string; content: string | null; tool_calls?: ToolCall[] } };
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  /** No auth — use to verify the API is the one with Assistant routes (avoids confusing "Not Found"). */
  app.get('/', async () => ({
    ok: true,
    assistant: 'POST /ai/chat (Bearer JWT required)',
  }));

  app.post('/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key?.trim()) {
      return reply.status(503).send({ error: 'Campus Assistant is not configured (missing OPENROUTER_API_KEY)' });
    }

    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role as AiUserContext['role'];
    if (!allowRateLimit(userId)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
    }

    const ctx: AiUserContext = { userId, role };

    const brief = await buildSessionBrief(ctx, parsed.data.client_context);
    const tools = getAiToolDefinitions(ctx);
    const messages: ApiMessage[] = [
      { role: 'system', content: buildCampusAssistantSystemPrompt() },
      { role: 'system', content: sessionBriefToSystemContent(brief) },
      ...parsed.data.messages.map((m) =>
        m.role === 'user'
          ? ({ role: 'user', content: m.content } as ApiMessage)
          : ({ role: 'assistant', content: m.content } as ApiMessage)
      ),
    ];

    let rounds = 0;
    let lastAssistantText: string | null = null;

    try {
      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const { message } = await openRouterChat(messages, tools);

        const toolCalls = message.tool_calls?.filter((t) => t.type === 'function') ?? [];

        if (!toolCalls.length) {
          lastAssistantText = message.content ?? '';
          messages.push({
            role: 'assistant',
            content: message.content,
          });
          break;
        }

        messages.push({
          role: 'assistant',
          content: message.content,
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const name = call.function?.name ?? '';
          const args = call.function?.arguments ?? '{}';
          const result = await executeAiTool(name, args, ctx);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result,
          });
        }
      }

      if (lastAssistantText === null) {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant' && typeof last.content === 'string') {
          lastAssistantText = last.content;
        } else {
          lastAssistantText = 'Sorry, I could not finish that request. Please try again.';
        }
      }

      return {
        message: {
          role: 'assistant' as const,
          content: lastAssistantText ?? '',
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Assistant request failed';
      request.log.warn({ err: e }, 'openrouter_chat_failed');
      return reply.status(502).send({ error: msg });
    }
  });
};
