# Fase 4b — Camadas de detalhe e padrões novos (2D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kits menos genéricos no PNG 2D: até 2 camadas de detalhe por kit (linhas e formas na cor que o padrão não usa, o que traz o `accent` para o tronco) e 10 padrões novos, sorteados pelos perfis de estilo, sem mudar os kits que clubes sem `categories` geram para a mesma seed.

**Architecture:** Um `PatternTemplate` com `layerSlot` (`sides`, `shoulders`, `lower`) pode ser camada: o `render()` dele desenha só o overlay, e os ranges nunca pintam `LOGO_BOXES`. O `kit.json` ganha `layers` opcional (`{ id, color, params }[]`, máximo 2), validado em `validateKit`; `kitDesign` resolve as camadas em `bodyLayers`, separadas de `body`, e `fillSvg` as desenha depois do padrão principal, só no corpo. Os perfis ganham `layerCountWeights` e `layerWeights`, e o generator sorteia as camadas por último (quantidade, depois id, cor e params de cada uma), com no máximo uma camada por região.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Zod 4, Sharp, Vitest, `fast-xml-parser` (só nos testes), Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-06-fase-4b-camadas-padroes-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova.
- Padrões novos entram no fim do array de `src/patterns/registry.ts`, nesta ordem: `side-lines`, `double-pinline`, `shoulder-line`, `hoop-line`, `torso-circle`, `torso-diamond`, `torso-triangle`, `torso-cross`, `gradient-diagonal`, `gradient-radial`. A ordem participa do sorteio.
- Tamanhos dos padrões em fração de `width`/`height`.
- `classic` não muda: `patternWeights` `{ solid: 40, stripes: 35, sash: 25 }`, gola e manga como na 4a, `layerCountWeights` `{ 0: 1 }`, `layerWeights` `{}`.
- Ordem do `rng` em `generateKit`: padrão, params, gola, cor da gola, estilo de manga, cor do punho, calção, meias, corte, quantidade de camadas e, para cada camada, id, cor e params. Nenhum rótulo novo de `deriveSeed`.
- A guarda `Phase 3b baseline` do clube sem categorias (`e69b9a92…`) e a guarda de SVG `renderKit2dSvg Phase 3b baseline` (`acdafaa8…`) ficam verdes do começo ao fim do plano, sem mudar o hash. A guarda do clube `branded` (`8da3fe27…`) muda só na Task 8.
- `layers` ausente significa sem camadas; o generator só grava `layers` quando sai pelo menos uma. `MAX_LAYERS = 2`.
- `LOGO_BOXES` não muda; nenhuma camada pinta dentro delas, e `backgroundRoles`/`chooseLogoColors` continuam medindo só o padrão principal.
- A manga `match-body` recebe só o padrão principal, nunca as camadas.
- `traditions.forbiddenPatterns` vale para camadas; `traditions.patterns.<tipo>` vale só para o padrão principal.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e de log em inglês, como no resto da CLI.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.

## Review Focus

- `kit.json` escrito à mão com `"layers": []`: o usuário espera o mesmo PNG de um kit sem o campo. Teste na Task 6.
- `kit.json` escrito à mão com um padrão principal como camada (`chest-band`): o usuário espera que `validate` diga que não é padrão de camada e que ele pinta o patrocinador, não um PNG com o logo sobre a faixa. Teste na Task 5.
- Clube cujas `traditions.forbiddenPatterns` proíbem todas as camadas do perfil: espera `generate` sem erro, sem camadas e com o resto do kit igual. Teste na Task 8.
- Clube com `patternWeights` que usa um padrão de camada como principal (`side-lines`): espera kits válidos, sem camada na mesma região do padrão. Teste na Task 8.
- Clube com `categories: ["classic", "modern"]` (tabela de camadas vazia misturada a outra): espera pesos finitos, sem `NaN`, e camadas só do `modern`. Teste na Task 7.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/patterns/types.ts` | Modificar: `LayerSlot`, `PatternTemplate.layerSlot` |
| `src/patterns/registry.ts` | Modificar: 10 padrões no fim do array, `listLayerTemplates` |
| `src/patterns/torso-edges.ts` | Criar: `TORSO_LEFT`, `TORSO_RIGHT` (bordas do tronco 2D) |
| `src/patterns/side-lines.ts`, `double-pinline.ts`, `horizontal-lines.ts`, `torso-shapes.ts` | Criar: os 8 padrões de camada |
| `src/patterns/fade.ts` | Criar: `TORSO_BOTTOM`, `fadeBands`, `fadeLayer` (faixas dos degradês) |
| `src/patterns/gradient.ts` | Modificar: usar `fade.ts`, mesmo SVG |
| `src/patterns/gradient-diagonal.ts`, `gradient-radial.ts` | Criar: os 2 degradês principais |
| `src/core/kit.ts` | Modificar: `MAX_LAYERS`, `layers`, `KitLayer`, `visibleRoles` |
| `src/core/logo-colors.ts` | Modificar: `overlayShare` extraída de `backgroundRoles` |
| `src/core/validation.ts` | Modificar: regras de camada, tradições com camadas |
| `src/renderers/kit-design.ts` | Modificar: `KitLayerFill`, `bodyLayers`, `fillSvg(…, layers)` |
| `src/renderers/renderer-2d.ts` | Modificar: camadas no corpo |
| `src/styles/profiles.ts` | Modificar: `LAYER_COUNTS`, `layerCountWeights`, `layerWeights`, degradês em `patternWeights` |
| `src/styles/component-weights.ts` | Modificar: `layerCountCandidates` |
| `src/styles/pattern-weights.ts` | Modificar: `layerCandidates` |
| `src/generator/kit-generator.ts` | Modificar: `pickLayers`, último sorteio |
| `src/preview/contact-sheet.ts` | Modificar: linha por camada em `kitDetails` |
| `tests/patterns/patterns.test.ts`, `tests/core/kit.test.ts`, `tests/core/logo-colors.test.ts`, `tests/core/validation.test.ts`, `tests/renderers/kit-design.test.ts`, `tests/renderers/renderer-2d.test.ts`, `tests/styles/profiles.test.ts`, `tests/styles/component-weights.test.ts`, `tests/styles/pattern-weights.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/preview/contact-sheet.test.ts` | Modificar |
| `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar: documentação da fase |

A geometria dos 10 padrões foi prototipada antes do plano: o teste genérico de `colorAt` passa com 0 divergências nos extremos, nenhuma camada pinta um pixel das caixas de logo, a maior camada cobre 10% do tronco e o maior degradê 25%. As bordas das faixas dos degradês novos são inclinadas ou curvas; com antialias, duas faixas vizinhas somam opacidade no mesmo pixel e o teste de `colorAt` falha (até 53 divergências). Por isso os dois usam `shape-rendering="crispEdges"`, e o radial desenha cada anel como path `evenodd` que repete o texto exato do círculo vizinho.

---

### Task 1: Região de camada e o padrão `side-lines`

**Files:**
- Modify: `src/patterns/types.ts`
- Modify: `src/patterns/registry.ts`
- Create: `src/patterns/torso-edges.ts`
- Create: `src/patterns/side-lines.ts`
- Test: `tests/patterns/patterns.test.ts`, `tests/core/validation.test.ts`, `tests/styles/profiles.test.ts`

**Interfaces:**
- Consumes: `PatternTemplate`, `PatternGeometry` (`src/patterns/types.ts`), `fmt` (`src/patterns/svg.ts`), `LOGO_BOXES` (`src/renderers/shirt-2d-shape.ts`, só nos testes).
- Produces: `export type LayerSlot = "sides" | "shoulders" | "lower"` e `layerSlot?: LayerSlot` em `PatternTemplate`; `listLayerTemplates(): PatternTemplate[]` em `src/patterns/registry.ts`; `TORSO_LEFT`, `TORSO_RIGHT` em `src/patterns/torso-edges.ts`; `sideLinesPattern` (id `side-lines`, params `width`).

- [ ] **Step 1: Write the failing tests**

Em `tests/patterns/patterns.test.ts`:

1. Trocar `import { getPatternTemplate, listPatternTemplates } from "../../src/patterns/registry.js";` por:

```ts
import { getPatternTemplate, listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";
import { LOGO_BOXES } from "../../src/renderers/shirt-2d-shape.js";
```

2. Logo depois da função `paramSamples`, acrescentar:

```ts
// O pior caso de uma camada combina extremos (ex.: inset, thickness e gap máximos), então entram também todos no mínimo e todos no máximo.
function extremeSamples(template: PatternTemplate): Record<string, number>[] {
  const entries = Object.entries(template.parameters);
  return [
    ...paramSamples(template),
    Object.fromEntries(entries.map(([key, spec]) => [key, spec.min])),
    Object.fromEntries(entries.map(([key, spec]) => [key, spec.max])),
  ];
}

// Camada sozinha, em branco sobre preto: pixels pintados dentro das caixas de logo e fração pintada do tronco (x 115–300, y 150–380).
async function layerFootprint(template: PatternTemplate, raw: Record<string, number>): Promise<{ logoPixels: number; torsoShare: number }> {
  const svg = wrap(`<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>${renderWith(template, raw)}`);
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  const red = (x: number, y: number): number => data[(y * info.width + x) * info.channels]!;
  let logoPixels = 0;
  for (const box of Object.values(LOGO_BOXES)) {
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) if (red(x, y) > 0) logoPixels++;
    }
  }
  let painted = 0;
  for (let y = 150; y < 380; y++) {
    for (let x = 115; x < 300; x++) if (red(x, y) > 0x88) painted++;
  }
  return { logoPixels, torsoShare: painted / (230 * 185) };
}
```

3. Logo depois do `describe.each(listPatternTemplates() …)("pattern %s", …)`, acrescentar:

```ts
describe.each(listLayerTemplates().map((template) => [template.id, template] as const))("layer %s", (_id, template) => {
  // Como camada, o render recebe a cor da camada como overlay; a base do contexto nunca é pintada.
  it("draws only in the overlay color", () => {
    expect(renderWith(template, {})).not.toContain("#123456");
  });

  it("never paints a logo box and covers less than 15% of the torso", async () => {
    for (const raw of extremeSamples(template)) {
      const { logoPixels, torsoShare } = await layerFootprint(template, raw);
      expect(logoPixels).toBe(0);
      expect(torsoShare).toBeLessThan(0.15);
    }
  });
});
```

4. Em `ALL_PATTERN_IDS`, acrescentar `"side-lines"` depois de `"gradient"`, e logo abaixo da constante:

```ts
const LAYER_PATTERN_IDS = ["side-lines"];
```

5. Dentro de `describe("registry", …)`, acrescentar:

```ts
  it("lists the layer patterns in registry order", () => {
    expect(listLayerTemplates().map((template) => template.id)).toEqual(LAYER_PATTERN_IDS);
  });
```

6. No fim do arquivo, acrescentar:

```ts
describe("layer patterns colorAt", () => {
  const at = (id: string, raw: Record<string, number>, x: number, y: number) => {
    const template = getPatternTemplate(id);
    return template.colorAt(x, y, { width: SIZE, height: SIZE, params: resolveParams(template, raw) });
  };

  // width 0.02: painéis em x 112–120,3 e 293,7–302; fora do tronco é base.
  it("paints a side panel along each torso edge", () => {
    expect(at("side-lines", { width: 0.02 }, 116, 200)).toBe("overlay");
    expect(at("side-lines", { width: 0.02 }, 298, 200)).toBe("overlay");
    expect(at("side-lines", { width: 0.02 }, 130, 200)).toBe("base");
    expect(at("side-lines", { width: 0.02 }, 100, 200)).toBe("base");
  });
});
```

Em `tests/core/validation.test.ts`, trocar a linha `const KNOWN_PATTERNS = "solid, stripes, …, gradient";` por (o teste de ordem do registry em `tests/patterns/patterns.test.ts` continua fixando a lista):

```ts
const KNOWN_PATTERNS = listPatternTemplates()
  .map((template) => template.id)
  .join(", ");
```

e acrescentar no topo `import { listPatternTemplates } from "../../src/patterns/registry.js";`.

