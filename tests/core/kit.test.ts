import { describe, expect, it } from "vitest";
import { parseKitDefinition } from "../../src/core/kit.js";
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
});
