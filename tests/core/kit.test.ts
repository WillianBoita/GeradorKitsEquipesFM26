import { describe, expect, it } from "vitest";
import {
  COLLAR_STYLES,
  KIT_TYPES,
  MAX_LAYERS,
  parseKitDefinition,
  resolveLogoColor,
  SLEEVE_CUTS,
  sleeveCut,
  visibleRoles,
  type KitLayer,
} from "../../src/core/kit.js";
import { MAX_SEED } from "../../src/core/random.js";
import { makeKit } from "../fixtures/kits.js";

describe("parseKitDefinition", () => {
  it("accepts a valid definition", () => {
    expect(parseKitDefinition(makeKit())).toEqual(makeKit());
  });

  it("accepts up to MAX_LAYERS layers and keeps them through a JSON round trip", () => {
    const layers: KitLayer[] = [
      { id: "side-lines", color: "accent", params: { width: 0.02 } },
      { id: "torso-circle", color: "accent", params: {} },
    ];
    expect(layers).toHaveLength(MAX_LAYERS);
    const kit = makeKit({ layers });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("rejects more than MAX_LAYERS layers", () => {
    const layer = { id: "side-lines", color: "accent", params: {} };
    expect(() => parseKitDefinition({ ...makeKit(), layers: [layer, layer, layer] })).toThrow(/at layers/);
  });

  it("defaults missing layer params to an empty object", () => {
    expect(parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "accent" }] }).layers).toEqual([
      { id: "side-lines", color: "accent", params: {} },
    ]);
  });

  it("rejects unknown layer colors and keys and names the path", () => {
    expect(() => parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "gold" }] })).toThrow(/layers\[0\]\.color/);
    expect(() => parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "accent", colour: "accent" }] })).toThrow(/colour/);
  });

  it("keeps kits from before Phase 4b without layers", () => {
    expect(parseKitDefinition(makeKit())).not.toHaveProperty("layers");
  });

  it("survives a JSON round trip", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.5 } } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("normalizes colors", () => {
    const kit = makeKit({ colors: { primary: "#ABC", secondary: "#FFFFFF", accent: "#000" } });
    expect(parseKitDefinition(kit).colors).toEqual({ primary: "#aabbcc", secondary: "#ffffff", accent: "#000000" });
  });

  it("defaults missing pattern params to an empty object", () => {
    const raw = JSON.parse(JSON.stringify(makeKit()));
    delete raw.pattern.params;
    expect(parseKitDefinition(raw).pattern.params).toEqual({});
  });

  it("reports the path of invalid colors", () => {
    const kit = makeKit({ colors: { primary: "blue", secondary: "#ffffff", accent: "#000000" } });
    expect(() => parseKitDefinition(kit)).toThrow(/colors\.primary/);
  });

  it.each(COLLAR_STYLES)("accepts the %s collar", (style) => {
    expect(parseKitDefinition(makeKit({ collar: { style, color: "accent" } })).collar.style).toBe(style);
  });

  it.each(SLEEVE_CUTS)("accepts the %s sleeve cut and keeps it through a JSON round trip", (cut) => {
    const kit = makeKit({ sleeves: { style: "solid", cut, color: "secondary", cuffColor: "accent" } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("rejects unknown sleeve cuts and names the path", () => {
    const sleeves = { style: "solid", cut: "puffed", color: "secondary", cuffColor: "accent" };
    expect(() => parseKitDefinition({ ...makeKit(), sleeves })).toThrow(/sleeves\.cut/);
  });

  it("rejects unknown collars and names the path", () => {
    expect(() => parseKitDefinition({ ...makeKit(), collar: { style: "polo-x", color: "accent" } })).toThrow(/collar\.style/);
  });

  it("rejects unknown color roles", () => {
    expect(() => parseKitDefinition({ ...makeKit(), collar: { style: "round", color: "gold" } })).toThrow(/Invalid kit definition/);
  });

  it("rejects unknown keys and names them", () => {
    const raw = JSON.parse(JSON.stringify(makeKit()));
    raw.collar.colour = "primary";
    expect(() => parseKitDefinition(raw)).toThrow(/colour/);
  });

  it("rejects invalid club ids", () => {
    expect(() => parseKitDefinition(makeKit({ clubId: "Bad Id" }))).toThrow(/clubId/);
  });

  it.each(KIT_TYPES)("accepts the %s kit type", (kitType) => {
    expect(parseKitDefinition(makeKit({ kitType })).kitType).toBe(kitType);
  });

  it("requires a known kit type", () => {
    const { kitType: _ignored, ...withoutType } = makeKit();
    expect(() => parseKitDefinition(withoutType)).toThrow(/kitType/);
    expect(() => parseKitDefinition({ ...makeKit(), kitType: "fourth" })).toThrow(/kitType/);
  });

  it("accepts the generation seed and keeps it through a JSON round trip", () => {
    const kit = makeKit({ generatedWith: { seed: MAX_SEED } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it.each([-1, 1.5, MAX_SEED + 1])("rejects the invalid generation seed %d", (seed) => {
    expect(() => parseKitDefinition({ ...makeKit(), generatedWith: { seed } })).toThrow(/generatedWith\.seed/);
  });

  it("rejects unknown keys in generatedWith", () => {
    expect(() => parseKitDefinition({ ...makeKit(), generatedWith: { seed: 1, attempt: 0 } })).toThrow(/attempt/);
  });

  it("accepts badge, sponsor and manufacturer and keeps them through a JSON round trip", () => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air", color: "primary", outline: "secondary" }, manufacturer: { id: "vertex", color: "#000000" } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("keeps Phase 2a kits without logos valid", () => {
    const kit = parseKitDefinition(makeKit());
    expect(kit).not.toHaveProperty("badge");
    expect(kit).not.toHaveProperty("sponsor");
    expect(kit).not.toHaveProperty("manufacturer");
  });

  it("normalizes hex logo colors", () => {
    expect(parseKitDefinition(makeKit({ sponsor: { id: "luna-air", color: "#FFF" } })).sponsor).toEqual({ id: "luna-air", color: "#ffffff" });
  });

  it("rejects logo colors that are neither a palette role nor a hex color", () => {
    expect(() => parseKitDefinition({ ...makeKit(), sponsor: { id: "luna-air", color: "gold" } })).toThrow(/sponsor\.color/);
  });

  it("rejects invalid logo ids and unknown logo keys", () => {
    expect(() => parseKitDefinition({ ...makeKit(), manufacturer: { id: "Vertex", color: "primary" } })).toThrow(/manufacturer\.id/);
    expect(() => parseKitDefinition({ ...makeKit(), sponsor: { id: "luna-air", color: "primary", colour: "accent" } })).toThrow(/colour/);
  });
});

describe("resolveLogoColor", () => {
  it("resolves palette roles and keeps hex colors", () => {
    expect(resolveLogoColor(makeKit(), "accent")).toBe("#ffd700");
    expect(resolveLogoColor(makeKit(), "#000000")).toBe("#000000");
  });
});

describe("visibleRoles", () => {
  it("counts the layer colors", () => {
    const kit = makeKit({
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
      layers: [{ id: "side-lines", color: "accent", params: {} }],
    });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary", "accent"]);
  });

  it("hides the overlay of a solid pattern with match-body sleeves", () => {
    expect(visibleRoles(makeKit())).toEqual(["primary", "accent"]);
  });

  it("shows the color of solid sleeves", () => {
    expect(visibleRoles(makeKit({ sleeves: { style: "solid", color: "secondary", cuffColor: "accent" } }))).toEqual(["primary", "secondary", "accent"]);
  });

  it("shows the overlay of a pattern", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: {} } });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary", "accent"]);
  });

  it("counts the collar and the cuffs", () => {
    const kit = makeKit({ collar: { style: "round", color: "secondary" }, sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" } });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary"]);
  });
});

describe("sleeveCut", () => {
  it("reads a kit without cut as set-in", () => {
    expect(sleeveCut(makeKit())).toBe("set-in");
  });

  it("returns the declared cut", () => {
    expect(sleeveCut(makeKit({ sleeves: { style: "solid", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toBe("raglan");
  });
});
