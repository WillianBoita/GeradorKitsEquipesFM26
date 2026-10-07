import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { assetFilePath, findAsset, getAsset, type AssetRegistry } from "../assets/registry.js";
import { BRAND_KINDS, BRAND_LISTS, type BrandKind, type KitDefinition } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import type { KitLogoImages } from "../renderers/kit-logos.js";
import { clubLogoPath } from "./club-repository.js";

export interface AssetDirs {
  assetsDir: string;
  clubsDir: string;
}

export interface AssetRefs {
  badge: boolean;
  sponsors: string[];
  manufacturers: string[];
}

const KIND_LABELS: Record<BrandKind, string> = { sponsor: "Sponsor", manufacturer: "Manufacturer" };

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// O Sharp só diria "unsupported image format" ou "libpng read error", sem o arquivo; quem chama põe o caminho na mensagem.
// metadata() lê só o cabeçalho e aceita PNG com os pixels cortados, então decodifica de verdade (reduzido, para SVG enorme não alocar demais).
async function isImage(content: Buffer): Promise<boolean> {
  try {
    await sharp(content).resize({ width: 64, height: 64, fit: "inside" }).raw().toBuffer();
    return true;
  } catch {
    return false;
  }
}

async function readImage(file: string, missing: string): Promise<Buffer> {
  const content = await readIfExists(file);
  if (!content) throw new Error(`${missing} not found: ${file}`);
  if (!(await isImage(content))) throw new Error(`Invalid image file: ${file}`);
  return content;
}

export async function loadKitLogos(kit: KitDefinition, registry: AssetRegistry, dirs: AssetDirs): Promise<KitLogoImages> {
  const images: KitLogoImages = {};
  if (kit.badge) images.badge = await readImage(clubLogoPath(kit.clubId, dirs.clubsDir), `Club "${kit.clubId}" badge`);
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (logo) images[kind] = await readImage(assetFilePath(dirs.assetsDir, getAsset(registry, kind, logo.id)), `${KIND_LABELS[kind]} "${logo.id}" file`);
  }
  return images;
}

// Confere cada arquivo uma vez; ids fora do registry ficam para a regra unknown-asset.
export async function checkAssetFiles(clubId: string, refs: AssetRefs, registry: AssetRegistry, dirs: AssetDirs): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (refs.badge) {
    const file = clubLogoPath(clubId, dirs.clubsDir);
    const content = await readIfExists(file);
    if (!content) issues.push({ rule: "missing-asset", message: `club badge not found: ${file}` });
    else if (!(await isImage(content))) issues.push({ rule: "invalid-file", message: `club badge ${file} is not a valid image` });
  }
  for (const kind of BRAND_KINDS) {
    for (const id of new Set(refs[BRAND_LISTS[kind]])) {
      const entry = findAsset(registry, kind, id);
      if (!entry) continue;
      const file = assetFilePath(dirs.assetsDir, entry);
      const label = `${kind} "${id}" (${entry.file})`;
      const content = await readIfExists(file);
      if (!content) issues.push({ rule: "missing-asset", message: `${kind} "${id}" file not found: ${file}` });
      else if (!(await isImage(content))) issues.push({ rule: "invalid-file", message: `${label} is not a valid image` });
      else if ((await sharp(content).stats()).isOpaque) issues.push({ rule: "opaque-logo", message: `${label} has no transparent pixels` });
    }
  }
  return issues;
}
