import { z } from 'zod';

/**
 * Prisma `String @id` values: may be uuid(), cuid(), or legacy seed ids that are
 * not RFC-4122 (e.g. …00r201). Do not use z.string().uuid() for these.
 */
export const prismaStringId = z.string().trim().min(1).max(128);
