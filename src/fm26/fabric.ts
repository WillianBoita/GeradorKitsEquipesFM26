import { FM26_TEXTURE_SIZE, rect, type UvRect } from "./layout.js";

// Bloco de alfa em pixels da textura de 1024: uma string por linha, um dígito hex por pixel (alfa = dígito × 17).
export interface AlphaTile {
  width: number;
  height: number;
  rows: string[];
}

export const MESH_TONES = ["black", "white"] as const;
export type MeshTone = (typeof MESH_TONES)[number];

export interface MeshZone {
  piece: "sock" | "shorts";
  // Lado direito do jogador (esquerda da textura) primeiro; o bloco é ancorado no canto superior esquerdo de cada retângulo.
  rects: [UvRect, UvRect];
  tiles: Record<MeshTone, AlphaTile>;
}

function tile(...rows: string[]): AlphaTile {
  return { width: rows[0]!.length, height: rows.length, rows };
}

function times(count: number, row: string): string[] {
  return Array.from({ length: count }, () => row);
}

// No PSD o outro lado é o mesmo desenho deslocado em x, não espelhado; o cós encosta na borda da textura.
function sides(x0: number, y0: number, x1: number, y1: number, shift: number): [UvRect, UvRect] {
  return [rect(x0, y0, x1, y1), rect(x0 + shift, y0, Math.min(x1 + shift, FM26_TEXTURE_SIZE), y1)];
}

const SOCK_SHIFT = 783;
const WAIST_SHIFT = 676;

// Camada "fabric texture" do blank_26_3d.psd (spec da 4d, seção 3.3): preto a 10/255, bloco que se repete a partir da origem da textura.
export const FM26_FABRIC: { opacity: number; tile: AlphaTile } = {
  opacity: 10 / 255,
  tile: tile(
    "f0000f0ff000000ff0",
    "f0ff000000ff0f0000",
    "00000ff0f0000f0ff0",
    "ff0f0000f0ff000000",
    "000f0ff000000ff0f0",
    "ff000000ff0f0000f0",
    "000ff0f0000f0ff000",
    "0f0000f0ff000000ff",
    "0f0ff000000ff0f000",
    "000000ff0f0000f0ff",
    "0ff0f0000f0ff00000",
    "0000f0ff000000ff0f",
    "0ff000000ff0f0000f",
    "0000ff0f0000f0ff00",
    "f0f0000f0ff000000f",
    "00f0ff000000ff0f00",
    "f000000ff0f0000f0f",
    "00ff0f0000f0ff0000",
  ),
};

// Camadas "mesh black" e "mesh white" (spec da 4d, seção 3.4), a 31/255: canelado das meias (listras, cruzinhas, listras) e cós do calção.
export const FM26_MESH: { opacity: number; zones: MeshZone[] } = {
  opacity: 31 / 255,
  zones: [
    { piece: "sock", rects: sides(7, 433, 234, 486, SOCK_SHIFT), tiles: { black: tile("9f03d30"), white: tile("00f0063") } },
    {
      piece: "sock",
      rects: sides(7, 486, 234, 630, SOCK_SHIFT),
      tiles: {
        black: tile("0ff0ff00", "00f0f000", "00f0f00f", "f0f0f0ff", "00f0f00f", "00f0f000"),
        white: tile("000f0000", "000f0ff0", "000f0f00", "000f0f00", "ff0f0f00", "f00f0f00"),
      },
    },
    { piece: "sock", rects: sides(7, 630, 234, 702, SOCK_SHIFT), tiles: { black: tile("309f03d"), white: tile("6300f00") } },
    {
      piece: "shorts",
      rects: sides(4, 775, 349, 800, WAIST_SHIFT),
      tiles: {
        black: tile(
          "09f80",
          ...times(2, "09f90"),
          "3afa3",
          "cefec",
          "1afa1",
          "09f90",
          "3afa3",
          "cefec",
          "1afa1",
          ...times(10, "09f90"),
          "3afa3",
          "cefec",
          "1afa1",
          "08f70",
          "02510",
        ),
        white: tile(
          "00000",
          "00008",
          "00009",
          "00004",
          "00000",
          "9000b",
          "1000a",
          "00004",
          "00000",
          "9000b",
          "1000a",
          ...times(9, "00009"),
          "00004",
          "00000",
          "9000b",
          "1001a",
          "00000",
        ),
      },
    },
  ],
};
