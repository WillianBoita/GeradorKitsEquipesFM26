import Color from "colorjs.io";
import { contrastRatio, normalizeHex, toHex } from "./color.js";
import type { Rng } from "./random.js";

export interface PaletteInput {
  primary: string;
  secondary?: string;
  accent?: string;
}
export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
}

export const MIN_ACCENT_CONTRAST = 3;
const WHITE = "#ffffff";
const BLACK = "#000000";
// Primárias de luminosidade média raramente contrastam com o primeiro alvo; os seguintes evitam cair no neutro, que costuma repetir a secondary.
const ACCENT_LIGHTNESS_FOR_DARK = [0.85, 0.92, 0.75];
const ACCENT_LIGHTNESS_FOR_LIGHT = [0.35, 0.25, 0.45];

export function bestNeutral(color: string): string {
  return contrastRatio(color, WHITE) >= contrastRatio(color, BLACK) ? WHITE : BLACK;
}

export function deriveAccent(primary: string, rng: Rng): string {
  const source = new Color(primary);
  const hue = source.get("oklch.h");
  const lightness = source.get("oklch.l") ?? 0;
  // Cores acromáticas não têm hue (Color.js devolve null/NaN); usa 0 como base para manter o resultado determinístico.
  const baseHue = typeof hue === "number" && Number.isFinite(hue) ? hue : 0;
  const accentHue = (baseHue + 180 + rng.range(-30, 30) + 360) % 360;
  for (const target of lightness < 0.6 ? ACCENT_LIGHTNESS_FOR_DARK : ACCENT_LIGHTNESS_FOR_LIGHT) {
    const candidate = toHex(new Color("oklch", [target, 0.15, accentHue]));
    if (contrastRatio(primary, candidate) >= MIN_ACCENT_CONTRAST) return candidate;
  }
  // Branco ou preto sempre atinge contraste >= 4.5 contra qualquer cor, então o fallback garante o mínimo.
  return bestNeutral(primary);
}

export function resolvePalette(input: PaletteInput, rng: Rng): Palette {
  const primary = normalizeHex(input.primary);
  const secondary = input.secondary ? normalizeHex(input.secondary) : bestNeutral(primary);
  const accent = input.accent ? normalizeHex(input.accent) : deriveAccent(primary, rng);
  return { primary, secondary, accent };
}
