import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

// Barra do tronco 2D (y = 382 no viewBox 414): abaixo dela o overlay é cheio.
const GRADIENT_END = 0.92;
// Faixas de ~2 px no 2D: degradê suave sem <defs> nem id.
const BAND_RATIO = 1 / 207;

function gradientLayout({ height, params }: PatternGeometry): { start: number; end: number; bands: number; band: number } {
  const start = params.start * height;
  const end = GRADIENT_END * height;
  const bands = Math.max(1, Math.round((end - start) / (BAND_RATIO * height)));
  return { start, end, bands, band: (end - start) / bands };
}

export const gradientPattern: PatternTemplate = {
  id: "gradient",
  name: "Gradient",
  category: "modern",
  defaultWeight: 0,
  // start mínimo 0.58 fica abaixo da caixa do patrocinador (y 229 = 0.553): os logos do 2D ficam sempre sobre a base pura.
  parameters: { start: { min: 0.58, max: 0.72, default: 0.65 } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band } = gradientLayout(context);
    const rects: string[] = [];
    for (let index = 0; index < bands; index++) {
      rects.push(`<rect x="0" y="${fmt(start + index * band)}" width="${fmt(width)}" height="${fmt(band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    rects.push(`<rect x="0" y="${fmt(end)}" width="${fmt(width)}" height="${fmt(height - end)}"/>`);
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(_x, y, geometry) {
    const { start, end, bands, band } = gradientLayout(geometry);
    if (y < start) return "base";
    if (y >= end) return "overlay";
    // Opacidade 0.5 exata vira 127 ou 128 no PNG: só conta como overlay acima da metade, como o limiar do teste de pixel.
    return (Math.floor((y - start) / band) + 1) / bands > 0.5 ? "overlay" : "base";
  },
};
