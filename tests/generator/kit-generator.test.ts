import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { COLLAR_STYLES, KIT_TYPES, parseKitDefinition, visibleRoles } from "../../src/core/kit.js";
import { resolvePalette } from "../../src/core/palette.js";
import { createRng, deriveSeed } from "../../src/core/random.js";
import { validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { generateKit, generateKitSet, generatePalette, MAX_PALETTE_ATTEMPTS } from "../../src/generator/kit-generator.js";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { GALATICOS_BRANDED_CLUB, GALATICOS_CLUB } from "../fixtures/clubs.js";

const identity: ClubIdentity = parseClubIdentity(GALATICOS_CLUB);
const branded: ClubIdentity = parseClubIdentity(GALATICOS_BRANDED_CLUB);
// Sem categories, gola e manga seguem classic, que reproduz o rng.pick de antes dos perfis; os pesos de padrão do clube continuam valendo.
const classicStyled: ClubIdentity = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: GALATICOS_CLUB.style.patternWeights } });

function withWeights(patternWeights: Record<string, number>): ClubIdentity {
  return { ...identity, style: { ...identity.style, patternWeights } };
}

function withPalette(palette: ClubIdentity["palette"]): ClubIdentity {
  return { ...identity, palette };
}

describe("generateKitSet", () => {
  const NEW_PATTERN_IDS = [
    "pinstripes",
    "hoops",
    "diagonal",
    "chevron",
    "chest-band",
    "center-band",
    "checkers",
    "halves",
    "gradient",
    "gradient-diagonal",
    "gradient-radial",
  ];

  it.each(NEW_PATTERN_IDS)("generates valid %s kits with params inside the template ranges", (id) => {
    const template = getPatternTemplate(id);
    const club: ClubIdentity = { ...branded, style: { ...branded.style, patternWeights: { [id]: 1 } } };
    for (let seed = 0; seed < 20; seed++) {
      const set = generateKitSet(club, seed, { badge: true });
      for (const kit of Object.values(set)) {
        expect(kit.pattern.id).toBe(id);
        expect(validateKit(kit)).toEqual([]);
        for (const [key, spec] of Object.entries(template.parameters)) {
          const value = kit.pattern.params[key]!;
          expect(value).toBeGreaterThanOrEqual(spec.min);
          expect(value).toBeLessThanOrEqual(spec.max);
          if (spec.integer) expect(Number.isInteger(value)).toBe(true);
        }
      }
      expect(validateKitSet(set)).toEqual([]);
    }
  });

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
        const set = generateKitSet({ ...withPalette(palette), sponsors: branded.sponsors, manufacturers: branded.manufacturers }, seed);
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

  it("uses the classic profile when the club configures no style", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } });
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["solid", "stripes", "sash"]));
  });

  it("draws from the profiles listed in categories", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["retro"] } });
    const ids = new Set(Array.from({ length: 300 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["hoops", "chest-band", "center-band", "chevron", "stripes", "solid", "gradient-diagonal"]));
  });

  it("draws plain sleeves less often for a modern club than for a classic one", () => {
    const solidShare = (categories: string[]) => {
      const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });
      const kits = Array.from({ length: 100 }, (_, seed) => Object.values(generateKitSet(club, seed))).flat();
      return kits.filter((kit) => kit.sleeves.style === "solid").length / kits.length;
    };
    expect(solidShare(["modern"])).toBeLessThan(0.3);
    expect(solidShare([])).toBeGreaterThan(0.4);
  });

  it("draws every collar for a retro club", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["retro"] } });
    const styles = new Set(Array.from({ length: 50 }, (_, seed) => Object.values(generateKitSet(club, seed)).map((kit) => kit.collar.style)).flat());
    expect(styles).toEqual(new Set(COLLAR_STYLES));
  });

  it("writes the sleeve cut only for raglan sleeves", () => {
    const modern = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["modern"] } });
    const kits = Array.from({ length: 50 }, (_, seed) => Object.values(generateKitSet(modern, seed))).flat();
    expect(kits.some((kit) => kit.sleeves.cut === "raglan")).toBe(true);
    expect(kits.some((kit) => !("cut" in kit.sleeves))).toBe(true);
    for (const kit of kits) expect(kit.sleeves.cut).not.toBe("set-in");
  });

  it("keeps a club without categories on set-in sleeves", () => {
    const classic = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } });
    for (let seed = 0; seed < 50; seed++) {
      for (const kit of Object.values(generateKitSet(classic, seed))) expect(kit.sleeves).not.toHaveProperty("cut");
    }
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

