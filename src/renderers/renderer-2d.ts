import sharp from "sharp";
import type { ColorRole, KitDefinition } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import { bodyPath, collarPath, CUFFS_PATH, outlinePath, SHIRT_2D_VIEWBOX, SLEEVES_PATH } from "./shirt-2d-shape.js";

export const KIT_2D_SIZE = 414;

export interface Render2dOptions { size?: number }

export function renderKit2dSvg(kit: KitDefinition, options: Render2dOptions = {}): string {
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const color = (role: ColorRole): string => kit.colors[role];
  const template = getPatternTemplate(kit.pattern.id);
  const params = resolveParams(template, kit.pattern.params);
  const pattern = template.render({ width: view, height: view, base: color(kit.pattern.base), overlay: color(kit.pattern.overlay), params });
  const fabric = `<rect width="${view}" height="${view}" fill="${color(kit.pattern.base)}"/>${pattern}`;
  const sleeves = kit.sleeves.style === "match-body" ? `<g clip-path="url(#sleeves)">${fabric}</g>` : `<path d="${SLEEVES_PATH}" fill="${color(kit.sleeves.color)}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(kit.collar.style)}"/></clipPath><clipPath id="sleeves"><path d="${SLEEVES_PATH}"/></clipPath></defs>`,
    `<g clip-path="url(#body)">${fabric}</g>`,
    sleeves,
    `<path d="${CUFFS_PATH}" fill="none" stroke="${color(kit.sleeves.cuffColor)}" stroke-width="8"/>`,
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${color(kit.collar.color)}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
}

export async function renderKit2dPng(kit: KitDefinition, options: Render2dOptions = {}): Promise<Buffer> {
  return sharp(Buffer.from(renderKit2dSvg(kit, options))).png().toBuffer();
}
