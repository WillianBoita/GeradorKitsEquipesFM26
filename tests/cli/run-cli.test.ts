import { access, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSeed, runCli, USAGE } from "../../src/cli/run-cli.js";
import { KIT_TYPES, parseKitDefinition, resolveLogoColor, type KitType } from "../../src/core/kit.js";
import { deriveSeed, MAX_SEED } from "../../src/core/random.js";
import { makeAssetsDir, makeOpaquePng, writeClubLogo } from "../fixtures/assets.js";
import { GALATICOS_BRANDED_CLUB, GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
import { makeTempDir } from "../fixtures/temp.js";

function captureIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  return { io: { log: (message: string) => void logs.push(message), error: (message: string) => void errors.push(message) }, logs, errors };
}

async function galaticosClubsDir(): Promise<string> {
  return makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
}

function kitFile(clubs: string, clubId: string, kitType: KitType): string {
  return path.join(clubs, clubId, "kits", kitType, "kit.json");
}

function pngFile(out: string, clubId: string, kitType: KitType): string {
  return path.join(out, clubId, "2d", `${clubId.replaceAll("-", "_")}_${kitType}_2d.png`);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function pixelAt(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [...data.subarray(index, index + 4)];
}

function rgba(hex: string): number[] {
  return [...[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)), 255];
}

async function brandedSetup(withLogo = true): Promise<{ clubs: string; assets: string }> {
  const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_BRANDED_CLUB) });
  if (withLogo) await writeClubLogo(clubs, "galaticos-fc");
  return { clubs, assets: await makeAssetsDir() };
}

const GREEN = [0, 255, 0, 255];

describe("parseSeed", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["4294967295", MAX_SEED],
  ])("parses %s", (value, expected) => {
    expect(parseSeed(value)).toBe(expected);
  });

  it.each(["-1", "1.5", "abc", "4294967296", "", "1e3"])("rejects %j", (value) => {
    expect(() => parseSeed(value)).toThrow(`Invalid seed "${value}"`);
  });

  it("creates a valid random seed when omitted", () => {
    const seed = parseSeed(undefined);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(MAX_SEED);
  });
});

