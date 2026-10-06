import { createHash } from "node:crypto";
import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { resolveParams } from "../../src/patterns/params.js";
import { getPatternTemplate, listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";
import type { PatternTemplate } from "../../src/patterns/types.js";
import { LOGO_BOXES } from "../../src/renderers/shirt-2d-shape.js";

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

// O pior caso de uma camada combina extremos (ex.: inset, thickness e gap máximos), então entram também todos no mínimo e todos no máximo.
function extremeSamples(template: PatternTemplate): Record<string, number>[] {
  const entries = Object.entries(template.parameters);
  return [
    ...paramSamples(template),
    Object.fromEntries(entries.map(([key, spec]) => [key, spec.min])),
    Object.fromEntries(entries.map(([key, spec]) => [key, spec.max])),
  ];
}

// Camada sozinha, em branco sobre preto: pixels pintados dentro das caixas de logo e fração pintada do tronco (x 115–300, y 150–380).
async function layerFootprint(template: PatternTemplate, raw: Record<string, number>): Promise<{ logoPixels: number; torsoShare: number }> {
  const svg = wrap(`<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>${renderWith(template, raw)}`);
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  const red = (x: number, y: number): number => data[(y * info.width + x) * info.channels]!;
  let logoPixels = 0;
  for (const box of Object.values(LOGO_BOXES)) {
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) if (red(x, y) > 0) logoPixels++;
    }
  }
  let painted = 0;
  for (let y = 150; y < 380; y++) {
    for (let x = 115; x < 300; x++) if (red(x, y) > 0x88) painted++;
  }
  return { logoPixels, torsoShare: painted / (230 * 185) };
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

describe.each(listLayerTemplates().map((template) => [template.id, template] as const))("layer %s", (_id, template) => {
  // Como camada, o render recebe a cor da camada como overlay; a base do contexto nunca é pintada.
  it("draws only in the overlay color", () => {
    expect(renderWith(template, {})).not.toContain("#123456");
  });

  it("never paints a logo box and covers less than 15% of the torso", async () => {
    for (const raw of extremeSamples(template)) {
      const { logoPixels, torsoShare } = await layerFootprint(template, raw);
      expect(logoPixels).toBe(0);
      expect(torsoShare).toBeLessThan(0.15);
    }
  });
});

const ALL_PATTERN_IDS = [
  "solid",
  "stripes",
  "sash",
  "pinstripes",
  "hoops",
  "diagonal",
  "chevron",
  "chest-band",
  "center-band",
  "checkers",
  "halves",
  "gradient",
  "side-lines",
  "double-pinline",
  "shoulder-line",
  "hoop-line",
];

const LAYER_PATTERN_IDS = ["side-lines", "double-pinline", "shoulder-line", "hoop-line"];

describe("registry", () => {
  it("lists the layer patterns in registry order", () => {
    expect(listLayerTemplates().map((template) => template.id)).toEqual(LAYER_PATTERN_IDS);
  });

  it("lists the patterns in registry order", () => {
    expect(listPatternTemplates().map((template) => template.id)).toEqual(ALL_PATTERN_IDS);
  });

  it("throws a helpful error for unknown ids", () => {
    expect(() => getPatternTemplate("zigzag")).toThrow(`Unknown pattern "zigzag". Known patterns: ${ALL_PATTERN_IDS.join(", ")}`);
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

describe("new patterns colorAt", () => {
  const at = (id: string, params: Record<string, number>, x: number, y: number) => getPatternTemplate(id).colorAt(x, y, { width: SIZE, height: SIZE, params });

  it("draws pinstripes with the stripes geometry", () => {
    const params = { count: 20, ratio: 0.12 };
    for (let x = 0; x < SIZE; x += 3) expect(at("pinstripes", params, x, 100)).toBe(at("stripes", params, x, 100));
  });

  it("finds the hoops and the gaps between them", () => {
    expect(at("hoops", { count: 4, ratio: 0.3 }, 100, 50)).toBe("overlay");
    expect(at("hoops", { count: 4, ratio: 0.3 }, 100, 10)).toBe("base");
  });

  it("runs a diagonal stripe through the center and follows the direction", () => {
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 0 }, 207, 207)).toBe("overlay");
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 0 }, 177, 237)).toBe("base");
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 1 }, 177, 237)).toBe("overlay");
  });

  it("draws the chevron vertex at the depth and its arms at 45 degrees", () => {
    const params = { depth: 0.45, width: 0.1 };
    expect(at("chevron", params, 207, 186)).toBe("overlay");
    expect(at("chevron", params, 207, 250)).toBe("base");
    expect(at("chevron", params, 307, 86)).toBe("overlay");
    expect(at("chevron", params, 307, 186)).toBe("base");
  });

  it("places the chest band and the center band", () => {
    expect(at("chest-band", { position: 0.45, width: 0.15 }, 10, 186)).toBe("overlay");
    expect(at("chest-band", { position: 0.45, width: 0.15 }, 10, 240)).toBe("base");
    expect(at("center-band", { width: 0.14 }, 207, 10)).toBe("overlay");
    expect(at("center-band", { width: 0.14 }, 250, 10)).toBe("base");
  });

  it("alternates the checkers around a corner at the center", () => {
    expect(at("checkers", { size: 0.1 }, 208, 208)).toBe("base");
    expect(at("checkers", { size: 0.1 }, 250, 208)).toBe("overlay");
    expect(at("checkers", { size: 0.1 }, 206, 208)).toBe("overlay");
  });

  it("paints the halves on the chosen side", () => {
    expect(at("halves", { side: 0 }, 100, 207)).toBe("overlay");
    expect(at("halves", { side: 0 }, 300, 207)).toBe("base");
    expect(at("halves", { side: 1 }, 100, 207)).toBe("base");
    expect(at("halves", { side: 1 }, 300, 207)).toBe("overlay");
  });

  it("fades the gradient from the base to the overlay below the start", () => {
    const params = { start: 0.65 };
    expect(at("gradient", params, 207, 100)).toBe("base");
    expect(at("gradient", params, 207, 272)).toBe("base");
    expect(at("gradient", params, 207, 370)).toBe("overlay");
    expect(at("gradient", params, 207, 400)).toBe("overlay");
  });
});

