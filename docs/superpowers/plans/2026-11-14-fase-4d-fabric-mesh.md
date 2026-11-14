# Fase 4d — Trama do tecido e canelado na textura 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda textura 3D ganha a trama do tecido na camisa e o canelado nas meias e no cós do calção, medidos no template do FM26, sem mudar nenhum `kit.json`.

**Architecture:** Os blocos de alfa medidos no `blank_26_3d.psd` entram como dados em `src/fm26/fabric.ts`. Um módulo puro (`src/renderers/fabric-finish.ts`) transforma um bloco num `<pattern>` SVG e escolhe o tom do canelado pela cor da peça. O `renderKit3dSvg` desenha a trama e o canelado na posição do grupo `texture` do PSD: depois do desenho e das costuras da raglan, antes de punhos, gola e logos.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Sharp 0.35.5 (librsvg 2.63.2), Vitest, `fast-xml-parser` (só nos testes), tsx, Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-11-14-fase-4d-fabric-mesh-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova. O runtime nunca lê `docs/fm_templates/`.
- Sem flag e sem opção: `Render3dOptions` continua com `size` e `logos`; a CLI não muda.
- Nada vai para o `kit.json`; schemas, generator, validação, perfis, renderer 2D e `preview` não são tocados. Nenhuma chamada nova ao `rng`.
- `FM26_FABRIC.opacity = 10 / 255`; `FM26_MESH.opacity = 31 / 255`. Trama sempre preta (`#000000`); canelado `#000000` ou `#ffffff`.
- Bloco da trama: 18×18, ancorado na origem da textura. Blocos do canelado: ancorados no canto superior esquerdo de cada retângulo de zona.
- Zonas do canelado (px, semiaberto; esquerda da textura e o outro lado): `sockTop` x 7–234, y 433–486 e x 790–1017; `sockMid` y 486–630; `sockBase` y 630–702; `waist` x 4–349, y 775–800 e x 680–1024. Translação das meias +783, do cós +676, cortada em x = 1024.
- Alfa do bloco: um dígito hex por pixel, alfa = dígito × 17; no SVG, `fill-opacity = dígito / 15`, só abaixo de `f`; dígito `0` não gera retângulo.
- Tom do canelado: o de maior `contrastRatio` com a cor da peça (meia para as zonas de meia, calção para o cós); no empate, `black`.
- Ordem do SVG 3D: fundo, tronco, raglan, mangas, calção e meias; costuras da raglan; trama; canelado; punhos; gola. Logos compostos por cima do PNG.
- Testes de cor do 3D: em área com acabamento, a comparação aceita `Math.ceil(255 × opacity) + 1` de desvio por canal (11 na camisa, 32 nas zonas do canelado); punhos, gola, logos, calção fora do cós e fundo continuam com igualdade exata.
- As guardas `Phase 3b baseline` (`tests/renderers/renderer-2d.test.ts`, `tests/generator/kit-generator.test.ts`) passam sem edição.
- Renderers determinísticos; textura sempre opaca.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e nomes de teste em inglês, como no resto do código.
- Arquivos novos com a ferramenta de escrita, nunca com heredoc no shell.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.
- Linha de base antes da Task 1: 858 testes verdes em 33 arquivos, `npm run typecheck` limpo.
- `docs/superpowers/plans/2026-10-01-roadmap.md` tem uma alteração local do usuário ainda não commitada (linha da 4c, "Teste validado."). Não a descarte; a Task 5 edita o mesmo arquivo e o commit de documentação a inclui.

## Review Focus

- **Camisa preta.** Trama preta sobre preto não muda nada: a textura sai sem erro e o tronco continua exatamente preto. Teste na Task 3.
- **Camisa com padrão.** A trama cobre as duas cores do padrão, não só a cor base. Teste na Task 3 (`halves`).
- **`size` diferente de 1024.** `renderKit3dPng(kit, { size: 512 })` desenha a trama com antialias, dentro do desvio, e a textura continua opaca. Teste na Task 3.
- **Corte raglan.** O ombro pintado pela manga recebe a trama como o resto da camisa. Teste na Task 3.
- **Cor de meia de luminância média ou em hex de 3 dígitos.** `meshTone` sempre devolve um tom e não lança: cinza médio dá `black`, `#fff` dá `black`. Testes nas Tasks 2 e 4.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/fm26/fabric.ts` | Criar | `AlphaTile`, `MeshTone`, `MeshZone`, `FM26_FABRIC`, `FM26_MESH` (dados medidos no PSD) |
| `src/renderers/fabric-finish.ts` | Criar | `tilePatternSvg`, `meshTone`, `MESH_TONE_COLORS` (puro) |
| `src/renderers/renderer-3d.ts` | Modificar | `RegionSvg.defs`, `fabricSvg`, `meshSvg`, nova ordem do SVG |
| `tests/fm26/fabric.test.ts` | Criar | Forma e posição dos dados |
| `tests/renderers/fabric-finish.test.ts` | Criar | SVG do bloco e escolha do tom |
| `tests/renderers/renderer-3d.test.ts` | Modificar | Testes novos de trama e canelado; tolerância nos testes de cor atuais |
| `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar | Documentação (Task 5) |

---

### Task 1: Dados medidos no PSD (`src/fm26/fabric.ts`)

**Files:**
- Create: `src/fm26/fabric.ts`
- Test: `tests/fm26/fabric.test.ts`

**Interfaces:**
- Consumes: `FM26_TEXTURE_SIZE`, `rect(x0, y0, x1, y1): UvRect` e `type UvRect` de `src/fm26/layout.ts`.
- Produces:
  - `interface AlphaTile { width: number; height: number; rows: string[] }`
  - `const MESH_TONES = ["black", "white"] as const; type MeshTone`
  - `interface MeshZone { piece: "sock" | "shorts"; rects: [UvRect, UvRect]; tiles: Record<MeshTone, AlphaTile> }`
  - `const FM26_FABRIC: { opacity: number; tile: AlphaTile }`
  - `const FM26_MESH: { opacity: number; zones: MeshZone[] }` com 4 zonas, na ordem `sockTop`, `sockMid`, `sockBase`, `waist`.

