import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
import { LOGO_BOXES, SHIRT_2D_VIEWBOX } from "../renderers/shirt-2d-shape.js";
import { contrastRatio } from "./color.js";
import type { ColorRole, KitDefinition, LogoSlot } from "./kit.js";

// Mínimo da WCAG 2.1 para elementos gráficos.
export const MIN_LOGO_CONTRAST = 3;
// Lascas do padrão abaixo disto não atrapalham a leitura do logo.
export const MIN_BACKGROUND_SHARE = 0.05;
const GRID = 24;

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

// Maior contraste mínimo contra o fundo; empate fica com o preto.
function bestNeutral(background: readonly string[]): { hex: string; score: number } {
  const score = (hex: string) => Math.min(...background.map((color) => contrastRatio(hex, color)));
  const [white, black] = [score("#ffffff"), score("#000000")];
  return white > black ? { hex: "#ffffff", score: white } : { hex: "#000000", score: black };
}

// Os logos mantêm as cores do arquivo, então a borda só precisa destacar a silhueta do fundo da caixa. Se nenhuma neutra lê sobre todas as cores atrás dela, vale a dominante.
export function logoOutlineColor(kit: KitDefinition, slot: LogoSlot): string {
  const background = backgroundRoles(kit, slot).map((role) => kit.colors[role]);
  const best = bestNeutral(background);
  return best.score >= MIN_LOGO_CONTRAST ? best.hex : bestNeutral(background.slice(0, 1)).hex;
}
