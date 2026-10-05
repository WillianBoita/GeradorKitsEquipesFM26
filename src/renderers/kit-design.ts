import type { ColorRole, KitDefinition } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

// O que pintar em cada parte do kit, sem saber onde a parte fica: o renderer 2D e o 3D (Fase 3c) desenham a partir daqui.
export type KitFill =
  { kind: "solid"; color: string } | { kind: "pattern"; base: string; overlay: string; template: PatternTemplate; params: Record<string, number> };

export interface KitDesign {
  body: KitFill;
  sleeves: KitFill;
  cuffs: string;
  collar: string;
  shorts: string;
  socks: string;
}

export function kitDesign(kit: KitDefinition): KitDesign {
  const color = (role: ColorRole): string => kit.colors[role];
  const template = getPatternTemplate(kit.pattern.id);
  const body: KitFill = {
    kind: "pattern",
    base: color(kit.pattern.base),
    overlay: color(kit.pattern.overlay),
    template,
    params: resolveParams(template, kit.pattern.params),
  };
  return {
    body,
    sleeves: kit.sleeves.style === "match-body" ? body : { kind: "solid", color: color(kit.sleeves.color) },
    cuffs: color(kit.sleeves.cuffColor),
    collar: color(kit.collar.color),
    shorts: color(kit.shorts.color),
    socks: color(kit.socks.color),
  };
}

export function fillSvg(fill: KitFill, width: number, height: number): string {
  if (fill.kind === "solid") return `<rect width="${width}" height="${height}" fill="${fill.color}"/>`;
  const pattern = fill.template.render({ width, height, base: fill.base, overlay: fill.overlay, params: fill.params });
  return `<rect width="${width}" height="${height}" fill="${fill.base}"/>${pattern}`;
}
