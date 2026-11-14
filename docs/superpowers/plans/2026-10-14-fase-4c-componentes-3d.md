# Fase 4c — Golas, raglan e listras de acabamento no 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A textura 3D passa a mostrar o estilo de gola, a raglan, a cava real da manga curta e os punhos da manga comprida, e os kits ganham listras de acabamento casadas na gola e nos punhos, sorteadas pelos perfis e desenhadas no 2D e no 3D.

**Architecture:** O schema ganha `trimStripe` opcional; os perfis ganham `trimStripeWeights` e o generator sorteia a listra como último sorteio. Um módulo puro (`trim-stripes.ts`) transforma o estilo em traços concêntricos (modo centrado para peças desenhadas como traço, modo da borda para peças preenchidas), usado pelos dois renderers. As formas medidas no PSD do FM26 (cava, raglan, punhos da manga comprida, golas U/V/A1/A2) entram como dados em `src/fm26/layout.ts` e `src/fm26/collars.ts`; o renderer 3D pinta tronco, raglan, mangas recortadas pela cava, costuras, punhos e gola, nessa ordem.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Sharp, Zod 4, Vitest, `fast-xml-parser` (só nos testes), tsx, Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-14-fase-4c-componentes-3d-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova. O runtime nunca lê `docs/fm_templates/` (só os testes leem).
- `TRIM_STRIPE_STYLES = ["single", "double"]`; `TRIM_STRIPE_OPTIONS = ["none", "single", "double"]` (ordem fixa, participa do sorteio).
- `trimStripeWeights`: classic `{ none: 1 }`; traditional `{ none: 60, single: 25, double: 15 }`; modern `{ none: 75, single: 20, double: 5 }`; retro `{ none: 40, single: 30, double: 30 }`.
- Sorteio da listra: depois de `pickLayers`, último sorteio de `generateKit`; cor por `rng.pick` entre os papéis diferentes de `collarColor` e `cuffColor`; `trimStripe` gravado logo depois de `sleeves`, só quando sai listra.
- Regra `trim-stripe-color`: `"<tipo> kit trim stripe uses <papel>, the color of the collar"` e `"..., the color of the cuffs"`. Mensagem de `required-color` termina em `on the pattern, layers, sleeves, collar, cuffs or trim stripe`.
- Faixas das listras em fração da largura nominal `W`, a partir da borda: `single` 0,375–0,625; `double` 0,1–0,3 e 0,7–0,9.
- Larguras nominais: 2D gola 10, punho 8, abas das polo 8; 3D gola 10 (modo da borda sobre o contorno externo), punho = lado curto do retângulo (modo centrado).
- Costura da raglan 3D: `fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="2"`.
- Carcela da `polo` 3D: retângulo x 505–525, y 630–676 (px, semiaberto). Punhos 3D: manga curta `rect(244, 411, 270, 722)` e `rect(756, 411, 781, 722)`; manga comprida `rect(1, 3, 26, 318)` e `rect(998, 3, 1023, 318)`.
- Espelho das asas e da raglan: x = 512 (em fração, `1 - x`).
- Guardas: `renderKit2dSvg Phase 3b baseline` (`acdafaa885203f9f125260033f4ef9b225720ea04165ad11f244a57e6ce96d40`) e o clube sem categorias do generator (`e69b9a924a8b3943500bf9730e543e41c7c6b6fca9fe0c95deff9d9907507eb5`) não mudam. O hash do clube `branded` muda na Task 3, e o conjunto sem `trimStripe` continua batendo com `c20550b8efc79d1ee736bae0e0670bc5dc0e4a6fff4c1f6f3d3cb2fff6b163f4`.
- Sem `trimStripe`, o SVG 2D é byte a byte o de antes; com listra, o contorno da silhueta não passa pelo decote.
- Renderers determinísticos; nada de `rng` fora do generator.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro em inglês, como no resto do código.
- Arquivos novos com a ferramenta de escrita, nunca com heredoc no shell.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.
- Linha de base antes da Task 1: 762 testes verdes, `npm run typecheck` limpo.

## Review Focus

- `kit.json` escrito à mão com `trimStripe` na cor da gola: o `validate` deve acusar `trim-stripe-color`, mas `render` e `export` desenham assim mesmo, sem erro. Testes na Task 1 (regra) e na Task 5 (2D desenha).
- Listra em `v-neck` e `polo-v` (abas sem carcela) no 2D: SVG válido e caixas de logo intactas. Teste na Task 5 (`it.each` de gola × estilo).
- `kit.json` de antes da 4c (sem `trimStripe`, gola `polo`, corte `raglan`): o PNG 2D não muda e a textura ganha a gola e a raglan, sem regerar. Testes na Task 5 (trim da polo com o mesmo texto) e nas Tasks 7 e 8.
- `renderKit3dPng(kit, { size: 512 })` com listra: as listras acompanham a escala. Teste na Task 8.
- Clube com `traditions.requiredColor` e perfil que sorteia listra: a cor exigida aparece e a listra nunca repete a gola. Teste na Task 3.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/core/kit.ts` | Modificar | `TRIM_STRIPE_STYLES`, `trimStripe` no schema, tipos, `visibleRoles` |
| `src/core/validation.ts` | Modificar | `trim-stripe-color`, mensagem de `required-color` |
| `src/styles/profiles.ts` | Modificar | `TRIM_STRIPE_OPTIONS`, `trimStripeWeights` |
| `src/styles/component-weights.ts` | Modificar | `trimStripeCandidates` |
| `src/generator/kit-generator.ts` | Modificar | `pickTrimStripe`, último sorteio |
| `src/renderers/trim-stripes.ts` | Criar | Faixas, traços centrados e da borda, SVG dos traços (puro) |
| `src/renderers/kit-design.ts` | Modificar | `trimStripe` resolvido |
| `src/preview/contact-sheet.ts` | Modificar | `kitDetails` mostra a listra |
| `src/renderers/shirt-2d-shape.ts` | Modificar | `flaps`/`placket` das polo, contorno sem decote |
| `src/renderers/renderer-2d.ts` | Modificar | Listras na gola, nas abas e nos punhos |
| `src/fm26/layout.ts` | Modificar | `UvPoint`, `points`, `mirrorX`, `outlineBounds`, `rect` exportado, `outline` da manga curta, punhos da manga comprida, `raglan`; sai `collar` na Task 8 |
| `src/fm26/collars.ts` | Criar | `FM26_COLLARS` (contornos U/V/A1/A2 e carcela) |
| `src/renderers/uv-mapping.ts` | Modificar | Metades da manga curta cobrem a cava |
| `src/renderers/renderer-3d.ts` | Modificar | Cava, raglan, costuras, punhos como traço, golas e listras |
| `tests/fixtures/geometry.ts` | Criar | `insidePolygon` para os testes de forma |
| `tests/...` | Modificar/Criar | Espelham `src/` |
| `CLAUDE.md`, roadmap | Modificar | Documentação (Task 9) |

---

### Task 1: Schema e validação da listra

**Files:**
- Modify: `src/core/kit.ts`
- Modify: `src/core/validation.ts`
- Test: `tests/core/kit.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Produces: `TRIM_STRIPE_STYLES`, `type TrimStripeStyle = "single" | "double"`, `type KitTrimStripe = { style: TrimStripeStyle; color: ColorRole }`, `KitDefinition.trimStripe?: KitTrimStripe`; `visibleRoles` conta `trimStripe.color`; regra `trim-stripe-color` em `validateKit`.

- [ ] **Step 1: Write the failing tests**

Em `tests/core/kit.test.ts`, troque o import por:

```ts
import { COLLAR_STYLES, KIT_TYPES, MAX_LAYERS, parseKitDefinition, SLEEVE_CUTS, sleeveCut, TRIM_STRIPE_STYLES, visibleRoles, type KitLayer } from "../../src/core/kit.js";
```

Dentro de `describe("parseKitDefinition", ...)`, depois do teste `"rejects unknown collars and names the path"`, acrescente:

```ts
  it.each(TRIM_STRIPE_STYLES)("accepts the %s trim stripe and keeps it through a JSON round trip", (style) => {
    const kit = makeKit({ trimStripe: { style, color: "primary" } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("rejects unknown trim stripe styles, colors and keys and names the path", () => {
    expect(() => parseKitDefinition({ ...makeKit(), trimStripe: { style: "triple", color: "primary" } })).toThrow(/trimStripe\.style/);
    expect(() => parseKitDefinition({ ...makeKit(), trimStripe: { style: "single", color: "gold" } })).toThrow(/trimStripe\.color/);
    expect(() => parseKitDefinition({ ...makeKit(), trimStripe: { style: "single", color: "primary", width: 2 } })).toThrow(/width/);
  });

  it("keeps kits from before Phase 4c without a trim stripe", () => {
    expect(parseKitDefinition(makeKit())).not.toHaveProperty("trimStripe");
  });
```

Dentro de `describe("visibleRoles", ...)`, acrescente:

```ts
  it("counts the trim stripe color", () => {
    const kit = makeKit({
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
      trimStripe: { style: "single", color: "accent" },
    });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary", "accent"]);
  });
```

Em `tests/core/validation.test.ts`, depois do bloco `describe("validateKit layers", ...)`, acrescente:

```ts
describe("validateKit trim stripe", () => {
  it("accepts a stripe in a color neither the collar nor the cuffs use", () => {
    expect(validateKit(makeKit({ trimStripe: { style: "double", color: "secondary" } }))).toEqual([]);
  });

  it("reports a stripe in the color of the collar or of the cuffs", () => {
    const kit = makeKit({
      collar: { style: "round", color: "accent" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "accent" },
      trimStripe: { style: "single", color: "accent" },
    });
    expect(validateKit(kit)).toEqual([
      { rule: "trim-stripe-color", message: "home kit trim stripe uses accent, the color of the collar" },
      { rule: "trim-stripe-color", message: "home kit trim stripe uses accent, the color of the cuffs" },
    ]);
  });
});
```

No teste `"reports a kit that does not show the required color"` de `describe("validateKitTraditions", ...)`, troque a mensagem esperada por:

```ts
      { rule: "required-color", message: "home kit does not show accent #ffd700 (traditions.requiredColor) on the pattern, layers, sleeves, collar, cuffs or trim stripe" },
```

E acrescente no mesmo `describe`:

```ts
  it("counts a trim stripe in the required color as shown", () => {
    const required = club({ traditions: { requiredColor: "accent" } });
    const hidden = makeKit({
      collar: { style: "round", color: "secondary" },
      sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" },
      trimStripe: { style: "single", color: "accent" },
    });
    expect(validateKitTraditions(required, hidden)).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/kit.test.ts tests/core/validation.test.ts`
Expected: FAIL (`TRIM_STRIPE_STYLES` indefinido, chave `trimStripe` desconhecida, regra e mensagem novas ausentes).

- [ ] **Step 3: Implement the schema**

Em `src/core/kit.ts`, depois de `export const SLEEVE_CUTS = ["set-in", "raglan"] as const;`, acrescente:

```ts
// Listra de acabamento da gola e dos punhos, casada nas duas peças (Fase 4c).
export const TRIM_STRIPE_STYLES = ["single", "double"] as const;
```

Depois de `const LayerSchema = ...;`, acrescente:

```ts
const TrimStripeSchema = z.strictObject({ style: z.enum(TRIM_STRIPE_STYLES), color: ColorRoleSchema });
```

No `KitDefinitionSchema`, logo depois da linha `sleeves: z.strictObject({ ... }),`, acrescente:

```ts
  // Ausente = sem listra: os kit.json de antes da Fase 4c continuam válidos.
  trimStripe: TrimStripeSchema.optional(),
```

Depois de `export type SleeveCut = ...;`, acrescente:

```ts
export type TrimStripeStyle = (typeof TRIM_STRIPE_STYLES)[number];
```

Depois de `export type KitLayer = ...;`, acrescente:

```ts
export type KitTrimStripe = z.infer<typeof TrimStripeSchema>;
```

Em `visibleRoles`, troque o comentário e a primeira linha do corpo por:

```ts
// Papéis que aparecem na camisa (o PNG 2D mostra só ela). O overlay só pinta o corpo fora do padrão solid, a manga lisa tem cor própria e cada camada e a listra pintam a cor delas.
export function visibleRoles(kit: KitDefinition): ColorRole[] {
  const roles: ColorRole[] = [kit.pattern.base, kit.collar.color, kit.sleeves.cuffColor, ...(kit.layers ?? []).map((layer) => layer.color)];
  if (kit.trimStripe) roles.push(kit.trimStripe.color);
```

(as linhas seguintes da função continuam iguais).

- [ ] **Step 4: Implement the validation**

Em `src/core/validation.ts`, depois da função `layerIssues`, acrescente:

