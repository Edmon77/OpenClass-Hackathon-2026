import type { FastifyReply } from 'fastify';
import type { ZodError } from 'zod';

/** Single-line Zod issues for 400 responses (shows up in mobile alerts). */
export function zodBodyErrorMessage(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
}

export function replyInvalidBody(reply: FastifyReply, err: ZodError) {
  return reply.status(400).send({
    error: `Invalid body (${zodBodyErrorMessage(err)})`,
  });
}
