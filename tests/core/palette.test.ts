import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/core/color.js";
import { MIN_ACCENT_CONTRAST, resolvePalette } from "../../src/core/palette.js";
import { createRng } from "../../src/core/random.js";

describe("resolvePalette", () => {
  it("keeps and normalizes colors provided by the identity", () => {
    const palette = resolvePalette({ primary: "#123456", secondary: "#FFFFFF", accent: "#FFD700" }, createRng(1));
    expect(palette).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
  });

  it("derives secondary as the neutral with the best contrast", () => {
    expect(resolvePalette({ primary: "#0a0a40" }, createRng(1)).secondary).toBe("#ffffff");
    expect(resolvePalette({ primary: "#f5e050" }, createRng(1)).secondary).toBe("#000000");
  });

  it("derives the same accent for the same seed", () => {
    expect(resolvePalette({ primary: "#123456" }, createRng(42))).toEqual(resolvePalette({ primary: "#123456" }, createRng(42)));
  });

  it.each(["#123456", "#c8102e", "#ffd700", "#00ff00", "#000000", "#808080", "#ffffff"])("derives a readable accent for %s", (primary) => {
    for (let seed = 0; seed < 50; seed++) {
      const { accent } = resolvePalette({ primary }, createRng(seed));
      expect(accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(primary, accent)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
    }
  });
});