describe("generateKitSet logos", () => {
  // Guarda: passa antes e depois desta tarefa; a 2b não pode mudar o desenho dos kits já versionados.
  it("keeps the Phase 2a design for seed 42", () => {
    const { home, away, third } = generateKitSet(classicStyled, 42);
    expect(home).toMatchObject({
      pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 86.656, direction: 0 } },
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "secondary" },
      shorts: { color: "primary" },
      socks: { color: "primary" },
    });
    expect(away).toMatchObject({
      pattern: { id: "stripes", params: { count: 10, ratio: 0.214 } },
      collar: { style: "v-neck", color: "primary" },
      sleeves: { style: "match-body", color: "accent", cuffColor: "primary" },
      shorts: { color: "secondary" },
      socks: { color: "secondary" },
    });
    expect(third).toMatchObject({
      pattern: { id: "stripes", params: { count: 5, ratio: 0.305 } },
      collar: { style: "round", color: "primary" },
      sleeves: { style: "solid", color: "primary", cuffColor: "primary" },
      shorts: { color: "primary" },
      socks: { color: "accent" },
    });
  });

  it("adds logos without changing the design", () => {
    for (let seed = 0; seed < 30; seed++) {
      const withLogos = generateKitSet(branded, seed, { badge: true });
      const plain = generateKitSet(identity, seed);
      for (const kitType of KIT_TYPES) {
        const { badge: _badge, sponsor: _sponsor, manufacturer: _manufacturer, ...design } = withLogos[kitType];
        expect(design).toEqual(plain[kitType]);
      }
    }
  });

  it("shares one sponsor and one manufacturer across the set", () => {
    const sponsors = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const { home, away, third } = generateKitSet(branded, seed);
      expect(home.sponsor).toBeDefined();
      expect(away.sponsor?.id).toBe(home.sponsor?.id);
      expect(third.sponsor?.id).toBe(home.sponsor?.id);
      for (const kit of [home, away, third]) expect(kit.manufacturer?.id).toBe("vertex");
      sponsors.add(home.sponsor!.id);
    }
    expect(sponsors).toEqual(new Set(["luna-air", "orbita-bank"]));
  });

  it("chooses legible colors for the galaticos set of seed 42", () => {
    const { home, away, third } = generateKitSet(branded, 42);
    expect(home.sponsor).toMatchObject({ color: "primary", outline: "secondary" });
    expect(home.manufacturer).toMatchObject({ color: "primary", outline: "secondary" });
    expect(away.sponsor).toEqual({ id: away.sponsor!.id, color: "primary" });
    expect(third.sponsor).toMatchObject({ color: "primary", outline: "secondary" });
    expect(third.manufacturer).toEqual({ id: "vertex", color: "primary" });
  });

  it("leaves out the logos the club does not configure", () => {
    for (const kit of Object.values(generateKitSet(identity, 1))) {
      expect(kit).not.toHaveProperty("badge");
      expect(kit).not.toHaveProperty("sponsor");
      expect(kit).not.toHaveProperty("manufacturer");
    }
  });

  it("marks the badge only when asked", () => {
    for (const kit of Object.values(generateKitSet(identity, 1, { badge: true }))) expect(kit.badge).toBe(true);
  });

  it("never picks a pool entry with zero weight", () => {
    const club = { ...branded, sponsors: { "luna-air": 0, "orbita-bank": 1 } };
    for (let seed = 0; seed < 30; seed++) expect(generateKitSet(club, seed).home.sponsor?.id).toBe("orbita-bank");
  });

  it("does not depend on the key order of a pool", () => {
    const forward = { ...branded, sponsors: { "luna-air": 1, "orbita-bank": 1 } };
    const backward = { ...branded, sponsors: { "orbita-bank": 1, "luna-air": 1 } };
    for (let seed = 0; seed < 30; seed++) expect(generateKitSet(backward, seed)).toEqual(generateKitSet(forward, seed));
  });

  it("rejects pools without a positive weight", () => {
    expect(() => generateKitSet({ ...branded, manufacturers: { vertex: 0 } }, 1)).toThrow(/no-asset-weight/);
  });
});

