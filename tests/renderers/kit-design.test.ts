import { describe, expect, it } from "vitest";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { fillSvg, kitDesign } from "../../src/renderers/kit-design.js";
import { makeKit } from "../fixtures/kits.js";

describe("kitDesign", () => {
  it("resolves the body pattern with hex colors and clamped params", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 99 } } });
    expect(kitDesign(kit).body).toEqual({
      kind: "pattern",
      base: "#123456",
      overlay: "#ffffff",
      template: getPatternTemplate("stripes"),
      params: { count: 15, ratio: 0.3 },
    });
  });

  it("resolves the body layers in order, with hex colors and clamped params", () => {
    const kit = makeKit({
      layers: [
        { id: "side-lines", color: "accent", params: { width: 1 } },
        { id: "torso-circle", color: "secondary", params: {} },
      ],
    });
    expect(kitDesign(kit).bodyLayers).toEqual([
      { template: getPatternTemplate("side-lines"), color: "#ffd700", params: { width: 0.03 } },
      { template: getPatternTemplate("torso-circle"), color: "#ffffff", params: { size: 0.12, stroke: 0.018 } },
    ]);
  });

  it("has no body layers when the kit declares none", () => {
    expect(kitDesign(makeKit()).bodyLayers).toEqual([]);
  });

  it("gives match-body sleeves the body fill", () => {
    const design = kitDesign(makeKit({ sleeves: { style: "match-body", color: "accent", cuffColor: "secondary" } }));
    expect(design.sleeves).toBe(design.body);
  });

  it("gives solid sleeves the sleeve color", () => {
    expect(kitDesign(makeKit({ sleeves: { style: "solid", color: "accent", cuffColor: "secondary" } })).sleeves).toEqual({ kind: "solid", color: "#ffd700" });
  });

  it("resolves collar, cuffs, shorts and socks to hex", () => {
    const kit = makeKit({
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "primary" },
      shorts: { color: "secondary" },
      socks: { color: "accent" },
    });
    expect(kitDesign(kit)).toMatchObject({ collar: "#ffd700", cuffs: "#123456", shorts: "#ffffff", socks: "#ffd700" });
  });

  it("throws for unknown patterns", () => {
    expect(() => kitDesign(makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } }))).toThrow(/Unknown pattern "zigzag"/);
  });
});

describe("fillSvg", () => {
  it("paints a solid fill as one rect", () => {
    expect(fillSvg({ kind: "solid", color: "#ffd700" }, 100, 50)).toBe('<rect width="100" height="50" fill="#ffd700"/>');
  });

  it("paints the pattern over its base", () => {
    const body = kitDesign(makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 3 } } })).body;
    const svg = fillSvg(body, 414, 414);
    expect(svg.startsWith('<rect width="414" height="414" fill="#123456"/>')).toBe(true);
    expect(svg.match(/fill="#ffffff"/g)).toHaveLength(3);
  });

  it("paints the layers after the pattern, in the layer color, without another base", () => {
    const design = kitDesign(
      makeKit({
        pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 3 } },
        layers: [{ id: "side-lines", color: "accent", params: {} }],
      }),
    );
    const layer = getPatternTemplate("side-lines").render({ width: 414, height: 414, base: "#ffd700", overlay: "#ffd700", params: { width: 0.02 } });
    expect(fillSvg(design.body, 414, 414, design.bodyLayers)).toBe(`${fillSvg(design.body, 414, 414)}${layer}`);
  });
});
