import type { ColorRole, KitDefinition } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

// O que pintar em cada parte do kit, sem saber onde a parte fica: o renderer 2D e o 3D (Fase 3c) desenham a partir daqui.
export type KitFill =
  { kind: "solid"; color: string } | { kind: "pattern"; base: string; overlay: string; template: PatternTemplate; params: Record<string, number> };

// Camada de detalhe já resolvida: o renderer pinta só o overlay dela, na cor da camada.
export interface KitLayerFill {
  template: PatternTemplate;
  color: string;
  params: Record<string, number>;
}

export interface KitDesign {
  body: KitFill;
  // Separadas de body: a manga match-body reusa body e fica sem as camadas.
  bodyLayers: KitLayerFill[];
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
  const bodyLayers = (kit.layers ?? []).map((layer): KitLayerFill => {
    const layerTemplate = getPatternTemplate(layer.id);
    return { template: layerTemplate, color: color(layer.color), params: resolveParams(layerTemplate, layer.params) };
  });
  return {
    body,
    bodyLayers,
    sleeves: kit.sleeves.style === "match-body" ? body : { kind: "solid", color: color(kit.sleeves.color) },
    cuffs: color(kit.sleeves.cuffColor),
    collar: color(kit.collar.color),
    shorts: color(kit.shorts.color),
    socks: color(kit.socks.color),
  };
}

export function fillSvg(fill: KitFill, width: number, height: number, layers: readonly KitLayerFill[] = []): string {
  // O render da camada desenha só os elementos do overlay; sem outro <rect> de base, o padrão principal continua visível embaixo.
  const details = layers.map(({ template, color, params }) => template.render({ width, height, base: color, overlay: color, params })).join("");
  if (fill.kind === "solid") return `<rect width="${width}" height="${height}" fill="${fill.color}"/>${details}`;
  const pattern = fill.template.render({ width, height, base: fill.base, overlay: fill.overlay, params: fill.params });
  return `<rect width="${width}" height="${height}" fill="${fill.base}"/>${pattern}${details}`;
}
