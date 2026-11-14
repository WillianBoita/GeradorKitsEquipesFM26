import { createHash } from "node:crypto";
import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { COLLAR_STYLES, SLEEVE_CUTS, TRIM_STRIPE_STYLES, type CollarStyle, type KitDefinition, type TrimStripeStyle } from "../../src/core/kit.js";
import type { KitLogoImages } from "../../src/renderers/kit-logos.js";
import { KIT_2D_SIZE, renderKit2dPng, renderKit2dSvg } from "../../src/renderers/renderer-2d.js";
import { collarPath, collarTrimPath, LOGO_BOXES, RAGLAN_SEAMS_PATH } from "../../src/renderers/shirt-2d-shape.js";
import { LOGO_SVG, makeLogoPng } from "../fixtures/assets.js";
import { makeKit } from "../fixtures/kits.js";

type Rgba = [number, number, number, number];

async function pixelAt(png: Buffer, x: number, y: number): Promise<Rgba> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!];
}

const PRIMARY: Rgba = [0x12, 0x34, 0x56, 255];
const SECONDARY: Rgba = [0xff, 0xff, 0xff, 255];
const ACCENT: Rgba = [0xff, 0xd7, 0x00, 255];
const GREEN: Rgba = [0, 0xff, 0, 255];
const MAGENTA: Rgba = [0xff, 0, 0xff, 255];

// Fração do tronco (sem gola e mangas) pintada pelo overlay branco; o canal vermelho separa branco (0xff) do navy da base (0x12).
async function torsoOverlayShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let overlay = 0;
  let total = 0;
  for (let y = 150; y < 380; y++) {
    for (let x = 115; x < 300; x++) {
      total++;
      if (data[(y * info.width + x) * info.channels]! > 0x88) overlay++;
    }
  }
  return overlay / total;
}

// Pixels das caixas de logo que não são a cor base lisa.
async function logoBoxMismatches(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let off = 0;
  for (const box of Object.values(LOGO_BOXES)) {
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        const index = (y * info.width + x) * info.channels;
        if ([data[index], data[index + 1], data[index + 2], data[index + 3]].join() !== PRIMARY.join()) off++;
      }
    }
  }
  return off;
}

