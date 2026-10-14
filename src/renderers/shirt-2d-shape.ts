import type { CollarStyle, LogoSlot, SleeveCut } from "../core/kit.js";

// Coordenadas no viewBox 414×414; o renderer escala via width/height do SVG.
export const SHIRT_2D_VIEWBOX = 414;

const ROUND_NECKLINE = "M165 48 Q207 92 249 48";
const V_NECKLINE = "M165 48 L207 100 L249 48";

interface CollarShape {
  neckline: string;
  // Abas das golas polo: recebem a listra junto à borda.
  flaps?: string;
  // Carcela da polo: fica por cima da listra, como no PSD do FM.
  placket?: string;
}

// neckline recorta o corpo e recebe o traço da gola; flaps e placket são as peças preenchidas das golas polo.
// Fora da carcela (x 200–214), nenhuma peça passa de y = 101: as caixas de logo começam em y = 102.
const COLLARS: Record<CollarStyle, CollarShape> = {
  round: { neckline: ROUND_NECKLINE },
  "v-neck": { neckline: V_NECKLINE },
  polo: {
    neckline: ROUND_NECKLINE,
    flaps: "M162 45 L146 60 L192 96 L203 72 Q182 64 165 48 Z M252 45 L268 60 L222 96 L211 72 Q232 64 249 48 Z",
    placket: "M200 70 L214 70 L214 125 L200 125 Z",
  },
  "polo-v": { neckline: V_NECKLINE, flaps: "M163 46 L207 100 L198 100 L140 58 Z M251 46 L207 100 L216 100 L274 58 Z" },
};

// Na raglan o decote vai direto às axilas: os triângulos dos ombros saem do corpo e entram nas mangas.
const TORSO: Record<SleeveCut, string> = {
  "set-in": "L300 62 L302 146 L302 382 L112 382 L112 146 L114 62 Z",
  raglan: "L302 146 L302 382 L112 382 L112 146 Z",
};

const SILHOUETTE_POINTS = "L300 62 L378 140 L346 178 L302 146 L302 382 L112 382 L112 146 L68 178 L36 140 L114 62";
const SILHOUETTE = `${SILHOUETTE_POINTS} Z`;

const SLEEVES: Record<SleeveCut, string> = {
  "set-in": "M300 62 L378 140 L346 178 L302 146 Z M114 62 L36 140 L68 178 L112 146 Z",
  raglan: "M249 48 L300 62 L378 140 L346 178 L302 146 Z M165 48 L114 62 L36 140 L68 178 L112 146 Z",
};

export const RAGLAN_SEAMS_PATH = "M249 48 L302 146 M165 48 L112 146";
export const CUFFS_PATH = "M374 137 L342 175 M40 137 L72 175";

export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Escudo no peito esquerdo do jogador (direita de quem olha), fabricante no direito, patrocinador no centro; todas abaixo das golas (y ≤ 101) e fora da carcela da polo.
// O escudo e o patrocinador terminam em x 269: no máximo dos parâmetros, a double-pinline da direita começa em x 271.
export const LOGO_BOXES: Record<LogoSlot, LogoBox> = {
  badge: { x: 225, y: 102, width: 44, height: 44 },
  manufacturer: { x: 149, y: 105, width: 30, height: 30 },
  sponsor: { x: 145, y: 181, width: 124, height: 48 },
};

// Caixa do tronco 2D, de lateral a lateral e da linha do ombro à barra: é a janela do padrão que a frente da textura 3D mostra.
export const TORSO_WINDOW = { x: 112, y: 48, width: 190, height: 334 };

export function collarPath(style: CollarStyle): string {
  return COLLARS[style].neckline;
}

export function collarTrimPath(style: CollarStyle): string | undefined {
  const parts = [COLLARS[style].flaps, COLLARS[style].placket].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function collarFlapsPath(style: CollarStyle): string | undefined {
  return COLLARS[style].flaps;
}

export function collarPlacketPath(style: CollarStyle): string | undefined {
  return COLLARS[style].placket;
}

export function bodyPath(style: CollarStyle, cut: SleeveCut): string {
  return `${COLLARS[style].neckline} ${TORSO[cut]}`;
}

export function sleevesPath(cut: SleeveCut): string {
  return SLEEVES[cut];
}

// Sem o decote, a silhueta vai do fim ao começo da gola, (249, 48) e (165, 48), nas duas linhas de decote.
export function outlinePath(style: CollarStyle, neckline = true): string {
  return neckline ? `${COLLARS[style].neckline} ${SILHOUETTE}` : `M249 48 ${SILHOUETTE_POINTS} L165 48`;
}