```ts
function trimStripeIssues(kit: KitDefinition): ValidationIssue[] {
  const stripe = kit.trimStripe;
  if (!stripe) return [];
  const pieces = [
    ["collar", kit.collar.color],
    ["cuffs", kit.sleeves.cuffColor],
  ] as const;
  return pieces
    .filter(([, color]) => color === stripe.color)
    .map(([piece]) => ({ rule: "trim-stripe-color", message: `${kit.kitType} kit trim stripe uses ${stripe.color}, the color of the ${piece}` }));
}
```

Em `validateKit`, troque `return [...issues, ...layerIssues(kit)];` por:

```ts
  return [...issues, ...layerIssues(kit), ...trimStripeIssues(kit)];
```

Em `validateKitTraditions`, troque o texto da mensagem de `required-color` por:

```ts
      message: `${kit.kitType} kit does not show ${required} ${kit.colors[required]} (traditions.requiredColor) on the pattern, layers, sleeves, collar, cuffs or trim stripe`,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core && npm run typecheck`
Expected: PASS, typecheck limpo.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/core/kit.ts src/core/validation.ts tests/core/kit.test.ts tests/core/validation.test.ts
git commit -m "feat: add the trim stripe to the kit schema and validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pesos da listra nos perfis

**Files:**
- Modify: `src/styles/profiles.ts`
- Modify: `src/styles/component-weights.ts`
- Test: `tests/styles/profiles.test.ts`, `tests/styles/component-weights.test.ts`

**Interfaces:**
- Consumes: `TRIM_STRIPE_STYLES` (Task 1).
- Produces: `TRIM_STRIPE_OPTIONS`, `type TrimStripeOption = "none" | "single" | "double"`, `StyleProfile.trimStripeWeights: Weights<TrimStripeOption>`, `trimStripeCandidates(identity: ClubIdentity): [TrimStripeOption, number][]`.

- [ ] **Step 1: Write the failing tests**

Em `tests/styles/component-weights.test.ts`, troque os imports por:

```ts
import { collarCandidates, layerCountCandidates, sleeveCutCandidates, sleeveStyleCandidates, trimStripeCandidates } from "../../src/styles/component-weights.js";
import { TRIM_STRIPE_OPTIONS } from "../../src/styles/profiles.js";
```

(mantendo os outros imports do arquivo) e acrescente no fim:

```ts
describe("trimStripeCandidates", () => {
  it("never draws a trim stripe when the club has no categories", () => {
    expect(trimStripeCandidates(club([]))).toEqual([
      ["none", 1],
      ["single", 0],
      ["double", 0],
    ]);
  });

  it("lists the options in a fixed order and favors stripes in the retro profile", () => {
    const candidates = trimStripeCandidates(club(["retro"]));
    expect(candidates.map(([option]) => option)).toEqual([...TRIM_STRIPE_OPTIONS]);
    const [[, none], [, single], [, double]] = candidates;
    expect(none).toBeCloseTo(0.4);
    expect(single).toBeCloseTo(0.3);
    expect(double).toBeCloseTo(0.3);
  });
});
```

Em `tests/styles/profiles.test.ts`, no teste `"gives every profile a positive weight in each component table"`, troque a lista de tabelas por:

```ts
      for (const table of [profile.collarWeights, profile.sleeveStyleWeights, profile.sleeveCutWeights, profile.layerCountWeights, profile.trimStripeWeights]) {
```

E acrescente dentro de `describe("STYLE_PROFILES", ...)`:

```ts
  // Sem listra, as seeds de clubes sem estilo geram os mesmos kits (guarda Phase 3b baseline).
  it("keeps classic without trim stripes", () => {
    expect(getStyleProfile("classic").trimStripeWeights).toEqual({ none: 1 });
  });

  it("gives every other profile a chance of each trim stripe style", () => {
    for (const profile of STYLE_PROFILES.filter((candidate) => candidate.id !== "classic")) {
      expect(profile.trimStripeWeights.single, profile.id).toBeGreaterThan(0);
      expect(profile.trimStripeWeights.double, profile.id).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/styles`
Expected: FAIL (`trimStripeCandidates`, `TRIM_STRIPE_OPTIONS` e `trimStripeWeights` não existem).

- [ ] **Step 3: Implement the weights**

Em `src/styles/profiles.ts`, troque o import por:

```ts
import { TRIM_STRIPE_STYLES, type CollarStyle, type SleeveCut, type SleeveStyle } from "../core/kit.js";
```

Depois de `export type LayerCount = ...;`, acrescente:

```ts
// Ausência de listra entra como opção do sorteio ponderado; "none" não vai para o kit.json.
export const TRIM_STRIPE_OPTIONS = ["none", ...TRIM_STRIPE_STYLES] as const;
export type TrimStripeOption = (typeof TRIM_STRIPE_OPTIONS)[number];
```

Em `StyleProfile`, depois de `layerWeights: Record<string, number>;`, acrescente:

```ts
  trimStripeWeights: Weights<TrimStripeOption>;
```

Troque o comentário `// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; classic nunca sorteia camada.` por:

```ts
// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; classic nunca sorteia camada nem listra.
```

E acrescente `trimStripeWeights` em cada perfil, depois de `layerWeights`:

```ts
    trimStripeWeights: { none: 1 },
```

(classic)

```ts
    trimStripeWeights: { none: 60, single: 25, double: 15 },
```

(traditional)

```ts
    trimStripeWeights: { none: 75, single: 20, double: 5 },
```

(modern)

```ts
    trimStripeWeights: { none: 40, single: 30, double: 30 },
```

(retro)

Em `src/styles/component-weights.ts`, troque o import de `./profiles.js` por:

```ts
import { LAYER_COUNTS, TRIM_STRIPE_OPTIONS, type LayerCount, type TrimStripeOption, type Weights } from "./profiles.js";
```

E acrescente no fim:

```ts
export function trimStripeCandidates(identity: ClubIdentity): [TrimStripeOption, number][] {
  return candidates(
    TRIM_STRIPE_OPTIONS,
    resolveProfileWeights(identity, (profile) => profile.trimStripeWeights),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/styles && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/styles/profiles.ts src/styles/component-weights.ts tests/styles/profiles.test.ts tests/styles/component-weights.test.ts
git commit -m "feat: weigh the trim stripe styles by profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sorteio da listra no generator

**Files:**
- Modify: `src/generator/kit-generator.ts`
- Test: `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `trimStripeCandidates` (Task 2), `KitTrimStripe` (Task 1).
- Produces: kits gerados com `trimStripe` (depois de `sleeves`) quando o perfil sorteia listra.

- [ ] **Step 1: Write the failing tests**

Em `tests/generator/kit-generator.test.ts`, troque a função `setsDigest` e o bloco de guarda por:

```ts
function setsDigest(club: ClubIdentity, badge: boolean, withoutTrimStripe = false): string {
  const sets = Array.from({ length: 30 }, (_, seed) => generateKitSet(club, seed, { badge }));
  // Sem a listra, o JSON volta ao de antes da 4c: a chave sai e a ordem das outras não muda.
  const drawn = withoutTrimStripe
    ? sets.map((set) => Object.fromEntries(Object.entries(set).map(([kitType, { trimStripe: _stripe, ...kit }]) => [kitType, kit])))
    : sets;
  return createHash("sha256").update(JSON.stringify(drawn)).digest("hex");
}

// Guarda da Fase 3b: o clube sem categories (perfil classic) não pode mudar de kit para a mesma seed.
// O branded (categoria modern) muda de propósito quando os pesos de gola, manga (Fase 4a), camada (Fase 4b) ou listra (Fase 4c) dos perfis mudam ou quando muda o que vai nos logos (só o id desde que os logos mantêm as cores do arquivo); atualize o hash só nessas mudanças.
describe("generateKitSet Phase 3b baseline", () => {
  it("keeps the sets of a club with pattern weights and brands", () => {
    expect(setsDigest(branded, true)).toBe("c20550b8efc79d1ee736bae0e0670bc5dc0e4a6fff4c1f6f3d3cb2fff6b163f4");
  });

  // A listra é o último sorteio: tirando ela, os conjuntos do branded são os de antes da 4c.
  it("keeps the branded sets of before Phase 4c apart from the trim stripe", () => {
    expect(setsDigest(branded, true, true)).toBe("c20550b8efc79d1ee736bae0e0670bc5dc0e4a6fff4c1f6f3d3cb2fff6b163f4");
  });

  it("keeps the sets of a club without categories or pattern weights", () => {
    expect(setsDigest(parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } }), false)).toBe(
      "e69b9a924a8b3943500bf9730e543e41c7c6b6fca9fe0c95deff9d9907507eb5",
    );
  });
});
```

No teste `"keeps the rest of the kit when the traditions forbid every layer"`, troque o comentário e o laço interno por:

```ts
  // As camadas vêm antes da listra: sem nenhuma permitida, o rng chega à listra em outro estado, e só os campos layers e trimStripe mudam.
  it("keeps the rest of the kit when the traditions forbid every layer", () => {
    const forbidAll = styled(["modern"], { traditions: { forbiddenPatterns: listLayerTemplates().map((template) => template.id) } });
    let dropped = 0;
    for (let seed = 0; seed < 100; seed++) {
      const [withLayers, withoutLayers] = [generateKitSet(styled(["modern"]), seed), generateKitSet(forbidAll, seed)];
      for (const kitType of KIT_TYPES) {
        const { layers, trimStripe: _stripe, ...rest } = withLayers[kitType];
        const { trimStripe: _other, ...withoutStripe } = withoutLayers[kitType];
        if (layers) dropped++;
        expect(withoutStripe).toEqual(rest);
      }
    }
    expect(dropped).toBeGreaterThan(0);
  });
```

E acrescente no fim do arquivo:

```ts
describe("generateKitSet trim stripes", () => {
  const styled = (categories: string[], extra: object = {}) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories }, ...extra });
  const kitsOf = (club: ClubIdentity, seeds = 100) => Array.from({ length: seeds }, (_, seed) => Object.values(generateKitSet(club, seed))).flat();

  it("never draws a trim stripe for a club without categories", () => {
    for (const kit of kitsOf(styled([]))) expect(kit).not.toHaveProperty("trimStripe");
  });

  it("draws both styles for a retro club, in a color the collar and the cuffs do not use", () => {
    const kits = kitsOf(styled(["retro"]), 200);
    expect(new Set(kits.map((kit) => kit.trimStripe?.style ?? "none"))).toEqual(new Set(["none", "single", "double"]));
    for (const kit of kits) {
      if (!kit.trimStripe) continue;
      expect(kit.trimStripe.color).not.toBe(kit.collar.color);
      expect(kit.trimStripe.color).not.toBe(kit.sleeves.cuffColor);
      expect(validateKit(kit)).toEqual([]);
    }
  });

  it("keeps the trim stripe apart from a required collar color", () => {
    const club = styled(["retro"], { traditions: { requiredColor: "accent" } });
    let striped = 0;
    for (const kit of kitsOf(club, 200)) {
      expect(visibleRoles(kit)).toContain("accent");
      if (!kit.trimStripe) continue;
      striped++;
      expect(kit.trimStripe.color).not.toBe(kit.collar.color);
      expect(kit.trimStripe.color).not.toBe(kit.sleeves.cuffColor);
    }
    expect(striped).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generator/kit-generator.test.ts`
Expected: FAIL nos testes de `generateKitSet trim stripes` que esperam listra (nenhum kit tem `trimStripe`). O teste do clube sem categorias e o "apart from the trim stripe" passam.

- [ ] **Step 3: Implement the draw**

Em `src/generator/kit-generator.ts`, acrescente `type KitTrimStripe` ao import de `../core/kit.js` e troque o import de `component-weights` por:

```ts
import { collarCandidates, layerCountCandidates, sleeveCutCandidates, sleeveStyleCandidates, trimStripeCandidates } from "../styles/component-weights.js";
```

Em `generateKit`, troque o comentário e as duas linhas dos últimos sorteios por:

```ts
  // O corte (Fase 4a), as camadas (Fase 4b) e a listra (Fase 4c) são os últimos sorteios: entraram depois e não podem deslocar os anteriores.
  const cut = rng.weighted(sleeveCutCandidates(identity));
  const layers = pickLayers(identity, { id: template.id, base, overlay }, rng);
  const trimStripe = pickTrimStripe(identity, collarColor, cuffColor, rng);
```

No objeto `kit`, logo depois da linha `sleeves: { ... },`, acrescente:

```ts
    // trimStripe só aparece quando sai listra: o kit.json de quem não sorteia listra fica igual ao de antes da 4c.
    ...(trimStripe ? { trimStripe } : {}),
```

Depois da função `pickLayers`, acrescente:

```ts
// Gola e punhos ficam com a mesma listra; a cor é um papel que nenhum dos dois usa, e sobra sempre pelo menos um.
function pickTrimStripe(identity: ClubIdentity, collarColor: ColorRole, cuffColor: ColorRole, rng: Rng): KitTrimStripe | undefined {
  const style = rng.weighted(trimStripeCandidates(identity));
  if (style === "none") return undefined;
  return { style, color: rng.pick(COLOR_ROLES.filter((role) => role !== collarColor && role !== cuffColor)) };
}
```

