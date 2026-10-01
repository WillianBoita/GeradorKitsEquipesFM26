import path from "node:path";
import { z } from "zod";
import { BRAND_LISTS, type BrandKind } from "../core/kit.js";
import { AssetIdSchema, parseWith } from "../core/primitives.js";
import { FileNotFoundError, readJsonFile } from "../io/json-file.js";

// Relativo à pasta de assets e sem como sair dela: nada de caminho absoluto, "\", segmento vazio, "." ou "..".
const AssetFileSchema = z
  .string()
  .regex(/^(?:[^/\\]+\/)*[^/\\]+\.(?:png|svg)$/, "must be a relative path inside the assets folder ending in .png or .svg")
  .refine((file) => !file.split("/").some((segment) => segment === "." || segment === ".."), "must not contain . or .. segments");

const AssetEntrySchema = z.strictObject({ id: AssetIdSchema, name: z.string().min(1), file: AssetFileSchema });
const AssetListSchema = z.array(AssetEntrySchema).refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, "ids must be unique");

export const AssetRegistrySchema = z.strictObject({ sponsors: AssetListSchema, manufacturers: AssetListSchema });

export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type AssetRegistry = z.infer<typeof AssetRegistrySchema>;

export async function loadAssetRegistry(assetsDir: string): Promise<AssetRegistry> {
  const file = path.join(assetsDir, "registry.json");
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) throw new Error(`Asset registry not found: ${file}`);
    throw error;
  }
  return parseWith(AssetRegistrySchema, raw, `asset registry in ${file}`);
}

export function findAsset(registry: AssetRegistry, kind: BrandKind, id: string): AssetEntry | undefined {
  return registry[BRAND_LISTS[kind]].find((entry) => entry.id === id);
}

export function knownAssetIds(registry: AssetRegistry, kind: BrandKind): string {
  const ids = registry[BRAND_LISTS[kind]].map((entry) => entry.id);
  return ids.length > 0 ? ids.join(", ") : "none";
}

export function getAsset(registry: AssetRegistry, kind: BrandKind, id: string): AssetEntry {
  const entry = findAsset(registry, kind, id);
  if (!entry) throw new Error(`Unknown ${kind} "${id}" (known: ${knownAssetIds(registry, kind)})`);
  return entry;
}

export function assetFilePath(assetsDir: string, entry: AssetEntry): string {
  return path.join(assetsDir, ...entry.file.split("/"));
}
