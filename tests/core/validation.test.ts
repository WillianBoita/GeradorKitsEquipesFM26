import { describe, expect, it } from "vitest";
import type { AssetRegistry } from "../../src/assets/registry.js";
import { parseClubIdentity } from "../../src/core/club.js";
import type { KitDefinition } from "../../src/core/kit.js";
import {
  formatIssues,
  validateClub,
  validateClubAssets,
  validateColors,
  validateKit,
  validateKitAssets,
  validateKitSet,
  validatePalette,
} from "../../src/core/validation.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

const PALETTE = { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" };
const KNOWN_PATTERNS = "solid, stripes, sash, pinstripes, hoops, diagonal, chevron, chest-band, center-band, checkers, halves, gradient";

const REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.svg" },
  ],
  manufacturers: [{ id: "vertex", name: "Vertex", file: "manufacturers/vertex.svg" }],
};

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

  it("reports unknown style categories", () => {
    expect(validateClub(club({ style: { categories: ["modern", "dark"] } }))).toEqual([
      { rule: "unknown-style", message: 'style.categories references unknown style "dark" (known: classic, traditional, modern, retro)' },
    ]);
  });

  it("accepts clubs without pattern weights", () => {
    expect(validateClub(club({ style: { categories: [] } }))).toEqual([]);
  });

  it("reports unknown patterns", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { zigzag: 1, solid: 1 } } }));
    expect(issues).toEqual([{ rule: "unknown-pattern", message: `style.patternWeights references unknown pattern "zigzag" (known: ${KNOWN_PATTERNS})` }]);
  });

  it("reports clubs without any positive weight on a known pattern", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { solid: 0, zigzag: 5 } } }));
    expect(issues.map((issue) => issue.rule)).toEqual(["unknown-pattern", "no-pattern-weight"]);
  });

  it("checks only the colors the club provides", () => {
    expect(validateClub(club({ palette: { primary: "#123456" } }))).toEqual([]);
    expect(validateClub(club({ palette: { primary: "#123456", accent: "#1a3d66" } })).map((issue) => issue.rule)).toEqual(["distinct-colors"]);
  });

  it("accepts pools with at least one positive weight", () => {
    expect(validateClub(club({ sponsors: { "luna-air": 0, "orbita-bank": 2 }, manufacturers: { vertex: 1 } }))).toEqual([]);
  });

  it("reports pools without any positive weight", () => {
    expect(validateClub(club({ sponsors: { "luna-air": 0 }, manufacturers: {} }))).toEqual([
      { rule: "no-asset-weight", message: "sponsors gives no sponsor a positive weight" },
      { rule: "no-asset-weight", message: "manufacturers gives no manufacturer a positive weight" },
    ]);
  });
});

describe("validateClubAssets", () => {
  it("accepts clubs without pools or with registered ids", () => {
    expect(validateClubAssets(club(), REGISTRY)).toEqual([]);
    expect(validateClubAssets(club({ sponsors: { "luna-air": 1 }, manufacturers: { vertex: 1 } }), REGISTRY)).toEqual([]);
  });

  it("reports pool ids missing from the registry", () => {
    expect(validateClubAssets(club({ sponsors: { acme: 1, "luna-air": 1 }, manufacturers: { kong: 1 } }), REGISTRY)).toEqual([
      { rule: "unknown-asset", message: 'sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)' },
      { rule: "unknown-asset", message: 'manufacturers references unknown manufacturer "kong" (known: vertex)' },
    ]);
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
    expect(validateKit(kit)).toEqual([{ rule: "unknown-pattern", message: `home kit uses unknown pattern "zigzag" (known: ${KNOWN_PATTERNS})` }]);
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

describe("validateKit logo-contrast", () => {
  const sash = { id: "sash", base: "primary" as const, overlay: "secondary" as const, params: { width: 70, direction: 0 } };

  it("accepts a legible sponsor", () => {
    expect(validateKit(makeKit({ sponsor: { id: "luna-air", color: "secondary" } }))).toEqual([]);
  });

  it("reports a sponsor that disappears into the base", () => {
    expect(validateKit(makeKit({ sponsor: { id: "luna-air", color: "primary" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit sponsor #123456 has contrast 1.00 against primary #123456 (minimum 3)" },
    ]);
  });

  it("checks every color behind the logo", () => {
    expect(validateKit(makeKit({ pattern: sash, sponsor: { id: "luna-air", color: "accent" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit sponsor #ffd700 has contrast 1.40 against secondary #ffffff (minimum 3)" },
    ]);
  });

  it("accepts an outline that covers the colors the fill cannot", () => {
    expect(validateKit(makeKit({ pattern: sash, sponsor: { id: "luna-air", color: "accent", outline: "primary" } }))).toEqual([]);
  });

  it("reports an outline too close to the fill", () => {
    const kit = makeKit({
      pattern: { id: "solid", base: "secondary", overlay: "primary", params: {} },
      sponsor: { id: "luna-air", color: "primary", outline: "#000000" },
    });
    expect(validateKit(kit)).toEqual([{ rule: "logo-contrast", message: "home kit sponsor #123456 and its outline #000000 have contrast 1.65 (minimum 3)" }]);
  });

  it("names the outline when fill and outline both fail against the background", () => {
    const kit = makeKit({ sponsor: { id: "luna-air", color: "primary", outline: "#000000" } });
    expect(validateKit(kit)).toContainEqual({
      rule: "logo-contrast",
      message: "home kit sponsor #123456 with outline #000000 has contrast 1.65 against primary #123456 (minimum 3)",
    });
  });

  it("checks the manufacturer too", () => {
    expect(validateKit(makeKit({ manufacturer: { id: "vertex", color: "primary" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit manufacturer #123456 has contrast 1.00 against primary #123456 (minimum 3)" },
    ]);
  });

  it("skips the rule when the pattern is unknown", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} }, sponsor: { id: "luna-air", color: "primary" } });
    expect(validateKit(kit).map((issue) => issue.rule)).toEqual(["unknown-pattern"]);
  });
});

describe("validateKitAssets", () => {
  it("accepts kits without logos or with registered ids", () => {
    expect(validateKitAssets(makeKit(), REGISTRY)).toEqual([]);
    expect(
      validateKitAssets(makeKit({ sponsor: { id: "luna-air", color: "secondary" }, manufacturer: { id: "vertex", color: "secondary" } }), REGISTRY),
    ).toEqual([]);
  });

  it("reports sponsor and manufacturer ids missing from the registry", () => {
    const kit = makeKit({ kitType: "away", sponsor: { id: "acme", color: "primary" }, manufacturer: { id: "kong", color: "primary" } });
    expect(validateKitAssets(kit, REGISTRY)).toEqual([
      { rule: "unknown-asset", message: 'away kit references unknown sponsor "acme" (known: luna-air, orbita-bank)' },
      { rule: "unknown-asset", message: 'away kit references unknown manufacturer "kong" (known: vertex)' },
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
