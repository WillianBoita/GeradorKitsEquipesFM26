# Fase 3c — Renderer 3D e 3D no export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada kit ganha uma textura 3D 1024×1024 na UV do FM26, com o mesmo visual do PNG 2D, e o `export` grava 2D e 3D com os registros `kits/` e `kit_textures/` no `config.xml`.

**Architecture:** Um módulo puro (`uv-mapping.ts`) calcula a matriz afim que leva o espaço do padrão 2D (viewBox 414) para cada ilha da UV: a frente recebe a janela do tronco 2D, as costas a mesma janela ancorada na barra e refletida em y ≈ 569, as mangas o topo do tronco girado 90°. O renderer 3D desenha `fillSvg` de `kitDesign` dentro dessas matrizes, recortado por ilha, e compõe os logos nas caixas 2D mapeadas na frente, com a composição de logos extraída do renderer 2D para um módulo compartilhado. A CLI escolhe o renderer pelo `renderType`; o exporter já é genérico.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Sharp, Zod 4, Vitest, `fast-xml-parser` (só nos testes), tsx, Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-07-fase-3c-renderer-3d-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova.
- O PNG 2D, os `kit.json` salvos, o generator e as seeds não mudam. As guardas `renderKit2dSvg Phase 3b baseline` (`acdafaa8…`) e `Phase 3b baseline` do generator ficam verdes do começo ao fim, sem mudar hash.
- Textura: `FM26_TEXTURE_SIZE = 1024`; `KIT_3D_SIZE = FM26_TEXTURE_SIZE`; `size` configurável só na API, sem flag na CLI.
- `TORSO_WINDOW = { x: 112, y: 48, width: 190, height: 334 }` no espaço do padrão 2D (barra em y = 382).
- Barras: frente x 357–668, y 1004–1018; costas x 357–668, y 118–134 (pixels da textura, intervalo semiaberto).
- `mirrored: true` só em `sleeve` e `longSleeve` do lado `left`; `rotation: 180` só em `back`.
- A transformação de cada região é a vista da parte, depois `mirrored`, depois `rotation`, depois a translação para o `rect`.
- Saída 3D: PNG RGBA com alfa 255 em todo pixel (fundo opaco na cor base do corpo).
- Logos 3D só na frente, nas caixas de `LOGO_BOXES` mapeadas pela transformação da frente; contorno `max(1, round(2 · ky · size / 1024))`.
- Gola: anel de `layout.collar` na cor da gola, sem estilo; corte raglan ignorado no 3D.
- Mensagem de render type inválido: `Invalid render type "<valor>": expected 2d or 3d`.
- Renderers determinísticos; nada de `rng` fora do generator.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e de log em inglês, como no resto da CLI.
- Arquivos novos com a ferramenta de escrita, nunca com heredoc no shell.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.

## Review Focus

- Kit com gola `polo`, `polo-v` ou `v-neck` e corte `raglan`: o usuário espera a mesma textura de um kit `round`/`set-in`, sem erro (estilo e corte ficam para a Fase 4). Teste na Task 4.
- Kit com `layers: []` escrito à mão: espera a mesma textura de um kit sem o campo. Teste na Task 4.
- `renderKit3dPng` com `size` diferente de 1024 e logo com contorno: espera o PNG no tamanho pedido, com os logos na mesma posição relativa. Teste na Task 4.
- `render --render 3d` de um kit com escudo e fabricante, lidos de `--clubs` e `--assets`: espera os dois logos na frente da textura. Teste na Task 5.
- `render --render 3D` (maiúscula) ou `--render 4d`: espera a mensagem de render type inválido, não um PNG 2D. Teste na Task 5.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/fm26/layout.ts` | Modificar | `hem` nas regiões de frente e costas, `mirrored` nas mangas esquerdas, sai `logos` |
| `tests/fm26/layout.test.ts` | Modificar | Barras e espelhamento; sai o teste das caixas de logo |
| `src/renderers/shirt-2d-shape.ts` | Modificar | Exporta `TORSO_WINDOW` |
| `src/renderers/uv-mapping.ts` | Criar | Matrizes afins por região e caixas de logo da frente (puro) |
| `tests/renderers/uv-mapping.test.ts` | Criar | Geometria do mapeamento |
| `src/renderers/kit-logos.ts` | Criar | `KitLogoImages` e `kitLogoLayers`, compartilhados pelos dois renderers |
| `src/renderers/renderer-2d.ts` | Modificar | Usa `kitLogoLayers` |
| `src/io/asset-repository.ts` | Modificar | Importa `KitLogoImages` de `kit-logos.ts` |
| `tests/renderers/renderer-2d.test.ts` | Modificar | Importa `KitLogoImages` de `kit-logos.ts` |
| `src/renderers/renderer-3d.ts` | Criar | SVG e PNG da textura 3D |
| `tests/renderers/renderer-3d.test.ts` | Criar | Pixels da textura |
| `src/fm26/naming.ts` | Modificar | `parseRenderType` |
| `tests/fm26/naming.test.ts` | Modificar | `parseRenderType` |
| `src/cli/run-cli.ts` | Modificar | `render --render`, `export` com 2D e 3D, `USAGE` |
| `tests/cli/run-cli.test.ts` | Modificar | `render --render 3d`, export com 3D |
| `CLAUDE.md`, `README.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar | Documentação da 3c |

---

### Task 1: Layout com barras e mangas esquerdas espelhadas

**Files:**
- Modify: `src/fm26/layout.ts`
- Test: `tests/fm26/layout.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `UvRegion.hem?: UvRect` (só `front` e `back`); `Fm26KitLayout` sem `logos` (`{ textureSize; regions; cuffs; collar }`); `mirrored: true` em `sleeve`/`longSleeve` com `side: "left"`.

- [ ] **Step 1: Atualizar os testes do layout**

Em `tests/fm26/layout.test.ts`:

Troque `allRects` por (as caixas de logo saem, as barras entram):

```ts
function allRects(): UvRect[] {
  return [...FM26_KIT_LAYOUT.regions.flatMap((region) => [region.rect, ...(region.hem ? [region.hem] : [])]), ...FM26_KIT_LAYOUT.cuffs];
}
```

Apague a função `contains` (fica sem uso).

Troque o teste `records the back as turned 180 degrees and every other region upright and unmirrored` por:

```ts
  it("records the back as turned 180 degrees and mirrors only the sleeves on the player's left", () => {
    for (const region of FM26_KIT_LAYOUT.regions) {
      const label = `${region.part} ${region.side}`;
      expect(region.rotation, label).toBe(region.part === "back" ? 180 : 0);
      expect(region.mirrored, label).toBe((region.part === "sleeve" || region.part === "longSleeve") && region.side === "left");
    }
  });
```

Troque o teste `keeps the logo boxes on the front` por:

```ts
  it("puts a hem right below the front and right above the back, and on no other region", () => {
    const torso = (part: string) => FM26_KIT_LAYOUT.regions.find((region) => region.part === part)!;
    const [front, back] = [torso("front"), torso("back")];
    expect(front.hem).toMatchObject({ x: front.rect.x, width: front.rect.width, y: front.rect.y + front.rect.height });
    expect(back.hem).toMatchObject({ x: back.rect.x, width: back.rect.width });
    expect(back.hem!.y + back.hem!.height).toBe(back.rect.y);
    for (const region of FM26_KIT_LAYOUT.regions.filter((candidate) => candidate.part !== "front" && candidate.part !== "back")) {
      expect(region.hem, `${region.part} ${region.side}`).toBeUndefined();
    }
  });

  it("never overlaps a hem with a region", () => {
    const hems = FM26_KIT_LAYOUT.regions.flatMap((region) => region.hem ?? []);
    for (const region of FM26_KIT_LAYOUT.regions) {
      for (const hem of hems) expect(overlaps(region.rect, hem), `${region.part} ${region.side}`).toBe(false);
    }
  });

  // As barras do template são faixas finas (y 126–133 e 1003–1013): o centro do retângulo com sobra cai nelas.
  it("puts the center of every hem on the thin strips of the labeled template", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "template.png"));
    for (const hem of FM26_KIT_LAYOUT.regions.flatMap((region) => region.hem ?? [])) {
      const [red, green, blue] = pixel(...centerPixel(hem));
      expect(red + green + blue).toBeGreaterThan(40);
    }
  });
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run tests/fm26/layout.test.ts`
Expected: FAIL. `mirrored` dá `false` nas mangas esquerdas e `hem` é `undefined`; o typecheck do Vitest pode acusar `hem` inexistente em `UvRegion`.

- [ ] **Step 3: Implementar o layout**

Substitua o conteúdo de `src/fm26/layout.ts` por:

```ts
// Fração 0–1 da textura.
export interface UvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UvPart = "front" | "back" | "sleeve" | "longSleeve" | "sock" | "shorts";

