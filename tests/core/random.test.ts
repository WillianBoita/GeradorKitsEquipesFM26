import { describe, expect, it } from "vitest";
import { createRng, deriveSeed, MAX_SEED } from "../../src/core/random.js";

function sample(seed: number, count = 5): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    expect(sample(12345)).toEqual(sample(12345));
  });

  it("produces different sequences for different seeds", () => {
    expect(sample(1)).not.toEqual(sample(2));
  });

  it("returns values in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it.each([0, MAX_SEED])("accepts boundary seed %d", (seed) => {
    expect(() => createRng(seed)).not.toThrow();
  });

  it.each([-1, 1.5, MAX_SEED + 1, Number.NaN])("rejects invalid seed %d", (seed) => {
    expect(() => createRng(seed)).toThrow(/Seed must be an integer/);
  });

  it("keeps range values within bounds", () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const value = rng.range(10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
    }
  });

  it("throws when picking from an empty list", () => {
    expect(() => createRng(1).pick([])).toThrow(/empty list/);
  });

  it("never picks zero-weight options", () => {
    const rng = createRng(99);
    const entries = [
      ["a", 0],
      ["b", 1],
    ] as const;
    for (let i = 0; i < 1000; i++) expect(rng.weighted(entries)).toBe("b");
  });

  it("follows the configured weights", () => {
    const rng = createRng(2024);
    const entries = [
      ["a", 3],
      ["b", 1],
    ] as const;
    let hits = 0;
    for (let i = 0; i < 10_000; i++) if (rng.weighted(entries) === "a") hits++;
    expect(hits / 10_000).toBeCloseTo(0.75, 1);
  });

  it("throws when no option has positive weight", () => {
    expect(() => createRng(1).weighted([["a", 0]])).toThrow("No options with positive weight");
  });

  it("throws when the sum of weights overflows", () => {
    const entries = [
      ["a", 1e308],
      ["b", 1e308],
    ] as const;
    expect(() => createRng(1).weighted(entries)).toThrow("Sum of weights must be finite");
  });
});

describe("deriveSeed", () => {
  it("is stable across runs and platforms", () => {
    expect(deriveSeed(42, "home")).toBe(466384824);
    expect(deriveSeed(42, "palette:0")).toBe(2366796840);
    expect(deriveSeed(MAX_SEED, "third")).toBe(65517137);
  });

  it("changes with the label and with the seed", () => {
    expect(new Set(["home", "away", "third"].map((label) => deriveSeed(42, label))).size).toBe(3);
    expect(deriveSeed(1, "home")).not.toBe(deriveSeed(2, "home"));
  });

  it("returns valid seeds", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const derived = deriveSeed(seed, "palette:3");
      expect(Number.isInteger(derived)).toBe(true);
      expect(derived).toBeGreaterThanOrEqual(0);
      expect(derived).toBeLessThanOrEqual(MAX_SEED);
    }
  });

  it.each([-1, 1.5, MAX_SEED + 1])("rejects invalid seed %d", (seed) => {
    expect(() => deriveSeed(seed, "home")).toThrow(/Seed must be an integer/);
  });
});
