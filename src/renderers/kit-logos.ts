import { BRAND_KINDS, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { logoOutlineColor } from "../core/logo-colors.js";
import { logoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";

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
  const slots: LogoSlot[] = [...(kit.badge ? (["badge"] as const) : []), ...BRAND_KINDS.filter((kind) => kit[kind])];
  const layers: LogoLayer[] = [];
  for (const slot of slots) {
    layers.push(...(await logoLayers(requireImage(images, slot), boxes[slot], { color: logoOutlineColor(kit, slot), width: outlineWidth })));
  }
  return layers;
}