// rotation e mirrored transformam o desenho da região: primeiro espelha na horizontal, depois gira. side é o lado do jogador.
export interface UvRegion {
  part: UvPart;
  side?: "left" | "right";
  rect: UvRect;
  rotation: 0 | 180;
  mirrored: boolean;
  // Faixa da barra: recebe a continuação do desenho da região.
  hem?: UvRect;
}

export interface UvCircle {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

export interface Fm26KitLayout {
  textureSize: number;
  regions: UvRegion[];
  cuffs: UvRect[];
  collar: UvCircle;
}

export const FM26_TEXTURE_SIZE = 1024;

// Medido em pixels da textura 1024×1024 (intervalo semiaberto) e guardado em fração.
function rect(x0: number, y0: number, x1: number, y1: number): UvRect {
  return { x: x0 / FM26_TEXTURE_SIZE, y: y0 / FM26_TEXTURE_SIZE, width: (x1 - x0) / FM26_TEXTURE_SIZE, height: (y1 - y0) / FM26_TEXTURE_SIZE };
}

interface RegionOptions {
  side?: "left" | "right";
  rotation?: 0 | 180;
  mirrored?: boolean;
  hem?: UvRect;
}

function region(part: UvPart, area: UvRect, { side, rotation = 0, mirrored = false, hem }: RegionOptions = {}): UvRegion {
  return { part, ...(side === undefined ? {} : { side }), rect: area, rotation, mirrored, ...(hem === undefined ? {} : { hem }) };
}

export const FM26_KIT_LAYOUT: Fm26KitLayout = {
  textureSize: FM26_TEXTURE_SIZE,
  // Confirmado no jogo em 2026-10-06 (roadmap, "Calibração da UV"): metade de baixo da coluna é a frente, o lado esquerdo da textura é o lado direito do jogador, asas são a manga curta e cantos a manga comprida.
  regions: [
    // As faixas finas nas pontas da coluna são as barras: continuam o desenho do tronco, como nas máscaras do FM.
    region("front", rect(357, 598, 668, 1004), { hem: rect(357, 1004, 668, 1018) }),
    // "BOLID 74" do template aparece legível nas costas no jogo: giradas 180°, não espelhadas.
    region("back", rect(357, 134, 668, 598), { rotation: 180, hem: rect(357, 118, 668, 134) }),
    // A vista da manga põe o ombro à direita; as do lado esquerdo do jogador espelham para o ombro ficar junto à coluna. Orientação em x e metades B/F ainda não vistas no jogo.
    region("sleeve", rect(240, 405, 357, 725), { side: "right" }),
    region("sleeve", rect(668, 405, 785, 725), { side: "left", mirrored: true }),
    region("longSleeve", rect(0, 0, 357, 326), { side: "right" }),
    region("longSleeve", rect(668, 0, 1024, 326), { side: "left", mirrored: true }),
    region("sock", rect(3, 430, 237, 716), { side: "right" }),
    region("sock", rect(786, 430, 1020, 716), { side: "left" }),
    region("shorts", rect(4, 774, 351, 1018), { side: "right" }),
    region("shorts", rect(676, 774, 1024, 1018), { side: "left" }),
  ],
  // Punhos e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento).
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722)],
  collar: { cx: 513 / FM26_TEXTURE_SIZE, cy: 597 / FM26_TEXTURE_SIZE, innerRadius: 29 / FM26_TEXTURE_SIZE, outerRadius: 43 / FM26_TEXTURE_SIZE },
};
```

- [ ] **Step 4: Rodar os testes e o typecheck**

Run: `npx vitest run tests/fm26/layout.test.ts && npm run typecheck`
Expected: PASS. Nada mais no `src/` lia `FM26_KIT_LAYOUT.logos`.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/fm26/layout.ts tests/fm26/layout.test.ts
git commit -m "feat: add torso hems and mirrored left sleeves to the FM26 layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mapeamento do espaço do padrão para a UV

**Files:**
- Modify: `src/renderers/shirt-2d-shape.ts`
- Create: `src/renderers/uv-mapping.ts`
- Test: `tests/renderers/uv-mapping.test.ts`

**Interfaces:**
- Consumes: `FM26_KIT_LAYOUT`, `UvRegion`, `UvRect` (Task 1); `LOGO_BOXES` (`shirt-2d-shape.ts`); `LogoSlot` (`core/kit.ts`).
- Produces:
  - `TORSO_WINDOW: { x: number; y: number; width: number; height: number }` em `shirt-2d-shape.ts`.
  - `interface Affine { a; b; c; d; e; f: number }` (matriz `matrix(a b c d e f)` do SVG).
  - `applyAffine(m: Affine, x: number, y: number): [number, number]`.
  - `affineSvg(m: Affine): string` → `"matrix(a b c d e f)"`.
  - `torsoScale(): { kx: number; ky: number }` (pixels da textura por unidade do padrão).
  - `regionTransform(region: UvRegion): Affine` (pixels da textura 1024; lança `Region "<part>" has no pattern view` para `sock` e `shorts`).
  - `frontLogoBox(slot: LogoSlot): UvRect` (fração 0–1).

- [ ] **Step 1: Escrever os testes**

Crie `tests/renderers/uv-mapping.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/renderers/uv-mapping.test.ts`
Expected: FAIL por import: `uv-mapping.js` não existe e `TORSO_WINDOW` não é exportado.

- [ ] **Step 3: Exportar `TORSO_WINDOW`**

Em `src/renderers/shirt-2d-shape.ts`, logo depois de `LOGO_BOXES`:

```ts
// Caixa do tronco 2D, de lateral a lateral e da linha do ombro à barra: é a janela do padrão que a frente da textura 3D mostra.
export const TORSO_WINDOW = { x: 112, y: 48, width: 190, height: 334 };
```

- [ ] **Step 4: Criar `src/renderers/uv-mapping.ts`**

```ts
import type { LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, type UvRect, type UvRegion } from "../fm26/layout.js";
import { LOGO_BOXES, TORSO_WINDOW } from "./shirt-2d-shape.js";

// Matriz do SVG matrix(a b c d e f): (x, y) vira (a·x + c·y + e, b·x + d·y + f).
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SIZE = FM26_KIT_LAYOUT.textureSize;
const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const WINDOW_RIGHT = TORSO_WINDOW.x + TORSO_WINDOW.width;
const WINDOW_HEM = TORSO_WINDOW.y + TORSO_WINDOW.height;

export function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function affineSvg(m: Affine): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

// Aplica first e depois second.
function compose(second: Affine, first: Affine): Affine {
  return {
    a: second.a * first.a + second.c * first.b,
    b: second.b * first.a + second.d * first.b,
    c: second.a * first.c + second.c * first.d,
    d: second.b * first.c + second.d * first.d,
    e: second.a * first.e + second.c * first.f + second.e,
    f: second.b * first.e + second.d * first.f + second.f,
  };
}

function pixelRect(rect: UvRect): PixelRect {
  return { left: rect.x * SIZE, top: rect.y * SIZE, width: rect.width * SIZE, height: rect.height * SIZE };
}

