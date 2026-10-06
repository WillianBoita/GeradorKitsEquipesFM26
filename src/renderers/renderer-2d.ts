import sharp from "sharp";
import { BRAND_KINDS, resolveLogoColor, sleeveCut, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { fillSvg, kitDesign } from "./kit-design.js";
import { badgeLayer, brandLogoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";
import {
  bodyPath,
  collarPath,
  collarTrimPath,
  CUFFS_PATH,
  LOGO_BOXES,
  outlinePath,
  RAGLAN_SEAMS_PATH,
  SHIRT_2D_VIEWBOX,
  sleevesPath,
  type LogoBox,
} from "./shirt-2d-shape.js";

export const KIT_2D_SIZE = 414;
// Espessura do contorno dos logos no viewBox 414; escala com o tamanho do PNG.
const OUTLINE_WIDTH = 2;
// Traço escuro da silhueta, repetido nas peças da gola polo: o mesmo texto mantém o SVG das golas antigas igual.
const OUTLINE_STROKE = 'stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"';

export interface KitLogoImages {
  badge?: Buffer;
  sponsor?: Buffer;
  manufacturer?: Buffer;
}

export interface Render2dOptions {
  size?: number;
  logos?: KitLogoImages;
}

export function renderKit2dSvg(kit: KitDefinition, options: Render2dOptions = {}): string {
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const design = kitDesign(kit);
  const trim = collarTrimPath(kit.collar.style);
  const cut = sleeveCut(kit);
  const sleevesShape = sleevesPath(cut);
  // Manga lisa continua um <path> preenchido, como antes da camada: o SVG 2D não pode mudar (guarda da Fase 3b).
  const sleeves =
    design.sleeves.kind === "solid"
      ? `<path d="${sleevesShape}" fill="${design.sleeves.color}"/>`
      : `<g clip-path="url(#sleeves)">${fillSvg(design.sleeves, view, view)}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(kit.collar.style, cut)}"/></clipPath><clipPath id="sleeves"><path d="${sleevesShape}"/></clipPath></defs>`,
    `<g clip-path="url(#body)">${fillSvg(design.body, view, view, design.bodyLayers)}</g>`,
    sleeves,
    // Sem a costura, a raglan com manga match-body sairia igual à set-in.
    cut === "raglan" ? `<path d="${RAGLAN_SEAMS_PATH}" fill="none" ${OUTLINE_STROKE}/>` : "",
    `<path d="${CUFFS_PATH}" fill="none" stroke="${design.cuffs}" stroke-width="8"/>`,
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${design.collar}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    trim === undefined ? "" : `<path d="${trim}" fill="${design.collar}" ${OUTLINE_STROKE}/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" ${OUTLINE_STROKE}/>`,
    "</svg>",
  ].join("");
}

export async function renderKit2dPng(kit: KitDefinition, options: Render2dOptions = {}): Promise<Buffer> {
  const shirt = sharp(Buffer.from(renderKit2dSvg(kit, options)));
  const layers = await logoLayers(kit, options.size ?? KIT_2D_SIZE, options.logos ?? {});
  // Sem logos não há composite: o PNG fica byte a byte igual ao da Fase 2a.
  return (layers.length > 0 ? shirt.composite(layers) : shirt).png().toBuffer();
}

function requireImage(images: KitLogoImages, slot: LogoSlot): Buffer {
  const image = images[slot];
  if (!image) throw new Error(`Kit declares a ${slot} but no ${slot} image was provided`);
  return image;
}

function pixelBox(box: LogoBox, scale: number): PixelBox {
  return { left: Math.round(box.x * scale), top: Math.round(box.y * scale), width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
}

async function logoLayers(kit: KitDefinition, size: number, images: KitLogoImages): Promise<LogoLayer[]> {
  const scale = size / SHIRT_2D_VIEWBOX;
  const layers: LogoLayer[] = [];
  if (kit.badge) layers.push(await badgeLayer(requireImage(images, "badge"), pixelBox(LOGO_BOXES.badge, scale)));
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (!logo) continue;
    const outline =
      logo.outline === undefined ? undefined : { color: resolveLogoColor(kit, logo.outline), width: Math.max(1, Math.round(OUTLINE_WIDTH * scale)) };
    layers.push(...(await brandLogoLayers(requireImage(images, kind), pixelBox(LOGO_BOXES[kind], scale), resolveLogoColor(kit, logo.color), outline)));
  }
  return layers;
}
