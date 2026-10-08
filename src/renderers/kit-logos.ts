import { BRAND_KINDS, resolveLogoColor, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { badgeOutlineColor } from "../core/logo-colors.js";
import { badgeLayers, brandLogoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";

export interface KitLogoImages {
  badge?: Buffer;
  sponsor?: Buffer;
  manufacturer?: Buffer;
}

function requireImage(images: KitLogoImages, slot: LogoSlot): Buffer {
  const image = images[slot];
  if (!image) throw new Error(`Kit declares a ${slot} but no ${slot} image was provided`);
  return image;
}

// Caixas em pixels da imagem final: os renderers 2D e 3D só diferem em onde ficam os logos.
export async function kitLogoLayers(kit: KitDefinition, images: KitLogoImages, boxes: Record<LogoSlot, PixelBox>, outlineWidth: number): Promise<LogoLayer[]> {
  const layers: LogoLayer[] = [];
  if (kit.badge) layers.push(...(await badgeLayers(requireImage(images, "badge"), boxes.badge, { color: badgeOutlineColor(kit), width: outlineWidth })));
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (!logo) continue;
    const outline = logo.outline === undefined ? undefined : { color: resolveLogoColor(kit, logo.outline), width: outlineWidth };
    layers.push(...(await brandLogoLayers(requireImage(images, kind), boxes[kind], resolveLogoColor(kit, logo.color), outline)));
  }
  return layers;
}
