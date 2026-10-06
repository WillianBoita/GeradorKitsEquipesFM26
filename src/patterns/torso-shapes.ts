import { fmt } from "./svg.js";
import type { PatternGeometry, PatternParameter, PatternRenderContext, PatternTemplate } from "./types.js";

// Centro das formas no 2D (y 306): no tamanho máximo (raio 66) elas ficam entre a caixa do patrocinador (y 229) e a barra do tronco (y 382).
const CENTER_Y = 0.74;

const SHAPE_PARAMETERS: Record<string, PatternParameter> = {
  size: { min: 0.08, max: 0.16, default: 0.12 },
  stroke: { min: 0.012, max: 0.025, default: 0.018 },
};

interface ShapeLayout {
  cx: number;
  cy: number;
  radius: number;
  stroke: number;
}

function shapeLayout({ width, height, params }: PatternGeometry): ShapeLayout {
  return { cx: width / 2, cy: CENTER_Y * height, radius: params.size * width, stroke: params.stroke * width };
}

function torsoShape(
  id: string,
  name: string,
  render: (layout: ShapeLayout, context: PatternRenderContext) => string,
  paints: (dx: number, dy: number, layout: ShapeLayout) => boolean,
): PatternTemplate {
  return {
    id,
    name,
    category: "detail",
    layerSlot: "lower",
    parameters: SHAPE_PARAMETERS,
    render: (context) => render(shapeLayout(context), context),
    colorAt(x, y, geometry) {
      const layout = shapeLayout(geometry);
      return paints(x - layout.cx, y - layout.cy, layout) ? "overlay" : "base";
    },
  };
}

// Contorno de polígono regular: o polígono de dentro é o de fora reduzido no centro, o que dá a mesma espessura em todos os lados.
// distance é a maior projeção do ponto nas normais dos lados, então o contorno é a faixa distance ∈ [apótema − stroke, apótema].
function outlinedPolygon(
  id: string,
  name: string,
  vertices: (radius: number) => [number, number][],
  apothem: (radius: number) => number,
  distance: (dx: number, dy: number) => number,
): PatternTemplate {
  return torsoShape(
    id,
    name,
    ({ cx, cy, radius, stroke }, { overlay }) => {
      const scale = (apothem(radius) - stroke) / apothem(radius);
      const ring = (factor: number) =>
        `M${vertices(radius)
          .map(([px, py]) => `${fmt(cx + px * factor)} ${fmt(cy + py * factor)}`)
          .join(" L")} Z`;
      return `<path d="${ring(1)} ${ring(scale)}" fill="${overlay}" fill-rule="evenodd"/>`;
    },
    (dx, dy, { radius, stroke }) => {
      const value = distance(dx, dy);
      return value <= apothem(radius) && value >= apothem(radius) - stroke;
    },
  );
}

export const torsoCirclePattern = torsoShape(
  "torso-circle",
  "Torso circle",
  ({ cx, cy, radius, stroke }, { overlay }) =>
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius - stroke / 2)}" fill="none" stroke="${overlay}" stroke-width="${fmt(stroke)}"/>`,
  (dx, dy, { radius, stroke }) => {
    const distance = Math.hypot(dx, dy);
    return distance <= radius && distance >= radius - stroke;
  },
);

export const torsoDiamondPattern = outlinedPolygon(
  "torso-diamond",
  "Torso diamond",
  (radius) => [
    [0, -radius],
    [radius, 0],
    [0, radius],
    [-radius, 0],
  ],
  (radius) => radius / Math.SQRT2,
  (dx, dy) => (Math.abs(dx) + Math.abs(dy)) / Math.SQRT2,
);

const SIN_60 = Math.sqrt(3) / 2;

// Ponta para baixo: o lado reto fica em cima, mais longe do patrocinador.
export const torsoTrianglePattern = outlinedPolygon(
  "torso-triangle",
  "Torso triangle",
  (radius) => [
    [-radius * SIN_60, -radius / 2],
    [radius * SIN_60, -radius / 2],
    [0, radius],
  ],
  (radius) => radius / 2,
  (dx, dy) => Math.max(-dy, -SIN_60 * dx + dy / 2, SIN_60 * dx + dy / 2),
);

export const torsoCrossPattern = torsoShape(
  "torso-cross",
  "Torso cross",
  ({ cx, cy, radius, stroke }, { overlay }) =>
    `<g fill="${overlay}"><rect x="${fmt(cx - radius)}" y="${fmt(cy - stroke / 2)}" width="${fmt(2 * radius)}" height="${fmt(stroke)}"/><rect x="${fmt(cx - stroke / 2)}" y="${fmt(cy - radius)}" width="${fmt(stroke)}" height="${fmt(2 * radius)}"/></g>`,
  (dx, dy, { radius, stroke }) => (Math.abs(dx) <= radius && Math.abs(dy) <= stroke / 2) || (Math.abs(dy) <= radius && Math.abs(dx) <= stroke / 2),
);
