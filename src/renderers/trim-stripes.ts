import type { TrimStripeStyle } from "../core/kit.js";

// Faixas de cada estilo em fração da largura nominal da peça, medidas a partir da borda.
export const TRIM_STRIPE_BANDS: Record<TrimStripeStyle, readonly (readonly [number, number])[]> = {
  single: [[0.375, 0.625]],
  double: [
    [0.1, 0.3],
    [0.7, 0.9],
  ],
};

export interface TrimStroke {
  width: number;
  paint: "stripe" | "trim";
}

// Peça desenhada como traço sobre a linha central: cada faixa da metade de fora vira um traço de listra e, se não chega ao meio, um traço da peça por cima; a outra metade é o espelho.
export function centeredStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[] {
  return TRIM_STRIPE_BANDS[style].flatMap(([from, to]): TrimStroke[] => {
    if (from >= 0.5) return [];

    const stripe: TrimStroke = { width: (1 - 2 * from) * width, paint: "stripe" };
    return to < 0.5 ? [stripe, { width: (1 - 2 * to) * width, paint: "trim" }] : [stripe];
  });
}

// Peça preenchida: o contorno é traçado e recortado pela própria peça, então só a metade de dentro de cada traço aparece; da faixa mais funda para a mais rasa.
export function edgeStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[] {
  return [...TRIM_STRIPE_BANDS[style]]
    .sort(([, a], [, b]) => b - a)
    .flatMap(([from, to]): TrimStroke[] => [
      { width: 2 * to * width, paint: "stripe" },
      { width: 2 * from * width, paint: "trim" },
    ]);
}

export function stripeStrokesSvg(d: string, strokes: readonly TrimStroke[], colors: { stripe: string; trim: string }, attributes = ""): string {
  return strokes.map(({ width, paint }) => `<path d="${d}" fill="none" stroke="${colors[paint]}" stroke-width="${width}"${attributes}/>`).join("");
}
