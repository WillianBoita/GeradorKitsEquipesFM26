import { describe, expect, it } from "vitest";
import { FM26_FABRIC, FM26_MESH, MESH_TONES, type AlphaTile } from "../../src/fm26/fabric.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect } from "../../src/fm26/layout.js";

const pixels = (rect: UvRect) => [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].map((value) => value * FM26_TEXTURE_SIZE);

function expectWellFormed(tile: AlphaTile, label: string): void {
  expect(tile.rows, label).toHaveLength(tile.height);
  for (const row of tile.rows) expect(row, label).toMatch(new RegExp(`^[0-9a-f]{${tile.width}}$`));
}

describe("FM26_FABRIC", () => {
  it("keeps the PSD opacity and an 18x18 binary tile covering a third of the cells", () => {
    const { opacity, tile } = FM26_FABRIC;
    expect(opacity).toBe(10 / 255);
    expect([tile.width, tile.height]).toEqual([18, 18]);
    expectWellFormed(tile, "fabric");
    for (const row of tile.rows) expect(row).toMatch(/^[0f]+$/);
    expect(tile.rows.join("").replaceAll("0", "")).toHaveLength(108);
  });

  // A trama do PSD é a mesma linha deslocada 3 px a cada 3 linhas: pega erro de transcrição em qualquer linha.
  it("repeats the weave shifted 3 px every 3 rows", () => {
    const { rows } = FM26_FABRIC.tile;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]!;
      expect(rows[(y + 3) % rows.length], `row ${y}`).toBe(row.slice(-3) + row.slice(0, -3));
    }
  });
});

describe("FM26_MESH", () => {
  it("keeps the PSD opacity and four zones: three on the socks and the waistband", () => {
    expect(FM26_MESH.opacity).toBe(31 / 255);
    expect(FM26_MESH.zones.map((zone) => zone.piece)).toEqual(["sock", "sock", "sock", "shorts"]);
  });

  it("gives every zone a well-formed tile of the same size for each tone", () => {
    const sizes = FM26_MESH.zones.map((zone, index) => {
      for (const tone of MESH_TONES) expectWellFormed(zone.tiles[tone], `zone ${index} ${tone}`);
      expect([zone.tiles.white.width, zone.tiles.white.height], `zone ${index}`).toEqual([zone.tiles.black.width, zone.tiles.black.height]);
      return [zone.tiles.black.width, zone.tiles.black.height];
    });
    expect(sizes).toEqual([
      [7, 1],
      [8, 6],
      [7, 1],
      [5, 25],
    ]);
  });

  // Medidos no PSD (spec da 4d, seção 3.4): o outro lado é o mesmo desenho deslocado, não espelhado.
  it("puts the zones where the PSD has them, on both sides", () => {
    expect(FM26_MESH.zones.map((zone) => zone.rects.map(pixels))).toEqual([
      [
        [7, 433, 234, 486],
        [790, 433, 1017, 486],
      ],
      [
        [7, 486, 234, 630],
        [790, 486, 1017, 630],
      ],
      [
        [7, 630, 234, 702],
        [790, 630, 1017, 702],
      ],
      [
        [4, 775, 349, 800],
        [680, 775, 1024, 800],
      ],
    ]);
  });

  it("keeps every zone inside a layout region of its piece", () => {
    for (const [index, zone] of FM26_MESH.zones.entries()) {
      for (const rect of zone.rects) {
        const [x0, y0, x1, y1] = pixels(rect);
        const inside = FM26_KIT_LAYOUT.regions.some((region) => {
          const [left, top, right, bottom] = pixels(region.rect);
          return region.part === zone.piece && x0! >= left! && y0! >= top! && x1! <= right! && y1! <= bottom!;
        });
        expect(inside, `zone ${index} at x ${x0}`).toBe(true);
      }
    }
  });

  it("keeps the measured rows of the waistband", () => {
    const { black, white } = FM26_MESH.zones[3]!.tiles;
    expect(black.rows[0]).toBe("09f80");
    expect(black.rows[4]).toBe("cefec");
    expect(black.rows.slice(10, 20)).toEqual(Array.from({ length: 10 }, () => "09f90"));
    expect(black.rows[24]).toBe("02510");
    expect(white.rows[0]).toBe("00000");
    expect(white.rows.slice(11, 20)).toEqual(Array.from({ length: 9 }, () => "00009"));
    expect(white.rows[23]).toBe("1001a");
  });
});