describe("runCli generate --club", () => {
  it("reports an unknown style category before generating anything", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_CLUB, style: { categories: ["Modern"] } }) });
    const { io, errors } = captureIo();
    const args = ["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")];
    expect(await runCli(args, io)).toBe(1);
    expect(errors[0]).toContain('unknown-style: style.categories references unknown style "Modern" (known: classic, traditional, modern, retro)');
    expect(await exists(kitFile(clubs, "galaticos-fc", "home"))).toBe(false);
  });

  it("saves home, away and third definitions and writes their named 2D PNGs", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await makeTempDir("cli")];
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--out", out], io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      const kit = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")));
      expect(kit).toMatchObject({ clubId: "galaticos-fc", kitType, generatedWith: { seed: 42 } });
      expect(await sharp(pngFile(out, "galaticos-fc", kitType)).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    }
    expect(logs[0]).toBe("Seed: 42 (galaticos-fc)");
    expect(logs).toContain("Generated Galáticos FC kits (seed 42)");
    expect(logs).toContain(`  away 2D: ${pngFile(out, "galaticos-fc", "away")}`);
  });

  it("generates only the requested type, identical to the same type in the full set", async () => {
    const [full, single] = [await galaticosClubsDir(), await galaticosClubsDir()];
    const out = await makeTempDir("cli");
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "9", "--clubs", full, "--out", await makeTempDir("cli")], captureIo().io);
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "9", "--type", "away", "--clubs", single, "--out", out], captureIo().io)).toBe(0);
    expect(await readFile(kitFile(single, "galaticos-fc", "away"), "utf8")).toBe(await readFile(kitFile(full, "galaticos-fc", "away"), "utf8"));
    expect(await exists(kitFile(single, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(pngFile(out, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(pngFile(out, "galaticos-fc", "away"))).toBe(true);
  });

  it("keeps every versioned kit.json and logs the seed when a PNG cannot be written", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await makeTempDir("cli")];
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    const before = await Promise.all(KIT_TYPES.map((kitType) => readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")));
    const blocker = path.join(await makeTempDir("cli"), "not-a-dir");
    await writeFile(blocker, "");
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "2", "--clubs", clubs, "--out", blocker], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(await Promise.all(KIT_TYPES.map((kitType) => readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")))).toEqual(before);
    expect(logs).toContain("Seed: 2 (galaticos-fc)");
  });

  it("is reproducible byte for byte for the same seed", async () => {
    const [first, second] = [await galaticosClubsDir(), await galaticosClubsDir()];
    const [firstOut, secondOut] = [await makeTempDir("cli"), await makeTempDir("cli")];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", first, "--out", firstOut], captureIo().io);
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", second, "--out", secondOut], captureIo().io);
    for (const kitType of KIT_TYPES) {
      expect(await readFile(kitFile(second, "galaticos-fc", kitType), "utf8")).toBe(await readFile(kitFile(first, "galaticos-fc", kitType), "utf8"));
      expect((await readFile(pngFile(secondOut, "galaticos-fc", kitType))).equals(await readFile(pngFile(firstOut, "galaticos-fc", kitType)))).toBe(true);
    }
  });

  it.each(["0", "4294967295"])("accepts the boundary seed %s", async (seed) => {
    const { io, logs } = captureIo();
    expect(
      await runCli(["generate", "--club", "galaticos-fc", "--seed", seed, "--clubs", await galaticosClubsDir(), "--out", await makeTempDir("cli")], io),
    ).toBe(0);
    expect(logs[0]).toBe(`Seed: ${seed} (galaticos-fc)`);
  });

  it.each([["--seed", "abc"], ["--seed=-1"], ["--seed", "4294967296"]])("rejects invalid seeds (%s %s)", async (...seedArgs) => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", ...seedArgs, "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toMatch(/Invalid seed/);
  });

  it("rejects unknown kit types", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--type", "fourth", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toContain("Invalid kit type");
  });

  it("reports clubs that fail validation", async () => {
    const clash = { ...GALATICOS_CLUB, palette: { primary: "#123456", secondary: "#1a3d66" } };
    const { io, errors } = captureIo();
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(clash) });
    expect(await runCli(["generate", "--club", "galaticos-fc", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors.join("\n")).toContain('Club "galaticos-fc" is invalid:\n  - distinct-colors: primary #123456 and secondary #1a3d66');
  });

  it("reports unknown clubs", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "ghost", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toMatch(/Club "ghost" not found/);
  });

  it("requires --club or --all, but not both", async () => {
    const missing = captureIo();
    expect(await runCli(["generate"], missing.io)).toBe(1);
    expect(missing.errors.join("\n")).toContain("Missing required option --club or --all");
    const both = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--all"], both.io)).toBe(1);
    expect(both.errors.join("\n")).toContain("Use either --club or --all, not both");
  });

  it("rejects unknown options", async () => {
    const { io } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--colour", "red"], io)).toBe(1);
  });
});