function frontRegion(): UvRegion {
  const front = FM26_KIT_LAYOUT.regions.find((region) => region.part === "front");
  if (!front) throw new Error("FM26 layout has no front region");
  return front;
}

// O tronco 2D ocupa a frente inteira: a borda dele cai na costura lateral, por isso kx > ky (tronco desenrolado).
export function torsoScale(): { kx: number; ky: number } {
  const front = pixelRect(frontRegion().rect);
  return { kx: front.width / TORSO_WINDOW.width, ky: front.height / TORSO_WINDOW.height };
}

// Vista da parte em pé, vista de fora, no tamanho do rect em pixels.
function view(region: UvRegion, rect: PixelRect): Affine {
  const { kx, ky } = torsoScale();
  switch (region.part) {
    case "front":
    case "back": {
      // Ancorada na barra com a mesma escala vertical, como nas máscaras do FM: as costas, mais altas, mostram mais do padrão acima do ombro.
      const top = WINDOW_HEM - rect.height / ky;
      if (region.part === "front") return { a: kx, b: 0, c: 0, d: ky, e: -TORSO_WINDOW.x * kx, f: -top * ky };
      // De trás, o lado direito do jogador fica à direita de quem olha.
      return { a: -kx, b: 0, c: 0, d: ky, e: WINDOW_RIGHT * kx, f: -top * ky };
    }
    case "sleeve":
    case "longSleeve": {
      // Topo do tronco girado 90°: o vertical do padrão corre do ombro (borda direita da vista) ao punho, e a largura do tronco dá a volta no braço.
      const around = rect.height / TORSO_WINDOW.width;
      return { a: 0, b: around, c: -ky, d: 0, e: rect.width + TORSO_WINDOW.y * ky, f: -TORSO_WINDOW.x * around };
    }
    default:
      throw new Error(`Region "${region.part}" has no pattern view`);
  }
}

// Primeiro espelha, depois gira, como descreve UvRegion; por fim leva ao rect.
function placement(region: UvRegion, rect: PixelRect): Affine {
  const mirror: Affine = region.mirrored ? { a: -1, b: 0, c: 0, d: 1, e: rect.width, f: 0 } : IDENTITY;
  const rotate: Affine = region.rotation === 180 ? { a: -1, b: 0, c: 0, d: -1, e: rect.width, f: rect.height } : IDENTITY;
  return compose({ ...IDENTITY, e: rect.left, f: rect.top }, compose(rotate, mirror));
}

export function regionTransform(region: UvRegion): Affine {
  const rect = pixelRect(region.rect);
  return compose(placement(region, rect), view(region, rect));
}

// A caixa 3D é a imagem da caixa 2D: o fundo atrás do logo é o que backgroundRoles mediu no 2D, e a cor do logo no kit.json continua valendo.
export function frontLogoBox(slot: LogoSlot): UvRect {
  const box = LOGO_BOXES[slot];
  const transform = regionTransform(frontRegion());
  const [left, top] = applyAffine(transform, box.x, box.y);
  const [right, bottom] = applyAffine(transform, box.x + box.width, box.y + box.height);
  return { x: left / SIZE, y: top / SIZE, width: (right - left) / SIZE, height: (bottom - top) / SIZE };
}
```

- [ ] **Step 5: Rodar os testes e o typecheck**

Run: `npx vitest run tests/renderers/uv-mapping.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/shirt-2d-shape.ts src/renderers/uv-mapping.ts tests/renderers/uv-mapping.test.ts
git commit -m "feat: map the 2D pattern space onto the FM26 UV islands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Composição de logos compartilhada

Refatoração sem mudança de comportamento. A guarda de SVG não cobre logos, então o PNG 2D com os três logos é comparado byte a byte antes e depois com um script temporário em `output/` (pasta ignorada pelo git).

**Files:**
- Create: `src/renderers/kit-logos.ts`
- Modify: `src/renderers/renderer-2d.ts`, `src/io/asset-repository.ts:6`, `tests/renderers/renderer-2d.test.ts:6`
- Temporário (não versionado): `output/logo-baseline.mts`, `output/logo-baseline-before.txt`

**Interfaces:**
- Consumes: `badgeLayer`, `brandLogoLayers`, `LogoLayer`, `PixelBox` (`logo-image.ts`); `BRAND_KINDS`, `resolveLogoColor`, `LogoSlot` (`core/kit.ts`).
- Produces:
  - `interface KitLogoImages { badge?: Buffer; sponsor?: Buffer; manufacturer?: Buffer }` em `kit-logos.ts` (sai de `renderer-2d.ts`).
  - `kitLogoLayers(kit: KitDefinition, images: KitLogoImages, boxes: Record<LogoSlot, PixelBox>, outlineWidth: number): Promise<LogoLayer[]>`.

- [ ] **Step 1: Criar o script de referência**

Crie `output/logo-baseline.mts` (com a ferramenta de escrita):

