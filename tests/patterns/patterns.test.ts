import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
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

// Padrão em branco sobre preto; compara colorAt com o pixel numa grade, pulando pontos a menos de 1,5 px de uma borda (antialias).
async function colorAtMismatches(template: PatternTemplate, raw: Record<string, number>): Promise<{ checked: number; mismatches: number }> {
  const geometry = { width: SIZE, height: SIZE, params: resolveParams(template, raw) };
  const svg = wrap(`<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>${template.render({ ...geometry, base: "#000000", overlay: "#ffffff" })}`);
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  let checked = 0;
  let mismatches = 0;
  for (let py = 2; py < SIZE; py += 7) {
    for (let px = 2; px < SIZE; px += 7) {
      const [x, y] = [px + 0.5, py + 0.5];
      const expected = template.colorAt(x, y, geometry);
      const stable = [-1.5, 1.5].every(
        (delta) => template.colorAt(x + delta, y, geometry) === expected && template.colorAt(x, y + delta, geometry) === expected,
      );
      if (!stable) continue;
      checked++;
      if ((data[(py * info.width + px) * info.channels]! > 128 ? "overlay" : "base") !== expected) mismatches++;
    }
  }
  return { checked, mismatches };
}

function paramSamples(template: PatternTemplate): Record<string, number>[] {
  return [{}, ...Object.entries(template.parameters).flatMap(([key, spec]) => [{ [key]: spec.min }, { [key]: spec.max }])];
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

  it("reports with colorAt the layer that render paints", async () => {
    for (const raw of paramSamples(template)) {
      const { checked, mismatches } = await colorAtMismatches(template, raw);
      expect(checked).toBeGreaterThan(1000);
      expect(mismatches).toBe(0);
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

describe("colorAt", () => {
  const geometry = (params: Record<string, number>) => ({ width: SIZE, height: SIZE, params });

  it("is base everywhere for solid", () => {
    expect(getPatternTemplate("solid").colorAt(207, 207, geometry({}))).toBe("base");
  });

  it("finds the stripes and the gaps between them", () => {
    // count 7, ratio 0.3: período 59,14; a primeira listra vai de 20,7 a 38,4.
    const stripes = getPatternTemplate("stripes");
    expect(stripes.colorAt(30, 100, geometry({ count: 7, ratio: 0.3 }))).toBe("overlay");
    expect(stripes.colorAt(5, 100, geometry({ count: 7, ratio: 0.3 }))).toBe("base");
  });

  it("follows the sash direction", () => {
    const sash = getPatternTemplate("sash");
    expect(sash.colorAt(300, 300, geometry({ width: 70, direction: 0 }))).toBe("overlay");
    expect(sash.colorAt(300, 114, geometry({ width: 70, direction: 0 }))).toBe("base");
    expect(sash.colorAt(300, 114, geometry({ width: 70, direction: 1 }))).toBe("overlay");
    expect(sash.colorAt(300, 300, geometry({ width: 70, direction: 1 }))).toBe("base");
  });
});