function setsDigest(club: ClubIdentity, badge: boolean): string {
  const sets = Array.from({ length: 30 }, (_, seed) => generateKitSet(club, seed, { badge }));
  return createHash("sha256").update(JSON.stringify(sets)).digest("hex");
}

// Guarda da Fase 3b: o clube sem categories (perfil classic) não pode mudar de kit para a mesma seed.
// O branded (categoria modern) muda de propósito quando a Fase 4a muda os pesos de gola e manga dos perfis; atualize o hash só nessas mudanças.
describe("generateKitSet Phase 3b baseline", () => {
  it("keeps the sets of a club with pattern weights and brands", () => {
    expect(setsDigest(branded, true)).toBe("8da3fe27c60340321d4eddef3086752f5b05ecb9b4564c8a04d1979f58ecec9a");
  });

  it("keeps the sets of a club without categories or pattern weights", () => {
    expect(setsDigest(parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } }), false)).toBe(
      "e69b9a924a8b3943500bf9730e543e41c7c6b6fca9fe0c95deff9d9907507eb5",
    );
  });
});

describe("generateKitSet traditions", () => {
  const traditional = (traditions: object): ClubIdentity => parseClubIdentity({ ...GALATICOS_CLUB, traditions });

  it("never picks a forbidden pattern", () => {
    const club = traditional({ forbiddenPatterns: ["sash"] });
    for (let seed = 0; seed < 200; seed++) {
      for (const kit of Object.values(generateKitSet(club, seed))) expect(kit.pattern.id).not.toBe("sash");
    }
  });

  it("picks the home pattern from its list, even when the weights leave it out", () => {
    const club = traditional({ patterns: { home: ["hoops", "pinstripes"] } });
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["hoops", "pinstripes"]));
  });

  it("keeps the other kit types on the club weights", () => {
    const club = traditional({ patterns: { home: ["hoops"] } });
    for (let seed = 0; seed < 50; seed++) {
      const withTradition = generateKitSet(club, seed);
      const plain = generateKitSet(identity, seed);
      expect(withTradition.away).toEqual(plain.away);
      expect(withTradition.third).toEqual(plain.third);
    }
  });

  it("generates the same kits as a club without traditions when traditions is empty", () => {
    const club = traditional({});
    for (let seed = 0; seed < 50; seed++) expect(generateKitSet(club, seed)).toEqual(generateKitSet(identity, seed));
  });

  it("rejects conflicting traditions before generating", () => {
    expect(() => generateKitSet(traditional({ forbiddenPatterns: ["hoops"], patterns: { home: ["hoops"] } }), 1)).toThrow(/tradition-conflict/);
  });

  it("shows the required color on every kit, changing only the collar", () => {
    const club = traditional({ requiredColor: "accent" });
    let changed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const withTradition = generateKitSet(club, seed);
      const plain = generateKitSet(identity, seed);
      for (const kitType of KIT_TYPES) {
        expect(visibleRoles(withTradition[kitType])).toContain("accent");
        expect({ ...withTradition[kitType], collar: plain[kitType].collar }).toEqual(plain[kitType]);
        if (withTradition[kitType].collar.color !== plain[kitType].collar.color) changed++;
      }
    }
    expect(changed).toBeGreaterThan(0);
  });

  it("leaves a kit alone when its base already is the required color", () => {
    const club = traditional({ requiredColor: "primary" });
    for (let seed = 0; seed < 50; seed++) expect(generateKitSet(club, seed).home).toEqual(generateKitSet(identity, seed).home);
  });
});
