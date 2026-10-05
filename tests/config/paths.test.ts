import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSETS_DIR,
  CLUBS_DIR,
  CONFIG_XML_FILE,
  exportConfigPath,
  exportFilePath,
  FM26_EXPORT_DIR,
  kitRenderPath,
  OUTPUT_DIR,
  PREVIEW_FILE,
  samplesPreviewPath,
} from "../../src/config/paths.js";
import { ClubIdSchema } from "../../src/core/primitives.js";

describe("project directories", () => {
  it("places assets/ next to clubs/", () => {
    expect(path.dirname(ASSETS_DIR)).toBe(path.dirname(CLUBS_DIR));
    expect(path.basename(ASSETS_DIR)).toBe("assets");
  });

  it("places clubs/ and output/ side by side at the project root", async () => {
    expect(path.dirname(OUTPUT_DIR)).toBe(path.dirname(CLUBS_DIR));
    expect(path.basename(OUTPUT_DIR)).toBe("output");
    await expect(access(path.join(path.dirname(CLUBS_DIR), "package.json"))).resolves.toBeUndefined();
  });
});

describe("kitRenderPath", () => {
  it("builds <out>/<club id>/<render type>/<FM26 file name>", () => {
    expect(kitRenderPath("/tmp/out", "galaticos-fc", "away", "2d")).toBe(path.join("/tmp/out", "galaticos-fc", "2d", "galaticos_fc_away_2d.png"));
  });

  it("rejects invalid club ids", () => {
    expect(() => kitRenderPath("/tmp/out", "../escape", "home", "2d")).toThrow(/Invalid club id/);
  });
});

describe("FM26 export paths", () => {
  it("places the export folder inside output/ with a name no club id can take", () => {
    expect(path.dirname(FM26_EXPORT_DIR)).toBe(OUTPUT_DIR);
    expect(path.basename(FM26_EXPORT_DIR)).toBe("fm26_export");
    expect(ClubIdSchema.safeParse(path.basename(FM26_EXPORT_DIR)).success).toBe(false);
  });

  it("puts every PNG flat in the export folder, next to config.xml", () => {
    expect(exportFilePath("/tmp/out", "galaticos-fc", "away", "2d")).toBe(path.join("/tmp/out", "galaticos_fc_away_2d.png"));
    expect(exportConfigPath("/tmp/out")).toBe(path.join("/tmp/out", CONFIG_XML_FILE));
    expect(CONFIG_XML_FILE).toBe("config.xml");
  });

  it("rejects invalid club ids", () => {
    expect(() => exportFilePath("/tmp/out", "../escape", "home", "2d")).toThrow(/Invalid club id/);
  });
});

describe("preview paths", () => {
  it("places the saved-kits preview inside output/ with a name no club id can take", () => {
    expect(PREVIEW_FILE).toBe(path.join(OUTPUT_DIR, "kit_preview.html"));
    expect(ClubIdSchema.safeParse("kit_preview.html").success).toBe(false);
  });

  it("names the samples preview after the club slug", () => {
    expect(samplesPreviewPath("galaticos-fc")).toBe(path.join(OUTPUT_DIR, "kit_preview_galaticos_fc.html"));
  });

  it("rejects invalid club ids in the samples preview path", () => {
    expect(() => samplesPreviewPath("../escape")).toThrow(/Invalid club id/);
  });
});
