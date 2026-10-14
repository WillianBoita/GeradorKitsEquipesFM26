import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, mirrorX, outlineBounds, points, type UvRect } from "../../src/fm26/layout.js";
import { insidePolygon } from "../fixtures/geometry.js";

// Referências de engenharia: só os testes as leem, o runtime nunca.
const TEMPLATES_DIR = fileURLToPath(new URL("../../docs/fm_templates/", import.meta.url));

type Rgb = [number, number, number];

async function readPixels(file: string): Promise<(x: number, y: number) => Rgb> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => {
    const index = (y * info.width + x) * info.channels;
    return [data[index]!, data[index + 1]!, data[index + 2]!];
  };
}

function allRects(): UvRect[] {
  return [...FM26_KIT_LAYOUT.regions.flatMap((region) => [region.rect, ...(region.hem ? [region.hem] : [])]), ...FM26_KIT_LAYOUT.cuffs];
}

function centerPixel(rect: UvRect): [number, number] {
  return [Math.floor((rect.x + rect.width / 2) * FM26_TEXTURE_SIZE), Math.floor((rect.y + rect.height / 2) * FM26_TEXTURE_SIZE)];
}

function overlaps(a: UvRect, b: UvRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// Azul puro = cor 3 (acabamento) nas máscaras RGB do FM.
function isTrimBlue([red, green, blue]: Rgb): boolean {
  return blue > 200 && red < 60 && green < 60;
}

// Verde puro = cor 2 (padrão) nas máscaras RGB do FM.
function isPatternGreen([red, green, blue]: Rgb): boolean {
  return green > 200 && red < 60 && blue < 60;
}

function sleeveRegion(side: "left" | "right") {
  return FM26_KIT_LAYOUT.regions.find((region) => region.part === "sleeve" && region.side === side)!;
}

describe("FM26_KIT_LAYOUT", () => {
  it("describes the 1024 texture of the FM26 3D kits", () => {
    expect(FM26_TEXTURE_SIZE).toBe(1024);
    expect(FM26_KIT_LAYOUT.textureSize).toBe(1024);
  });

  it("keeps every rect inside the texture with a positive size", () => {
    for (const rect of allRects()) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the collar ring inside the texture", () => {
    const { cx, cy, innerRadius, outerRadius } = FM26_KIT_LAYOUT.collar;
    expect(innerRadius).toBeGreaterThan(0);
    expect(outerRadius).toBeGreaterThan(innerRadius);
    for (const value of [cx - outerRadius, cy - outerRadius]) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of [cx + outerRadius, cy + outerRadius]) expect(value).toBeLessThanOrEqual(1);
  });

  it("never overlaps two regions", () => {
    const { regions } = FM26_KIT_LAYOUT;
    for (const [index, region] of regions.entries()) {
      for (const other of regions.slice(index + 1))
        expect(overlaps(region.rect, other.rect), `${region.part} ${region.side} × ${other.part} ${other.side}`).toBe(false);
    }
  });

  it("names the player side of every paired part and of no other", () => {
    const sides = (part: string) =>
      FM26_KIT_LAYOUT.regions
        .filter((region) => region.part === part)
        .map((region) => region.side)
        .sort();
    for (const part of ["sleeve", "longSleeve", "sock", "shorts"]) expect(sides(part)).toEqual(["left", "right"]);
    for (const part of ["front", "back"]) expect(sides(part)).toEqual([undefined]);
  });

  it("records the back as turned 180 degrees and mirrors only the sleeves on the player's left", () => {
    for (const region of FM26_KIT_LAYOUT.regions) {
      const label = `${region.part} ${region.side}`;
      expect(region.rotation, label).toBe(region.part === "back" ? 180 : 0);
      expect(region.mirrored, label).toBe((region.part === "sleeve" || region.part === "longSleeve") && region.side === "left");
    }
  });

  it("puts the center of every region on an island of the labeled template", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "template.png"));
    for (const region of FM26_KIT_LAYOUT.regions) {
      const [red, green, blue] = pixel(...centerPixel(region.rect));
      expect(red + green + blue, `${region.part} ${region.side}`).toBeGreaterThan(40);
    }
  });

  it("puts the short-sleeve cuffs and the collar ring on the trim color of the FM mask 01-0", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "01-0.png"));
    const shortSleeveCuffs = FM26_KIT_LAYOUT.cuffs.filter((cuff) =>
      FM26_KIT_LAYOUT.regions.some((region) => region.part === "sleeve" && overlaps(cuff, region.rect)),
    );
    expect(shortSleeveCuffs).toHaveLength(2);
    for (const cuff of shortSleeveCuffs) expect(isTrimBlue(pixel(...centerPixel(cuff)))).toBe(true);
    const { cx, cy, innerRadius, outerRadius } = FM26_KIT_LAYOUT.collar;
    const radius = ((innerRadius + outerRadius) / 2) * FM26_TEXTURE_SIZE;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(isTrimBlue(pixel(Math.round(cx * FM26_TEXTURE_SIZE + dx * radius), Math.round(cy * FM26_TEXTURE_SIZE + dy * radius)))).toBe(true);
    }
  });

  // O PSD pinta punho na manga comprida; a máscara 01-0 do FM, não.
  it("puts a cuff on the outer edge of each long sleeve", () => {
    for (const sleeve of FM26_KIT_LAYOUT.regions.filter((region) => region.part === "longSleeve")) {
      const cuffs = FM26_KIT_LAYOUT.cuffs.filter((cuff) => overlaps(cuff, sleeve.rect));
      expect(cuffs, sleeve.side).toHaveLength(1);
      const [cuff, area] = [cuffs[0]!, sleeve.rect];
      const gap = sleeve.side === "right" ? cuff.x - area.x : area.x + area.width - (cuff.x + cuff.width);
      expect(gap * FM26_TEXTURE_SIZE, sleeve.side).toBeLessThanOrEqual(1);
    }
  });

  it("outlines only the short sleeves, from the outer edge to the armhole, the left one mirrored", () => {
    for (const region of FM26_KIT_LAYOUT.regions) expect(region.outline !== undefined, `${region.part} ${region.side}`).toBe(region.part === "sleeve");
    const bounds = outlineBounds(sleeveRegion("right").outline!);
    expect([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height].map((value) => value * FM26_TEXTURE_SIZE)).toEqual([240, 405, 395, 725]);
    expect(sleeveRegion("left").outline).toEqual(mirrorX(sleeveRegion("right").outline!));
  });

  // A máscara 02-0 do FM pinta a manga (cor 2) até a cava, por cima da coluna do tronco (spec da 4c, seção 3).
  it("puts the armhole strip inside the short sleeves, as the FM mask 02-0 paints it", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "02-0.png"));
    for (const [x, y] of [
      [375, 460],
      [374, 650],
      [648, 460],
      [650, 650],
    ] as const) {
      expect(isPatternGreen(pixel(x, y)), `mask ${x},${y}`).toBe(true);
      expect(
        FM26_KIT_LAYOUT.regions.some((region) => region.outline !== undefined && insidePolygon(region.outline, x, y)),
        `outline ${x},${y}`,
      ).toBe(true);
    }
    for (const [x, y] of [
      [400, 460],
      [624, 460],
    ] as const) {
      expect(FM26_KIT_LAYOUT.regions.some((region) => region.outline !== undefined && insidePolygon(region.outline, x, y))).toBe(false);
    }
  });

  it("keeps the raglan yoke on the shoulders and around the collar, symmetric", () => {
    const { yoke, seams } = FM26_KIT_LAYOUT.raglan;
    for (const [x, y] of [
      [420, 580],
      [603, 580],
      [512, 583],
      [390, 600],
    ] as const) {
      expect(insidePolygon(yoke, x, y), `${x},${y}`).toBe(true);
    }
    for (const [x, y] of [
      [420, 520],
      [512, 540],
      [512, 620],
      [450, 650],
    ] as const) {
      expect(insidePolygon(yoke, x, y), `${x},${y}`).toBe(false);
    }
    expect(seams).toHaveLength(4);
    expect(seams[1]).toEqual(mirrorX(seams[0]!));
    expect(seams[3]).toEqual(mirrorX(seams[2]!));
    for (const seam of seams) expect(seam.at(-1)!.x).toBe(0.5);
  });

  it("puts a hem right below the front and right above the back, and on no other region", () => {
    const torso = (part: string) => FM26_KIT_LAYOUT.regions.find((region) => region.part === part)!;
    const [front, back] = [torso("front"), torso("back")];
    expect(front.hem).toMatchObject({ x: front.rect.x, width: front.rect.width, y: front.rect.y + front.rect.height });
    expect(back.hem).toMatchObject({ x: back.rect.x, width: back.rect.width });
    expect(back.hem!.y + back.hem!.height).toBe(back.rect.y);
    for (const region of FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part !== "front" && candidate.part !== "back")) {
      expect(region.hem, `${region.part} ${region.side}`).toBeUndefined();
    }
  });

  it("never overlaps a hem with a region", () => {
    const hems = FM26_KIT_LAYOUT.regions.flatMap((region) => region.hem ?? []);
    for (const region of FM26_KIT_LAYOUT.regions) {
      for (const hem of hems) expect(overlaps(region.rect, hem), `${region.part} ${region.side}`).toBe(false);
    }
  });

  // As barras do template são faixas finas (y 126–133 e 1003–1013): o centro do retângulo com sobra cai nelas.
  it("puts the center of every hem on the thin strips of the labeled template", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "template.png"));
    for (const hem of FM26_KIT_LAYOUT.regions.flatMap((region) => region.hem ?? [])) {
      const [red, green, blue] = pixel(...centerPixel(hem));
      expect(red + green + blue).toBeGreaterThan(40);
    }
  });
});

describe("points", () => {
  it("reads x y pairs in texture pixels as fractions", () => {
    expect(points("512 256, 1024 0")).toEqual([
      { x: 0.5, y: 0.25 },
      { x: 1, y: 0 },
    ]);
  });
});

describe("mirrorX", () => {
  it("mirrors across the middle of the texture", () => {
    expect(mirrorX(points("380.5 410, 512 562"))).toEqual(points("643.5 410, 512 562"));
  });
});
