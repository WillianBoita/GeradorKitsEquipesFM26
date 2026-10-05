import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function diagonalLayout({ width, height, params }: PatternGeometry): { period: number; stripeWidth: number; reach: number } {
  const diagonal = Math.hypot(width, height);
  const period = diagonal / params.count;
  return { period, stripeWidth: period * params.ratio, reach: Math.ceil(diagonal / 2 / period) + 1 };
}

export const diagonalPattern: PatternTemplate = {
  id: "diagonal",
  name: "Diagonal stripes",
  category: "modern",
  parameters: {
    count: { min: 4, max: 12, default: 7, integer: true },
    ratio: { min: 0.2, max: 0.4, default: 0.3 },
    direction: { min: 0, max: 1, default: 0, integer: true },
  },
  render(context) {
    const { width, height, overlay, params } = context;
    const { period, stripeWidth, reach } = diagonalLayout(context);
    // Comprimento maior que a diagonal do canvas, como no sash: a listra nunca termina dentro da camisa.
    const length = (width + height) * 2;
    const rects: string[] = [];
    for (let index = -reach; index <= reach; index++) {
      rects.push(`<rect x="${fmt(-length / 2)}" y="${fmt(index * period - stripeWidth / 2)}" width="${fmt(length)}" height="${fmt(stripeWidth)}"/>`);
    }
    const angle = params.direction === 0 ? 45 : -45;
    return `<g fill="${overlay}" transform="translate(${fmt(width / 2)} ${fmt(height / 2)}) rotate(${angle})">${rects.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const { period, stripeWidth } = diagonalLayout(geometry);
    const [dx, dy] = [x - geometry.width / 2, y - geometry.height / 2];
    // Mesma convenção do sash: rotate(45) desce para a direita (dy = dx), rotate(-45) sobe (dy = -dx).
    const offset = (geometry.params.direction === 0 ? dy - dx : dy + dx) / Math.SQRT2;
    const local = offset - Math.round(offset / period) * period;
    return Math.abs(local) <= stripeWidth / 2 ? "overlay" : "base";
  },
};
