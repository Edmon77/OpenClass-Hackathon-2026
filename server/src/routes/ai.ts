import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AiUserContext } from '../lib/aiContext.js';
import {
  cancelAssistantProposal,
  confirmAssistantProposal,
  executeAiTool,
  getAiToolDefinitions,
  type AssistantProposalResult,
} from '../lib/aiTools.js';
import {
  buildCampusAssistantSystemPrompt,
  buildSessionBrief,
  sessionBriefToSystemContent,
} from '../lib/aiSession.js';
import { assistantMaxRoundsFallbackMessage, categorizeAssistantErrorMessage } from '../lib/assistantPolicy.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
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
    route: z.string().max(200).optional(),
    room_id: z.string().optional(),
    building_id: z.string().optional(),
    booking_id: z.string().optional(),
    timezone: z.string().max(80).optional(),
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

type SuggestedAction = {
  type: 'confirm_proposal' | 'cancel_proposal';
  label: string;
  payload: { proposal_id: string };
};

type LlmChatConfig = {
  url: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  label: string;
};

type LlmHttpError = Error & { statusCode: number };

function groqLlmConfig(): LlmChatConfig | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return null;
  return {
    url: GROQ_CHAT_URL,
    apiKey: groqKey,
    model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    headers: { 'Content-Type': 'application/json' },
    label: 'Groq',
  };
}

function openrouterLlmConfig(): LlmChatConfig | null {
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!orKey) return null;
  const referer = process.env.OPENROUTER_HTTP_REFERER;
  const title = process.env.OPENROUTER_APP_TITLE ?? 'Lecture Room Status';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (referer) headers.Referer = referer;
  headers['X-Title'] = title;
  return {
    url: OPENROUTER_URL,
    apiKey: orKey,
    model: process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free',
    headers,
    label: 'OpenRouter',
  };
}

/** Groq first when both keys are set; OpenRouter used as fallback on rate limits / overload. */
function buildLlmProviderChain(): LlmChatConfig[] {
  const chain: LlmChatConfig[] = [];
  const g = groqLlmConfig();
  const o = openrouterLlmConfig();
  if (g) chain.push(g);
  if (o) chain.push(o);
  return chain;
}

function isAssistantLlmConfigured(): boolean {
  return buildLlmProviderChain().length > 0;
}

function isRetryableWithNextProvider(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'statusCode' in err && typeof (err as LlmHttpError).statusCode === 'number'
      ? (err as LlmHttpError).statusCode
      : 0;
  if (status === 429 || status === 503) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('rate limit')) return true;
  if (msg.includes('tokens per minute')) return true;
  if (msg.includes('token per minute')) return true;
  if (msg.includes('tpm')) return true;
  if (msg.includes('resource exhausted')) return true;
  if (msg.includes('too many requests')) return true;
  return false;
}

