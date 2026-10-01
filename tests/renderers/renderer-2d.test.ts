import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { KIT_2D_SIZE, renderKit2dPng, renderKit2dSvg } from "../../src/renderers/renderer-2d.js";
import { makeKit } from "../fixtures/kits.js";

type Rgba = [number, number, number, number];

async function pixelAt(png: Buffer, x: number, y: number): Promise<Rgba> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!];
}

const PRIMARY: Rgba = [0x12, 0x34, 0x56, 255];
const SECONDARY: Rgba = [0xff, 0xff, 0xff, 255];
const ACCENT: Rgba = [0xff, 0xd7, 0x00, 255];

describe("renderKit2dSvg", () => {
  it("produces valid SVG", () => {
    expect(XMLValidator.validate(renderKit2dSvg(makeKit()))).toBe(true);
  });

  it("is deterministic", () => {
    expect(renderKit2dSvg(makeKit())).toBe(renderKit2dSvg(makeKit()));
  });

  it("uses the default 414 size", () => {
    expect(renderKit2dSvg(makeKit())).toContain('width="414" height="414"');
  });

  it.each(["round", "v-neck"] as const)("renders the %s collar", (style) => {
    expect(XMLValidator.validate(renderKit2dSvg(makeKit({ collar: { style, color: "accent" } })))).toBe(true);
  });

  it("throws for unknown patterns", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } });
    expect(() => renderKit2dSvg(kit)).toThrow(/Unknown pattern "zigzag"/);
  });

  it("clamps extreme pattern params", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 1e9, ratio: -5 } } });
    const svg = renderKit2dSvg(kit);
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe("renderKit2dPng", () => {
  it("produces a 414x414 PNG with alpha", async () => {
    const meta = await sharp(await renderKit2dPng(makeKit())).metadata();
    expect(meta).toMatchObject({ format: "png", width: KIT_2D_SIZE, height: KIT_2D_SIZE, hasAlpha: true });
  });

  it("supports a custom size", async () => {
    const meta = await sharp(await renderKit2dPng(makeKit(), { size: 828 })).metadata();
    expect(meta).toMatchObject({ width: 828, height: 828 });
  });

  it("keeps the background transparent", async () => {
    const png = await renderKit2dPng(makeKit());
    expect((await pixelAt(png, 2, 2))[3]).toBe(0);
    expect((await pixelAt(png, 411, 411))[3]).toBe(0);
  });

  it("paints the body with the base color", async () => {
    expect(await pixelAt(await renderKit2dPng(makeKit()), 207, 250)).toEqual(PRIMARY);
  });

  it("paints solid sleeves with the sleeve color", async () => {
    const kit = makeKit({ sleeves: { style: "solid", color: "accent", cuffColor: "secondary" } });
    expect(await pixelAt(await renderKit2dPng(kit), 332, 132)).toEqual(ACCENT);
  });

  it("paints the sash only along the diagonal", async () => {
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 80, direction: 0 } } });
    const png = await renderKit2dPng(kit);
    expect(await pixelAt(png, 207, 207)).toEqual(SECONDARY);
    expect(await pixelAt(png, 260, 150)).toEqual(PRIMARY);
  });

  it("paints match-body sleeves with the body fabric instead of the sleeve color", async () => {
    const kit = makeKit({ sleeves: { style: "match-body", color: "accent", cuffColor: "secondary" } });
    expect(await pixelAt(await renderKit2dPng(kit), 332, 132)).toEqual(PRIMARY);
  });

  it("paints the cuffs with the cuff color", async () => {
    const kit = makeKit({ sleeves: { style: "solid", color: "secondary", cuffColor: "accent" } });
    const png = await renderKit2dPng(kit);
    expect(await pixelAt(png, 358, 156)).toEqual(ACCENT);
    expect(await pixelAt(png, 56, 156)).toEqual(ACCENT);
  });

  // Amostra 3px abaixo do centro do traço da gola: o contorno escuro da silhueta passa exatamente sobre o centro.
  it("paints the collar with the collar color", async () => {
    const kit = makeKit({ collar: { style: "round", color: "accent" } });
    expect(await pixelAt(await renderKit2dPng(kit), 207, 73)).toEqual(ACCENT);
  });

  it("cuts the v-neck deeper than the round collar", async () => {
    const round = await renderKit2dPng(makeKit({ collar: { style: "round", color: "accent" } }));
    const vNeck = await renderKit2dPng(makeKit({ collar: { style: "v-neck", color: "accent" } }));
    expect(await pixelAt(round, 207, 88)).toEqual(PRIMARY);
    expect((await pixelAt(vNeck, 207, 88))[3]).toBe(0);
    expect(await pixelAt(vNeck, 207, 103)).toEqual(ACCENT);
  });
});
