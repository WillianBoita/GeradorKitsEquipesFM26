import { describe, expect, it } from "vitest";
import { ClubIdSchema, HexColorSchema, parseWith } from "../../src/core/primitives.js";

describe("HexColorSchema", () => {
  it("normalizes short and uppercase colors", () => {
    expect(HexColorSchema.parse("#FFF")).toBe("#ffffff");
    expect(HexColorSchema.parse("#FFD700")).toBe("#ffd700");
  });

  it("rejects invalid colors", () => {
    expect(HexColorSchema.safeParse("blue").success).toBe(false);
  });
});

describe("ClubIdSchema", () => {
  it.each(["galaticos", "club-1", "1001"])("accepts %s", (id) => {
    expect(ClubIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["Galaticos", "../etc", "", "-club", "club id"])("rejects %s", (id) => {
    expect(ClubIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("parseWith", () => {
  it("returns parsed data", () => {
    expect(parseWith(HexColorSchema, "#ABC", "color")).toBe("#aabbcc");
  });

  it("throws a labeled error", () => {
    expect(() => parseWith(ClubIdSchema, "Bad Id", "club id")).toThrow(/^Invalid club id:/);
  });
});
