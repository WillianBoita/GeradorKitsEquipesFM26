# Fase 4a — Golas, corte de manga e frequência de manga lisa (2D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Golas `polo` e `polo-v`, manga raglan e manga lisa menos frequente no PNG 2D, sorteadas pelos perfis de estilo, sem mudar os kits que clubes sem `categories` geram para a mesma seed.

**Architecture:** Os perfis de `src/styles/profiles.ts` ganham tabelas de peso de gola, estilo de manga e corte de manga, resolvidas por um resolvedor genérico (`src/styles/profile-weights.ts`) que também passa a servir os padrões. `src/styles/component-weights.ts` monta os candidatos na ordem dos enums de `core/kit.ts`, e o generator troca os dois `rng.pick` por `rng.weighted` na mesma posição e sorteia o corte por último. O desenho fica em `src/renderers/shirt-2d-shape.ts` (decote + `trim` opcional por gola, corpo e mangas por corte, costura raglan) e `src/renderers/renderer-2d.ts` só emite os elementos novos quando eles existem.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Zod 4, Sharp, Vitest, `fast-xml-parser` (só nos testes), Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-05-fase-4a-golas-mangas-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova.
- `COLLAR_STYLES = ["round", "v-neck", "polo", "polo-v"]` e `SLEEVE_CUTS = ["set-in", "raglan"]`, nesta ordem: a ordem dos candidatos participa do sorteio.
- `classic`: `collarWeights` `{ round: 1, "v-neck": 1 }`, `sleeveStyleWeights` `{ "match-body": 1, solid: 1 }`, `sleeveCutWeights` `{ "set-in": 1 }`. Esses números não mudam.
- Ordem do `rng` em `generateKit`: padrão, params, gola (`weighted`), cor da gola, estilo de manga (`weighted`), cor do punho, calção, meias, corte (`weighted`, último). Nenhum rótulo novo de `deriveSeed`.
- A guarda `Phase 3b baseline` do clube sem categorias (`e69b9a92…`) e a guarda de SVG `renderKit2dSvg Phase 3b baseline` (`acdafaa8…`) ficam verdes do começo ao fim do plano, sem mudar o hash. Só a guarda do clube `branded` (`modern`) muda, e só nas Tasks 2, 3 e 4.
- `sleeves.cut` ausente significa `set-in`; o generator só grava `cut` quando sai `raglan`. O default mora só em `sleeveCut(kit)` (`core/kit.ts`).
- `LOGO_BOXES` não muda. Fora da carcela da `polo` (x 200–214), nenhuma peça de gola passa de y = 101.
- Cor da manga lisa continua o overlay (`sleeves.color = overlay`).
- `docs/fm_templates/` não é movido; o runtime nunca o lê.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e de log em inglês, como no resto da CLI.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.

## Review Focus

- `kit.json` escrito à mão com `"cut": "set-in"` explícito: o usuário espera o mesmo PNG de um kit sem `cut`. Teste na Task 4.
- Valor desconhecido de gola ou corte (`"polo-x"`, `"puffed"`) num `kit.json`: espera erro de schema com o caminho (`collar.style`, `sleeves.cut`), não um PNG estranho. Testes nas Tasks 3 e 4.
- Gola `polo`/`polo-v` com manga raglan lisa: espera as caixas de escudo, fabricante e patrocinador livres (abas, carcela e costura fora delas). Teste na Task 4 (4 golas × 2 cortes, manga lisa).
- Clube com `patternWeights` e sem `categories` (o caso dos testes antigos): espera os mesmos kits de antes, porque gola e manga caem em `classic`. Teste na Task 2 (guarda de seed 42 com esse clube).
- `kit.json` salvo antes da 4a (sem `cut`, golas antigas) aberto no `preview`: espera a linha `collar … · sleeves … · set-in`, sem erro. Teste na Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/styles/profiles.ts` | Modificar: tipo `Weights<K>`; `collarWeights`, `sleeveStyleWeights`, `sleeveCutWeights` em cada perfil |
| `src/styles/profile-weights.ts` | Criar: `resolveProfileWeights` (média normalizada genérica, `classic` sem normalizar) |
| `src/styles/pattern-weights.ts` | Modificar: `resolvePatternWeights` usa `resolveProfileWeights` |
| `src/styles/component-weights.ts` | Criar: `collarCandidates`, `sleeveStyleCandidates`, `sleeveCutCandidates` |
| `src/core/kit.ts` | Modificar: `COLLAR_STYLES` com `polo`/`polo-v`, `SLEEVE_CUTS`, `sleeves.cut`, tipos `SleeveStyle`/`SleeveCut`, `sleeveCut` |
| `src/generator/kit-generator.ts` | Modificar: `rng.weighted` para gola, estilo e corte de manga |
| `src/renderers/shirt-2d-shape.ts` | Modificar: `COLLARS` (decote + `trim`), `collarTrimPath`, corpo e mangas por corte, `sleevesPath`, `RAGLAN_SEAMS_PATH` |
| `src/renderers/renderer-2d.ts` | Modificar: `trim` da gola, corte de manga, costura raglan, `OUTLINE_STROKE` |
| `src/preview/contact-sheet.ts` | Modificar: linha de gola e manga em `kitDetails` |
| `tests/styles/profile-weights.test.ts`, `tests/styles/component-weights.test.ts` | Criar |
| `tests/styles/profiles.test.ts`, `tests/core/kit.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/renderers/renderer-2d.test.ts`, `tests/preview/contact-sheet.test.ts` | Modificar |
| `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar: documentação da fase |

---

### Task 1: Resolvedor genérico de pesos por perfil

Refatoração sem mudança de comportamento: a regra "média normalizada dos perfis de `categories`, senão `classic` sem normalizar" sai de `resolvePatternWeights` para uma função genérica que as tabelas de gola e manga vão usar.

**Files:**
- Modify: `src/styles/profiles.ts`
- Create: `src/styles/profile-weights.ts`
- Modify: `src/styles/pattern-weights.ts`
- Test: `tests/styles/profile-weights.test.ts`

**Interfaces:**
- Consumes: `ClubIdentity` (`src/core/club.ts`), `DEFAULT_STYLE_PROFILE`, `getStyleProfile`, `StyleProfile` (`src/styles/profiles.ts`).
- Produces: `export type Weights<K extends string> = Partial<Record<K, number>>` em `src/styles/profiles.ts`; `resolveProfileWeights<K extends string>(identity: ClubIdentity, select: (profile: StyleProfile) => Weights<K>): Weights<K>` em `src/styles/profile-weights.ts`; `resolvePatternWeights(identity: ClubIdentity): Weights<string>`.

- [ ] **Step 1: Write the failing test**

