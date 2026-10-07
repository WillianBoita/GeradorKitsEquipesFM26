import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { KitDefinition } from "../../src/core/kit.js";
import type { KitLogoImages } from "../../src/renderers/kit-logos.js";
import { KIT_3D_SIZE, renderKit3dPng, renderKit3dSvg } from "../../src/renderers/renderer-3d.js";
import { frontLogoBox } from "../../src/renderers/uv-mapping.js";
import { LOGO_SVG, makeLogoPng } from "../fixtures/assets.js";
import { makeKit } from "../fixtures/kits.js";

interface Raster {
  data: Buffer;
  width: number;
  height: number;
}

async function raster(png: Buffer): Promise<Raster> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function pixel({ data, width }: Raster, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return [...data.subarray(index, index + 4)];
}

function channelDistance(a: number[], b: number[]): number {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));
}

function boxCenter(slot: "badge" | "sponsor" | "manufacturer", size = KIT_3D_SIZE): [number, number] {
  const box = frontLogoBox(slot);
  return [Math.floor((box.x + box.width / 2) * size), Math.floor((box.y + box.height / 2) * size)];
}

const PRIMARY = [0x12, 0x34, 0x56, 255];
const SECONDARY = [0xff, 0xff, 0xff, 255];
const ACCENT = [0xff, 0xd7, 0x00, 255];
const GREEN = [0, 0xff, 0, 255];

const patternKit = (id: string): KitDefinition => makeKit({ pattern: { id, base: "primary", overlay: "secondary", params: {} } });