A correção do `requiredColor` não muda: o papel exigido só é aplicado quando não está em `visibleRoles(kit)`, e a cor da listra é visível, então a gola nova nunca repete a listra.

- [ ] **Step 4: Run the generator tests**

Run: `npx vitest run tests/generator/kit-generator.test.ts`
Expected: tudo PASS menos `"keeps the sets of a club with pattern weights and brands"`, que falha mostrando o hash novo (`expected '<novo>' to be 'c20550b8…'`). O teste `"keeps the branded sets of before Phase 4c apart from the trim stripe"` precisa passar: ele prova que só a listra mudou. Se ele falhar, a ordem de sorteio ou de chaves está errada; corrija antes de seguir.

- [ ] **Step 5: Update the branded hash**

No teste `"keeps the sets of a club with pattern weights and brands"`, troque `"c20550b8efc79d1ee736bae0e0670bc5dc0e4a6fff4c1f6f3d3cb2fff6b163f4"` pelo hash recebido no Step 4 (só nesse teste; o "apart from the trim stripe" mantém o antigo).

- [ ] **Step 6: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/generator/kit-generator.ts tests/generator/kit-generator.test.ts
git commit -m "feat: draw the trim stripe as the last kit draw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Traços das listras, `kitDesign` e preview

**Files:**
- Create: `src/renderers/trim-stripes.ts`
- Modify: `src/renderers/kit-design.ts`
- Modify: `src/preview/contact-sheet.ts`
- Test: `tests/renderers/trim-stripes.test.ts` (criar), `tests/renderers/kit-design.test.ts`, `tests/preview/contact-sheet.test.ts`

**Interfaces:**
- Consumes: `TrimStripeStyle`, `KitDefinition.trimStripe` (Task 1).
- Produces:
  - `TRIM_STRIPE_BANDS: Record<TrimStripeStyle, readonly (readonly [number, number])[]>`
  - `interface TrimStroke { width: number; paint: "stripe" | "trim" }`
  - `centeredStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[]`
  - `edgeStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[]`
  - `stripeStrokesSvg(d: string, strokes: readonly TrimStroke[], colors: { stripe: string; trim: string }, attributes?: string): string`
  - `KitDesign.trimStripe?: { style: TrimStripeStyle; color: string }`
  - `kitDetails` com a linha `trim stripe <estilo> · <papel>`.

- [ ] **Step 1: Write the failing tests**

Crie `tests/renderers/trim-stripes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TRIM_STRIPE_STYLES } from "../../src/core/kit.js";
import { centeredStripeStrokes, edgeStripeStrokes, stripeStrokesSvg, TRIM_STRIPE_BANDS, type TrimStroke } from "../../src/renderers/trim-stripes.js";

const widths = (strokes: TrimStroke[]) => strokes.map(({ width, paint }) => [Number(width.toFixed(6)), paint]);

describe("TRIM_STRIPE_BANDS", () => {
  // O modo centrado desenha as duas bordas com o mesmo traço: as faixas precisam ser simétricas.
  it.each(TRIM_STRIPE_STYLES)("keeps the %s bands inside the piece and symmetric", (style) => {
    const bands = TRIM_STRIPE_BANDS[style];
    for (const [from, to] of bands) {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(1);
      expect(to).toBeGreaterThan(from);
    }
    const mirrored = bands.map(([from, to]) => [Number((1 - to).toFixed(6)), Number((1 - from).toFixed(6))]).sort(([a], [b]) => a! - b!);
    expect(mirrored).toEqual(bands.map(([from, to]) => [from, to]));
  });
});

describe("centeredStripeStrokes", () => {
  it("draws a single stripe as one narrow stroke on the middle line", () => {
    expect(widths(centeredStripeStrokes(10, "single"))).toEqual([[2.5, "stripe"]]);
  });

  it("draws a double stripe as a wide stripe stroke with a trim stroke over its middle", () => {
    expect(widths(centeredStripeStrokes(10, "double"))).toEqual([
      [8, "stripe"],
      [4, "trim"],
    ]);
  });
});

describe("edgeStripeStrokes", () => {
  it("doubles the depth of each band, since the clip keeps only the inner half of the stroke", () => {
    expect(widths(edgeStripeStrokes(10, "single"))).toEqual([
      [12.5, "stripe"],
      [7.5, "trim"],
    ]);
    expect(widths(edgeStripeStrokes(10, "double"))).toEqual([
      [18, "stripe"],
      [14, "trim"],
      [6, "stripe"],
      [2, "trim"],
    ]);
  });
});

describe("stripeStrokesSvg", () => {
  it("draws every stroke on the same path, in order, with the extra attributes", () => {
    const strokes: TrimStroke[] = [
      { width: 8, paint: "stripe" },
      { width: 4, paint: "trim" },
    ];
    expect(stripeStrokesSvg("M0 0 L10 0", strokes, { stripe: "#ffffff", trim: "#000000" }, ' stroke-linecap="round"')).toBe(
      '<path d="M0 0 L10 0" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/><path d="M0 0 L10 0" fill="none" stroke="#000000" stroke-width="4" stroke-linecap="round"/>',
    );
  });
});
```

Em `tests/renderers/kit-design.test.ts`, dentro de `describe("kitDesign", ...)`, acrescente:

```ts
  it("resolves the trim stripe color, and leaves it out of kits without one", () => {
    expect(kitDesign(makeKit({ trimStripe: { style: "double", color: "secondary" } })).trimStripe).toEqual({ style: "double", color: "#ffffff" });
    expect(kitDesign(makeKit())).not.toHaveProperty("trimStripe");
  });
```

Em `tests/preview/contact-sheet.test.ts`, dentro de `describe("kitDetails", ...)`, acrescente:

```ts
  it("lists the trim stripe after the collar and sleeves", () => {
    expect(kitDetails(makeKit({ trimStripe: { style: "double", color: "secondary" } }))).toEqual([
      "solid · classic",
      "collar round · sleeves match-body · set-in",
      "trim stripe double · secondary",
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderers/trim-stripes.test.ts tests/renderers/kit-design.test.ts tests/preview/contact-sheet.test.ts`
Expected: FAIL (módulo `trim-stripes.js` inexistente, `trimStripe` ausente em `kitDesign` e em `kitDetails`).

- [ ] **Step 3: Implement `trim-stripes.ts`**

Crie `src/renderers/trim-stripes.ts`:

```ts
import type { TrimStripeStyle } from "../core/kit.js";

// Faixas de cada estilo em fração da largura nominal da peça, medidas a partir da borda.
export const TRIM_STRIPE_BANDS: Record<TrimStripeStyle, readonly (readonly [number, number])[]> = {
  single: [[0.375, 0.625]],
  double: [
    [0.1, 0.3],
    [0.7, 0.9],
  ],
};

export interface TrimStroke {
  width: number;
  paint: "stripe" | "trim";
}

// Peça desenhada como traço sobre a linha central: cada faixa da metade de fora vira um traço de listra e, se não chega ao meio, um traço da peça por cima; a outra metade é o espelho.
export function centeredStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[] {
  return TRIM_STRIPE_BANDS[style].flatMap(([from, to]): TrimStroke[] => {
    if (from >= 0.5) return [];
    const stripe: TrimStroke = { width: (1 - 2 * from) * width, paint: "stripe" };
    return to < 0.5 ? [stripe, { width: (1 - 2 * to) * width, paint: "trim" }] : [stripe];
  });
}

// Peça preenchida: o contorno é traçado e recortado pela própria peça, então só a metade de dentro de cada traço aparece; da faixa mais funda para a mais rasa.
export function edgeStripeStrokes(width: number, style: TrimStripeStyle): TrimStroke[] {
  return [...TRIM_STRIPE_BANDS[style]]
    .sort(([, a], [, b]) => b - a)
    .flatMap(([from, to]): TrimStroke[] => [
      { width: 2 * to * width, paint: "stripe" },
      { width: 2 * from * width, paint: "trim" },
    ]);
}

export function stripeStrokesSvg(d: string, strokes: readonly TrimStroke[], colors: { stripe: string; trim: string }, attributes = ""): string {
  return strokes.map(({ width, paint }) => `<path d="${d}" fill="none" stroke="${colors[paint]}" stroke-width="${width}"${attributes}/>`).join("");
}
```

- [ ] **Step 4: Implement `kitDesign` and `kitDetails`**

Em `src/renderers/kit-design.ts`, troque o primeiro import por:

```ts
import type { ColorRole, KitDefinition, TrimStripeStyle } from "../core/kit.js";
```

Em `KitDesign`, depois de `socks: string;`, acrescente:

```ts
  // Listra casada da gola e dos punhos; ausente quando o kit não tem.
  trimStripe?: { style: TrimStripeStyle; color: string };
```

No `return` de `kitDesign`, depois de `socks: color(kit.socks.color),`, acrescente:

```ts
    ...(kit.trimStripe ? { trimStripe: { style: kit.trimStripe.style, color: color(kit.trimStripe.color) } } : {}),
```

Em `src/preview/contact-sheet.ts`, em `kitDetails`, logo depois da linha do `collar ... · sleeves ...` dentro do array `lines`, acrescente:

```ts
    ...(kit.trimStripe ? [`trim stripe ${kit.trimStripe.style} · ${kit.trimStripe.color}`] : []),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/renderers tests/preview && npm run typecheck`
Expected: PASS (a guarda de SVG 2D continua verde: nenhum renderer usa a listra ainda).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/trim-stripes.ts src/renderers/kit-design.ts src/preview/contact-sheet.ts tests/renderers/trim-stripes.test.ts tests/renderers/kit-design.test.ts tests/preview/contact-sheet.test.ts
git commit -m "feat: resolve the trim stripe strokes for the renderers and the preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Listras no 2D

**Files:**
- Modify: `src/renderers/shirt-2d-shape.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Test: `tests/renderers/renderer-2d.test.ts`

**Interfaces:**
- Consumes: `centeredStripeStrokes`, `edgeStripeStrokes`, `stripeStrokesSvg`, `KitDesign.trimStripe` (Task 4).
- Produces: `collarFlapsPath(style: CollarStyle): string | undefined`, `collarPlacketPath(style: CollarStyle): string | undefined`, `outlinePath(style: CollarStyle, neckline?: boolean): string`. `collarTrimPath` devolve o mesmo texto de antes.

Âncoras (viewBox 414, PNG 414): decote `round` com vértice em (207, 70) e traço de 10 (y 65–75); punho direito na linha (374, 137)–(342, 175), normal (0,765, 0,644), centro (358, 156); aba esquerda da polo com a borda (146, 60)–(192, 96). Cada pixel abaixo foi escolhido inteiro dentro da faixa, sem antialias.

- [ ] **Step 1: Write the failing tests**

Em `tests/renderers/renderer-2d.test.ts`, troque os imports de `kit.js` e `shirt-2d-shape.js` por:

```ts
import { COLLAR_STYLES, SLEEVE_CUTS, TRIM_STRIPE_STYLES, type CollarStyle, type KitDefinition, type TrimStripeStyle } from "../../src/core/kit.js";
import { collarPath, collarTrimPath, LOGO_BOXES, RAGLAN_SEAMS_PATH } from "../../src/renderers/shirt-2d-shape.js";
```

E acrescente antes de `describe("renderKit2dPng logos", ...)`:

```ts
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
    for (const y of [67, 72]) expect(await pixelAt(png, 207, y), `y ${y}`).toEqual(SECONDARY);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderers/renderer-2d.test.ts`
Expected: FAIL nos testes de listra (nada é desenhado); a guarda `Phase 3b baseline` passa.

- [ ] **Step 3: Split the polo trim and open the outline**

Em `src/renderers/shirt-2d-shape.ts`, troque `CollarShape`, o comentário de `COLLARS` e `COLLARS` por:

```ts
interface CollarShape {
  neckline: string;
  // Abas das golas polo: recebem a listra junto à borda.
  flaps?: string;
  // Carcela da polo: fica por cima da listra, como no PSD do FM.
  placket?: string;
}

