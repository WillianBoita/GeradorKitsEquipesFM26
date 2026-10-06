import { fmt } from "./svg.js";
import { TORSO_LEFT, TORSO_RIGHT } from "./torso-edges.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function pinlines({ width, params }: PatternGeometry): [number, number][] {
  const [inset, thickness, gap] = [params.inset * width, params.thickness * width, params.gap * width];
  const [left, right] = [TORSO_LEFT * width + inset, TORSO_RIGHT * width - inset];
  return [
    [left, left + thickness],
    [left + thickness + gap, left + 2 * thickness + gap],
    [right - 2 * thickness - gap, right - thickness - gap],
    [right - thickness, right],
  ];
}

export const doublePinlinePattern: PatternTemplate = {
  id: "double-pinline",
  name: "Double pinline",
  category: "detail",
  layerSlot: "sides",
  // inset mínimo 0.035 começa depois do painel de side-lines (x ≤ 125); no máximo, inset + 2·thickness + gap = 0.075 (31 px) termina em x 143, antes das caixas de logo (x 145).
  parameters: {
    inset: { min: 0.035, max: 0.043, default: 0.039 },
    thickness: { min: 0.005, max: 0.01, default: 0.007 },
    gap: { min: 0.006, max: 0.012, default: 0.009 },
  },
  render(context) {
    const rects = pinlines(context).map(([from, to]) => `<rect x="${fmt(from)}" y="0" width="${fmt(to - from)}" height="${fmt(context.height)}"/>`);
    return `<g fill="${context.overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, _y, geometry) {
    return pinlines(geometry).some(([from, to]) => x >= from && x <= to) ? "overlay" : "base";
  },
};
