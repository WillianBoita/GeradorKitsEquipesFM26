import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
import { LOGO_BOXES, SHIRT_2D_VIEWBOX } from "../renderers/shirt-2d-shape.js";
import { contrastRatio } from "./color.js";
import { COLOR_ROLES, type ColorRole, type KitDefinition, type LogoColor, type LogoSlot } from "./kit.js";
import type { Palette } from "./palette.js";

// Mínimo da WCAG 2.1 para elementos gráficos.
export const MIN_LOGO_CONTRAST = 3;
// Lascas do padrão abaixo disto não atrapalham a leitura do logo.
export const MIN_BACKGROUND_SHARE = 0.05;
const GRID = 24;
const NEUTRALS = ["#ffffff", "#000000"];

export interface LogoColors {
  color: LogoColor;
  outline?: LogoColor;
}

interface Candidate {
  value: LogoColor;
  hex: string;
  fromPalette: boolean;
}

// Fração da caixa do logo que o padrão pinta com o overlay, numa grade GRID×GRID no layout 2D.
export function overlayShare(template: PatternTemplate, params: Record<string, number>, slot: LogoSlot): number {
  const geometry = { width: SHIRT_2D_VIEWBOX, height: SHIRT_2D_VIEWBOX, params: resolveParams(template, params) };
  const box = LOGO_BOXES[slot];
  let overlay = 0;
  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      const x = box.x + ((column + 0.5) * box.width) / GRID;
      const y = box.y + ((row + 0.5) * box.height) / GRID;
      if (template.colorAt(x, y, geometry) === "overlay") overlay++;
    }
  }
  return overlay / (GRID * GRID);
}

// Mede no layout 2D, o mesmo que o renderer usa para posicionar os logos. Só o padrão principal conta: as camadas nunca entram nas caixas (layer-logo-overlap).
export function backgroundRoles(kit: KitDefinition, slot: LogoSlot): ColorRole[] {
  const overlay = overlayShare(getPatternTemplate(kit.pattern.id), kit.pattern.params, slot);
  const shares: [ColorRole, number][] = [
    [kit.pattern.base, 1 - overlay],
    [kit.pattern.overlay, overlay],
  ];
  const roles = shares
    .filter(([, share]) => share >= MIN_BACKGROUND_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([role]) => role);
  return [...new Set(roles)];
}

function candidates(palette: Palette): Candidate[] {
  return [
    ...COLOR_ROLES.map((role) => ({ value: role, hex: palette[role], fromPalette: true })),
    ...NEUTRALS.map((hex) => ({ value: hex, hex, fromPalette: false })),
  ];
}

type Contrast = (a: string, b: string) => number;

// A busca de pares repete as mesmas medidas várias vezes e o Color.js é caro; guardar o resultado mantém o generator rápido.
function memoizedContrast(): Contrast {
  const cache = new Map<string, number>();
  return (a, b) => {
    const key = `${a}|${b}`;
    let value = cache.get(key);
    if (value === undefined) cache.set(key, (value = contrastRatio(a, b)));
    return value;
  };
}

// Maior contraste mínimo contra o fundo; empate fica com a primeira candidata.
function bestSingle(group: Candidate[], background: readonly string[], contrast: Contrast): Candidate | undefined {
  let best: Candidate | undefined;
  let bestScore = MIN_LOGO_CONTRAST;
  for (const candidate of group) {
    const score = Math.min(...background.map((color) => contrast(candidate.hex, color)));
    if (score > bestScore || (best === undefined && score >= bestScore)) [best, bestScore] = [candidate, score];
  }
  return best;
}

// Preferência: cor única da paleta, branco/preto, par com contorno (spec da Fase 2b, seção 5.3).
export function chooseLogoColors(palette: Palette, background: readonly string[]): LogoColors | undefined {
  const all = candidates(palette);
  const contrast = memoizedContrast();
  for (const group of [all.filter((candidate) => candidate.fromPalette), all.filter((candidate) => !candidate.fromPalette)]) {
    const single = bestSingle(group, background, contrast);
    if (single) return { color: single.value };
  }
  const dominant = background[0]!;
  const pairs = all
    .flatMap((color) => all.filter((outline) => outline !== color).map((outline) => ({ color, outline })))
    .filter(
      ({ color, outline }) =>
        contrast(color.hex, outline.hex) >= MIN_LOGO_CONTRAST &&
        background.every((bg) => Math.max(contrast(color.hex, bg), contrast(outline.hex, bg)) >= MIN_LOGO_CONTRAST),
    );
  // sort é estável: o que empata nos três critérios segue a ordem das candidatas.
  pairs.sort(
    (a, b) =>
      Number(b.color.fromPalette) - Number(a.color.fromPalette) ||
      Number(b.outline.fromPalette) - Number(a.outline.fromPalette) ||
      contrast(b.color.hex, dominant) - contrast(a.color.hex, dominant),
  );
  const best = pairs[0];
  return best && { color: best.color.value, outline: best.outline.value };
}
