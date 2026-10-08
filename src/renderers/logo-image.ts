import sharp from "sharp";

export interface PixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// RGBA bruto, já no tamanho final.
export interface FittedImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface LogoLayer {
  input: Buffer;
  left: number;
  top: number;
}

export interface LogoOutline {
  color: string;
  width: number;
}

interface AlphaMask {
  data: Uint8Array;
  width: number;
  height: number;
}

// Com SVG, o Sharp rasteriza direto no tamanho do resize, sem ampliar bitmap pequeno (teste em logo-image.test.ts).
export async function fitImage(input: Buffer, width: number, height: number): Promise<FittedImage> {
  const { data, info } = await sharp(input).ensureAlpha().resize({ width, height, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function alphaMask(image: FittedImage): AlphaMask {
  const data = new Uint8Array(image.width * image.height);
  for (let index = 0; index < data.length; index++) data[index] = image.data[index * 4 + 3]!;
  return { data, width: image.width, height: image.height };
}

// Dilatação por disco; a máscara cresce `radius` px de cada lado para o contorno não ser cortado.
function dilate(mask: AlphaMask, radius: number): AlphaMask {
  const width = mask.width + 2 * radius;
  const height = mask.height + 2 * radius;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const [sourceX, sourceY] = [x - radius + dx, y - radius + dy];
          if (dx * dx + dy * dy > radius * radius || sourceX < 0 || sourceY < 0 || sourceX >= mask.width || sourceY >= mask.height) continue;
          max = Math.max(max, mask.data[sourceY * mask.width + sourceX]!);
        }
      }
      data[y * width + x] = max;
    }
  }
  return { data, width, height };
}

async function tint(mask: AlphaMask, hex: string): Promise<Buffer> {
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const data = Buffer.alloc(mask.width * mask.height * 4);
  for (let index = 0; index < mask.width * mask.height; index++) data.set([...rgb, mask.data[index]!], index * 4);
  return sharp(data, { raw: { width: mask.width, height: mask.height, channels: 4 } })
    .png()
    .toBuffer();
}

function centered(box: PixelBox, width: number, height: number): { left: number; top: number } {
  return { left: box.left + Math.floor((box.width - width) / 2), top: box.top + Math.floor((box.height - height) / 2) };
}

async function outlineLayer(mask: AlphaMask, outline: LogoOutline, position: { left: number; top: number }): Promise<LogoLayer> {
  return { input: await tint(dilate(mask, outline.width), outline.color), left: position.left - outline.width, top: position.top - outline.width };
}

// Patrocinador e fabricante viram silhueta: só o alfa do arquivo importa, a cor vem do kit.
export async function brandLogoLayers(input: Buffer, box: PixelBox, color: string, outline?: LogoOutline): Promise<LogoLayer[]> {
  const image = await fitImage(input, box.width, box.height);
  const mask = alphaMask(image);
  const position = centered(box, image.width, image.height);
  const fill = { input: await tint(mask, color), ...position };
  if (!outline) return [fill];
  return [await outlineLayer(mask, outline, position), fill];
}

export async function badgeLayers(input: Buffer, box: PixelBox, outline: LogoOutline): Promise<LogoLayer[]> {
  const image = await fitImage(input, box.width, box.height);
  const position = centered(box, image.width, image.height);
  const png = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
  return [await outlineLayer(alphaMask(image), outline, position), { input: png, ...position }];
}
