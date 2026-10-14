// Fração 0–1 da textura.
export interface UvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Fração 0–1 da textura, como UvRect.
export interface UvPoint {
  x: number;
  y: number;
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
  // Contorno da ilha quando ela não é o retângulo (manga curta, até a cava); rect continua sendo a base da vista.
  outline?: UvPoint[];
}

export interface UvCircle {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

export interface UvRaglan {
  // Ombros e faixa em volta da gola, na frente e nas costas: a manga raglan pinta aqui.
  yoke: UvPoint[];
  // Costuras entre a manga e o tronco, do lado do tronco.
  seams: UvPoint[][];
}

export interface Fm26KitLayout {
  textureSize: number;
  regions: UvRegion[];
  cuffs: UvRect[];
  collar: UvCircle;
  raglan: UvRaglan;
}

export const FM26_TEXTURE_SIZE = 1024;

// Medido em pixels da textura 1024×1024 (intervalo semiaberto) e guardado em fração.
export function rect(x0: number, y0: number, x1: number, y1: number): UvRect {
  return { x: x0 / FM26_TEXTURE_SIZE, y: y0 / FM26_TEXTURE_SIZE, width: (x1 - x0) / FM26_TEXTURE_SIZE, height: (y1 - y0) / FM26_TEXTURE_SIZE };
}

// Pares "x y" em pixels da textura, separados por vírgula, como na spec da 4c (seção 4.1): uma string só, para o Prettier não quebrar um número por linha.
export function points(pixels: string): UvPoint[] {
  return pixels.split(",").map((pair) => {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    return { x: x! / FM26_TEXTURE_SIZE, y: y! / FM26_TEXTURE_SIZE };
  });
}

// Espelho em x = 512: o centro das asas (242 + 782 = 1024) e da textura.
export function mirrorX(shape: readonly UvPoint[]): UvPoint[] {
  return shape.map(({ x, y }) => ({ x: 1 - x, y }));
}

export function outlineBounds(shape: readonly UvPoint[]): UvRect {
  const xs = shape.map(({ x }) => x);
  const ys = shape.map(({ y }) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

interface RegionOptions {
  side?: "left" | "right";
  rotation?: 0 | 180;
  mirrored?: boolean;
  hem?: UvRect;
  outline?: UvPoint[];
}

function region(part: UvPart, area: UvRect, { side, rotation = 0, mirrored = false, hem, outline }: RegionOptions = {}): UvRegion {
  return {
    part,
    ...(side === undefined ? {} : { side }),
    rect: area,
    rotation,
    mirrored,
    ...(hem === undefined ? {} : { hem }),
    ...(outline === undefined ? {} : { outline }),
  };
}

// Medidos no blank_26_3d.psd (spec da 4c, seção 4.1) do lado direito do jogador (esquerda da textura); o outro lado é o espelho.
// Manga curta: borda externa, topo e base do retângulo e a cava da camada "sleeves I I".
const RIGHT_SLEEVE_OUTLINE = points(
  "240 405, 380 405, 380 410.5, 395 426.5, 395 469.5, 393 486.5, 392 534.5, 390 560.5, 385 586.5, 386 677.5, 377 703.5, 369 714.5, 360 722.5, 360 725, 240 725",
);
// Costuras da raglan (camada "sleeves / \"), da cava ao centro: a de cima fica nas costas, a de baixo na frente. Param no eixo do espelho para o outro lado não sobrepor.
const RIGHT_RAGLAN_BACK_SEAM = points("380.5 410, 394.5 427, 396.5 485, 401.5 506, 407.5 520, 414.5 531, 429.5 545, 454.5 556, 469.5 559, 512 562");
const RIGHT_RAGLAN_FRONT_SEAM = points("380.5 700, 394.5 644, 404.5 625, 413.5 617, 428.5 610, 449.5 606, 512 604");

export const FM26_KIT_LAYOUT: Fm26KitLayout = {
  textureSize: FM26_TEXTURE_SIZE,
  // Confirmado no jogo em 2026-10-06 (roadmap, "Calibração da UV"): metade de baixo da coluna é a frente, o lado esquerdo da textura é o lado direito do jogador, asas são a manga curta e cantos a manga comprida.
  regions: [
    // As faixas finas nas pontas da coluna são as barras: continuam o desenho do tronco, como nas máscaras do FM.
    region("front", rect(357, 598, 668, 1004), { hem: rect(357, 1004, 668, 1018) }),
    // "BOLID 74" do template aparece legível nas costas no jogo: giradas 180°, não espelhadas.
    region("back", rect(357, 134, 668, 598), { rotation: 180, hem: rect(357, 118, 668, 134) }),
    // A vista da manga põe o ombro à direita; as do lado esquerdo do jogador espelham para o ombro ficar junto à coluna. Orientação em x e metades B/F ainda não vistas no jogo.
    // A ilha da manga curta entra na coluna até a cava (spec da 4c, seção 3): o contorno recorta, o retângulo continua sendo a base da vista.
    region("sleeve", rect(240, 405, 357, 725), { side: "right", outline: RIGHT_SLEEVE_OUTLINE }),
    region("sleeve", rect(668, 405, 785, 725), { side: "left", mirrored: true, outline: mirrorX(RIGHT_SLEEVE_OUTLINE) }),
    region("longSleeve", rect(0, 0, 357, 326), { side: "right" }),
    region("longSleeve", rect(668, 0, 1024, 326), { side: "left", mirrored: true }),
    region("sock", rect(3, 430, 237, 716), { side: "right" }),
    region("sock", rect(786, 430, 1020, 716), { side: "left" }),
    region("shorts", rect(4, 774, 351, 1018), { side: "right" }),
    region("shorts", rect(676, 774, 1024, 1018), { side: "left" }),
  ],
  // Punhos da manga curta e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento); os da manga comprida, da camada "sleeve end" do PSD, que a máscara não pinta.
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722), rect(1, 3, 26, 318), rect(998, 3, 1023, 318)],
  collar: { cx: 513 / FM26_TEXTURE_SIZE, cy: 597 / FM26_TEXTURE_SIZE, innerRadius: 29 / FM26_TEXTURE_SIZE, outerRadius: 43 / FM26_TEXTURE_SIZE },
  raglan: {
    // Um polígono: costura de trás de um lado ao outro, desce pela asa esquerda do jogador e volta pela costura da frente; os fechamentos caem dentro das mangas, pintadas por cima.
    yoke: [
      ...RIGHT_RAGLAN_BACK_SEAM,
      ...mirrorX(RIGHT_RAGLAN_BACK_SEAM).reverse(),
      ...mirrorX(RIGHT_RAGLAN_FRONT_SEAM),
      ...[...RIGHT_RAGLAN_FRONT_SEAM].reverse(),
    ],
    seams: [RIGHT_RAGLAN_BACK_SEAM, mirrorX(RIGHT_RAGLAN_BACK_SEAM), RIGHT_RAGLAN_FRONT_SEAM, mirrorX(RIGHT_RAGLAN_FRONT_SEAM)],
  },
};
