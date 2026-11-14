import { describe, expect, it } from "vitest";
import { COLLAR_STYLES, type CollarStyle } from "../../src/core/kit.js";
import { FM26_COLLARS } from "../../src/fm26/collars.js";
import { FM26_TEXTURE_SIZE } from "../../src/fm26/layout.js";
import { insidePolygon } from "../fixtures/geometry.js";

function inBand(style: CollarStyle, x: number, y: number): boolean {
  return insidePolygon(FM26_COLLARS[style].outer, x, y) && !insidePolygon(FM26_COLLARS[style].inner, x, y);
}

describe("FM26_COLLARS", () => {
  it.each(COLLAR_STYLES)("keeps the %s collar inside the texture, around the neck at (514, 597)", (style) => {
    const { outer, inner } = FM26_COLLARS[style];
    expect(outer.length).toBeGreaterThanOrEqual(10);
    expect(inner.length).toBeGreaterThanOrEqual(10);
    for (const point of [...outer, ...inner]) {
      for (const value of [point.x, point.y]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(insidePolygon(inner, 514, 597)).toBe(true);
  });

  // Âncoras medidas no PSD (spec da 4c, seção 4.2).
  const ANCHORS: [CollarStyle, number, number][] = [
    ["round", 474, 597],
    ["round", 554, 597],
    ["round", 514, 557],
    ["round", 514, 635],
    ["v-neck", 474, 597],
    ["v-neck", 514, 645],
    ["polo", 514, 557],
    ["polo", 480, 634],
    ["polo-v", 475, 628],
    ["polo-v", 514, 648],
  ];

  it.each(ANCHORS)("puts the %s collar band on (%d, %d)", (style, x, y) => {
    expect(inBand(style, x, y)).toBe(true);
  });

  it("cuts the v-neck down to a point the round collar does not reach", () => {
    expect(inBand("round", 514, 648)).toBe(false);
    expect(inBand("v-neck", 514, 648)).toBe(true);
  });

  it("gives only the polo a placket, below the collar", () => {
    for (const style of COLLAR_STYLES) expect(FM26_COLLARS[style].placket !== undefined, style).toBe(style === "polo");
    const placket = FM26_COLLARS.polo.placket!;
    expect([placket.x, placket.y, placket.x + placket.width, placket.y + placket.height].map((value) => value * FM26_TEXTURE_SIZE)).toEqual([
      505, 630, 525, 676,
    ]);
  });
});
