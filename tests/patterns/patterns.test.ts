import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { resolveParams } from "../../src/patterns/params.js";
import { getPatternTemplate, listPatternTemplates } from "../../src/patterns/registry.js";
import type { PatternTemplate } from "../../src/patterns/types.js";

const SIZE = 414;
const EXTREMES = [Number.NEGATIVE_INFINITY, -1e9, -1, 0, 0.5, 1e9, Number.POSITIVE_INFINITY, Number.NaN];

function renderWith(template: PatternTemplate, raw: Record<string, number>): string {
  return template.render({ width: SIZE, height: SIZE, base: "#123456", overlay: "#ffffff", params: resolveParams(template, raw) });
}

function wrap(fragment: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${fragment}</svg>`;
}

describe.each(listPatternTemplates().map((template) => [template.id, template] as const))("pattern %s", (_id, template) => {
  it("renders valid SVG with default params", () => {
    expect(XMLValidator.validate(wrap(renderWith(template, {})))).toBe(true);
  });

  it("renders valid SVG with extreme params", () => {
    for (const key of Object.keys(template.parameters)) {
      for (const value of EXTREMES) {
        const svg = wrap(renderWith(template, { [key]: value }));
        expect(XMLValidator.validate(svg)).toBe(true);
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it("is deterministic", () => {
    expect(renderWith(template, {})).toBe(renderWith(template, {}));
  });

  it("declares params with min <= default <= max", () => {
    for (const spec of Object.values(template.parameters)) {
      expect(spec.min).toBeLessThanOrEqual(spec.default);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
    }
  });
});

describe("registry", () => {
  it("lists the MVP patterns", () => {
    expect(listPatternTemplates().map((template) => template.id)).toEqual(["solid", "stripes", "sash"]);
  });

  it("throws a helpful error for unknown ids", () => {
    expect(() => getPatternTemplate("zigzag")).toThrow('Unknown pattern "zigzag". Known patterns: solid, stripes, sash');
  });
});

describe("solid", () => {
  it("draws nothing over the base", () => {
    expect(renderWith(getPatternTemplate("solid"), {})).toBe("");
  });
});

describe("stripes", () => {
  it("draws one rect per stripe in the overlay color", () => {
    const svg = renderWith(getPatternTemplate("stripes"), { count: 5 });
    expect(svg.match(/<rect /g)).toHaveLength(5);
    expect(svg).toContain('fill="#ffffff"');
  });
});

describe("sash", () => {
  it("rotates according to direction", () => {
    expect(renderWith(getPatternTemplate("sash"), { direction: 0 })).toContain("rotate(45)");
    expect(renderWith(getPatternTemplate("sash"), { direction: 1 })).toContain("rotate(-45)");
  });
});
