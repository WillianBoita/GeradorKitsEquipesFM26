import sharp from "sharp";
import { sleeveCut, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvPoint, type UvRect, type UvRegion } from "../fm26/layout.js";
import { fillSvg, kitDesign, type KitDesign, type KitFill } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import { SHIRT_2D_VIEWBOX } from "./shirt-2d-shape.js";
import { affineSvg, frontLogoBox, regionViews, torsoScale } from "./uv-mapping.js";

export const KIT_3D_SIZE = FM26_TEXTURE_SIZE;
// Traço do contorno dos logos no viewBox 414 do 2D; no 3D acompanha a escala vertical da frente.
const OUTLINE_WIDTH = 2;
// Costura da raglan como a camada "lines" do PSD: preto com opacidade 51/255.
const SEAM_STROKE = 'fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="2"';

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

function shapePath(shape: readonly UvPoint[], closed: boolean): string {
  const size = FM26_TEXTURE_SIZE;
  return `M${shape.map(({ x, y }) => `${x * size} ${y * size}`).join(" L")}${closed ? " Z" : ""}`;
}

function baseColor(fill: KitFill): string {
  return fill.kind === "solid" ? fill.color : fill.base;
}

function isTorso(region: UvRegion): boolean {
  return region.part === "front" || region.part === "back";
}

// A manga curta é o contorno até a cava; as outras regiões, o retângulo.
function solidRegion(region: UvRegion, color: string): RegionSvg {
  return { body: region.outline ? `<path d="${shapePath(region.outline, true)}" fill="${color}"/>` : `<rect ${rectAttributes(region.rect)} fill="${color}"/>` };
}

// O padrão é desenhado no espaço 414 do 2D e levado a cada pedaço da ilha pela transformação da vista; o recorte do tronco inclui a barra, e o da manga curta passa pelo contorno da cava.
function patternRegion(region: UvRegion, id: string, fill: KitFill, layers: KitDesign["bodyLayers"]): RegionSvg {
  const pattern = fillSvg(fill, SHIRT_2D_VIEWBOX, SHIRT_2D_VIEWBOX, layers);
  const views = regionViews(region).map((view, index) => ({ ...view, id: `${id}-${index}` }));
  const clip = views.map((view) => `<clipPath id="${view.id}">${view.rects.map((rect) => `<rect ${rectAttributes(rect)}/>`).join("")}</clipPath>`).join("");
  const body = views.map((view) => `<g clip-path="url(#${view.id})"><g transform="${affineSvg(view.transform)}">${pattern}</g></g>`).join("");
  if (!region.outline) return { clip, body };

  return {
    clip: `${clip}<clipPath id="${id}-outline"><path d="${shapePath(region.outline, true)}"/></clipPath>`,
    body: `<g clip-path="url(#${id}-outline)">${body}</g>`,
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
      return design.sleeves.kind === "solid" ? solidRegion(region, design.sleeves.color) : patternRegion(region, id, design.sleeves, []);
    case "shorts":
      return solidRegion(region, design.shorts);
    case "sock":
      return solidRegion(region, design.socks);
  }
}

// A manga raglan avança sobre os ombros; na match-body o padrão vem das vistas do tronco, sem camadas, como os triângulos da raglan no 2D.
function raglanSvg(design: KitDesign): RegionSvg {
  const yoke = shapePath(FM26_KIT_LAYOUT.raglan.yoke, true);
  if (design.sleeves.kind === "solid") return { body: `<path d="${yoke}" fill="${design.sleeves.color}"/>` };

  const torso = FM26_KIT_LAYOUT.regions.filter(isTorso).map((region, index) => patternRegion(region, `raglan-${index}`, design.sleeves, []));

  return {
    clip: `<clipPath id="raglan"><path d="${yoke}"/></clipPath>${torso.map((part) => part.clip ?? "").join("")}`,
    body: `<g clip-path="url(#raglan)">${torso.map((part) => part.body).join("")}</g>`,
  };
}

// Traço na linha central do lado comprido, pontas butt: cobre o mesmo retângulo, e as listras viram traços concêntricos.
function cuffLine(cuff: UvRect): { d: string; width: number } {
  const size = FM26_TEXTURE_SIZE;
  const [x, y, width, height] = [cuff.x * size, cuff.y * size, cuff.width * size, cuff.height * size];
  if (height >= width) return { d: `M${x + width / 2} ${y} L${x + width / 2} ${y + height}`, width };

  return { d: `M${x} ${y + height / 2} L${x + width} ${y + height / 2}`, width: height };
}

function cuffSvg(cuff: UvRect, design: KitDesign): string {
  const { d, width } = cuffLine(cuff);
  return `<path d="${d}" fill="none" stroke="${design.cuffs}" stroke-width="${width}"/>`;
}

export function renderKit3dSvg(kit: KitDefinition, options: Render3dOptions = {}): string {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = FM26_TEXTURE_SIZE;
  const design = kitDesign(kit);
  const { regions, cuffs, collar, raglan } = FM26_KIT_LAYOUT;
  const raglanCut = sleeveCut(kit) === "raglan";
  const drawn = regions.map((region, index) => ({ region, svg: regionSvg(region, `region-${index}`, design) }));
  // A raglan fica entre o tronco e as mangas: a manga curta, recortada pela cava, cobre a sobreposição.
  const parts = [
    ...drawn.filter(({ region }) => isTorso(region)).map(({ svg }) => svg),
    ...(raglanCut ? [raglanSvg(design)] : []),
    ...drawn.filter(({ region }) => !isTorso(region)).map(({ svg }) => svg),
  ];
  const ring = { cx: collar.cx * texture, cy: collar.cy * texture, r: ((collar.innerRadius + collar.outerRadius) / 2) * texture };
  const ringWidth = (collar.outerRadius - collar.innerRadius) * texture;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${parts.map((part) => part.clip ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...(raglanCut ? raglan.seams.map((seam) => `<path d="${shapePath(seam, false)}" ${SEAM_STROKE}/>`) : []),
    ...cuffs.map((cuff) => cuffSvg(cuff, design)),
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
