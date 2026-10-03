import { z } from "zod";
import { HEX_COLOR_PATTERN, normalizeHex } from "./color.js";
import { MAX_SEED } from "./random.js";

export const HexColorSchema = z.string().regex(HEX_COLOR_PATTERN, "must be a hex color like #1a2b3c or #abc").transform(normalizeHex);

// Também impede path traversal, pois o id vira nome de diretório em clubs/.
export const ClubIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must contain only lowercase letters, digits and hyphens");

// Mesma regra do id de clube: o id de asset vira chave de pool e parte de mensagens.
export const AssetIdSchema = ClubIdSchema;

// O FM26 monta o ID do time como fmRandomId × 2³² + fmUniqueId: cada parte precisa caber em 32 bits para a conta ser única.
export const FM_ID_PART_LIMIT = 2 ** 32;

// String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário (valores do editor do FM).
function fmIdPartSchema(label: string) {
  return z
    .string()
    .regex(/^\d+$/, { error: `must be the numeric FM ${label} as a string`, abort: true })
    .refine((value) => Number(value) < FM_ID_PART_LIMIT, `must be at most ${FM_ID_PART_LIMIT - 1}`);
}

export const FmUniqueIdSchema = fmIdPartSchema("Unique ID");
export const FmRandomIdSchema = fmIdPartSchema("Random ID");

export const SeedSchema = z.number().int().min(0).max(MAX_SEED);

export function parseWith<T extends z.ZodType>(schema: T, input: unknown, label: string): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid ${label}:\n${z.prettifyError(result.error)}`);
  return result.data;
}
