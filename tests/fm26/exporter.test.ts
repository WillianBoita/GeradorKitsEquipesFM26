import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { KIT_TYPES, type KitType } from "../../src/core/kit.js";
import { buildConfigXml } from "../../src/fm26/config-xml.js";
import {
  checkRenderedPng,
  duplicateFmTeamIdIssues,
  ExportAbortedError,
  exportKits,
  FM26_RENDER_SIZES,
  validateExportClub,
  type RenderKit,
} from "../../src/fm26/exporter.js";
import type { RenderType } from "../../src/fm26/naming.js";
import { kitDefinitionPath, saveKit } from "../../src/io/club-repository.js";
import { GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
import { makeTempDir } from "../fixtures/temp.js";

// fmRandomId diferente de zero: o `to` só bate se o exporter usar o ID de time (2 × 4294967296 + fmUniqueId), não o fmUniqueId puro.
const GALATICOS_EXPORT = { ...GALATICOS_CLUB, fmUniqueId: "1", fmRandomId: "2" };
const KONG_EXPORT = { ...KONG_CLUB, fmUniqueId: "2", fmRandomId: "2" };
const GALATICOS_TEAM_ID = "8589934593";
const KONG_TEAM_ID = "8589934594";

function club(input: object): ClubIdentity {
  return parseClubIdentity(input);
}

async function solidPng(width: number, height = width): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: "#123456" } })
    .png()
    .toBuffer();
}

describe("FM26_RENDER_SIZES", () => {
  it("matches the FM26 2D and 3D resolutions", () => {
    expect(FM26_RENDER_SIZES).toEqual({ "2d": 414, "3d": 1024 });
  });
});

describe("validateExportClub", () => {
  it("accepts a club with fmUniqueId, fmRandomId, home and away", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["home", "away"], "/clubs")).toEqual([]);
  });

  it("requires the fmUniqueId and the fmRandomId", () => {
    expect(validateExportClub(club(GALATICOS_CLUB), ["home", "away", "third"], "/clubs")).toEqual([
      { rule: "missing-fm-unique-id", message: 'Club "galaticos-fc" has no fmUniqueId' },
      { rule: "missing-fm-random-id", message: 'Club "galaticos-fc" has no fmRandomId' },
    ]);
  });

  it("accepts an explicit fmRandomId of 0", () => {
    expect(validateExportClub(club({ ...GALATICOS_EXPORT, fmRandomId: "0" }), ["home", "away"], "/clubs")).toEqual([]);
  });

  it("names the expected kit.json of every missing required kit", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["third"], "/clubs")).toEqual([
      { rule: "missing-kit", message: `Club "galaticos-fc" has no home kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "home", "kit.json")})` },
      { rule: "missing-kit", message: `Club "galaticos-fc" has no away kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "away", "kit.json")})` },
    ]);
  });
});

describe("duplicateFmTeamIdIssues", () => {
  it("is empty when every team id is unique or incomplete", () => {
    const incomplete = [club({ ...KONG_CLUB, id: "no-id" }), club({ ...GALATICOS_CLUB, id: "no-random", fmUniqueId: "1" })];
    expect(duplicateFmTeamIdIssues([club(GALATICOS_EXPORT), club(KONG_EXPORT), ...incomplete]).size).toBe(0);
  });

  it("flags every club that shares a team id, naming the editor ids and the others", () => {
    const issues = duplicateFmTeamIdIssues([club(GALATICOS_EXPORT), club({ ...KONG_EXPORT, fmUniqueId: "1" }), club({ ...KONG_EXPORT, id: "fnaf" })]);
    const message = (other: string) => `fmTeamId "${GALATICOS_TEAM_ID}" (fmRandomId "2", fmUniqueId "1") is also used by club "${other}"`;
    expect(Object.fromEntries(issues)).toEqual({
      "galaticos-fc": [{ rule: "duplicate-fm-team-id", message: message("kong-team") }],
      "kong-team": [{ rule: "duplicate-fm-team-id", message: message("galaticos-fc") }],
    });
  });

  it("accepts clubs that share the fmUniqueId but not the fmRandomId", () => {
    expect(duplicateFmTeamIdIssues([club(GALATICOS_EXPORT), club({ ...KONG_EXPORT, fmUniqueId: "1", fmRandomId: "3" })]).size).toBe(0);
  });

  it("lists every other club when three share a team id", () => {
    const issues = duplicateFmTeamIdIssues([
      club(GALATICOS_EXPORT),
      club({ ...KONG_EXPORT, fmUniqueId: "1" }),
      club({ ...KONG_EXPORT, id: "fnaf", fmUniqueId: "1" }),
    ]);
    expect(issues.get("fnaf")).toEqual([
      {
        rule: "duplicate-fm-team-id",
        message: `fmTeamId "${GALATICOS_TEAM_ID}" (fmRandomId "2", fmUniqueId "1") is also used by club "galaticos-fc", "kong-team"`,
      },
    ]);
  });
});

