import { fmt } from "./svg.js";
import type { LayerSlot, PatternGeometry, PatternParameter, PatternTemplate } from "./types.js";

function lineBounds({ height, params }: PatternGeometry): [number, number] {
  const half = (params.thickness * height) / 2;
  return [params.position * height - half, params.position * height + half];
}

function horizontalLine(id: string, name: string, layerSlot: LayerSlot, position: PatternParameter, thickness: PatternParameter): PatternTemplate {
  return {
    id,
    name,
    category: "detail",
    layerSlot,
    parameters: { position, thickness },
    render(context) {
      const [top, bottom] = lineBounds(context);
      return `<rect x="0" y="${fmt(top)}" width="${fmt(context.width)}" height="${fmt(bottom - top)}" fill="${context.overlay}"/>`;
    },
    colorAt(_x, y, geometry) {
      const [top, bottom] = lineBounds(geometry);
      return y >= top && y <= bottom ? "overlay" : "base";
    },
  };
}

// No máximo a linha vai até y 95: abaixo do decote redondo (y 70) e acima das caixas de logo (y 102).
export const shoulderLinePattern = horizontalLine(
  "shoulder-line",
  "Shoulder line",
  "shoulders",
  { min: 0.19, max: 0.22, default: 0.2 },
  { min: 0.01, max: 0.02, default: 0.015 },
);

// Começa no mínimo em y 241, abaixo da caixa do patrocinador (y 229), e termina no máximo em y 359, acima da barra do tronco (y 382).
export const hoopLinePattern = horizontalLine(
  "hoop-line",
  "Hoop line",
  "lower",
  { min: 0.6, max: 0.85, default: 0.72 },
  { min: 0.015, max: 0.035, default: 0.025 },
);