- [ ] **Step 1: Medir o tamanho atual dos PNGs 3D (linha de base da Task 5)**

Antes de qualquer código, exporte para uma pasta à parte (ignorada pelo git):

```bash
npm run export -- --out output/size-before
du -cb output/size-before/*_3d.png | tail -1
```

Anote o total em bytes. Se o `export` falhar por causa de um clube inválido, anote o erro, siga sem a medição e diga isso no resumo final.

- [ ] **Step 2: Escrever o teste que falha**

Crie `tests/fm26/fabric.test.ts`:

```ts
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
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run tests/fm26/fabric.test.ts`
Expected: FAIL, não encontra `../../src/fm26/fabric.js`.

- [ ] **Step 4: Escrever os dados**

Crie `src/fm26/fabric.ts`:

```ts
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
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run tests/fm26/fabric.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 6: Formatar, conferir tipos e commitar**

```bash
npm run format
npm run typecheck
git add src/fm26/fabric.ts tests/fm26/fabric.test.ts
git commit -m "feat: add the FM26 fabric weave and mesh tiles" -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

Expected: `typecheck` sem erros.

---

### Task 2: Bloco em SVG e tom do canelado (`src/renderers/fabric-finish.ts`)

**Files:**
- Create: `src/renderers/fabric-finish.ts`
- Test: `tests/renderers/fabric-finish.test.ts`

**Interfaces:**
- Consumes: `type AlphaTile`, `type MeshTone` de `src/fm26/fabric.ts`; `contrastRatio(a: string, b: string): number` de `src/core/color.ts`.
- Produces:
  - `const MESH_TONE_COLORS: Record<MeshTone, string>` (`{ black: "#000000", white: "#ffffff" }`)
  - `function tilePatternSvg(id: string, tile: AlphaTile, origin: { x: number; y: number }, color: string): string`
  - `function meshTone(color: string): MeshTone`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/renderers/fabric-finish.test.ts`:

```ts
import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { FM26_FABRIC } from "../../src/fm26/fabric.js";
import { MESH_TONE_COLORS, meshTone, tilePatternSvg } from "../../src/renderers/fabric-finish.js";

describe("tilePatternSvg", () => {
  it("merges neighbours with the same digit, skips 0 and sets fill-opacity only below f", () => {
    const tile = { width: 5, height: 2, rows: ["0ff09", "33000"] };
    expect(tilePatternSvg("p", tile, { x: 7, y: 433 }, "#ffffff")).toBe(
      '<pattern id="p" x="7" y="433" width="5" height="2" patternUnits="userSpaceOnUse"><g fill="#ffffff" shape-rendering="crispEdges">' +
        '<rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="1" height="1" fill-opacity="0.6"/><rect x="0" y="1" width="2" height="1" fill-opacity="0.2"/>' +
        "</g></pattern>",
    );
  });

  it("keeps neighbours with different digits apart", () => {
    const svg = tilePatternSvg("p", { width: 3, height: 1, rows: ["9f9"] }, { x: 0, y: 0 }, "#000000");
    expect(svg.match(/<rect /g)).toHaveLength(3);
  });

  it("draws an empty tile as an empty pattern", () => {
    expect(tilePatternSvg("p", { width: 2, height: 1, rows: ["00"] }, { x: 0, y: 0 }, "#000000")).toBe(
      '<pattern id="p" x="0" y="0" width="2" height="1" patternUnits="userSpaceOnUse"><g fill="#000000" shape-rendering="crispEdges"></g></pattern>',
    );
  });

  it("turns the fabric tile into valid SVG with one rect per run of the weave", () => {
    const svg = tilePatternSvg("fabric", FM26_FABRIC.tile, { x: 0, y: 0 }, "#000000");
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).not.toContain("fill-opacity");
    const widths = [...svg.matchAll(/<rect x="\d+" y="\d+" width="(\d+)" height="1"\/>/g)].map((match) => Number(match[1]));
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(108);
  });
});

