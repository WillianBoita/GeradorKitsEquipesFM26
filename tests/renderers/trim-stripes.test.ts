import { describe, expect, it } from "vitest";
import { TRIM_STRIPE_STYLES } from "../../src/core/kit.js";
import { centeredStripeStrokes, edgeStripeStrokes, stripeStrokesSvg, TRIM_STRIPE_BANDS, type TrimStroke } from "../../src/renderers/trim-stripes.js";

const widths = (strokes: TrimStroke[]) => strokes.map(({ width, paint }) => [Number(width.toFixed(6)), paint]);

describe("TRIM_STRIPE_BANDS", () => {
  // O modo centrado desenha as duas bordas com o mesmo traço: as faixas precisam ser simétricas.
  it.each(TRIM_STRIPE_STYLES)("keeps the %s bands inside the piece and symmetric", (style) => {
    const bands = TRIM_STRIPE_BANDS[style];
    for (const [from, to] of bands) {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(1);
      expect(to).toBeGreaterThan(from);
    }
    const mirrored = bands.map(([from, to]) => [Number((1 - to).toFixed(6)), Number((1 - from).toFixed(6))]).sort(([a], [b]) => a! - b!);
    expect(mirrored).toEqual(bands.map(([from, to]) => [from, to]));
  });
});

describe("centeredStripeStrokes", () => {
  it("draws a single stripe as one narrow stroke on the middle line", () => {
    expect(widths(centeredStripeStrokes(10, "single"))).toEqual([[2.5, "stripe"]]);
  });

  it("draws a double stripe as a wide stripe stroke with a trim stroke over its middle", () => {
    expect(widths(centeredStripeStrokes(10, "double"))).toEqual([
      [8, "stripe"],
      [4, "trim"],
    ]);
  });
});

describe("edgeStripeStrokes", () => {
  it("doubles the depth of each band, since the clip keeps only the inner half of the stroke", () => {
    expect(widths(edgeStripeStrokes(10, "single"))).toEqual([
      [12.5, "stripe"],
      [7.5, "trim"],
    ]);
    expect(widths(edgeStripeStrokes(10, "double"))).toEqual([
      [18, "stripe"],
      [14, "trim"],
      [6, "stripe"],
      [2, "trim"],
    ]);
  });
});

describe("stripeStrokesSvg", () => {
  it("draws every stroke on the same path, in order, with the extra attributes", () => {
    const strokes: TrimStroke[] = [
      { width: 8, paint: "stripe" },
      { width: 4, paint: "trim" },
    ];
    expect(stripeStrokesSvg("M0 0 L10 0", strokes, { stripe: "#ffffff", trim: "#000000" }, ' stroke-linecap="round"')).toBe(
      '<path d="M0 0 L10 0" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/><path d="M0 0 L10 0" fill="none" stroke="#000000" stroke-width="4" stroke-linecap="round"/>',
    );
  });
});
