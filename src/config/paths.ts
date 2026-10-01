import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KitType } from "../core/kit.js";
import { kitAssetFileName, type RenderType } from "../fm26/naming.js";

// Dois níveis acima funciona tanto para src/config (tsx) quanto para dist/config (build).
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const CLUBS_DIR = path.join(PROJECT_ROOT, "clubs");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

export function kitRenderPath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string {
  return path.join(outDir, clubId, renderType, kitAssetFileName(clubId, kitType, renderType));
}