describe("runCli generate --all", () => {
  it("generates every club and logs one seed per club", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(0);
    for (const clubId of ["galaticos-fc", "kong-team"]) {
      for (const kitType of KIT_TYPES) expect(await exists(kitFile(clubs, clubId, kitType))).toBe(true);
      expect(logs.some((line) => new RegExp(`^Seed: \\d+ \\(${clubId}\\)$`).test(line))).toBe(true);
    }
    expect(logs.at(-1)).toBe("Generated 2 of 2 clubs");
  });

  it("derives a reproducible seed per club from --seed", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--all", "--seed", "42", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(0);
    const kongSeed = deriveSeed(42, "kong-team");
    expect(logs).toContain(`Seed: ${kongSeed} (kong-team)`);
    const single = await makeClubsDir({ "kong-team": JSON.stringify(KONG_CLUB) });
    await runCli(["generate", "--club", "kong-team", "--seed", String(kongSeed), "--clubs", single, "--out", await makeTempDir("cli")], captureIo().io);
    expect(await readFile(kitFile(single, "kong-team", "third"), "utf8")).toBe(await readFile(kitFile(clubs, "kong-team", "third"), "utf8"));
  });

  it("keeps going when one club fails and exits with 1", async () => {
    const clubs = await makeClubsDir({ broken: "{ not json", "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[broken\] Invalid JSON in/);
    expect(await exists(kitFile(clubs, "kong-team", "home"))).toBe(true);
    expect(logs.at(-1)).toBe("Generated 1 of 2 clubs");
  });

  it("reports folders whose name is not a valid club id", async () => {
    const clubs = await makeClubsDir({ "Old Club": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--seed", "1", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[Old Club\] Invalid club id/);
    expect(await exists(kitFile(clubs, "kong-team", "away"))).toBe(true);
  });

  it("reports an empty clubs directory", async () => {
    const clubs = await makeClubsDir({});
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(errors).toEqual([`Error: No clubs found in ${clubs}`]);
  });
});

describe("runCli generate with logos", () => {
  it("saves the logos in every kit.json and draws them on the PNGs", async () => {
    const { clubs, assets } = await brandedSetup();
    const out = await makeTempDir("cli");
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", out], captureIo().io)).toBe(0);
    const kits = await Promise.all(
      KIT_TYPES.map(async (kitType) => parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")))),
    );
    for (const kit of kits) {
      expect(kit.badge).toBe(true);
      expect(kit.sponsor?.id).toBe(kits[0]!.sponsor?.id);
      expect(kit.manufacturer?.id).toBe("vertex");
      const png = await readFile(pngFile(out, "galaticos-fc", kit.kitType));
      expect(await pixelAt(png, 250, 120)).toEqual(GREEN);
      expect(await pixelAt(png, 164, 120)).toEqual(rgba(resolveLogoColor(kit, kit.manufacturer!.color)));
    }
  });

  it("generates kits without a badge when the club has no logo.png", async () => {
    const { clubs, assets } = await brandedSetup(false);
    expect(
      await runCli(
        ["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")],
        captureIo().io,
      ),
    ).toBe(0);
    const kit = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "home"), "utf8")));
    expect(kit).not.toHaveProperty("badge");
    expect(kit.sponsor).toBeDefined();
  });

  it("rejects clubs whose pools reference unregistered assets", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, sponsors: { acme: 1 } }) });
    const { io, errors } = captureIo();
    expect(
      await runCli(["generate", "--club", "galaticos-fc", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")], io),
    ).toBe(1);
    expect(errors.join("\n")).toContain(
      'Club "galaticos-fc" is invalid:\n  - unknown-asset: sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)',
    );
  });

  it("keeps generating the other clubs when one references an unregistered asset", async () => {
    const clubs = await makeClubsDir({
      "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, manufacturers: { kong: 1 } }),
      "kong-team": JSON.stringify(KONG_CLUB),
    });
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[galaticos-fc\] Club "galaticos-fc" is invalid:/);
    expect(await exists(kitFile(clubs, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(kitFile(clubs, "kong-team", "home"))).toBe(true);
    expect(logs.at(-1)).toBe("Generated 1 of 2 clubs");
  });

  it("writes no kit.json when a registered logo file is missing", async () => {
    const { clubs, assets } = await brandedSetup();
    const missing = path.join(assets, "manufacturers", "vertex.png");
    await rm(missing);
    const { io, errors } = captureIo();
    expect(
      await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")], io),
    ).toBe(1);
    expect(errors.join("\n")).toContain(`Manufacturer "vertex" file not found: ${missing}`);
    for (const kitType of KIT_TYPES) expect(await exists(kitFile(clubs, "galaticos-fc", kitType))).toBe(false);
  });

  it("reports a missing asset registry", async () => {
    const assets = await makeTempDir("assets");
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir(), "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`Error: Asset registry not found: ${path.join(assets, "registry.json")}`]);
  });

  it("is reproducible byte for byte with logos", async () => {
    const [first, second] = [await brandedSetup(), await brandedSetup()];
    const [firstOut, secondOut] = [await makeTempDir("cli"), await makeTempDir("cli")];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", first.clubs, "--assets", first.assets, "--out", firstOut], captureIo().io);
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", second.clubs, "--assets", second.assets, "--out", secondOut], captureIo().io);
    for (const kitType of KIT_TYPES) {
      expect(await readFile(kitFile(second.clubs, "galaticos-fc", kitType), "utf8")).toBe(
        await readFile(kitFile(first.clubs, "galaticos-fc", kitType), "utf8"),
      );
      expect((await readFile(pngFile(secondOut, "galaticos-fc", kitType))).equals(await readFile(pngFile(firstOut, "galaticos-fc", kitType)))).toBe(true);
    }
  });
});

