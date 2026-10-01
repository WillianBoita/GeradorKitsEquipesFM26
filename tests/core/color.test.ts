import { describe, expect, it } from "vitest";
import { contrastRatio, normalizeHex } from "../../src/core/color.js";

describe("normalizeHex", () => {
  it.each([["#FFD700", "#ffd700"], ["#fff", "#ffffff"], ["#AbC", "#aabbcc"], ["#123456", "#123456"]])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHex(input)).toBe(expected);
  });

  it.each(["123456", "#12345", "#gggggg", "", "red", "#1234567"])("rejects %s", (input) => {
    expect(() => normalizeHex(input)).toThrow(/Invalid hex color/);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("is 1 for identical colors", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#123456", "#ffd700")).toBeCloseTo(contrastRatio("#ffd700", "#123456"), 5);
  });
});
