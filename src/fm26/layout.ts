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
  // Faixa da barra: recebe a continuação do desenho da região.
  hem?: UvRect;
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
}

export const FM26_TEXTURE_SIZE = 1024;

// Medido em pixels da textura 1024×1024 (intervalo semiaberto) e guardado em fração.
function rect(x0: number, y0: number, x1: number, y1: number): UvRect {
  return { x: x0 / FM26_TEXTURE_SIZE, y: y0 / FM26_TEXTURE_SIZE, width: (x1 - x0) / FM26_TEXTURE_SIZE, height: (y1 - y0) / FM26_TEXTURE_SIZE };
}

interface RegionOptions {
  side?: "left" | "right";
  rotation?: 0 | 180;
  mirrored?: boolean;
  hem?: UvRect;
}

function region(part: UvPart, area: UvRect, { side, rotation = 0, mirrored = false, hem }: RegionOptions = {}): UvRegion {
  return { part, ...(side === undefined ? {} : { side }), rect: area, rotation, mirrored, ...(hem === undefined ? {} : { hem }) };
}

export const FM26_KIT_LAYOUT: Fm26KitLayout = {
  textureSize: FM26_TEXTURE_SIZE,
  // Confirmado no jogo em 2026-10-06 (roadmap, "Calibração da UV"): metade de baixo da coluna é a frente, o lado esquerdo da textura é o lado direito do jogador, asas são a manga curta e cantos a manga comprida.
  regions: [
    // As faixas finas nas pontas da coluna são as barras: continuam o desenho do tronco, como nas máscaras do FM.
    region("front", rect(357, 598, 668, 1004), { hem: rect(357, 1004, 668, 1018) }),
    // "BOLID 74" do template aparece legível nas costas no jogo: giradas 180°, não espelhadas.
    region("back", rect(357, 134, 668, 598), { rotation: 180, hem: rect(357, 118, 668, 134) }),
    // A vista da manga põe o ombro à direita; as do lado esquerdo do jogador espelham para o ombro ficar junto à coluna. Orientação em x e metades B/F ainda não vistas no jogo.
    region("sleeve", rect(240, 405, 357, 725), { side: "right" }),
    region("sleeve", rect(668, 405, 785, 725), { side: "left", mirrored: true }),
    region("longSleeve", rect(0, 0, 357, 326), { side: "right" }),
    region("longSleeve", rect(668, 0, 1024, 326), { side: "left", mirrored: true }),
    region("sock", rect(3, 430, 237, 716), { side: "right" }),
    region("sock", rect(786, 430, 1020, 716), { side: "left" }),
    region("shorts", rect(4, 774, 351, 1018), { side: "right" }),
    region("shorts", rect(676, 774, 1024, 1018), { side: "left" }),
  ],
  // Punhos e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento).
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722)],
  collar: { cx: 513 / FM26_TEXTURE_SIZE, cy: 597 / FM26_TEXTURE_SIZE, innerRadius: 29 / FM26_TEXTURE_SIZE, outerRadius: 43 / FM26_TEXTURE_SIZE },
};
