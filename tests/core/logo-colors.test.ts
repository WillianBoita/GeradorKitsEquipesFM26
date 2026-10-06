import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/core/color.js";
import { isColorRole } from "../../src/core/kit.js";
import { backgroundRoles, chooseLogoColors, MIN_LOGO_CONTRAST, overlayShare, type LogoColors } from "../../src/core/logo-colors.js";
import { createRng } from "../../src/core/random.js";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { makeKit } from "../fixtures/kits.js";

const PALETTE = { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" };
const [NAVY, WHITE, GOLD] = [PALETTE.primary, PALETTE.secondary, PALETTE.accent];

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
    // Faixa em y 155,3–217,4: cobre 18 das 24 linhas da grade do patrocinador (y 182–228) e nada do escudo (y 102–138).
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "sponsor")).toBe(0.75);
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "badge")).toBe(0);
  });
});

describe("chooseLogoColors", () => {
  it("prefers the palette color with the highest contrast", () => {
    // Contra navy: branco 12,72, ouro 9,07.
    expect(chooseLogoColors(PALETTE, [NAVY])).toEqual({ color: "secondary" });
  });

  it("needs contrast against every background color", () => {
    expect(chooseLogoColors(PALETTE, [WHITE, GOLD])).toEqual({ color: "primary" });
  });

  it("falls back to white or black when no palette color reaches the minimum", () => {
    // Contra navy: vermelho-escuro 1,27, verde 2,48, branco 12,72.
    expect(chooseLogoColors({ primary: "#123456", secondary: "#8b0000", accent: "#2e7d32" }, [NAVY])).toEqual({ color: "#ffffff" });
  });

  it("adds an outline when no single color works, as on the galaticos home sash", () => {
    expect(chooseLogoColors(PALETTE, [WHITE, NAVY])).toEqual({ color: "primary", outline: "secondary" });
  });

  it("picks the fill that reads on the dominant background, as on the galaticos third stripes", () => {
    expect(chooseLogoColors(PALETTE, [GOLD, NAVY])).toEqual({ color: "primary", outline: "secondary" });
  });

  it("prefers a palette fill with a neutral outline over a neutral fill", () => {
    // Paleta toda clara sobre branco e preto: nenhum par só com a paleta passa; cinza-claro tem o maior contraste contra o branco dominante.
    expect(chooseLogoColors({ primary: "#ffd700", secondary: "#f5f5dc", accent: "#d3d3d3" }, ["#ffffff", "#000000"])).toEqual({
      color: "accent",
      outline: "#000000",
    });
  });

  it("breaks ties between outlines by candidate order", () => {
    // Fill navy (secondary) vence pelo fundo dominante branco; ouro e cinza-claro servem de contorno, ouro vem antes.
    expect(chooseLogoColors({ primary: "#ffd700", secondary: "#123456", accent: "#d3d3d3" }, ["#ffffff", "#000000"])).toEqual({
      color: "secondary",
      outline: "primary",
    });
  });

  it("always finds a legible choice", () => {
    const rng = createRng(2024);
    const hex = () =>
      `#${Array.from({ length: 3 }, () =>
        Math.floor(rng.next() * 256)
          .toString(16)
          .padStart(2, "0"),
      ).join("")}`;
    for (let index = 0; index < 500; index++) {
      const palette = { primary: hex(), secondary: hex(), accent: hex() };
      const background = [hex(), hex()];
      const choice: LogoColors | undefined = chooseLogoColors(palette, background);
      expect(choice).toBeDefined();
      const resolve = (value: string) => (isColorRole(value) ? palette[value] : value);
      const color = resolve(choice!.color);
      const outline = choice!.outline === undefined ? undefined : resolve(choice!.outline);
      if (outline !== undefined) expect(contrastRatio(color, outline)).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST);
      for (const bg of background) {
        expect(Math.max(contrastRatio(color, bg), outline === undefined ? 0 : contrastRatio(outline, bg))).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST);
      }
    }
  });
});
