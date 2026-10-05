import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const chevronPattern: PatternTemplate = {
  id: "chevron",
  name: "Chevron",
  category: "retro",
  parameters: { depth: { min: 0.35, max: 0.6, default: 0.45 }, width: { min: 0.06, max: 0.14, default: 0.1 } },
  render({ width, height, overlay, params }) {
    const center = width / 2;
    const vertex = params.depth * height;
    // Braços a 45°: a faixa de espessura t ocupa t·√2 na vertical, metade para cada lado da linha central.
    const half = (params.width * width) / Math.SQRT2;
    const points = [
      [0, vertex - half - center],
      [center, vertex - half],
      [width, vertex - half - center],
      [width, vertex + half - center],
      [center, vertex + half],
      [0, vertex + half - center],
    ];
    return `<polygon points="${points.map(([px, py]) => `${fmt(px!)},${fmt(py!)}`).join(" ")}" fill="${overlay}"/>`;
  },
  colorAt(x, y, { width, height, params }) {
    const offset = Math.abs(x - width / 2) + y - params.depth * height;
    return Math.abs(offset) <= (params.width * width) / Math.SQRT2 ? "overlay" : "base";
  },
};
