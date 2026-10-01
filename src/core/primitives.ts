import { z } from "zod";
import { HEX_COLOR_PATTERN, normalizeHex } from "./color.js";
import { MAX_SEED } from "./random.js";

export const HexColorSchema = z.string().regex(HEX_COLOR_PATTERN, "must be a hex color like #1a2b3c or #abc").transform(normalizeHex);

// Também impede path traversal, pois o id vira nome de diretório em clubs/.
export const ClubIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must contain only lowercase letters, digits and hyphens");

// Mesma regra do id de clube: o id de asset vira chave de pool e parte de mensagens.
export const AssetIdSchema = ClubIdSchema;

export const SeedSchema = z.number().int().min(0).max(MAX_SEED);

export function parseWith<T extends z.ZodType>(schema: T, input: unknown, label: string): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid ${label}:\n${z.prettifyError(result.error)}`);
  return result.data;
}