describe("runCli render", () => {
  it("renders a definition file without randomization", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    const png = path.join(dir, "nested", "kit.png");
    await writeFile(definition, JSON.stringify(makeKit()));
    expect(await runCli(["render", "--definition", definition, "--out", png], captureIo().io)).toBe(0);
    expect(await sharp(png).metadata()).toMatchObject({ width: 414, height: 414 });
  });

  it("reports invalid definitions", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify({ ...makeKit(), colors: { primary: "blue" } }));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png")], io)).toBe(1);
    expect(errors.join("\n")).toContain("Invalid kit definition");
  });

  it("names the file when a Phase 1 definition without kitType is rendered", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    const { kitType: _ignored, ...phaseOneKit } = makeKit();
    await writeFile(definition, JSON.stringify(phaseOneKit));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png")], io)).toBe(1);
    expect(errors.join("\n")).toContain(`Invalid kit definition in ${definition}`);
    expect(errors.join("\n")).toContain("kitType");
  });

  it("renders the logos of a definition, with the badge from --clubs and the files from --assets", async () => {
    const { clubs, assets } = await brandedSetup();
    const dir = await makeTempDir("cli");
    const [definition, png] = [path.join(dir, "kit.json"), path.join(dir, "kit.png")];
    await writeFile(definition, JSON.stringify(makeKit({ badge: true, manufacturer: { id: "vertex", color: "#000000" } })));
    expect(await runCli(["render", "--definition", definition, "--out", png, "--clubs", clubs, "--assets", assets], captureIo().io)).toBe(0);
    expect(await pixelAt(await readFile(png), 250, 120)).toEqual(GREEN);
    expect(await pixelAt(await readFile(png), 164, 120)).toEqual([0, 0, 0, 255]);
  });

  it("names the missing badge when rendering", async () => {
    const { clubs, assets } = await brandedSetup(false);
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify(makeKit({ badge: true })));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png"), "--clubs", clubs, "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`Error: Club "galaticos-fc" badge not found: ${path.join(clubs, "galaticos-fc", "logo.png")}`]);
  });
});

