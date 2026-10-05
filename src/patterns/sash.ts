import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const sashPattern: PatternTemplate = {
  id: "sash",
  name: "Sash",
  category: "classic",
  parameters: { width: { min: 30, max: 100, default: 70 }, direction: { min: 0, max: 1, default: 0, integer: true } },
  render({ width, height, overlay, params }) {
    const angle = params.direction === 0 ? 45 : -45;
    // Comprimento maior que a diagonal do canvas para a faixa nunca terminar dentro da camisa.
    const length = (width + height) * 2;
    return `<rect x="${fmt(-length / 2)}" y="${fmt(-params.width / 2)}" width="${fmt(length)}" height="${fmt(params.width)}" fill="${overlay}" transform="translate(${fmt(width / 2)} ${fmt(height / 2)}) rotate(${angle})"/>`;
  },
  colorAt(x, y, { width, height, params }) {
    const [dx, dy] = [x - width / 2, y - height / 2];
    // Distância ao eixo da faixa: rotate(45) desce para a direita (dy = dx), rotate(-45) sobe (dy = -dx).
    const distance = Math.abs(params.direction === 0 ? dy - dx : dy + dx) / Math.SQRT2;
    return distance <= params.width / 2 ? "overlay" : "base";
  },
};
