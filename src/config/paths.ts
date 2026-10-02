import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KitType } from "../core/kit.js";
import { kitAssetFileName, type RenderType } from "../fm26/naming.js";

// Dois níveis acima funciona tanto para src/config (tsx) quanto para dist/config (build).
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const CLUBS_DIR = path.join(PROJECT_ROOT, "clubs");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");
export const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
// "_" fica fora de [a-z0-9-]: nenhum clube gera um output/<id>/ com este nome.
export const FM26_EXPORT_DIR = path.join(OUTPUT_DIR, "fm26_export");
export const CONFIG_XML_FILE = "config.xml";

export function kitRenderPath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string {
  return path.join(outDir, clubId, renderType, kitAssetFileName(clubId, kitType, renderType));
}

// Pasta plana: o FM26 ignora `from` com subpasta, então PNGs e config.xml ficam juntos.
export function exportFilePath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string {
  return path.join(outDir, kitAssetFileName(clubId, kitType, renderType));
}

export function exportConfigPath(outDir: string): string {
  return path.join(outDir, CONFIG_XML_FILE);
}
