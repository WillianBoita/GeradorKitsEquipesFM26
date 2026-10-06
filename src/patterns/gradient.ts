import { fadeBands, fadeLayer, TORSO_BOTTOM, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function gradientFade({ height, params }: PatternGeometry): FadeBands {
  return fadeBands(params.start * height, TORSO_BOTTOM * height, height);
}

export const gradientPattern: PatternTemplate = {
  id: "gradient",
  name: "Gradient",
  category: "modern",
  // start mínimo 0.58 fica abaixo da caixa do patrocinador (y 229 = 0.553): os logos do 2D ficam sempre sobre a base pura.
  parameters: { start: { min: 0.58, max: 0.72, default: 0.65 } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band } = gradientFade(context);
    const rects: string[] = [];
    for (let index = 0; index < bands; index++) {
      rects.push(`<rect x="0" y="${fmt(start + index * band)}" width="${fmt(width)}" height="${fmt(band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    rects.push(`<rect x="0" y="${fmt(end)}" width="${fmt(width)}" height="${fmt(height - end)}"/>`);
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(_x, y, geometry) {
    return fadeLayer(y, gradientFade(geometry));
  },
};