describe("runCli validate", () => {
  async function generatedClubsDir(): Promise<string> {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    await runCli(["generate", "--all", "--seed", "3", "--clubs", clubs, "--out", await makeTempDir("cli")], captureIo().io);
    return clubs;
  }

  it("accepts freshly generated clubs", async () => {
    const { io, logs, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", await generatedClubsDir()], io)).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (3 kits)", "OK kong-team (3 kits)"]);
    expect(errors).toEqual([]);
  });

  it("accepts a valid club without kits", async () => {
    const { io, logs } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir()], io)).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (0 kits)"]);
  });

  it("reports every problem of a hand-edited kit set", async () => {
    const clubs = await generatedClubsDir();
    const away = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "away"), "utf8")));
    const clashing = { ...away, pattern: { ...away.pattern, base: "primary", overlay: "primary" } };
    await writeFile(kitFile(clubs, "galaticos-fc", "away"), JSON.stringify(clashing));
    const { io, logs, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(logs).toEqual(["OK kong-team (3 kits)"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("FAIL galaticos-fc\n");
    expect(errors[0]).toContain("  - pattern-contrast: away kit uses primary as both pattern base and overlay");
    expect(errors[0]).toContain("  - kit-clash: home base #123456 and away base #123456");
  });

  it("reports unreadable club and kit files as invalid-file", async () => {
    const clubs = await generatedClubsDir();
    await writeFile(kitFile(clubs, "galaticos-fc", "third"), JSON.stringify(makeKit({ kitType: "home" })));
    await writeFile(path.join(clubs, "kong-team", "club.json"), "{ not json");
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(errors[0]).toMatch(/^FAIL galaticos-fc\n  - invalid-file: .*declares kitType "home", expected "third"/);
    expect(errors[1]).toMatch(/^FAIL kong-team\n  - invalid-file: Invalid JSON in/);
  });

  it("reports club rules", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: { zigzag: 1 } } }) });
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", clubs], io)).toBe(1);
    expect(errors[0]).toContain('  - unknown-pattern: style.patternWeights references unknown pattern "zigzag"');
    expect(errors[0]).toContain("  - no-pattern-weight:");
  });

  it("requires --club or --all", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["validate"], io)).toBe(1);
    expect(errors).toEqual(["Error: Missing required option --club or --all"]);
  });

  async function generatedBrandedSetup(): Promise<{ clubs: string; assets: string }> {
    const setup = await brandedSetup();
    await runCli(["generate", "--all", "--seed", "3", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], captureIo().io);
    return setup;
  }

  async function validateBranded(setup: { clubs: string; assets: string }) {
    const capture = captureIo();
    const code = await runCli(["validate", "--club", "galaticos-fc", "--clubs", setup.clubs, "--assets", setup.assets], capture.io);
    return { code, ...capture };
  }

  async function readHome(clubs: string) {
    return parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "home"), "utf8")));
  }

  it("accepts freshly generated clubs with logos", async () => {
    const { code, logs, errors } = await validateBranded(await generatedBrandedSetup());
    expect(code).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (3 kits)"]);
    expect(errors).toEqual([]);
  });

  it("reports unregistered ids in the club and in a hand-edited kit", async () => {
    const setup = await generatedBrandedSetup();
    await writeFile(path.join(setup.clubs, "galaticos-fc", "club.json"), JSON.stringify({ ...GALATICOS_BRANDED_CLUB, sponsors: { acme: 1 } }));
    const home = await readHome(setup.clubs);
    await writeFile(kitFile(setup.clubs, "galaticos-fc", "home"), JSON.stringify({ ...home, manufacturer: { ...home.manufacturer, id: "kong" } }));
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain('  - unknown-asset: sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)');
    expect(errors[0]).toContain('  - unknown-asset: home kit references unknown manufacturer "kong" (known: vertex)');
  });

  it("reports missing, opaque and broken logo files", async () => {
    const setup = await generatedBrandedSetup();
    await rm(path.join(setup.clubs, "galaticos-fc", "logo.png"));
    await rm(path.join(setup.assets, "manufacturers", "vertex.png"));
    await writeFile(path.join(setup.assets, "sponsors", "orbita-bank.png"), await makeOpaquePng(60, 20));
    await writeFile(path.join(setup.assets, "sponsors", "luna-air.svg"), "not an image");
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain(`  - missing-asset: club badge not found: ${path.join(setup.clubs, "galaticos-fc", "logo.png")}`);
    expect(errors[0]).toContain(`  - missing-asset: manufacturer "vertex" file not found: ${path.join(setup.assets, "manufacturers", "vertex.png")}`);
    expect(errors[0]).toContain('  - opaque-logo: sponsor "orbita-bank" (sponsors/orbita-bank.png) has no transparent pixels');
    expect(errors[0]).toContain('  - invalid-file: sponsor "luna-air" (sponsors/luna-air.svg) is not a valid image');
  });

  it("reports a hand-edited logo color without contrast", async () => {
    const setup = await generatedBrandedSetup();
    const home = await readHome(setup.clubs);
    const edited = {
      ...home,
      pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} },
      sponsor: { id: home.sponsor!.id, color: "primary" },
    };
    await writeFile(kitFile(setup.clubs, "galaticos-fc", "home"), JSON.stringify(edited));
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain("  - logo-contrast: home kit sponsor #123456 has contrast 1.00 against primary #123456 (minimum 3)");
  });

  it("fails every club when the asset registry is missing", async () => {
    const assets = await makeTempDir("assets");
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir(), "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`FAIL galaticos-fc\n  - invalid-file: Asset registry not found: ${path.join(assets, "registry.json")}`]);
  });
});

