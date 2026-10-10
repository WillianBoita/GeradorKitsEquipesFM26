import { describe, expect, it } from "vitest";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect, type UvRegion } from "../../src/fm26/layout.js";
import { TORSO_LEFT, TORSO_RIGHT } from "../../src/patterns/torso-edges.js";
import { SHIRT_2D_VIEWBOX, TORSO_WINDOW } from "../../src/renderers/shirt-2d-shape.js";
import { affineSvg, applyAffine, frontLogoBox, regionViews, torsoScale, type Affine, type RegionView } from "../../src/renderers/uv-mapping.js";

const T = FM26_TEXTURE_SIZE;
const WINDOW_HEM = TORSO_WINDOW.y + TORSO_WINDOW.height;
const WINDOW_RIGHT = TORSO_WINDOW.x + TORSO_WINDOW.width;
const SLEEVES = FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part === "sleeve" || candidate.part === "longSleeve");

function region(part: UvRegion["part"], side?: "left" | "right"): UvRegion {
  return FM26_KIT_LAYOUT.regions.find((candidate) => candidate.part === part && candidate.side === side)!;
}

function edges(rect: UvRect): { left: number; top: number; right: number; bottom: number } {
  return { left: rect.x * T, top: rect.y * T, right: (rect.x + rect.width) * T, bottom: (rect.y + rect.height) * T };
}

function expectPoint([x, y]: [number, number], [expectedX, expectedY]: [number, number]): void {
  expect(x).toBeCloseTo(expectedX, 6);
  expect(y).toBeCloseTo(expectedY, 6);
}

function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det };
}

function transform(drawn: UvRegion, index = 0): Affine {
  return regionViews(drawn)[index]!.transform;
}

// Cantos dos rects da vista, levados de volta ao espaço do padrão 2D.
function patternCorners(view: RegionView): [number, number][] {
  const inverse = invert(view.transform);
  return view.rects.flatMap((rect) => {
    const { left, top, right, bottom } = edges(rect);
    return (
      [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ] as const
    ).map(([x, y]) => applyAffine(inverse, x, y));
  });
}

describe("TORSO_WINDOW", () => {
  it("matches the 2D torso edges the side layers use", () => {
    expect(TORSO_WINDOW.x).toBeCloseTo(TORSO_LEFT * SHIRT_2D_VIEWBOX, 6);
    expect(TORSO_WINDOW.x + TORSO_WINDOW.width).toBeCloseTo(TORSO_RIGHT * SHIRT_2D_VIEWBOX, 6);
  });
});

