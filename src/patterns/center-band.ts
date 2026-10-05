import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const centerBandPattern: PatternTemplate = {
  id: "center-band",
  name: "Center band",
  category: "retro",
  parameters: { width: { min: 0.08, max: 0.2, default: 0.14 } },
  render({ width, height, overlay, params }) {
    const band = params.width * width;
    return `<rect x="${fmt(width / 2 - band / 2)}" y="0" width="${fmt(band)}" height="${fmt(height)}" fill="${overlay}"/>`;
  },
  colorAt(x, _y, { width, params }) {
    return Math.abs(x - width / 2) <= (params.width * width) / 2 ? "overlay" : "base";
  },
};
