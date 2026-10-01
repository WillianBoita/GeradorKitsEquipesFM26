import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import type { KitDefinition } from "../../src/core/kit.js";
import { formatIssues, validateClub, validateColors, validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

const PALETTE = { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" };

function club(overrides: Record<string, unknown> = {}) {
  return parseClubIdentity({ ...GALATICOS_CLUB, ...overrides });
}

function kitSet(): Record<"home" | "away" | "third", KitDefinition> {
  return {
    home: makeKit({ kitType: "home", pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} } }),
    away: makeKit({ kitType: "away", pattern: { id: "solid", base: "secondary", overlay: "accent", params: {} } }),
    third: makeKit({ kitType: "third", pattern: { id: "solid", base: "accent", overlay: "primary", params: {} } }),
  };
}

describe("validateColors", () => {
  it("accepts clearly different colors", () => {
    expect(validateColors(PALETTE)).toEqual([]);
  });

  it("reports each pair that is too similar", () => {
    expect(validateColors({ primary: "#123456", secondary: "#1a3d66" })).toEqual([
      { rule: "distinct-colors", message: "primary #123456 and secondary #1a3d66 are too similar (distance 0.039, minimum 0.15)" },
    ]);
    expect(validateColors({ primary: "#ffffff", secondary: "#f0f0f0", accent: "#ffffff" })).toHaveLength(3);
  });

  it("ignores missing roles", () => {
    expect(validateColors({ primary: "#123456" })).toEqual([]);
  });
});

describe("validateClub", () => {
  it("accepts the galaticos club", () => {
    expect(validateClub(club())).toEqual([]);
  });

  it("accepts clubs without pattern weights", () => {
    expect(validateClub(club({ style: { categories: [] } }))).toEqual([]);
  });

  it("reports unknown patterns", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { zigzag: 1, solid: 1 } } }));
    expect(issues).toEqual([{ rule: "unknown-pattern", message: 'style.patternWeights references unknown pattern "zigzag" (known: solid, stripes, sash)' }]);
  });

  it("reports clubs without any positive weight on a known pattern", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { solid: 0, zigzag: 5 } } }));
    expect(issues.map((issue) => issue.rule)).toEqual(["unknown-pattern", "no-pattern-weight"]);
  });

  it("checks only the colors the club provides", () => {
    expect(validateClub(club({ palette: { primary: "#123456" } }))).toEqual([]);
    expect(validateClub(club({ palette: { primary: "#123456", accent: "#1a3d66" } })).map((issue) => issue.rule)).toEqual(["distinct-colors"]);
  });
});

describe("validatePalette", () => {
  it("requires the three colors to be distinct", () => {
    expect(validatePalette(PALETTE)).toEqual([]);
    expect(validatePalette({ ...PALETTE, accent: "#f0f0f0" })).toEqual([
      { rule: "distinct-colors", message: "secondary #ffffff and accent #f0f0f0 are too similar (distance 0.045, minimum 0.15)" },
    ]);
  });
});

describe("validateKit", () => {
  it("accepts a coherent kit", () => {
    expect(validateKit(makeKit())).toEqual([]);
  });

  it("reports unknown patterns", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } });
    expect(validateKit(kit)).toEqual([{ rule: "unknown-pattern", message: 'home kit uses unknown pattern "zigzag" (known: solid, stripes, sash)' }]);
  });

  it("reports base and overlay using the same role", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "primary", params: {} } });
    expect(validateKit(kit)).toEqual([{ rule: "pattern-contrast", message: "home kit uses primary as both pattern base and overlay" }]);
  });

  it("reports base and overlay colors that are too similar, even for solid", () => {
    const kit = makeKit({ colors: { primary: "#123456", secondary: "#1a3d66", accent: "#ffd700" } });
    expect(validateKit(kit)).toEqual([
      { rule: "pattern-contrast", message: "home kit base #123456 and overlay #1a3d66 are too similar (distance 0.039, minimum 0.15)" },
    ]);
  });
});

describe("validateKitSet", () => {
  it("accepts kits with distinct base colors", () => {
    expect(validateKitSet(kitSet())).toEqual([]);
  });

  it("accepts partial sets", () => {
    expect(validateKitSet({ home: kitSet().home })).toEqual([]);
    expect(validateKitSet({})).toEqual([]);
  });

  it("reports kits whose base colors clash", () => {
    const set = kitSet();
    const away = makeKit({ kitType: "away", pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} } });
    expect(validateKitSet({ ...set, away })).toEqual([
      { rule: "kit-clash", message: "home base #123456 and away base #123456 are too similar (distance 0.000, minimum 0.15)" },
    ]);
  });

  it("reports kits from different clubs", () => {
    const set = kitSet();
    expect(validateKitSet({ ...set, third: { ...set.third, clubId: "kong-team" } })).toEqual([
      { rule: "club-mismatch", message: "kits belong to different clubs: galaticos-fc, kong-team" },
    ]);
  });
});

describe("formatIssues", () => {
  it("prints one indented line per issue", () => {
    const issues = [
      { rule: "a", message: "first" },
      { rule: "b", message: "second" },
    ];
    expect(formatIssues(issues)).toBe("  - a: first\n  - b: second");
  });
});