describe("affineSvg", () => {
  it("writes the SVG matrix in a b c d e f order", () => {
    expect(affineSvg({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toBe("matrix(1 2 3 4 5 6)");
  });
});

describe("torsoScale", () => {
  it("stretches the 2D torso over the whole front", () => {
    expect(torsoScale().kx).toBeCloseTo(311 / 190, 9);
    expect(torsoScale().ky).toBeCloseTo(406 / 334, 9);
  });
});

describe("regionViews", () => {
  it("draws the front and the back in one view that includes the hem", () => {
    for (const part of ["front", "back"] as const) {
      const drawn = region(part);
      expect(regionViews(drawn).map((view) => view.rects)).toEqual([[drawn.rect, drawn.hem]]);
    }
  });

  it("maps the corners of the 2D torso onto the corners of the front", () => {
    const front = transform(region("front"));
    const { left, top, right, bottom } = edges(region("front").rect);
    expectPoint(applyAffine(front, TORSO_WINDOW.x, TORSO_WINDOW.y), [left, top]);
    expectPoint(applyAffine(front, TORSO_WINDOW.x + TORSO_WINDOW.width, WINDOW_HEM), [right, bottom]);
  });

  // Máscaras 13-0 e 49-0 do FM: as faixas ficam à mesma distância da barra na frente e nas costas.
  it("anchors the back on its hem and mirrors the front across y = 569 with the same x", () => {
    const [front, back] = [transform(region("front")), transform(region("back"))];
    expectPoint(applyAffine(back, TORSO_WINDOW.x, WINDOW_HEM), [357, 134]);
    for (const [x, y] of [
      [112, 48],
      [207, 200],
      [302, 382],
      [150, 10],
    ] as const) {
      const [frontX, frontY] = applyAffine(front, x, y);
      const [backX, backY] = applyAffine(back, x, y);
      expect(backX).toBeCloseTo(frontX, 6);
      expect(backY + frontY).toBeCloseTo(1138, 6);
    }
  });

  it("splits each sleeve into the upper and lower halves of its island", () => {
    for (const sleeve of SLEEVES) {
      const half = sleeve.rect.height / 2;
      expect(regionViews(sleeve).map((view) => view.rects)).toEqual([
        [{ ...sleeve.rect, height: half }],
        [{ ...sleeve.rect, y: sleeve.rect.y + half, height: half }],
      ]);
    }
  });

  // Como no 2D e nas máscaras assimétricas do FM (26, 28, 43): a manga continua o seu lado do tronco.
  it("takes each sleeve from the pattern beside its own side of the 2D torso", () => {
    for (const sleeve of SLEEVES) {
      for (const view of regionViews(sleeve)) {
        for (const [x] of patternCorners(view)) {
          if (sleeve.side === "right") expect(x, `${sleeve.part} right`).toBeLessThanOrEqual(TORSO_WINDOW.x + 1e-6);
          else expect(x, `${sleeve.part} left`).toBeGreaterThanOrEqual(WINDOW_RIGHT - 1e-6);
        }
      }
    }
  });

  it.each([
    ["sleeve", "right"],
    ["sleeve", "left"],
    ["longSleeve", "right"],
    ["longSleeve", "left"],
  ] as const)("puts the shoulder of the %s on the %s next to the torso column and the cuff on the outer edge", (part, side) => {
    const sleeve = region(part, side);
    const { left, top, right, bottom } = edges(sleeve.rect);
    const front = edges(region("front").rect);
    const [inner, outer] = side === "right" ? [right, left] : [left, right];
    expect(inner).toBe(side === "right" ? front.left : front.right);
    // A costura da axila, nas bordas da ilha, recebe a lateral do tronco.
    const torsoSide = side === "right" ? TORSO_WINDOW.x : WINDOW_RIGHT;
    const cuffY = TORSO_WINDOW.y + (right - left) / torsoScale().ky;
    expectPoint(applyAffine(transform(sleeve, 0), torsoSide, TORSO_WINDOW.y), [inner, top]);
    expectPoint(applyAffine(transform(sleeve, 0), torsoSide, cuffY), [outer, top]);
    expectPoint(applyAffine(transform(sleeve, 1), torsoSide, TORSO_WINDOW.y), [inner, bottom]);
  });

  // O meio da ilha é o alto do braço: as duas metades mostram a mesma faixa, como a frente e as costas do tronco.
  it("mirrors the two halves of each sleeve across the middle of its island", () => {
    for (const sleeve of SLEEVES) {
      const { top, bottom } = edges(sleeve.rect);
      const [upper, lower] = [transform(sleeve, 0), transform(sleeve, 1)];
      for (const [x, y] of [
        [20, 50],
        [100, 140],
        [320, 90],
        [390, 300],
      ] as const) {
        const [upperX, upperY] = applyAffine(upper, x, y);
        const [lowerX, lowerY] = applyAffine(lower, x, y);
        expect(lowerX).toBeCloseTo(upperX, 6);
        expect(upperY + lowerY).toBeCloseTo(top + bottom, 6);
      }
    }
  });

  it("runs the vertical lines of the pattern along the arm", () => {
    for (const sleeve of SLEEVES) {
      for (const view of regionViews(sleeve)) expect(applyAffine(view.transform, 150, 60)[1]).toBeCloseTo(applyAffine(view.transform, 150, 120)[1], 6);
    }
  });

  it("keeps every view, hem included, inside the 2D pattern square", () => {
    for (const drawn of FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part !== "sock" && candidate.part !== "shorts")) {
      for (const view of regionViews(drawn)) {
        for (const value of patternCorners(view).flat()) {
          expect(value, `${drawn.part} ${drawn.side}`).toBeGreaterThanOrEqual(-1e-6);
          expect(value, `${drawn.part} ${drawn.side}`).toBeLessThanOrEqual(SHIRT_2D_VIEWBOX + 1e-6);
        }
      }
    }
  });

  it.each(["sock", "shorts"] as const)("has no pattern view for the %s", (part) => {
    expect(() => regionViews(region(part, "right"))).toThrow(`Region "${part}" has no pattern view`);
  });
});

describe("frontLogoBox", () => {
  it("maps the 2D logo boxes with the front transform", () => {
    const sponsor = frontLogoBox("sponsor");
    expect(sponsor.x * T).toBeCloseTo(411.02, 1);
    expect(sponsor.y * T).toBeCloseTo(759.67, 1);
    expect((sponsor.x + sponsor.width) * T).toBeCloseTo(613.98, 1);
    expect((sponsor.y + sponsor.height) * T).toBeCloseTo(818.02, 1);
  });

  it("keeps every logo box on the front", () => {
    const front = region("front").rect;
    for (const slot of ["badge", "sponsor", "manufacturer"] as const) {
      const box = frontLogoBox(slot);
      expect(box.x).toBeGreaterThanOrEqual(front.x);
      expect(box.y).toBeGreaterThanOrEqual(front.y);
      expect(box.x + box.width).toBeLessThanOrEqual(front.x + front.width);
      expect(box.y + box.height).toBeLessThanOrEqual(front.y + front.height);
    }
  });

  // Quadrados brancos do peito no template.png, confirmados no jogo na altura do peito.
  it.each([
    ["badge", 574, 691],
    ["manufacturer", 456, 691],
  ] as const)("puts the %s within 20 px of its square on the template", (slot, x, y) => {
    const box = frontLogoBox(slot);
    const center = [(box.x + box.width / 2) * T, (box.y + box.height / 2) * T] as const;
    expect(Math.hypot(center[0] - x, center[1] - y)).toBeLessThanOrEqual(20);
  });
});
