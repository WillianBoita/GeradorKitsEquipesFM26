import Color from "colorjs.io";
import { contrastRatio, normalizeHex, toHex } from "./color.js";
import type { Rng } from "./random.js";

export interface PaletteInput { primary: string; secondary?: string; accent?: string }
export interface Palette { primary: string; secondary: string; accent: string }

export const MIN_ACCENT_CONTRAST = 3;
const WHITE = "#ffffff";
const BLACK = "#000000";

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
  const candidate = toHex(new Color("oklch", [lightness < 0.6 ? 0.85 : 0.35, 0.15, accentHue]));
  // Branco ou preto sempre atinge contraste >= 4.5 contra qualquer cor, então o fallback garante o mínimo.
  return contrastRatio(primary, candidate) >= MIN_ACCENT_CONTRAST ? candidate : bestNeutral(primary);
}

export function resolvePalette(input: PaletteInput, rng: Rng): Palette {
  const primary = normalizeHex(input.primary);
  const secondary = input.secondary ? normalizeHex(input.secondary) : bestNeutral(primary);
  const accent = input.accent ? normalizeHex(input.accent) : deriveAccent(primary, rng);
  return { primary, secondary, accent };
}
