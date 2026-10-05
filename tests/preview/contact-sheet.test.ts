import { describe, expect, it } from "vitest";
import { buildContactSheetHtml, kitDetails, type PreviewKit, type PreviewSection } from "../../src/preview/contact-sheet.js";
import { makeKit } from "../fixtures/kits.js";

function section(title: string, ...pngs: Buffer[]): PreviewSection {
  return { title, kits: pngs.map((png): PreviewKit => ({ kitType: "home", png, details: ["solid · classic"] })) };
}

describe("buildContactSheetHtml", () => {
  it("is a complete HTML document", () => {
    const html = buildContactSheetHtml("Saved kits", []);
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>Saved kits</title>");
    expect(html).not.toContain("<script");
    expect(html.endsWith("</body></html>\n")).toBe(true);
  });

  it("embeds each PNG as base64 that decodes back to the original bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const html = buildContactSheetHtml("Saved kits", [section("Club", png)]);
    const sources = [...html.matchAll(/<img src="data:image\/png;base64,([^"]+)"/g)].map((match) => match[1]!);
    expect(sources).toHaveLength(1);
    expect(Buffer.from(sources[0]!, "base64").equals(png)).toBe(true);
  });

  it("renders one section per entry, in order, with the details of each kit", () => {
    const html = buildContactSheetHtml("Samples", [section("Seed 0", Buffer.from([1])), section("Seed 1", Buffer.from([2]), Buffer.from([3]))]);
    expect(html.indexOf("<h2>Seed 0</h2>")).toBeLessThan(html.indexOf("<h2>Seed 1</h2>"));
    expect(html.match(/<figure>/g)).toHaveLength(3);
    expect(html).toContain("<strong>home</strong><br>solid · classic");
  });

  it("escapes text that comes from the data", () => {
    const html = buildContactSheetHtml(`<Kongs & "Co">`, [{ title: "O'Brien <b>", kits: [{ kitType: "away", png: Buffer.from([1]), details: ["<i>"] }] }]);
    expect(html).toContain("<title>&lt;Kongs &amp; &quot;Co&quot;&gt;</title>");
    expect(html).toContain("<h2>O&#39;Brien &lt;b&gt;</h2>");
    expect(html).toContain("<br>&lt;i&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("kitDetails", () => {
  it("lists the pattern with category and resolved params, the seed and the brands", () => {
    const kit = makeKit({
      generatedWith: { seed: 42 },
      pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } },
      sponsor: { id: "luna-air", color: "accent" },
      manufacturer: { id: "vertex", color: "accent" },
    });
    expect(kitDetails(kit)).toEqual(["stripes · classic · count 7, ratio 0.3", "seed 42", "sponsor luna-air", "manufacturer vertex"]);
  });

  it("omits what the kit does not have", () => {
    expect(kitDetails(makeKit())).toEqual(["solid · classic"]);
  });
});
