import sharp from "sharp";
import type { ClubIdentity } from "../core/club.js";
import type { KitType } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import { kitDefinitionPath } from "../io/club-repository.js";
import type { RenderType } from "./naming.js";

// Resoluções exigidas pelo FM26 (spec de integração, seção 6), independentes do tamanho padrão de cada renderer.
export const FM26_RENDER_SIZES: Record<RenderType, number> = { "2d": 414, "3d": 1024 };

// Third é opcional: o clube só exporta menos registros.
const REQUIRED_KIT_TYPES: readonly KitType[] = ["home", "away"];

// kitTypes inclui kit.json ilegível: ele já vira invalid-file e não deve aparecer de novo como missing-kit.
export function validateExportClub(club: ClubIdentity, kitTypes: readonly KitType[], clubsDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (club.fmUniqueId === undefined) issues.push({ rule: "missing-fm-unique-id", message: `Club "${club.id}" has no fmUniqueId` });
  for (const kitType of REQUIRED_KIT_TYPES) {
    if (kitTypes.includes(kitType)) continue;
    issues.push({ rule: "missing-kit", message: `Club "${club.id}" has no ${kitType} kit (expected ${kitDefinitionPath(club.id, kitType, clubsDir)})` });
  }
  return issues;
}

// Mesmo ID em dois clubes geraria `to` duplicado e o FM aplicaria só um dos kits.
export function duplicateFmUniqueIdIssues(clubs: readonly ClubIdentity[]): Map<string, ValidationIssue[]> {
  const clubIdsByFmId = new Map<string, string[]>();
  for (const club of clubs) {
    if (club.fmUniqueId !== undefined) clubIdsByFmId.set(club.fmUniqueId, [...(clubIdsByFmId.get(club.fmUniqueId) ?? []), club.id]);
  }
  const issues = new Map<string, ValidationIssue[]>();
  for (const [fmUniqueId, clubIds] of clubIdsByFmId) {
    if (clubIds.length < 2) continue;
    for (const clubId of clubIds) {
      const others = clubIds.filter((other) => other !== clubId).map((other) => `"${other}"`);
      issues.set(clubId, [{ rule: "duplicate-fm-unique-id", message: `fmUniqueId "${fmUniqueId}" is also used by club ${others.join(", ")}` }]);
    }
  }
  return issues;
}

// O buffer vem do próprio renderer: a checagem pega erro de programa (tamanho ou formato), não arquivo corrompido.
export async function checkRenderedPng(png: Buffer, kitType: KitType, renderType: RenderType): Promise<ValidationIssue | undefined> {
  const label = `${kitType} ${renderType} render`;
  const size = FM26_RENDER_SIZES[renderType];
  const metadata = await sharp(png)
    .metadata()
    .catch(() => undefined);
  if (!metadata) return { rule: "invalid-render", message: `${label} is not an image` };
  if (metadata.format !== "png") return { rule: "invalid-render", message: `${label} is ${metadata.format}, expected png` };
  if (metadata.width !== size || metadata.height !== size) {
    return { rule: "invalid-render", message: `${label} is ${metadata.width}×${metadata.height}, expected ${size}×${size}` };
  }
  return undefined;
}
