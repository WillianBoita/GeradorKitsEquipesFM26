import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { parseKitDefinition } from "../../src/core/kit.js";
import { generateKit } from "../../src/generator/kit-generator.js";

const identity: ClubIdentity = parseClubIdentity({
  id: "galaticos-fc",
  name: "Galáticos FC",
  palette: { primary: "#123456", secondary: "#FFFFFF", accent: "#FFD700" },
  style: { categories: ["modern"], patternWeights: { solid: 20, stripes: 40, sash: 40 } },
});

function withWeights(patternWeights: Record<string, number>): ClubIdentity {
  return { ...identity, style: { ...identity.style, patternWeights } };
}

describe("generateKit", () => {
  it("returns the same definition for the same seed", () => {
    expect(generateKit(identity, 42)).toEqual(generateKit(identity, 42));
  });

  it("produces definitions that pass schema validation after a JSON round trip", () => {
    for (let seed = 0; seed < 100; seed++) {
      const kit = generateKit(identity, seed);
      expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
    }
  });

  it("varies with the seed", () => {
    const distinct = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(generateKit(identity, seed))));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("keeps the club palette and uses primary as the home base", () => {
    const kit = generateKit(identity, 7);
    expect(kit.colors).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
    expect(kit.pattern.base).toBe("primary");
  });

  it("derives missing palette colors deterministically", () => {
    const minimal = parseClubIdentity({ id: "minimal", name: "Minimal", palette: { primary: "#c8102e" } });
    expect(generateKit(minimal, 5).colors).toEqual(generateKit(minimal, 5).colors);
    expect(generateKit(minimal, 5).colors.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("only picks patterns with positive weight", () => {
    const stripesOnly = withWeights({ stripes: 1, sash: 0 });
    for (let seed = 0; seed < 50; seed++) expect(generateKit(stripesOnly, seed).pattern.id).toBe("stripes");
  });

  it("generates params inside the template ranges", () => {
    const stripesOnly = withWeights({ stripes: 1 });
    for (let seed = 0; seed < 50; seed++) {
      const { count, ratio } = generateKit(stripesOnly, seed).pattern.params;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(15);
      expect(ratio).toBeGreaterThanOrEqual(0.2);
      expect(ratio).toBeLessThanOrEqual(0.8);
    }
  });

  it("uses template default weights when the club defines none", () => {
    const { patternWeights: _ignored, ...style } = identity.style;
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKit({ ...identity, style }, seed).pattern.id));
    expect(ids).toEqual(new Set(["solid", "stripes", "sash"]));
  });

  it("rejects unknown patterns in patternWeights", () => {
    expect(() => generateKit(withWeights({ zigzag: 1 }), 1)).toThrow('Unknown pattern "zigzag" in style.patternWeights of club "galaticos-fc"');
  });

  it("rejects clubs without any positive pattern weight", () => {
    expect(() => generateKit(withWeights({ solid: 0 }), 1)).toThrow('Club "galaticos-fc" has no pattern with positive weight');
  });

  it("references the club by its internal id", () => {
    expect(generateKit(identity, 1).clubId).toBe("galaticos-fc");
  });
});