// neckline recorta o corpo e recebe o traço da gola; flaps e placket são as peças preenchidas das golas polo.
// Fora da carcela (x 200–214), nenhuma peça passa de y = 101: as caixas de logo começam em y = 102.
const COLLARS: Record<CollarStyle, CollarShape> = {
  round: { neckline: ROUND_NECKLINE },
  "v-neck": { neckline: V_NECKLINE },
  polo: {
    neckline: ROUND_NECKLINE,
    flaps: "M162 45 L146 60 L192 96 L203 72 Q182 64 165 48 Z M252 45 L268 60 L222 96 L211 72 Q232 64 249 48 Z",
    placket: "M200 70 L214 70 L214 125 L200 125 Z",
  },
  "polo-v": { neckline: V_NECKLINE, flaps: "M163 46 L207 100 L198 100 L140 58 Z M251 46 L207 100 L216 100 L274 58 Z" },
};
```

Troque `const SILHOUETTE = "L300 62 ... Z";` por:

```ts
const SILHOUETTE_POINTS = "L300 62 L378 140 L346 178 L302 146 L302 382 L112 382 L112 146 L68 178 L36 140 L114 62";
const SILHOUETTE = `${SILHOUETTE_POINTS} Z`;
```

Troque `collarTrimPath` e `outlinePath` por:

```ts
export function collarTrimPath(style: CollarStyle): string | undefined {
  const parts = [COLLARS[style].flaps, COLLARS[style].placket].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function collarFlapsPath(style: CollarStyle): string | undefined {
  return COLLARS[style].flaps;
}

export function collarPlacketPath(style: CollarStyle): string | undefined {
  return COLLARS[style].placket;
}
```

```ts
// Sem o decote, a silhueta vai do fim ao começo da gola, (249, 48) e (165, 48), nas duas linhas de decote.
export function outlinePath(style: CollarStyle, neckline = true): string {
  return neckline ? `${COLLARS[style].neckline} ${SILHOUETTE}` : `M249 48 ${SILHOUETTE_POINTS} L165 48`;
}
```

- [ ] **Step 4: Draw the stripes**

Substitua `src/renderers/renderer-2d.ts` inteiro por:

```ts
import sharp from "sharp";
import { sleeveCut, type KitDefinition } from "../core/kit.js";
import { fillSvg, kitDesign } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import {
  bodyPath,
  collarFlapsPath,
  collarPath,
  collarPlacketPath,
  collarTrimPath,
  CUFFS_PATH,
  LOGO_BOXES,
  outlinePath,
  RAGLAN_SEAMS_PATH,
  SHIRT_2D_VIEWBOX,
  sleevesPath,
  type LogoBox,
} from "./shirt-2d-shape.js";
import { centeredStripeStrokes, edgeStripeStrokes, stripeStrokesSvg } from "./trim-stripes.js";

export const KIT_2D_SIZE = 414;
// Espessura do contorno dos logos no viewBox 414; escala com o tamanho do PNG.
const OUTLINE_WIDTH = 2;
// Traço escuro da silhueta, repetido nas peças da gola polo: o mesmo texto mantém o SVG das golas antigas igual.
const OUTLINE_STROKE = 'stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"';
const ROUND_STROKE = 'stroke-linecap="round" stroke-linejoin="round"';
// Larguras dos traços da gola e dos punhos; as listras são frações delas.
const COLLAR_WIDTH = 10;
const CUFF_WIDTH = 8;
// Profundidade nominal da listra nas abas das golas polo, a partir da borda.
const FLAP_STRIPE_WIDTH = 8;

export interface Render2dOptions {
  size?: number;
  logos?: KitLogoImages;
}

export function renderKit2dSvg(kit: KitDefinition, options: Render2dOptions = {}): string {
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const design = kitDesign(kit);
  const style = kit.collar.style;
  const trim = collarTrimPath(style);
  const cut = sleeveCut(kit);
  const sleevesShape = sleevesPath(cut);
  const stripe = design.trimStripe;
  // Sem listra, nenhum elemento novo: o SVG fica igual ao de antes da 4c (guarda da 3b).
  const flaps = stripe === undefined ? undefined : collarFlapsPath(style);
  const placket = stripe === undefined ? undefined : collarPlacketPath(style);
  // Manga lisa continua um <path> preenchido, como antes da camada: o SVG 2D não pode mudar (guarda da Fase 3b).
  const sleeves =
    design.sleeves.kind === "solid"
      ? `<path d="${sleevesShape}" fill="${design.sleeves.color}"/>`
      : `<g clip-path="url(#sleeves)">${fillSvg(design.sleeves, view, view)}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(style, cut)}"/></clipPath><clipPath id="sleeves"><path d="${sleevesShape}"/></clipPath>${flaps === undefined ? "" : `<clipPath id="flaps"><path d="${flaps}"/></clipPath>`}</defs>`,
    `<g clip-path="url(#body)">${fillSvg(design.body, view, view, design.bodyLayers)}</g>`,
    sleeves,
    // Sem a costura, a raglan com manga match-body sairia igual à set-in.
    cut === "raglan" ? `<path d="${RAGLAN_SEAMS_PATH}" fill="none" ${OUTLINE_STROKE}/>` : "",
    `<path d="${CUFFS_PATH}" fill="none" stroke="${design.cuffs}" stroke-width="${CUFF_WIDTH}"/>`,
    stripe === undefined ? "" : stripeStrokesSvg(CUFFS_PATH, centeredStripeStrokes(CUFF_WIDTH, stripe.style), { stripe: stripe.color, trim: design.cuffs }),
    `<path d="${collarPath(style)}" fill="none" stroke="${design.collar}" stroke-width="${COLLAR_WIDTH}" ${ROUND_STROKE}/>`,
    stripe === undefined
      ? ""
      : stripeStrokesSvg(collarPath(style), centeredStripeStrokes(COLLAR_WIDTH, stripe.style), { stripe: stripe.color, trim: design.collar }, ` ${ROUND_STROKE}`),
    trim === undefined ? "" : `<path d="${trim}" fill="${design.collar}" ${OUTLINE_STROKE}/>`,
    stripe === undefined || flaps === undefined
      ? ""
      : `<g clip-path="url(#flaps)">${stripeStrokesSvg(flaps, edgeStripeStrokes(FLAP_STRIPE_WIDTH, stripe.style), { stripe: stripe.color, trim: design.collar }, ' stroke-linejoin="round"')}</g>`,
    // A carcela volta por cima das listras das abas, como no PSD do FM.
    placket === undefined ? "" : `<path d="${placket}" fill="${design.collar}" ${OUTLINE_STROKE}/>`,
    // Com listra, a silhueta não passa pelo decote: o traço escuro cairia em cima da listra simples.
    `<path d="${outlinePath(style, stripe === undefined)}" fill="none" ${OUTLINE_STROKE}/>`,
    "</svg>",
  ].join("");
}

export async function renderKit2dPng(kit: KitDefinition, options: Render2dOptions = {}): Promise<Buffer> {
  const size = options.size ?? KIT_2D_SIZE;
  const shirt = sharp(Buffer.from(renderKit2dSvg(kit, options)));
  const scale = size / SHIRT_2D_VIEWBOX;
  const boxes = {
    badge: pixelBox(LOGO_BOXES.badge, scale),
    sponsor: pixelBox(LOGO_BOXES.sponsor, scale),
    manufacturer: pixelBox(LOGO_BOXES.manufacturer, scale),
  };
  const layers = await kitLogoLayers(kit, options.logos ?? {}, boxes, Math.max(1, Math.round(OUTLINE_WIDTH * scale)));
  // Sem logos não há composite: o PNG fica byte a byte igual ao da Fase 2a.
  return (layers.length > 0 ? shirt.composite(layers) : shirt).png().toBuffer();
}

function pixelBox(box: LogoBox, scale: number): PixelBox {
  return { left: Math.round(box.x * scale), top: Math.round(box.y * scale), width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/renderers/renderer-2d.test.ts && npm run typecheck`
Expected: PASS, incluindo `renderKit2dSvg Phase 3b baseline` com o hash `acdafaa8…` inalterado. Se um pixel de âncora sair misturado (antialias), confira a conta da distância na Step 1 antes de mudar a âncora; mude só a âncora, nunca as larguras.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/shirt-2d-shape.ts src/renderers/renderer-2d.ts tests/renderers/renderer-2d.test.ts
git commit -m "feat: draw the trim stripes on the 2D collar, flaps and cuffs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Formas FM26 no layout

**Files:**
- Modify: `src/fm26/layout.ts`
- Create: `src/fm26/collars.ts`
- Create: `tests/fixtures/geometry.ts`
- Test: `tests/fm26/layout.test.ts`, `tests/fm26/collars.test.ts` (criar)

**Interfaces:**
- Produces:
  - `interface UvPoint { x: number; y: number }` (fração 0–1)
  - `rect(x0: number, y0: number, x1: number, y1: number): UvRect` (passa a ser exportada)
  - `points(pixels: string): UvPoint[]` (pares `"x y"` em pixels, separados por vírgula)
  - `mirrorX(shape: readonly UvPoint[]): UvPoint[]` (espelho em x = 512)
  - `outlineBounds(shape: readonly UvPoint[]): UvRect`
  - `UvRegion.outline?: UvPoint[]` (só nas duas regiões `sleeve`)
  - `interface UvRaglan { yoke: UvPoint[]; seams: UvPoint[][] }` e `Fm26KitLayout.raglan: UvRaglan`
  - `FM26_KIT_LAYOUT.cuffs` com 4 retângulos (curta direita, curta esquerda, comprida direita, comprida esquerda)
  - `interface UvCollar { outer: UvPoint[]; inner: UvPoint[]; placket?: UvRect }` e `FM26_COLLARS: Record<CollarStyle, UvCollar>`
  - `insidePolygon(shape: readonly UvPoint[], x: number, y: number): boolean` (teste; pixel (x, y), amostrado no centro)
- `FM26_KIT_LAYOUT.collar` continua até a Task 8.

- [ ] **Step 1: Create the geometry fixture**

Crie `tests/fixtures/geometry.ts`:

```ts
import { FM26_TEXTURE_SIZE, type UvPoint } from "../../src/fm26/layout.js";

// Ray casting no centro do pixel (x, y) da textura 1024.
export function insidePolygon(shape: readonly UvPoint[], x: number, y: number): boolean {
  const [px, py] = [x + 0.5, y + 0.5];
  let inside = false;
  for (let index = 0, previous = shape.length - 1; index < shape.length; previous = index++) {
    const [ax, ay] = [shape[index]!.x * FM26_TEXTURE_SIZE, shape[index]!.y * FM26_TEXTURE_SIZE];
    const [bx, by] = [shape[previous]!.x * FM26_TEXTURE_SIZE, shape[previous]!.y * FM26_TEXTURE_SIZE];
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
```

- [ ] **Step 2: Write the failing layout tests**

Em `tests/fm26/layout.test.ts`, troque o import do layout por:

```ts
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, mirrorX, outlineBounds, points, type UvRect } from "../../src/fm26/layout.js";
import { insidePolygon } from "../fixtures/geometry.js";
```

Depois de `isTrimBlue`, acrescente:

```ts
// Verde puro = cor 2 (padrão) nas máscaras RGB do FM.
function isPatternGreen([red, green, blue]: Rgb): boolean {
  return green > 200 && red < 60 && blue < 60;
}

function sleeveRegion(side: "left" | "right") {
  return FM26_KIT_LAYOUT.regions.find((region) => region.part === "sleeve" && region.side === side)!;
}
```

Troque o teste `"puts the cuffs and the collar ring on the trim color of the FM mask 01-0"` por:

```ts
  it("puts the short-sleeve cuffs and the collar ring on the trim color of the FM mask 01-0", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "01-0.png"));
    const shortSleeveCuffs = FM26_KIT_LAYOUT.cuffs.filter((cuff) => FM26_KIT_LAYOUT.regions.some((region) => region.part === "sleeve" && overlaps(cuff, region.rect)));
    expect(shortSleeveCuffs).toHaveLength(2);
    for (const cuff of shortSleeveCuffs) expect(isTrimBlue(pixel(...centerPixel(cuff)))).toBe(true);
    const { cx, cy, innerRadius, outerRadius } = FM26_KIT_LAYOUT.collar;
    const radius = ((innerRadius + outerRadius) / 2) * FM26_TEXTURE_SIZE;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(isTrimBlue(pixel(Math.round(cx * FM26_TEXTURE_SIZE + dx * radius), Math.round(cy * FM26_TEXTURE_SIZE + dy * radius)))).toBe(true);
    }
  });

  // O PSD pinta punho na manga comprida; a máscara 01-0 do FM, não.
  it("puts a cuff on the outer edge of each long sleeve", () => {
    for (const sleeve of FM26_KIT_LAYOUT.regions.filter((region) => region.part === "longSleeve")) {
      const cuffs = FM26_KIT_LAYOUT.cuffs.filter((cuff) => overlaps(cuff, sleeve.rect));
      expect(cuffs, sleeve.side).toHaveLength(1);
      const [cuff, area] = [cuffs[0]!, sleeve.rect];
      const gap = sleeve.side === "right" ? cuff.x - area.x : area.x + area.width - (cuff.x + cuff.width);
      expect(gap * FM26_TEXTURE_SIZE, sleeve.side).toBeLessThanOrEqual(1);
    }
  });

  it("outlines only the short sleeves, from the outer edge to the armhole, the left one mirrored", () => {
    for (const region of FM26_KIT_LAYOUT.regions) expect(region.outline !== undefined, `${region.part} ${region.side}`).toBe(region.part === "sleeve");
    const bounds = outlineBounds(sleeveRegion("right").outline!);
    expect([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height].map((value) => value * FM26_TEXTURE_SIZE)).toEqual([240, 405, 395, 725]);
    expect(sleeveRegion("left").outline).toEqual(mirrorX(sleeveRegion("right").outline!));
  });

  // A máscara 02-0 do FM pinta a manga (cor 2) até a cava, por cima da coluna do tronco (spec da 4c, seção 3).
  it("puts the armhole strip inside the short sleeves, as the FM mask 02-0 paints it", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "02-0.png"));
    for (const [x, y] of [
      [375, 460],
      [374, 650],
      [648, 460],
      [650, 650],
    ] as const) {
      expect(isPatternGreen(pixel(x, y)), `mask ${x},${y}`).toBe(true);
      expect(
        FM26_KIT_LAYOUT.regions.some((region) => region.outline !== undefined && insidePolygon(region.outline, x, y)),
        `outline ${x},${y}`,
      ).toBe(true);
    }
    for (const [x, y] of [
      [400, 460],
      [624, 460],
    ] as const) {
      expect(FM26_KIT_LAYOUT.regions.some((region) => region.outline !== undefined && insidePolygon(region.outline, x, y))).toBe(false);
    }
  });

  it("keeps the raglan yoke on the shoulders and around the collar, symmetric", () => {
    const { yoke, seams } = FM26_KIT_LAYOUT.raglan;
    for (const [x, y] of [
      [420, 580],
      [603, 580],
      [512, 583],
      [390, 600],
    ] as const) {
      expect(insidePolygon(yoke, x, y), `${x},${y}`).toBe(true);
    }
    for (const [x, y] of [
      [420, 520],
      [512, 540],
      [512, 620],
      [450, 650],
    ] as const) {
      expect(insidePolygon(yoke, x, y), `${x},${y}`).toBe(false);
    }
    expect(seams).toHaveLength(4);
    expect(seams[1]).toEqual(mirrorX(seams[0]!));
    expect(seams[3]).toEqual(mirrorX(seams[2]!));
    for (const seam of seams) expect(seam.at(-1)!.x).toBe(0.5);
  });
