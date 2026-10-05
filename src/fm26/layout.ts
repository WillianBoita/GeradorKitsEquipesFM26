import type { LogoSlot } from "../core/kit.js";

// Fração 0–1 da textura.
export interface UvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UvPart = "front" | "back" | "sleeve" | "longSleeve" | "sock" | "shorts";

// rotation e mirrored transformam o desenho da região: primeiro espelha na horizontal, depois gira. side é o lado do jogador.
export interface UvRegion {
  part: UvPart;
  side?: "left" | "right";
  rect: UvRect;
  rotation: 0 | 180;
  mirrored: boolean;
}

export interface UvCircle {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

export interface Fm26KitLayout {
  textureSize: number;
  regions: UvRegion[];
  cuffs: UvRect[];
  collar: UvCircle;
  logos: Record<LogoSlot, UvRect>;
}

export const FM26_TEXTURE_SIZE = 1024;

// Medido em pixels da textura 1024×1024 (intervalo semiaberto) e guardado em fração.
function rect(x0: number, y0: number, x1: number, y1: number): UvRect {
  return { x: x0 / FM26_TEXTURE_SIZE, y: y0 / FM26_TEXTURE_SIZE, width: (x1 - x0) / FM26_TEXTURE_SIZE, height: (y1 - y0) / FM26_TEXTURE_SIZE };
}

function region(part: UvPart, area: UvRect, side?: "left" | "right", rotation: 0 | 180 = 0): UvRegion {
  return side === undefined ? { part, rect: area, rotation, mirrored: false } : { part, side, rect: area, rotation, mirrored: false };
}

export const FM26_KIT_LAYOUT: Fm26KitLayout = {
  textureSize: FM26_TEXTURE_SIZE,
  // Hipóteses da leitura do template.png, a confirmar no jogo na 3c (roadmap, seção "Calibração da UV").
  // O lado esquerdo da textura é o lado direito do jogador, como os rótulos RIGHT do template.
  regions: [
    region("front", rect(357, 598, 668, 1004)),
    // "BOLID 74" aparece de cabeça para baixo e com a ordem invertida no template: costas giradas 180°.
    region("back", rect(357, 134, 668, 598), undefined, 180),
    region("sleeve", rect(240, 405, 357, 725), "right"),
    region("sleeve", rect(668, 405, 785, 725), "left"),
    region("longSleeve", rect(0, 0, 357, 326), "right"),
    region("longSleeve", rect(668, 0, 1024, 326), "left"),
    region("sock", rect(3, 430, 237, 716), "right"),
    region("sock", rect(786, 430, 1020, 716), "left"),
    region("shorts", rect(4, 774, 351, 1018), "right"),
    region("shorts", rect(676, 774, 1024, 1018), "left"),
  ],
  // Punhos e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento): evidência mais forte que as hipóteses das regiões.
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722)],
  collar: { cx: 513 / FM26_TEXTURE_SIZE, cy: 597 / FM26_TEXTURE_SIZE, innerRadius: 29 / FM26_TEXTURE_SIZE, outerRadius: 43 / FM26_TEXTURE_SIZE },
  logos: {
    // Quadrados brancos do peito no template: o da direita da textura é o peito esquerdo do jogador.
    badge: rect(553, 670, 595, 712),
    manufacturer: rect(435, 670, 477, 712),
    // O template não marca o patrocinador: centro do peito abaixo dos outros logos, com a proporção da caixa 2D.
    sponsor: rect(411, 721, 613, 799),
  },
};
