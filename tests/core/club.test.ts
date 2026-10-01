import { describe, expect, it } from "vitest";
import { ClubIdentitySchema, parseClubIdentity } from "../../src/core/club.js";

const galaticos = {
  id: "galaticos-fc",
  name: "Galáticos FC",
  fmUniqueId: "123456789",
  palette: { primary: "#123456", secondary: "#FFFFFF", accent: "#FFD700" },
  style: { categories: ["modern"], patternWeights: { solid: 20, stripes: 40, sash: 40 } },
};

describe("parseClubIdentity", () => {
  it("accepts a complete identity and normalizes colors", () => {
    const club = parseClubIdentity(galaticos);
    expect(club.fmUniqueId).toBe("123456789");
    expect(club.palette).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
    expect(club.style.patternWeights).toEqual({ solid: 20, stripes: 40, sash: 40 });
  });

  it("accepts an identity without fmUniqueId, secondary, accent or style", () => {
    const club = parseClubIdentity({ id: "minimal", name: "Minimal", palette: { primary: "#c8102e" } });
    expect(club).toEqual({ id: "minimal", name: "Minimal", palette: { primary: "#c8102e" }, style: { categories: [] } });
  });

  it.each(["12a", "", "-1", "1.5"])("rejects non-numeric fmUniqueId %j", (fmUniqueId) => {
    expect(() => parseClubIdentity({ ...galaticos, fmUniqueId })).toThrow(/fmUniqueId/);
  });

  it("rejects fmUniqueId given as a JSON number", () => {
    expect(() => parseClubIdentity({ ...galaticos, fmUniqueId: 123456789 })).toThrow(/fmUniqueId/);
  });

  it("rejects invalid internal ids", () => {
    const result = ClubIdentitySchema.safeParse({ ...galaticos, id: "Galáticos FC" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["id"]]);
  });

  it("rejects negative pattern weights", () => {
    const club = { ...galaticos, style: { categories: [], patternWeights: { stripes: -1 } } };
    expect(() => parseClubIdentity(club)).toThrow(/patternWeights/);
  });

  it("accepts pattern weights up to 1,000,000 and rejects larger ones", () => {
    const withWeight = (weight: number) => ({ ...galaticos, style: { categories: [], patternWeights: { stripes: weight } } });
    expect(parseClubIdentity(withWeight(1_000_000)).style.patternWeights).toEqual({ stripes: 1_000_000 });
    expect(() => parseClubIdentity(withWeight(1_000_001))).toThrow(/patternWeights/);
  });

  it("rejects empty names", () => {
    expect(() => parseClubIdentity({ ...galaticos, name: "" })).toThrow(/name/);
  });

  it("rejects unknown keys and names them", () => {
    expect(() => parseClubIdentity({ ...galaticos, palette: { primary: "#123456", secundary: "#ffffff" } })).toThrow(/secundary/);
  });

  it("rejects a misspelled fmUniqueId key", () => {
    const { fmUniqueId, ...rest } = galaticos;
    expect(() => parseClubIdentity({ ...rest, fmUniqueID: fmUniqueId })).toThrow(/fmUniqueID/);
  });

  it("rejects a misspelled patternWeights key", () => {
    expect(() => parseClubIdentity({ ...galaticos, style: { categories: [], patternWeigths: { solid: 1 } } })).toThrow(/patternWeigths/);
  });

  it("rejects invalid palette colors", () => {
    expect(() => parseClubIdentity({ ...galaticos, palette: { primary: "azul" } })).toThrow(/palette\.primary/);
  });

  it("accepts sponsor and manufacturer pools", () => {
    const club = parseClubIdentity({ ...galaticos, sponsors: { "luna-air": 3, "orbita-bank": 0 }, manufacturers: { vertex: 1 } });
    expect(club.sponsors).toEqual({ "luna-air": 3, "orbita-bank": 0 });
    expect(club.manufacturers).toEqual({ vertex: 1 });
  });

  it("rejects pool keys that are not asset ids", () => {
    expect(() => parseClubIdentity({ ...galaticos, sponsors: { "Luna Air": 1 } })).toThrow(/sponsors/);
  });

  it.each([-1, 1_000_001])("rejects the pool weight %d", (weight) => {
    expect(() => parseClubIdentity({ ...galaticos, manufacturers: { vertex: weight } })).toThrow(/manufacturers/);
  });

  it("rejects a misspelled pool key", () => {
    expect(() => parseClubIdentity({ ...galaticos, sponsor: { "luna-air": 1 } })).toThrow(/sponsor/);
  });
});