Criar `tests/styles/profile-weights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { resolveProfileWeights } from "../../src/styles/profile-weights.js";
import type { StyleProfile } from "../../src/styles/profiles.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (categories: string[]) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });

// Tabela sintética: isola a regra da média dos números reais dos perfis.
const byId = (profile: StyleProfile) => ({ [profile.id]: 2, shared: 2 });

describe("resolveProfileWeights", () => {
  it("returns the raw classic table when the club has no categories", () => {
    expect(resolveProfileWeights(club([]), byId)).toEqual({ classic: 2, shared: 2 });
  });

  it("averages the normalized tables of the listed profiles", () => {
    expect(resolveProfileWeights(club(["modern", "retro"]), byId)).toEqual({ modern: 0.25, shared: 0.5, retro: 0.25 });
  });

  it("treats a repeated category as one", () => {
    expect(resolveProfileWeights(club(["retro", "retro"]), byId)).toEqual({ retro: 0.5, shared: 0.5 });
  });

  it("ignores the club pattern weights", () => {
    const withPatternWeights = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: { solid: 1 } } });
    expect(resolveProfileWeights(withPatternWeights, byId)).toEqual({ classic: 2, shared: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/styles/profile-weights.test.ts`
Expected: FAIL com `Failed to resolve import "../../src/styles/profile-weights.js"`.

- [ ] **Step 3: Write minimal implementation**

Em `src/styles/profiles.ts`, logo depois de `export interface StyleProfile { … }`, acrescentar:

```ts
export type Weights<K extends string> = Partial<Record<K, number>>;
```

Criar `src/styles/profile-weights.ts`:

```ts
import type { ClubIdentity } from "../core/club.js";
import { DEFAULT_STYLE_PROFILE, getStyleProfile, type StyleProfile, type Weights } from "./profiles.js";

// Uma regra para todas as tabelas dos perfis (padrão, gola, manga): mudar a média aqui muda todas juntas.
export function resolveProfileWeights<K extends string>(identity: ClubIdentity, select: (profile: StyleProfile) => Weights<K>): Weights<K> {
  // Set: categoria repetida conta uma vez, sem depender de a soma de frações coincidir bit a bit.
  const ids = [...new Set(identity.style.categories)];
  // Sem normalizar: os números de classic são os de antes dos perfis, e o sorteio fica idêntico ao das seeds antigas.
  if (ids.length === 0) return select(getStyleProfile(DEFAULT_STYLE_PROFILE));
  const weights: Weights<K> = {};
  for (const id of ids) {
    const table = Object.entries(select(getStyleProfile(id))) as [K, number][];
    const total = table.reduce((sum, [, weight]) => sum + weight, 0);
    // Normalizar antes da média impede que um perfil com números maiores domine a combinação.
    for (const [key, weight] of table) weights[key] = (weights[key] ?? 0) + weight / total / ids.length;
  }
  return weights;
}
```

Em `src/styles/pattern-weights.ts`, trocar o import de `./profiles.js` e a função `resolvePatternWeights` inteira por:

```ts
import { resolveProfileWeights } from "./profile-weights.js";
import type { Weights } from "./profiles.js";
```

```ts
export function resolvePatternWeights(identity: ClubIdentity): Weights<string> {
  return identity.style.patternWeights ?? resolveProfileWeights(identity, (profile) => profile.patternWeights);
}
```