describe("renderKit3dSvg", () => {
  it("produces valid SVG", () => {
    expect(XMLValidator.validate(renderKit3dSvg(patternKit("stripes")))).toBe(true);
  });

  it("is deterministic", () => {
    expect(renderKit3dSvg(patternKit("sash"))).toBe(renderKit3dSvg(patternKit("sash")));
  });

  it("ignores the collar style and the raglan cut, left to Phase 4", () => {
    const plain = renderKit3dSvg(makeKit());
    for (const style of ["v-neck", "polo", "polo-v"] as const) expect(renderKit3dSvg(makeKit({ collar: { style, color: "accent" } }))).toBe(plain);
    expect(renderKit3dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toBe(plain);
  });

  it("draws a kit with an empty layer list like a kit without layers", () => {
    expect(renderKit3dSvg(makeKit({ layers: [] }))).toBe(renderKit3dSvg(makeKit()));
  });

  it("fails on an unknown pattern", () => {
    expect(() => renderKit3dSvg(patternKit("zigzag"))).toThrow(/Unknown pattern "zigzag"/);
  });
});

describe("renderKit3dPng", () => {
  it("renders the 1024 texture by default and the size it is asked for", async () => {
    expect(await sharp(await renderKit3dPng(makeKit())).metadata()).toMatchObject({ format: "png", width: 1024, height: 1024 });
    expect(await sharp(await renderKit3dPng(makeKit(), { size: 512 })).metadata()).toMatchObject({ width: 512, height: 512 });
  });

  it("is opaque everywhere", async () => {
    const { channels } = await sharp(await renderKit3dPng(patternKit("checkers"))).stats();
    expect(channels).toHaveLength(4);
    expect(channels[3]!.min).toBe(255);
  });

  it("paints every part with its color", async () => {
    const kit = makeKit({
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "accent" },
      shorts: { color: "accent" },
      socks: { color: "secondary" },
    });
    const texture = await raster(await renderKit3dPng(kit));
    const expected: [string, number, number, number[]][] = [
      ["front", 512, 900, PRIMARY],
      ["back", 512, 300, PRIMARY],
      ["front hem", 512, 1011, PRIMARY],
      ["outside the islands", 512, 60, PRIMARY],
      ["right short sleeve", 310, 650, SECONDARY],
      ["left short sleeve", 730, 650, SECONDARY],
      ["right long sleeve", 178, 163, SECONDARY],
      ["left long sleeve", 846, 163, SECONDARY],
      ["right cuff", 257, 560, ACCENT],
      ["left cuff", 768, 560, ACCENT],
      ["collar", 549, 597, ACCENT],
      ["collar", 477, 597, ACCENT],
      ["right shorts", 177, 896, ACCENT],
      ["left shorts", 850, 896, ACCENT],
      ["right sock", 120, 573, SECONDARY],
      ["left sock", 903, 573, SECONDARY],
    ];
    for (const [part, x, y, color] of expected) expect(pixel(texture, x, y), part).toEqual(color);
  });

  it("continues the pattern into the front and back hems", async () => {
    const texture = await raster(await renderKit3dPng(patternKit("stripes")));
    const colors = new Set<string>();
    for (let x = 362; x < 664; x += 11) {
      expect(pixel(texture, x, 1011), `front ${x}`).toEqual(pixel(texture, x, 990));
      expect(pixel(texture, x, 126), `back ${x}`).toEqual(pixel(texture, x, 145));
      colors.add(pixel(texture, x, 1011).join());
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  // Linha r da frente reflete na linha 1137 − r das costas (reflexão em y = 569, centros de pixel em r + 0,5). A tolerância cobre o antialias das bordas.
  it.each(["halves", "sash"])("mirrors the front onto the back across y = 569 with %s", async (id) => {
    const texture = await raster(await renderKit3dPng(patternKit(id)));
    const colors = new Set<string>();
    // Começa abaixo do anel da gola (y ≤ 640), que só existe de um lado da reflexão.
    for (let y = 645; y < 1000; y += 13) {
      for (let x = 362; x < 664; x += 11) {
        const front = pixel(texture, x, y);
        colors.add(front.join());
        expect(channelDistance(front, pixel(texture, x, 1137 - y)), `${x},${y}`).toBeLessThanOrEqual(32);
      }
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it("runs match-body stripes from the shoulder to the cuff", async () => {
    const texture = await raster(await renderKit3dPng(patternKit("stripes")));
    const colors = new Set<string>();
    for (let y = 410; y < 720; y += 5) {
      const shoulder = pixel(texture, 350, y);
      expect(pixel(texture, 280, y), `y ${y}`).toEqual(shoulder);
      colors.add(shoulder.join());
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it("draws the detail layers on the front and the back but not on the sleeves", async () => {
    const kit = makeKit({
      layers: [{ id: "side-lines", color: "accent", params: {} }],
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
    });
    const texture = await raster(await renderKit3dPng(kit));
    for (const [x, y] of [
      [362, 800],
      [663, 800],
      [362, 300],
      [663, 300],
    ] as const) {
      expect(pixel(texture, x, y), `${x},${y}`).toEqual(ACCENT);
    }
    // Na manga, a mesma faixa do padrão (x 112–120 do 2D) cai em y 405–419 da asa: sem camadas ela fica na base.
    expect(pixel(texture, 300, 410)).toEqual(PRIMARY);
  });
});

describe("renderKit3dPng logos", () => {
  const brandedKit = makeKit({
    badge: true,
    sponsor: { id: "luna-air", color: "accent", outline: "secondary" },
    manufacturer: { id: "vertex", color: "#000000" },
  });
  const logos = async (): Promise<KitLogoImages> => ({
    badge: await makeLogoPng(40, 40, "#00ff00"),
    sponsor: Buffer.from(LOGO_SVG),
    manufacturer: await makeLogoPng(30, 30),
  });

  // badge, sponsor e manufacturer não entram no SVG: o makeKit() sem logos tem a mesma textura de fundo do brandedKit.
  it("changes only the pixels inside the logo boxes on the front", async () => {
    const plain = await raster(await renderKit3dPng(makeKit()));
    const branded = await raster(await renderKit3dPng(brandedKit, { logos: await logos() }));
    // O contorno passa da caixa em até 2 px.
    const margin = 3;
    const boxes = (["badge", "sponsor", "manufacturer"] as const).map((slot) => ({ slot, box: frontLogoBox(slot) }));
    const hits = new Map(boxes.map(({ slot }) => [slot, 0]));
    for (let y = 0; y < KIT_3D_SIZE; y++) {
      for (let x = 0; x < KIT_3D_SIZE; x++) {
        const index = (y * KIT_3D_SIZE + x) * 4;
        if (plain.data.readUInt32BE(index) === branded.data.readUInt32BE(index)) continue;
        const owner = boxes.find(({ box }) => {
          const [left, top] = [box.x * KIT_3D_SIZE - margin, box.y * KIT_3D_SIZE - margin];
          const [right, bottom] = [(box.x + box.width) * KIT_3D_SIZE + margin, (box.y + box.height) * KIT_3D_SIZE + margin];
          return x >= left && x < right && y >= top && y < bottom;
        });
        expect(owner, `${x},${y}`).toBeDefined();
        hits.set(owner!.slot, hits.get(owner!.slot)! + 1);
      }
    }
    for (const [slot, count] of hits) expect(count, slot).toBeGreaterThan(0);
  });

  it("keeps the badge colors and paints the brands with the kit colors", async () => {
    const texture = await raster(await renderKit3dPng(brandedKit, { logos: await logos() }));
    expect(pixel(texture, ...boxCenter("badge"))).toEqual(GREEN);
    expect(pixel(texture, ...boxCenter("manufacturer"))).toEqual([0, 0, 0, 255]);
  });

  it("scales the logos with the size", async () => {
    const texture = await raster(await renderKit3dPng(brandedKit, { size: 512, logos: await logos() }));
    expect(texture.width).toBe(512);
    expect(pixel(texture, ...boxCenter("badge", 512))).toEqual(GREEN);
  });

  it("fails when the kit declares a logo without its image", async () => {
    await expect(renderKit3dPng(makeKit({ badge: true }), { logos: {} })).rejects.toThrow("Kit declares a badge but no badge image was provided");
  });
});
