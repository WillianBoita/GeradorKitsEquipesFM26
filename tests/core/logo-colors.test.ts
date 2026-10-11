import { describe, expect, it } from "vitest";
import { backgroundRoles, logoOutlineColor, overlayShare } from "../../src/core/logo-colors.js";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { makeKit } from "../fixtures/kits.js";

describe("backgroundRoles", () => {
  it("returns only the base for a solid kit", () => {
    expect(backgroundRoles(makeKit(), "sponsor")).toEqual(["primary"]);
  });

  it("puts the dominant role first", () => {
    // Faixa de largura 70 cobre 78% da caixa do patrocinador.
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 70, direction: 0 } } });
    expect(backgroundRoles(kit, "sponsor")).toEqual(["secondary", "primary"]);
  });

  it("keeps the base first when stripes cover less of the box", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } } });
    expect(backgroundRoles(kit, "sponsor")).toEqual(["primary", "secondary"]);
  });

  it("ignores a sliver below 5% of the box", () => {
    // Com 10 listras de ratio 0.25, só a primeira coluna da grade 24×24 da caixa do fabricante (x = 149,625) cai numa listra: 4,2%.
    const params = { count: 10, ratio: 0.25 };
    expect(getPatternTemplate("stripes").colorAt(149.625, 120, { width: 414, height: 414, params })).toBe("overlay");
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params } });
    expect(backgroundRoles(kit, "manufacturer")).toEqual(["primary"]);
  });
});

describe("overlayShare", () => {
  it("measures the part of a logo box that the overlay paints", () => {
    expect(overlayShare(getPatternTemplate("solid"), {}, "sponsor")).toBe(0);
    // Faixa em y 155,3–217,4: cobre 18 das 24 linhas da grade do patrocinador (y 182–228) e nada do escudo (y 102–146).
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "sponsor")).toBe(0.75);
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "badge")).toBe(0);
  });
});

describe("logoOutlineColor", () => {
  it("outlines every logo in white on a dark kit", () => {
    for (const slot of ["badge", "sponsor", "manufacturer"] as const) expect(logoOutlineColor(makeKit(), slot)).toBe("#ffffff");
  });

  it("outlines every logo in black on a light kit", () => {
    const kit = makeKit({ pattern: { id: "solid", base: "secondary", overlay: "primary", params: {} } });
    for (const slot of ["badge", "sponsor", "manufacturer"] as const) expect(logoOutlineColor(kit, slot)).toBe("#000000");
  });

  it("measures the background of each logo box", () => {
    // A faixa branca cobre 75% do patrocinador e nada do escudo: o escudo fica no navy e o patrocinador segue a faixa dominante.
    const kit = makeKit({ pattern: { id: "chest-band", base: "primary", overlay: "secondary", params: { position: 0.45, width: 0.15 } } });
    expect(logoOutlineColor(kit, "badge")).toBe("#ffffff");
    expect(logoOutlineColor(kit, "sponsor")).toBe("#000000");
  });

  it("needs contrast against every color behind the logo", () => {
    // Cinza sozinho pede preto (4,69 contra 4,48), mas as listras navy atrás do escudo derrubam o preto para 1,65.
    const kit = makeKit({
      colors: { primary: "#777777", secondary: "#123456", accent: "#ffd700" },
      pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } },
    });
    expect(backgroundRoles(kit, "badge")).toEqual(["primary", "secondary"]);
    expect(logoOutlineColor(kit, "badge")).toBe("#ffffff");
  });

  it("follows the dominant color when no outline reads on every color behind the logo", () => {
    // Navy dominante com faixa branca, como na home do playstation: o preto tem o maior mínimo (1,77 contra 1,00), mas some no navy.
    const kit = makeKit({ pattern: { id: "diagonal", base: "primary", overlay: "secondary", params: { count: 5, ratio: 0.339, direction: 0 } } });
    expect(backgroundRoles(kit, "badge")).toEqual(["primary", "secondary"]);
    expect(logoOutlineColor(kit, "badge")).toBe("#ffffff");
  });
});
