import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const halvesPattern: PatternTemplate = {
  id: "halves",
  name: "Halves",
  category: "modern",
  defaultWeight: 0,
  parameters: { side: { min: 0, max: 1, default: 0, integer: true } },
  render({ width, height, overlay, params }) {
    const half = width / 2;
    return `<rect x="${params.side === 0 ? 0 : fmt(half)}" y="0" width="${fmt(half)}" height="${fmt(height)}" fill="${overlay}"/>`;
  },
  colorAt(x, _y, { width, params }) {
    return (params.side === 0 ? x < width / 2 : x >= width / 2) ? "overlay" : "base";
  },
};
