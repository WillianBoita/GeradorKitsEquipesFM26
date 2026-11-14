import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { FM26_FABRIC } from "../../src/fm26/fabric.js";
import { MESH_TONE_COLORS, meshTone, tilePatternSvg } from "../../src/renderers/fabric-finish.js";

describe("tilePatternSvg", () => {
  it("merges neighbours with the same digit, skips 0 and sets fill-opacity only below f", () => {
    const tile = { width: 5, height: 2, rows: ["0ff09", "33000"] };
    expect(tilePatternSvg("p", tile, { x: 7, y: 433 }, "#ffffff")).toBe(
      '<pattern id="p" x="7" y="433" width="5" height="2" patternUnits="userSpaceOnUse"><g fill="#ffffff" shape-rendering="crispEdges">' +
        '<rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="1" height="1" fill-opacity="0.6"/><rect x="0" y="1" width="2" height="1" fill-opacity="0.2"/>' +
        "</g></pattern>",
    );
  });

  it("keeps neighbours with different digits apart", () => {
    const svg = tilePatternSvg("p", { width: 3, height: 1, rows: ["9f9"] }, { x: 0, y: 0 }, "#000000");
    expect(svg.match(/<rect /g)).toHaveLength(3);
  });

  it("draws an empty tile as an empty pattern", () => {
    expect(tilePatternSvg("p", { width: 2, height: 1, rows: ["00"] }, { x: 0, y: 0 }, "#000000")).toBe(
      '<pattern id="p" x="0" y="0" width="2" height="1" patternUnits="userSpaceOnUse"><g fill="#000000" shape-rendering="crispEdges"></g></pattern>',
    );
  });

  it("turns the fabric tile into valid SVG with one rect per run of the weave", () => {
    const svg = tilePatternSvg("fabric", FM26_FABRIC.tile, { x: 0, y: 0 }, "#000000");
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).not.toContain("fill-opacity");
    const widths = [...svg.matchAll(/<rect x="\d+" y="\d+" width="(\d+)" height="1"\/>/g)].map((match) => Number(match[1]));
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(108);
  });
});

describe("meshTone", () => {
  it("names the two colors of the PSD layers", () => {
    expect(MESH_TONE_COLORS).toEqual({ black: "#000000", white: "#ffffff" });
  });

  it.each([
    ["#ffffff", "black"],
    ["#ffd700", "black"],
    ["#808080", "black"],
    ["#fff", "black"],
    ["#000000", "white"],
    ["#123456", "white"],
    ["#595959", "white"],
  ] as const)("picks for %s the %s mesh", (color, tone) => {
    expect(meshTone(color)).toBe(tone);
  });
});
