import { z } from "zod";
import { AssetIdSchema, ClubIdSchema, FmUniqueIdSchema, HexColorSchema, parseWith } from "./primitives.js";

// O teto mantém finita a soma dos pesos em rng.weighted.
const WeightSchema = z.number().nonnegative().max(1_000_000);
// Pesos por id do registry de assets; o sorteio usa as chaves em ordem alfabética.
const AssetPoolSchema = z.record(AssetIdSchema, WeightSchema);

export const ClubIdentitySchema = z.strictObject({
  id: ClubIdSchema,
  name: z.string().min(1),
  fmUniqueId: FmUniqueIdSchema.optional(),
  palette: z.strictObject({ primary: HexColorSchema, secondary: HexColorSchema.optional(), accent: HexColorSchema.optional() }),
  style: z
    .strictObject({ categories: z.array(z.string()).default([]), patternWeights: z.record(z.string(), WeightSchema).optional() })
    .default({ categories: [] }),
  sponsors: AssetPoolSchema.optional(),
  manufacturers: AssetPoolSchema.optional(),
});

export type ClubIdentity = z.infer<typeof ClubIdentitySchema>;

export function parseClubIdentity(input: unknown): ClubIdentity {
  return parseWith(ClubIdentitySchema, input, "club identity");
}