```

E acrescente no fim do arquivo:

```ts
describe("points", () => {
  it("reads x y pairs in texture pixels as fractions", () => {
    expect(points("512 256, 1024 0")).toEqual([
      { x: 0.5, y: 0.25 },
      { x: 1, y: 0 },
    ]);
  });
});

describe("mirrorX", () => {
  it("mirrors across the middle of the texture", () => {
    expect(mirrorX(points("380.5 410, 512 562"))).toEqual(points("643.5 410, 512 562"));
  });
});
```

- [ ] **Step 3: Write the failing collar tests**

Crie `tests/fm26/collars.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COLLAR_STYLES, type CollarStyle } from "../../src/core/kit.js";
import { FM26_COLLARS } from "../../src/fm26/collars.js";
import { FM26_TEXTURE_SIZE } from "../../src/fm26/layout.js";
import { insidePolygon } from "../fixtures/geometry.js";

function inBand(style: CollarStyle, x: number, y: number): boolean {
  return insidePolygon(FM26_COLLARS[style].outer, x, y) && !insidePolygon(FM26_COLLARS[style].inner, x, y);
}

describe("FM26_COLLARS", () => {
  it.each(COLLAR_STYLES)("keeps the %s collar inside the texture, around the neck at (514, 597)", (style) => {
    const { outer, inner } = FM26_COLLARS[style];
    expect(outer.length).toBeGreaterThanOrEqual(10);
    expect(inner.length).toBeGreaterThanOrEqual(10);
    for (const point of [...outer, ...inner]) {
      for (const value of [point.x, point.y]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(insidePolygon(inner, 514, 597)).toBe(true);
  });

  // Âncoras medidas no PSD (spec da 4c, seção 4.2).
  const ANCHORS: [CollarStyle, number, number][] = [
    ["round", 474, 597],
    ["round", 554, 597],
    ["round", 514, 557],
    ["round", 514, 635],
    ["v-neck", 474, 597],
    ["v-neck", 514, 645],
    ["polo", 514, 557],
    ["polo", 480, 634],
    ["polo-v", 475, 628],
    ["polo-v", 514, 648],
  ];

  it.each(ANCHORS)("puts the %s collar band on (%d, %d)", (style, x, y) => {
    expect(inBand(style, x, y)).toBe(true);
  });

  it("cuts the v-neck down to a point the round collar does not reach", () => {
    expect(inBand("round", 514, 648)).toBe(false);
    expect(inBand("v-neck", 514, 648)).toBe(true);
  });

  it("gives only the polo a placket, below the collar", () => {
    for (const style of COLLAR_STYLES) expect(FM26_COLLARS[style].placket !== undefined, style).toBe(style === "polo");
    const placket = FM26_COLLARS.polo.placket!;
    expect([placket.x, placket.y, placket.x + placket.width, placket.y + placket.height].map((value) => value * FM26_TEXTURE_SIZE)).toEqual([505, 630, 525, 676]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/fm26`
Expected: FAIL (`points`, `mirrorX`, `outlineBounds`, `raglan`, `outline` e `collars.js` não existem; só 2 punhos).

- [ ] **Step 5: Implement the layout data**

Em `src/fm26/layout.ts`:

Depois da interface `UvRect`, acrescente:

```ts
// Fração 0–1 da textura, como UvRect.
export interface UvPoint {
  x: number;
  y: number;
}
```

Em `UvRegion`, depois de `hem?: UvRect;`, acrescente:

```ts
  // Contorno da ilha quando ela não é o retângulo (manga curta, até a cava); rect continua sendo a base da vista.
  outline?: UvPoint[];
```

Depois da interface `UvCircle`, acrescente:

```ts
export interface UvRaglan {
  // Ombros e faixa em volta da gola, na frente e nas costas: a manga raglan pinta aqui.
  yoke: UvPoint[];
  // Costuras entre a manga e o tronco, do lado do tronco.
  seams: UvPoint[][];
}
```

Em `Fm26KitLayout`, depois de `collar: UvCircle;`, acrescente `raglan: UvRaglan;`.

Troque `function rect(` por `export function rect(` e, depois dela, acrescente:

```ts
// Pares "x y" em pixels da textura, separados por vírgula, como na spec da 4c (seção 4.1): uma string só, para o Prettier não quebrar um número por linha.
export function points(pixels: string): UvPoint[] {
  return pixels.split(",").map((pair) => {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    return { x: x! / FM26_TEXTURE_SIZE, y: y! / FM26_TEXTURE_SIZE };
  });
}

// Espelho em x = 512: o centro das asas (242 + 782 = 1024) e da textura.
export function mirrorX(shape: readonly UvPoint[]): UvPoint[] {
  return shape.map(({ x, y }) => ({ x: 1 - x, y }));
}

export function outlineBounds(shape: readonly UvPoint[]): UvRect {
  const xs = shape.map(({ x }) => x);
  const ys = shape.map(({ y }) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}
```

Troque `RegionOptions` e `region` por:

```ts
interface RegionOptions {
  side?: "left" | "right";
  rotation?: 0 | 180;
  mirrored?: boolean;
  hem?: UvRect;
  outline?: UvPoint[];
}

function region(part: UvPart, area: UvRect, { side, rotation = 0, mirrored = false, hem, outline }: RegionOptions = {}): UvRegion {
  return {
    part,
    ...(side === undefined ? {} : { side }),
    rect: area,
    rotation,
    mirrored,
    ...(hem === undefined ? {} : { hem }),
    ...(outline === undefined ? {} : { outline }),
  };
}

// Medidos no blank_26_3d.psd (spec da 4c, seção 4.1) do lado direito do jogador (esquerda da textura); o outro lado é o espelho.
// Manga curta: borda externa, topo e base do retângulo e a cava da camada "sleeves I I".
const RIGHT_SLEEVE_OUTLINE = points("240 405, 380 405, 380 410.5, 395 426.5, 395 469.5, 393 486.5, 392 534.5, 390 560.5, 385 586.5, 386 677.5, 377 703.5, 369 714.5, 360 722.5, 360 725, 240 725");
// Costuras da raglan (camada "sleeves / \"), da cava ao centro: a de cima fica nas costas, a de baixo na frente. Param no eixo do espelho para o outro lado não sobrepor.
const RIGHT_RAGLAN_BACK_SEAM = points("380.5 410, 394.5 427, 396.5 485, 401.5 506, 407.5 520, 414.5 531, 429.5 545, 454.5 556, 469.5 559, 512 562");
const RIGHT_RAGLAN_FRONT_SEAM = points("380.5 700, 394.5 644, 404.5 625, 413.5 617, 428.5 610, 449.5 606, 512 604");
```

Em `FM26_KIT_LAYOUT.regions`, troque as duas linhas `region("sleeve", ...)` por (mantendo o comentário que as precede):

```ts
    // A ilha da manga curta entra na coluna até a cava (spec da 4c, seção 3): o contorno recorta, o retângulo continua sendo a base da vista.
    region("sleeve", rect(240, 405, 357, 725), { side: "right", outline: RIGHT_SLEEVE_OUTLINE }),
    region("sleeve", rect(668, 405, 785, 725), { side: "left", mirrored: true, outline: mirrorX(RIGHT_SLEEVE_OUTLINE) }),
```

Troque o comentário e a linha de `cuffs` por:

```ts
  // Punhos da manga curta e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento); os da manga comprida, da camada "sleeve end" do PSD, que a máscara não pinta.
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722), rect(1, 3, 26, 318), rect(998, 3, 1023, 318)],
```

E, depois da linha `collar: { ... },`, acrescente:

```ts
  raglan: {
    // Um polígono: costura de trás de um lado ao outro, desce pela asa esquerda do jogador e volta pela costura da frente; os fechamentos caem dentro das mangas, pintadas por cima.
    yoke: [...RIGHT_RAGLAN_BACK_SEAM, ...mirrorX(RIGHT_RAGLAN_BACK_SEAM).reverse(), ...mirrorX(RIGHT_RAGLAN_FRONT_SEAM), ...[...RIGHT_RAGLAN_FRONT_SEAM].reverse()],
    seams: [RIGHT_RAGLAN_BACK_SEAM, mirrorX(RIGHT_RAGLAN_BACK_SEAM), RIGHT_RAGLAN_FRONT_SEAM, mirrorX(RIGHT_RAGLAN_FRONT_SEAM)],
  },
```

- [ ] **Step 6: Implement the collar shapes**

Crie `src/fm26/collars.ts`:

```ts
import type { CollarStyle } from "../core/kit.js";
import { points, rect, type UvPoint, type UvRect } from "./layout.js";

export interface UvCollar {
  outer: UvPoint[];
  inner: UvPoint[];
  // Peça por cima das listras e sem listra, como no PSD.
  placket?: UvRect;
}

// Contornos das camadas "collar U", "collar V", "collar A1" (sem a carcela) e "collar A2" do blank_26_3d.psd (spec da 4c, seção 4.1).
export const FM26_COLLARS: Record<CollarStyle, UvCollar> = {
  round: {
    outer: points("561 597.5, 560 606, 556 618, 551 624, 551 626, 545 632, 531 640, 515 642, 498 640, 484 632, 478 626, 478 624, 473 618, 469 606, 468 597.5, 469 578, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 578"),
    inner: points("549 597.5, 548 604, 542 615, 538 618, 538 620, 533 625, 522 629, 515 629, 507.5 629, 496 625, 491 620, 491 618, 487 615, 481 604, 480 597.5, 479 582.5, 483 573, 486 570, 495 564, 514.5 563, 534 564, 543 570, 546 573, 550 582.5, 550 596"),
  },
  "v-neck": {
    outer: points("561 597.5, 558 612.5, 551 626, 535 640, 523 646, 515 652, 494 640, 478 626, 471 613, 468 597.5, 469 578, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 578"),
    inner: points("549 597.5, 548 604, 539 620, 527 630, 525 630, 521 634, 515 637, 508 634, 504 630, 502 630, 490 620, 481 604, 480 597.5, 479 582.5, 483 573, 486 570, 495 564, 514.5 563, 534 564, 543 570, 546 573, 550 582.5, 550 596"),
  },
  polo: {
    outer: points("561 597.5, 558 625, 553.5 638, 543.5 637, 524 630.5, 502.5 631, 493 635, 480 638, 475.5 638, 474 636.5, 471 625, 468 597, 468 583, 470 574.5, 475 565, 479 561, 486 557, 497.5 554, 523 553, 543 557, 553 564, 560 578"),
    inner: points("541 597.5, 536 612, 526 626, 525 631, 505 630, 505 627, 501 623, 492 604, 490 603, 489 597.5, 485 582, 488 577, 501 573, 525 572, 535 575, 539 579, 542 587.5"),
    placket: rect(505, 630, 525, 676),
  },
  "polo-v": {
    outer: points("562 597.5, 562 616.5, 560 631, 546 630, 535 640, 523 646, 515 652, 494 640, 483 630, 469 631, 467 616.5, 467 597.5, 469 577, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 577"),
    inner: points("540 597.5, 533 625, 515 637, 508 634, 496 625, 489 597.5, 486 582, 491 573, 495 571, 511 571, 514.5 570, 529.5 572, 539 579, 542 586"),
  },
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/fm26 && npm test && npm run typecheck`
Expected: PASS. O renderer 3D ainda não usa as formas novas, mas usa `cuffs`: os dois punhos da manga comprida já aparecem na textura (retângulos na cor do punho), o que não quebra nenhum teste atual.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/fm26/layout.ts src/fm26/collars.ts tests/fixtures/geometry.ts tests/fm26/layout.test.ts tests/fm26/collars.test.ts
git commit -m "feat: add the FM26 armhole, raglan, long-sleeve cuffs and collar shapes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cava, raglan e punhos na textura 3D

**Files:**
- Modify: `src/renderers/uv-mapping.ts`
- Modify: `src/renderers/renderer-3d.ts`
- Test: `tests/renderers/uv-mapping.test.ts`, `tests/renderers/renderer-3d.test.ts`

**Interfaces:**
- Consumes: `UvPoint`, `outlineBounds`, `UvRegion.outline`, `FM26_KIT_LAYOUT.raglan`, 4 `cuffs` (Task 6).
- Produces: `regionViews` das mangas curtas com retângulos que cobrem o contorno em x (240–395 e 629–785); no renderer, `shapePath(shape, closed)`, `cuffLine(cuff)` e `RegionSvg` usados pela Task 8.

Pontos (px da textura 1024): cava direita do jogador em x ≈ 395 (y 460) e ≈ 385,6 (y 650); espelho = `1023 − x` em índice de pixel. Raglan: (420, 580) e (603, 580) dentro, (420, 520) fora; em y 498, x 393–399,6 é raglan (a `shoulder-line` das costas cruza ali).

- [ ] **Step 1: Write the failing tests**

Em `tests/renderers/uv-mapping.test.ts`, troque o teste `"splits each sleeve into the upper and lower halves of its island"` por:

```ts
  // A manga curta passa da borda do retângulo até a cava: as metades cobrem o contorno inteiro em x, e o renderer recorta por ele.
  it("splits each sleeve into the upper and lower halves of its island, wide enough for the armhole", () => {
    for (const sleeve of SLEEVES) {
      const half = sleeve.rect.height / 2;
      const [left, right] =
        sleeve.outline === undefined ? [sleeve.rect.x, sleeve.rect.x + sleeve.rect.width] : sleeve.side === "right" ? [240 / T, 395 / T] : [629 / T, 785 / T];
      const span = { x: left, width: right - left };
      expect(regionViews(sleeve).map((view) => view.rects)).toEqual([
        [{ ...span, y: sleeve.rect.y, height: half }],
        [{ ...span, y: sleeve.rect.y + half, height: half }],
      ]);
    }
  });
```

Em `tests/renderers/renderer-3d.test.ts`:

1. Troque o teste `"ignores the collar style and the raglan cut, left to Phase 4"` por:

```ts
  it("ignores the collar style, left to the collar shapes", () => {
    const plain = renderKit3dSvg(makeKit());
    for (const style of ["v-neck", "polo", "polo-v"] as const) expect(renderKit3dSvg(makeKit({ collar: { style, color: "accent" } }))).toBe(plain);
  });

  it("draws the raglan yoke and seams only on raglan sleeves", () => {
    const raglan = renderKit3dSvg(makeKit({ sleeves: { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" } }));
    expect(raglan).toContain('<clipPath id="raglan">');
    expect(raglan).toContain('stroke-opacity="0.2"');
    const setIn = renderKit3dSvg(makeKit());
    expect(setIn).not.toContain('<clipPath id="raglan">');
    expect(setIn).not.toContain('stroke-opacity="0.2"');
  });
```

2. Em `"paints every part with its color"`, depois de `["left cuff", 768, 560, ACCENT],`, acrescente:

```ts
      ["right long cuff", 13, 150, ACCENT],
      ["left long cuff", 1010, 150, ACCENT],
```

3. No teste `"mirrors the front onto the back across y = 569 with %s"`, troque o laço por:

```ts
    // A ilha da manga curta entra na coluna até a cava (x < 396 e x ≥ 628 entre y 405 e 725): ali não há tronco.
    const inWing = (x: number, y: number) => y >= 405 && y < 726 && (x < 396 || x >= 628);
    // Começa abaixo do anel da gola (y ≤ 640), que só existe de um lado da reflexão.
    for (let y = 645; y < 1000; y += 13) {
      for (let x = 362; x < 664; x += 11) {
        if (inWing(x, y) || inWing(x, 1137 - y)) continue;
        const front = pixel(texture, x, y);
        colors.add(front.join());
        expect(channelDistance(front, pixel(texture, x, 1137 - y)), `${x},${y}`).toBeLessThanOrEqual(32);
      }
    }
```

4. No teste `"runs match-body stripes from the shoulder to the cuff"`, troque o laço por:

```ts
    for (let y = 410; y < 720; y += 5) {
      const shoulder = pixel(texture, 350, y);
      expect(pixel(texture, 280, y), `y ${y}`).toEqual(shoulder);
      // A faixa da cava continua a manga (x 375 fica dentro dela até y ≈ 690).
      if (y < 680) expect(pixel(texture, 375, y), `armhole y ${y}`).toEqual(shoulder);
      colors.add(shoulder.join());
    }
```

5. No fim de `describe("renderKit3dPng", ...)`, acrescente:

```ts
  // Regressão da cava: antes da 4c, a faixa entre x 357 e a cava saía com o padrão do tronco.
  it("paints the armhole strip with the sleeve color", async () => {
    const texture = await raster(await renderKit3dPng(makeKit({ sleeves: { style: "solid", color: "accent", cuffColor: "secondary" } })));
    for (const [x, y] of [
      [375, 460],
      [375, 650],
      [648, 460],
      [648, 650],
    ] as const) {
      expect(pixel(texture, x, y), `${x},${y}`).toEqual(ACCENT);
    }
    expect(pixel(texture, 400, 460)).toEqual(PRIMARY);
    expect(pixel(texture, 623, 460)).toEqual(PRIMARY);
  });

  it("paints the raglan yoke with the solid sleeve color, and only on raglan sleeves", async () => {
    const sleeves = (cut: "set-in" | "raglan") => makeKit({ sleeves: { style: "solid", cut, color: "accent", cuffColor: "secondary" } });
    const raglan = await raster(await renderKit3dPng(sleeves("raglan")));
    const setIn = await raster(await renderKit3dPng(sleeves("set-in")));
    for (const [x, y] of [
      [420, 580],
      [603, 580],
    ] as const) {
      expect(pixel(raglan, x, y), `raglan ${x},${y}`).toEqual(ACCENT);
      expect(pixel(setIn, x, y), `set-in ${x},${y}`).toEqual(PRIMARY);
    }
    expect(pixel(raglan, 420, 520)).toEqual(PRIMARY);
  });

  // Como os triângulos da raglan no 2D: a manga match-body leva o padrão do corpo para o ombro, sem as camadas.
  it("keeps the detail layers off the raglan yoke of match-body sleeves", async () => {
    const kit = (cut: "set-in" | "raglan") =>
      makeKit({
        layers: [{ id: "shoulder-line", color: "accent", params: {} }],
        collar: { style: "round", color: "secondary" },
        sleeves: { style: "match-body", cut, color: "secondary", cuffColor: "secondary" },
      });
    const raglan = await raster(await renderKit3dPng(kit("raglan")));
    const setIn = await raster(await renderKit3dPng(kit("set-in")));
    expect(pixel(setIn, 397, 498)).toEqual(ACCENT);
    expect(pixel(raglan, 397, 498)).toEqual(PRIMARY);
    expect(pixel(raglan, 420, 498)).toEqual(ACCENT);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderers/uv-mapping.test.ts tests/renderers/renderer-3d.test.ts`
Expected: FAIL (metades estreitas, faixa da cava com o tronco, sem raglan; os punhos da manga comprida já passam desde a Task 6).

- [ ] **Step 3: Widen the sleeve halves**

Em `src/renderers/uv-mapping.ts`, troque o import do layout por:

```ts
import { FM26_KIT_LAYOUT, outlineBounds, type UvRect, type UvRegion } from "../fm26/layout.js";
```

Antes de `regionViews`, acrescente:

```ts
// A manga curta entra na coluna até a cava: as metades cobrem o contorno inteiro em x, e o renderer recorta por ele.
function sleeveSpan(region: UvRegion): { x: number; width: number } {
  if (region.outline === undefined) return { x: region.rect.x, width: region.rect.width };
  const bounds = outlineBounds(region.outline);
  const left = Math.min(region.rect.x, bounds.x);
  return { x: left, width: Math.max(region.rect.x + region.rect.width, bounds.x + bounds.width) - left };
}
```

No `case "sleeve": case "longSleeve":` de `regionViews`, troque o `return [...]` por:

```ts
      const span = sleeveSpan(region);

      return [
        { rects: [{ ...span, y: region.rect.y, height: half }], transform: compose(place, upper) },
        { rects: [{ ...span, y: region.rect.y + half, height: half }], transform: compose(place, lower) },
      ];
```

- [ ] **Step 4: Paint the armhole, the raglan and the cuffs**

Substitua `src/renderers/renderer-3d.ts` inteiro por:

```ts
import sharp from "sharp";
import { sleeveCut, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvPoint, type UvRect, type UvRegion } from "../fm26/layout.js";
import { fillSvg, kitDesign, type KitDesign, type KitFill } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import { SHIRT_2D_VIEWBOX } from "./shirt-2d-shape.js";
import { affineSvg, frontLogoBox, regionViews, torsoScale } from "./uv-mapping.js";

export const KIT_3D_SIZE = FM26_TEXTURE_SIZE;
// Traço do contorno dos logos no viewBox 414 do 2D; no 3D acompanha a escala vertical da frente.
const OUTLINE_WIDTH = 2;
// Costura da raglan como a camada "lines" do PSD: preto com opacidade 51/255.
const SEAM_STROKE = 'fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="2"';

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

function shapePath(shape: readonly UvPoint[], closed: boolean): string {
  const size = FM26_TEXTURE_SIZE;
  return `M${shape.map(({ x, y }) => `${x * size} ${y * size}`).join(" L")}${closed ? " Z" : ""}`;
}

function baseColor(fill: KitFill): string {
  return fill.kind === "solid" ? fill.color : fill.base;
}

function isTorso(region: UvRegion): boolean {
  return region.part === "front" || region.part === "back";
}

// A manga curta é o contorno até a cava; as outras regiões, o retângulo.
function solidRegion(region: UvRegion, color: string): RegionSvg {
  return { body: region.outline ? `<path d="${shapePath(region.outline, true)}" fill="${color}"/>` : `<rect ${rectAttributes(region.rect)} fill="${color}"/>` };
}

// O padrão é desenhado no espaço 414 do 2D e levado a cada pedaço da ilha pela transformação da vista; o recorte do tronco inclui a barra, e o da manga curta passa pelo contorno da cava.
function patternRegion(region: UvRegion, id: string, fill: KitFill, layers: KitDesign["bodyLayers"]): RegionSvg {
  const pattern = fillSvg(fill, SHIRT_2D_VIEWBOX, SHIRT_2D_VIEWBOX, layers);
  const views = regionViews(region).map((view, index) => ({ ...view, id: `${id}-${index}` }));
  const clip = views.map((view) => `<clipPath id="${view.id}">${view.rects.map((rect) => `<rect ${rectAttributes(rect)}/>`).join("")}</clipPath>`).join("");
  const body = views.map((view) => `<g clip-path="url(#${view.id})"><g transform="${affineSvg(view.transform)}">${pattern}</g></g>`).join("");
  if (!region.outline) return { clip, body };

  return { clip: `${clip}<clipPath id="${id}-outline"><path d="${shapePath(region.outline, true)}"/></clipPath>`, body: `<g clip-path="url(#${id}-outline)">${body}</g>` };
}

function regionSvg(region: UvRegion, id: string, design: KitDesign): RegionSvg {
  switch (region.part) {
    case "front":
    case "back":
      return patternRegion(region, id, design.body, design.bodyLayers);
    case "sleeve":
    case "longSleeve":
      // Como no 2D, a manga match-body recebe só o padrão principal.
      return design.sleeves.kind === "solid" ? solidRegion(region, design.sleeves.color) : patternRegion(region, id, design.sleeves, []);
    case "shorts":
      return solidRegion(region, design.shorts);
    case "sock":
      return solidRegion(region, design.socks);
  }
}

// A manga raglan avança sobre os ombros; na match-body o padrão vem das vistas do tronco, sem camadas, como os triângulos da raglan no 2D.
function raglanSvg(design: KitDesign): RegionSvg {
  const yoke = shapePath(FM26_KIT_LAYOUT.raglan.yoke, true);
  if (design.sleeves.kind === "solid") return { body: `<path d="${yoke}" fill="${design.sleeves.color}"/>` };
  const torso = FM26_KIT_LAYOUT.regions.filter(isTorso).map((region, index) => patternRegion(region, `raglan-${index}`, design.sleeves, []));

  return {
    clip: `<clipPath id="raglan"><path d="${yoke}"/></clipPath>${torso.map((part) => part.clip ?? "").join("")}`,
    body: `<g clip-path="url(#raglan)">${torso.map((part) => part.body).join("")}</g>`,
  };
}

// Traço na linha central do lado comprido, pontas butt: cobre o mesmo retângulo, e as listras viram traços concêntricos.
function cuffLine(cuff: UvRect): { d: string; width: number } {
  const size = FM26_TEXTURE_SIZE;
  const [x, y, width, height] = [cuff.x * size, cuff.y * size, cuff.width * size, cuff.height * size];
  if (height >= width) return { d: `M${x + width / 2} ${y} L${x + width / 2} ${y + height}`, width };
  return { d: `M${x} ${y + height / 2} L${x + width} ${y + height / 2}`, width: height };
}

function cuffSvg(cuff: UvRect, design: KitDesign): string {
  const { d, width } = cuffLine(cuff);
  return `<path d="${d}" fill="none" stroke="${design.cuffs}" stroke-width="${width}"/>`;
}

export function renderKit3dSvg(kit: KitDefinition, options: Render3dOptions = {}): string {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = FM26_TEXTURE_SIZE;
  const design = kitDesign(kit);
  const { regions, cuffs, collar, raglan } = FM26_KIT_LAYOUT;
  const raglanCut = sleeveCut(kit) === "raglan";
  const drawn = regions.map((region, index) => ({ region, svg: regionSvg(region, `region-${index}`, design) }));
  // A raglan fica entre o tronco e as mangas: a manga curta, recortada pela cava, cobre a sobreposição.
  const parts = [
    ...drawn.filter(({ region }) => isTorso(region)).map(({ svg }) => svg),
    ...(raglanCut ? [raglanSvg(design)] : []),
    ...drawn.filter(({ region }) => !isTorso(region)).map(({ svg }) => svg),
  ];
  const ring = { cx: collar.cx * texture, cy: collar.cy * texture, r: ((collar.innerRadius + collar.outerRadius) / 2) * texture };
  const ringWidth = (collar.outerRadius - collar.innerRadius) * texture;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${parts.map((part) => part.clip ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...(raglanCut ? raglan.seams.map((seam) => `<path d="${shapePath(seam, false)}" ${SEAM_STROKE}/>`) : []),
    ...cuffs.map((cuff) => cuffSvg(cuff, design)),
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/renderers && npm test && npm run typecheck`
Expected: PASS. Se `"keeps the detail layers off the raglan yoke"` falhar em (397, 498), confira a altura da `shoulder-line` nas costas olhando (400, 498), que o teste `"draws the detail layers on the front and the back"` já fixa como ACCENT; a âncora precisa ficar entre a cava (x ≈ 392,7) e a costura (x ≈ 399,6).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/uv-mapping.ts src/renderers/renderer-3d.ts tests/renderers/uv-mapping.test.ts tests/renderers/renderer-3d.test.ts
git commit -m "feat: paint the armhole, the raglan yoke and the long-sleeve cuffs on the 3D texture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Golas e listras na textura 3D

**Files:**
- Modify: `src/renderers/renderer-3d.ts`
- Modify: `src/fm26/layout.ts` (sai `UvCircle` e `collar`)
- Test: `tests/renderers/renderer-3d.test.ts`, `tests/fm26/layout.test.ts`

**Interfaces:**
- Consumes: `FM26_COLLARS` (Task 6), `edgeStripeStrokes`, `centeredStripeStrokes`, `stripeStrokesSvg` (Task 4), `cuffLine`, `shapePath`, `rectAttributes`, `RegionSvg` (Task 7).
- Produces: textura final da 4c; `Fm26KitLayout` sem `collar`.

Âncoras (px da textura): banda U em y 597 começa na borda externa x 468; listras da gola medidas dela (`single` 3,75–6,25; `double` 1–3 e 7–9). Punho da manga curta direita x 244–270 (`single` 253,75–260,25; `double` 246,6–251,8 e 262,2–267,4); punho da manga comprida direita x 1–26 (`single` 10,4–16,6).

- [ ] **Step 1: Write the failing tests**

Em `tests/renderers/renderer-3d.test.ts`, troque o teste `"ignores the collar style, left to the collar shapes"` (criado na Task 7) por:

```ts
  it("draws the collar clip and the stripes only on striped kits, with the placket last", () => {
    expect(renderKit3dSvg(makeKit())).not.toContain('<clipPath id="collar">');
    const svg = renderKit3dSvg(makeKit({ collar: { style: "polo", color: "accent" }, trimStripe: { style: "double", color: "secondary" } }));
    expect(svg).toContain('<clipPath id="collar">');
    expect(svg.lastIndexOf('<rect x="505" y="630" width="20" height="46"')).toBeGreaterThan(svg.indexOf('clip-path="url(#collar)"'));
  });
```

E acrescente no fim de `describe("renderKit3dPng", ...)`:

```ts
  // Âncoras medidas no PSD (spec da 4c, seção 4.2); o miolo da gola mostra o tronco.
  it.each([
    ["round", [474, 597], [514, 557], [514, 635]],
    ["v-neck", [474, 597], [514, 645]],
    ["polo", [480, 634], [514, 660]],
    ["polo-v", [475, 628], [514, 648]],
  ] as const)("draws the %s collar", async (style, ...anchors) => {
    const texture = await raster(await renderKit3dPng(makeKit({ collar: { style, color: "accent" } })));
    for (const [x, y] of anchors) expect(pixel(texture, x, y), `${x},${y}`).toEqual(ACCENT);
    expect(pixel(texture, 514, 597)).toEqual(PRIMARY);
  });

  it("stops the round collar above the point of the v-neck", async () => {
    expect(pixel(await raster(await renderKit3dPng(makeKit())), 514, 648)).toEqual(PRIMARY);
  });

  const stripedKit = (style: "single" | "double") =>
    makeKit({ collar: { style: "round", color: "accent" }, sleeves: { style: "solid", color: "secondary", cuffColor: "accent" }, trimStripe: { style, color: "secondary" } });

  it("draws the collar stripes from the outer edge of the collar", async () => {
    const single = await raster(await renderKit3dPng(stripedKit("single")));
    expect(pixel(single, 473, 597)).toEqual(SECONDARY);
    for (const x of [469, 477]) expect(pixel(single, x, 597), `x ${x}`).toEqual(ACCENT);
    const double = await raster(await renderKit3dPng(stripedKit("double")));
    for (const x of [469, 470, 475]) expect(pixel(double, x, 597), `x ${x}`).toEqual(SECONDARY);
    for (const x of [473, 479]) expect(pixel(double, x, 597), `x ${x}`).toEqual(ACCENT);
  });

  it("draws the stripes on the short-sleeve and the long-sleeve cuffs", async () => {
    const single = await raster(await renderKit3dPng(stripedKit("single")));
    expect(pixel(single, 257, 560)).toEqual(SECONDARY);
    expect(pixel(single, 246, 560)).toEqual(ACCENT);
    expect(pixel(single, 13, 150)).toEqual(SECONDARY);
    expect(pixel(single, 3, 150)).toEqual(ACCENT);
    const double = await raster(await renderKit3dPng(stripedKit("double")));
    for (const x of [248, 264]) expect(pixel(double, x, 560), `x ${x}`).toEqual(SECONDARY);
    expect(pixel(double, 257, 560)).toEqual(ACCENT);
  });

  it("scales the stripes with the texture size", async () => {
    const texture = await raster(await renderKit3dPng(stripedKit("single"), { size: 512 }));
    expect(pixel(texture, 128, 280)).toEqual(SECONDARY);
  });
```

Em `tests/fm26/layout.test.ts`, apague o teste `"keeps the collar ring inside the texture"` e troque o teste `"puts the short-sleeve cuffs and the collar ring on the trim color of the FM mask 01-0"` por:

```ts
  it("puts the short-sleeve cuffs on the trim color of the FM mask 01-0", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "01-0.png"));
    const shortSleeveCuffs = FM26_KIT_LAYOUT.cuffs.filter((cuff) => FM26_KIT_LAYOUT.regions.some((region) => region.part === "sleeve" && overlaps(cuff, region.rect)));
    expect(shortSleeveCuffs).toHaveLength(2);
    for (const cuff of shortSleeveCuffs) expect(isTrimBlue(pixel(...centerPixel(cuff)))).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderers/renderer-3d.test.ts`
Expected: FAIL nos testes de gola por estilo, listras e clip da gola (o anel ainda é igual para todo estilo).

- [ ] **Step 3: Draw the collars and the stripes**

Em `src/renderers/renderer-3d.ts`:

Troque os imports do topo por:

```ts
import sharp from "sharp";
import { sleeveCut, type CollarStyle, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { FM26_COLLARS } from "../fm26/collars.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvPoint, type UvRect, type UvRegion } from "../fm26/layout.js";
import { fillSvg, kitDesign, type KitDesign, type KitFill } from "./kit-design.js";
import { kitLogoLayers, type KitLogoImages } from "./kit-logos.js";
import type { PixelBox } from "./logo-image.js";
import { SHIRT_2D_VIEWBOX } from "./shirt-2d-shape.js";
import { centeredStripeStrokes, edgeStripeStrokes, stripeStrokesSvg } from "./trim-stripes.js";
import { affineSvg, frontLogoBox, regionViews, torsoScale } from "./uv-mapping.js";
```

Depois de `SEAM_STROKE`, acrescente:

```ts
// Profundidade nominal das listras da gola, medidas a partir da borda externa: a banda mais estreita das golas U e V, nas costas, tem 10 px.
const COLLAR_STRIPE_WIDTH = 10;
```

Troque `cuffSvg` por:

```ts
function cuffSvg(cuff: UvRect, design: KitDesign): string {
  const { d, width } = cuffLine(cuff);
  const stripe = design.trimStripe;
  const stripes = stripe === undefined ? "" : stripeStrokesSvg(d, centeredStripeStrokes(width, stripe.style), { stripe: stripe.color, trim: design.cuffs });
  return `<path d="${d}" fill="none" stroke="${design.cuffs}" stroke-width="${width}"/>${stripes}`;
}

// Banda entre os contornos externo e interno; as listras traçam o contorno externo recortadas pela banda, e a carcela vem por último, como no PSD.
function collarSvg(style: CollarStyle, design: KitDesign): RegionSvg {
  const shape = FM26_COLLARS[style];
  const outer = shapePath(shape.outer, true);
  const band = `${outer} ${shapePath(shape.inner, true)}`;
  const placket = shape.placket ? `<rect ${rectAttributes(shape.placket)} fill="${design.collar}"/>` : "";
  const fill = `<path d="${band}" fill="${design.collar}" fill-rule="evenodd"/>`;
  const stripe = design.trimStripe;
  if (stripe === undefined) return { body: `${fill}${placket}` };
  const strokes = edgeStripeStrokes(COLLAR_STRIPE_WIDTH, stripe.style);

  return {
    clip: `<clipPath id="collar"><path d="${band}" clip-rule="evenodd"/></clipPath>`,
    body: `${fill}<g clip-path="url(#collar)">${stripeStrokesSvg(outer, strokes, { stripe: stripe.color, trim: design.collar }, ' stroke-linejoin="round"')}</g>${placket}`,
  };
}
```

Troque `renderKit3dSvg` por:

```ts
export function renderKit3dSvg(kit: KitDefinition, options: Render3dOptions = {}): string {
  const size = options.size ?? KIT_3D_SIZE;
  const texture = FM26_TEXTURE_SIZE;
  const design = kitDesign(kit);
  const { regions, cuffs, raglan } = FM26_KIT_LAYOUT;
  const raglanCut = sleeveCut(kit) === "raglan";
  const drawn = regions.map((region, index) => ({ region, svg: regionSvg(region, `region-${index}`, design) }));
  // A raglan fica entre o tronco e as mangas: a manga curta, recortada pela cava, cobre a sobreposição.
  const parts = [
    ...drawn.filter(({ region }) => isTorso(region)).map(({ svg }) => svg),
    ...(raglanCut ? [raglanSvg(design)] : []),
    ...drawn.filter(({ region }) => !isTorso(region)).map(({ svg }) => svg),
  ];
  const collar = collarSvg(kit.collar.style, design);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${texture} ${texture}">`,
    `<defs>${[...parts, collar].map((part) => part.clip ?? "").join("")}</defs>`,
    // Fundo opaco na cor base do corpo, como as máscaras do FM: o jogo pode amostrar além das ilhas nas bordas.
    `<rect width="${texture}" height="${texture}" fill="${baseColor(design.body)}"/>`,
    ...parts.map((part) => part.body),
    ...(raglanCut ? raglan.seams.map((seam) => `<path d="${shapePath(seam, false)}" ${SEAM_STROKE}/>`) : []),
    ...cuffs.map((cuff) => cuffSvg(cuff, design)),
    collar.body,
    "</svg>",
  ].join("");
}
```

- [ ] **Step 4: Remove the collar ring from the layout**

Em `src/fm26/layout.ts`, apague a interface `UvCircle`, a linha `collar: UvCircle;` de `Fm26KitLayout` e a linha `collar: { cx: ..., ... },` de `FM26_KIT_LAYOUT`. Troque o comentário dos punhos por:

```ts
  // Punhos da manga curta vêm da máscara 01-0 do próprio FM (cor 3, acabamento); os da manga comprida, da camada "sleeve end" do PSD, que a máscara não pinta.
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS. `"paints every part with its color"` continua com a gola em (549, 597) e (477, 597): as duas ficam na banda U. Se um pixel de listra sair misturado, confira a distância até a borda externa (x 468 em y 597; punho a partir de x 244) antes de mudar a âncora; nunca mude as faixas.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/renderers/renderer-3d.ts src/fm26/layout.ts tests/renderers/renderer-3d.test.ts tests/fm26/layout.test.ts
git commit -m "feat: draw the FM26 collar shapes and the trim stripes on the 3D texture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação, inspeção visual e documentação

**Files:**
- Create: `output/4c-samples/render-samples.ts` (descartável; `output/` é ignorado pelo git e pelo Prettier)
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run every gate**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde. Anote o número de testes (linha de base: 762).

- [ ] **Step 2: Render the samples**

Crie `output/4c-samples/render-samples.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { COLLAR_STYLES, SLEEVE_CUTS, TRIM_STRIPE_STYLES, type KitDefinition } from "../../src/core/kit.js";
import { renderKit2dPng } from "../../src/renderers/renderer-2d.js";
import { renderKit3dPng } from "../../src/renderers/renderer-3d.js";

const base = (): KitDefinition => ({
  clubId: "galaticos-fc",
  kitType: "home",
  colors: { primary: "#191970", secondary: "#ffffff", accent: "#d4af37" },
  pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } },
  collar: { style: "round", color: "accent" },
  sleeves: { style: "solid", color: "secondary", cuffColor: "accent" },
  shorts: { color: "primary" },
  socks: { color: "primary" },
});

for (const style of COLLAR_STYLES) {
  for (const cut of SLEEVE_CUTS) {
    for (const stripe of ["none", ...TRIM_STRIPE_STYLES] as const) {
      const kit = base();
      kit.collar.style = style;
      kit.sleeves.cut = cut;
      if (stripe !== "none") kit.trimStripe = { style: stripe, color: "primary" };
      const name = `${style}_${cut}_${stripe}`;
      await writeFile(new URL(`${name}_2d.png`, import.meta.url), await renderKit2dPng(kit));
      await writeFile(new URL(`${name}_3d.png`, import.meta.url), await renderKit3dPng(kit));
    }
  }
}

const matchBody = base();
matchBody.sleeves = { style: "match-body", cut: "raglan", color: "secondary", cuffColor: "accent" };
await writeFile(new URL("match-body_raglan_3d.png", import.meta.url), await renderKit3dPng(matchBody));
```

Run: `npx tsx output/4c-samples/render-samples.ts && ls output/4c-samples | wc -l`
Expected: 49 PNGs mais o script (50).

- [ ] **Step 3: Inspect the samples**

Abra (ferramenta de leitura de imagem) pelo menos: `round_set-in_none_3d.png`, `v-neck_raglan_single_3d.png`, `polo_set-in_double_3d.png`, `polo-v_raglan_double_3d.png`, `match-body_raglan_3d.png`, `polo_set-in_double_2d.png`, `round_set-in_single_2d.png`, `polo-v_set-in_double_2d.png`. Confira:
- 3D: manga curta branca até a cava, sem faixa azul do tronco junto à coluna; ombros brancos só na raglan, com costura fina; gola com a forma do estilo (ponta na V e na A2, carcela na A1); listras junto à borda externa da gola e ao longo dos quatro punhos; punho dourado na ponta da manga comprida.
- 2D: listra no meio do decote (`single`) e duas listras (`double`); acabamento nas abas da polo, carcela lisa por cima; punhos listrados; caixas de logo limpas.

Depois rode o preview de um clube `retro` com amostras: `npm run kit-generator -- preview --club minecraft --samples 24` e abra `output/kit_preview.html` (ou leia os PNGs base64 pelo navegador do usuário). Confira que alguns kits mostram `trim stripe ...` nos detalhes e as listras no desenho.

Registre na resposta ao usuário o que foi visto. Problema visual vira correção em uma task nova antes de seguir, nunca ajuste silencioso.

- [ ] **Step 4: Update the roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. No parágrafo de "Planos detalhados" do topo, depois da referência da Fase 3c, acrescente: `, Fase 4c (spec docs/superpowers/specs/2026-10-14-fase-4c-componentes-3d-design.md, plano docs/superpowers/plans/2026-10-14-fase-4c-componentes-3d.md)` (com crases nos caminhos, como nas outras).
2. Na tabela de status, troque a linha `| 4 — Componentes FM26 e acabamento 3D | Pendente |` por:

```markdown
| 4c — Golas, raglan e listras de acabamento no 3D | **Concluída** (<data>, `dev` @ `<hash do último commit de código>`, <N> testes). Cava real da manga curta, golas U/V/A1/A2, raglan e punhos da manga comprida na textura; listras `single`/`double` casadas na gola e nos punhos, no 2D e no 3D. Teste no jogo pendente |
| 4d — `fabric texture` e `mesh` | Pendente |
| 4e — Padrões por máscara FM26 | Adiada até avaliar a 4c e a 4d no jogo |
```

3. Troque o parágrafo "Próximo passo: ..." por: `Próximo passo: teste da 4c no jogo (seção 11 da spec da 4c) e depois a Fase 4d (fabric texture e mesh), com superpowers:brainstorming e superpowers:writing-plans.`
4. Em "Limitações atuais (por desenho)", troque `a textura 3D ignora o estilo de gola e o corte raglan e não tem fabric/mesh (Fase 4).` por `a textura 3D não tem fabric/mesh (Fase 4d) nem contorno e sombra de gola.`
5. Na seção "Fase 4", item 1, acrescente ao fim: ` **Concluído na 4c:** golas e raglan no 3D, listras de gola e punho (casadas, \`single\`/\`double\`) e a cava real da manga curta.` Item 2: acrescente ` Vira a Fase 4d.` Item 3: acrescente ` Vira a Fase 4e, adiada.`

- [ ] **Step 5: Update CLAUDE.md**

Em `CLAUDE.md`:

1. "Visão geral": troque o trecho `Estado atual: Fase 3c concluída e testada no jogo em 2026-10-10 (...); a próxima é a Fase 4 (componentes FM26 e acabamento 3D).` para começar com `Estado atual: Fase 4c concluída (golas U/V/A1/A2, raglan, cava real da manga curta e punhos da manga comprida na textura 3D; listras de acabamento casadas na gola e nos punhos, no 2D e no 3D), teste no jogo pendente; antes dela, a Fase 3c ...` mantendo o resto da frase da 3c, e termine com `a próxima é a Fase 4d (fabric texture e mesh).`
2. Bullet `src/core`: depois de `MAX_LAYERS`/`KitLayer` (...), acrescente `e TRIM_STRIPE_STYLES`/`KitTrimStripe` (`trimStripe` ausente = sem listra; uma listra para gola e punhos)`.
3. Bullet `src/core/validation.ts`: em `validateKit`, acrescente a regra `trim-stripe-color` (listra na cor da gola ou do punho); em `validateKitTraditions`, `required-color` conta também a listra.
4. Bullet `src/generator/kit-generator.ts`: troque `e as camadas são o último sorteio (...)` por `as camadas vêm depois (...) e a listra de acabamento é o último sorteio (`trimStripeCandidates`; se sair, cor por `rng.pick` entre os papéis que nem a gola nem o punho usam), gravada em `trimStripe` só quando sai`, mantendo o conteúdo dos parênteses das camadas.
5. Bullet `src/styles`: acrescente `trimStripeWeights` (chaves de `TRIM_STRIPE_OPTIONS`, `none`/`single`/`double`) à lista de tabelas de `profiles.ts` e `trimStripeCandidates` em `component-weights.ts`.
6. Bullet `src/renderers/kit-design.ts`: acrescente `e a listra (`trimStripe`, ausente sem listra)`. Acrescente um bullet: `` `src/renderers/trim-stripes.ts`: puro; faixas de cada estilo em fração da largura da peça (`single` 0,375–0,625; `double` 0,1–0,3 e 0,7–0,9) e dois modos: `centeredStripeStrokes` (peça desenhada como traço: gola e punhos do 2D, punhos do 3D) e `edgeStripeStrokes` (peça preenchida recortada por ela mesma: abas das polo no 2D, gola do 3D). ``
7. Bullet `src/fm26/layout.ts`: acrescente `as regiões `sleeve` têm `outline` (a manga curta entra na coluna até a cava, medida no PSD e confirmada pela máscara 02-0), `cuffs` tem os punhos da manga curta e os da manga comprida, `raglan` tem o recorte dos ombros e as costuras; `points`, `mirrorX` (espelho em x = 512) e `outlineBounds` montam esses dados; a gola saiu do layout`. Acrescente um bullet: `` `src/fm26/collars.ts`: `FM26_COLLARS`, contornos externo e interno das golas U (`round`), V (`v-neck`), A1 (`polo`, com carcela) e A2 (`polo-v`) medidos no `blank_26_3d.psd`. ``
8. Bullet `src/renderers/uv-mapping.ts`: acrescente `as metades da manga curta cobrem o contorno da cava em x, e o renderer recorta por ele`.
9. Bullet `src/renderers/renderer-3d.ts`: troque `mangas `solid` como retângulo e `match-body` com o padrão sem camadas; punhos só nas asas; anel da gola; ... Estilo de gola e corte raglan não mudam a textura (Fase 4).` por `ordem: tronco, raglan (só no corte raglan; lisa ou padrão do corpo sem camadas pelas vistas do tronco), mangas (a curta recortada pela cava), costuras da raglan, punhos (traço na linha central, os quatro) e gola (forma do estilo, listras da borda externa, carcela por cima); calção e meias lisos; logos só na frente.`
10. Bullet `src/renderers` (shirt-2d-shape): acrescente `as golas polo têm `flaps` e `placket` (com listra, a carcela é redesenhada por cima do acabamento das abas) e, com listra, o contorno da silhueta não passa pelo decote`.
11. "Convenções e armadilhas", primeiro bullet: troque `A guarda do clube `branded` (`modern`) muda de propósito quando os pesos de gola, manga ou camada dos perfis mudam` por `A guarda do clube `branded` (`modern`) muda de propósito quando os pesos de gola, manga, camada ou listra dos perfis mudam` e acrescente ao fim: `` A 4c mudou o hash do `branded` só pela listra: um teste confere que, sem `trimStripe`, os conjuntos batem com o hash de antes. Clubes com categories ganham `trimStripe` num novo `generate` e mantêm o resto do kit para a mesma seed. ``
12. Bullet do 3D (`O 3D não tem sorteio próprio ...`): acrescente `As formas medidas no PSD (cava, raglan, golas, punhos da manga comprida) moram em `layout.ts` e `collars.ts`; o método de medição está na seção 4 da spec da 4c.`

- [ ] **Step 6: Check and commit the docs**

Run: `npm run format:check`
Expected: verde (docs e `*.md` ficam fora do Prettier).

```bash
git add docs/superpowers/plans/2026-10-01-roadmap.md CLAUDE.md
git commit -m "docs: document phase 4c

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Teste no jogo (usuário) e registro

**Files:**
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`

- [ ] **Step 1: Prepare the package**

Run: `npm run export`
Expected: `output/fm26_export/` com os PNGs 2D, as texturas 3D e o `config.xml` de todos os clubes. As golas, a raglan, a cava e os punhos da manga comprida já valem para os kits salvos. Para ver listras, o usuário regera os clubes que quiser com `npm run kit-generator -- generate --club <id> --seed <generatedWith.seed do kit.json>` e roda o `export` de novo (a mesma seed mantém o resto do kit se o `club.json`, pools de marcas incluídos, não mudou; o pool de patrocinadores mudou em `bce42f0`, então o patrocinador pode trocar).

- [ ] **Step 2: Hand the checklist to the user**

Peça ao usuário para instalar o pacote como na 3c e conferir no jogo:
1. Manga lisa de cor própria sem faixa da cor do corpo junto ao ombro.
2. Golas U, V, A1 (com carcela) e A2 no pescoço, sem emenda aparente nas costas.
3. Raglan com manga lisa e com `match-body`: ombro na cor da manga e costura do pescoço à axila.
4. Listras `single` e `double` na gola e nos punhos, na manga curta e na comprida.
5. Punho da manga comprida na ponta da manga.

- [ ] **Step 3: Record the result**

No roadmap, acrescente uma seção `**Teste da 4c (<data>).**` com o resultado item a item e atualize a linha da 4c na tabela de status (`Teste no jogo pendente` vira o resultado). Se algo falhar, registre a causa e abra uma correção (nova task ou plano curto) antes de começar a 4d.

```bash
git add docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: record the phase 4c in-game test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
