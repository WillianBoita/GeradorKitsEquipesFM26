import { fadeBands, fadeLayer, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

interface RadialFade extends FadeBands {
  cx: number;
  cy: number;
  radius: number;
}

// Valor do degradê = radius − distância ao centro: 0 na borda do círculo, radius no centro.
function radialFade({ width, height, params }: PatternGeometry): RadialFade {
  const radius = params.radius * height;
  return { ...fadeBands(0, radius, height), cx: params.cx * width, cy: params.cy * height, radius };
}

export const gradientRadialPattern: PatternTemplate = {
  id: "gradient-radial",
  name: "Radial gradient",
  category: "modern",
  // Raio máximo 0.33 (137 px) com o centro em y ≥ 0.9 (373 px): o degradê para em y 236, abaixo da caixa do patrocinador (y 229); com cx nos extremos, o canto dela fica a 150 px do centro.
  parameters: {
    cx: { min: 0.25, max: 0.75, default: 0.5 },
    cy: { min: 0.9, max: 1, default: 0.95 },
    radius: { min: 0.22, max: 0.33, default: 0.28 },
  },
  render(context) {
    const { cx, cy, radius, bands, band } = radialFade(context);
    // O mesmo texto desenha o círculo nos dois anéis que ele separa: a borda comum é idêntica, e nenhum pixel fica sem anel ou com dois.
    const circle = (r: number) =>
      `M${fmt(cx - r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`;
    const rings: string[] = [];
    for (let index = 0; index < bands; index++) {
      const inner = index === bands - 1 ? "" : ` ${circle(radius - (index + 1) * band)}`;
      rings.push(`<path d="${circle(radius - index * band)}${inner}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    // Sem antialias pelo mesmo motivo do gradient-diagonal: bordas curvas somariam dois anéis no mesmo pixel.
    return `<g fill="${context.overlay}" fill-rule="evenodd" shape-rendering="crispEdges">${rings.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const fade = radialFade(geometry);
    return fadeLayer(fade.radius - Math.hypot(x - fade.cx, y - fade.cy), fade);
  },
};
