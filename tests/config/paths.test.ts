import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../../src/config/paths.js";

describe("project directories", () => {
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
