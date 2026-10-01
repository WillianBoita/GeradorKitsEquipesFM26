import { describe, expect, it } from "vitest";
import { KIT_TYPES, parseKitDefinition, resolveLogoColor } from "../../src/core/kit.js";
import { MAX_SEED } from "../../src/core/random.js";
import { makeKit } from "../fixtures/kits.js";

describe("parseKitDefinition", () => {
  it("accepts a valid definition", () => {
    expect(parseKitDefinition(makeKit())).toEqual(makeKit());
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