describe("runCli export", () => {
  // Clube com fmUniqueId e os três kits gerados pela seed 42; devolve também a pasta dos previews do generate.
  async function exportableClubs(club: object = { ...GALATICOS_CLUB, fmUniqueId: "1" }, assets?: string): Promise<{ clubs: string; preview: string }> {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(club) });
    const preview = await makeTempDir("cli");
    const assetArgs = assets === undefined ? [] : ["--assets", assets];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--out", preview, ...assetArgs], captureIo().io);
    return { clubs, preview };
  }

  async function exportDir(): Promise<string> {
    return path.join(await makeTempDir("cli"), "fm26_export");
  }

  it("writes the 2D PNGs and config.xml of every club into one folder", async () => {
    const { clubs } = await exportableClubs();
    const out = await exportDir();
    const { io, logs, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      expect(await sharp(path.join(out, `galaticos_fc_${kitType}_2d.png`)).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    }
    const xml = await readFile(path.join(out, "config.xml"), "utf8");
    expect(xml).toContain('<record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>');
    expect(logs).toEqual(["Exported Galáticos FC: home, away, third", `Wrote 3 records to ${path.join(out, "config.xml")}`]);
    expect(errors).toEqual([]);
  });

  it("exports the same PNG the generate preview shows", async () => {
    const { clubs, preview } = await exportableClubs();
    const out = await exportDir();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      expect((await readFile(path.join(out, `galaticos_fc_${kitType}_2d.png`))).equals(await readFile(pngFile(preview, "galaticos-fc", kitType)))).toBe(true);
    }
  });

  it("aborts without writing anything when a club has no fmUniqueId", async () => {
    const { clubs } = await exportableClubs(GALATICOS_CLUB);
    const out = await exportDir();
    const { io, logs, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(1);
    expect(errors).toEqual([
      'Error: [galaticos-fc] Club cannot be exported:\n  - missing-fm-unique-id: Club "galaticos-fc" has no fmUniqueId',
      "Error: Export aborted, nothing was written (1 of 1 clubs failed)",
    ]);
    expect(logs).toEqual([]);
    expect(await exists(out)).toBe(false);
  });

  it("reports a badge deleted after generate as a render failure with its path", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, fmUniqueId: "1" }) });
    const assets = await makeAssetsDir();
    await writeClubLogo(clubs, "galaticos-fc");
    await runCli(
      ["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")],
      captureIo().io,
    );
    const logo = path.join(clubs, "galaticos-fc", "logo.png");
    await unlink(logo);
    const out = await exportDir();
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--assets", assets, "--out", out], io)).toBe(1);
    expect(errors[0]).toContain(`  - render-failed: home 2d: Club "galaticos-fc" badge not found: ${logo}`);
    expect(errors.at(-1)).toBe("Error: Export aborted, nothing was written (1 of 1 clubs failed)");
    expect(await exists(out)).toBe(false);
  });

  it("reports an --out that is a file", async () => {
    const { clubs } = await exportableClubs();
    const out = path.join(await makeTempDir("cli"), "not-a-dir");
    await writeFile(out, "");
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: EEXIST/);
  });

  it("reports an empty clubs folder", async () => {
    const clubs = await makeClubsDir({});
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", await exportDir()], io)).toBe(1);
    expect(errors).toEqual([`Error: No clubs found in ${clubs}`]);
  });
});