```ts
import { createHash } from "node:crypto";
import { renderKit2dPng } from "../src/renderers/renderer-2d.js";
import { makeKit } from "../tests/fixtures/kits.js";

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill-rule="evenodd" d="M0 0H60V20H0Z M24 6H36V14H24Z"/></svg>`;
const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#00ff00"/></svg>`;
const kit = makeKit({
  pattern: { id: "stripes", base: "primary", overlay: "secondary", params: {} },
  badge: true,
  sponsor: { id: "luna-air", color: "accent", outline: "secondary" },
  manufacturer: { id: "vertex", color: "#000000" },
});
const logos = { badge: Buffer.from(BADGE), sponsor: Buffer.from(LOGO), manufacturer: Buffer.from(LOGO) };
for (const size of [414, 828]) console.log(size, createHash("sha256").update(await renderKit2dPng(kit, { size, logos })).digest("hex"));
```

- [ ] **Step 2: Gravar os hashes de antes**

Run: `npx tsx output/logo-baseline.mts > output/logo-baseline-before.txt && cat output/logo-baseline-before.txt`
Expected: duas linhas, `414 <sha256>` e `828 <sha256>`.

- [ ] **Step 3: Criar `src/renderers/kit-logos.ts`**

```ts
import { BRAND_KINDS, resolveLogoColor, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { badgeLayer, brandLogoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";

export interface KitLogoImages {
  badge?: Buffer;
  sponsor?: Buffer;
  manufacturer?: Buffer;
}

function requireImage(images: KitLogoImages, slot: LogoSlot): Buffer {
  const image = images[slot];
  if (!image) throw new Error(`Kit declares a ${slot} but no ${slot} image was provided`);
  return image;
}

// Caixas em pixels da imagem final: os renderers 2D e 3D só diferem em onde ficam os logos.
export async function kitLogoLayers(kit: KitDefinition, images: KitLogoImages, boxes: Record<LogoSlot, PixelBox>, outlineWidth: number): Promise<LogoLayer[]> {
  const layers: LogoLayer[] = [];
  if (kit.badge) layers.push(await badgeLayer(requireImage(images, "badge"), boxes.badge));
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (!logo) continue;
    const outline = logo.outline === undefined ? undefined : { color: resolveLogoColor(kit, logo.outline), width: outlineWidth };
    layers.push(...(await brandLogoLayers(requireImage(images, kind), boxes[kind], resolveLogoColor(kit, logo.color), outline)));
  }
  return layers;
}
```

- [ ] **Step 4: Usar `kitLogoLayers` no renderer 2D**

Em `src/renderers/renderer-2d.ts`:

Troque os imports do topo (até `logo-image.js`) por:

```ts
import sharp from "sharp";
import { sleeveCut, type KitDefinition } from "../core/kit.js";
import { fillSvg, kitDesign } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
```

(o import de `./shirt-2d-shape.js` continua igual).

Apague a interface `KitLogoImages`, a função `requireImage` e a função `logoLayers`. Mantenha `pixelBox`. Troque `renderKit2dPng` por:

```ts
export async function renderKit2dPng(kit: KitDefinition, options: Render2dOptions = {}): Promise<Buffer> {
  const size = options.size ?? KIT_2D_SIZE;
  const shirt = sharp(Buffer.from(renderKit2dSvg(kit, options)));
  const scale = size / SHIRT_2D_VIEWBOX;
  const boxes = { badge: pixelBox(LOGO_BOXES.badge, scale), sponsor: pixelBox(LOGO_BOXES.sponsor, scale), manufacturer: pixelBox(LOGO_BOXES.manufacturer, scale) };
  const layers = await kitLogoLayers(kit, options.logos ?? {}, boxes, Math.max(1, Math.round(OUTLINE_WIDTH * scale)));
  // Sem logos não há composite: o PNG fica byte a byte igual ao da Fase 2a.
  return (layers.length > 0 ? shirt.composite(layers) : shirt).png().toBuffer();
}
```

`Render2dOptions` continua com `logos?: KitLogoImages`, agora vindo de `kit-logos.ts`.

- [ ] **Step 5: Ajustar os imports de `KitLogoImages`**

Em `src/io/asset-repository.ts`, troque `import type { KitLogoImages } from "../renderers/renderer-2d.js";` por `import type { KitLogoImages } from "../renderers/kit-logos.js";`.

Em `tests/renderers/renderer-2d.test.ts`, troque a linha 6 por:

```ts
import type { KitLogoImages } from "../../src/renderers/kit-logos.js";
import { KIT_2D_SIZE, renderKit2dPng, renderKit2dSvg } from "../../src/renderers/renderer-2d.js";
```

- [ ] **Step 6: Rodar typecheck e testes**

Run: `npm run typecheck && npx vitest run tests/renderers tests/io tests/cli`
Expected: PASS, sem alterar nenhum teste além do import.

- [ ] **Step 7: Conferir os hashes de depois**

Run: `npx tsx output/logo-baseline.mts | diff output/logo-baseline-before.txt -`
Expected: nenhuma saída (PNGs idênticos byte a byte em 414 e 828).

- [ ] **Step 8: Apagar os temporários e commitar**

```bash
rm output/logo-baseline.mts output/logo-baseline-before.txt
npm run format
git add src/renderers/kit-logos.ts src/renderers/renderer-2d.ts src/io/asset-repository.ts tests/renderers/renderer-2d.test.ts
git commit -m "refactor: share logo compositing between renderers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Renderer 3D

**Files:**
- Create: `src/renderers/renderer-3d.ts`
- Test: `tests/renderers/renderer-3d.test.ts`

**Interfaces:**
- Consumes: `FM26_KIT_LAYOUT`, `FM26_TEXTURE_SIZE`, `UvRect`, `UvRegion` (Task 1); `affineSvg`, `frontLogoBox`, `regionTransform`, `torsoScale` (Task 2); `kitLogoLayers`, `KitLogoImages` (Task 3); `kitDesign`, `fillSvg`, `KitDesign`, `KitFill` (`kit-design.ts`); `SHIRT_2D_VIEWBOX`; `PixelBox`.
- Produces:
  - `KIT_3D_SIZE = 1024`.
  - `interface Render3dOptions { size?: number; logos?: KitLogoImages }`.
  - `renderKit3dSvg(kit: KitDefinition, options?: Render3dOptions): string`.
  - `renderKit3dPng(kit: KitDefinition, options?: Render3dOptions): Promise<Buffer>`.

- [ ] **Step 1: Escrever os testes**

Crie `tests/renderers/renderer-3d.test.ts`:

```ts
import { XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { KitDefinition } from "../../src/core/kit.js";
import type { KitLogoImages } from "../../src/renderers/kit-logos.js";
import { KIT_3D_SIZE, renderKit3dPng, renderKit3dSvg } from "../../src/renderers/renderer-3d.js";
import { frontLogoBox } from "../../src/renderers/uv-mapping.js";
import { LOGO_SVG, makeLogoPng } from "../fixtures/assets.js";
import { makeKit } from "../fixtures/kits.js";

interface Raster {
  data: Buffer;
  width: number;
  height: number;
}

async function raster(png: Buffer): Promise<Raster> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function pixel({ data, width }: Raster, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return [...data.subarray(index, index + 4)];
}

function channelDistance(a: number[], b: number[]): number {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index]!)));
}

function boxCenter(slot: "badge" | "sponsor" | "manufacturer", size = KIT_3D_SIZE): [number, number] {
  const box = frontLogoBox(slot);
  return [Math.floor((box.x + box.width / 2) * size), Math.floor((box.y + box.height / 2) * size)];
}

const PRIMARY = [0x12, 0x34, 0x56, 255];
const SECONDARY = [0xff, 0xff, 0xff, 255];
const ACCENT = [0xff, 0xd7, 0x00, 255];
const GREEN = [0, 0xff, 0, 255];

const patternKit = (id: string): KitDefinition => makeKit({ pattern: { id, base: "primary", overlay: "secondary", params: {} } });

describe("renderKit3dSvg", () => {
  it("produces valid SVG", () => {
    expect(XMLValidator.validate(renderKit3dSvg(patternKit("stripes")))).toBe(true);
  });

  it("is deterministic", () => {
    expect(renderKit3dSvg(patternKit("sash"))).toBe(renderKit3dSvg(patternKit("sash")));
  });

  it("ignores the collar style and the raglan cut, left to Phase 4", () => {
    const plain = renderKit3dSvg(makeKit());
    for (const style of ["v-neck", "polo", "polo-v"] as const) expect(renderKit3dSvg(makeKit({ collar: { style, color: "accent" } }))).toBe(plain);
    expect(renderKit3dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toBe(plain);
  });

  it("draws a kit with an empty layer list like a kit without layers", () => {
    expect(renderKit3dSvg(makeKit({ layers: [] }))).toBe(renderKit3dSvg(makeKit()));
  });

  it("fails on an unknown pattern", () => {
    expect(() => renderKit3dSvg(patternKit("zigzag"))).toThrow(/Unknown pattern "zigzag"/);
  });
});

describe("renderKit3dPng", () => {
  it("renders the 1024 texture by default and the size it is asked for", async () => {
    expect(await sharp(await renderKit3dPng(makeKit())).metadata()).toMatchObject({ format: "png", width: 1024, height: 1024 });
    expect(await sharp(await renderKit3dPng(makeKit(), { size: 512 })).metadata()).toMatchObject({ width: 512, height: 512 });
  });

  it("is opaque everywhere", async () => {
    const { channels } = await sharp(await renderKit3dPng(patternKit("checkers"))).stats();
    expect(channels).toHaveLength(4);
    expect(channels[3]!.min).toBe(255);
  });

  it("paints every part with its color", async () => {
    const kit = makeKit({
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "accent" },
      shorts: { color: "accent" },
      socks: { color: "secondary" },
    });
    const texture = await raster(await renderKit3dPng(kit));
    const expected: [string, number, number, number[]][] = [
      ["front", 512, 900, PRIMARY],
      ["back", 512, 300, PRIMARY],
      ["front hem", 512, 1011, PRIMARY],
      ["outside the islands", 512, 60, PRIMARY],
      ["right short sleeve", 310, 650, SECONDARY],
      ["left short sleeve", 730, 650, SECONDARY],
      ["right long sleeve", 178, 163, SECONDARY],
      ["left long sleeve", 846, 163, SECONDARY],
      ["right cuff", 257, 560, ACCENT],
      ["left cuff", 768, 560, ACCENT],
      ["collar", 549, 597, ACCENT],
      ["collar", 477, 597, ACCENT],
      ["right shorts", 177, 896, ACCENT],
      ["left shorts", 850, 896, ACCENT],
      ["right sock", 120, 573, SECONDARY],
      ["left sock", 903, 573, SECONDARY],
    ];
    for (const [part, x, y, color] of expected) expect(pixel(texture, x, y), part).toEqual(color);
  });

  // Linha r da frente reflete na linha 1137 − r das costas (reflexão em y = 569, centros de pixel em r + 0,5). A tolerância cobre o antialias das bordas.
  it.each(["halves", "sash"])("mirrors the front onto the back across y = 569 with %s", async (id) => {
    const texture = await raster(await renderKit3dPng(patternKit(id)));
    const colors = new Set<string>();
    // Começa abaixo do anel da gola (y ≤ 640), que só existe de um lado da reflexão.
    for (let y = 645; y < 1000; y += 13) {
      for (let x = 362; x < 664; x += 11) {
        const front = pixel(texture, x, y);
        colors.add(front.join());
        expect(channelDistance(front, pixel(texture, x, 1137 - y)), `${x},${y}`).toBeLessThanOrEqual(32);
      }
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it("runs match-body stripes from the shoulder to the cuff", async () => {
    const texture = await raster(await renderKit3dPng(patternKit("stripes")));
    const colors = new Set<string>();
    for (let y = 410; y < 720; y += 5) {
      const shoulder = pixel(texture, 350, y);
      expect(pixel(texture, 280, y), `y ${y}`).toEqual(shoulder);
      colors.add(shoulder.join());
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it("draws the detail layers on the front and the back but not on the sleeves", async () => {
    const kit = makeKit({
      layers: [{ id: "side-lines", color: "accent", params: {} }],
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
    });
    const texture = await raster(await renderKit3dPng(kit));
    for (const [x, y] of [
      [362, 800],
      [663, 800],
      [362, 300],
      [663, 300],
    ] as const) {
      expect(pixel(texture, x, y), `${x},${y}`).toEqual(ACCENT);
    }
    // Na manga, a mesma faixa do padrão (x 112–120 do 2D) cai em y 405–419 da asa: sem camadas ela fica na base.
    expect(pixel(texture, 300, 410)).toEqual(PRIMARY);
  });
});

describe("renderKit3dPng logos", () => {
  const brandedKit = makeKit({ badge: true, sponsor: { id: "luna-air", color: "accent", outline: "secondary" }, manufacturer: { id: "vertex", color: "#000000" } });
  const logos = async (): Promise<KitLogoImages> => ({ badge: await makeLogoPng(40, 40, "#00ff00"), sponsor: Buffer.from(LOGO_SVG), manufacturer: await makeLogoPng(30, 30) });

  // badge, sponsor e manufacturer não entram no SVG: o makeKit() sem logos tem a mesma textura de fundo do brandedKit.
  it("changes only the pixels inside the logo boxes on the front", async () => {
    const plain = await raster(await renderKit3dPng(makeKit()));
    const branded = await raster(await renderKit3dPng(brandedKit, { logos: await logos() }));
    // O contorno passa da caixa em até 2 px.
    const margin = 3;
    const boxes = (["badge", "sponsor", "manufacturer"] as const).map((slot) => ({ slot, box: frontLogoBox(slot) }));
    const hits = new Map(boxes.map(({ slot }) => [slot, 0]));
    for (let y = 0; y < KIT_3D_SIZE; y++) {
      for (let x = 0; x < KIT_3D_SIZE; x++) {
        const index = (y * KIT_3D_SIZE + x) * 4;
        if (plain.data.readUInt32BE(index) === branded.data.readUInt32BE(index)) continue;
        const owner = boxes.find(({ box }) => {
          const [left, top] = [box.x * KIT_3D_SIZE - margin, box.y * KIT_3D_SIZE - margin];
          const [right, bottom] = [(box.x + box.width) * KIT_3D_SIZE + margin, (box.y + box.height) * KIT_3D_SIZE + margin];
          return x >= left && x < right && y >= top && y < bottom;
        });
        expect(owner, `${x},${y}`).toBeDefined();
        hits.set(owner!.slot, hits.get(owner!.slot)! + 1);
      }
    }
    for (const [slot, count] of hits) expect(count, slot).toBeGreaterThan(0);
  });

  it("keeps the badge colors and paints the brands with the kit colors", async () => {
    const texture = await raster(await renderKit3dPng(brandedKit, { logos: await logos() }));
    expect(pixel(texture, ...boxCenter("badge"))).toEqual(GREEN);
    expect(pixel(texture, ...boxCenter("manufacturer"))).toEqual([0, 0, 0, 255]);
  });

  it("scales the logos with the size", async () => {
    const texture = await raster(await renderKit3dPng(brandedKit, { size: 512, logos: await logos() }));
    expect(texture.width).toBe(512);
    expect(pixel(texture, ...boxCenter("badge", 512))).toEqual(GREEN);
  });

  it("fails when the kit declares a logo without its image", async () => {
    await expect(renderKit3dPng(makeKit({ badge: true }), { logos: {} })).rejects.toThrow("Kit declares a badge but no badge image was provided");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: FAIL por import: `renderer-3d.js` não existe.

- [ ] **Step 3: Criar `src/renderers/renderer-3d.ts`**

```ts
import sharp from "sharp";
import type { KitDefinition, LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect, type UvRegion } from "../fm26/layout.js";
import { fillSvg, kitDesign, type KitDesign, type KitFill } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import { SHIRT_2D_VIEWBOX } from "./shirt-2d-shape.js";
import { affineSvg, frontLogoBox, regionTransform, torsoScale } from "./uv-mapping.js";

export const KIT_3D_SIZE = FM26_TEXTURE_SIZE;
// Traço do contorno dos logos no viewBox 414 do 2D; no 3D acompanha a escala vertical da frente.
const OUTLINE_WIDTH = 2;

export interface Render3dOptions {
  size?: number;
  logos?: KitLogoImages;
}

interface RegionSvg {
  clip?: string;
  body: string;
}

function rectAttributes(rect: UvRect): string {
  const size = FM26_TEXTURE_SIZE;
  return `x="${rect.x * size}" y="${rect.y * size}" width="${rect.width * size}" height="${rect.height * size}"`;
}

function baseColor(fill: KitFill): string {
  return fill.kind === "solid" ? fill.color : fill.base;
}

function solidRegion(rect: UvRect, color: string): RegionSvg {
  return { body: `<rect ${rectAttributes(rect)} fill="${color}"/>` };
}

// O padrão é desenhado no espaço 414 do 2D e levado à ilha pela transformação da vista; o recorte inclui a barra.
function patternRegion(region: UvRegion, id: string, fill: KitFill, layers: KitDesign["bodyLayers"]): RegionSvg {
  const rects = [region.rect, ...(region.hem === undefined ? [] : [region.hem])].map((rect) => `<rect ${rectAttributes(rect)}/>`);
  const pattern = fillSvg(fill, SHIRT_2D_VIEWBOX, SHIRT_2D_VIEWBOX, layers);
  return {
    clip: `<clipPath id="${id}">${rects.join("")}</clipPath>`,
    body: `<g clip-path="url(#${id})"><g transform="${affineSvg(regionTransform(region))}">${pattern}</g></g>`,
  };
}

function regionSvg(region: UvRegion, id: string, design: KitDesign): RegionSvg {
  switch (region.part) {
    case "front":
    case "back":
      return patternRegion(region, id, design.body, design.bodyLayers);
    case "sleeve":
    case "longSleeve":
      // Como no 2D, a manga match-body recebe só o padrão principal.
      return design.sleeves.kind === "solid" ? solidRegion(region.rect, design.sleeves.color) : patternRegion(region, id, design.sleeves, []);
    case "shorts":
      return solidRegion(region.rect, design.shorts);
    case "sock":
      return solidRegion(region.rect, design.socks);
  }
}

export function renderKit3dSvg(kit: KitDefinition, options: Render3dOptions = {}): string {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = FM26_TEXTURE_SIZE;
  const design = kitDesign(kit);
  const { regions, cuffs, collar } = FM26_KIT_LAYOUT;
  const parts = regions.map((region, index) => regionSvg(region, `region-${index}`, design));
  const ring = { cx: collar.cx * texture, cy: collar.cy * texture, r: ((collar.innerRadius + collar.outerRadius) / 2) * texture };
  const ringWidth = (collar.outerRadius - collar.innerRadius) * texture;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${parts.map((part) => part.clip ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...cuffs.map((cuff) => solidRegion(cuff, design.cuffs).body),
    `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${design.collar}" stroke-width="${ringWidth}"/>`,
    "</svg>",
  ].join("");
}

function logoBoxes(size: number): Record<LogoSlot, PixelBox> {
  const box = (slot: LogoSlot): PixelBox => {
    const rect = frontLogoBox(slot);
    return { left: Math.round(rect.x * size), top: Math.round(rect.y * size), width: Math.round(rect.width * size), height: Math.round(rect.height * size) };
  };
  return { badge: box("badge"), sponsor: box("sponsor"), manufacturer: box("manufacturer") };
}

export async function renderKit3dPng(kit: KitDefinition, options: Render3dOptions = {}): Promise<Buffer> {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = sharp(Buffer.from(renderKit3dSvg(kit, options)));
  const outlineWidth = Math.max(1, Math.round((OUTLINE_WIDTH * torsoScale().ky * size) / FM26_TEXTURE_SIZE));
  const layers = await kitLogoLayers(kit, options.logos ?? {}, logoBoxes(size), outlineWidth);
  return (layers.length > 0 ? texture.composite(layers) : texture).png().toBuffer();
}
```

- [ ] **Step 4: Rodar os testes e o typecheck**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts && npm run typecheck`
Expected: PASS. Se o teste de reflexão falhar por poucos pontos na borda de uma faixa, confira se a linha comparada é `1137 − y` antes de mexer na tolerância.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. A inspeção visual das texturas fica para a Task 6, quando a CLI já grava o 3D.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/renderer-3d.ts tests/renderers/renderer-3d.test.ts
git commit -m "feat: render the FM26 3D kit texture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CLI — `render --render` e export com 2D e 3D

**Files:**
- Modify: `src/fm26/naming.ts`, `src/cli/run-cli.ts`
- Test: `tests/fm26/naming.test.ts`, `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `renderKit3dPng` (Task 4); `KitLogoImages` (Task 3); `frontLogoBox` (Task 2, só nos testes); `RENDER_TYPES`, `RenderType` (`naming.ts`); `RenderKit`, `exportKits` (`exporter.ts`, sem mudança).
- Produces: `parseRenderType(value: string): RenderType` em `naming.ts`; opção `--render <2d|3d>` no `render`; `export` com `renderTypes: RENDER_TYPES`.

- [ ] **Step 1: Testes de `parseRenderType`**

Em `tests/fm26/naming.test.ts`, inclua `parseRenderType` no import de `naming.js` e acrescente:

```ts
describe("parseRenderType", () => {
  it.each(RENDER_TYPES)("accepts %s", (value) => {
    expect(parseRenderType(value)).toBe(value);
  });

  it.each(["4d", "3D", ""])("rejects %j", (value) => {
    expect(() => parseRenderType(value)).toThrow(`Invalid render type "${value}": expected 2d or 3d`);
  });
});
```

- [ ] **Step 2: Testes da CLI**

Em `tests/cli/run-cli.test.ts`, acrescente `import { frontLogoBox } from "../../src/renderers/uv-mapping.js";` aos imports.

No `describe("runCli render")`, acrescente:

```ts
  it("renders the 3D texture of a definition with --render 3d", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    const png = path.join(dir, "kit_3d.png");
    await writeFile(definition, JSON.stringify(makeKit()));
    expect(await runCli(["render", "--definition", definition, "--out", png, "--render", "3d"], captureIo().io)).toBe(0);
    expect(await sharp(png).metadata()).toMatchObject({ width: 1024, height: 1024 });
  });

  it("puts the badge and the manufacturer on the front of the 3D texture", async () => {
    const { clubs, assets } = await brandedSetup();
    const dir = await makeTempDir("cli");
    const [definition, png] = [path.join(dir, "kit.json"), path.join(dir, "kit_3d.png")];
    await writeFile(definition, JSON.stringify(makeKit({ badge: true, manufacturer: { id: "vertex", color: "#000000" } })));
    const argv = ["render", "--definition", definition, "--out", png, "--render", "3d", "--clubs", clubs, "--assets", assets];
    expect(await runCli(argv, captureIo().io)).toBe(0);
    const center = (slot: "badge" | "manufacturer"): [number, number] => {
      const box = frontLogoBox(slot);
      return [Math.floor((box.x + box.width / 2) * 1024), Math.floor((box.y + box.height / 2) * 1024)];
    };
    expect(await pixelAt(await readFile(png), ...center("badge"))).toEqual(GREEN);
    expect(await pixelAt(await readFile(png), ...center("manufacturer"))).toEqual([0, 0, 0, 255]);
  });

  it.each(["4d", "3D"])("rejects --render %s", async (value) => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify(makeKit()));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png"), "--render", value], io)).toBe(1);
    expect(errors).toEqual([`Error: Invalid render type "${value}": expected 2d or 3d`]);
    expect(await exists(path.join(dir, "kit.png"))).toBe(false);
  });