describe("renderKit2dSvg", () => {
  it("produces valid SVG", () => {
    expect(XMLValidator.validate(renderKit2dSvg(makeKit()))).toBe(true);
  });

  it("is deterministic", () => {
    expect(renderKit2dSvg(makeKit())).toBe(renderKit2dSvg(makeKit()));
  });

  it("renders an empty layer list exactly as a kit without layers", () => {
    expect(renderKit2dSvg(makeKit({ layers: [] }))).toBe(renderKit2dSvg(makeKit()));
  });

  it("uses the default 414 size", () => {
    expect(renderKit2dSvg(makeKit())).toContain('width="414" height="414"');
  });

  it("draws the raglan seams only on raglan sleeves", () => {
    expect(renderKit2dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toContain(RAGLAN_SEAMS_PATH);
    expect(renderKit2dSvg(makeKit())).not.toContain(RAGLAN_SEAMS_PATH);
  });

  it("renders a declared set-in cut exactly as a kit without cut", () => {
    const declared = makeKit({ sleeves: { style: "match-body", cut: "set-in", color: "secondary", cuffColor: "accent" } });
    expect(renderKit2dSvg(declared)).toBe(renderKit2dSvg(makeKit()));
  });

  it.each(COLLAR_STYLES)("renders the %s collar", (style) => {
    expect(XMLValidator.validate(renderKit2dSvg(makeKit({ collar: { style, color: "accent" } })))).toBe(true);
  });

  it("throws for unknown patterns", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } });
    expect(() => renderKit2dSvg(kit)).toThrow(/Unknown pattern "zigzag"/);
  });

  it("clamps extreme pattern params", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 1e9, ratio: -5 } } });
    const svg = renderKit2dSvg(kit);
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe("renderKit2dPng", () => {
  it("produces a 414x414 PNG with alpha", async () => {
    const meta = await sharp(await renderKit2dPng(makeKit())).metadata();
    expect(meta).toMatchObject({ format: "png", width: KIT_2D_SIZE, height: KIT_2D_SIZE, hasAlpha: true });
  });

  it("supports a custom size", async () => {
    const meta = await sharp(await renderKit2dPng(makeKit(), { size: 828 })).metadata();
    expect(meta).toMatchObject({ width: 828, height: 828 });
  });

  it("keeps the background transparent", async () => {
    const png = await renderKit2dPng(makeKit());
    expect((await pixelAt(png, 2, 2))[3]).toBe(0);
    expect((await pixelAt(png, 411, 411))[3]).toBe(0);
  });

  it("paints the body with the base color", async () => {
    expect(await pixelAt(await renderKit2dPng(makeKit()), 207, 250)).toEqual(PRIMARY);
  });

  it("paints solid sleeves with the sleeve color", async () => {
    const kit = makeKit({ sleeves: { style: "solid", color: "accent", cuffColor: "secondary" } });
    expect(await pixelAt(await renderKit2dPng(kit), 332, 132)).toEqual(ACCENT);
  });

  it("paints the sash only along the diagonal", async () => {
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 80, direction: 0 } } });
    const png = await renderKit2dPng(kit);
    expect(await pixelAt(png, 207, 207)).toEqual(SECONDARY);
    expect(await pixelAt(png, 260, 150)).toEqual(PRIMARY);
  });

  it("paints match-body sleeves with the body fabric instead of the sleeve color", async () => {
    const kit = makeKit({ sleeves: { style: "match-body", color: "accent", cuffColor: "secondary" } });
    expect(await pixelAt(await renderKit2dPng(kit), 332, 132)).toEqual(PRIMARY);
  });

  it("paints the cuffs with the cuff color", async () => {
    const kit = makeKit({ sleeves: { style: "solid", color: "secondary", cuffColor: "accent" } });
    const png = await renderKit2dPng(kit);
    expect(await pixelAt(png, 358, 156)).toEqual(ACCENT);
    expect(await pixelAt(png, 56, 156)).toEqual(ACCENT);
  });

  // Amostra 3px abaixo do centro do traço da gola: o contorno escuro da silhueta passa exatamente sobre o centro.
  it("paints the collar with the collar color", async () => {
    const kit = makeKit({ collar: { style: "round", color: "accent" } });
    expect(await pixelAt(await renderKit2dPng(kit), 207, 73)).toEqual(ACCENT);
  });

  it("cuts the v-neck deeper than the round collar", async () => {
    const round = await renderKit2dPng(makeKit({ collar: { style: "round", color: "accent" } }));
    const vNeck = await renderKit2dPng(makeKit({ collar: { style: "v-neck", color: "accent" } }));
    expect(await pixelAt(round, 207, 88)).toEqual(PRIMARY);
    expect((await pixelAt(vNeck, 207, 88))[3]).toBe(0);
    expect(await pixelAt(vNeck, 207, 103)).toEqual(ACCENT);
  });

  it("paints the polo placket with the collar color", async () => {
    expect(await pixelAt(await renderKit2dPng(makeKit({ collar: { style: "polo", color: "accent" } })), 207, 115)).toEqual(ACCENT);
  });

  // (185, 80) fica na aba esquerda, longe dos contornos dela e do traço do V.
  it("cuts the polo-v as deep as the v-neck and covers its flaps with the collar color", async () => {
    const png = await renderKit2dPng(makeKit({ collar: { style: "polo-v", color: "accent" } }));
    expect((await pixelAt(png, 207, 88))[3]).toBe(0);
    expect(await pixelAt(png, 185, 80)).toEqual(ACCENT);
  });

  // (270, 66) fica no triângulo do ombro que a raglan tira do corpo, longe da costura e do contorno.
  it("paints the shoulder with the sleeve color only on raglan sleeves", async () => {
    const raglan = await renderKit2dPng(makeKit({ sleeves: { style: "solid", cut: "raglan", color: "accent", cuffColor: "secondary" } }));
    const setIn = await renderKit2dPng(makeKit({ sleeves: { style: "solid", cut: "set-in", color: "accent", cuffColor: "secondary" } }));
    expect(await pixelAt(raglan, 270, 66)).toEqual(ACCENT);
    expect(await pixelAt(setIn, 270, 66)).toEqual(PRIMARY);
  });

  // width 0.03: painel esquerdo em x 112–124,4.
  it("paints a layer in its color over the body", async () => {
    const png = await renderKit2dPng(makeKit({ layers: [{ id: "side-lines", color: "accent", params: { width: 0.03 } }] }));
    expect(await pixelAt(png, 118, 250)).toEqual(ACCENT);
    expect(await pixelAt(png, 130, 250)).toEqual(PRIMARY);
  });

  // A linha do ombro (y 78,7–87) cruza o canvas inteiro; (100, 82) fica na manga esquerda, a 4 px da borda dela.
  it("keeps the layers off match-body sleeves", async () => {
    const png = await renderKit2dPng(makeKit({ layers: [{ id: "shoulder-line", color: "accent", params: { position: 0.2, thickness: 0.02 } }] }));
    expect(await pixelAt(png, 207, 82)).toEqual(ACCENT);
    expect(await pixelAt(png, 100, 82)).toEqual(PRIMARY);
  });

  // A cor base precisa dominar a camisa; senão o Away (base secondary) pode parecer o Home e o kit-clash não percebe.
  it.each([3, 4, 5, 8, 15])("keeps the widest stripes (count %d) below half of the torso", async (count) => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count, ratio: 1 } } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });

  it.each([0, 1])("keeps the widest sash (direction %d) below half of the torso", async (direction) => {
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 1000, direction } } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });

  // Cada caixa de logo fica inteira sobre o corpo liso: nenhuma toca gola, manga, costura, contorno ou fundo transparente.
  // Manga lisa em accent denuncia uma raglan que invada a caixa.
  const SHAPES = COLLAR_STYLES.flatMap((collar) => SLEEVE_CUTS.map((cut) => [collar, cut] as const));

  it.each(SHAPES)("keeps every logo box on the plain body with the %s collar and %s sleeves", async (style, cut) => {
    const kit = makeKit({ collar: { style, color: "accent" }, sleeves: { style: "solid", cut, color: "accent", cuffColor: "secondary" } });
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });

  // Piores casos medidos no protótipo da Fase 3b; valores acima do máximo passam pelo clamp de resolveParams.
  const WIDEST: [string, Record<string, number>][] = [
    ["pinstripes", { count: 12, ratio: 1 }],
    ["pinstripes", { count: 23, ratio: 1 }],
    ["pinstripes", { count: 30, ratio: 1 }],
    ["hoops", { count: 4, ratio: 1 }],
    ["hoops", { count: 7, ratio: 1 }],
    ["hoops", { count: 12, ratio: 1 }],
    ["diagonal", { count: 4, ratio: 1, direction: 1 }],
    ["diagonal", { count: 8, ratio: 1, direction: 0 }],
    ["diagonal", { count: 12, ratio: 1, direction: 0 }],
    ["chevron", { depth: 0.35, width: 1 }],
    ["chevron", { depth: 1, width: 1 }],
    ["chest-band", { position: 0.35, width: 1 }],
    ["chest-band", { position: 0.475, width: 1 }],
    ["chest-band", { position: 1, width: 1 }],
    ["center-band", { width: 1 }],
    ["gradient", { start: 0 }],
  ];

  it.each(WIDEST)("keeps the widest %s %j below half of the torso", async (id, params) => {
    const kit = makeKit({ pattern: { id, base: "primary", overlay: "secondary", params } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });

  // Equilibrados: as duas cores dividem o tronco; o ciclo de papéis ainda separa os kits do conjunto (spec da 3b, seção 4.2).
  const BALANCED: [string, Record<string, number>][] = [
    ["checkers", { size: 0 }],
    ["checkers", { size: 0.064 }],
    ["checkers", { size: 0.105 }],
    ["checkers", { size: 1 }],
    ["halves", { side: 0 }],
    ["halves", { side: 1 }],
  ];

  it.each(BALANCED)("keeps the balanced %s %j at about half of the torso", async (id, params) => {
    const kit = makeKit({ pattern: { id, base: "primary", overlay: "secondary", params } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThanOrEqual(0.51);
  });

  // start abaixo do mínimo vira 0.58 pelo clamp: o degradê começa abaixo da caixa do patrocinador (y 229).
  it("keeps every logo box on the plain base with the earliest gradient", async () => {
    const kit = makeKit({ pattern: { id: "gradient", base: "primary", overlay: "secondary", params: { start: 0 } } });
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });
});

describe("renderKit2dPng trim stripes", () => {
  const striped = (style: TrimStripeStyle, collar: CollarStyle = "round"): KitDefinition =>
    makeKit({
      collar: { style: collar, color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "accent" },
      trimStripe: { style, color: "secondary" },
    });

  it("draws a single stripe in the middle of the collar", async () => {
    const png = await renderKit2dPng(striped("single"));
    for (const y of [69, 70]) expect(await pixelAt(png, 207, y), `y ${y}`).toEqual(SECONDARY);
    for (const y of [66, 73]) expect(await pixelAt(png, 207, y), `y ${y}`).toEqual(ACCENT);
  });

  it("draws a double stripe near the edges of the collar", async () => {
    const png = await renderKit2dPng(striped("double"));
    for (const y of [66, 72]) expect(await pixelAt(png, 207, y), `y ${y}`).toEqual(SECONDARY);
    for (const y of [69, 70]) expect(await pixelAt(png, 207, y), `y ${y}`).toEqual(ACCENT);
  });

  // (357, 156) fica na linha central do punho; (361, 155) a 1,7–3,1 px dela, para fora.
  it("draws the stripes on the cuffs", async () => {
    const single = await renderKit2dPng(striped("single"));
    expect(await pixelAt(single, 357, 156)).toEqual(SECONDARY);
    expect(await pixelAt(single, 361, 155)).toEqual(ACCENT);
    const double = await renderKit2dPng(striped("double"));
    expect(await pixelAt(double, 361, 155)).toEqual(SECONDARY);
    expect(await pixelAt(double, 357, 156)).toEqual(ACCENT);
  });

  // Distância até a borda inferior da aba esquerda: (172, 75) a 3,4–4,8 px, (182, 86) a 0,9–2,3 px, (173, 73) a 5,6–7,0 px.
  it("tips the polo flaps along their edges", async () => {
    const single = await renderKit2dPng(striped("single", "polo"));
    expect(await pixelAt(single, 172, 75)).toEqual(SECONDARY);
    expect(await pixelAt(single, 173, 73)).toEqual(ACCENT);
    const double = await renderKit2dPng(striped("double", "polo"));
    expect(await pixelAt(double, 182, 86)).toEqual(SECONDARY);
    expect(await pixelAt(double, 172, 75)).toEqual(ACCENT);
  });

  it("draws the polo placket over the flap stripes", () => {
    const svg = renderKit2dSvg(striped("double", "polo"));
    expect(svg.lastIndexOf('<path d="M200 70 L214 70 L214 125 L200 125 Z"')).toBeGreaterThan(svg.indexOf('clip-path="url(#flaps)"'));
  });

  // O traço escuro da silhueta passa no meio da gola: com listra, ele sai do decote. "L300 62 L378 140" só aparece na silhueta (o corpo segue para L302 146).
  it("drops the neckline from the silhouette outline only on striped kits", () => {
    const plain = renderKit2dSvg(makeKit());
    const svg = renderKit2dSvg(striped("single"));
    expect(plain).toContain(`${collarPath("round")} L300 62 L378 140`);
    expect(svg).not.toContain(`${collarPath("round")} L300 62 L378 140`);
    expect(svg).toContain("M249 48 L300 62 L378 140");
  });

  it("keeps the trim of the polo collars as before", () => {
    expect(collarTrimPath("polo")).toBe(
      "M162 45 L146 60 L192 96 L203 72 Q182 64 165 48 Z M252 45 L268 60 L222 96 L211 72 Q232 64 249 48 Z M200 70 L214 70 L214 125 L200 125 Z",
    );
    expect(collarTrimPath("polo-v")).toBe("M163 46 L207 100 L198 100 L140 58 Z M251 46 L207 100 L216 100 L274 58 Z");
    expect(collarTrimPath("round")).toBeUndefined();
  });

  const STRIPED_SHAPES = COLLAR_STYLES.flatMap((collar) => TRIM_STRIPE_STYLES.map((style) => [collar, style] as const));

  it.each(STRIPED_SHAPES)("keeps every logo box on the plain body with the %s collar and a %s stripe", async (collar, style) => {
    const kit = striped(style, collar);
    expect(XMLValidator.validate(renderKit2dSvg(kit))).toBe(true);
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });

  // O renderer não valida: um kit.json escrito à mão com a listra na cor da gola é desenhado assim mesmo.
  it("draws a stripe in the collar color without failing", () => {
    const kit = makeKit({ trimStripe: { style: "single", color: "accent" } });
    expect(XMLValidator.validate(renderKit2dSvg(kit))).toBe(true);
  });
});

describe("renderKit2dPng logos", () => {
  const sponsorLogo = () => ({ sponsor: Buffer.from(LOGO_SVG.replace("<path", '<path fill="#00ff00"')) });
  const sponsorKit = makeKit({ sponsor: { id: "luna-air" } });
  const lightKit = (logos: object) => makeKit({ pattern: { id: "solid", base: "secondary", overlay: "primary", params: {} }, ...logos });

  it("renders a kit without logos exactly as the Phase 2a renderer", async () => {
    const kit = makeKit();
    const phase2a = await sharp(Buffer.from(renderKit2dSvg(kit)))
      .png()
      .toBuffer();
    expect((await renderKit2dPng(kit, { logos: sponsorLogo() })).equals(phase2a)).toBe(true);
  });

  // LOGO_SVG ocupa 124×41 a partir de (145, 184); o furo central fica entre x 194–219 e y 196–212.
  it("keeps the sponsor colors and leaves its hole transparent", async () => {
    const png = await renderKit2dPng(sponsorKit, { logos: sponsorLogo() });
    expect(await pixelAt(png, 155, 205)).toEqual(GREEN);
    expect(await pixelAt(png, 207, 205)).toEqual(PRIMARY);
  });

  // y = 183 fica logo acima do LOGO_SVG, que começa em y 184.
  it("outlines the sponsor in white on a dark kit and in black on a light kit", async () => {
    expect(await pixelAt(await renderKit2dPng(sponsorKit, { logos: sponsorLogo() }), 155, 183)).toEqual(SECONDARY);
    expect(await pixelAt(await renderKit2dPng(lightKit({ sponsor: { id: "luna-air" } }), { logos: sponsorLogo() }), 155, 183)).toEqual([0, 0, 0, 255]);
  });

  it("keeps the manufacturer colors", async () => {
    const png = await renderKit2dPng(makeKit({ manufacturer: { id: "vertex" } }), { logos: { manufacturer: await makeLogoPng(30, 30) } });
    expect(await pixelAt(png, 164, 120)).toEqual(MAGENTA);
  });

  it("keeps the badge colors", async () => {
    const png = await renderKit2dPng(makeKit({ badge: true }), { logos: { badge: await makeLogoPng(40, 40, "#00ff00") } });
    expect(await pixelAt(png, 250, 120)).toEqual(GREEN);
  });

  // A caixa do escudo é x 225–269, y 102–146; sem a margem transparente de 2 px do arquivo (2,2 px na caixa), o verde vai de 228 a 266 e de 105 a 143.
  it("fills the whole 44 px badge box", async () => {
    const png = await renderKit2dPng(makeKit({ badge: true }), { logos: { badge: await makeLogoPng(40, 40, "#00ff00") } });
    expect(await pixelAt(png, 228, 105)).toEqual(GREEN);
    expect(await pixelAt(png, 266, 143)).toEqual(GREEN);
  });

  it("outlines the badge in white on a dark kit and in black on a light kit", async () => {
    const logos = { badge: await makeLogoPng(40, 40, "#00ff00") };
    // x = 226 é a margem transparente do escudo, na borda esquerda da caixa.
    expect(await pixelAt(await renderKit2dPng(makeKit({ badge: true }), { logos }), 226, 120)).toEqual(SECONDARY);
    expect(await pixelAt(await renderKit2dPng(lightKit({ badge: true }), { logos }), 226, 120)).toEqual([0, 0, 0, 255]);
  });

  it("scales logos with the image size", async () => {
    expect(await pixelAt(await renderKit2dPng(sponsorKit, { size: 828, logos: sponsorLogo() }), 310, 410)).toEqual(GREEN);
  });

  it.each(["badge", "sponsor", "manufacturer"] as const)("fails when the kit declares a %s without its image", async (slot) => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air" }, manufacturer: { id: "vertex" } });
    const logos: KitLogoImages = { badge: await makeLogoPng(40, 40), sponsor: Buffer.from(LOGO_SVG), manufacturer: await makeLogoPng(30, 30) };
    delete logos[slot];
    await expect(renderKit2dPng(kit, { logos })).rejects.toThrow(`Kit declares a ${slot} but no ${slot} image was provided`);
  });

  it("is deterministic with logos", async () => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air" } });
    const logos = { badge: await makeLogoPng(40, 40, "#00ff00"), ...sponsorLogo() };
    expect((await renderKit2dPng(kit, { logos })).equals(await renderKit2dPng(kit, { logos }))).toBe(true);
  });
});

// Guarda da Fase 3b: passa antes e depois da camada de desenho compartilhada; o SVG 2D dos padrões atuais não pode mudar.
describe("renderKit2dSvg Phase 3b baseline", () => {
  it("keeps the SVG of every current pattern, collar and sleeve style", () => {
    const kits = ["solid", "stripes", "sash"].flatMap((id) =>
      (["round", "v-neck"] as const).flatMap((collar) =>
        (["match-body", "solid"] as const).map((sleeves) =>
          makeKit({
            pattern: { id, base: "primary", overlay: "secondary", params: {} },
            collar: { style: collar, color: "accent" },
            sleeves: { style: sleeves, color: "secondary", cuffColor: "accent" },
          }),
        ),
      ),
    );
    const digest = createHash("sha256")
      .update(kits.map((kit) => renderKit2dSvg(kit)).join("\n"))
      .digest("hex");
    expect(digest).toBe("acdafaa885203f9f125260033f4ef9b225720ea04165ad11f244a57e6ce96d40");
  });
});
