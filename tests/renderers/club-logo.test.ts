import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderClubLogoPng } from "../../src/renderers/club-logo.js";
import { makeLogoPng, makeOpaquePng } from "../fixtures/assets.js";

type Rgba = [number, number, number, number];

async function pixelAt(png: Buffer, x: number, y: number): Promise<Rgba> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!];
}

const MAGENTA: Rgba = [0xff, 0, 0xff, 255];

describe("renderClubLogoPng", () => {
  it("writes a square PNG of the requested size", async () => {
    const png = await renderClubLogoPng(await makeLogoPng(60, 20), 400);
    expect(await sharp(png).metadata()).toMatchObject({ format: "png", width: 400, height: 400, hasAlpha: true });
  });

  // 60×20 vira 400×133 no meio do quadrado; 20×60, 133×400. Fora disso, só transparência.
  it.each([
    ["wide", 60, 20, [200, 40]],
    ["tall", 20, 60, [40, 200]],
  ] as const)("keeps the proportion of a %s logo and pads it with transparency", async (_label, width, height, [padX, padY]) => {
    const png = await renderClubLogoPng(await makeLogoPng(width, height), 400);
    expect(await pixelAt(png, 200, 200)).toEqual(MAGENTA);
    expect((await pixelAt(png, padX, padY))[3]).toBe(0);
  });

  it("pads an opaque logo with transparency instead of black", async () => {
    const png = await renderClubLogoPng(await makeOpaquePng(60, 20), 400);
    expect(await sharp(png).metadata()).toMatchObject({ hasAlpha: true });
    expect(await pixelAt(png, 200, 200)).toEqual(MAGENTA);
    expect((await pixelAt(png, 200, 40))[3]).toBe(0);
  });

  it("enlarges a small logo to fill the square", async () => {
    const png = await renderClubLogoPng(await makeLogoPng(40, 40), 400);
    expect(await pixelAt(png, 30, 200)).toEqual(MAGENTA);
  });
});
