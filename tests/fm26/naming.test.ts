import { describe, expect, it } from "vitest";
import { KIT_TYPES } from "../../src/core/kit.js";
import { clubSlug, kitAssetFileName, kitAssetName, parseRenderType, RENDER_TYPES } from "../../src/fm26/naming.js";

describe("clubSlug", () => {
  it.each([
    ["galaticos-fc", "galaticos_fc"],
    ["kong-team", "kong_team"],
    ["fnaf", "fnaf"],
  ])("turns %s into %s", (id, slug) => {
    expect(clubSlug(id)).toBe(slug);
  });

  it("rejects ids outside the internal id format", () => {
    expect(() => clubSlug("Galáticos FC")).toThrow(/Invalid club id/);
  });
});

describe("kitAssetName", () => {
  it("follows {club-slug}_{kit-type}_{render-type}", () => {
    expect(kitAssetName("galaticos-fc", "home", "2d")).toBe("galaticos_fc_home_2d");
    expect(kitAssetName("galaticos-fc", "third", "3d")).toBe("galaticos_fc_third_3d");
  });

  it("adds .png only to the file name", () => {
    expect(kitAssetFileName("galaticos-fc", "away", "3d")).toBe("galaticos_fc_away_3d.png");
  });

  it("produces unique, safe names for every kit and render type", () => {
    const names = KIT_TYPES.flatMap((kitType) => RENDER_TYPES.map((renderType) => kitAssetName("galaticos-fc", kitType, renderType)));
    expect(new Set(names).size).toBe(KIT_TYPES.length * RENDER_TYPES.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("parseRenderType", () => {
  it.each(RENDER_TYPES)("accepts %s", (value) => {
    expect(parseRenderType(value)).toBe(value);
  });

  it.each(["4d", "3D", ""])("rejects %j", (value) => {
    expect(() => parseRenderType(value)).toThrow(`Invalid render type "${value}": expected 2d or 3d`);
  });
});