Em `tests/styles/profiles.test.ts`, trocar o teste `reaches every registered pattern from at least one profile` por:

```ts
  // Padrão de camada só entra em layerWeights: como principal sorteado pelo perfil, ele deixaria o tronco quase liso.
  it("reaches every pattern that is not a layer from patternWeights, and no layer pattern", () => {
    const reached = new Set(STYLE_PROFILES.flatMap((profile) => Object.keys(profile.patternWeights)));
    const principal = listPatternTemplates()
      .filter((template) => template.layerSlot === undefined)
      .map((template) => template.id);
    expect([...reached].sort()).toEqual([...principal].sort());
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/patterns tests/core/validation.test.ts tests/styles/profiles.test.ts`
Expected: FAIL em `tests/patterns/patterns.test.ts` (`listLayerTemplates is not a function`). Os testes de `tests/core/validation.test.ts` e `tests/styles/profiles.test.ts` passam: eles só mudam de forma, e o registry ainda não tem padrão de camada.

- [ ] **Step 3: Write minimal implementation**

Em `src/patterns/types.ts`, logo depois de `export type PatternLayer = "base" | "overlay";`, acrescentar:

```ts

// Região do tronco que uma camada de detalhe ocupa; o generator nunca põe duas camadas do mesmo kit na mesma região.
export type LayerSlot = "sides" | "shoulders" | "lower";
```

e, em `PatternTemplate`, logo depois de `parameters: Record<string, PatternParameter>;`:

```ts
  // Presente só nos padrões que podem ser camada (KitDefinition.layers): o render() deles desenha só o overlay, e nos ranges nada pinta as caixas de logo.
  layerSlot?: LayerSlot;
```

Criar `src/patterns/torso-edges.ts`:

```ts
// Bordas do tronco no 2D (x 112 e 302 no viewBox 414, abaixo das axilas): as camadas laterais ficam entre elas e as caixas de logo (x 145–269).
export const TORSO_LEFT = 112 / 414;
export const TORSO_RIGHT = 302 / 414;
```

Criar `src/patterns/side-lines.ts`:

