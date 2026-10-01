import type { CollarStyle, LogoSlot } from "../core/kit.js";

// Coordenadas no viewBox 414×414; o renderer escala via width/height do SVG.
export const SHIRT_2D_VIEWBOX = 414;

const NECKLINES: Record<CollarStyle, string> = { round: "M165 48 Q207 92 249 48", "v-neck": "M165 48 L207 100 L249 48" };
const TORSO = "L300 62 L302 146 L302 382 L112 382 L112 146 L114 62 Z";
const SILHOUETTE = "L300 62 L378 140 L346 178 L302 146 L302 382 L112 382 L112 146 L68 178 L36 140 L114 62 Z";

export const SLEEVES_PATH = "M300 62 L378 140 L346 178 L302 146 Z M114 62 L36 140 L68 178 L112 146 Z";
export const CUFFS_PATH = "M374 137 L342 175 M40 137 L72 175";

export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Escudo no peito esquerdo do jogador (direita de quem olha), fabricante no direito, patrocinador no centro; todas abaixo do fundo da gola v-neck (y = 100).
export const LOGO_BOXES: Record<LogoSlot, LogoBox> = {
  badge: { x: 232, y: 102, width: 36, height: 36 },
  manufacturer: { x: 149, y: 105, width: 30, height: 30 },
  sponsor: { x: 145, y: 181, width: 124, height: 48 },
};

export function collarPath(style: CollarStyle): string {
  return NECKLINES[style];
}

export function bodyPath(style: CollarStyle): string {
  return `${NECKLINES[style]} ${TORSO}`;
}

export function outlinePath(style: CollarStyle): string {
  return `${NECKLINES[style]} ${SILHOUETTE}`;
}
