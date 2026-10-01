import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSeed, runCli, USAGE } from "../../src/cli/run-cli.js";
import { parseKitDefinition } from "../../src/core/kit.js";
import { MAX_SEED } from "../../src/core/random.js";
import { GALATICOS_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

function captureIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  return { io: { log: (message: string) => void logs.push(message), error: (message: string) => void errors.push(message) }, logs, errors };
}

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "kitgen-cli-"));
}

async function galaticosClubsDir(): Promise<string> {
  return makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
}

describe("parseSeed", () => {
  it.each([["0", 0], ["42", 42], ["4294967295", MAX_SEED]])("parses %s", (value, expected) => {
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

describe("runCli generate", () => {
  it("saves the kit definition in the club folder and writes the named 2D PNG", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await tempDir()];
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--out", out], io)).toBe(0);
    const kit = parseKitDefinition(JSON.parse(await readFile(path.join(clubs, "galaticos-fc", "kits", "home", "kit.json"), "utf8")));
    expect(kit.clubId).toBe("galaticos-fc");
    const png = path.join(out, "galaticos-fc", "2d", "galaticos_fc_home_2d.png");
    expect(await sharp(png).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    expect(logs.join("\n")).toContain("seed 42");
  });

  it("keeps the versioned kit.json and logs the seed when the PNG cannot be written", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await tempDir()];
    const kitFile = path.join(clubs, "galaticos-fc", "kits", "home", "kit.json");
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    const before = await readFile(kitFile, "utf8");
    const blocker = path.join(await tempDir(), "not-a-dir");
    await writeFile(blocker, "");
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "2", "--clubs", clubs, "--out", blocker], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(await readFile(kitFile, "utf8")).toBe(before);
    expect(logs).toContain("Seed: 2");
  });

  it("is reproducible for the same seed", async () => {
    const [first, second] = [await galaticosClubsDir(), await galaticosClubsDir()];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", first, "--out", await tempDir()], captureIo().io);
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", second, "--out", await tempDir()], captureIo().io);
    const read = (dir: string) => readFile(path.join(dir, "galaticos-fc", "kits", "home", "kit.json"), "utf8");
    expect(await read(first)).toBe(await read(second));
  });

  it("rejects invalid seeds", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "abc", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toContain('Invalid seed "abc"');
  });

  it("reports unknown clubs", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "ghost", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toMatch(/Club "ghost" not found/);
  });

  it("requires --club", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate"], io)).toBe(1);
    expect(errors.join("\n")).toContain("Missing required option --club");
  });

  it("rejects unknown options", async () => {
    const { io } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--colour", "red"], io)).toBe(1);
  });
});

describe("runCli render", () => {
  it("renders a definition file without randomization", async () => {
    const dir = await tempDir();
    const definition = path.join(dir, "kit.json");
    const png = path.join(dir, "nested", "kit.png");
    await writeFile(definition, JSON.stringify(makeKit()));
    expect(await runCli(["render", "--definition", definition, "--out", png], captureIo().io)).toBe(0);
    expect(await sharp(png).metadata()).toMatchObject({ width: 414, height: 414 });
  });

  it("reports invalid definitions", async () => {
    const dir = await tempDir();
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify({ ...makeKit(), colors: { primary: "blue" } }));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png")], io)).toBe(1);
    expect(errors.join("\n")).toContain("Invalid kit definition");
  });
});

describe("runCli usage", () => {
  it.each([[[]], [["explode"]]])("prints usage for %j", async (argv) => {
    const { io, errors } = captureIo();
    expect(await runCli(argv, io)).toBe(1);
    expect(errors).toEqual([USAGE]);
  });
});
