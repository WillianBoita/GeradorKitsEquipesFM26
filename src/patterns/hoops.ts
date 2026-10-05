import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function hoopLayout({ height, params }: PatternGeometry): { period: number; hoopHeight: number; offset: number } {
  const period = height / params.count;
  const hoopHeight = period * params.ratio;
  return { period, hoopHeight, offset: (period - hoopHeight) / 2 };
}

export const hoopsPattern: PatternTemplate = {
  id: "hoops",
  name: "Hoops",
  category: "classic",
  parameters: { count: { min: 4, max: 12, default: 8, integer: true }, ratio: { min: 0.2, max: 0.4, default: 0.3 } },
  render(context) {
    const { period, hoopHeight, offset } = hoopLayout(context);
    return Array.from(
      { length: context.params.count },
      (_, index) => `<rect x="0" y="${fmt(index * period + offset)}" width="${fmt(context.width)}" height="${fmt(hoopHeight)}" fill="${context.overlay}"/>`,
    ).join("");
  },
  colorAt(_x, y, geometry) {
    const { period, hoopHeight, offset } = hoopLayout(geometry);
    const local = y - Math.floor(y / period) * period;
    return local >= offset && local <= offset + hoopHeight ? "overlay" : "base";
  },
};
