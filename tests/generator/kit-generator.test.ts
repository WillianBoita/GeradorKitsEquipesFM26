import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { KIT_TYPES, parseKitDefinition } from "../../src/core/kit.js";
import { resolvePalette } from "../../src/core/palette.js";
import { createRng, deriveSeed } from "../../src/core/random.js";
import { validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { generateKit, generateKitSet, generatePalette, MAX_PALETTE_ATTEMPTS } from "../../src/generator/kit-generator.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const identity: ClubIdentity = parseClubIdentity(GALATICOS_CLUB);

function withWeights(patternWeights: Record<string, number>): ClubIdentity {
  return { ...identity, style: { ...identity.style, patternWeights } };
}

function withPalette(palette: ClubIdentity["palette"]): ClubIdentity {
  return { ...identity, palette };
}

describe("generateKitSet", () => {
  it("returns the same set for the same seed", () => {
    expect(generateKitSet(identity, 42)).toEqual(generateKitSet(identity, 42));
  });

  it("varies with the seed", () => {
    const distinct = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(generateKitSet(identity, seed))));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("produces one kit per type, all from the same club, palette and seed", () => {
    const set = generateKitSet(identity, 7);
    expect(Object.keys(set)).toEqual([...KIT_TYPES]);
    for (const kitType of KIT_TYPES) {
      expect(set[kitType]).toMatchObject({ clubId: "galaticos-fc", kitType, generatedWith: { seed: 7 } });
      expect(set[kitType].colors).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
    }
  });

  it("cycles the roles: home primary/secondary, away secondary/accent, third accent/primary", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { home, away, third } = generateKitSet(identity, seed);
      expect([home.pattern.base, home.pattern.overlay]).toEqual(["primary", "secondary"]);
      expect([away.pattern.base, away.pattern.overlay]).toEqual(["secondary", "accent"]);
      expect([third.pattern.base, third.pattern.overlay]).toEqual(["accent", "primary"]);
    }
  });

  it("produces definitions that pass schema validation after a JSON round trip", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const kit of Object.values(generateKitSet(identity, seed))) expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
    }
  });

  it("never produces an invalid kit or set from a valid palette", () => {
    const palettes: ClubIdentity["palette"][] = [
      identity.palette,
      { primary: "#c8102e" },
      { primary: "#808080" },
      { primary: "#ffd700" },
      { primary: "#000000" },
    ];
    for (const palette of palettes) {
      for (let seed = 0; seed < 100; seed++) {
        const set = generateKitSet(withPalette(palette), seed);
        for (const kit of Object.values(set)) expect(validateKit(kit)).toEqual([]);
        expect(validateKitSet(set)).toEqual([]);
      }
    }
  });

  it("keeps trims, shorts and socks consistent with the kit roles", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const kit of Object.values(generateKitSet(identity, seed))) {
        const { base, overlay } = kit.pattern;
        expect(kit.collar.color).not.toBe(base);
        expect(kit.sleeves.cuffColor).not.toBe(base);
        expect(kit.sleeves.color).toBe(overlay);
        expect([base, overlay]).toContain(kit.shorts.color);
        expect([kit.shorts.color, base]).toContain(kit.socks.color);
      }
    }
  });

  it("only picks patterns with positive weight", () => {
    const stripesOnly = withWeights({ stripes: 1, sash: 0 });
    for (let seed = 0; seed < 50; seed++) {
      for (const kit of Object.values(generateKitSet(stripesOnly, seed))) expect(kit.pattern.id).toBe("stripes");
    }
  });

  it("generates stripes params inside the template ranges", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { count, ratio } = generateKitSet(withWeights({ stripes: 1 }), seed).home.pattern.params;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(15);
      expect(ratio).toBeGreaterThanOrEqual(0.2);
      expect(ratio).toBeLessThanOrEqual(0.4);
    }
  });

  it("generates sash params inside the template ranges", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { width, direction } = generateKitSet(withWeights({ sash: 1 }), seed).home.pattern.params;
      expect(width).toBeGreaterThanOrEqual(30);
      expect(width).toBeLessThanOrEqual(100);
      expect([0, 1]).toContain(direction);
    }
  });

  it("uses template default weights when the club defines none", () => {
    const { patternWeights: _ignored, ...style } = identity.style;
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet({ ...identity, style }, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["solid", "stripes", "sash"]));
  });

  it("rejects invalid clubs before generating anything", () => {
    expect(() => generateKitSet(withWeights({ zigzag: 1 }), 1)).toThrow(
      'Club "galaticos-fc" is invalid:\n  - unknown-pattern: style.patternWeights references unknown pattern "zigzag"',
    );
    expect(() => generateKitSet(withWeights({ solid: 0 }), 1)).toThrow(/no-pattern-weight/);
    expect(() => generateKitSet(withPalette({ primary: "#123456", secondary: "#1a3d66" }), 1)).toThrow(
      /distinct-colors: primary #123456 and secondary #1a3d66/,
    );
  });
});

describe("generatePalette", () => {
  it("keeps the colors the club provides", () => {
    expect(generatePalette(identity, 1)).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
  });

  it("retries with another sub-seed when the derived palette is invalid", () => {
    const club = withPalette({ primary: "#123456", secondary: "#ffafc2" });
    const firstAttempt = (seed: number) => resolvePalette(club.palette, createRng(deriveSeed(seed, "palette:0")));
    const seed = Array.from({ length: 100 }, (_, candidate) => candidate).find((candidate) => validatePalette(firstAttempt(candidate)).length > 0);
    expect(seed).toBeDefined();
    const palette = generatePalette(club, seed!);
    expect(validatePalette(palette)).toEqual([]);
    expect(palette.accent).not.toBe(firstAttempt(seed!).accent);
  });

  it("fails with the violated rule when no attempt produces a valid palette", () => {
    const club = withPalette({ primary: "#123456", accent: "#f0f0f0" });
    expect(() => generatePalette(club, 1)).toThrow(
      `Could not derive a valid palette for club "galaticos-fc" after ${MAX_PALETTE_ATTEMPTS} attempts:\n  - distinct-colors: secondary #ffffff and accent #f0f0f0 are too similar (distance 0.045, minimum 0.15)`,
    );
  });
});

describe("generateKit", () => {
  it("produces the same kit as the set for the same type, palette and seed", () => {
    const set = generateKitSet(identity, 99);
    expect(generateKit(identity, "away", generatePalette(identity, 99), 99)).toEqual(set.away);
  });
});