describe("checkRenderedPng", () => {
  it("accepts a PNG with the FM26 size of its render type", async () => {
    expect(await checkRenderedPng(await solidPng(414), "home", "2d")).toBeUndefined();
    expect(await checkRenderedPng(await solidPng(1024), "away", "3d")).toBeUndefined();
  });

  it("flags a PNG with the wrong size", async () => {
    expect(await checkRenderedPng(await solidPng(400), "home", "2d")).toEqual({
      rule: "invalid-render",
      message: "home 2d render is 400×400, expected 414×414",
    });
    expect(await checkRenderedPng(await solidPng(414, 300), "third", "2d")).toEqual({
      rule: "invalid-render",
      message: "third 2d render is 414×300, expected 414×414",
    });
  });

  it("flags an image that is not a PNG", async () => {
    const jpeg = await sharp({ create: { width: 414, height: 414, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toBuffer();
    expect(await checkRenderedPng(jpeg, "away", "2d")).toEqual({ rule: "invalid-render", message: "away 2d render is jpeg, expected png" });
  });

  it("flags bytes that are not an image", async () => {
    expect(await checkRenderedPng(Buffer.from("nope"), "home", "2d")).toEqual({ rule: "invalid-render", message: "home 2d render is not an image" });
  });
});

function fakeRenderer(sizes: Partial<Record<RenderType, number>> = {}): { renderKit: RenderKit; calls: string[] } {
  const calls: string[] = [];
  const renderKit: RenderKit = async (kit, renderType) => {
    calls.push(`${kit.clubId} ${kit.kitType} ${renderType}`);
    return solidPng(sizes[renderType] ?? FM26_RENDER_SIZES[renderType]);
  };
  return { renderKit, calls };
}

// Cada clube recebe os kits pedidos (padrão: os três), salvos como o generate salvaria.
async function clubsWithKits(clubs: Record<string, object>, kitTypes: Record<string, readonly KitType[]> = {}): Promise<string> {
  const dir = await makeClubsDir(Object.fromEntries(Object.entries(clubs).map(([id, content]) => [id, JSON.stringify(content)])));
  for (const id of Object.keys(clubs)) {
    for (const kitType of kitTypes[id] ?? KIT_TYPES) await saveKit(makeKit({ clubId: id, kitType }), dir);
  }
  return dir;
}

// A pasta de saída ainda não existe: um export abortado não pode criá-la.
async function outputDir(): Promise<string> {
  return path.join(await makeTempDir("export"), "fm26_export");
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

async function expectAbort(promise: Promise<unknown>): Promise<ExportAbortedError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ExportAbortedError);
  return error as ExportAbortedError;
}

function record(clubSlug: string, teamId: string, kitType: KitType, renderType: RenderType = "2d") {
  return {
    from: `${clubSlug}_${kitType}_${renderType}`,
    to: `graphics/pictures/team/${teamId}/${renderType === "2d" ? "kits" : "kit_textures"}/${kitType}`,
  };
}

describe("exportKits", () => {
  it("writes every 2D PNG and one config.xml into a flat folder", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    const result = await exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit });
    expect((await readdir(outDir)).sort()).toEqual(["config.xml", "galaticos_fc_away_2d.png", "galaticos_fc_home_2d.png", "galaticos_fc_third_2d.png"]);
    expect(await sharp(path.join(outDir, "galaticos_fc_home_2d.png")).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(
      buildConfigXml(KIT_TYPES.map((kitType) => record("galaticos_fc", GALATICOS_TEAM_ID, kitType))),
    );
    expect(result).toEqual({
      clubs: [{ club: parseClubIdentity(GALATICOS_EXPORT), kitTypes: ["home", "away", "third"] }],
      configFile: path.join(outDir, "config.xml"),
      recordCount: 3,
    });
  });

  it("exports two records when the third kit is absent", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": ["home", "away"] });
    const outDir = await outputDir();
    const result = await exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit });
    expect(result.recordCount).toBe(2);
    expect(result.clubs[0]?.kitTypes).toEqual(["home", "away"]);
    expect(await exists(path.join(outDir, "galaticos_fc_third_2d.png"))).toBe(false);
  });

  it("orders records by club id, then render type, then kit type", async () => {
    const clubsDir = await clubsWithKits({ "kong-team": KONG_EXPORT, "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    await exportKits({ clubsDir, outDir, renderTypes: ["2d", "3d"], renderKit: fakeRenderer().renderKit });
    const expected = [
      ...(["2d", "3d"] as const).flatMap((renderType) => KIT_TYPES.map((kitType) => record("galaticos_fc", GALATICOS_TEAM_ID, kitType, renderType))),
      ...(["2d", "3d"] as const).flatMap((renderType) => KIT_TYPES.map((kitType) => record("kong_team", KONG_TEAM_ID, kitType, renderType))),
    ];
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(buildConfigXml(expected));
    expect(await sharp(path.join(outDir, "kong_team_away_3d.png")).metadata()).toMatchObject({ width: 1024, height: 1024 });
  });

  it("aborts without writing anything when a club has no fmUniqueId", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": { ...GALATICOS_CLUB, fmRandomId: "2" } });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.message).toBe("Export aborted, nothing was written (1 of 1 clubs failed)");
    expect(error.failures).toEqual([{ clubId: "galaticos-fc", issues: [{ rule: "missing-fm-unique-id", message: 'Club "galaticos-fc" has no fmUniqueId' }] }]);
    expect(error.clubCount).toBe(1);
    expect(await exists(outDir)).toBe(false);
  });

  it("aborts without writing anything when a club has no fmRandomId", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": { ...GALATICOS_CLUB, fmUniqueId: "1" } });
    const outDir = await outputDir();
    const renderer = fakeRenderer();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: renderer.renderKit }));
    expect(error.failures).toEqual([{ clubId: "galaticos-fc", issues: [{ rule: "missing-fm-random-id", message: 'Club "galaticos-fc" has no fmRandomId' }] }]);
    expect(renderer.calls).toEqual([]);
    expect(await exists(outDir)).toBe(false);
  });

  it("lists both missing required kits of a club that was never generated", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": [] });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures[0]?.issues).toEqual([
      { rule: "missing-kit", message: `Club "galaticos-fc" has no home kit (expected ${kitDefinitionPath("galaticos-fc", "home", clubsDir)})` },
      { rule: "missing-kit", message: `Club "galaticos-fc" has no away kit (expected ${kitDefinitionPath("galaticos-fc", "away", clubsDir)})` },
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("reports an unreadable kit.json once, as invalid-file", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    await writeFile(kitDefinitionPath("galaticos-fc", "away", clubsDir), "{ not json");
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    const issues = error.failures[0]?.issues ?? [];
    expect(issues.map((issue) => issue.rule)).toEqual(["invalid-file"]);
    expect(issues[0]?.message).toContain(kitDefinitionPath("galaticos-fc", "away", clubsDir));
    expect(await exists(outDir)).toBe(false);
  });

  it("reports an unreadable club.json as invalid-file", async () => {
    const clubsDir = await makeClubsDir({ "galaticos-fc": "{ not json" });
    const error = await expectAbort(exportKits({ clubsDir, outDir: await outputDir(), renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures[0]?.issues.map((issue) => issue.rule)).toEqual(["invalid-file"]);
  });

  it("rejects two clubs with the same team id", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT, "kong-team": { ...KONG_EXPORT, fmUniqueId: "1" } });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures.map((failure) => [failure.clubId, failure.issues.map((issue) => issue.rule)])).toEqual([
      ["galaticos-fc", ["duplicate-fm-team-id"]],
      ["kong-team", ["duplicate-fm-team-id"]],
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("turns a renderer exception into render-failed", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const renderKit: RenderKit = async (kit) => {
      if (kit.kitType === "away") throw new Error("Sponsor file missing");
      return solidPng(414);
    };
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit }));
    expect(error.failures[0]?.issues).toEqual([{ rule: "render-failed", message: "away 2d: Sponsor file missing" }]);
    expect(await exists(outDir)).toBe(false);
  });

  it("rejects a render with the wrong size", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": ["home", "away"] });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer({ "2d": 400 }).renderKit }));
    expect(error.failures[0]?.issues).toEqual([
      { rule: "invalid-render", message: "home 2d render is 400×400, expected 414×414" },
      { rule: "invalid-render", message: "away 2d render is 400×400, expected 414×414" },
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("lists the failures of every club and still renders the valid ones", async () => {
    const clubsDir = await clubsWithKits(
      { "alpha-fc": { ...KONG_CLUB, id: "alpha-fc" }, "galaticos-fc": GALATICOS_EXPORT, "kong-team": KONG_EXPORT },
      { "kong-team": ["home"] },
    );
    const renderer = fakeRenderer();
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: renderer.renderKit }));
    expect(error.message).toBe("Export aborted, nothing was written (2 of 3 clubs failed)");
    expect(error.failures.map((failure) => [failure.clubId, failure.issues.map((issue) => issue.rule)])).toEqual([
      ["alpha-fc", ["missing-fm-unique-id", "missing-fm-random-id"]],
      ["kong-team", ["missing-kit"]],
    ]);
    expect(renderer.calls).toEqual(["galaticos-fc home 2d", "galaticos-fc away 2d", "galaticos-fc third 2d"]);
    expect(await exists(outDir)).toBe(false);
  });

  it("rewrites its own files on a second run and keeps files it did not write", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "old_club_home_2d.png"), "stale");
    const options = { clubsDir, outDir, renderTypes: ["2d"] as const, renderKit: fakeRenderer().renderKit };
    await exportKits(options);
    const first = await readFile(path.join(outDir, "config.xml"), "utf8");
    await exportKits(options);
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(first);
    expect(await readFile(path.join(outDir, "old_club_home_2d.png"), "utf8")).toBe("stale");
    expect((await readdir(outDir)).sort()).toEqual([
      "config.xml",
      "galaticos_fc_away_2d.png",
      "galaticos_fc_home_2d.png",
      "galaticos_fc_third_2d.png",
      "old_club_home_2d.png",
    ]);
  });

  it("refuses to overwrite a config.xml it did not generate and writes nothing", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    await mkdir(outDir, { recursive: true });
    const foreign = '<record>\n    <list id="maps">\n        <record from="foreign" to="graphics/pictures/clubs/1/logo"/>\n    </list>\n</record>\n';
    await writeFile(path.join(outDir, "config.xml"), foreign);
    await expect(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit })).rejects.toThrow(
      /Refusing to overwrite .*config\.xml.*not generated by this tool/,
    );
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(foreign);
    expect(await readdir(outDir)).toEqual(["config.xml"]);
  });

  it("fails without creating the output folder when there are no clubs", async () => {
    const clubsDir = await makeClubsDir({});
    const outDir = await outputDir();
    await expect(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit })).rejects.toThrow(`No clubs found in ${clubsDir}`);
    expect(await exists(outDir)).toBe(false);
  });
});