async function llmChatCompletionWithProvider(
  cfg: LlmChatConfig,
  messages: ApiMessage[],
  tools: ReturnType<typeof getAiToolDefinitions>
): Promise<{
  message: { role: string; content: string | null; tool_calls?: ToolCall[] };
}> {
  const headers: Record<string, string> = {
    ...cfg.headers,
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
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
    const e = new Error(`${cfg.label} returned non-JSON`) as LlmHttpError;
    e.statusCode = res.status;
    throw e;
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
    const e = new Error(msg || `${cfg.label} HTTP ${res.status}`) as LlmHttpError;
    e.statusCode = res.status;
    throw e;
  }

  const parsed = data as {
    choices?: { message?: { role: string; content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const message = parsed.choices?.[0]?.message;
  if (!message) throw new Error(`${cfg.label} returned no message`);

  return { message: message as { role: string; content: string | null; tool_calls?: ToolCall[] } };
}

async function llmChatCompletion(
  messages: ApiMessage[],
  tools: ReturnType<typeof getAiToolDefinitions>
): Promise<{
  message: { role: string; content: string | null; tool_calls?: ToolCall[] };
}> {
  const chain = buildLlmProviderChain();
  if (!chain.length) throw new Error('No LLM API key configured (set GROQ_API_KEY and/or OPENROUTER_API_KEY)');

  let lastErr: unknown = null;
  for (let i = 0; i < chain.length; i++) {
    const cfg = chain[i]!;
    try {
      return await llmChatCompletionWithProvider(cfg, messages, tools);
    } catch (e) {
      lastErr = e;
      const hasNext = i < chain.length - 1;
      if (hasNext && isRetryableWithNextProvider(e)) {
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  /** No auth — use to verify the API is the one with Assistant routes (avoids confusing "Not Found"). */
  app.get('/', async () => {
    const chain = buildLlmProviderChain();
    return {
      ok: true,
      assistant: 'POST /ai/chat (Bearer JWT required)',
      llm_providers: chain.map((c) => c.label),
      llm_fallback_enabled: chain.length > 1,
    };
  });

  app.post('/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!isAssistantLlmConfigured()) {
      return reply.status(503).send({
        error: 'Campus Assistant is not configured (set GROQ_API_KEY or OPENROUTER_API_KEY)',
      });
    }

    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role as AiUserContext['role'];
    if (!allowRateLimit(userId)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.', code: 'rate_limit' });
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
    let latestProposal: AssistantProposalResult | null = null;
    const usedTools = new Set<string>();
    const reqId = String((request as { id?: string }).id ?? '');

    try {
      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const { message } = await llmChatCompletion(messages, tools);

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
          if (name) usedTools.add(name);
          const args = call.function?.arguments ?? '{}';
          const result = await executeAiTool(name, args, ctx);
          try {
            const parsedResult = JSON.parse(result) as Partial<AssistantProposalResult>;
            if (
              parsedResult &&
              typeof parsedResult.proposal_id === 'string' &&
              typeof parsedResult.action === 'string' &&
              typeof parsedResult.summary === 'string' &&
              typeof parsedResult.expires_at === 'string'
            ) {
              latestProposal = parsedResult as AssistantProposalResult;
            }
          } catch {
            // ignore non-JSON or non-proposal tool output
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result,
          });
        }
      }

      if (lastAssistantText === null && rounds >= MAX_TOOL_ROUNDS) {
        lastAssistantText = assistantMaxRoundsFallbackMessage();
      }

      if (lastAssistantText === null) {
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant' && typeof last.content === 'string') {
          lastAssistantText = last.content;
        } else {
          lastAssistantText = 'Sorry, I could not finish that request. Please try again.';
        }
      }

      request.log.info(
        {
          reqId,
          userId,
          rounds,
          used_tools: Array.from(usedTools),
          proposal: latestProposal?.action ?? null,
        },
        'assistant_chat_completed'
      );

      return {
        message: {
          role: 'assistant' as const,
          content: lastAssistantText ?? '',
        },
        ...(latestProposal
          ? {
              proposal: latestProposal,
              suggested_actions: [
                {
                  type: 'confirm_proposal' as const,
                  label: 'Confirm',
                  payload: { proposal_id: latestProposal.proposal_id },
                },
                {
                  type: 'cancel_proposal' as const,
                  label: 'Cancel',
                  payload: { proposal_id: latestProposal.proposal_id },
                },
              ] satisfies SuggestedAction[],
            }
          : {}),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Assistant request failed';
      const cat = categorizeAssistantErrorMessage(msg);
      request.log.warn(
        { err: e, reqId, userId, rounds, used_tools: Array.from(usedTools), code: cat.code },
        'assistant_chat_failed'
      );
      return reply.status(cat.status).send({ error: msg, code: cat.code });
    }
  });

  app.post('/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = z
      .object({
        proposal_id: z.string().min(1),
        confirmed: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role as AiUserContext['role'];
    const ctx: AiUserContext = { userId, role };

    if (parsed.data.confirmed === false) {
      const cancelled = await cancelAssistantProposal(parsed.data.proposal_id, ctx);
      if (!cancelled.ok) return reply.status(400).send({ error: cancelled.error, code: 'proposal_cancel_failed' });
      request.log.info({ userId, proposal_id: parsed.data.proposal_id }, 'assistant_proposal_cancelled');
      return { ok: true, cancelled: true };
    }

    const result = await confirmAssistantProposal(parsed.data.proposal_id, ctx);
    if (!result.ok) return reply.status(400).send({ error: result.error, code: 'proposal_confirm_failed' });
    request.log.info({ userId, proposal_id: parsed.data.proposal_id, action: result.action }, 'assistant_proposal_confirmed');
    return result;
  });
};