`patternCandidates` não muda (já usa `weights[template.id] ?? 0`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/styles tests/generator`
Expected: PASS, incluindo `tests/styles/pattern-weights.test.ts` e as duas guardas `Phase 3b baseline` sem mudança.

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/styles tests/styles/profile-weights.test.ts
git commit -m "refactor: share the profile weight resolution

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Gola e estilo de manga sorteados pelos perfis

Item 3 da spec: manga lisa menos frequente fora de `classic`. A gola passa pelo mesmo caminho, ainda só com `round` e `v-neck`.

**Files:**
- Modify: `src/core/kit.ts`
- Modify: `src/styles/profiles.ts`
- Create: `src/styles/component-weights.ts`
- Modify: `src/generator/kit-generator.ts`
- Test: `tests/styles/profiles.test.ts`, `tests/styles/component-weights.test.ts`, `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `resolveProfileWeights`, `Weights` (Task 1); `COLLAR_STYLES`, `SLEEVE_STYLES`, `CollarStyle` (`src/core/kit.ts`).
- Produces: `export type SleeveStyle = (typeof SLEEVE_STYLES)[number]` em `src/core/kit.ts`; `StyleProfile.collarWeights: Weights<CollarStyle>` e `StyleProfile.sleeveStyleWeights: Weights<SleeveStyle>`; `collarCandidates(identity: ClubIdentity): [CollarStyle, number][]` e `sleeveStyleCandidates(identity: ClubIdentity): [SleeveStyle, number][]` em `src/styles/component-weights.ts`.

- [ ] **Step 1: Pin the old seed-42 design on a club without categories**

O clube `identity` dos testes do generator tem `categories: ["modern"]`, que vai mudar de manga nesta task. A guarda "keeps the Phase 2a design for seed 42" passa a usar o mesmo clube sem `categories`: os pesos de padrão do clube continuam valendo, e gola e manga caem em `classic`, que reproduz o sorteio antigo.

Em `tests/generator/kit-generator.test.ts`, depois de `const branded: ClubIdentity = …`, acrescentar:

```ts
// Sem categories, gola e manga seguem classic, que reproduz o rng.pick de antes dos perfis; os pesos de padrão do clube continuam valendo.
const classicStyled: ClubIdentity = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: GALATICOS_CLUB.style.patternWeights } });
```

E no teste `"keeps the Phase 2a design for seed 42"`, trocar `generateKitSet(identity, 42)` por `generateKitSet(classicStyled, 42)`.

Run: `npx vitest run tests/generator/kit-generator.test.ts -t "seed 42"`
Expected: PASS (antes de qualquer mudança em `src/`: prova que o clube sem categorias gera o mesmo design).

- [ ] **Step 2: Write the failing tests**

Em `tests/styles/profiles.test.ts`, dentro de `describe("STYLE_PROFILES", …)`, acrescentar:

```ts
  // Pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis.
  it("keeps classic collars and sleeve styles even", () => {
    expect(getStyleProfile("classic").collarWeights).toEqual({ round: 1, "v-neck": 1 });
    expect(getStyleProfile("classic").sleeveStyleWeights).toEqual({ "match-body": 1, solid: 1 });
  });

  it("gives every profile a positive weight in each component table", () => {
    for (const profile of STYLE_PROFILES) {
      for (const table of [profile.collarWeights, profile.sleeveStyleWeights]) {
        const weights = Object.values(table);
        expect(weights.length).toBeGreaterThan(0);
        for (const weight of weights) expect(weight).toBeGreaterThan(0);
      }
    }
  });
```

Criar `tests/styles/component-weights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { COLLAR_STYLES } from "../../src/core/kit.js";
import { collarCandidates, sleeveStyleCandidates } from "../../src/styles/component-weights.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (categories: string[]) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });
const positive = <K>(candidates: [K, number][]) => candidates.filter(([, weight]) => weight > 0);

describe("collarCandidates", () => {
  it("draws the classic collars evenly when the club has no categories", () => {
    expect(positive(collarCandidates(club([])))).toEqual([
      ["round", 1],
      ["v-neck", 1],
    ]);
  });

  it("lists every collar in enum order", () => {
    expect(collarCandidates(club(["modern"])).map(([style]) => style)).toEqual([...COLLAR_STYLES]);
  });
});

describe("sleeveStyleCandidates", () => {
  it("draws the classic sleeve styles evenly when the club has no categories", () => {
    expect(sleeveStyleCandidates(club([]))).toEqual([
      ["match-body", 1],
      ["solid", 1],
    ]);
  });

  it("makes plain sleeves rarer in the modern profile", () => {
    const [[, matchBody], [, solid]] = sleeveStyleCandidates(club(["modern"]));
    expect(matchBody).toBeCloseTo(0.8);
    expect(solid).toBeCloseTo(0.2);
  });
});
```

Em `tests/generator/kit-generator.test.ts`, dentro de `describe("generateKitSet", …)`, depois de `"draws from the profiles listed in categories"`, acrescentar:

```ts
  it("draws plain sleeves less often for a modern club than for a classic one", () => {
    const solidShare = (categories: string[]) => {
      const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });
      const kits = Array.from({ length: 100 }, (_, seed) => Object.values(generateKitSet(club, seed))).flat();
      return kits.filter((kit) => kit.sleeves.style === "solid").length / kits.length;
    };
    expect(solidShare(["modern"])).toBeLessThan(0.3);
    expect(solidShare([])).toBeGreaterThan(0.4);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/styles tests/generator/kit-generator.test.ts`
Expected: FAIL. `component-weights.test.ts` com `Failed to resolve import "../../src/styles/component-weights.js"`; `profiles.test.ts` com `collarWeights` `undefined`; o teste de manga lisa com share de `modern` perto de 0.5.

- [ ] **Step 4: Write minimal implementation**

Em `src/core/kit.ts`, depois de `export type CollarStyle = (typeof COLLAR_STYLES)[number];`:

```ts
export type SleeveStyle = (typeof SLEEVE_STYLES)[number];
```

Em `src/styles/profiles.ts`, acrescentar o import no topo e trocar tudo de `export interface StyleProfile` até o fim do array `STYLE_PROFILES` (interface, o tipo `Weights` da Task 1, o comentário e as duas constantes) por:

```ts
import type { CollarStyle, SleeveStyle } from "../core/kit.js";

export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
  collarWeights: Weights<CollarStyle>;
  sleeveStyleWeights: Weights<SleeveStyle>;
}

export type Weights<K extends string> = Partial<Record<K, number>>;

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis.
export const DEFAULT_STYLE_PROFILE = "classic";

export const STYLE_PROFILES: readonly StyleProfile[] = [
  {
    id: "classic",
    name: "Classic",
    patternWeights: { solid: 40, stripes: 35, sash: 25 },
    collarWeights: { round: 1, "v-neck": 1 },
    sleeveStyleWeights: { "match-body": 1, solid: 1 },
  },
  {
    id: "traditional",
    name: "Traditional",
    patternWeights: { solid: 30, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5 },
    collarWeights: { round: 35, "v-neck": 25 },
    sleeveStyleWeights: { "match-body": 75, solid: 25 },
  },
  {
    id: "modern",
    name: "Modern",
    patternWeights: { solid: 10, diagonal: 20, gradient: 20, checkers: 15, halves: 15, chevron: 10, sash: 10 },
    collarWeights: { round: 40, "v-neck": 40 },
    sleeveStyleWeights: { "match-body": 80, solid: 20 },
  },
  {
    id: "retro",
    name: "Retro",
    patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 10 },
    collarWeights: { round: 15, "v-neck": 15 },
    sleeveStyleWeights: { "match-body": 70, solid: 30 },
  },
];
```

(O comentário antigo de `DEFAULT_STYLE_PROFILE` é substituído pelas duas linhas acima.)

Criar `src/styles/component-weights.ts`:

```ts
import type { ClubIdentity } from "../core/club.js";
import { COLLAR_STYLES, SLEEVE_STYLES, type CollarStyle, type SleeveStyle } from "../core/kit.js";
import { resolveProfileWeights } from "./profile-weights.js";
import type { Weights } from "./profiles.js";

// Ordem do enum, não das chaves do perfil: rng.weighted percorre os candidatos nesta ordem, e reordenar uma tabela não pode mudar os kits de uma seed.
function candidates<K extends string>(values: readonly K[], weights: Weights<K>): [K, number][] {
  return values.map((value) => [value, weights[value] ?? 0]);
}

export function collarCandidates(identity: ClubIdentity): [CollarStyle, number][] {
  return candidates(COLLAR_STYLES, resolveProfileWeights(identity, (profile) => profile.collarWeights));
}

export function sleeveStyleCandidates(identity: ClubIdentity): [SleeveStyle, number][] {
  return candidates(SLEEVE_STYLES, resolveProfileWeights(identity, (profile) => profile.sleeveStyleWeights));
}
```

Em `src/generator/kit-generator.ts`:
- tirar `COLLAR_STYLES` e `SLEEVE_STYLES` do import de `../core/kit.js`;
- acrescentar `import { collarCandidates, sleeveStyleCandidates } from "../styles/component-weights.js";`;
- trocar as duas linhas de sorteio:

```ts
  const collarStyle = rng.weighted(collarCandidates(identity));
  const collarColor = rng.pick(trimRoles);
  const sleeveStyle = rng.weighted(sleeveStyleCandidates(identity));
```

- [ ] **Step 5: Run tests and update the branded guard**

Run: `npx vitest run tests/styles tests/generator/kit-generator.test.ts`
Expected: tudo PASS, exceto `generateKitSet Phase 3b baseline > keeps the sets of a club with pattern weights and brands`, que falha com outro hash (o clube `branded` é `modern` e mudou de manga). `keeps the sets of a club without categories or pattern weights` tem de PASSAR; se falhar, a ordem do `rng` ou os pesos de `classic` estão errados: corrija antes de seguir.

Copie o hash recebido (`Received`) para o `toBe` do teste do `branded` e troque o comentário da guarda por:

```ts
// Guarda da Fase 3b: o clube sem categories (perfil classic) não pode mudar de kit para a mesma seed.
// O branded (categoria modern) muda de propósito quando a Fase 4a muda os pesos de gola e manga dos perfis; atualize o hash só nessas mudanças.
```

Run: `npm test && npm run typecheck`
Expected: PASS e sem erros.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/core/kit.ts src/styles src/generator tests/styles tests/generator
git commit -m "feat: draw collars and sleeve styles from the style profiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Golas `polo` e `polo-v`

**Files:**
- Modify: `src/core/kit.ts`
- Modify: `src/renderers/shirt-2d-shape.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Modify: `src/styles/profiles.ts`
- Test: `tests/core/kit.test.ts`, `tests/renderers/renderer-2d.test.ts`, `tests/styles/component-weights.test.ts`, `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `collarCandidates` (Task 2).
- Produces: `COLLAR_STYLES = ["round", "v-neck", "polo", "polo-v"]`; `collarTrimPath(style: CollarStyle): string | undefined` em `src/renderers/shirt-2d-shape.ts`; `OUTLINE_STROKE` (constante interna de `renderer-2d.ts`, usada também na Task 4).

- [ ] **Step 1: Write the failing tests**

Em `tests/core/kit.test.ts`, acrescentar `COLLAR_STYLES` ao import de `../../src/core/kit.js` e, dentro de `describe("parseKitDefinition", …)`:

```ts
  it.each(COLLAR_STYLES)("accepts the %s collar", (style) => {
    expect(parseKitDefinition(makeKit({ collar: { style, color: "accent" } })).collar.style).toBe(style);
  });

  it("rejects unknown collars and names the path", () => {
    expect(() => parseKitDefinition({ ...makeKit(), collar: { style: "polo-x", color: "accent" } })).toThrow(/collar\.style/);
  });
```

Em `tests/renderers/renderer-2d.test.ts`:
- acrescentar `import { COLLAR_STYLES } from "../../src/core/kit.js";`;
- trocar `it.each(["round", "v-neck"] as const)("renders the %s collar", …)` por `it.each(COLLAR_STYLES)("renders the %s collar", …)` (corpo igual);
- trocar `it.each(["round", "v-neck"] as const)("keeps every logo box on the plain body with the %s collar", …)` por `it.each(COLLAR_STYLES)(…)` (corpo igual);
- **não** mexer em `renderKit2dSvg Phase 3b baseline`, que continua com `["round", "v-neck"]`;
- dentro de `describe("renderKit2dPng", …)`, depois de `"cuts the v-neck deeper than the round collar"`:

```ts
  it("paints the polo placket with the collar color", async () => {
    expect(await pixelAt(await renderKit2dPng(makeKit({ collar: { style: "polo", color: "accent" } })), 207, 115)).toEqual(ACCENT);
  });

  // (185, 80) fica na aba esquerda, longe dos contornos dela e do traço do V.
  it("cuts the polo-v as deep as the v-neck and covers its flaps with the collar color", async () => {
    const png = await renderKit2dPng(makeKit({ collar: { style: "polo-v", color: "accent" } }));
    expect((await pixelAt(png, 207, 88))[3]).toBe(0);
    expect(await pixelAt(png, 185, 80)).toEqual(ACCENT);
  });
```

Em `tests/styles/component-weights.test.ts`, dentro de `describe("collarCandidates", …)`:

```ts
  it("offers the polo collars through the retro profile", () => {
    const candidates = collarCandidates(club(["retro"]));
    expect(candidates.map(([style]) => style)).toEqual(["round", "v-neck", "polo", "polo-v"]);
    expect(candidates.map(([, weight]) => weight)).toEqual([0.15, 0.15, 0.35, 0.35]);
  });
```

Em `tests/generator/kit-generator.test.ts`, acrescentar `COLLAR_STYLES` ao import de `../../src/core/kit.js` e, dentro de `describe("generateKitSet", …)`:

```ts
  it("draws every collar for a retro club", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["retro"] } });
    const styles = new Set(Array.from({ length: 50 }, (_, seed) => Object.values(generateKitSet(club, seed)).map((kit) => kit.collar.style)).flat());
    expect(styles).toEqual(new Set(COLLAR_STYLES));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/kit.test.ts tests/renderers/renderer-2d.test.ts tests/styles tests/generator/kit-generator.test.ts`
Expected: FAIL. `polo`/`polo-v` rejeitados pelo schema, o placket sai `PRIMARY`, a lista de golas do `retro` só tem `round` e `v-neck`.

- [ ] **Step 3: Write minimal implementation**

Em `src/core/kit.ts`:

```ts
// Valores novos no fim: a ordem participa do sorteio (src/styles/component-weights.ts).
export const COLLAR_STYLES = ["round", "v-neck", "polo", "polo-v"] as const;
```

Em `src/renderers/shirt-2d-shape.ts`, trocar `const NECKLINES …` e as funções `collarPath`, `bodyPath` e `outlinePath` por:

```ts
const ROUND_NECKLINE = "M165 48 Q207 92 249 48";
const V_NECKLINE = "M165 48 L207 100 L249 48";

interface CollarShape {
  neckline: string;
  trim?: string;
}

// neckline recorta o corpo e recebe o traço da gola; trim é a peça preenchida das golas polo (abas e carcela).
// Fora da carcela (x 200–214), nenhum trim passa de y = 101: as caixas de logo começam em y = 102.
const COLLARS: Record<CollarStyle, CollarShape> = {
  round: { neckline: ROUND_NECKLINE },
  "v-neck": { neckline: V_NECKLINE },
  polo: {
    neckline: ROUND_NECKLINE,
    trim: "M162 45 L146 60 L192 96 L203 72 Q182 64 165 48 Z M252 45 L268 60 L222 96 L211 72 Q232 64 249 48 Z M200 70 L214 70 L214 125 L200 125 Z",
  },
  "polo-v": { neckline: V_NECKLINE, trim: "M163 46 L207 100 L198 100 L140 58 Z M251 46 L207 100 L216 100 L274 58 Z" },
};
```

```ts
export function collarPath(style: CollarStyle): string {
  return COLLARS[style].neckline;
}

export function collarTrimPath(style: CollarStyle): string | undefined {
  return COLLARS[style].trim;
}

export function bodyPath(style: CollarStyle): string {
  return `${COLLARS[style].neckline} ${TORSO}`;
}

export function outlinePath(style: CollarStyle): string {
  return `${COLLARS[style].neckline} ${SILHOUETTE}`;
}
```

E trocar o comentário de `LOGO_BOXES` por:

```ts
// Escudo no peito esquerdo do jogador (direita de quem olha), fabricante no direito, patrocinador no centro; todas abaixo das golas (y ≤ 101) e fora da carcela da polo.
```

Em `src/renderers/renderer-2d.ts`:
- acrescentar `collarTrimPath` ao import de `./shirt-2d-shape.js`;
- depois de `const OUTLINE_WIDTH = 2;`:

```ts
// Traço escuro da silhueta, repetido nas peças da gola polo: o mesmo texto mantém o SVG das golas antigas igual.
const OUTLINE_STROKE = 'stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"';
```

- em `renderKit2dSvg`, depois de `const design = kitDesign(kit);`: `const trim = collarTrimPath(kit.collar.style);`
- trocar as duas últimas linhas de desenho antes de `"</svg>"` por:

```ts
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${design.collar}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    trim === undefined ? "" : `<path d="${trim}" fill="${design.collar}" ${OUTLINE_STROKE}/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" ${OUTLINE_STROKE}/>`,
```

Em `src/styles/profiles.ts`, trocar os `collarWeights` de três perfis (os de `classic` não mudam):

```ts
    collarWeights: { round: 35, "v-neck": 25, polo: 25, "polo-v": 15 }, // traditional
    collarWeights: { round: 40, "v-neck": 40, "polo-v": 20 }, // modern
    collarWeights: { round: 15, "v-neck": 15, polo: 35, "polo-v": 35 }, // retro
```

(Os comentários `// traditional` etc. só indicam o perfil neste plano; não os copie.)

- [ ] **Step 4: Run tests and update the branded guard**

Run: `npx vitest run tests/core/kit.test.ts tests/renderers tests/styles tests/generator`
Expected: tudo PASS, incluindo `renderKit2dSvg Phase 3b baseline` com o mesmo hash, exceto a guarda do `branded`, que falha com outro hash (`modern` ganhou `polo-v`). A guarda sem categorias tem de PASSAR.

Copie o hash recebido para o `toBe` do teste do `branded`.

Run: `npm test && npm run typecheck`
Expected: PASS e sem erros.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/core/kit.ts src/renderers src/styles tests
git commit -m "feat: add the polo and polo-v collars to the 2D kit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Manga raglan

**Files:**
- Modify: `src/core/kit.ts`
- Modify: `src/styles/profiles.ts`
- Modify: `src/styles/component-weights.ts`
- Modify: `src/generator/kit-generator.ts`
- Modify: `src/renderers/shirt-2d-shape.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Test: `tests/core/kit.test.ts`, `tests/styles/profiles.test.ts`, `tests/styles/component-weights.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/renderers/renderer-2d.test.ts`

**Interfaces:**
- Consumes: `resolveProfileWeights` (Task 1); `collarCandidates`, `sleeveStyleCandidates` (Task 2); `COLLARS`, `OUTLINE_STROKE` (Task 3).
- Produces: `SLEEVE_CUTS = ["set-in", "raglan"]`, `type SleeveCut`, `sleeves.cut?: SleeveCut`, `sleeveCut(kit: KitDefinition): SleeveCut` em `src/core/kit.ts`; `StyleProfile.sleeveCutWeights: Weights<SleeveCut>`; `sleeveCutCandidates(identity: ClubIdentity): [SleeveCut, number][]`; `bodyPath(style: CollarStyle, cut: SleeveCut): string`, `sleevesPath(cut: SleeveCut): string` e `RAGLAN_SEAMS_PATH` em `src/renderers/shirt-2d-shape.ts` (sai `SLEEVES_PATH`).

- [ ] **Step 1: Write the failing tests**

Em `tests/core/kit.test.ts`, acrescentar `SLEEVE_CUTS` e `sleeveCut` ao import de `../../src/core/kit.js`. Dentro de `describe("parseKitDefinition", …)`:

```ts
  it.each(SLEEVE_CUTS)("accepts the %s sleeve cut and keeps it through a JSON round trip", (cut) => {
    const kit = makeKit({ sleeves: { style: "solid", cut, color: "secondary", cuffColor: "accent" } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("rejects unknown sleeve cuts and names the path", () => {
    const sleeves = { style: "solid", cut: "puffed", color: "secondary", cuffColor: "accent" };
    expect(() => parseKitDefinition({ ...makeKit(), sleeves })).toThrow(/sleeves\.cut/);
  });
```

E no fim do arquivo:

```ts
describe("sleeveCut", () => {
  it("reads a kit without cut as set-in", () => {
    expect(sleeveCut(makeKit())).toBe("set-in");
  });

  it("returns the declared cut", () => {
    expect(sleeveCut(makeKit({ sleeves: { style: "solid", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toBe("raglan");
  });
});
```

Em `tests/styles/profiles.test.ts`, trocar os dois testes da Task 2 por:

```ts
  // Pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; só set-in mantém o corte antigo.
  it("keeps classic collars and sleeve styles even, and its sleeves set-in", () => {
    expect(getStyleProfile("classic").collarWeights).toEqual({ round: 1, "v-neck": 1 });
    expect(getStyleProfile("classic").sleeveStyleWeights).toEqual({ "match-body": 1, solid: 1 });
    expect(getStyleProfile("classic").sleeveCutWeights).toEqual({ "set-in": 1 });
  });

  it("gives every profile a positive weight in each component table", () => {
    for (const profile of STYLE_PROFILES) {
      for (const table of [profile.collarWeights, profile.sleeveStyleWeights, profile.sleeveCutWeights]) {
        const weights = Object.values(table);
        expect(weights.length).toBeGreaterThan(0);
        for (const weight of weights) expect(weight).toBeGreaterThan(0);
      }
    }
  });
```

Em `tests/styles/component-weights.test.ts`, acrescentar `sleeveCutCandidates` ao import de `../../src/styles/component-weights.js` e, no fim do arquivo:

```ts
describe("sleeveCutCandidates", () => {
  it("keeps a club without categories on set-in sleeves", () => {
    expect(sleeveCutCandidates(club([]))).toEqual([
      ["set-in", 1],
      ["raglan", 0],
    ]);
  });

  it("splits the modern profile between set-in and raglan", () => {
    const [[, setIn], [, raglan]] = sleeveCutCandidates(club(["modern"]));
    expect(setIn).toBeCloseTo(0.5);
    expect(raglan).toBeCloseTo(0.5);
  });
});
```

Em `tests/generator/kit-generator.test.ts`, dentro de `describe("generateKitSet", …)`:

```ts
  it("writes the sleeve cut only for raglan sleeves", () => {
    const modern = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["modern"] } });
    const kits = Array.from({ length: 50 }, (_, seed) => Object.values(generateKitSet(modern, seed))).flat();
    expect(kits.some((kit) => kit.sleeves.cut === "raglan")).toBe(true);
    expect(kits.some((kit) => !("cut" in kit.sleeves))).toBe(true);
    for (const kit of kits) expect(kit.sleeves.cut).not.toBe("set-in");
  });

  it("keeps a club without categories on set-in sleeves", () => {
    const classic = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } });
    for (let seed = 0; seed < 50; seed++) {
      for (const kit of Object.values(generateKitSet(classic, seed))) expect(kit.sleeves).not.toHaveProperty("cut");
    }
  });
```

Em `tests/renderers/renderer-2d.test.ts`:
- trocar o import de `../../src/core/kit.js` por `import { COLLAR_STYLES, SLEEVE_CUTS } from "../../src/core/kit.js";`;
- trocar o import de `../../src/renderers/shirt-2d-shape.js` por `import { LOGO_BOXES, RAGLAN_SEAMS_PATH } from "../../src/renderers/shirt-2d-shape.js";`;
- trocar o teste `it.each(COLLAR_STYLES)("keeps every logo box on the plain body with the %s collar", …)` (e o comentário acima dele) por:

```ts
  // Cada caixa de logo fica inteira sobre o corpo liso: nenhuma toca gola, manga, costura, contorno ou fundo transparente.
  // Manga lisa em accent denuncia uma raglan que invada a caixa.
  const SHAPES = COLLAR_STYLES.flatMap((collar) => SLEEVE_CUTS.map((cut) => [collar, cut] as const));

  it.each(SHAPES)("keeps every logo box on the plain body with the %s collar and %s sleeves", async (style, cut) => {
    const kit = makeKit({ collar: { style, color: "accent" }, sleeves: { style: "solid", cut, color: "accent", cuffColor: "secondary" } });
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });
```

- dentro de `describe("renderKit2dPng", …)`, depois do teste do `polo-v`:

```ts
  // (270, 66) fica no triângulo do ombro que a raglan tira do corpo, longe da costura e do contorno.
  it("paints the shoulder with the sleeve color only on raglan sleeves", async () => {
    const raglan = await renderKit2dPng(makeKit({ sleeves: { style: "solid", cut: "raglan", color: "accent", cuffColor: "secondary" } }));
    const setIn = await renderKit2dPng(makeKit({ sleeves: { style: "solid", cut: "set-in", color: "accent", cuffColor: "secondary" } }));
    expect(await pixelAt(raglan, 270, 66)).toEqual(ACCENT);
    expect(await pixelAt(setIn, 270, 66)).toEqual(PRIMARY);
  });
```

- dentro de `describe("renderKit2dSvg", …)`:

```ts
  it("draws the raglan seams only on raglan sleeves", () => {
    expect(renderKit2dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }))).toContain(RAGLAN_SEAMS_PATH);
    expect(renderKit2dSvg(makeKit())).not.toContain(RAGLAN_SEAMS_PATH);
  });

  it("renders a declared set-in cut exactly as a kit without cut", () => {
    const declared = makeKit({ sleeves: { style: "match-body", cut: "set-in", color: "secondary", cuffColor: "accent" } });
    expect(renderKit2dSvg(declared)).toBe(renderKit2dSvg(makeKit()));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/kit.test.ts tests/styles tests/generator/kit-generator.test.ts tests/renderers/renderer-2d.test.ts`
Expected: FAIL. `cut` rejeitado como chave desconhecida, `sleeveCut`/`sleeveCutCandidates`/`RAGLAN_SEAMS_PATH` não exportados, nenhum kit `modern` com `raglan`.

- [ ] **Step 3: Write minimal implementation**

Em `src/core/kit.ts`:
- depois de `SLEEVE_STYLES`: `export const SLEEVE_CUTS = ["set-in", "raglan"] as const;`
- trocar a linha `sleeves` do schema por:

```ts
  sleeves: z.strictObject({ style: z.enum(SLEEVE_STYLES), cut: z.enum(SLEEVE_CUTS).optional(), color: ColorRoleSchema, cuffColor: ColorRoleSchema }),
```

- depois de `export type SleeveStyle …`: `export type SleeveCut = (typeof SLEEVE_CUTS)[number];`
- no fim do arquivo:

```ts
// Kit sem cut é set-in: os kit.json de antes da Fase 4a não declaram o corte.
export function sleeveCut(kit: KitDefinition): SleeveCut {
  return kit.sleeves.cut ?? "set-in";
}
```

Em `src/styles/profiles.ts`:
- trocar o import por `import type { CollarStyle, SleeveCut, SleeveStyle } from "../core/kit.js";`;
- acrescentar `sleeveCutWeights: Weights<SleeveCut>;` à interface, depois de `sleeveStyleWeights`;
- acrescentar a cada perfil, depois de `sleeveStyleWeights`:

```ts
    sleeveCutWeights: { "set-in": 1 }, // classic
    sleeveCutWeights: { "set-in": 90, raglan: 10 }, // traditional
    sleeveCutWeights: { "set-in": 50, raglan: 50 }, // modern
    sleeveCutWeights: { "set-in": 80, raglan: 20 }, // retro
```

(Os comentários `// classic` etc. só indicam o perfil neste plano; não os copie.)

Em `src/styles/component-weights.ts`:
- trocar o import de `../core/kit.js` por `import { COLLAR_STYLES, SLEEVE_CUTS, SLEEVE_STYLES, type CollarStyle, type SleeveCut, type SleeveStyle } from "../core/kit.js";`;
- no fim do arquivo:

```ts
export function sleeveCutCandidates(identity: ClubIdentity): [SleeveCut, number][] {
  return candidates(SLEEVE_CUTS, resolveProfileWeights(identity, (profile) => profile.sleeveCutWeights));
}
```

Em `src/generator/kit-generator.ts`:
- trocar o import de `../styles/component-weights.js` por `import { collarCandidates, sleeveCutCandidates, sleeveStyleCandidates } from "../styles/component-weights.js";`;
- depois de `const socksColor = rng.pick([shortsColor, base]);`:

```ts
  // Último sorteio: o corte entrou na Fase 4a e não pode deslocar os sorteios anteriores.
  const cut = rng.weighted(sleeveCutCandidates(identity));
```

- trocar a linha `sleeves:` do objeto `kit` por:

```ts
    // cut só aparece na raglan: o kit.json de quem não sorteia raglan fica igual ao de antes da 4a.
    sleeves: { style: sleeveStyle, ...(cut === "raglan" ? { cut } : {}), color: overlay, cuffColor },
```

Em `src/renderers/shirt-2d-shape.ts`:
- trocar o import por `import type { CollarStyle, LogoSlot, SleeveCut } from "../core/kit.js";`;
- trocar `const TORSO = …` e `export const SLEEVES_PATH = …` por:

```ts
// Na raglan o decote vai direto às axilas: os triângulos dos ombros saem do corpo e entram nas mangas.
const TORSO: Record<SleeveCut, string> = {
  "set-in": "L300 62 L302 146 L302 382 L112 382 L112 146 L114 62 Z",
  raglan: "L302 146 L302 382 L112 382 L112 146 Z",
};

const SLEEVES: Record<SleeveCut, string> = {
  "set-in": "M300 62 L378 140 L346 178 L302 146 Z M114 62 L36 140 L68 178 L112 146 Z",
  raglan: "M249 48 L300 62 L378 140 L346 178 L302 146 Z M165 48 L114 62 L36 140 L68 178 L112 146 Z",
};

export const RAGLAN_SEAMS_PATH = "M249 48 L302 146 M165 48 L112 146";
```

- trocar `bodyPath` e acrescentar `sleevesPath`:

```ts
export function bodyPath(style: CollarStyle, cut: SleeveCut): string {
  return `${COLLARS[style].neckline} ${TORSO[cut]}`;
}

export function sleevesPath(cut: SleeveCut): string {
  return SLEEVES[cut];
}
```

Em `src/renderers/renderer-2d.ts`:
- trocar o import de `../core/kit.js` por `import { BRAND_KINDS, resolveLogoColor, sleeveCut, type KitDefinition, type LogoSlot } from "../core/kit.js";`;
- no import de `./shirt-2d-shape.js`, trocar `SLEEVES_PATH` por `RAGLAN_SEAMS_PATH, sleevesPath`;
- trocar o começo de `renderKit2dSvg` até o fim do array por:

```ts
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const design = kitDesign(kit);
  const trim = collarTrimPath(kit.collar.style);
  const cut = sleeveCut(kit);
  const sleevesShape = sleevesPath(cut);
  // Manga lisa continua um <path> preenchido, como antes da camada: o SVG 2D não pode mudar (guarda da Fase 3b).
  const sleeves =
    design.sleeves.kind === "solid"
      ? `<path d="${sleevesShape}" fill="${design.sleeves.color}"/>`
      : `<g clip-path="url(#sleeves)">${fillSvg(design.sleeves, view, view)}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(kit.collar.style, cut)}"/></clipPath><clipPath id="sleeves"><path d="${sleevesShape}"/></clipPath></defs>`,
    `<g clip-path="url(#body)">${fillSvg(design.body, view, view)}</g>`,
    sleeves,
    // Sem a costura, a raglan com manga match-body sairia igual à set-in.
    cut === "raglan" ? `<path d="${RAGLAN_SEAMS_PATH}" fill="none" ${OUTLINE_STROKE}/>` : "",
    `<path d="${CUFFS_PATH}" fill="none" stroke="${design.cuffs}" stroke-width="8"/>`,
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${design.collar}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    trim === undefined ? "" : `<path d="${trim}" fill="${design.collar}" ${OUTLINE_STROKE}/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" ${OUTLINE_STROKE}/>`,
    "</svg>",
  ].join("");
```

Run: `grep -rn "SLEEVES_PATH" src tests`
Expected: nenhuma ocorrência.

- [ ] **Step 4: Run tests and update the branded guard**

Run: `npx vitest run tests/core tests/styles tests/generator tests/renderers`
Expected: tudo PASS, incluindo `renderKit2dSvg Phase 3b baseline` e a guarda sem categorias com os hashes de sempre, exceto a guarda do `branded`, que falha com outro hash (`modern` passou a sortear o corte). Copie o hash recebido para o `toBe` do teste do `branded`.

Run: `npm test && npm run typecheck`
Expected: PASS e sem erros.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src tests
git commit -m "feat: add raglan sleeves to the 2D kit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gola e manga no contact sheet

**Files:**
- Modify: `src/preview/contact-sheet.ts`
- Test: `tests/preview/contact-sheet.test.ts`

**Interfaces:**
- Consumes: `sleeveCut` (Task 4).
- Produces: `kitDetails(kit)` com a linha `collar <style> · sleeves <style> · <cut>` logo depois da linha do padrão.

- [ ] **Step 1: Write the failing tests**

Em `tests/preview/contact-sheet.test.ts`, dentro de `describe("kitDetails", …)`, trocar os dois testes por:

```ts
  it("lists the pattern with category and resolved params, the collar and sleeves, the seed and the brands", () => {
    const kit = makeKit({
      generatedWith: { seed: 42 },
      pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } },
      sponsor: { id: "luna-air", color: "accent" },
      manufacturer: { id: "vertex", color: "accent" },
    });
    expect(kitDetails(kit)).toEqual([
      "stripes · classic · count 7, ratio 0.3",
      "collar round · sleeves match-body · set-in",
      "seed 42",
      "sponsor luna-air",
      "manufacturer vertex",
    ]);
  });

  it("omits what the kit does not have and reads a kit without cut as set-in", () => {
    expect(kitDetails(makeKit())).toEqual(["solid · classic", "collar round · sleeves match-body · set-in"]);
  });

  it("shows the new collars and the raglan cut", () => {
    const kit = makeKit({ collar: { style: "polo", color: "accent" }, sleeves: { style: "solid", cut: "raglan", color: "secondary", cuffColor: "accent" } });
    expect(kitDetails(kit)[1]).toBe("collar polo · sleeves solid · raglan");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/preview/contact-sheet.test.ts`
Expected: FAIL nos três testes de `kitDetails` (falta a linha de gola e manga).

- [ ] **Step 3: Write minimal implementation**

Em `src/preview/contact-sheet.ts`, trocar `import type { KitDefinition, KitType } from "../core/kit.js";` por `import { sleeveCut, type KitDefinition, type KitType } from "../core/kit.js";` e a linha `const lines = …` de `kitDetails` por:

```ts
  const lines = [
    [template.id, template.category, params].filter((part) => part !== "").join(" · "),
    `collar ${kit.collar.style} · sleeves ${kit.sleeves.style} · ${sleeveCut(kit)}`,
  ];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/preview tests/cli`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/preview tests/preview
git commit -m "feat: show collar and sleeves in the contact sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Inspeção visual, documentação e gates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`
- Create (ignorados pelo git, em `output/`): `output/fase-4a/clubs/retro-fc/club.json`, `output/fase-4a/clubs/modern-fc/club.json`

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: documentação; nenhum código.

- [ ] **Step 1: Generate sample kits for inspection**

Criar `output/fase-4a/clubs/retro-fc/club.json` (com a ferramenta Write):

```json
{ "id": "retro-fc", "name": "Retro FC", "palette": { "primary": "#c8102e", "secondary": "#ffffff" }, "style": { "categories": ["retro"] } }
```

Criar `output/fase-4a/clubs/modern-fc/club.json`:

```json
{ "id": "modern-fc", "name": "Modern FC", "palette": { "primary": "#0b3d91", "secondary": "#f2c14e" }, "style": { "categories": ["modern"] } }
```

Run (cada `generate` sobrescreve o `kit.json` do clube, então o resumo é impresso logo depois de cada seed; no `kit.json`, o primeiro `"style"` é o da gola e o segundo o da manga):

```bash
for club in retro-fc modern-fc; do
  for seed in 1 2 3 4 5 6; do
    npm run --silent kit-generator -- generate --club $club --seed $seed --clubs output/fase-4a/clubs --out output/fase-4a/png-$seed
    for type in home away third; do echo "$club $seed $type: $(grep -o '"style": "[^"]*"\|"cut": "[^"]*"' output/fase-4a/clubs/$club/kits/$type/kit.json | tr '\n' ' ')"; done
  done
done
npm run --silent kit-generator -- preview --club retro-fc --samples 24 --clubs output/fase-4a/clubs --out output/fase-4a/retro.html
npm run --silent kit-generator -- preview --club modern-fc --samples 24 --clubs output/fase-4a/clubs --out output/fase-4a/modern.html
```

Expected: exit 0 em todos; PNGs em `output/fase-4a/png-<seed>/<clube>/2d/<slug>_<tipo>_2d.png`; o resumo lista `polo`, `polo-v` e `"cut": "raglan"` em alguma linha.

- [ ] **Step 2: Inspect the PNGs**

Pelo resumo do Step 1, escolha PNGs que mostrem `polo`, `polo-v`, `raglan` com manga `match-body` e `raglan` com manga `solid`, e abra cada um com a ferramenta Read.

Conferir: abas e carcela da `polo` na cor da gola e acima do escudo e do fabricante; abas da `polo-v` sem cobrir o fundo do V; costura raglan visível nos dois estilos de manga; ombro na cor da manga lisa na raglan; nenhum logo sobre gola, costura ou manga. Se algo falhar, corrija os paths em `src/renderers/shirt-2d-shape.ts`, rode `npx vitest run tests/renderers` e repita. Avise o usuário para abrir `output/fase-4a/retro.html` e `output/fase-4a/modern.html`.

- [ ] **Step 3: Update the roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. No fim da linha 5 (lista de planos detalhados), trocar `e Fase 3b (spec …, plano …).` por `, Fase 3b (spec …, plano …) e Fase 4a (spec \`docs/superpowers/specs/2026-10-05-fase-4a-golas-mangas-design.md\`, plano \`docs/superpowers/plans/2026-10-05-fase-4a-golas-mangas.md\`).` (mantendo os caminhos da 3b).
2. Na tabela de status, depois da linha da 3c, acrescentar. Antes de editar, rode `git rev-parse --short HEAD` (o HEAD ainda é o commit da Task 5, o último de código) e `npm test` (total de testes na linha `Tests`), e troque `<commit>` e `<N>` por esses valores:

```markdown
| 4a — Golas `polo`/`polo-v`, manga raglan e frequência de manga lisa (2D) | **Concluída** (2026-10-05, `dev` @ `<commit>`, <N> testes). Não dependeu do teste no jogo |
```

3. Trocar `A 3c fica com os passos 1, 4 e 5 e o 3D no export.` por `A 3c fica com os passos 4 e 5 e o 3D no export; o passo 1 foi descartado na 4a.`
4. Trocar a pendência `**Herdado da Fase 2a:** mangas \`solid\` usam a cor do overlay e puxam a leitura do kit para ela (ex.: Home com mangas brancas); avaliar na Fase 4, junto com os componentes de manga.` por `**Herdado da Fase 2a (resolvido na 4a):** mangas \`solid\` continuam com a cor do overlay, mas \`traditional\`, \`modern\` e \`retro\` sorteiam manga lisa em 20–30% dos kits; \`classic\` mantém 50% para não mudar as seeds antigas.` (o resto do parágrafo, sobre o retry descartado, fica).
5. No parágrafo da Fase 3, trocar `3c (passos 1, 4 e 5 e o 3D no export, depois do teste da calibração)` por `3c (passos 4 e 5 e o 3D no export, depois do teste da calibração; o passo 1 foi descartado na 4a)`.
6. No passo 1 da Fase 3, acrescentar no fim: ` **Descartado em 2026-10-05 (spec da 4a):** as referências ficam em \`docs/fm_templates/\`, porque \`assets/\` é a pasta de runtime; a \`uv.webp\` da raiz já não existe.`
7. No item 1 da Fase 4, acrescentar no fim: ` **Parcial (4a):** golas \`A1\` (\`polo\`) e \`A2\` (\`polo-v\`) e manga \`/ \\\` (\`raglan\`) no renderer 2D, sorteadas pelos perfis. Faltam as listras de gola e de punho e golas e cortes no 3D (depois da 3c).`

- [ ] **Step 4: Update CLAUDE.md**

Em `CLAUDE.md`:

1. Na "Visão geral", trocar `Estado atual: Fase 3b concluída (12 padrões, perfis de estilo, tradições do clube, contact sheet \`preview\`, camada de desenho compartilhada e layout UV como dado); a próxima é a 3c` por `Estado atual: Fase 4a concluída (golas \`polo\`/\`polo-v\`, manga raglan e pesos de gola e manga por perfil, só 2D), sobre a 3b (12 padrões, perfis de estilo, tradições do clube, contact sheet \`preview\`, camada de desenho compartilhada e layout UV como dado); a próxima é a 3c`.
2. No bullet de `src/core`, trocar `` `KIT_TYPES`/`KitType`/`KitTypeSchema`, `BRAND_KINDS`/`BRAND_LISTS` e `resolveLogoColor` moram em `core/kit.ts`. `` por `` `KIT_TYPES`/`KitType`/`KitTypeSchema`, `BRAND_KINDS`/`BRAND_LISTS`, `resolveLogoColor` e `sleeveCut` (`sleeves.cut` ausente = `set-in`) moram em `core/kit.ts`. ``
3. No bullet de `src/generator/kit-generator.ts`, depois de `` O padrão sai de uma chamada `rng.weighted` sobre `patternCandidates(identity, kitType)` ``, acrescentar `` ; gola e estilo de manga saem de `rng.weighted` sobre `collarCandidates`/`sleeveStyleCandidates`, na posição do antigo `rng.pick`, e o corte (`sleeveCutCandidates`) é o último sorteio, gravado em `sleeves.cut` só quando sai `raglan` ``.
4. Trocar o bullet de `src/styles` por:

```markdown
- `src/styles`: `profiles.ts` (perfis `classic`, `traditional`, `modern`, `retro` como constante TS, com `patternWeights`, `collarWeights`, `sleeveStyleWeights` e `sleeveCutWeights`), `profile-weights.ts` (`resolveProfileWeights`: média normalizada das tabelas dos perfis de `categories`, senão `classic` sem normalizar), `pattern-weights.ts` (`resolvePatternWeights`: `patternWeights` do clube, senão `resolveProfileWeights`; `patternCandidates(identity, kitType)` aplica `forbiddenPatterns` e a lista por tipo, na ordem do registry) e `component-weights.ts` (candidatos de gola, estilo e corte de manga na ordem dos enums de `core/kit.ts`; o `club.json` não tem override para eles).
```

5. No bullet de `src/renderers`, trocar `` `shirt-2d-shape.ts` tem os paths da camisa (viewBox fixo, a gola muda o path do corpo) e `LOGO_BOXES` `` por `` `shirt-2d-shape.ts` tem os paths da camisa (viewBox fixo; a gola muda o decote e as golas polo têm um `trim` preenchido; o corte muda corpo e mangas, e a raglan ganha costura) e `LOGO_BOXES` (nenhuma peça de gola passa de y = 101 fora da carcela da `polo`) ``.
6. No primeiro bullet de "Convenções e armadilhas", acrescentar no fim: ` Em gola e manga, \`classic\` tem pesos iguais (\`round\`/\`v-neck\`, \`match-body\`/\`solid\`) e só \`set-in\`, o que reproduz o \`rng.pick\` antigo. A guarda do clube \`branded\` (\`modern\`) muda de propósito quando os pesos de gola ou manga dos perfis mudam; a do clube sem categorias e a de SVG não mudam.`

- [ ] **Step 5: Run every gate**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde, com o mesmo total de testes registrado no roadmap.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document phase 4a

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
