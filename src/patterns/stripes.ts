import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const stripesPattern: PatternTemplate = {
  id: "stripes",
  name: "Vertical stripes",
  category: "classic",
  defaultWeight: 35,
  parameters: { count: { min: 3, max: 15, default: 7, integer: true }, ratio: { min: 0.2, max: 0.8, default: 0.5 } },
  render({ width, height, overlay, params }) {
    const period = width / params.count;
    const stripeWidth = period * params.ratio;
    const offset = (period - stripeWidth) / 2;
    return Array.from(
      { length: params.count },
      (_, index) => `<rect x="${fmt(index * period + offset)}" y="0" width="${fmt(stripeWidth)}" height="${fmt(height)}" fill="${overlay}"/>`,
    ).join("");
  },
};
