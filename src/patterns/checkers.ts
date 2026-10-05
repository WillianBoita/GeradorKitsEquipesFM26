import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

// Paridade que também vale para índices negativos (à esquerda e acima do centro).
function isOdd(value: number): boolean {
  return ((value % 2) + 2) % 2 === 1;
}

export const checkersPattern: PatternTemplate = {
  id: "checkers",
  name: "Checkers",
  category: "modern",
  defaultWeight: 0,
  parameters: { size: { min: 0.06, max: 0.15, default: 0.1 } },
  render({ width, height, overlay, params }) {
    const side = params.size * width;
    const reach = Math.ceil(Math.max(width, height) / 2 / side) + 1;
    const rects: string[] = [];
    for (let row = -reach; row < reach; row++) {
      for (let column = -reach; column < reach; column++) {
        if (!isOdd(row + column)) continue;
        rects.push(`<rect x="${fmt(width / 2 + column * side)}" y="${fmt(height / 2 + row * side)}" width="${fmt(side)}" height="${fmt(side)}"/>`);
      }
    }
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, y, { width, height, params }) {
    const side = params.size * width;
    return isOdd(Math.floor((x - width / 2) / side) + Math.floor((y - height / 2) / side)) ? "overlay" : "base";
  },
};
