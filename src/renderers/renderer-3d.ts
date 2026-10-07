import sharp from "sharp";
import type { KitDefinition, LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect, type UvRegion } from "../fm26/layout.js";
import { fillSvg, kitDesign, type KitDesign, type KitFill } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import { SHIRT_2D_VIEWBOX } from "./shirt-2d-shape.js";
import { affineSvg, frontLogoBox, regionTransform, torsoScale } from "./uv-mapping.js";

export const KIT_3D_SIZE = FM26_TEXTURE_SIZE;
// Traço do contorno dos logos no viewBox 414 do 2D; no 3D acompanha a escala vertical da frente.
const OUTLINE_WIDTH = 2;

export interface Render3dOptions {
  size?: number;
  logos?: KitLogoImages;
}

interface RegionSvg {
  clip?: string;
  body: string;
}

function rectAttributes(rect: UvRect): string {
  const size = FM26_TEXTURE_SIZE;
  return `x="${rect.x * size}" y="${rect.y * size}" width="${rect.width * size}" height="${rect.height * size}"`;
}

function baseColor(fill: KitFill): string {
  return fill.kind === "solid" ? fill.color : fill.base;
}

function solidRegion(rect: UvRect, color: string): RegionSvg {
  return { body: `<rect ${rectAttributes(rect)} fill="${color}"/>` };
}

// O padrão é desenhado no espaço 414 do 2D e levado à ilha pela transformação da vista; o recorte inclui a barra.
function patternRegion(region: UvRegion, id: string, fill: KitFill, layers: KitDesign["bodyLayers"]): RegionSvg {
  const rects = [region.rect, ...(region.hem === undefined ? [] : [region.hem])].map((rect) => `<rect ${rectAttributes(rect)}/>`);
  const pattern = fillSvg(fill, SHIRT_2D_VIEWBOX, SHIRT_2D_VIEWBOX, layers);

  return {
    clip: `<clipPath id="${id}">${rects.join("")}</clipPath>`,
    body: `<g clip-path="url(#${id})"><g transform="${affineSvg(regionTransform(region))}">${pattern}</g></g>`,
  };
}

function regionSvg(region: UvRegion, id: string, design: KitDesign): RegionSvg {
  switch (region.part) {
    case "front":
    case "back":
      return patternRegion(region, id, design.body, design.bodyLayers);
    case "sleeve":
    case "longSleeve":
      // Como no 2D, a manga match-body recebe só o padrão principal.
      return design.sleeves.kind === "solid" ? solidRegion(region.rect, design.sleeves.color) : patternRegion(region, id, design.sleeves, []);
    case "shorts":
      return solidRegion(region.rect, design.shorts);
    case "sock":
      return solidRegion(region.rect, design.socks);
  }
}

export function renderKit3dSvg(kit: KitDefinition, options: Render3dOptions = {}): string {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = FM26_TEXTURE_SIZE;
  const design = kitDesign(kit);
  const { regions, cuffs, collar } = FM26_KIT_LAYOUT;
  const parts = regions.map((region, index) => regionSvg(region, `region-${index}`, design));
  const ring = { cx: collar.cx * texture, cy: collar.cy * texture, r: ((collar.innerRadius + collar.outerRadius) / 2) * texture };
  const ringWidth = (collar.outerRadius - collar.innerRadius) * texture;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${parts.map((part) => part.clip ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...cuffs.map((cuff) => solidRegion(cuff, design.cuffs).body),
    `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${design.collar}" stroke-width="${ringWidth}"/>`,
    "</svg>",
  ].join("");
}

function logoBoxes(size: number): Record<LogoSlot, PixelBox> {
  const box = (slot: LogoSlot): PixelBox => {
    const rect = frontLogoBox(slot);

    return { left: Math.round(rect.x * size), top: Math.round(rect.y * size), width: Math.round(rect.width * size), height: Math.round(rect.height * size) };
  };

  return { badge: box("badge"), sponsor: box("sponsor"), manufacturer: box("manufacturer") };
}

export async function renderKit3dPng(kit: KitDefinition, options: Render3dOptions = {}): Promise<Buffer> {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = sharp(Buffer.from(renderKit3dSvg(kit, options)));
  const outlineWidth = Math.max(1, Math.round((OUTLINE_WIDTH * torsoScale().ky * size) / FM26_TEXTURE_SIZE));
  const layers = await kitLogoLayers(kit, options.logos ?? {}, logoBoxes(size), outlineWidth);

  return (layers.length > 0 ? texture.composite(layers) : texture).png().toBuffer();
}
