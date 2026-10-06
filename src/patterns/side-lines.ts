import { fmt } from "./svg.js";
import { TORSO_LEFT, TORSO_RIGHT } from "./torso-edges.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function sideBands({ width, params }: PatternGeometry): [number, number][] {
  const band = params.width * width;
  const [left, right] = [TORSO_LEFT * width, TORSO_RIGHT * width];
  return [
    [left, left + band],
    [right - band, right],
  ];
}

export const sideLinesPattern: PatternTemplate = {
  id: "side-lines",
  name: "Side lines",
  category: "detail",
  layerSlot: "sides",
  // width máximo 0.03 (12 px) deixa o painel em x ≤ 125, longe das caixas de logo (x ≥ 145).
  parameters: { width: { min: 0.012, max: 0.03, default: 0.02 } },
  render(context) {
    const rects = sideBands(context).map(([from, to]) => `<rect x="${fmt(from)}" y="0" width="${fmt(to - from)}" height="${fmt(context.height)}"/>`);
    return `<g fill="${context.overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, _y, geometry) {
    return sideBands(geometry).some(([from, to]) => x >= from && x <= to) ? "overlay" : "base";
  },
};
