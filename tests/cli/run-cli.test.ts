import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSeed, runCli, USAGE } from "../../src/cli/run-cli.js";
import { KIT_TYPES, parseKitDefinition, type KitType } from "../../src/core/kit.js";
import { deriveSeed, MAX_SEED } from "../../src/core/random.js";
import { GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
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
});

describe("runCli usage", () => {
  it.each([[[]], [["explode"]]])("prints usage for %j", async (argv) => {
    const { io, errors } = captureIo();
    expect(await runCli(argv, io)).toBe(1);
    expect(errors).toEqual([USAGE]);
  });
});
