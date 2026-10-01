import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { brandLogoLayers, fitImage } from "../../src/renderers/logo-image.js";
import { makeLogoPng } from "../fixtures/assets.js";

describe("fitImage", () => {
  it("fits inside the box without distortion", async () => {
    const image = await fitImage(await makeLogoPng(60, 20), 124, 48);
    expect([image.width, image.height]).toEqual([124, 41]);
    expect(image.data).toHaveLength(124 * 41 * 4);
  });

  it("rasterizes SVG at the box scale instead of enlarging a small bitmap", async () => {
    // Furo de 0,1 unidade num SVG de 6×2: só sobra transparente a 124 px se o SVG for rasterizado já nessa escala.
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 2"><path fill-rule="evenodd" d="M0 0H6V2H0Z M2.95 0.5H3.05V1.5H2.95Z"/></svg>`,
    );
    const image = await fitImage(svg, 124, 48);
    const row = Math.floor(image.height / 2);
    const alphas = Array.from({ length: 15 }, (_, offset) => image.data[(row * image.width + 55 + offset) * 4 + 3]!);
    expect(Math.min(...alphas)).toBe(0);
  });

  it("accepts SVGs much larger than the box", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000"><path d="M0 0H4000V4000H0Z"/></svg>`);
    const image = await fitImage(svg, 30, 30);
    expect([image.width, image.height]).toEqual([30, 30]);
  });
});

describe("brandLogoLayers", () => {
  const box = { left: 10, top: 20, width: 124, height: 48 };

  it("returns one centered silhouette in the logo color", async () => {
    const layers = await brandLogoLayers(await makeLogoPng(60, 20), box, "#ffd700");
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ left: 10, top: 23 });
    const { data, info } = await sharp(layers[0]!.input).raw().toBuffer({ resolveWithObject: true });
    const index = (20 * info.width + 62) * info.channels;
    expect([...data.subarray(index, index + 4)]).toEqual([0xff, 0xd7, 0x00, 255]);
  });

  it("puts the outline under the fill, grown by the outline width on every side", async () => {
    const layers = await brandLogoLayers(await makeLogoPng(60, 20), box, "#ffd700", { color: "#ffffff", width: 2 });
    expect(layers.map(({ left, top }) => [left, top])).toEqual([
      [8, 21],
      [10, 23],
    ]);
    const [outline, fill] = await Promise.all(layers.map((layer) => sharp(layer.input).metadata()));
    expect([outline!.width, outline!.height]).toEqual([fill!.width + 4, fill!.height + 4]);
  });
});