```

No `describe("runCli export")`, troque o teste `writes the 2D PNGs and config.xml of every club into one folder` por:

```ts
  it("writes the 2D PNGs, the 3D textures and config.xml of every club into one folder", async () => {
    const { clubs } = await exportableClubs();
    const out = await exportDir();
    const { io, logs, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      expect(await sharp(path.join(out, `galaticos_fc_${kitType}_2d.png`)).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
      expect(await sharp(path.join(out, `galaticos_fc_${kitType}_3d.png`)).metadata()).toMatchObject({ format: "png", width: 1024, height: 1024 });
    }
    const xml = await readFile(path.join(out, "config.xml"), "utf8");
    expect(xml).toContain('<record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>');
    expect(xml).toContain('<record from="galaticos_fc_away_3d" to="graphics/pictures/team/1/kit_textures/away"/>');
    expect(logs).toEqual(["Exported Galáticos FC: home, away, third", `Wrote 6 records to ${path.join(out, "config.xml")}`]);
    expect(errors).toEqual([]);
  });

  it("exports the same 3D texture that render --render 3d writes", async () => {
    const { clubs } = await exportableClubs();
    const out = await exportDir();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    const rendered = path.join(await makeTempDir("cli"), "home_3d.png");
    const argv = ["render", "--definition", kitFile(clubs, "galaticos-fc", "home"), "--out", rendered, "--render", "3d", "--clubs", clubs];
    expect(await runCli(argv, captureIo().io)).toBe(0);
    expect((await readFile(path.join(out, "galaticos_fc_home_3d.png"))).equals(await readFile(rendered))).toBe(true);
  });
```

No `describe("runCli usage")`, acrescente:

```ts
  it("documents the 3D render option", () => {
    expect(USAGE).toContain("kit-generator render --definition <kit.json> --out <file.png> [--render <2d|3d>] [--clubs <dir>] [--assets <dir>]");
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/fm26/naming.test.ts tests/cli/run-cli.test.ts`
Expected: FAIL. `parseRenderType` não existe, `--render` é opção desconhecida (`parseArgs` estrito), o export grava só 3 registros.

- [ ] **Step 4: Implementar `parseRenderType`**

Em `src/fm26/naming.ts`, depois de `export type RenderType`:

```ts
export function parseRenderType(value: string): RenderType {
  const renderType = RENDER_TYPES.find((candidate) => candidate === value);
  if (renderType === undefined) throw new Error(`Invalid render type "${value}": expected ${RENDER_TYPES.join(" or ")}`);
  return renderType;
}
```

- [ ] **Step 5: Implementar na CLI**

Em `src/cli/run-cli.ts`:

Imports novos:

```ts
import { parseRenderType, RENDER_TYPES, type RenderType } from "../fm26/naming.js";
import type { KitLogoImages } from "../renderers/kit-logos.js";
import { renderKit3dPng } from "../renderers/renderer-3d.js";
```

Linha do `render` no `USAGE`:

```ts
  "  kit-generator render --definition <kit.json> --out <file.png> [--render <2d|3d>] [--clubs <dir>] [--assets <dir>]",
```

Antes de `renderCommand`, acrescente:

```ts
function renderKitPng(kit: KitDefinition, renderType: RenderType, logos: KitLogoImages): Promise<Buffer> {
  return renderType === "3d" ? renderKit3dPng(kit, { logos }) : renderKit2dPng(kit, { logos });
}
```

Troque `renderCommand` por:

```ts
async function renderCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    definition: { type: "string" },
    out: { type: "string" },
    render: { type: "string", default: "2d" },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const renderType = parseRenderType(values.render);
  const kit = parseWith(KitDefinitionSchema, await readJsonFile(values.definition), `kit definition in ${values.definition}`);
  const registry = await loadAssetRegistry(values.assets);
  const logos = await loadKitLogos(kit, registry, { assetsDir: values.assets, clubsDir: values.clubs });
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKitPng(kit, renderType, logos));
  io.log(`Rendered ${values.definition} to ${out}`);
  return 0;
}
```

Em `exportCommand`, troque o comentário `// Só 2D na 3a; a 3b escolhe o renderer pelo renderType.` e as duas linhas seguintes por:

```ts
  const renderKit: RenderKit = async (kit, renderType) => renderKitPng(kit, renderType, await loadKitLogos(kit, registry, dirs));
  try {
    const result = await exportKits({ clubsDir: values.clubs, outDir: path.resolve(values.out), renderTypes: RENDER_TYPES, renderKit });
```

(o resto do `try`/`catch` não muda).

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run tests/fm26/naming.test.ts tests/cli/run-cli.test.ts && npm run typecheck`
Expected: PASS. O teste `reports a badge deleted after generate as a render failure with its path` continua verde: o primeiro problema listado ainda é o `home 2d`.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/fm26/naming.ts src/cli/run-cli.ts tests/fm26/naming.test.ts tests/cli/run-cli.test.ts
git commit -m "feat: export 3D textures and render them from the CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificação, inspeção visual e documentação

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/plans/2026-10-01-roadmap.md`

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: documentação da 3c e o pacote `output/fm26_export/` para o teste no jogo.

- [ ] **Step 1: Rodar todas as verificações**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde. Anote o número de testes do `npm test` para o roadmap.

- [ ] **Step 2: Gerar o pacote e inspecionar as texturas**

Run: `npm run export`
Expected: `Exported ...` para Galáticos e Kongs e `Wrote 12 records to .../output/fm26_export/config.xml`.

Abra cada `output/fm26_export/*_3d.png` (visualizador de imagem ou a ferramenta de leitura de imagem) ao lado do `*_2d.png` do mesmo kit e confira:

- a frente (metade de baixo da coluna central) mostra o mesmo padrão do tronco 2D, mais largo;
- as costas (metade de cima) são a frente refletida, com as faixas horizontais à mesma distância das barras;
- as camadas (`layers`) aparecem na frente e nas costas;
- mangas `match-body` com o padrão do topo do tronco, listras correndo da borda junto à coluna para fora; mangas `solid` lisas;
- punhos só nas asas, anel da gola, calção e meias nas cores do kit;
- escudo à direita da textura (peito esquerdo do jogador), fabricante à esquerda, patrocinador abaixo, sem distorção;
- nenhum buraco ou cor estranha entre as ilhas.

Se algo divergir da spec, pare e corrija na task correspondente antes de documentar.

- [ ] **Step 3: Atualizar o `CLAUDE.md`**

Na seção "Visão geral", troque o trecho de "Estado atual: Fase 4b concluída (" até "Textura 3D (Fase 3c) ainda não existe." por:

```markdown
Estado atual: Fase 3c concluída (renderer 3D: textura 1024×1024 por kit na UV do FM26, e 3D no export), sobre a 4b (camadas de detalhe `layers`, até 2 padrões finos na cor que o padrão principal não usa, e 4 padrões de camada mais 1 degradê, 16 no total), a 4a (golas `polo`/`polo-v`, manga raglan e pesos de gola e manga por perfil) e a 3b (perfis de estilo, tradições do clube, contact sheet `preview`, camada de desenho compartilhada e layout UV como dado); a próxima é a Fase 4 (componentes FM26 e acabamento 3D). O teste da textura de calibração no jogo (2026-10-06) confirmou o layout da UV (roadmap, seção "Calibração da UV"). Cada clube ganha Home, Away e Third com a mesma paleta, validados por regras de coerência, e, por kit, um PNG 2D 414×414 e uma textura 3D 1024×1024, ambos com escudo, patrocinador e fabricante. `export` grava os PNGs 2D e as texturas 3D de todos os clubes e um `config.xml` único em `output/fm26_export/`.
```

No bloco "Comandos":

- troque o comentário do `npm run export` por `# todos os clubes -> output/fm26_export/ (PNGs 2D, texturas 3D + config.xml), tudo ou nada`;
- depois da linha do `render`, acrescente `npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview_3d.png --render 3d`.

Na seção "Arquitetura":

- no parágrafo "Fluxo:", troque "`renderKit2dPng(kit, { logos })` (SVG → Sharp → PNG, logos compostos por cima)" por "`renderKit2dPng(kit, { logos })` ou `renderKit3dPng(kit, { logos })` (SVG → Sharp → PNG, logos compostos por cima)" e "`exportKits` → PNGs + `config.xml`" por "`exportKits` → PNGs 2D e texturas 3D + `config.xml`";
- no item de `src/renderers/kit-design.ts`, troque "O renderer 2D consome só isso, e o 3D da 3c deve usar a mesma camada." por "Os renderers 2D e 3D consomem só isso.";
- troque o item de `src/fm26/layout.ts` por:

```markdown
- `src/fm26/layout.ts`: `FM26_KIT_LAYOUT`, regiões da UV em fração 0–1 com lado do jogador, rotação, espelhamento e barra (`hem`, só frente e costas), punhos e gola. Ilhas, orientação do tronco, lados, gola, barras e mangas (asas = manga curta, cantos = manga comprida) confirmados no jogo em 2026-10-06; a orientação das mangas em x e as metades B/F são inferências (mangas do lado esquerdo do jogador com `mirrored: true`). As caixas de logo do 3D não ficam no layout: `frontLogoBox` as deriva das caixas 2D.
- `src/renderers/uv-mapping.ts`: puro. `regionTransform(region)` devolve a matriz afim (`matrix(a b c d e f)` do SVG) que leva o espaço do padrão 2D (viewBox 414) para a ilha: a vista da parte, depois `mirrored`, depois `rotation`. A frente recebe a janela do tronco 2D (`TORSO_WINDOW`, x 112–302, y 48–382) esticada (kx ≈ 1,64, ky ≈ 1,22: tronco desenrolado, borda 2D na costura lateral); as costas usam a mesma escala vertical ancorada na barra e saem refletidas em y ≈ 569, porque as máscaras do FM alinham frente e costas pela barra, não pela gola; as mangas recebem o topo do tronco girado 90°, ombro na borda junto à coluna. `frontLogoBox(slot)` é a caixa 2D mapeada na frente: o fundo atrás do logo é o que `backgroundRoles` mede no 2D, então a cor de logo do `kit.json` vale no 3D.
- `src/renderers/renderer-3d.ts`: `renderKit3dSvg`/`renderKit3dPng` (1024 por padrão; `size` só na API). Fundo opaco na cor base do corpo (as máscaras do FM são opacas); frente, costas e barras com as camadas; mangas `solid` como retângulo e `match-body` com o padrão sem camadas; punhos só nas asas; anel da gola; calção e meias lisos; logos só na frente. Estilo de gola e corte raglan não mudam a textura (Fase 4).
- `src/renderers/kit-logos.ts`: `KitLogoImages` e `kitLogoLayers(kit, images, boxes, outlineWidth)`, a composição de logos dos dois renderers; cada renderer só diz onde ficam as caixas e a espessura do contorno.
```

- no item de `src/cli`, troque "`render` também aceita `--clubs`." por "`render` também aceita `--clubs` e `--render <2d|3d>` (padrão `2d`, `parseRenderType` em `fm26/naming.ts`)." e "`export` (sem `--club`/`--all`: sempre todos os clubes)" por "`export` (sem `--club`/`--all`: sempre todos os clubes, 2D e 3D)".

Na seção "Convenções e armadilhas", acrescente:

```markdown
- O 3D não tem sorteio próprio: a textura sai do mesmo `kit.json`. `LOGO_BOXES` e `TORSO_WINDOW` alimentam os dois renderers, então mover uma caixa de logo 2D move o logo no 3D, e mudar o layout ou o mapeamento muda as texturas sem mudar os kits.
```

- [ ] **Step 4: Atualizar o `README.md`**

- Troque o parágrafo que começa com "Fase 3b concluída:" por:

```markdown
Fase 3c concluída: kits Home, Away e Third com a mesma paleta, PNG 2D 414×414 com escudo, patrocinador e fabricante, textura 3D 1024×1024 na UV do FM26 e export para o jogo com `config.xml` gerado. O gerador tem 16 padrões (4 deles também como camadas de detalhe), golas `round`, `v-neck`, `polo` e `polo-v`, manga raglan, perfis de estilo, tradições do clube e um contact sheet HTML para inspecionar kits salvos ou amostras de seeds. Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.
```

- Na seção "4. Ajustar à mão e renderizar", depois do bloco com o `render`, acrescente:

````markdown
Com `--render 3d`, o comando grava a textura 3D 1024×1024 do kit (layout da UV do FM26: frente, costas, mangas, calção e meias) em vez do PNG 2D:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview_3d.png --render 3d
```
````

- Na frase sobre calção e meias, troque "e ainda não são desenhados no PNG 2D; entram no 3D (Fase 3c)." por "e aparecem só na textura 3D, lisos; o PNG 2D mostra só a camisa.".
- Na seção do export, troque "renderiza os PNGs 2D e grava tudo em `output/fm26_export/`: um PNG por kit (`galaticos_fc_home_2d.png`, ...) e um único `config.xml` que mapeia cada PNG para `graphics/pictures/team/<fmUniqueId>/kits/<tipo>`." por "renderiza, para cada kit, o PNG 2D e a textura 3D e grava tudo em `output/fm26_export/`: `galaticos_fc_home_2d.png`, `galaticos_fc_home_3d.png`, ... e um único `config.xml` que mapeia cada PNG 2D para `graphics/pictures/team/<fmUniqueId>/kits/<tipo>` e cada textura 3D para `graphics/pictures/team/<fmUniqueId>/kit_textures/<tipo>`.".
- Na linha "Estrutura:", troque "`src/patterns` (12 padrões)" por "`src/patterns` (16 padrões)", "`src/renderers` (camada de desenho compartilhada e renderer 2D com logos)" por "`src/renderers` (camada de desenho compartilhada, renderers 2D e 3D com logos e mapeamento para a UV)" e "layout UV ainda hipotético" por "layout UV confirmado no jogo".

- [ ] **Step 5: Atualizar o roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

- No parágrafo de planos detalhados (linha 5), troque "e Fase 4b (spec `docs/superpowers/specs/2026-10-06-fase-4b-camadas-padroes-design.md`, plano `docs/superpowers/plans/2026-10-06-fase-4b-camadas-padroes.md`)." por ", Fase 4b (spec `docs/superpowers/specs/2026-10-06-fase-4b-camadas-padroes-design.md`, plano `docs/superpowers/plans/2026-10-06-fase-4b-camadas-padroes.md`) e Fase 3c (spec `docs/superpowers/specs/2026-10-07-fase-3c-renderer-3d-design.md`, plano `docs/superpowers/plans/2026-10-07-fase-3c-renderer-3d.md`).".
- Troque a linha da 3c na tabela de status por (com o hash do último commit de código, `git log --oneline -1 -- src`, e o número de testes do Step 1):

```markdown
| 3c — Calibração no jogo, renderer 3D e 3D no export | **Concluída** (2026-10-07, `dev` @ `<hash>`, <N> testes). Textura 1024×1024 por kit e `export` com 2D e 3D. O teste do primeiro kit 3D real no jogo fica na seção "Calibração da UV", "Teste da 3c" |
```

- Troque o parágrafo "Próximo passo: spec e plano da 3c ..." por:

```markdown
Próximo passo: Fase 4 (componentes FM26 e acabamento 3D), com `superpowers:brainstorming` e `superpowers:writing-plans`. Estilo de gola e corte raglan no 3D, listras de gola e punho, `fabric`/`mesh` e padrões por máscara partem do renderer 3D da 3c. Conferir antes o resultado do teste no jogo da 3c (seção "Calibração da UV").
```

- Troque a linha "**Limitações atuais (por desenho):** ..." por:

```markdown
**Limitações atuais (por desenho):** o PNG 2D mostra só a camisa (calção e meias aparecem só na textura 3D, lisos); logos só no peito (sem mangas, calção, nome e número); a textura 3D ignora o estilo de gola e o corte raglan e não tem `fabric`/`mesh` (Fase 4).
```

- Logo depois do parágrafo "**Não observado no jogo** ...", acrescente:

```markdown
**Teste da 3c (pendente).** Conferir no jogo, com o pacote do `export` e sem a pasta `graphics/kits/fm26_calibration/` instalada (o `config.xml` dela mapeia o Home e o Away 3D do Galáticos): kits 3D de todos os clubes; padrão contínuo no ombro e faixas horizontais encontrando-se nas laterais; listras de manga do ombro ao punho e metades B/F; escudo, fabricante e altura do patrocinador; punhos, gola, calção e meias; emendas nas bordas das ilhas.
```

- [ ] **Step 6: Conferir formatação e commitar**

```bash
npm run format:check
git add CLAUDE.md README.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document phase 3c

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Teste no jogo (usuário) e registro

Feito pelo usuário; o agente só registra o resultado.

**Files:**
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md` (e `src/fm26/layout.ts` + `tests/fm26/layout.test.ts` só se o teste pedir ajuste)

- [ ] **Step 1: Pedir o teste ao usuário**

Passar ao usuário:

1. Remover `graphics/kits/fm26_calibration/` da pasta Documentos do FM26 (pode ser `OneDrive/Documentos`).
2. Copiar `output/fm26_export/` para `graphics/kits/` (substituindo o pacote anterior do export).
3. Abrir os clubes no jogo e tirar prints de frente, costas e laterais de Home, Away e Third, conferindo os itens do "Teste da 3c" no roadmap. Para as metades B/F da manga, um kit com padrão assimétrico (`halves`, `sash`) e manga `match-body` mostra a orientação; se nenhum kit salvo tiver isso, a conferência fica para quando houver.

- [ ] **Step 2: Registrar o resultado**

Troque o parágrafo "**Teste da 3c (pendente).** ..." do roadmap por "**Teste da 3c (AAAA-MM-DD).**" seguido do que foi observado, item por item, e atualize a linha da 3c na tabela de status com a data do teste.

- [ ] **Step 3: Ajustar o layout, se preciso**

Divergência de orientação de manga, meia ou calção vira troca de `mirrored`/`rotation` da região em `src/fm26/layout.ts`, com o teste `records the back as turned 180 degrees and mirrors only the sleeves on the player's left` atualizado para o novo valor. O renderer não muda. Rode `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check`, gere o pacote de novo e peça um novo teste.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: record the phase 3c in-game test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(com `src/fm26/layout.ts` e `tests/fm26/layout.test.ts` num commit `fix:` separado, se o Step 3 mudou o layout).
