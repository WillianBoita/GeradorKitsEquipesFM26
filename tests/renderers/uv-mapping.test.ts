import { describe, expect, it } from "vitest";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect, type UvRegion } from "../../src/fm26/layout.js";
import { TORSO_LEFT, TORSO_RIGHT } from "../../src/patterns/torso-edges.js";
import { SHIRT_2D_VIEWBOX, TORSO_WINDOW } from "../../src/renderers/shirt-2d-shape.js";
import { affineSvg, applyAffine, frontLogoBox, regionTransform, torsoScale, type Affine } from "../../src/renderers/uv-mapping.js";

const T = FM26_TEXTURE_SIZE;
const WINDOW_HEM = TORSO_WINDOW.y + TORSO_WINDOW.height;

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

describe("regionTransform", () => {
  it("maps the corners of the 2D torso onto the corners of the front", () => {
    const front = regionTransform(region("front"));
    const { left, top, right, bottom } = edges(region("front").rect);
    expectPoint(applyAffine(front, TORSO_WINDOW.x, TORSO_WINDOW.y), [left, top]);
    expectPoint(applyAffine(front, TORSO_WINDOW.x + TORSO_WINDOW.width, WINDOW_HEM), [right, bottom]);
  });

  // Máscaras 13-0 e 49-0 do FM: as faixas ficam à mesma distância da barra na frente e nas costas.
  it("anchors the back on its hem and mirrors the front across y = 569 with the same x", () => {
    const [front, back] = [regionTransform(region("front")), regionTransform(region("back"))];
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

  it.each([
    ["sleeve", "right"],
    ["sleeve", "left"],
    ["longSleeve", "right"],
    ["longSleeve", "left"],
  ] as const)("puts the shoulder of the %s on the %s next to the torso column and the cuff on the outer edge", (part, side) => {
    const sleeve = region(part, side);
    const transform = regionTransform(sleeve);
    const { left, top, right, bottom } = edges(sleeve.rect);
    const front = edges(region("front").rect);
    const [inner, outer] = side === "right" ? [right, left] : [left, right];
    expect(inner).toBe(side === "right" ? front.left : front.right);
    const cuffY = TORSO_WINDOW.y + (right - left) / torsoScale().ky;
    expectPoint(applyAffine(transform, TORSO_WINDOW.x, TORSO_WINDOW.y), [inner, top]);
    expectPoint(applyAffine(transform, TORSO_WINDOW.x, cuffY), [outer, top]);
    expectPoint(applyAffine(transform, TORSO_WINDOW.x + TORSO_WINDOW.width, TORSO_WINDOW.y), [inner, bottom]);
  });

  it("runs the vertical lines of the pattern along the arm", () => {
    for (const sleeve of FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part === "sleeve" || candidate.part === "longSleeve")) {
      const transform = regionTransform(sleeve);
      expect(applyAffine(transform, 150, 60)[1]).toBeCloseTo(applyAffine(transform, 150, 120)[1], 6);
    }
  });

  it("keeps every view, hem included, inside the 2D pattern square", () => {
    for (const drawn of FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part !== "sock" && candidate.part !== "shorts")) {
      const inverse = invert(regionTransform(drawn));
      for (const rect of [drawn.rect, ...(drawn.hem ? [drawn.hem] : [])]) {
        const { left, top, right, bottom } = edges(rect);
        for (const [x, y] of [
          [left, top],
          [right, top],
          [left, bottom],
          [right, bottom],
        ] as const) {
          const [patternX, patternY] = applyAffine(inverse, x, y);
          for (const value of [patternX, patternY]) {
            expect(value, `${drawn.part} ${drawn.side}`).toBeGreaterThanOrEqual(-1e-6);
            expect(value, `${drawn.part} ${drawn.side}`).toBeLessThanOrEqual(SHIRT_2D_VIEWBOX + 1e-6);
          }
        }
      }
    }
  });

  it.each(["sock", "shorts"] as const)("has no pattern view for the %s", (part) => {
    expect(() => regionTransform(region(part, "right"))).toThrow(`Region "${part}" has no pattern view`);
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
