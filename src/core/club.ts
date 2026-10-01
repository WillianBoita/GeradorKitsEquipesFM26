import { z } from "zod";
import { ClubIdSchema, HexColorSchema, parseWith } from "./primitives.js";

export const ClubIdentitySchema = z.object({
  id: ClubIdSchema,
  name: z.string().min(1),
  // String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário.
  fmUniqueId: z.string().regex(/^\d+$/, "must be the numeric FM Unique ID as a string").optional(),
  palette: z.object({ primary: HexColorSchema, secondary: HexColorSchema.optional(), accent: HexColorSchema.optional() }),
  style: z.object({ categories: z.array(z.string()).default([]), patternWeights: z.record(z.string(), z.number().nonnegative()).optional() }).default({ categories: [] }),
});

export type ClubIdentity = z.infer<typeof ClubIdentitySchema>;

export function parseClubIdentity(input: unknown): ClubIdentity {
  return parseWith(ClubIdentitySchema, input, "club identity");
}
