import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { checkRenderedPng, duplicateFmUniqueIdIssues, FM26_RENDER_SIZES, validateExportClub } from "../../src/fm26/exporter.js";
import { GALATICOS_CLUB, KONG_CLUB } from "../fixtures/clubs.js";

const GALATICOS_EXPORT = { ...GALATICOS_CLUB, fmUniqueId: "1" };
const KONG_EXPORT = { ...KONG_CLUB, fmUniqueId: "2" };

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
  it("accepts a club with fmUniqueId, home and away", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["home", "away"], "/clubs")).toEqual([]);
  });

  it("requires the fmUniqueId", () => {
    expect(validateExportClub(club(GALATICOS_CLUB), ["home", "away", "third"], "/clubs")).toEqual([
      { rule: "missing-fm-unique-id", message: 'Club "galaticos-fc" has no fmUniqueId' },
    ]);
  });

  it("names the expected kit.json of every missing required kit", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["third"], "/clubs")).toEqual([
      { rule: "missing-kit", message: `Club "galaticos-fc" has no home kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "home", "kit.json")})` },
      { rule: "missing-kit", message: `Club "galaticos-fc" has no away kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "away", "kit.json")})` },
    ]);
  });
});

describe("duplicateFmUniqueIdIssues", () => {
  it("is empty when every fmUniqueId is unique or absent", () => {
    expect(duplicateFmUniqueIdIssues([club(GALATICOS_EXPORT), club(KONG_EXPORT), club({ ...KONG_CLUB, id: "no-id" })]).size).toBe(0);
  });

  it("flags every club that shares an fmUniqueId, naming the others", () => {
    const issues = duplicateFmUniqueIdIssues([club(GALATICOS_EXPORT), club({ ...KONG_EXPORT, fmUniqueId: "1" }), club({ ...KONG_EXPORT, id: "fnaf" })]);
    expect(Object.fromEntries(issues)).toEqual({
      "galaticos-fc": [{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "kong-team"' }],
      "kong-team": [{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "galaticos-fc"' }],
    });
  });

  it("lists every other club when three share an fmUniqueId", () => {
    const issues = duplicateFmUniqueIdIssues([
      club(GALATICOS_EXPORT),
      club({ ...KONG_EXPORT, fmUniqueId: "1" }),
      club({ ...KONG_EXPORT, id: "fnaf", fmUniqueId: "1" }),
    ]);
    expect(issues.get("fnaf")).toEqual([{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "galaticos-fc", "kong-team"' }]);
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
