import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SHORTS_TRIM_STYLES, SOCKS_TRIM_STYLES } from "../../src/core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvPart, type UvRect } from "../../src/fm26/layout.js";
import { FM26_SHORTS_TRIMS, FM26_SOCKS_TRIMS, TRIM_SIDES, type TrimRects } from "../../src/fm26/trims.js";

// Referências de engenharia: só os testes as leem, o runtime nunca.
const MASKS_DIR = fileURLToPath(new URL("../../docs/fm_templates/FM26 3D Assets/", import.meta.url));

// Máscara do FM de onde cada acabamento foi medido.
const SOURCES: { piece: UvPart; style: string; trim: TrimRects; mask: string }[] = [
  { piece: "shorts", style: "side-stripe", trim: FM26_SHORTS_TRIMS["side-stripe"], mask: "02-0" },
  { piece: "shorts", style: "side-piping", trim: FM26_SHORTS_TRIMS["side-piping"], mask: "03-0" },
  { piece: "shorts", style: "hem-band", trim: FM26_SHORTS_TRIMS["hem-band"], mask: "57-0" },
  { piece: "sock", style: "turnover", trim: FM26_SOCKS_TRIMS.turnover, mask: "07-0" },
  { piece: "sock", style: "top-hoops", trim: FM26_SOCKS_TRIMS["top-hoops"], mask: "08-0" },
  { piece: "sock", style: "hoops", trim: FM26_SOCKS_TRIMS.hoops, mask: "10-0" },
];

type Box = [number, number, number, number];

const pixels = (rect: UvRect): Box => {
  const [x0, y0, x1, y1] = [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].map((value) => Math.round(value * FM26_TEXTURE_SIZE));
  return [x0!, y0!, x1!, y1!];
};

function regionBox(piece: UvPart, side: "left" | "right"): Box {
  return pixels(FM26_KIT_LAYOUT.regions.find((region) => region.part === piece && region.side === side)!.rect);
}

// Verde puro = cor 2 (padrão) nas máscaras RGB do FM; vermelho puro = cor 1 (base).
async function readMask(name: string): Promise<(x: number, y: number) => "base" | "pattern" | "other"> {
  const { data, info } = await sharp(path.join(MASKS_DIR, `${name}.png`))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return (x, y) => {
    const offset = (y * info.width + x) * 3;
    const [red, green, blue] = [data[offset]!, data[offset + 1]!, data[offset + 2]!];
    if (green > 200 && red < 60 && blue < 60) return "pattern";
    return red > 200 && green < 60 && blue < 60 ? "base" : "other";
  };
}

describe("FM26 shorts and socks trims", () => {
  it("has one trim per style of each piece", () => {
    expect(Object.keys(FM26_SHORTS_TRIMS)).toEqual([...SHORTS_TRIM_STYLES]);
    expect(Object.keys(FM26_SOCKS_TRIMS)).toEqual([...SOCKS_TRIM_STYLES]);
  });

  // Medidos nas máscaras do FM (spec da 4e, seção 3); as faixas que vão de lado a lado usam a largura da região do layout, com a sobra.
  it("keeps the rectangles measured on the FM masks, on both sides", () => {
    const measured = (trim: TrimRects) => TRIM_SIDES.map((side) => trim[side].map(pixels));
    expect(measured(FM26_SHORTS_TRIMS["side-stripe"])).toEqual([[[156, 774, 182, 1018]], [[844, 774, 870, 1018]]]);
    expect(measured(FM26_SHORTS_TRIMS["side-piping"])).toEqual([[[165, 774, 175, 1018]], [[851, 774, 861, 1018]]]);
    expect(measured(FM26_SHORTS_TRIMS["hem-band"])).toEqual([[[4, 992, 351, 1018]], [[676, 992, 1024, 1018]]]);
    expect(measured(FM26_SOCKS_TRIMS.turnover)).toEqual([[[3, 430, 237, 486]], [[786, 430, 1020, 486]]]);
    expect(measured(FM26_SOCKS_TRIMS["top-hoops"])).toEqual([
      [
        [3, 464, 237, 476],
        [3, 490, 237, 503],
      ],
      [
        [786, 464, 1020, 476],
        [786, 490, 1020, 503],
      ],
    ]);
    expect(measured(FM26_SOCKS_TRIMS.hoops)).toEqual([
      [
        [3, 455, 237, 500],
        [3, 545, 237, 590],
        [3, 634, 237, 680],
      ],
      [
        [786, 455, 1020, 500],
        [786, 545, 1020, 590],
        [786, 634, 1020, 680],
      ],
    ]);
  });

  it.each(SOURCES)("keeps the $style rectangles inside the layout region of the piece", ({ piece, trim }) => {
    for (const side of TRIM_SIDES) {
      const [left, top, right, bottom] = regionBox(piece, side);
      expect(trim[side].length).toBeGreaterThan(0);
      for (const rect of trim[side]) {
        const [x0, y0, x1, y1] = pixels(rect);
        expect(x0 >= left && y0 >= top && x1 <= right && y1 <= bottom, `${side} ${[x0, y0, x1, y1].join(" ")}`).toBe(true);
        expect(x1 > x0 && y1 > y0).toBe(true);
      }
    }
  });

  // O centro de cada retângulo cai na cor 2 da máscara; em cada borda que não é a da região, um pixel para dentro ainda é cor 2 e dois para fora já é a base (o pixel da borda é antialias na máscara).
  it.each(SOURCES)("paints $style where the FM mask $mask paints it", async ({ piece, trim, mask }) => {
    const colorAt = await readMask(mask);
    for (const side of TRIM_SIDES) {
      const [left, top, right, bottom] = regionBox(piece, side);
      for (const rect of trim[side]) {
        const [x0, y0, x1, y1] = pixels(rect);
        const [cx, cy] = [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)];
        const label = `${side} ${[x0, y0, x1, y1].join(" ")}`;
        expect(colorAt(cx, cy), label).toBe("pattern");
        if (x0 !== left) expect([colorAt(x0 + 1, cy), colorAt(x0 - 2, cy)], `${label} left edge`).toEqual(["pattern", "base"]);
        if (x1 !== right) expect([colorAt(x1 - 2, cy), colorAt(x1 + 1, cy)], `${label} right edge`).toEqual(["pattern", "base"]);
        if (y0 !== top) expect([colorAt(cx, y0 + 1), colorAt(cx, y0 - 2)], `${label} top edge`).toEqual(["pattern", "base"]);
        if (y1 !== bottom) expect([colorAt(cx, y1 - 2), colorAt(cx, y1 + 1)], `${label} bottom edge`).toEqual(["pattern", "base"]);
      }
    }
  });
});
