import type { LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, type UvRect, type UvRegion } from "../fm26/layout.js";
import { LOGO_BOXES, TORSO_WINDOW } from "./shirt-2d-shape.js";

// Matriz do SVG matrix(a b c d e f): (x, y) vira (a·x + c·y + e, b·x + d·y + f).
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

// Pedaço de uma região: o desenho do padrão vai para os rects pela transformação.
export interface RegionView {
  rects: UvRect[];
  transform: Affine;
}

interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SIZE = FM26_KIT_LAYOUT.textureSize;
const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const WINDOW_RIGHT = TORSO_WINDOW.x + TORSO_WINDOW.width;
const WINDOW_HEM = TORSO_WINDOW.y + TORSO_WINDOW.height;

export function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function affineSvg(m: Affine): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

// Aplica first e depois second.
function compose(second: Affine, first: Affine): Affine {
  return {
    a: second.a * first.a + second.c * first.b,
    b: second.b * first.a + second.d * first.b,
    c: second.a * first.c + second.c * first.d,
    d: second.b * first.c + second.d * first.d,
    e: second.a * first.e + second.c * first.f + second.e,
    f: second.b * first.e + second.d * first.f + second.f,
  };
}

function pixelRect(rect: UvRect): PixelRect {
  return { left: rect.x * SIZE, top: rect.y * SIZE, width: rect.width * SIZE, height: rect.height * SIZE };
}

function frontRegion(): UvRegion {
  const front = FM26_KIT_LAYOUT.regions.find((region) => region.part === "front");
  if (!front) throw new Error("FM26 layout has no front region");

  return front;
}

// O tronco 2D ocupa a frente inteira: a borda dele cai na costura lateral, por isso kx > ky (tronco desenrolado).
export function torsoScale(): { kx: number; ky: number } {
  const front = pixelRect(frontRegion().rect);

  return { kx: front.width / TORSO_WINDOW.width, ky: front.height / TORSO_WINDOW.height };
}

// Vista do tronco em pé, vista de fora, no tamanho do rect em pixels.
function torsoView(part: "front" | "back", rect: PixelRect): Affine {
  const { kx, ky } = torsoScale();
  // Ancorada na barra com a mesma escala vertical, como nas máscaras do FM: as costas, mais altas, mostram mais do padrão acima do ombro.
  const top = WINDOW_HEM - rect.height / ky;
  if (part === "front") return { a: kx, b: 0, c: 0, d: ky, e: -TORSO_WINDOW.x * kx, f: -top * ky };

  // De trás, o lado direito do jogador fica à direita de quem olha.
  return { a: -kx, b: 0, c: 0, d: ky, e: WINDOW_RIGHT * kx, f: -top * ky };
}

// Vistas das metades de cima e de baixo da manga. Como no 2D e nas máscaras assimétricas do FM (26, 28, 43), a manga continua o seu lado do tronco:
// recebe a faixa do padrão logo fora da lateral, na escala do tronco, girada 90° (o vertical corre do ombro, na borda direita da vista, ao punho).
// O meio da ilha é o alto do braço e as bordas são a axila, que recebe a lateral do tronco; as metades se espelham no meio, como a frente e as costas do tronco.
function sleeveViews(side: UvRegion["side"], rect: PixelRect): [Affine, Affine] {
  const { kx, ky } = torsoScale();
  // A manga direita do jogador fica à esquerda do tronco 2D.
  const [edge, outward] = side === "left" ? [WINDOW_RIGHT, 1] : [TORSO_WINDOW.x, -1];
  const along = { a: 0, c: -ky, d: 0, e: rect.width + TORSO_WINDOW.y * ky };

  return [
    { ...along, b: outward * kx, f: -outward * kx * edge },
    { ...along, b: -outward * kx, f: rect.height + outward * kx * edge },
  ];
}

// Primeiro espelha, depois gira, como descreve UvRegion; por fim leva ao rect.
function placement(region: UvRegion, rect: PixelRect): Affine {
  const mirror: Affine = region.mirrored ? { a: -1, b: 0, c: 0, d: 1, e: rect.width, f: 0 } : IDENTITY;
  const rotate: Affine = region.rotation === 180 ? { a: -1, b: 0, c: 0, d: -1, e: rect.width, f: rect.height } : IDENTITY;

  return compose({ ...IDENTITY, e: rect.left, f: rect.top }, compose(rotate, mirror));
}

function torsoTransform(region: UvRegion, part: "front" | "back"): Affine {
  const rect = pixelRect(region.rect);

  return compose(placement(region, rect), torsoView(part, rect));
}

export function regionViews(region: UvRegion): RegionView[] {
  switch (region.part) {
    case "front":
    case "back":
      return [{ rects: region.hem === undefined ? [region.rect] : [region.rect, region.hem], transform: torsoTransform(region, region.part) }];
    case "sleeve":
    case "longSleeve": {
      const rect = pixelRect(region.rect);
      const half = region.rect.height / 2;
      const place = placement(region, rect);
      const [upper, lower] = sleeveViews(region.side, rect);

      return [
        { rects: [{ ...region.rect, height: half }], transform: compose(place, upper) },
        { rects: [{ ...region.rect, y: region.rect.y + half, height: half }], transform: compose(place, lower) },
      ];
    }
    default:
      throw new Error(`Region "${region.part}" has no pattern view`);
  }
}

// A caixa 3D é a imagem da caixa 2D: o fundo atrás do logo é o que backgroundRoles mediu no 2D, e a cor do logo no kit.json continua valendo.
export function frontLogoBox(slot: LogoSlot): UvRect {
  const box = LOGO_BOXES[slot];
  const transform = torsoTransform(frontRegion(), "front");
  const [left, top] = applyAffine(transform, box.x, box.y);
  const [right, bottom] = applyAffine(transform, box.x + box.width, box.y + box.height);

  return { x: left / SIZE, y: top / SIZE, width: (right - left) / SIZE, height: (bottom - top) / SIZE };
}
