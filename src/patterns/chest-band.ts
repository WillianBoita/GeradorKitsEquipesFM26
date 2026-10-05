import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const chestBandPattern: PatternTemplate = {
  id: "chest-band",
  name: "Chest band",
  category: "retro",
  defaultWeight: 0,
  parameters: { position: { min: 0.35, max: 0.6, default: 0.45 }, width: { min: 0.1, max: 0.22, default: 0.15 } },
  render({ width, height, overlay, params }) {
    const band = params.width * height;
    return `<rect x="0" y="${fmt(params.position * height - band / 2)}" width="${fmt(width)}" height="${fmt(band)}" fill="${overlay}"/>`;
  },
  colorAt(_x, y, { height, params }) {
    return Math.abs(y - params.position * height) <= (params.width * height) / 2 ? "overlay" : "base";
  },
};
