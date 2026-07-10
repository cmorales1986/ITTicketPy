import { z } from 'zod';

// The frontend sends "" for "no selection" on optional uuid fields (e.g. select
// defaults). Treat empty string the same as absent so it doesn't hit Postgres
// as an invalid uuid literal.
export const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));
