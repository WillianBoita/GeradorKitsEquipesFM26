import type { PatternLayer } from "./types.js";

// Barra do tronco 2D (y = 382 no viewBox 414): os degradês que descem terminam nela, com overlay cheio abaixo.
export const TORSO_BOTTOM = 0.92;
// Faixas de ~2 px no 2D: degradê suave sem <defs> nem id.
const BAND_RATIO = 1 / 207;

export interface FadeBands {
  start: number;
  end: number;
  bands: number;
  band: number;
}

// Divide [start, end] em faixas de opacidade crescente: a faixa index tem opacidade (index + 1) / bands.
export function fadeBands(start: number, end: number, height: number): FadeBands {
  const bands = Math.max(1, Math.round((end - start) / (BAND_RATIO * height)));
  return { start, end, bands, band: (end - start) / bands };
}

// Camada que pinta o ponto de valor value: antes de start é base pura, de end em diante é overlay cheio.
export function fadeLayer(value: number, { start, end, bands, band }: FadeBands): PatternLayer {
  if (value < start) return "base";
  if (value >= end) return "overlay";
  // Opacidade 0.5 exata vira 127 ou 128 no PNG: só conta como overlay acima da metade, como o limiar do teste de pixel.
  return (Math.floor((value - start) / band) + 1) / bands > 0.5 ? "overlay" : "base";
}