describe("new patterns render", () => {
  it("draws one rect per hoop", () => {
    expect(renderWith(getPatternTemplate("hoops"), { count: 5 }).match(/<rect /g)).toHaveLength(5);
  });

  it("rotates the diagonal stripes according to direction", () => {
    expect(renderWith(getPatternTemplate("diagonal"), { direction: 0 })).toContain("rotate(45)");
    expect(renderWith(getPatternTemplate("diagonal"), { direction: 1 })).toContain("rotate(-45)");
  });

  it("draws the chevron as one polygon", () => {
    expect(renderWith(getPatternTemplate("chevron"), {}).match(/<polygon /g)).toHaveLength(1);
  });

  it("splits the halves at the middle", () => {
    expect(renderWith(getPatternTemplate("halves"), { side: 0 })).toBe('<rect x="0" y="0" width="207" height="414" fill="#ffffff"/>');
    expect(renderWith(getPatternTemplate("halves"), { side: 1 })).toBe('<rect x="207" y="0" width="207" height="414" fill="#ffffff"/>');
  });

  // O renderer 2D desenha o fill duas vezes (corpo e mangas match-body): um id no SVG ficaria repetido.
  it("draws the gradient with opacity bands, without defs or ids", () => {
    const svg = renderWith(getPatternTemplate("gradient"), {});
    expect(svg).toContain("fill-opacity");
    expect(svg).not.toMatch(/<defs|\sid=/);
  });

  // Guarda do refactor para fade.ts: passa antes e depois da Task 3.
  it("keeps the SVG of the vertical gradient", () => {
    const digest = createHash("sha256")
      .update(renderWith(getPatternTemplate("gradient"), {}))
      .digest("hex");
    expect(digest).toBe("748bbfd56aa108d53a98b902af56892ea90d22bc8927c2f2fd13ad0136702b0e");
  });

  it("draws the layer patterns with the expected elements", () => {
    expect(renderWith(getPatternTemplate("double-pinline"), {}).match(/<rect /g)).toHaveLength(4);
  });
});

describe("layer patterns colorAt", () => {
  const at = (id: string, raw: Record<string, number>, x: number, y: number) => {
    const template = getPatternTemplate(id);
    return template.colorAt(x, y, { width: SIZE, height: SIZE, params: resolveParams(template, raw) });
  };

  // width 0.02: painéis em x 112–120,3 e 293,7–302; fora do tronco é base.
  it("paints a side panel along each torso edge", () => {
    expect(at("side-lines", { width: 0.02 }, 116, 200)).toBe("overlay");
    expect(at("side-lines", { width: 0.02 }, 298, 200)).toBe("overlay");
    expect(at("side-lines", { width: 0.02 }, 130, 200)).toBe("base");
    expect(at("side-lines", { width: 0.02 }, 100, 200)).toBe("base");
  });

  // Defaults: filetes em x 128,1–131 e 134,8–137,7 à esquerda e 276,3–279,2 e 283–285,9 à direita.
  it("paints two thin lines on each side, inside the side panel area", () => {
    expect(at("double-pinline", {}, 129.5, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 133, 300)).toBe("base");
    expect(at("double-pinline", {}, 136, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 284, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 140, 300)).toBe("base");
  });

  it("places the shoulder line above the logos and the hoop line below the sponsor", () => {
    expect(at("shoulder-line", {}, 207, 82)).toBe("overlay");
    expect(at("shoulder-line", {}, 207, 90)).toBe("base");
    expect(at("hoop-line", {}, 207, 298)).toBe("overlay");
    expect(at("hoop-line", {}, 207, 310)).toBe("base");
  });
});
