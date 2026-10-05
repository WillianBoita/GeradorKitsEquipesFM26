import type { CollarStyle, LogoSlot } from "../core/kit.js";

// Coordenadas no viewBox 414×414; o renderer escala via width/height do SVG.
export const SHIRT_2D_VIEWBOX = 414;

const ROUND_NECKLINE = "M165 48 Q207 92 249 48";
const V_NECKLINE = "M165 48 L207 100 L249 48";

interface CollarShape {
  neckline: string;
  trim?: string;
}

// neckline recorta o corpo e recebe o traço da gola; trim é a peça preenchida das golas polo (abas e carcela).
// Fora da carcela (x 200–214), nenhum trim passa de y = 101: as caixas de logo começam em y = 102.
const COLLARS: Record<CollarStyle, CollarShape> = {
  round: { neckline: ROUND_NECKLINE },
  "v-neck": { neckline: V_NECKLINE },
  polo: {
    neckline: ROUND_NECKLINE,
    trim: "M162 45 L146 60 L192 96 L203 72 Q182 64 165 48 Z M252 45 L268 60 L222 96 L211 72 Q232 64 249 48 Z M200 70 L214 70 L214 125 L200 125 Z",
  },
  "polo-v": { neckline: V_NECKLINE, trim: "M163 46 L207 100 L198 100 L140 58 Z M251 46 L207 100 L216 100 L274 58 Z" },
};

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

// Escudo no peito esquerdo do jogador (direita de quem olha), fabricante no direito, patrocinador no centro; todas abaixo das golas (y ≤ 101) e fora da carcela da polo.
export const LOGO_BOXES: Record<LogoSlot, LogoBox> = {
  badge: { x: 232, y: 102, width: 36, height: 36 },
  manufacturer: { x: 149, y: 105, width: 30, height: 30 },
  sponsor: { x: 145, y: 181, width: 124, height: 48 },
};

export function collarPath(style: CollarStyle): string {
  return COLLARS[style].neckline;
}

export function collarTrimPath(style: CollarStyle): string | undefined {
  return COLLARS[style].trim;
}

export function bodyPath(style: CollarStyle): string {
  return `${COLLARS[style].neckline} ${TORSO}`;
}

export function outlinePath(style: CollarStyle): string {
  return `${COLLARS[style].neckline} ${SILHOUETTE}`;
}
