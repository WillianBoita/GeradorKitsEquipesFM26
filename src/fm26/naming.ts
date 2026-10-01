import type { KitType } from "../core/kit.js";
import { ClubIdSchema, parseWith } from "../core/primitives.js";

export const RENDER_TYPES = ["2d", "3d"] as const;

export type RenderType = (typeof RENDER_TYPES)[number];

// O id interno só aceita [a-z0-9-], então trocar "-" por "_" já garante nome sem acento, espaço ou caractere especial.
export function clubSlug(clubId: string): string {
  return parseWith(ClubIdSchema, clubId, "club id").replaceAll("-", "_");
}

export function kitAssetName(clubId: string, kitType: KitType, renderType: RenderType): string {
  return `${clubSlug(clubId)}_${kitType}_${renderType}`;
}

export function kitAssetFileName(clubId: string, kitType: KitType, renderType: RenderType): string {
  return `${kitAssetName(clubId, kitType, renderType)}.png`;
}
