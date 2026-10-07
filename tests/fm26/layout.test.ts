import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect } from "../../src/fm26/layout.js";

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

  it("puts the cuffs and the collar ring on the trim color of the FM mask 01-0", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "01-0.png"));
    for (const cuff of FM26_KIT_LAYOUT.cuffs) expect(isTrimBlue(pixel(...centerPixel(cuff)))).toBe(true);
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