```ts
import { fmt } from "./svg.js";
import { TORSO_LEFT, TORSO_RIGHT } from "./torso-edges.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function sideBands({ width, params }: PatternGeometry): [number, number][] {
  const band = params.width * width;
  const [left, right] = [TORSO_LEFT * width, TORSO_RIGHT * width];
  return [
    [left, left + band],
    [right - band, right],
  ];
}

export const sideLinesPattern: PatternTemplate = {
  id: "side-lines",
  name: "Side lines",
  category: "detail",
  layerSlot: "sides",
  // width máximo 0.03 (12 px) deixa o painel em x ≤ 125, longe das caixas de logo (x ≥ 145).
  parameters: { width: { min: 0.012, max: 0.03, default: 0.02 } },
  render(context) {
    const rects = sideBands(context).map(([from, to]) => `<rect x="${fmt(from)}" y="0" width="${fmt(to - from)}" height="${fmt(context.height)}"/>`);
    return `<g fill="${context.overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, _y, geometry) {
    return sideBands(geometry).some(([from, to]) => x >= from && x <= to) ? "overlay" : "base";
  },
};
```

Em `src/patterns/registry.ts`, acrescentar `import { sideLinesPattern } from "./side-lines.js";` (em ordem alfabética, entre `sash` e `solid`), `sideLinesPattern,` no fim do array `TEMPLATES` (depois de `gradientPattern`) e, depois de `listPatternTemplates`:

```ts
export function listLayerTemplates(): PatternTemplate[] {
  return TEMPLATES.filter((template) => template.layerSlot !== undefined);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/patterns tests/core tests/styles tests/generator tests/renderers && npm run typecheck`
Expected: PASS. As guardas `Phase 3b baseline` não mudam: `side-lines` não tem peso em perfil nenhum, e `rng.weighted` descarta candidatos de peso zero.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/patterns tests/patterns tests/core/validation.test.ts tests/styles/profiles.test.ts
git commit -m "feat: add layer slots and the side-lines pattern

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Padrões de linha e formas do tronco

**Files:**
- Create: `src/patterns/double-pinline.ts`
- Create: `src/patterns/horizontal-lines.ts`
- Create: `src/patterns/torso-shapes.ts`
- Modify: `src/patterns/registry.ts`
- Test: `tests/patterns/patterns.test.ts`

**Interfaces:**
- Consumes: `LayerSlot`, `PatternTemplate`, `PatternGeometry`, `PatternParameter`, `PatternRenderContext` (`src/patterns/types.ts`); `TORSO_LEFT`, `TORSO_RIGHT` (Task 1); `fmt`.
- Produces: `doublePinlinePattern` (`double-pinline`, `sides`, params `inset`, `thickness`, `gap`); `shoulderLinePattern` (`shoulder-line`, `shoulders`) e `hoopLinePattern` (`hoop-line`, `lower`), params `position`, `thickness`; `torsoCirclePattern`, `torsoDiamondPattern`, `torsoTrianglePattern`, `torsoCrossPattern` (`torso-*`, `lower`), params `size`, `stroke`.

- [ ] **Step 1: Write the failing tests**

Em `tests/patterns/patterns.test.ts`:

1. Em `ALL_PATTERN_IDS`, depois de `"side-lines"`, acrescentar `"double-pinline", "shoulder-line", "hoop-line", "torso-circle", "torso-diamond", "torso-triangle", "torso-cross"`.
2. Trocar `const LAYER_PATTERN_IDS = ["side-lines"];` por:

```ts
const LAYER_PATTERN_IDS = ["side-lines", "double-pinline", "shoulder-line", "hoop-line", "torso-circle", "torso-diamond", "torso-triangle", "torso-cross"];
```

3. Dentro de `describe("layer patterns colorAt", …)`, depois do teste de `side-lines`, acrescentar:

```ts
  // Defaults: filetes em x 128,1–131 e 134,8–137,7 à esquerda e 276,3–279,2 e 283–285,9 à direita.
  it("paints two thin lines on each side, inside the side panel area", () => {
    expect(at("double-pinline", {}, 129.5, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 133, 300)).toBe("base");
    expect(at("double-pinline", {}, 136, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 284, 300)).toBe("overlay");
    expect(at("double-pinline", {}, 140, 300)).toBe("base");
  });

  it("places the shoulder line above the logos and the hoop line below the sponsor", () => {
    expect(at("shoulder-line", {}, 207, 82)).toBe("overlay");
    expect(at("shoulder-line", {}, 207, 90)).toBe("base");
    expect(at("hoop-line", {}, 207, 298)).toBe("overlay");
    expect(at("hoop-line", {}, 207, 310)).toBe("base");
  });

  // Defaults: centro (207, 306,4), raio 49,7, contorno de 7,5 px.
  it("outlines the torso shapes around their center", () => {
    expect(at("torso-circle", {}, 253, 306)).toBe("overlay");
    expect(at("torso-circle", {}, 237, 306)).toBe("base");
    expect(at("torso-circle", {}, 207, 306)).toBe("base");
    expect(at("torso-diamond", {}, 252, 306)).toBe("overlay");
    expect(at("torso-diamond", {}, 267, 306)).toBe("base");
    expect(at("torso-diamond", {}, 207, 306)).toBe("base");
    expect(at("torso-triangle", {}, 207, 285)).toBe("overlay");
    expect(at("torso-triangle", {}, 207, 346)).toBe("overlay");
    expect(at("torso-triangle", {}, 207, 306)).toBe("base");
    expect(at("torso-triangle", {}, 207, 366)).toBe("base");
    expect(at("torso-cross", {}, 237, 306)).toBe("overlay");
    expect(at("torso-cross", {}, 207, 266)).toBe("overlay");
    expect(at("torso-cross", {}, 237, 316)).toBe("base");
    expect(at("torso-cross", {}, 262, 306)).toBe("base");
  });
```

4. Dentro de `describe("new patterns render", …)`, acrescentar:

```ts
  it("draws the layer patterns with the expected elements", () => {
    expect(renderWith(getPatternTemplate("double-pinline"), {}).match(/<rect /g)).toHaveLength(4);
    expect(renderWith(getPatternTemplate("torso-circle"), {}).match(/<circle /g)).toHaveLength(1);
    expect(renderWith(getPatternTemplate("torso-diamond"), {})).toContain('fill-rule="evenodd"');
    expect(renderWith(getPatternTemplate("torso-triangle"), {})).toContain('fill-rule="evenodd"');
    expect(renderWith(getPatternTemplate("torso-cross"), {}).match(/<rect /g)).toHaveLength(2);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/patterns`
Expected: FAIL em `lists the patterns in registry order`, `lists the layer patterns in registry order` e nos testes novos de `colorAt`/render (`Unknown pattern "double-pinline"`).

- [ ] **Step 3: Write minimal implementation**

Criar `src/patterns/double-pinline.ts`:

```ts
import { fmt } from "./svg.js";
import { TORSO_LEFT, TORSO_RIGHT } from "./torso-edges.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function pinlines({ width, params }: PatternGeometry): [number, number][] {
  const [inset, thickness, gap] = [params.inset * width, params.thickness * width, params.gap * width];
  const [left, right] = [TORSO_LEFT * width + inset, TORSO_RIGHT * width - inset];
  return [
    [left, left + thickness],
    [left + thickness + gap, left + 2 * thickness + gap],
    [right - 2 * thickness - gap, right - thickness - gap],
    [right - thickness, right],
  ];
}

export const doublePinlinePattern: PatternTemplate = {
  id: "double-pinline",
  name: "Double pinline",
  category: "detail",
  layerSlot: "sides",
  // inset mínimo 0.035 começa depois do painel de side-lines (x ≤ 125); no máximo, inset + 2·thickness + gap = 0.075 (31 px) termina em x 143, antes das caixas de logo (x 145).
  parameters: {
    inset: { min: 0.035, max: 0.043, default: 0.039 },
    thickness: { min: 0.005, max: 0.01, default: 0.007 },
    gap: { min: 0.006, max: 0.012, default: 0.009 },
  },
  render(context) {
    const rects = pinlines(context).map(([from, to]) => `<rect x="${fmt(from)}" y="0" width="${fmt(to - from)}" height="${fmt(context.height)}"/>`);
    return `<g fill="${context.overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, _y, geometry) {
    return pinlines(geometry).some(([from, to]) => x >= from && x <= to) ? "overlay" : "base";
  },
};
```

Criar `src/patterns/horizontal-lines.ts`:

```ts
import { fmt } from "./svg.js";
import type { LayerSlot, PatternGeometry, PatternParameter, PatternTemplate } from "./types.js";

function lineBounds({ height, params }: PatternGeometry): [number, number] {
  const half = (params.thickness * height) / 2;
  return [params.position * height - half, params.position * height + half];
}

function horizontalLine(id: string, name: string, layerSlot: LayerSlot, position: PatternParameter, thickness: PatternParameter): PatternTemplate {
  return {
    id,
    name,
    category: "detail",
    layerSlot,
    parameters: { position, thickness },
    render(context) {
      const [top, bottom] = lineBounds(context);
      return `<rect x="0" y="${fmt(top)}" width="${fmt(context.width)}" height="${fmt(bottom - top)}" fill="${context.overlay}"/>`;
    },
    colorAt(_x, y, geometry) {
      const [top, bottom] = lineBounds(geometry);
      return y >= top && y <= bottom ? "overlay" : "base";
    },
  };
}

// No máximo a linha vai até y 95: abaixo do decote redondo (y 70) e acima das caixas de logo (y 102).
export const shoulderLinePattern = horizontalLine(
  "shoulder-line",
  "Shoulder line",
  "shoulders",
  { min: 0.19, max: 0.22, default: 0.2 },
  { min: 0.01, max: 0.02, default: 0.015 },
);

// Começa no mínimo em y 241, abaixo da caixa do patrocinador (y 229), e termina no máximo em y 359, acima da barra do tronco (y 382).
export const hoopLinePattern = horizontalLine(
  "hoop-line",
  "Hoop line",
  "lower",
  { min: 0.6, max: 0.85, default: 0.72 },
  { min: 0.015, max: 0.035, default: 0.025 },
);
```

Criar `src/patterns/torso-shapes.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternParameter, PatternRenderContext, PatternTemplate } from "./types.js";

// Centro das formas no 2D (y 306): no tamanho máximo (raio 66) elas ficam entre a caixa do patrocinador (y 229) e a barra do tronco (y 382).
const CENTER_Y = 0.74;

const SHAPE_PARAMETERS: Record<string, PatternParameter> = {
  size: { min: 0.08, max: 0.16, default: 0.12 },
  stroke: { min: 0.012, max: 0.025, default: 0.018 },
};

interface ShapeLayout {
  cx: number;
  cy: number;
  radius: number;
  stroke: number;
}

function shapeLayout({ width, height, params }: PatternGeometry): ShapeLayout {
  return { cx: width / 2, cy: CENTER_Y * height, radius: params.size * width, stroke: params.stroke * width };
}

function torsoShape(
  id: string,
  name: string,
  render: (layout: ShapeLayout, context: PatternRenderContext) => string,
  paints: (dx: number, dy: number, layout: ShapeLayout) => boolean,
): PatternTemplate {
  return {
    id,
    name,
    category: "detail",
    layerSlot: "lower",
    parameters: SHAPE_PARAMETERS,
    render: (context) => render(shapeLayout(context), context),
    colorAt(x, y, geometry) {
      const layout = shapeLayout(geometry);
      return paints(x - layout.cx, y - layout.cy, layout) ? "overlay" : "base";
    },
  };
}

// Contorno de polígono regular: o polígono de dentro é o de fora reduzido no centro, o que dá a mesma espessura em todos os lados.
// distance é a maior projeção do ponto nas normais dos lados, então o contorno é a faixa distance ∈ [apótema − stroke, apótema].
function outlinedPolygon(
  id: string,
  name: string,
  vertices: (radius: number) => [number, number][],
  apothem: (radius: number) => number,
  distance: (dx: number, dy: number) => number,
): PatternTemplate {
  return torsoShape(
    id,
    name,
    ({ cx, cy, radius, stroke }, { overlay }) => {
      const scale = (apothem(radius) - stroke) / apothem(radius);
      const ring = (factor: number) =>
        `M${vertices(radius)
          .map(([px, py]) => `${fmt(cx + px * factor)} ${fmt(cy + py * factor)}`)
          .join(" L")} Z`;
      return `<path d="${ring(1)} ${ring(scale)}" fill="${overlay}" fill-rule="evenodd"/>`;
    },
    (dx, dy, { radius, stroke }) => {
      const value = distance(dx, dy);
      return value <= apothem(radius) && value >= apothem(radius) - stroke;
    },
  );
}

export const torsoCirclePattern = torsoShape(
  "torso-circle",
  "Torso circle",
  ({ cx, cy, radius, stroke }, { overlay }) =>
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius - stroke / 2)}" fill="none" stroke="${overlay}" stroke-width="${fmt(stroke)}"/>`,
  (dx, dy, { radius, stroke }) => {
    const distance = Math.hypot(dx, dy);
    return distance <= radius && distance >= radius - stroke;
  },
);

export const torsoDiamondPattern = outlinedPolygon(
  "torso-diamond",
  "Torso diamond",
  (radius) => [
    [0, -radius],
    [radius, 0],
    [0, radius],
    [-radius, 0],
  ],
  (radius) => radius / Math.SQRT2,
  (dx, dy) => (Math.abs(dx) + Math.abs(dy)) / Math.SQRT2,
);

const SIN_60 = Math.sqrt(3) / 2;

// Ponta para baixo: o lado reto fica em cima, mais longe do patrocinador.
export const torsoTrianglePattern = outlinedPolygon(
  "torso-triangle",
  "Torso triangle",
  (radius) => [
    [-radius * SIN_60, -radius / 2],
    [radius * SIN_60, -radius / 2],
    [0, radius],
  ],
  (radius) => radius / 2,
  (dx, dy) => Math.max(-dy, -SIN_60 * dx + dy / 2, SIN_60 * dx + dy / 2),
);

export const torsoCrossPattern = torsoShape(
  "torso-cross",
  "Torso cross",
  ({ cx, cy, radius, stroke }, { overlay }) =>
    `<g fill="${overlay}"><rect x="${fmt(cx - radius)}" y="${fmt(cy - stroke / 2)}" width="${fmt(2 * radius)}" height="${fmt(stroke)}"/><rect x="${fmt(cx - stroke / 2)}" y="${fmt(cy - radius)}" width="${fmt(stroke)}" height="${fmt(2 * radius)}"/></g>`,
  (dx, dy, { radius, stroke }) => (Math.abs(dx) <= radius && Math.abs(dy) <= stroke / 2) || (Math.abs(dy) <= radius && Math.abs(dx) <= stroke / 2),
);
```

Em `src/patterns/registry.ts`, acrescentar os imports (em ordem alfabética do caminho):

```ts
import { doublePinlinePattern } from "./double-pinline.js";
import { hoopLinePattern, shoulderLinePattern } from "./horizontal-lines.js";
import { torsoCirclePattern, torsoCrossPattern, torsoDiamondPattern, torsoTrianglePattern } from "./torso-shapes.js";
```

e, no array `TEMPLATES`, depois de `sideLinesPattern,`:

```ts
  doublePinlinePattern,
  shoulderLinePattern,
  hoopLinePattern,
  torsoCirclePattern,
  torsoDiamondPattern,
  torsoTrianglePattern,
  torsoCrossPattern,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/patterns tests/core tests/styles tests/generator tests/renderers && npm run typecheck`
Expected: PASS, incluindo `layer %s` para os 8 padrões de camada (nenhum pixel nas caixas de logo, menos de 15% do tronco) e `reports with colorAt the layer that render paints` para cada um.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/patterns tests/patterns
git commit -m "feat: add the line and torso shape layer patterns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Degradês diagonal e radial

**Files:**
- Create: `src/patterns/fade.ts`
- Modify: `src/patterns/gradient.ts`
- Create: `src/patterns/gradient-diagonal.ts`
- Create: `src/patterns/gradient-radial.ts`
- Modify: `src/patterns/registry.ts`
- Modify: `src/styles/profiles.ts`
- Test: `tests/patterns/patterns.test.ts`, `tests/renderers/renderer-2d.test.ts`, `tests/styles/pattern-weights.test.ts`, `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `PatternLayer`, `PatternTemplate`, `PatternGeometry`; `fmt`.
- Produces: `TORSO_BOTTOM`, `interface FadeBands { start; end; bands; band }`, `fadeBands(start, end, height): FadeBands`, `fadeLayer(value, bands): PatternLayer` em `src/patterns/fade.ts`; `gradientDiagonalPattern` (`gradient-diagonal`, params `start`, `direction`); `gradientRadialPattern` (`gradient-radial`, params `cx`, `cy`, `radius`). Pesos novos em `patternWeights` de `traditional`, `modern` e `retro`.

- [ ] **Step 1: Write the failing tests**

Em `tests/patterns/patterns.test.ts`:

1. Acrescentar `import { createHash } from "node:crypto";` no topo.
2. Em `ALL_PATTERN_IDS`, depois de `"torso-cross"`, acrescentar `"gradient-diagonal", "gradient-radial"`.
3. Dentro de `describe("new patterns colorAt", …)`, depois do teste do `gradient`, acrescentar:

```ts
  // start 0.68: o degradê vai do valor 281,5 ao 380,9, onde o valor é y + 0,5·(x − 207) na direção 0 e y − 0,5·(x − 207) na direção 1.
  it("fades the diagonal gradient along the chosen direction", () => {
    expect(at("gradient-diagonal", { start: 0.68, direction: 0 }, 207, 200)).toBe("base");
    expect(at("gradient-diagonal", { start: 0.68, direction: 0 }, 207, 400)).toBe("overlay");
    expect(at("gradient-diagonal", { start: 0.68, direction: 0 }, 300, 330)).toBe("overlay");
    expect(at("gradient-diagonal", { start: 0.68, direction: 0 }, 114, 330)).toBe("base");
    expect(at("gradient-diagonal", { start: 0.68, direction: 1 }, 300, 330)).toBe("base");
    expect(at("gradient-diagonal", { start: 0.68, direction: 1 }, 114, 330)).toBe("overlay");
  });

  // Defaults: centro (207, 393,3) e raio 115,9; o overlay passa de metade a menos de 58 px do centro.
  it("fades the radial gradient from its center", () => {
    const params = { cx: 0.5, cy: 0.95, radius: 0.28 };
    expect(at("gradient-radial", params, 207, 380)).toBe("overlay");
    expect(at("gradient-radial", params, 207, 300)).toBe("base");
    expect(at("gradient-radial", params, 207, 250)).toBe("base");
    expect(at("gradient-radial", params, 100, 380)).toBe("base");
    expect(at("gradient-radial", { ...params, cx: 0.25 }, 110, 385)).toBe("overlay");
  });
```

4. Dentro de `describe("new patterns render", …)`, acrescentar:

```ts
  // Bordas inclinadas ou curvas com antialias somam duas faixas no mesmo pixel; crispEdges mantém o colorAt fiel ao render.
  it.each(["gradient-diagonal", "gradient-radial"])("draws %s with opacity bands, without antialias, defs or ids", (id) => {
    const svg = renderWith(getPatternTemplate(id), {});
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain("fill-opacity");
    expect(svg).not.toMatch(/<defs|\sid=/);
  });

  // Guarda do refactor para fade.ts: passa antes e depois da Task 3.
  it("keeps the SVG of the vertical gradient", () => {
    const digest = createHash("sha256")
      .update(renderWith(getPatternTemplate("gradient"), {}))
      .digest("hex");
    expect(digest).toBe("748bbfd56aa108d53a98b902af56892ea90d22bc8927c2f2fd13ad0136702b0e");
  });
```

Em `tests/renderers/renderer-2d.test.ts`:

1. No array `WIDEST`, depois de `["gradient", { start: 0 }],`, acrescentar:

```ts
    ["gradient-diagonal", { start: 0, direction: 0 }],
    ["gradient-diagonal", { start: 0, direction: 1 }],
    ["gradient-radial", { cx: 0, cy: 0, radius: 1 }],
    ["gradient-radial", { cx: 1, cy: 0, radius: 1 }],
```

2. Depois do teste `keeps every logo box on the plain base with the earliest gradient`, acrescentar:

```ts
  // Pelo clamp: start 0.65 (o canto do patrocinador vale 0.628) e centro em y 373 com raio 137 e cx 0.25 ou 0.75 (o canto fica a 150 px).
  const EXTREME_GRADIENTS: [string, Record<string, number>][] = [
    ["gradient-diagonal", { start: 0, direction: 0 }],
    ["gradient-diagonal", { start: 0, direction: 1 }],
    ["gradient-radial", { cx: 0, cy: 0, radius: 1 }],
    ["gradient-radial", { cx: 1, cy: 0, radius: 1 }],
  ];

  it.each(EXTREME_GRADIENTS)("keeps every logo box on the plain base with %s %j", async (id, params) => {
    const kit = makeKit({ pattern: { id, base: "primary", overlay: "secondary", params } });
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });
```

Em `tests/styles/pattern-weights.test.ts`:

1. Em `normalizes a single profile`, trocar `expect(weights.diagonal).toBeCloseTo(0.2);` por `expect(weights.diagonal).toBeCloseTo(0.15);`.
2. Em `averages the normalized profiles`, trocar `expect(weights.solid).toBeCloseTo(0.2);` por `expect(weights.solid).toBeCloseTo(0.15);`.

Em `tests/generator/kit-generator.test.ts`:

1. Em `NEW_PATTERN_IDS`, acrescentar `"gradient-diagonal", "gradient-radial"` no fim.
2. Em `draws from the profiles listed in categories`, trocar o `Set` esperado por `new Set(["hoops", "chest-band", "center-band", "chevron", "stripes", "solid", "gradient-diagonal"])`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/patterns tests/renderers tests/styles tests/generator`
Expected: FAIL nos testes novos (`Unknown pattern "gradient-diagonal"`), na ordem do registry e nos pesos dos perfis. `keeps the SVG of the vertical gradient` passa (é guarda).

- [ ] **Step 3: Write minimal implementation**

Criar `src/patterns/fade.ts`:

```ts
import type { PatternLayer } from "./types.js";

// Barra do tronco 2D (y = 382 no viewBox 414): os degradês que descem terminam nela, com overlay cheio abaixo.
export const TORSO_BOTTOM = 0.92;
// Faixas de ~2 px no 2D: degradê suave sem <defs> nem id.
const BAND_RATIO = 1 / 207;

export interface FadeBands {
  start: number;
  end: number;
  bands: number;
  band: number;
}

// Divide [start, end] em faixas de opacidade crescente: a faixa index tem opacidade (index + 1) / bands.
export function fadeBands(start: number, end: number, height: number): FadeBands {
  const bands = Math.max(1, Math.round((end - start) / (BAND_RATIO * height)));
  return { start, end, bands, band: (end - start) / bands };
}

// Camada que pinta o ponto de valor value: antes de start é base pura, de end em diante é overlay cheio.
export function fadeLayer(value: number, { start, end, bands, band }: FadeBands): PatternLayer {
  if (value < start) return "base";
  if (value >= end) return "overlay";
  // Opacidade 0.5 exata vira 127 ou 128 no PNG: só conta como overlay acima da metade, como o limiar do teste de pixel.
  return (Math.floor((value - start) / band) + 1) / bands > 0.5 ? "overlay" : "base";
}
```

Trocar o conteúdo de `src/patterns/gradient.ts` por (mesmo SVG e mesmo `colorAt`; a guarda de digest confere):

```ts
import { fadeBands, fadeLayer, TORSO_BOTTOM, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function gradientFade({ height, params }: PatternGeometry): FadeBands {
  return fadeBands(params.start * height, TORSO_BOTTOM * height, height);
}

export const gradientPattern: PatternTemplate = {
  id: "gradient",
  name: "Gradient",
  category: "modern",
  // start mínimo 0.58 fica abaixo da caixa do patrocinador (y 229 = 0.553): os logos do 2D ficam sempre sobre a base pura.
  parameters: { start: { min: 0.58, max: 0.72, default: 0.65 } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band } = gradientFade(context);
    const rects: string[] = [];
    for (let index = 0; index < bands; index++) {
      rects.push(`<rect x="0" y="${fmt(start + index * band)}" width="${fmt(width)}" height="${fmt(band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    rects.push(`<rect x="0" y="${fmt(end)}" width="${fmt(width)}" height="${fmt(height - end)}"/>`);
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(_x, y, geometry) {
    return fadeLayer(y, gradientFade(geometry));
  },
};
```

Criar `src/patterns/gradient-diagonal.ts`:

```ts
import { fadeBands, fadeLayer, TORSO_BOTTOM, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

// Inclinação das linhas de mesma cor (≈27°). O valor do degradê é y + tilt·(x − w/2): o canto de baixo do patrocinador (x 269, y 229) vale 260 (0.628), abaixo do start mínimo.
const SLOPE = 0.5;

interface DiagonalFade extends FadeBands {
  tilt: number;
}

function diagonalFade({ height, params }: PatternGeometry): DiagonalFade {
  return { ...fadeBands(params.start * height, TORSO_BOTTOM * height, height), tilt: params.direction === 0 ? SLOPE : -SLOPE };
}

export const gradientDiagonalPattern: PatternTemplate = {
  id: "gradient-diagonal",
  name: "Diagonal gradient",
  category: "modern",
  parameters: { start: { min: 0.65, max: 0.72, default: 0.68 }, direction: { min: 0, max: 1, default: 0, integer: true } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band, tilt } = diagonalFade(context);
    // A linha de valor v cruza x = 0 em y = v + tilt·w/2 e x = w em y = v − tilt·w/2.
    const [left, right] = [(tilt * width) / 2, (-tilt * width) / 2];
    const quad = (from: number, to: number) => `0,${fmt(from + left)} ${fmt(width)},${fmt(from + right)} ${fmt(width)},${fmt(to + right)} 0,${fmt(to + left)}`;
    const polygons: string[] = [];
    for (let index = 0; index < bands; index++) {
      polygons.push(`<polygon points="${quad(start + index * band, start + (index + 1) * band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    // Overlay cheio do fim até além do canvas, em qualquer inclinação.
    polygons.push(`<polygon points="${quad(end, height + SLOPE * width)}"/>`);
    // Sem antialias: nas bordas inclinadas ele somaria duas faixas no mesmo pixel, e o colorAt deixaria de espelhar o render.
    return `<g fill="${overlay}" shape-rendering="crispEdges">${polygons.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const fade = diagonalFade(geometry);
    return fadeLayer(y + fade.tilt * (x - geometry.width / 2), fade);
  },
};
```

Criar `src/patterns/gradient-radial.ts`:

```ts
import { fadeBands, fadeLayer, type FadeBands } from "./fade.js";
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

interface RadialFade extends FadeBands {
  cx: number;
  cy: number;
  radius: number;
}

// Valor do degradê = radius − distância ao centro: 0 na borda do círculo, radius no centro.
function radialFade({ width, height, params }: PatternGeometry): RadialFade {
  const radius = params.radius * height;
  return { ...fadeBands(0, radius, height), cx: params.cx * width, cy: params.cy * height, radius };
}

export const gradientRadialPattern: PatternTemplate = {
  id: "gradient-radial",
  name: "Radial gradient",
  category: "modern",
  // Raio máximo 0.33 (137 px) com o centro em y ≥ 0.9 (373 px): o degradê para em y 236, abaixo da caixa do patrocinador (y 229); com cx nos extremos, o canto dela fica a 150 px do centro.
  parameters: {
    cx: { min: 0.25, max: 0.75, default: 0.5 },
    cy: { min: 0.9, max: 1, default: 0.95 },
    radius: { min: 0.22, max: 0.33, default: 0.28 },
  },
  render(context) {
    const { cx, cy, radius, bands, band } = radialFade(context);
    // O mesmo texto desenha o círculo nos dois anéis que ele separa: a borda comum é idêntica, e nenhum pixel fica sem anel ou com dois.
    const circle = (r: number) =>
      `M${fmt(cx - r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`;
    const rings: string[] = [];
    for (let index = 0; index < bands; index++) {
      const inner = index === bands - 1 ? "" : ` ${circle(radius - (index + 1) * band)}`;
      rings.push(`<path d="${circle(radius - index * band)}${inner}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    // Sem antialias pelo mesmo motivo do gradient-diagonal: bordas curvas somariam dois anéis no mesmo pixel.
    return `<g fill="${context.overlay}" fill-rule="evenodd" shape-rendering="crispEdges">${rings.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const fade = radialFade(geometry);
    return fadeLayer(fade.radius - Math.hypot(x - fade.cx, y - fade.cy), fade);
  },
};
```

Em `src/patterns/registry.ts`, acrescentar os imports `import { gradientDiagonalPattern } from "./gradient-diagonal.js";` e `import { gradientRadialPattern } from "./gradient-radial.js";` (depois do import de `gradient.js`) e, no fim do array `TEMPLATES`, depois de `torsoCrossPattern,`:

```ts
  gradientDiagonalPattern,
  gradientRadialPattern,
```

Em `src/styles/profiles.ts`, trocar os três `patternWeights` (somas continuam 100):

```ts
    patternWeights: { solid: 25, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5, "gradient-radial": 5 },
```

(`traditional`),

```ts
    patternWeights: { solid: 10, diagonal: 15, gradient: 15, checkers: 15, halves: 10, chevron: 10, sash: 10, "gradient-diagonal": 10, "gradient-radial": 5 },
```

(`modern`) e

```ts
    patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 5, "gradient-diagonal": 5 },
```

(`retro`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS na suíte inteira. As guardas `Phase 3b baseline` não mudam: o clube sem categorias usa `classic`, e o `branded` tem `patternWeights` próprio, que vence os perfis.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/patterns src/styles/profiles.ts tests/patterns tests/renderers tests/styles tests/generator
git commit -m "feat: add the diagonal and radial gradients

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Campo `layers` no `kit.json`

**Files:**
- Modify: `src/core/kit.ts`
- Test: `tests/core/kit.test.ts`

**Interfaces:**
- Consumes: `ColorRoleSchema` (`src/core/kit.ts`).
- Produces: `export const MAX_LAYERS = 2`; `layers?: KitLayer[]` em `KitDefinition`; `export type KitLayer = { id: string; color: ColorRole; params: Record<string, number> }` (inferido de `LayerSchema`); `visibleRoles(kit)` inclui a cor de cada camada.

- [ ] **Step 1: Write the failing tests**

Em `tests/core/kit.test.ts`, trocar o import do topo por `import { COLLAR_STYLES, KIT_TYPES, MAX_LAYERS, parseKitDefinition, resolveLogoColor, SLEEVE_CUTS, sleeveCut, visibleRoles } from "../../src/core/kit.js";` e, dentro de `describe("parseKitDefinition", …)`, acrescentar:

```ts
  it("accepts up to MAX_LAYERS layers and keeps them through a JSON round trip", () => {
    const layers = [
      { id: "side-lines", color: "accent" as const, params: { width: 0.02 } },
      { id: "torso-circle", color: "accent" as const, params: {} },
    ];
    expect(layers).toHaveLength(MAX_LAYERS);
    const kit = makeKit({ layers });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("rejects more than MAX_LAYERS layers", () => {
    const layer = { id: "side-lines", color: "accent", params: {} };
    expect(() => parseKitDefinition({ ...makeKit(), layers: [layer, layer, layer] })).toThrow(/at layers/);
  });

  it("defaults missing layer params to an empty object", () => {
    expect(parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "accent" }] }).layers).toEqual([
      { id: "side-lines", color: "accent", params: {} },
    ]);
  });

  it("rejects unknown layer colors and keys and names the path", () => {
    expect(() => parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "gold" }] })).toThrow(/layers\[0\]\.color/);
    expect(() => parseKitDefinition({ ...makeKit(), layers: [{ id: "side-lines", color: "accent", colour: "accent" }] })).toThrow(/colour/);
  });

  it("keeps kits from before Phase 4b without layers", () => {
    expect(parseKitDefinition(makeKit())).not.toHaveProperty("layers");
  });
```

Dentro de `describe("visibleRoles", …)`, acrescentar:

```ts
  it("counts the layer colors", () => {
    const kit = makeKit({
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
      layers: [{ id: "side-lines", color: "accent", params: {} }],
    });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary", "accent"]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/kit.test.ts`
Expected: FAIL (`layers` é chave desconhecida no `strictObject`; `MAX_LAYERS` é `undefined`).

- [ ] **Step 3: Write minimal implementation**

Em `src/core/kit.ts`:

1. Depois de `export const BRAND_LISTS = …;`, acrescentar:

```ts
export const MAX_LAYERS = 2;
```

2. Depois de `const BrandLogoSchema = …;`, acrescentar:

```ts
// Camada de detalhe sobre o padrão principal, só no corpo; o id aponta para um padrão com layerSlot.
const LayerSchema = z.strictObject({ id: z.string().min(1), color: ColorRoleSchema, params: z.record(z.string(), z.number()).default({}) });
```

3. Em `KitDefinitionSchema`, logo depois da linha `pattern: …`, acrescentar:

```ts
  // Ausente = sem camadas: os kit.json de antes da Fase 4b continuam válidos.
  layers: z.array(LayerSchema).max(MAX_LAYERS).optional(),
```

4. Depois de `export type BrandLogo = …;`, acrescentar `export type KitLayer = z.infer<typeof LayerSchema>;`.

5. Trocar `visibleRoles` (comentário e primeira linha) por:

```ts
// Papéis que aparecem na camisa (o PNG 2D mostra só ela). O overlay só pinta o corpo fora do padrão solid, a manga lisa tem cor própria e cada camada pinta a cor dela.
export function visibleRoles(kit: KitDefinition): ColorRole[] {
  const roles: ColorRole[] = [kit.pattern.base, kit.collar.color, kit.sleeves.cuffColor, ...(kit.layers ?? []).map((layer) => layer.color)];
  if (kit.pattern.id !== "solid") roles.push(kit.pattern.overlay);
  if (kit.sleeves.style === "solid") roles.push(kit.sleeves.color);
  return COLOR_ROLES.filter((role) => roles.includes(role));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core tests/generator && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/core/kit.ts tests/core/kit.test.ts
git commit -m "feat: accept detail layers in the kit definition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Validação das camadas

**Files:**
- Modify: `src/core/logo-colors.ts`
- Modify: `src/core/validation.ts`
- Test: `tests/core/logo-colors.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `listLayerTemplates`, `listPatternTemplates` (Task 1); `KitLayer`, `MAX_LAYERS` (Task 4); `LOGO_BOXES`, `SHIRT_2D_VIEWBOX`.
- Produces: `overlayShare(template: PatternTemplate, params: Record<string, number>, slot: LogoSlot): number` em `src/core/logo-colors.ts`; regras `unknown-layer`, `layer-duplicate`, `layer-color`, `layer-logo-overlap` em `validateKit`; `forbidden-pattern` para camadas em `validateKitTraditions`.

- [ ] **Step 1: Write the failing tests**

Em `tests/core/logo-colors.test.ts`, trocar o import de `logo-colors.js` por `import { backgroundRoles, chooseLogoColors, MIN_LOGO_CONTRAST, overlayShare, type LogoColors } from "../../src/core/logo-colors.js";` e acrescentar, antes de `describe("chooseLogoColors", …)`:

```ts
describe("overlayShare", () => {
  it("measures the part of a logo box that the overlay paints", () => {
    expect(overlayShare(getPatternTemplate("solid"), {}, "sponsor")).toBe(0);
    // Faixa em y 155,3–217,4: cobre 18 das 24 linhas da grade do patrocinador (y 182–228) e nada do escudo (y 102–138).
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "sponsor")).toBe(0.75);
    expect(overlayShare(getPatternTemplate("chest-band"), { position: 0.45, width: 0.15 }, "badge")).toBe(0);
  });
});
```

Em `tests/core/validation.test.ts`:

1. Trocar o import do registry por `import { listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";` e acrescentar, depois de `KNOWN_PATTERNS`:

```ts
const LAYER_PATTERNS = listLayerTemplates()
  .map((template) => template.id)
  .join(", ");
```

2. Depois de `describe("validateKit logo-contrast", …)`, acrescentar:

```ts
describe("validateKit layers", () => {
  const stripes = { id: "stripes", base: "primary" as const, overlay: "secondary" as const, params: {} };
  const layer = (id: string, color: "primary" | "secondary" | "accent" = "accent", params: Record<string, number> = {}) => ({ id, color, params });

  it("accepts layers in the color the pattern does not paint", () => {
    expect(validateKit(makeKit({ pattern: stripes, layers: [layer("side-lines"), layer("torso-circle")] }))).toEqual([]);
  });

  it("lets a layer on a solid kit use the overlay role, which solid does not paint", () => {
    expect(validateKit(makeKit({ layers: [layer("side-lines", "secondary")] }))).toEqual([]);
  });

  it("reports layers outside the registry", () => {
    expect(validateKit(makeKit({ layers: [layer("zigzag")] }))).toEqual([
      { rule: "unknown-layer", message: `home kit layer "zigzag" is not a layer pattern (known: ${LAYER_PATTERNS})` },
    ]);
  });

  it("measures a registered pattern that is not a layer and reports the logos it paints over", () => {
    expect(validateKit(makeKit({ layers: [layer("chest-band", "accent", { position: 0.45, width: 0.15 })] }))).toEqual([
      { rule: "unknown-layer", message: `home kit layer "chest-band" is not a layer pattern (known: ${LAYER_PATTERNS})` },
      { rule: "layer-logo-overlap", message: 'home kit layer "chest-band" paints over the sponsor box' },
    ]);
  });

  it("reports a layer that repeats the pattern or another layer", () => {
    expect(validateKit(makeKit({ pattern: { ...stripes, id: "side-lines" }, layers: [layer("side-lines")] }))).toEqual([
      { rule: "layer-duplicate", message: 'home kit layer "side-lines" repeats the pattern or another layer' },
    ]);
    expect(validateKit(makeKit({ pattern: stripes, layers: [layer("torso-circle"), layer("torso-circle")] }))).toEqual([
      { rule: "layer-duplicate", message: 'home kit layer "torso-circle" repeats the pattern or another layer' },
    ]);
  });

  it("reports a layer in a color the pattern already paints", () => {
    expect(validateKit(makeKit({ pattern: stripes, layers: [layer("side-lines", "secondary"), layer("torso-circle", "primary")] }))).toEqual([
      { rule: "layer-color", message: 'home kit layer "side-lines" uses secondary, which the pattern already paints' },
      { rule: "layer-color", message: 'home kit layer "torso-circle" uses primary, which the pattern already paints' },
    ]);
  });
});
```

3. Dentro de `describe("validateKitTraditions", …)`, trocar a mensagem esperada de `reports a kit that does not show the required color` por `"home kit does not show accent #ffd700 (traditions.requiredColor) on the pattern, layers, sleeves, collar or cuffs"` e acrescentar:

```ts
  it("reports a forbidden layer", () => {
    const forbidding = club({ traditions: { forbiddenPatterns: ["side-lines"] } });
    const kit = makeKit({ kitType: "away", layers: [{ id: "side-lines", color: "accent", params: {} }] });
    expect(validateKitTraditions(forbidding, kit)).toEqual([
      { rule: "forbidden-pattern", message: 'away kit uses layer "side-lines", which traditions.forbiddenPatterns forbids' },
    ]);
  });

  it("applies the list of the kit type only to the main pattern", () => {
    expect(validateKitTraditions(traditions, { ...kitWith("home", "stripes"), layers: [{ id: "torso-circle", color: "accent", params: {} }] })).toEqual([]);
  });

  it("counts a layer in the required color as shown", () => {
    const required = club({ traditions: { requiredColor: "accent" } });
    const hidden = makeKit({
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
      layers: [{ id: "side-lines", color: "accent", params: {} }],
    });
    expect(validateKitTraditions(required, hidden)).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL (`overlayShare` não existe; `validateKit` ignora `layers`; mensagem de `required-color` antiga).

- [ ] **Step 3: Write minimal implementation**

Em `src/core/logo-colors.ts`, acrescentar `import type { PatternTemplate } from "../patterns/types.js";` e trocar `backgroundRoles` inteira por:

```ts
// Fração da caixa do logo que o padrão pinta com o overlay, numa grade GRID×GRID no layout 2D.
export function overlayShare(template: PatternTemplate, params: Record<string, number>, slot: LogoSlot): number {
  const geometry = { width: SHIRT_2D_VIEWBOX, height: SHIRT_2D_VIEWBOX, params: resolveParams(template, params) };
  const box = LOGO_BOXES[slot];
  let overlay = 0;
  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      const x = box.x + ((column + 0.5) * box.width) / GRID;
      const y = box.y + ((row + 0.5) * box.height) / GRID;
      if (template.colorAt(x, y, geometry) === "overlay") overlay++;
    }
  }
  return overlay / (GRID * GRID);
}

// Mede no layout 2D, o mesmo que o renderer usa para posicionar os logos. Só o padrão principal conta: as camadas nunca entram nas caixas (layer-logo-overlap).
export function backgroundRoles(kit: KitDefinition, slot: LogoSlot): ColorRole[] {
  const overlay = overlayShare(getPatternTemplate(kit.pattern.id), kit.pattern.params, slot);
  const shares: [ColorRole, number][] = [
    [kit.pattern.base, 1 - overlay],
    [kit.pattern.overlay, overlay],
  ];
  const roles = shares
    .filter(([, share]) => share >= MIN_BACKGROUND_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([role]) => role);
  return [...new Set(roles)];
}
```

Em `src/core/validation.ts`:

1. Trocar `import { listPatternTemplates } from "../patterns/registry.js";` por `import { listLayerTemplates, listPatternTemplates } from "../patterns/registry.js";`, acrescentar `type LogoSlot` ao import de `./kit.js` e trocar `import { backgroundRoles, MIN_LOGO_CONTRAST } from "./logo-colors.js";` por `import { backgroundRoles, MIN_LOGO_CONTRAST, overlayShare } from "./logo-colors.js";`.

2. Depois de `export const MIN_COLOR_DISTANCE = 0.15;`, acrescentar:

```ts
const LOGO_SLOTS: readonly LogoSlot[] = ["badge", ...BRAND_KINDS];
```

3. Antes de `export function validateKit`, acrescentar:

```ts
function layerIssues(kit: KitDefinition): ValidationIssue[] {
  const layerIds = listLayerTemplates().map((template) => template.id);
  const templates = new Map(listPatternTemplates().map((template) => [template.id, template]));
  // O solid não pinta o overlay no corpo, então a camada pode usar a cor dele.
  const painted = kit.pattern.id === "solid" ? [kit.pattern.base] : [kit.pattern.base, kit.pattern.overlay];
  const used = new Set([kit.pattern.id]);
  const issues: ValidationIssue[] = [];
  for (const layer of kit.layers ?? []) {
    const label = `${kit.kitType} kit layer "${layer.id}"`;
    if (!layerIds.includes(layer.id)) issues.push({ rule: "unknown-layer", message: `${label} is not a layer pattern (known: ${layerIds.join(", ")})` });
    if (used.has(layer.id)) issues.push({ rule: "layer-duplicate", message: `${label} repeats the pattern or another layer` });
    used.add(layer.id);
    if (painted.includes(layer.color)) issues.push({ rule: "layer-color", message: `${label} uses ${layer.color}, which the pattern already paints` });
    const template = templates.get(layer.id);
    // Fora do registry não há colorAt para medir; unknown-layer já explica o problema.
    if (!template) continue;
    for (const slot of LOGO_SLOTS) {
      if (overlayShare(template, layer.params, slot) > 0) issues.push({ rule: "layer-logo-overlap", message: `${label} paints over the ${slot} box` });
    }
  }
  return issues;
}
```

4. Em `validateKit`, trocar as duas últimas linhas (`if (patternKnown) issues.push(...logoContrastIssues(kit));` e `return issues;`) por:

```ts
  if (patternKnown) issues.push(...logoContrastIssues(kit));
  return [...issues, ...layerIssues(kit)];
```

5. Em `validateKitTraditions`, logo depois do `if` de `forbidden-pattern` do padrão, acrescentar:

```ts
  for (const layer of kit.layers ?? []) {
    if (traditions.forbiddenPatterns?.includes(layer.id)) {
      issues.push({ rule: "forbidden-pattern", message: `${kit.kitType} kit uses layer "${layer.id}", which traditions.forbiddenPatterns forbids` });
    }
  }
```

e, na mensagem de `required-color`, trocar `on the pattern, sleeves, collar or cuffs` por `on the pattern, layers, sleeves, collar or cuffs`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core tests/generator tests/cli && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/core tests/core
git commit -m "feat: validate kit layers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Camadas no renderer 2D

**Files:**
- Modify: `src/renderers/kit-design.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Test: `tests/renderers/kit-design.test.ts`, `tests/renderers/renderer-2d.test.ts`

**Interfaces:**
- Consumes: `KitLayer` (Task 4), `getPatternTemplate`, `resolveParams`.
- Produces: `export interface KitLayerFill { template: PatternTemplate; color: string; params: Record<string, number> }`; `KitDesign.bodyLayers: KitLayerFill[]`; `fillSvg(fill: KitFill, width: number, height: number, layers: readonly KitLayerFill[] = []): string`.

- [ ] **Step 1: Write the failing tests**

Em `tests/renderers/kit-design.test.ts`, dentro de `describe("kitDesign", …)`, acrescentar:

```ts
  it("resolves the body layers in order, with hex colors and clamped params", () => {
    const kit = makeKit({
      layers: [
        { id: "side-lines", color: "accent", params: { width: 1 } },
        { id: "torso-circle", color: "secondary", params: {} },
      ],
    });
    expect(kitDesign(kit).bodyLayers).toEqual([
      { template: getPatternTemplate("side-lines"), color: "#ffd700", params: { width: 0.03 } },
      { template: getPatternTemplate("torso-circle"), color: "#ffffff", params: { size: 0.12, stroke: 0.018 } },
    ]);
  });

  it("has no body layers when the kit declares none", () => {
    expect(kitDesign(makeKit()).bodyLayers).toEqual([]);
  });
```

e, dentro de `describe("fillSvg", …)`:

```ts
  it("paints the layers after the pattern, in the layer color, without another base", () => {
    const design = kitDesign(makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 3 } }, layers: [{ id: "side-lines", color: "accent", params: {} }] }));
    const layer = getPatternTemplate("side-lines").render({ width: 414, height: 414, base: "#ffd700", overlay: "#ffd700", params: { width: 0.02 } });
    expect(fillSvg(design.body, 414, 414, design.bodyLayers)).toBe(`${fillSvg(design.body, 414, 414)}${layer}`);
  });
```

Em `tests/renderers/renderer-2d.test.ts`:

1. Dentro de `describe("renderKit2dSvg", …)`, acrescentar:

```ts
  it("renders an empty layer list exactly as a kit without layers", () => {
    expect(renderKit2dSvg(makeKit({ layers: [] }))).toBe(renderKit2dSvg(makeKit()));
  });
```

2. Dentro de `describe("renderKit2dPng", …)`, acrescentar:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderers`
Expected: FAIL (`bodyLayers` é `undefined`; o PNG não tem as camadas).

- [ ] **Step 3: Write minimal implementation**

Em `src/renderers/kit-design.ts`:

1. Depois do tipo `KitFill`, acrescentar:

```ts

// Camada de detalhe já resolvida: o renderer pinta só o overlay dela, na cor da camada.
export interface KitLayerFill {
  template: PatternTemplate;
  color: string;
  params: Record<string, number>;
}
```

2. Em `KitDesign`, logo depois de `body: KitFill;`:

```ts
  // Separadas de body: a manga match-body reusa body e fica sem as camadas.
  bodyLayers: KitLayerFill[];
```

3. Em `kitDesign`, depois de `const body: KitFill = { … };`, acrescentar:

```ts
  const bodyLayers = (kit.layers ?? []).map((layer): KitLayerFill => {
    const layerTemplate = getPatternTemplate(layer.id);
    return { template: layerTemplate, color: color(layer.color), params: resolveParams(layerTemplate, layer.params) };
  });
```

e, no objeto devolvido, `bodyLayers,` logo depois de `body,`.

4. Trocar `fillSvg` por:

```ts
export function fillSvg(fill: KitFill, width: number, height: number, layers: readonly KitLayerFill[] = []): string {
  // O render da camada desenha só os elementos do overlay; sem outro <rect> de base, o padrão principal continua visível embaixo.
  const details = layers.map(({ template, color, params }) => template.render({ width, height, base: color, overlay: color, params })).join("");
  if (fill.kind === "solid") return `<rect width="${width}" height="${height}" fill="${fill.color}"/>${details}`;
  const pattern = fill.template.render({ width, height, base: fill.base, overlay: fill.overlay, params: fill.params });
  return `<rect width="${width}" height="${height}" fill="${fill.base}"/>${pattern}${details}`;
}
```

Em `src/renderers/renderer-2d.ts`, trocar `` `<g clip-path="url(#body)">${fillSvg(design.body, view, view)}</g>`, `` por:

```ts
    `<g clip-path="url(#body)">${fillSvg(design.body, view, view, design.bodyLayers)}</g>`,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderers tests/fm26 tests/cli && npm run typecheck`
Expected: PASS, com `renderKit2dSvg Phase 3b baseline` sem mudar o hash.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/renderers tests/renderers
git commit -m "feat: draw detail layers on the 2D body

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pesos de camada nos perfis

**Files:**
- Modify: `src/styles/profiles.ts`
- Modify: `src/styles/component-weights.ts`
- Modify: `src/styles/pattern-weights.ts`
- Test: `tests/styles/profiles.test.ts`, `tests/styles/component-weights.test.ts`, `tests/styles/pattern-weights.test.ts`

**Interfaces:**
- Consumes: `listLayerTemplates` (Task 1), `MAX_LAYERS` (Task 4), `resolveProfileWeights`.
- Produces: `export const LAYER_COUNTS = ["0", "1", "2"] as const` e `export type LayerCount` em `src/styles/profiles.ts`; `StyleProfile.layerCountWeights: Weights<LayerCount>` e `StyleProfile.layerWeights: Record<string, number>`; `layerCountCandidates(identity: ClubIdentity): [LayerCount, number][]` em `src/styles/component-weights.ts`; `layerCandidates(identity: ClubIdentity, exclude: readonly string[]): [PatternTemplate, number][]` em `src/styles/pattern-weights.ts`.

- [ ] **Step 1: Write the failing tests**

Em `tests/styles/profiles.test.ts`:

1. Trocar os imports por:

```ts
import { describe, expect, it } from "vitest";
import { MAX_LAYERS } from "../../src/core/kit.js";
import { listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";
import { DEFAULT_STYLE_PROFILE, findStyleProfile, getStyleProfile, knownStyleIds, LAYER_COUNTS, STYLE_PROFILES } from "../../src/styles/profiles.js";
```

2. Depois de `const patternIds = …;`, acrescentar `const layerIds = listLayerTemplates().map((template) => template.id);`.
3. Em `gives every profile a positive weight in each component table`, trocar a lista de tabelas por `[profile.collarWeights, profile.sleeveStyleWeights, profile.sleeveCutWeights, profile.layerCountWeights]`.
4. Dentro de `describe("STYLE_PROFILES", …)`, acrescentar:

```ts
  it("references only layer patterns in layerWeights, with positive weights, and reaches every one of them", () => {
    for (const profile of STYLE_PROFILES) {
      for (const [id, weight] of Object.entries(profile.layerWeights)) {
        expect(layerIds).toContain(id);
        expect(weight).toBeGreaterThan(0);
      }
    }
    const reached = new Set(STYLE_PROFILES.flatMap((profile) => Object.keys(profile.layerWeights)));
    expect([...reached].sort()).toEqual([...layerIds].sort());
  });

  // Sem camadas, as seeds de clubes sem estilo geram os mesmos kits (guarda Phase 3b baseline).
  it("keeps classic without layers", () => {
    expect(getStyleProfile("classic").layerCountWeights).toEqual({ 0: 1 });
    expect(getStyleProfile("classic").layerWeights).toEqual({});
  });

  it("gives every other profile a chance of one layer, and never more than MAX_LAYERS", () => {
    expect(LAYER_COUNTS).toHaveLength(MAX_LAYERS + 1);
    for (const profile of STYLE_PROFILES.filter((candidate) => candidate.id !== "classic")) expect(profile.layerCountWeights["1"]).toBeGreaterThan(0);
  });
```

Em `tests/styles/component-weights.test.ts`, trocar o import de `component-weights.js` por `import { collarCandidates, layerCountCandidates, sleeveCutCandidates, sleeveStyleCandidates } from "../../src/styles/component-weights.js";` e acrescentar no fim:

```ts
describe("layerCountCandidates", () => {
  it("never draws a layer when the club has no categories", () => {
    expect(layerCountCandidates(club([]))).toEqual([
      ["0", 1],
      ["1", 0],
      ["2", 0],
    ]);
  });

  it("draws up to two layers in the modern profile", () => {
    const [[, none], [, one], [, two]] = layerCountCandidates(club(["modern"]));
    expect(none).toBeCloseTo(0.3);
    expect(one).toBeCloseTo(0.5);
    expect(two).toBeCloseTo(0.2);
  });

  // A tabela de classic entra na média como as outras; a de layerWeights, vazia, não gera NaN.
  it("mixes classic with another profile", () => {
    const [[, none], [, one], [, two]] = layerCountCandidates(club(["classic", "modern"]));
    expect(none).toBeCloseTo(0.65);
    expect(one).toBeCloseTo(0.25);
    expect(two).toBeCloseTo(0.1);
  });
});
```

Em `tests/styles/pattern-weights.test.ts`, trocar os imports de registry e pattern-weights por `import { listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";` e `import { layerCandidates, patternCandidates, resolvePatternWeights } from "../../src/styles/pattern-weights.js";` e acrescentar no fim:

```ts
describe("layerCandidates", () => {
  const styled = (categories: string[], traditions?: object) =>
    parseClubIdentity({ ...GALATICOS_CLUB, style: { categories }, ...(traditions === undefined ? {} : { traditions }) });
  const positive = (candidates: ReturnType<typeof layerCandidates>) =>
    candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight]);

  it("lists only the layer patterns, in registry order", () => {
    expect(layerCandidates(styled(["modern"]), []).map(([template]) => template.id)).toEqual(listLayerTemplates().map((template) => template.id));
  });

  it("offers no layer when the club has no categories", () => {
    expect(positive(layerCandidates(styled([]), []))).toEqual([]);
  });

  it("uses the normalized layer weights of the profiles", () => {
    expect(positive(layerCandidates(styled(["traditional"]), ["solid"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.3],
      ["shoulder-line", 0.25],
      ["hoop-line", 0.2],
    ]);
  });

  it("averages classic with another profile without NaN", () => {
    const weights = layerCandidates(styled(["classic", "modern"]), []).map(([, weight]) => weight);
    for (const weight of weights) expect(Number.isFinite(weight)).toBe(true);
    expect(positive(layerCandidates(styled(["classic", "modern"]), []))).toContainEqual(["torso-circle", 0.1]);
  });

  it("zeroes forbidden patterns and every layer in a slot that the pattern or a drawn layer takes", () => {
    const club = styled(["retro"], { forbiddenPatterns: ["shoulder-line"] });
    expect(positive(layerCandidates(club, ["solid"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.25],
      ["hoop-line", 0.3],
      ["torso-cross", 0.1],
    ]);
    expect(positive(layerCandidates(club, ["solid", "torso-cross"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.25],
    ]);
    expect(positive(layerCandidates(club, ["side-lines", "hoop-line"]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/styles`
Expected: FAIL (`LAYER_COUNTS`, `layerCountCandidates` e `layerCandidates` não existem; perfis sem tabelas de camada).

- [ ] **Step 3: Write minimal implementation**

Em `src/styles/profiles.ts`:

1. Trocar a interface e o comentário de `DEFAULT_STYLE_PROFILE` por:

```ts
// Quantidade de camadas por kit, de 0 a MAX_LAYERS (core/kit.ts); string porque vira chave de tabela de peso.
export const LAYER_COUNTS = ["0", "1", "2"] as const;
export type LayerCount = (typeof LAYER_COUNTS)[number];

export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
  collarWeights: Weights<CollarStyle>;
  sleeveStyleWeights: Weights<SleeveStyle>;
  sleeveCutWeights: Weights<SleeveCut>;
  layerCountWeights: Weights<LayerCount>;
  // Só padrões com layerSlot; o sorteio zera os da região que o kit já ocupa.
  layerWeights: Record<string, number>;
}

export type Weights<K extends string> = Partial<Record<K, number>>;

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; classic nunca sorteia camada.
export const DEFAULT_STYLE_PROFILE = "classic";
```

2. Em cada perfil, depois de `sleeveCutWeights`, acrescentar:

`classic`:

```ts
    layerCountWeights: { 0: 1 },
    layerWeights: {},
```

`traditional`:

```ts
    layerCountWeights: { 0: 70, 1: 30 },
    layerWeights: { "double-pinline": 30, "side-lines": 25, "shoulder-line": 25, "hoop-line": 20 },
```

`modern`:

```ts
    layerCountWeights: { 0: 30, 1: 50, 2: 20 },
    layerWeights: { "torso-circle": 20, "torso-diamond": 20, "torso-triangle": 20, "torso-cross": 15, "side-lines": 15, "shoulder-line": 10 },
```

`retro`:

```ts
    layerCountWeights: { 0: 40, 1: 45, 2: 15 },
    layerWeights: { "hoop-line": 30, "double-pinline": 25, "side-lines": 25, "shoulder-line": 10, "torso-cross": 10 },
```

Em `src/styles/component-weights.ts`, trocar `import type { Weights } from "./profiles.js";` por `import { LAYER_COUNTS, type LayerCount, type Weights } from "./profiles.js";` e acrescentar no fim:

```ts
export function layerCountCandidates(identity: ClubIdentity): [LayerCount, number][] {
  return candidates(
    LAYER_COUNTS,
    resolveProfileWeights(identity, (profile) => profile.layerCountWeights),
  );
}
```

Em `src/styles/pattern-weights.ts`, trocar `import { listPatternTemplates } from "../patterns/registry.js";` por `import { listLayerTemplates, listPatternTemplates } from "../patterns/registry.js";` e acrescentar no fim:

```ts
// Ordem do registry, como em patternCandidates. exclude traz o padrão principal e as camadas já sorteadas do kit.
export function layerCandidates(identity: ClubIdentity, exclude: readonly string[]): [PatternTemplate, number][] {
  const weights = resolveProfileWeights(identity, (profile) => profile.layerWeights);
  const forbidden = new Set(identity.traditions?.forbiddenPatterns ?? []);
  const templates = listLayerTemplates();
  // Duas camadas na mesma região se sobrepõem (duas formas no tronco, a linha atravessando a forma): uma por região.
  const taken = new Set(templates.filter((template) => exclude.includes(template.id)).map((template) => template.layerSlot));
  return templates.map((template) => [template, forbidden.has(template.id) || taken.has(template.layerSlot) ? 0 : (weights[template.id] ?? 0)]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS na suíte inteira. O generator ainda não lê as tabelas novas, então nenhuma guarda muda.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/styles tests/styles
git commit -m "feat: weigh detail layers in the style profiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sorteio das camadas no generator

**Files:**
- Modify: `src/generator/kit-generator.ts`
- Test: `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `layerCountCandidates`, `layerCandidates` (Task 7); `KitLayer` (Task 4); `randomParams`, `COLOR_ROLES`.
- Produces: kits com `layers` (1 ou 2 camadas) quando o perfil sorteia; sem o campo quando sai 0. Nenhuma função exportada nova.

- [ ] **Step 1: Write the failing tests**

Em `tests/generator/kit-generator.test.ts`:

1. Trocar `import { getPatternTemplate } from "../../src/patterns/registry.js";` por `import { getPatternTemplate, listLayerTemplates } from "../../src/patterns/registry.js";`.
2. No fim do arquivo, acrescentar:

```ts
describe("generateKitSet layers", () => {
  const styled = (categories: string[], extra: object = {}) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories }, ...extra });
  const kitsOf = (club: ClubIdentity, seeds = 100) => Array.from({ length: seeds }, (_, seed) => Object.values(generateKitSet(club, seed))).flat();

  it("never draws layers for a club without categories", () => {
    for (const kit of kitsOf(styled([]))) expect(kit).not.toHaveProperty("layers");
  });

  it("writes layers only when the kit draws one, up to two for a modern club", () => {
    const kits = kitsOf(styled(["modern"]));
    expect(new Set(kits.map((kit) => kit.layers?.length ?? 0))).toEqual(new Set([0, 1, 2]));
    for (const kit of kits) if ("layers" in kit) expect(kit.layers!.length).toBeGreaterThan(0);
  });

  it.each(["traditional", "modern", "retro"])("draws valid %s layers in distinct slots, with params inside the ranges", (category) => {
    for (const kit of kitsOf(styled([category]), 200)) {
      // validateKit cobre cor livre, id repetido, id desconhecido e caixas de logo.
      expect(validateKit(kit)).toEqual([]);
      const layers = kit.layers ?? [];
      const templates = layers.map((layer) => getPatternTemplate(layer.id));
      expect(new Set(templates.map((template) => template.layerSlot)).size).toBe(layers.length);
      for (const [index, layer] of layers.entries()) {
        for (const [key, spec] of Object.entries(templates[index]!.parameters)) {
          expect(layer.params[key]).toBeGreaterThanOrEqual(spec.min);
          expect(layer.params[key]).toBeLessThanOrEqual(spec.max);
        }
      }
    }
  });

  it("never draws a forbidden layer", () => {
    const club = styled(["retro"], { traditions: { forbiddenPatterns: ["hoop-line", "side-lines"] } });
    for (const kit of kitsOf(club)) for (const layer of kit.layers ?? []) expect(["hoop-line", "side-lines"]).not.toContain(layer.id);
  });

  // As camadas são o último sorteio: sem nenhuma permitida, só o campo layers muda.
  it("keeps the rest of the kit when the traditions forbid every layer", () => {
    const forbidAll = styled(["modern"], { traditions: { forbiddenPatterns: listLayerTemplates().map((template) => template.id) } });
    let dropped = 0;
    for (let seed = 0; seed < 100; seed++) {
      const [withLayers, withoutLayers] = [generateKitSet(styled(["modern"]), seed), generateKitSet(forbidAll, seed)];
      for (const kitType of KIT_TYPES) {
        const { layers, ...rest } = withLayers[kitType];
        if (layers) dropped++;
        expect(withoutLayers[kitType]).toEqual(rest);
      }
    }
    expect(dropped).toBeGreaterThan(0);
  });

  it("keeps the layers out of the slot of a layer pattern used as the main pattern", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["modern"], patternWeights: { "side-lines": 1 } } });
    let layered = 0;
    for (const kit of kitsOf(club)) {
      expect(kit.pattern.id).toBe("side-lines");
      expect(validateKit(kit)).toEqual([]);
      for (const layer of kit.layers ?? []) {
        layered++;
        expect(getPatternTemplate(layer.id).layerSlot).not.toBe("sides");
      }
    }
    expect(layered).toBeGreaterThan(0);
  });
});
```

3. Trocar o comentário acima de `describe("generateKitSet Phase 3b baseline", …)` por:

```ts
// Guarda da Fase 3b: o clube sem categories (perfil classic) não pode mudar de kit para a mesma seed.
// O branded (categoria modern) muda de propósito quando os pesos de gola, manga (Fase 4a) ou camada (Fase 4b) dos perfis mudam; atualize o hash só nessas mudanças.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generator`
Expected: FAIL em `generateKitSet layers` (nenhum kit tem camadas). As duas guardas `Phase 3b baseline` passam.

- [ ] **Step 3: Write minimal implementation**

Em `src/generator/kit-generator.ts`:

1. Trocar os imports de `../core/kit.js`, `../styles/component-weights.js` e `../styles/pattern-weights.js` por:

```ts
import {
  BRAND_KINDS,
  BRAND_LISTS,
  COLOR_ROLES,
  visibleRoles,
  type BrandKind,
  type ColorRole,
  type KitDefinition,
  type KitLayer,
  type KitType,
} from "../core/kit.js";
```

```ts
import { collarCandidates, layerCountCandidates, sleeveCutCandidates, sleeveStyleCandidates } from "../styles/component-weights.js";
import { layerCandidates, patternCandidates } from "../styles/pattern-weights.js";
```

(O `npm run format` decide se o import de `../core/kit.js` cabe numa linha.)

2. Em `generateKit`, trocar o trecho do corte até o fim da montagem do kit por:

```ts
  // O corte (Fase 4a) e as camadas (Fase 4b) são os últimos sorteios: entraram depois e não podem deslocar os anteriores.
  const cut = rng.weighted(sleeveCutCandidates(identity));
  const layers = pickLayers(identity, { id: template.id, base, overlay }, rng);
  const kit: KitDefinition = {
    clubId: identity.id,
    kitType,
    generatedWith: { seed },
    colors: { ...palette },
    pattern: { id: template.id, base, overlay, params },
    // layers só aparece quando sai alguma camada: o kit.json de quem não sorteia camadas fica igual ao de antes da 4b.
    ...(layers.length > 0 ? { layers } : {}),
    collar: { style: collarStyle, color: collarColor },
    // cut só aparece na raglan: o kit.json de quem não sorteia raglan fica igual ao de antes da 4a.
    sleeves: { style: sleeveStyle, ...(cut === "raglan" ? { cut } : {}), color: overlay, cuffColor },
    shorts: { color: shortsColor },
    socks: { color: socksColor },
  };
```

3. Depois de `pickPattern`, acrescentar:

```ts
function pickLayers(identity: ClubIdentity, pattern: Pick<KitDefinition["pattern"], "id" | "base" | "overlay">, rng: Rng): KitLayer[] {
  const count = Number(rng.weighted(layerCountCandidates(identity)));
  // O solid não pinta o overlay, então a camada pode usá-lo. Fora dele só sobra um papel, e o pick roda assim mesmo: a ordem do rng não depende do padrão.
  const colors = COLOR_ROLES.filter((role) => role !== pattern.base && (pattern.id === "solid" || role !== pattern.overlay));
  const layers: KitLayer[] = [];
  for (let index = 0; index < count; index++) {
    const candidates = layerCandidates(identity, [pattern.id, ...layers.map((layer) => layer.id)]);
    // Tradições ou regiões ocupadas podem esgotar os candidatos: a camada sai do kit, sem erro.
    if (!candidates.some(([, weight]) => weight > 0)) break;
    const template = rng.weighted(candidates);
    layers.push({ id: template.id, color: rng.pick(colors), params: randomParams(template, rng) });
  }
  return layers;
}
```

- [ ] **Step 4: Update the branded baseline**

Run: `npx vitest run tests/generator -t "Phase 3b baseline"`
Expected: FAIL só em `keeps the sets of a club with pattern weights and brands` (o `branded` é `modern` e agora sorteia camadas); `keeps the sets of a club without categories or pattern weights` passa com `e69b9a92…`. Copie o hash recebido (`Received`) para o `toBe` do teste do `branded`, no lugar de `8da3fe27c60340321d4eddef3086752f5b05ecb9b4564c8a04d1979f58ecec9a`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS na suíte inteira, incluindo `keeps the Phase 2a design for seed 42` (clube sem categorias) e `generates valid %s kits …`, que agora também valida as camadas do `branded`.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/generator tests/generator
git commit -m "feat: draw detail layers in the generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Camadas no contact sheet

**Files:**
- Modify: `src/preview/contact-sheet.ts`
- Test: `tests/preview/contact-sheet.test.ts`

**Interfaces:**
- Consumes: `KitLayer` (Task 4), `getPatternTemplate`, `resolveParams`.
- Produces: `kitDetails(kit)` com uma linha `layer <id> · <papel> · <params>` por camada, entre a linha do padrão e a de gola e manga.

- [ ] **Step 1: Write the failing test**

Em `tests/preview/contact-sheet.test.ts`, dentro de `describe("kitDetails", …)`, acrescentar:

```ts
  it("lists each layer with its color and resolved params, after the pattern", () => {
    const kit = makeKit({
      layers: [
        { id: "side-lines", color: "accent", params: { width: 1 } },
        { id: "torso-circle", color: "secondary", params: {} },
      ],
    });
    expect(kitDetails(kit)).toEqual([
      "solid · classic",
      "layer side-lines · accent · width 0.03",
      "layer torso-circle · secondary · size 0.12, stroke 0.018",
      "collar round · sleeves match-body · set-in",
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/preview`
Expected: FAIL (faltam as linhas `layer …`).

- [ ] **Step 3: Write minimal implementation**

Em `src/preview/contact-sheet.ts`, trocar `kitDetails` por:

```ts
function paramsText(id: string, raw: Record<string, number>): string {
  return Object.entries(resolveParams(getPatternTemplate(id), raw))
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
}

function joinParts(parts: string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

export function kitDetails(kit: KitDefinition): string[] {
  const template = getPatternTemplate(kit.pattern.id);
  const lines = [
    joinParts([template.id, template.category, paramsText(template.id, kit.pattern.params)]),
    ...(kit.layers ?? []).map((layer) => joinParts([`layer ${layer.id}`, layer.color, paramsText(layer.id, layer.params)])),
    `collar ${kit.collar.style} · sleeves ${kit.sleeves.style} · ${sleeveCut(kit)}`,
  ];
  if (kit.generatedWith) lines.push(`seed ${kit.generatedWith.seed}`);
  if (kit.sponsor) lines.push(`sponsor ${kit.sponsor.id}`);
  if (kit.manufacturer) lines.push(`manufacturer ${kit.manufacturer.id}`);
  return lines;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/preview tests/cli`
Expected: PASS; os testes antigos de `kitDetails` (kits sem camadas) não mudam.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/preview tests/preview
git commit -m "feat: show layers in the contact sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Inspeção visual, documentação e gates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`
- Create (ignorados pelo git, em `output/`): `output/fase-4b/clubs/modern-fc/club.json`, `output/fase-4b/clubs/retro-fc/club.json`, `output/fase-4b/clubs/traditional-fc/club.json`

**Interfaces:**
- Consumes: tudo das Tasks 1–9.
- Produces: documentação; nenhum código.

- [ ] **Step 1: Generate sample kits for inspection**

Criar com a ferramenta Write:

`output/fase-4b/clubs/modern-fc/club.json`:

```json
{ "id": "modern-fc", "name": "Modern FC", "palette": { "primary": "#0b3d91", "secondary": "#f2c14e" }, "style": { "categories": ["modern"] } }
```

`output/fase-4b/clubs/retro-fc/club.json`:

```json
{ "id": "retro-fc", "name": "Retro FC", "palette": { "primary": "#c8102e", "secondary": "#ffffff" }, "style": { "categories": ["retro"] } }
```

`output/fase-4b/clubs/traditional-fc/club.json`:

```json
{ "id": "traditional-fc", "name": "Traditional FC", "palette": { "primary": "#1b5e20", "secondary": "#ffffff" }, "style": { "categories": ["traditional"] } }
```

Run (cada `generate` sobrescreve o `kit.json` do clube, então o resumo sai logo depois de cada seed):

```bash
for club in modern-fc retro-fc traditional-fc; do
  for seed in 1 2 3 4 5 6; do
    npm run --silent kit-generator -- generate --club $club --seed $seed --clubs output/fase-4b/clubs --out output/fase-4b/png-$seed
    for type in home away third; do
      node -e 'const k = require(process.argv[1]); console.log(process.argv[2], k.pattern.id, (k.layers ?? []).map((l) => `${l.id}:${l.color}`).join(" "))' "$PWD/output/fase-4b/clubs/$club/kits/$type/kit.json" "$club $seed $type"
    done
  done
done
for club in modern-fc retro-fc traditional-fc; do
  npm run --silent kit-generator -- preview --club $club --samples 24 --clubs output/fase-4b/clubs --out output/fase-4b/$club.html
done
```

Expected: exit 0 em todos; PNGs em `output/fase-4b/png-<seed>/<clube>/2d/<slug>_<tipo>_2d.png`; o resumo mostra kits com 1 e 2 camadas, formas `torso-*`, linhas e algum `gradient-diagonal` ou `gradient-radial`. Se nenhum degradê aparecer nas 6 seeds, rode mais seeds só do `modern-fc` até aparecer.

- [ ] **Step 2: Inspect the PNGs**

Pelo resumo do Step 1, escolha PNGs com cada padrão de camada, um kit com 2 camadas, um `gradient-diagonal` e um `gradient-radial`, e abra cada um com a ferramenta Read.

Conferir: camadas na cor que o padrão não usa; nenhuma camada sob escudo, fabricante ou patrocinador; formas abaixo do patrocinador; `shoulder-line` abaixo da gola e acima dos logos; mangas `match-body` sem camada; degradês suaves, sem faixas visíveis, com a base pura atrás dos logos; nenhuma camada na mesma região de outra. Se algo falhar, corrija o padrão em `src/patterns/`, rode `npx vitest run tests/patterns tests/renderers` e repita. Avise o usuário para abrir `output/fase-4b/modern-fc.html`, `output/fase-4b/retro-fc.html` e `output/fase-4b/traditional-fc.html`.

- [ ] **Step 3: Update the roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. No fim da linha 5 (lista de planos detalhados), trocar `e Fase 4a (spec \`docs/superpowers/specs/2026-10-05-fase-4a-golas-mangas-design.md\`, plano \`docs/superpowers/plans/2026-10-05-fase-4a-golas-mangas.md\`).` por `, Fase 4a (spec \`docs/superpowers/specs/2026-10-05-fase-4a-golas-mangas-design.md\`, plano \`docs/superpowers/plans/2026-10-05-fase-4a-golas-mangas.md\`) e Fase 4b (spec \`docs/superpowers/specs/2026-10-06-fase-4b-camadas-padroes-design.md\`, plano \`docs/superpowers/plans/2026-10-06-fase-4b-camadas-padroes.md\`).`
2. Na tabela de status, depois da linha da 4a, acrescentar a linha abaixo. Antes de editar, rode `git rev-parse --short HEAD` (o HEAD ainda é o commit da Task 9, o último de código) e `npm test` (total na linha `Tests`), e troque `<commit>` e `<N>` por esses valores:

```markdown
| 4b — Camadas de detalhe e 10 padrões novos (2D) | **Concluída** (2026-10-06, `dev` @ `<commit>`, <N> testes). Não dependeu do teste no jogo |
```

3. No item 3 da Fase 4 (padrões por máscara FM26), acrescentar no fim: ` **Parcial (4b):** o \`accent\` entra no tronco pelas camadas de detalhe (\`layers\`), e há degradês diagonal e radial; os padrões por máscara continuam pendentes e dependem da 3c.`

- [ ] **Step 4: Update CLAUDE.md**

Em `CLAUDE.md`:

1. Na "Visão geral", trocar `Estado atual: Fase 4a concluída (golas \`polo\`/\`polo-v\`, manga raglan e pesos de gola e manga por perfil, só 2D), sobre a 3b (12 padrões, perfis de estilo, tradições do clube, contact sheet \`preview\`, camada de desenho compartilhada e layout UV como dado); a próxima é a 3c` por `Estado atual: Fase 4b concluída (camadas de detalhe \`layers\`, até 2 padrões finos na cor que o padrão principal não usa, e 10 padrões novos, 22 no total, só 2D), sobre a 4a (golas \`polo\`/\`polo-v\`, manga raglan e pesos de gola e manga por perfil) e a 3b (perfis de estilo, tradições do clube, contact sheet \`preview\`, camada de desenho compartilhada e layout UV como dado); a próxima é a 3c`.
2. No bullet de `src/core`, trocar `` `resolveLogoColor` e `sleeveCut` (`sleeves.cut` ausente = `set-in`) moram em `core/kit.ts`. `` por `` `resolveLogoColor`, `sleeveCut` (`sleeves.cut` ausente = `set-in`) e `MAX_LAYERS`/`KitLayer` (`layers` ausente = sem camadas) moram em `core/kit.ts`. ``
3. No bullet de `src/core/validation.ts`, trocar `` `validateKit` (inclui `logo-contrast`), `validateKitTraditions` (`forbidden-pattern`, `tradition-pattern`, `required-color`) `` por `` `validateKit` (inclui `logo-contrast` e as regras de camada `unknown-layer`, `layer-duplicate`, `layer-color` e `layer-logo-overlap`), `validateKitTraditions` (`forbidden-pattern`, que vale também para camadas, `tradition-pattern`, só do padrão principal, e `required-color`, que conta as cores das camadas) ``.
4. No bullet de `src/core/logo-colors.ts`, trocar `` `backgroundRoles(kit, slot)` amostra uma grade 24×24 da caixa do logo com `colorAt` e devolve `` por `` `overlayShare(template, params, slot)` amostra uma grade 24×24 da caixa do logo com `colorAt`; `backgroundRoles(kit, slot)` usa ela no padrão principal (as camadas nunca entram nas caixas) e devolve ``.
5. No bullet de `src/generator/kit-generator.ts`, trocar `` e o corte (`sleeveCutCandidates`) é o último sorteio, gravado em `sleeves.cut` só quando sai `raglan` e, depois de todos os sorteios, a gola recebe `` por `` o corte (`sleeveCutCandidates`) vem depois, gravado em `sleeves.cut` só quando sai `raglan`, e as camadas são o último sorteio (quantidade por `layerCountCandidates`; para cada camada, id por `layerCandidates`, cor por `rng.pick` entre os papéis que o padrão não pinta e params), gravadas em `layers` só quando sai alguma. Depois de todos os sorteios, a gola recebe ``.
6. No bullet de `src/patterns`, trocar `` cada padrão (12: `solid`, `stripes`, `sash`, `pinstripes`, `hoops`, `diagonal`, `chevron`, `chest-band`, `center-band`, `checkers`, `halves`, `gradient`) `` por `` cada padrão (22: `solid`, `stripes`, `sash`, `pinstripes`, `hoops`, `diagonal`, `chevron`, `chest-band`, `center-band`, `checkers`, `halves`, `gradient`, os 8 de camada `side-lines`, `double-pinline`, `shoulder-line`, `hoop-line`, `torso-circle`, `torso-diamond`, `torso-triangle`, `torso-cross`, e `gradient-diagonal`, `gradient-radial`) `` e acrescentar no fim do bullet: `` Padrão com `layerSlot` (`sides`, `shoulders`, `lower`) pode ser camada de detalhe (`listLayerTemplates()`): o `render()` dele desenha só o overlay, nos ranges nada pinta `LOGO_BOXES` e ele cobre menos de 15% do tronco (teste de pixel por camada, com os extremos combinados); perfil põe padrão de camada só em `layerWeights`. Os três degradês dividem as faixas em `fade.ts`; borda de faixa inclinada ou curva precisa de `shape-rendering="crispEdges"`, porque o antialias soma duas faixas vizinhas no mesmo pixel e o `colorAt` deixa de espelhar o `render()`. ``
7. No bullet de `src/styles`, trocar `` com `patternWeights`, `collarWeights`, `sleeveStyleWeights` e `sleeveCutWeights`) `` por `` com `patternWeights`, `collarWeights`, `sleeveStyleWeights`, `sleeveCutWeights`, `layerCountWeights` (chaves de `LAYER_COUNTS`, `0` a `2`) e `layerWeights`) ``; trocar `` `patternCandidates(identity, kitType)` aplica `forbiddenPatterns` e a lista por tipo, na ordem do registry) `` por `` `patternCandidates(identity, kitType)` aplica `forbiddenPatterns` e a lista por tipo, na ordem do registry; `layerCandidates(identity, exclude)` lista os padrões de camada na ordem do registry e zera os proibidos e os da região que um id de `exclude` já ocupa) ``; e trocar `` `component-weights.ts` (candidatos de gola, estilo e corte de manga na ordem dos enums de `core/kit.ts`; `` por `` `component-weights.ts` (candidatos de gola, estilo e corte de manga na ordem dos enums de `core/kit.ts` e `layerCountCandidates` na ordem de `LAYER_COUNTS`; ``.
8. No bullet de `src/renderers/kit-design.ts`, trocar `` de corpo e mangas e as cores de gola, punho, calção e meias; `fillSvg` desenha um fill num retângulo. `` por `` de corpo e mangas, as camadas do corpo (`bodyLayers`, separadas de `body` para a manga `match-body` não recebê-las) e as cores de gola, punho, calção e meias; `fillSvg(fill, width, height, layers = [])` desenha um fill num retângulo e as camadas por cima. ``
9. No primeiro bullet de "Convenções e armadilhas": trocar `` e só `set-in`, o que reproduz o `rng.pick` antigo. `` por `` e só `set-in`, o que reproduz o `rng.pick` antigo; em camadas, `layerCountWeights` `{ 0: 1 }`: a quantidade é sorteada, mas é o último sorteio e não desloca nada. ``; trocar `quando os pesos de gola ou manga dos perfis mudam` por `quando os pesos de gola, manga ou camada dos perfis mudam`; e trocar `depois da 4a;` por `depois da 4a e de novo depois da 4b;`.

- [ ] **Step 5: Run every gate**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde, com o mesmo total de testes registrado no roadmap.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document phase 4b

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
