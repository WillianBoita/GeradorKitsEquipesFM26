import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const sashPattern: PatternTemplate = {
  id: "sash",
  name: "Sash",
  category: "classic",
  defaultWeight: 25,
  parameters: { width: { min: 30, max: 140, default: 80 }, direction: { min: 0, max: 1, default: 0, integer: true } },
  render({ width, height, overlay, params }) {
    const angle = params.direction === 0 ? 45 : -45;
    // Comprimento maior que a diagonal do canvas para a faixa nunca terminar dentro da camisa.
    const length =(width + height) * 2;
    return `<rect x="${fmt(-length / 2)}" y="${fmt(-params.width / 2)}" width="${fmt(length)}" height="${fmt(params.width)}" fill="${overlay}" transform="translate(${fmt(width / 2)} ${fmt(height / 2)}) rotate(${angle})"/>`;
  },
};
