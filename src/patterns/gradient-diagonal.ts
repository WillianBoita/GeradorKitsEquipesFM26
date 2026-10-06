import { fadeBands, fadeLayer, TORSO_BOTTOM, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

// Inclinação das linhas de mesma cor (≈27°). O valor do degradê é y + tilt·(x − w/2): o canto de baixo do patrocinador (x 269, y 229) vale 260 (0.628), abaixo do start mínimo.
const SLOPE = 0.5;

interface DiagonalFade extends FadeBands {
  tilt: number;
}

function diagonalFade({ height, params }: PatternGeometry): DiagonalFade {
  return { ...fadeBands(params.start * height, TORSO_BOTTOM * height, height), tilt: params.direction === 0 ? SLOPE : -SLOPE };
}

export const gradientDiagonalPattern: PatternTemplate = {
  id: "gradient-diagonal",
  name: "Diagonal gradient",
  category: "modern",
  parameters: { start: { min: 0.65, max: 0.72, default: 0.68 }, direction: { min: 0, max: 1, default: 0, integer: true } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band, tilt } = diagonalFade(context);
    // A linha de valor v cruza x = 0 em y = v + tilt·w/2 e x = w em y = v − tilt·w/2.
    const [left, right] = [(tilt * width) / 2, (-tilt * width) / 2];
    const quad = (from: number, to: number) => `0,${fmt(from + left)} ${fmt(width)},${fmt(from + right)} ${fmt(width)},${fmt(to + right)} 0,${fmt(to + left)}`;
    const polygons: string[] = [];
    for (let index = 0; index < bands; index++) {
      polygons.push(`<polygon points="${quad(start + index * band, start + (index + 1) * band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    // Overlay cheio do fim até além do canvas, em qualquer inclinação.
    polygons.push(`<polygon points="${quad(end, height + SLOPE * width)}"/>`);
    // Sem antialias: nas bordas inclinadas ele somaria duas faixas no mesmo pixel, e o colorAt deixaria de espelhar o render.
    return `<g fill="${overlay}" shape-rendering="crispEdges">${polygons.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const fade = diagonalFade(geometry);
    return fadeLayer(y + fade.tilt * (x - geometry.width / 2), fade);
  },
};
