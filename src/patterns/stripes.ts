import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function stripeLayout({ width, params }: PatternGeometry): { period: number; stripeWidth: number; offset: number } {
  const period = width / params.count;
  const stripeWidth = period * params.ratio;
  return { period, stripeWidth, offset: (period - stripeWidth) / 2 };
}

export const stripesPattern: PatternTemplate = {
  id: "stripes",
  name: "Vertical stripes",
  category: "classic",
  defaultWeight: 35,
  parameters: { count: { min: 3, max: 15, default: 7, integer: true }, ratio: { min: 0.2, max: 0.4, default: 0.3 } },
  render(context) {
    const { period, stripeWidth, offset } = stripeLayout(context);
    return Array.from(
      { length: context.params.count },
      (_, index) => `<rect x="${fmt(index * period + offset)}" y="0" width="${fmt(stripeWidth)}" height="${fmt(context.height)}" fill="${context.overlay}"/>`,
    ).join("");
  },
  colorAt(x, _y, geometry) {
    const { period, stripeWidth, offset } = stripeLayout(geometry);
    const local = x - Math.floor(x / period) * period;
    return local >= offset && local <= offset + stripeWidth ? "overlay" : "base";
  },
};