describe("meshTone", () => {
  it("names the two colors of the PSD layers", () => {
    expect(MESH_TONE_COLORS).toEqual({ black: "#000000", white: "#ffffff" });
  });

  it.each([
    ["#ffffff", "black"],
    ["#ffd700", "black"],
    ["#808080", "black"],
    ["#fff", "black"],
    ["#000000", "white"],
    ["#123456", "white"],
    ["#595959", "white"],
  ] as const)("picks for %s the %s mesh", (color, tone) => {
    expect(meshTone(color)).toBe(tone);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run tests/renderers/fabric-finish.test.ts`
Expected: FAIL, não encontra `../../src/renderers/fabric-finish.js`.

- [ ] **Step 3: Escrever o módulo**

Crie `src/renderers/fabric-finish.ts`:

```ts
import { contrastRatio } from "../core/color.js";
import type { AlphaTile, MeshTone } from "../fm26/fabric.js";

export const MESH_TONE_COLORS: Record<MeshTone, string> = { black: "#000000", white: "#ffffff" };

// Um retângulo de 1 px de altura por sequência de pixels com o mesmo alfa; crispEdges mantém o bloco sem antialias na textura de 1024.
export function tilePatternSvg(id: string, tile: AlphaTile, origin: { x: number; y: number }, color: string): string {
  const rects = tile.rows.flatMap((row, y) =>
    [...row.matchAll(/([1-9a-f])\1*/g)].map((run) => {
      const digit = parseInt(run[1]!, 16);
      return `<rect x="${run.index}" y="${y}" width="${run[0].length}" height="1"${digit < 15 ? ` fill-opacity="${digit / 15}"` : ""}/>`;
    }),
  );

  return `<pattern id="${id}" x="${origin.x}" y="${origin.y}" width="${tile.width}" height="${tile.height}" patternUnits="userSpaceOnUse"><g fill="${color}" shape-rendering="crispEdges">${rects.join("")}</g></pattern>`;
}

// Preto em peça clara e branco em peça escura, como as duas camadas do PSD; no empate fica o preto, que é a camada visível.
export function meshTone(color: string): MeshTone {
  return contrastRatio(color, MESH_TONE_COLORS.white) > contrastRatio(color, MESH_TONE_COLORS.black) ? "white" : "black";
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run tests/renderers/fabric-finish.test.ts`
Expected: PASS, 12 testes.

- [ ] **Step 5: Formatar, conferir tipos e commitar**

```bash
npm run format
npm run typecheck
git add src/renderers/fabric-finish.ts tests/renderers/fabric-finish.test.ts
git commit -m "feat: turn an alpha tile into an SVG pattern and pick the mesh tone" -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 3: Trama na textura 3D

**Files:**
- Modify: `src/renderers/renderer-3d.ts`
- Test: `tests/renderers/renderer-3d.test.ts`

**Interfaces:**
- Consumes: `FM26_FABRIC` e `type AlphaTile` (Task 1); `tilePatternSvg(id, tile, origin, color)` (Task 2).
- Produces: `RegionSvg` com o campo `defs` no lugar de `clip` (interface privada do arquivo); `fabricSvg(): RegionSvg`; nos testes, `FABRIC_DRIFT`, `expectNear`, `type Box`, `tileDeviation`, `flatDeviation` e `weave`, que a Task 4 reusa.

- [ ] **Step 1: Acrescentar os auxiliares de teste**

Em `tests/renderers/renderer-3d.test.ts`, acrescente o import depois do import de `KitDefinition`:

```ts
import { FM26_FABRIC, type AlphaTile } from "../../src/fm26/fabric.js";
```

Depois da função `boxCenter`, acrescente:

```ts
// Desvio máximo que a trama põe num canal: a opacidade da camada sobre branco puro, mais 1 nível de arredondamento.
const FABRIC_DRIFT = Math.ceil(255 * FM26_FABRIC.opacity) + 1;

function expectNear(actual: number[], color: number[], drift: number, label?: string): void {
  expect(channelDistance(actual, color), label).toBeLessThanOrEqual(drift);
}

type Box = [x0: number, y0: number, x1: number, y1: number];

// Maior diferença entre a caixa da textura e o bloco ancorado em origin: cada pixel é a cor base misturada com o tom na opacidade da camada vezes dígito / 15.
function tileDeviation(texture: Raster, [x0, y0, x1, y1]: Box, tile: AlphaTile, origin: [number, number], base: number[], tone: number, opacity: number) {
  let worst = 0;
  let painted = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const digit = parseInt(tile.rows[(y - origin[1]) % tile.height]![(x - origin[0]) % tile.width]!, 16);
      const alpha = (opacity * digit) / 15;
      const want = [...base.slice(0, 3).map((value) => Math.round(value + (tone - value) * alpha)), 255];
      worst = Math.max(worst, channelDistance(pixel(texture, x, y), want));
      if (digit > 0) painted++;
    }
  }
  return { worst, painted };
}

function flatDeviation(texture: Raster, [x0, y0, x1, y1]: Box, color: number[]): number {
  let worst = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) worst = Math.max(worst, channelDistance(pixel(texture, x, y), color));
  return worst;
}

const weave = (texture: Raster, box: Box, base: number[]) => tileDeviation(texture, box, FM26_FABRIC.tile, [0, 0], base, 0, FM26_FABRIC.opacity);
```

- [ ] **Step 2: Escrever os testes novos, que falham**

No `describe("renderKit3dSvg", ...)`, depois do teste `"draws the raglan yoke and seams only on raglan sleeves"`, acrescente:

```ts
  // Pilha do PSD: o grupo "texture" fica acima das costuras das mangas e abaixo de punhos e gola.
  it("draws the fabric after the raglan seams and before the cuffs and the collar", () => {
    const svg = renderKit3dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }));
    const fabric = svg.indexOf('fill="url(#fabric)"');
    expect(svg).toContain('<clipPath id="fabric-area">');
    expect(fabric).toBeGreaterThan(svg.lastIndexOf('stroke-opacity="0.2"'));
    expect(fabric).toBeLessThan(svg.indexOf('stroke-width="26"'));
    expect(fabric).toBeLessThan(svg.indexOf('fill-rule="evenodd"'));
  });
```

No `describe("renderKit3dPng", ...)`, depois do teste `"is opaque everywhere"`, acrescente:

```ts
  // makeKit(): corpo e mangas primary, punhos e gola accent, calção secondary, meias primary.
  const SHIRT_BOXES: [string, Box][] = [
    ["front", [420, 700, 500, 760]],
    ["back", [420, 250, 500, 310]],
    ["front hem", [420, 1005, 500, 1018]],
    ["back hem", [420, 118, 500, 133]],
    ["right short sleeve", [280, 480, 340, 540]],
    ["left short sleeve", [690, 480, 750, 540]],
    ["right armhole strip", [362, 480, 384, 540]],
    ["right long sleeve", [100, 100, 180, 160]],
    ["left long sleeve", [840, 100, 920, 160]],
  ];

  it("weaves the fabric over the whole shirt exactly as the tile", async () => {
    const texture = await raster(await renderKit3dPng(makeKit()));
    for (const [part, box] of SHIRT_BOXES) expect(weave(texture, box, PRIMARY).worst, part).toBeLessThanOrEqual(1);
  });

  it("keeps the weave off the cuffs, the collar, the shorts, the socks and the space outside the islands", async () => {
    const texture = await raster(await renderKit3dPng(makeKit()));
    const plain: [string, Box, number[]][] = [
      ["right cuff", [246, 480, 268, 540], ACCENT],
      ["left cuff", [758, 480, 779, 540], ACCENT],
      ["right long cuff", [3, 100, 24, 160], ACCENT],
      ["left long cuff", [1000, 100, 1021, 160], ACCENT],
      ["collar", [470, 592, 477, 603], ACCENT],
      ["shorts", [100, 850, 180, 910], SECONDARY],
      ["foot of the sock", [100, 704, 180, 714], PRIMARY],
      ["outside the islands", [420, 20, 500, 80], PRIMARY],
    ];
    for (const [part, box, color] of plain) expect(flatDeviation(texture, box, color), part).toBe(0);
  });

  it("leaves a black shirt untouched: black fabric on black", async () => {
    const texture = await raster(await renderKit3dPng(makeKit({ colors: { primary: "#000000", secondary: "#ffffff", accent: "#ffd700" } })));
    expect(flatDeviation(texture, [420, 700, 500, 760], [0, 0, 0, 255])).toBe(0);
  });

  it("weaves over both colors of a patterned shirt", async () => {
    const texture = await raster(await renderKit3dPng(patternKit("halves")));
    const boxes: Box[] = [
      [400, 800, 440, 840],
      [590, 800, 630, 840],
    ];
    const bases = boxes.map((box) => [PRIMARY, SECONDARY].find((base) => weave(texture, box, base).worst <= 1));
    expect(new Set(bases)).toEqual(new Set([PRIMARY, SECONDARY]));
  });

  it("weaves over the raglan yoke", async () => {
    const texture = await raster(await renderKit3dPng(makeKit({ sleeves: { style: "solid", cut: "raglan", color: "accent", cuffColor: "secondary" } })));
    expect(weave(texture, [412, 574, 424, 586], ACCENT).worst).toBeLessThanOrEqual(1);
  });

  it("keeps the weave within its drift at half size", async () => {
    const texture = await raster(await renderKit3dPng(makeKit(), { size: 512 }));
    let changed = 0;
    for (let y = 350; y < 380; y++) {
      for (let x = 210; x < 250; x++) {
        const color = pixel(texture, x, y);
        expectNear(color, PRIMARY, FABRIC_DRIFT, `${x},${y}`);
        if (channelDistance(color, PRIMARY) > 0) changed++;
      }
    }
    expect(changed).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Rodar e ver os testes novos falharem**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: FAIL em `"draws the fabric after the raglan seams..."`, `"weaves the fabric over the whole shirt..."`, `"weaves over both colors..."`, `"weaves over the raglan yoke"` e `"keeps the weave within its drift at half size"` (ainda não há trama). `"keeps the weave off..."` e `"leaves a black shirt untouched..."` passam desde já: eles protegem contra trama no lugar errado. Os testes antigos continuam verdes.

- [ ] **Step 4: Desenhar a trama no renderer**

Em `src/renderers/renderer-3d.ts`:

a) Acrescente os imports (em ordem alfabética de caminho, como os outros):

```ts
import { FM26_FABRIC } from "../fm26/fabric.js";
```

logo depois do import de `../fm26/collars.js`, e

```ts
import { tilePatternSvg } from "./fabric-finish.js";
```

logo antes do import de `./kit-design.js`.

b) Troque a interface `RegionSvg` (o campo passa a levar também os `<pattern>`):

```ts
interface RegionSvg {
  defs?: string;
  body: string;
}
```

c) Em `patternRegion`, troque os dois retornos:

```ts
  if (!region.outline) return { defs: clip, body };

  return {
    defs: `${clip}<clipPath id="${id}-outline"><path d="${shapePath(region.outline, true)}"/></clipPath>`,
    body: `<g clip-path="url(#${id}-outline)">${body}</g>`,
  };
```

d) Em `raglanSvg`, troque o retorno final:

```ts
  return {
    defs: `<clipPath id="raglan"><path d="${yoke}"/></clipPath>${torso.map((part) => part.defs ?? "").join("")}`,
    body: `<g clip-path="url(#raglan)">${torso.map((part) => part.body).join("")}</g>`,
  };
```

e) Em `collarSvg`, troque o retorno final:

```ts
  return {
    defs: `<clipPath id="collar"><path d="${band}" clip-rule="evenodd"/></clipPath>`,
    body: `${fill}<g clip-path="url(#collar)">${stripeStrokesSvg(outer, strokes, { stripe: stripe.color, trim: design.collar }, ' stroke-linejoin="round"')}</g>${placket}`,
  };
```

f) Depois de `isTorso`, acrescente:

```ts
function isShirt(region: UvRegion): boolean {
  return isTorso(region) || region.part === "sleeve" || region.part === "longSleeve";
}
```

g) Antes de `renderKit3dSvg`, acrescente:

```ts
// Camada "fabric texture" do PSD: preto em baixa opacidade sobre a camisa inteira, recortado pelas ilhas do layout (a barra entra; a manga curta vai até a cava).
function fabricSvg(): RegionSvg {
  const texture = FM26_TEXTURE_SIZE;
  const area = FM26_KIT_LAYOUT.regions
    .filter(isShirt)
    .map((region) => {
      if (region.outline) return `<path d="${shapePath(region.outline, true)}"/>`;

      return `<rect ${rectAttributes(region.rect)}/>${region.hem ? `<rect ${rectAttributes(region.hem)}/>` : ""}`;
    })
    .join("");

  return {
    defs: `<clipPath id="fabric-area">${area}</clipPath>${tilePatternSvg("fabric", FM26_FABRIC.tile, { x: 0, y: 0 }, "#000000")}`,
    body: `<rect width="${texture}" height="${texture}" fill="url(#fabric)" fill-opacity="${FM26_FABRIC.opacity}" clip-path="url(#fabric-area)"/>`,
  };
}
```

h) Em `renderKit3dSvg`, troque do `const collar = ...` até o fim da função:

```ts
  const collar = collarSvg(kit.collar.style, design);
  const fabric = fabricSvg();

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${[...parts, fabric, collar].map((part) => part.defs ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...(raglanCut ? raglan.seams.map((seam) => `<path d="${shapePath(seam, false)}" ${SEAM_STROKE}/>`) : []),
    // Grupo "texture" do PSD: acima do desenho e das costuras das mangas, abaixo de punhos, gola e logos.
    fabric.body,
    ...cuffs.map((cuff) => cuffSvg(cuff, design)),
    collar.body,
    "</svg>",
  ].join("");
```

Confira que não sobrou nenhum `.clip` nem `clip:` de `RegionSvg` no arquivo: `grep -n "\.clip\b\|clip:" src/renderers/renderer-3d.ts` não deve listar nada.

- [ ] **Step 5: Rodar e ver os testes novos passarem e os de cor antigos falharem**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: os 7 testes novos PASS. Falham os testes antigos que comparam com igualdade exata pixels da camisa, agora com trama (o Step 6 lista todos).

- [ ] **Step 6: Dar aos testes de cor antigos o desvio da trama**

Regra (spec, seção 7): comparação em área da camisa aceita `FABRIC_DRIFT`; punhos, gola, logos, calção, meias e fundo continuam exatos. Em `tests/renderers/renderer-3d.test.ts`:

a) `"paints every part with its color"`: troque a tabela e o laço.

```ts
    const expected: [string, number, number, number[], number][] = [
      ["front", 512, 900, PRIMARY, FABRIC_DRIFT],
      ["back", 512, 300, PRIMARY, FABRIC_DRIFT],
      ["front hem", 512, 1011, PRIMARY, FABRIC_DRIFT],
      ["outside the islands", 512, 60, PRIMARY, 0],
      ["right short sleeve", 310, 650, SECONDARY, FABRIC_DRIFT],
      ["left short sleeve", 730, 650, SECONDARY, FABRIC_DRIFT],
      ["right long sleeve", 178, 163, SECONDARY, FABRIC_DRIFT],
      ["left long sleeve", 846, 163, SECONDARY, FABRIC_DRIFT],
      ["right cuff", 257, 560, ACCENT, 0],
      ["left cuff", 768, 560, ACCENT, 0],
      ["right long cuff", 13, 150, ACCENT, 0],
      ["left long cuff", 1010, 150, ACCENT, 0],
      ["collar", 555, 597, ACCENT, 0],
      ["collar", 477, 597, ACCENT, 0],
      ["right shorts", 177, 896, ACCENT, 0],
      ["left shorts", 850, 896, ACCENT, 0],
      ["right sock", 120, 573, SECONDARY, 0],
      ["left sock", 903, 573, SECONDARY, 0],
    ];
    for (const [part, x, y, color, drift] of expected) expectNear(pixel(texture, x, y), color, drift, part);
```

b) `"continues the pattern into the front and back hems"`: troque as duas comparações do laço.

```ts
      expectNear(pixel(texture, x, 1011), pixel(texture, x, 990), FABRIC_DRIFT, `front ${x}`);
      expectNear(pixel(texture, x, 126), pixel(texture, x, 145), FABRIC_DRIFT, `back ${x}`);
```

c) `"mirrors the front onto the back across y = 569 with %s"`: a tolerância do antialias soma a da trama.

```ts
        expect(channelDistance(front, pixel(texture, x, 1137 - y)), `${x},${y}`).toBeLessThanOrEqual(32 + FABRIC_DRIFT);
```

d) `"runs match-body stripes from the shoulder to the cuff"`: troque as duas comparações do laço.

```ts
      expectNear(pixel(texture, 280, y), shoulder, FABRIC_DRIFT, `y ${y}`);
      // A faixa da cava continua a manga (x 375 fica dentro dela até y ≈ 690).
      if (y < 680) expectNear(pixel(texture, 375, y), shoulder, FABRIC_DRIFT, `armhole y ${y}`);
```

e) `"takes each match-body sleeve from its own side of the 2D shirt"`: troque a última linha.

```ts
    for (const [side, color, points] of sleeves) for (const [x, y] of points) expectNear(pixel(texture, x, y), color, FABRIC_DRIFT, `${side} ${x},${y}`);
```

f) `"draws the detail layers on the front and the back but not on the sleeves"`: troque as três comparações.

```ts
      expectNear(pixel(texture, x, y), ACCENT, FABRIC_DRIFT, `${x},${y}`);
```

```ts
    expectNear(pixel(texture, 314, 500), PRIMARY, FABRIC_DRIFT);
    expectNear(pixel(texture, 710, 500), PRIMARY, FABRIC_DRIFT);
```

g) `"paints the armhole strip with the sleeve color"`: troque as três comparações.

```ts
      expectNear(pixel(texture, x, y), ACCENT, FABRIC_DRIFT, `${x},${y}`);
```

```ts
    expectNear(pixel(texture, 400, 460), PRIMARY, FABRIC_DRIFT);
    expectNear(pixel(texture, 623, 460), PRIMARY, FABRIC_DRIFT);
```

h) `"paints the raglan yoke with the solid sleeve color, and only on raglan sleeves"`: troque as três comparações.

```ts
      expectNear(pixel(raglan, x, y), ACCENT, FABRIC_DRIFT, `raglan ${x},${y}`);
      expectNear(pixel(setIn, x, y), PRIMARY, FABRIC_DRIFT, `set-in ${x},${y}`);
```

```ts
    expectNear(pixel(raglan, 420, 520), PRIMARY, FABRIC_DRIFT);
```

i) `"keeps the detail layers off the raglan yoke of match-body sleeves"`: troque as três comparações.

```ts
    expectNear(pixel(setIn, 397, 498), ACCENT, FABRIC_DRIFT);
    expectNear(pixel(raglan, 397, 498), PRIMARY, FABRIC_DRIFT);
    expectNear(pixel(raglan, 420, 498), ACCENT, FABRIC_DRIFT);
```

j) `"draws the %s collar"`: a gola continua exata; só o miolo, que mostra o tronco, ganha o desvio.

```ts
    for (const [x, y] of anchors) expect(pixel(texture, x, y), `${x},${y}`).toEqual(ACCENT);
    expectNear(pixel(texture, 514, 597), PRIMARY, FABRIC_DRIFT);
```

k) `"stops the round collar above the point of the v-neck"`:

```ts
    expectNear(pixel(await raster(await renderKit3dPng(makeKit())), 514, 648), PRIMARY, FABRIC_DRIFT);
```

Não mexa nos testes de listras da gola e dos punhos, nos de logos, nem em `"scales the stripes with the texture size"`: todos amostram peças que ficam acima da trama.

- [ ] **Step 7: Rodar o arquivo e a suíte**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: PASS em todos.

Se ainda falhar algum teste antigo que não está na lista do Step 6, veja o que ele amostra: se for área da camisa, aplique `expectNear` com `FABRIC_DRIFT`; se for punho, gola, logo, calção, meia ou fundo, o teste está certo e o defeito é da trama (recorte ou ordem). Não afrouxe esses.

Run: `npm test`
Expected: PASS, 858 + 7 (Task 1) + 12 (Task 2) + 7 (Task 3) = 884 testes.

- [ ] **Step 8: Formatar, conferir tipos e commitar**

```bash
npm run format
npm run typecheck
git add src/renderers/renderer-3d.ts tests/renderers/renderer-3d.test.ts
git commit -m "feat: weave the FM26 fabric texture over the shirt on the 3D texture" -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 4: Canelado das meias e do cós na textura 3D

**Files:**
- Modify: `src/renderers/renderer-3d.ts`
- Test: `tests/renderers/renderer-3d.test.ts`

**Interfaces:**
- Consumes: `FM26_MESH`, `type MeshTone` (Task 1); `MESH_TONE_COLORS`, `meshTone(color)`, `tilePatternSvg` (Task 2); `RegionSvg` com `defs`, `rectAttributes`, e nos testes `Box`, `tileDeviation`, `flatDeviation`, `expectNear` (Task 3).
- Produces: `meshSvg(design: KitDesign): RegionSvg`; padrões com id `mesh-<zona>-<lado>` (zona 0–3, lado 0–1).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/renderers/renderer-3d.test.ts`, troque o import de `fabric.js` e acrescente o do layout:

```ts
import { FM26_FABRIC, FM26_MESH, type AlphaTile, type MeshTone } from "../../src/fm26/fabric.js";
import type { UvRect } from "../../src/fm26/layout.js";
```

Depois da constante `weave`, acrescente:

```ts
const MESH_DRIFT = Math.ceil(255 * FM26_MESH.opacity) + 1;

const zoneBox = (rect: UvRect): Box => [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].map((value) => Math.round(value * KIT_3D_SIZE)) as Box;

// Uma medida por lado da zona; o bloco é ancorado no canto do retângulo.
function mesh(texture: Raster, zoneIndex: number, tone: MeshTone, base: number[]) {
  const zone = FM26_MESH.zones[zoneIndex]!;
  return zone.rects.map((rect) => {
    const box = zoneBox(rect);
    return tileDeviation(texture, box, zone.tiles[tone], [box[0], box[1]], base, tone === "black" ? 0 : 255, FM26_MESH.opacity);
  });
}

const meshKit = (socks: "primary" | "secondary", shorts: "primary" | "secondary"): KitDefinition => makeKit({ socks: { color: socks }, shorts: { color: shorts } });
```

No `describe("renderKit3dSvg", ...)`, depois do teste `"draws the fabric after the raglan seams and before the cuffs and the collar"`, acrescente:

```ts
  it("draws one mesh pattern per zone and side, after the fabric and before the cuffs", () => {
    const svg = renderKit3dSvg(makeKit());
    expect(svg.match(/<pattern id="mesh-\d-\d"/g)).toEqual(["0-0", "0-1", "1-0", "1-1", "2-0", "2-1", "3-0", "3-1"].map((id) => `<pattern id="mesh-${id}"`));
    const first = svg.indexOf('fill="url(#mesh-0-0)"');
    expect(first).toBeGreaterThan(svg.indexOf('fill="url(#fabric)"'));
    expect(svg.indexOf('fill="url(#mesh-3-1)"')).toBeLessThan(svg.indexOf('stroke-width="26"'));
  });
```

No `describe("renderKit3dPng", ...)`, depois do teste `"keeps the weave within its drift at half size"`, acrescente:

```ts
  it.each([
    ["black on light socks", "secondary", "black", SECONDARY],
    ["white on dark socks", "primary", "white", PRIMARY],
  ] as const)("ribs the socks in %s", async (_label, role, tone, base) => {
    const texture = await raster(await renderKit3dPng(meshKit(role, "secondary")));
    for (const zoneIndex of [0, 1, 2]) {
      for (const [side, { worst, painted }] of mesh(texture, zoneIndex, tone, base).entries()) {
        expect(worst, `zone ${zoneIndex} side ${side}`).toBeLessThanOrEqual(1);
        expect(painted, `zone ${zoneIndex} side ${side}`).toBeGreaterThan(0);
      }
    }
  });

  it("tones the waistband by the shorts, apart from the socks", async () => {
    const lightShorts = await raster(await renderKit3dPng(meshKit("primary", "secondary")));
    for (const { worst } of mesh(lightShorts, 3, "black", SECONDARY)) expect(worst).toBeLessThanOrEqual(1);
    for (const { worst } of mesh(lightShorts, 0, "white", PRIMARY)) expect(worst).toBeLessThanOrEqual(1);
    const darkShorts = await raster(await renderKit3dPng(meshKit("secondary", "primary")));
    for (const { worst } of mesh(darkShorts, 3, "white", PRIMARY)) expect(worst).toBeLessThanOrEqual(1);
    for (const { worst } of mesh(darkShorts, 0, "black", SECONDARY)) expect(worst).toBeLessThanOrEqual(1);
  });

  it("leaves the foot of the sock and the shorts outside the waistband plain", async () => {
    const texture = await raster(await renderKit3dPng(meshKit("secondary", "secondary")));
    const plain: [string, Box][] = [
      ["right foot", [7, 702, 234, 716]],
      ["left foot", [790, 702, 1017, 716]],
      ["right shorts above the waistband", [4, 774, 349, 775]],
      ["right shorts", [4, 800, 349, 1018]],
      ["left shorts", [680, 800, 1024, 1018]],
    ];
    for (const [part, box] of plain) expect(flatDeviation(texture, box, SECONDARY), part).toBe(0);
  });

  it("ribs mid-gray socks in black", async () => {
    const kit = makeKit({ colors: { primary: "#123456", secondary: "#ffffff", accent: "#808080" }, socks: { color: "accent" } });
    const texture = await raster(await renderKit3dPng(kit));
    for (const { worst } of mesh(texture, 1, "black", [0x80, 0x80, 0x80, 255])) expect(worst).toBeLessThanOrEqual(1);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: FAIL em `"draws one mesh pattern per zone and side..."`, nos dois `"ribs the socks in ..."`, em `"tones the waistband by the shorts..."` e em `"ribs mid-gray socks in black"` (ainda não há canelado). `"leaves the foot of the sock..."` passa desde já.

- [ ] **Step 3: Desenhar o canelado no renderer**

Em `src/renderers/renderer-3d.ts`:

a) Troque os imports da Task 3:

```ts
import { FM26_FABRIC, FM26_MESH } from "../fm26/fabric.js";
```

```ts
import { MESH_TONE_COLORS, meshTone, tilePatternSvg } from "./fabric-finish.js";
```

b) Depois de `fabricSvg`, acrescente:

```ts
// Camadas "mesh" do PSD: preto em peça clara, branco em peça escura; o tom das meias e o do cós são independentes.
function meshSvg(design: KitDesign): RegionSvg {
  const size = FM26_TEXTURE_SIZE;
  const drawn = FM26_MESH.zones.flatMap((zone, zoneIndex) => {
    const tone = meshTone(zone.piece === "sock" ? design.socks : design.shorts);

    return zone.rects.map((rect, sideIndex) => {
      const id = `mesh-${zoneIndex}-${sideIndex}`;

      return {
        defs: tilePatternSvg(id, zone.tiles[tone], { x: rect.x * size, y: rect.y * size }, MESH_TONE_COLORS[tone]),
        body: `<rect ${rectAttributes(rect)} fill="url(#${id})" fill-opacity="${FM26_MESH.opacity}"/>`,
      };
    });
  });

  return { defs: drawn.map((part) => part.defs).join(""), body: drawn.map((part) => part.body).join("") };
}
```

c) Em `renderKit3dSvg`, acrescente `mesh` aos `defs` e ao corpo:

```ts
  const fabric = fabricSvg();
  const mesh = meshSvg(design);
```

```ts
    `<defs>${[...parts, fabric, mesh, collar].map((part) => part.defs ?? "").join("")}</defs>`,
```

```ts
    // Grupo "texture" do PSD: acima do desenho e das costuras das mangas, abaixo de punhos, gola e logos.
    fabric.body,
    mesh.body,
```

- [ ] **Step 4: Rodar e ajustar o teste de cor das meias**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: os testes novos PASS; `"paints every part with its color"` FAIL nas meias, que agora têm canelado.

Em `"paints every part with its color"`, troque as duas linhas das meias:

```ts
      ["right sock", 120, 573, SECONDARY, MESH_DRIFT],
      ["left sock", 903, 573, SECONDARY, MESH_DRIFT],
```

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 884 + 6 (Task 4: 1 de SVG, 2 do `it.each`, 3 de PNG) = 890 testes.

- [ ] **Step 6: Formatar, conferir tipos e commitar**

```bash
npm run format
npm run typecheck
git add src/renderers/renderer-3d.ts tests/renderers/renderer-3d.test.ts
git commit -m "feat: rib the socks and the waistband with the FM26 mesh on the 3D texture" -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 5: Inspeção visual, tamanho dos PNGs e documentação

**Files:**
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: o renderer das Tasks 3 e 4; o total de bytes anotado na Task 1, Step 1.
- Produces: roadmap e `CLAUDE.md` atualizados; nada de código.

- [ ] **Step 1: Verificação completa**

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```

Expected: 890 testes verdes; os outros três sem erro. Se o `format:check` acusar CRLF num arquivo tocado, rode `sed -i 's/\r$//' <arquivo>` e repita.

- [ ] **Step 2: Medir o tamanho dos PNGs 3D**

```bash
npm run export -- --out output/size-after
du -cb output/size-after/*_3d.png | tail -1
```

Calcule o aumento percentual sobre o total anotado na Task 1, Step 1 (a estimativa da spec é cerca de 20%). Depois apague as duas pastas de medição, que este plano criou dentro de `output/` (ignorada pelo git):

```bash
rm -r output/size-before output/size-after
```

- [ ] **Step 3: Inspecionar as texturas**

Escolha um kit de camisa clara e um de camisa escura entre `clubs/*/kits/*/kit.json` (veja `colors` e `pattern.base`), de preferência com meia e calção de tons opostos. Para cada um, troque `<id>` e `<tipo>`:

```bash
npm run kit-generator -- render --definition clubs/<id>/kits/<tipo>/kit.json --out output/4d_3d.png --render 3d
node -e "import('sharp').then(({ default: sharp }) => Promise.all([sharp('output/4d_3d.png').extract({ left: 380, top: 620, width: 256, height: 192 }).resize({ width: 1024, kernel: 'nearest' }).toFile('output/4d_front.png'), sharp('output/4d_3d.png').extract({ left: 0, top: 420, width: 256, height: 400 }).resize({ width: 768, kernel: 'nearest' }).toFile('output/4d_sock.png')]))"
```

Abra `output/4d_3d.png`, `output/4d_front.png` e `output/4d_sock.png` e confira:

1. Trama na frente, sem cobrir gola nem logos; a borda da trama segue a cava e as ilhas.
2. Canelado na meia em três faixas (listras, cruzinhas, listras) e a faixa do cós no alto do calção, no tom oposto ao da peça.
3. Camisa escura: trama quase invisível, sem artefato.
4. Punhos lisos na cor do punho.

Se algo estiver errado, pare e corrija na task dona do código antes de documentar.

- [ ] **Step 4: Atualizar o roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md` (preserve a alteração local do usuário na linha da 4c):

a) No parágrafo "O guia descreve cinco fases...", troque o final `, Fase 4c (spec ..., plano `docs/superpowers/plans/2026-10-14-fase-4c-componentes-3d.md`).` por:

```
, Fase 4c (spec `docs/superpowers/specs/2026-10-14-fase-4c-componentes-3d-design.md`, plano `docs/superpowers/plans/2026-10-14-fase-4c-componentes-3d.md`) e Fase 4d (spec `docs/superpowers/specs/2026-11-14-fase-4d-fabric-mesh-design.md`, plano `docs/superpowers/plans/2026-11-14-fase-4d-fabric-mesh.md`).
```

b) Na tabela de status, troque a linha `| 4d — `fabric texture` e `mesh` | Pendente |` por (preencha a data do dia, o hash do commit da Task 4 e o percentual medido no Step 2):

```
| 4d — Trama do tecido e canelado na textura 3D (`fabric texture` e `mesh`) | **Concluída** (<data>, `dev` @ `<hash>`, 890 testes). Trama na camisa e canelado nas meias e no cós do calção em toda textura 3D, medidos no PSD, sem mudar nenhum `kit.json`; PNGs 3D <N>% maiores. Teste no jogo pendente |
```

c) Troque as duas linhas que começam com `Próximo passo:` por uma:

```
Próximo passo: teste da 4d no jogo (seção 9 da spec da 4d), com um novo `npm run export`. O resultado decide o que vem depois: ajuste da opacidade da trama, trama clara para camisa escura, costuras e contorno e sombra de gola, ou a Fase 4e (padrões por máscara).
```

d) Em "Limitações atuais (por desenho)", troque `a textura 3D não tem `fabric`/`mesh` (Fase 4d) nem contorno e sombra de gola.` por:

```
a textura 3D não tem costuras de camisa e calção nem contorno e sombra de gola; a trama é só preta e quase não aparece em camisa escura.
```

e) Na seção "Fase 4 — Componentes FM26 e acabamento 3D", no fim do item 2 (`... Vira a Fase 4d.`), acrescente:

```
 **Concluído na 4d:** a trama (`fabric texture`) cobre a camisa e o canelado (`mesh`) cobre as meias e o cós do calção, em toda textura, redesenhados no SVG a partir de blocos medidos no PSD. O `mesh` do PSD não toca a camisa.
```

- [ ] **Step 5: Atualizar o `CLAUDE.md`**

a) Em "Visão geral", troque `Estado atual: Fase 4c concluída (` por:

```
Estado atual: Fase 4d concluída (trama do tecido na camisa e canelado nas meias e no cós do calção em toda textura 3D, medidos no PSD, sem mudar nenhum `kit.json`), teste no jogo pendente; antes dela, a Fase 4c concluída e validada no jogo (
```

No mesmo parágrafo, troque `no 2D e no 3D), teste no jogo pendente; antes dela, a Fase 3c` por `no 2D e no 3D); antes dela, a Fase 3c`, e troque `a próxima é a Fase 4d (fabric texture e mesh).` por `o próximo passo é o teste da 4d no jogo (roadmap).`

b) Em "Arquitetura", depois do item `src/fm26/collars.ts`, acrescente:

```
- `src/fm26/fabric.ts`: `FM26_FABRIC` (trama da camisa: bloco de 18×18 ancorado na origem da textura, preto a 10/255) e `FM26_MESH` (canelado a 31/255: três zonas na meia e uma no cós do calção, cada uma com dois retângulos e um bloco por tom, `black` e `white`, ancorado no canto do retângulo), medidos nas camadas `fabric texture`, `mesh black` e `mesh white` do `blank_26_3d.psd`. Um bloco (`AlphaTile`) é uma string por linha com um dígito hex por pixel (alfa = dígito × 17). O outro lado de cada zona é o mesmo desenho deslocado em x (+783 nas meias, +676 no cós), não espelhado.
```

c) Depois do item `src/renderers/trim-stripes.ts`, acrescente:

```
- `src/renderers/fabric-finish.ts`: puro; `tilePatternSvg` transforma um bloco num `<pattern>` com `crispEdges` (um retângulo por sequência de pixels de mesmo alfa) e `meshTone(cor)` escolhe `black` ou `white` pelo maior contraste com a cor da peça (empate = `black`).
```

d) No item `src/renderers/renderer-3d.ts`, troque `costuras da raglan, punhos (traço na linha central, os quatro) e gola` por:

```
costuras da raglan, trama (recortada pelas regiões da camisa do layout) e canelado (tom pela cor da meia e pela do calção), punhos (traço na linha central, os quatro) e gola
```

No mesmo item, troque `calção e meias lisos` por `calção e meias lisos por baixo do canelado`, e no fim troque `logos só na frente.` por `logos só na frente. A ordem segue a pilha do PSD: punhos, gola e logos ficam sem trama.`

e) Em "Convenções e armadilhas", acrescente no fim:

```
- Trama e canelado entram em toda textura 3D, sem campo no `kit.json`, sem flag e sem sorteio: mudar `fabric.ts` muda as texturas sem mudar os kits. A 1024 os blocos saem sem antialias; em outro `size`, com antialias. Nos testes do renderer 3D, pixel de área com acabamento se compara com `expectNear` e `FABRIC_DRIFT` (camisa) ou `MESH_DRIFT` (zonas do canelado); punhos, gola, logos, calção fora do cós e fundo continuam com igualdade exata. A trama é preta: em camisa escura quase não aparece, e em camisa preta não aparece.
```

- [ ] **Step 6: Commitar a documentação**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document phase 4d" -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

No resumo final, diga que esse commit inclui a alteração local do usuário no roadmap (linha da 4c).

---

## Depois do plano: teste no jogo (com o usuário)

Não é uma task de código. Com um novo `npm run export` instalado na pasta do jogo, o usuário confere os itens da seção 9 da spec: trama em kit claro, kit escuro, canelado das meias, cós, punhos, gola e logos limpos, e cintilação de longe. O resultado entra no roadmap.