describe("runCli preview", () => {
  async function generatedSetup(): Promise<{ clubs: string; assets: string }> {
    const setup = await brandedSetup();
    await runCli(["generate", "--all", "--seed", "3", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], captureIo().io);
    return setup;
  }

  async function preview(setup: { clubs: string; assets: string }, ...extra: string[]) {
    const out = path.join(await makeTempDir("cli"), "preview.html");
    const capture = captureIo();
    const code = await runCli(["preview", "--clubs", setup.clubs, "--assets", setup.assets, "--out", out, ...extra], capture.io);
    return { code, out, ...capture };
  }

  function imageCount(html: string): number {
    return html.match(/<img src="data:image\/png;base64,/g)?.length ?? 0;
  }

  it("writes the saved kits of every club into one HTML file", async () => {
    const { code, out, logs, errors } = await preview(await generatedSetup());
    expect(code).toBe(0);
    const html = await readFile(out, "utf8");
    expect(imageCount(html)).toBe(3);
    expect(html).toContain("<h2>Galáticos FC (galaticos-fc)</h2>");
    expect(html).toContain(`seed ${deriveSeed(3, "galaticos-fc")}`);
    expect(logs).toEqual([`Wrote ${out} (3 kits)`]);
    expect(errors).toEqual([]);
  });

  it("omits kit types that were never saved", async () => {
    const setup = await generatedSetup();
    await rm(kitFile(setup.clubs, "galaticos-fc", "third"));
    const { code, out, errors } = await preview(setup);
    expect(code).toBe(0);
    expect(imageCount(await readFile(out, "utf8"))).toBe(2);
    expect(errors).toEqual([]);
  });

  it("skips a broken club, keeps the others and exits with 1", async () => {
    const setup = await generatedSetup();
    await mkdir(path.join(setup.clubs, "kong-team"));
    await writeFile(path.join(setup.clubs, "kong-team", "club.json"), "{ not json");
    const { code, out, errors } = await preview(setup);
    expect(code).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[kong-team\] Invalid JSON in/);
    expect(imageCount(await readFile(out, "utf8"))).toBe(3);
  });

  it("generates seed samples of one club without saving any kit", async () => {
    const setup = await brandedSetup();
    const { code, out, logs } = await preview(setup, "--club", "galaticos-fc", "--samples", "3");
    expect(code).toBe(0);
    const html = await readFile(out, "utf8");
    expect(imageCount(html)).toBe(9);
    for (const seed of [0, 1, 2]) expect(html).toContain(`<h2>Seed ${seed}</h2>`);
    expect(logs).toEqual([`Wrote ${out} (9 kits)`]);
    for (const kitType of KIT_TYPES) expect(await exists(kitFile(setup.clubs, "galaticos-fc", kitType))).toBe(false);
  });

  it("aborts without writing when the single club fails", async () => {
    const { code, out, errors } = await preview(await brandedSetup(), "--club", "nope");
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/^Error: Club "nope" not found/);
    expect(await exists(out)).toBe(false);
  });

  const INVALID_OPTIONS: [string[], string][] = [
    [["--samples", "3"], "Error: --samples requires --club"],
    [["--club", "galaticos-fc", "--samples", "0"], 'Error: Invalid samples "0": expected an integer between 1 and 100'],
    [["--club", "galaticos-fc", "--samples", "101"], 'Error: Invalid samples "101": expected an integer between 1 and 100'],
    [["--club", "galaticos-fc", "--samples", "abc"], 'Error: Invalid samples "abc": expected an integer between 1 and 100'],
  ];

  it.each(INVALID_OPTIONS)("rejects %j", async (extra, message) => {
    const { code, out, errors } = await preview(await brandedSetup(), ...extra);
    expect(code).toBe(1);
    expect(errors).toEqual([message]);
    expect(await exists(out)).toBe(false);
  });

  it("reports an --out that is a directory", async () => {
    const setup = await generatedSetup();
    const { io, errors } = captureIo();
    expect(await runCli(["preview", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: EISDIR/);
  });
});

describe("runCli usage", () => {
  it.each([[[]], [["explode"]]])("prints usage for %j", async (argv) => {
    const { io, errors } = captureIo();
    expect(await runCli(argv, io)).toBe(1);
    expect(errors).toEqual([USAGE]);
  });

  it("documents the export command", () => {
    expect(USAGE).toContain("kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]");
  });

  it("documents the preview command", () => {
    expect(USAGE).toContain("kit-generator preview [--club <id> [--samples <n>]] [--out <file>] [--clubs <dir>] [--assets <dir>]");
  });
});
