# Fase 2a — Conjunto Home/Away/Third e validação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kit-generator generate --club galaticos-fc --seed 42` gera Home, Away e Third com a mesma paleta, validados por regras determinísticas de coerência; `generate --all` e `validate` operam sobre todos os clubes de `clubs/`.

**Architecture:** `generateKitSet(identity, seed)` valida o clube, resolve uma paleta única (com retry por sub-seed `deriveSeed(seed, "palette:<n>")`) e gera cada kit com sua própria sub-seed (`deriveSeed(seed, kitType)`) e papéis de cor em ciclo. A validação (`src/core/validation.ts`) é pura e usada pelo generator e pelo comando `validate`. O repositório ganha `loadKit`/`listClubIds`, os caminhos de saída vão para `src/config/paths.ts`, e a CLI orquestra: renderiza todos os PNGs antes de gravar qualquer `kit.json`.

**Tech Stack:** Node.js 24 (mínimo 22.12), TypeScript strict (ESM, NodeNext), Zod 4, Color.js (`colorjs.io`, ΔE OKLab), Sharp, Vitest 5, tsx, Prettier 3.9.

**Spec:** `docs/superpowers/specs/2026-10-01-fase-2a-conjunto-kits-validacao-design.md` (leia antes de começar). Contexto: `fm26-procedural-kit-generator-guide.md` (seções 6–8, 20–21, 23) e `docs/superpowers/plans/2026-10-01-roadmap.md`.

## Global Constraints

- Node `>=22.12`; `"type": "module"`; TypeScript `strict`, `NodeNext`, `verbatimModuleSyntax` (`import type` para tipos); imports relativos com extensão `.js`.
- Aleatoriedade só via `Rng` (`src/core/random.ts`) e só no generator. Única exceção: `crypto.randomInt` no CLI para sortear a seed omitida (sempre impressa). Renderers e padrões nunca importam `random.ts`.
- Seed: inteiro de `0` a `4294967295`. Sub-seeds só via `deriveSeed(seed, label)` (FNV-1a 32 bits sobre `"<seed>:<label>"`).
- Cores sempre `#rrggbb` minúsculo. Distância de cor = ΔE OKLab (`colorDistance`); limite `MIN_COLOR_DISTANCE = 0.15`.
- Papéis por kit: Home base `primary`/overlay `secondary`; Away base `secondary`/overlay `accent`; Third base `accent`/overlay `primary`.
- Cobertura do overlay: `stripes.ratio` 0.2–0.4 (padrão 0.3); `sash.width` 30–100 (padrão 70).
- `MAX_PALETTE_ATTEMPTS = 20`. Pesos de padrão de `0` a `1_000_000`.
- Diretórios só em `src/config/paths.ts`; nomes de arquivo FM26 só em `src/fm26/naming.ts`; `KIT_TYPES`/`KitType`/`KitTypeSchema` só em `src/core/kit.ts`.
- `generate` renderiza todos os PNGs pedidos antes de gravar o primeiro `kit.json`, e imprime `Seed: <n> (<id>)` antes de qualquer efeito colateral.
- Mensagens exatas (testadas): `Club "<id>" is invalid:`, `Could not derive a valid palette for club "<id>" after 20 attempts:`, `Use either --club or --all, not both`, `Missing required option --club or --all`, `No clubs found in <dir>`, `Clubs directory not found: <dir>`, `Generated <ok> of <total> clubs`, `Sum of weights must be finite`, `OK <id> (<n> kits)`, `FAIL <id>`.
- Formatação: Prettier `printWidth: 160` decide as quebras; rode `npm run format` antes de cada commit. Interfaces ficam multilinha (decisão do usuário). Comentários em português, só para o "porquê".
- Nunca criar/editar arquivos com heredoc no Bash; usar Write/Edit. Nunca usar `cd`; os comandos abaixo rodam na raiz do projeto (diretório de trabalho da sessão).
- Commits em Conventional Commits, na branch `dev`, com o trailer de co-autoria do modelo que executa.
- Gate de cada tarefa: `npm test`, `npm run typecheck` e `npm run format:check` verdes antes do commit. `npm run build` também no fim das tarefas 1, 12, 13 e 14.

## Review Focus

1. `kit.json` da Fase 1 (sem `kitType`) ou editado à mão com schema inválido: `validate` e `render` devem falhar com mensagem que nomeia o arquivo, nunca com stack trace. Testes: Task 10 (`loadKit` "names the file when the content is invalid") e Task 13 (`invalid-file`).
2. Clube só com `primary` de luminosidade média (ex.: `#808080`, `#4682b4`): o accent derivado não pode cair no neutro igual à secondary; se cair, o retry da paleta resolve e os três kits continuam distintos. Testes: Task 5 (accent cromático) e Task 9 (propriedade "never produces an invalid kit or set").
3. `generate --all` com uma pasta de nome inválido (`Old Club`) ou `club.json` quebrado: só aquele clube falha, os outros são gerados, exit code 1 e resumo `Generated N of M clubs`. Testes: Task 12.
4. `kit.json` editado à mão com base igual ao overlay, cores quase iguais ou Away com a mesma base do Home: `validate` aponta a regra e o kit. Testes: Task 7 e Task 13.
5. `--type` inválido na CLI ou `kitType` fora de `home|away|third` vindo de código: erro `Invalid kit type`, nada gravado. Testes: Task 10 (`kitDefinitionPath`) e Task 12 (`--type fourth`).

---

## Estrutura de arquivos

```text
package.json, package-lock.json      Prettier, @types/node@^22, scripts format/format:check
.prettierrc.json, .prettierignore    novos
CLAUDE.md, README.md                 formatter (Task 1); documentação final (Task 14)
src/
  config/paths.ts            + OUTPUT_DIR, kitRenderPath
  core/random.ts             + deriveSeed, weighted rejeita soma não finita
  core/color.ts              + colorDistance (ΔE OKLab)
  core/palette.ts            deriveAccent tenta três luminosidades
  core/primitives.ts         + SeedSchema
  core/club.ts               teto de 1.000.000 por peso
  core/kit.ts                + KIT_TYPES, KitTypeSchema, kitType, generatedWith
  core/validation.ts         novo: regras de coerência
  patterns/stripes.ts        ratio 0.2–0.4
  patterns/sash.ts           width 30–100
  generator/kit-generator.ts generateKitSet, generatePalette, generateKit por tipo
  fm26/naming.ts             importa KitType de core/kit
  io/club-repository.ts      + listClubIds, loadKit; saveKit(kit, dir)
  cli/run-cli.ts             generate (--club/--all/--type), render, validate
clubs/galaticos-fc/kits/{home,away,third}/kit.json   regenerados com seed 42
tests/ (espelha src/) + tests/fixtures/temp.ts (novo) + tests/config/paths.test.ts (novo) + tests/core/validation.test.ts (novo)
```

---

### Task 1: Prettier e `@types/node@^22`

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `tests/core/random.test.ts:48-71`
- Modify: `CLAUDE.md` (linha do gate e linha de estilo)
- Reformat: todos os `.ts` e `.json` fora do `.prettierignore` (sem mudança de comportamento)

**Interfaces:**
- Consumes: nada.
- Produces: scripts `npm run format` e `npm run format:check`.

- [ ] **Step 1: Instalar dependências**

Run: `npm install --save-dev prettier@^3.9.9 @types/node@^22`
Expected: `package.json` com `"prettier": "^3.9.9"` e `"@types/node": "^22.x"` em `devDependencies`. Um aviso `npm warn install-scripts ... esbuild` pode aparecer; ignore (o `tsx` continua funcionando).

- [ ] **Step 2: Adicionar scripts em `package.json`**

Em `"scripts"`, logo após `"test": "vitest run",`:

```json
    "format": "prettier --write .",
    "format:check": "prettier --check .",
```

- [ ] **Step 3: Criar `.prettierrc.json`**

```json
{ "printWidth": 160 }
```

- [ ] **Step 4: Criar `.prettierignore`**

```text
dist
output
docs
*.md
package-lock.json
clubs/*/kits
```

`clubs/*/kits` fica fora porque esses arquivos são gerados por `JSON.stringify`, não pelo formatter.

- [ ] **Step 5: Deixar legíveis os dois testes de `rng.weighted`**

O Prettier quebra arrays de arrays em várias linhas; dentro de um `for` sem chaves isso fica ilegível. Em `tests/core/random.test.ts`, substitua os testes `"never picks zero-weight options"` e `"follows the configured weights"` por:

```ts
  it("never picks zero-weight options", () => {
    const rng = createRng(99);
    const entries = [
      ["a", 0],
      ["b", 1],
    ] as const;
    for (let i = 0; i < 1000; i++) expect(rng.weighted(entries)).toBe("b");
  });

  it("follows the configured weights", () => {
    const rng = createRng(2024);
    const entries = [
      ["a", 3],
      ["b", 1],
    ] as const;
    let hits = 0;
    for (let i = 0; i < 10_000; i++) if (rng.weighted(entries) === "a") hits++;
    expect(hits / 10_000).toBeCloseTo(0.75, 1);
  });
```

- [ ] **Step 6: Formatar o repositório**

Run: `npm run format`
Expected: cerca de 12 arquivos reescritos (`run-cli.ts`, `club.ts`, `palette.ts`, `sash.ts`, `stripes.ts`, `types.ts`, `renderer-2d.ts`, `shirt-2d-shape.ts` e quatro testes). Interfaces de uma linha viram multilinha; o typo `const length =(width + height) * 2;` de `src/patterns/sash.ts` vira `const length = (width + height) * 2;`.

- [ ] **Step 7: Atualizar `CLAUDE.md`**

Substitua a linha:

```markdown
Não há linter nem formatter configurados. Uma fase só avança com `npm test`, `npm run typecheck` e `npm run build` verdes e o PNG inspecionado visualmente.
```

por:

```markdown
Formatter: Prettier (`printWidth` 160; `npm run format` formata, `npm run format:check` confere). Não há linter. Uma fase só avança com `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes e os PNGs inspecionados visualmente.
```

E a última linha:

```markdown
- Código e comentários seguem o estilo do repositório: comentários em português, só para o "porquê"; declarações em uma linha (largura alvo 160 colunas).
```

por:

```markdown
- Código e comentários seguem o estilo do repositório: comentários em português, só para o "porquê"; declarações em uma linha quando couberem. O Prettier (largura 160) decide as quebras; interfaces ficam multilinha.
```

- [ ] **Step 8: Rodar o gate completo**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: 152 testes passando; typecheck e build sem saída de erro; `All matched files use Prettier code style!`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .prettierrc.json .prettierignore CLAUDE.md src tests
git commit -m "chore: add Prettier with printWidth 160 and pin @types/node to Node 22"
```

---

### Task 2: Apagar diretórios temporários dos testes

**Files:**
- Create: `tests/fixtures/temp.ts`
- Modify: `tests/fixtures/clubs.ts`
- Modify: `tests/cli/run-cli.test.ts:1-24`

**Interfaces:**
- Consumes: nada.
- Produces: `makeTempDir(prefix: string): Promise<string>` (só pode ser chamada dentro de um teste; apaga a pasta ao fim do teste). `makeClubsDir` mantém a assinatura.

- [ ] **Step 1: Contar os temporários existentes**

Run: `ls -d /tmp/kitgen-* 2>/dev/null | wc -l`
Anote o número N.

- [ ] **Step 2: Criar `tests/fixtures/temp.ts`**

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

// Só pode ser chamada dentro de um teste: a pasta é apagada quando o teste termina, passe ou falhe.
export async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), `kitgen-${prefix}-`));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
```

- [ ] **Step 3: Reescrever `tests/fixtures/clubs.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { makeTempDir } from "./temp.js";

export const GALATICOS_CLUB = {
  id: "galaticos-fc",
  name: "Galáticos FC",
  palette: { primary: "#123456", secondary: "#FFFFFF", accent: "#FFD700" },
  style: { categories: ["modern"], patternWeights: { solid: 20, stripes: 40, sash: 40 } },
};

export async function makeClubsDir(clubs: Record<string, string>): Promise<string> {
  const dir = await makeTempDir("clubs");
  for (const [id, content] of Object.entries(clubs)) {
    await mkdir(path.join(dir, id), { recursive: true });
    await writeFile(path.join(dir, id, "club.json"), content);
  }
  return dir;
}
```

- [ ] **Step 4: Usar `makeTempDir` nos testes de CLI**

Em `tests/cli/run-cli.test.ts`:
- troque `import { mkdtemp, readFile, writeFile } from "node:fs/promises";` por `import { readFile, writeFile } from "node:fs/promises";`;
- remova `import { tmpdir } from "node:os";`;
- adicione `import { makeTempDir } from "../fixtures/temp.js";` logo após `import { makeKit } from "../fixtures/kits.js";`;
- remova a função `tempDir()` inteira;
- troque todas as ocorrências de `await tempDir()` por `await makeTempDir("cli")`.

- [ ] **Step 5: Rodar os testes e conferir a limpeza**

Run: `npm test && ls -d /tmp/kitgen-* 2>/dev/null | wc -l`
Expected: 152 testes passando; a contagem continua N (nenhum diretório novo sobra). Os N antigos são de execuções anteriores; apague-os à mão se quiser (`rm -rf /tmp/kitgen-*`).

- [ ] **Step 6: Gate e commit**

Run: `npm run typecheck && npm run format:check`

```bash
git add tests/fixtures/temp.ts tests/fixtures/clubs.ts tests/cli/run-cli.test.ts
git commit -m "test: remove temporary directories after each test"
```

---

### Task 3: Testes que faltavam no renderer e nos schemas

Comportamento já existente; os testes devem passar de primeira. Se algum falhar, é bug: pare e investigue antes de seguir.

**Files:**
- Modify: `tests/renderers/renderer-2d.test.ts` (fim do `describe("renderKit2dPng")`)
- Modify: `tests/core/club.test.ts` (antes de `"rejects invalid palette colors"`)

**Interfaces:**
- Consumes: `renderKit2dPng`, `makeKit`, `parseClubIdentity` (existentes).
- Produces: nada.

- [ ] **Step 1: Adicionar testes de pixel ao fim de `describe("renderKit2dPng")`**

Logo após o teste `"paints the sash only along the diagonal"`:

```ts
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
```

- [ ] **Step 2: Adicionar testes de chave com typo em `tests/core/club.test.ts`**

Antes de `it("rejects invalid palette colors", ...)`:

```ts
  it("rejects a misspelled fmUniqueId key", () => {
    const { fmUniqueId, ...rest } = galaticos;
    expect(() => parseClubIdentity({ ...rest, fmUniqueID: fmUniqueId })).toThrow(/fmUniqueID/);
  });

  it("rejects a misspelled patternWeights key", () => {
    expect(() => parseClubIdentity({ ...galaticos, style: { categories: [], patternWeigths: { solid: 1 } } })).toThrow(/patternWeigths/);
  });
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run tests/renderers tests/core/club.test.ts`
Expected: PASS (todos).

- [ ] **Step 4: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add tests/renderers/renderer-2d.test.ts tests/core/club.test.ts
git commit -m "test: cover sleeves, cuffs, collars, v-neck geometry and misspelled club keys"
```

---

### Task 4: `deriveSeed`, soma de pesos finita e teto de peso

**Files:**
- Modify: `src/core/random.ts`
- Modify: `src/core/club.ts`
- Test: `tests/core/random.test.ts`, `tests/core/club.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `deriveSeed(seed: number, label: string): number` (inteiro `0..MAX_SEED`; lança `Seed must be an integer between 0 and 4294967295, got <seed>` para seed inválida). `rng.weighted` lança `Sum of weights must be finite`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/random.test.ts`, troque o import por:

```ts
import { createRng, deriveSeed, MAX_SEED } from "../../src/core/random.js";
```

Dentro de `describe("createRng")`, após `"throws when no option has positive weight"`:

```ts
  it("throws when the sum of weights overflows", () => {
    const entries = [
      ["a", 1e308],
      ["b", 1e308],
    ] as const;
    expect(() => createRng(1).weighted(entries)).toThrow("Sum of weights must be finite");
  });
```

No fim do arquivo:

```ts
describe("deriveSeed", () => {
  it("is stable across runs and platforms", () => {
    expect(deriveSeed(42, "home")).toBe(466384824);
    expect(deriveSeed(42, "palette:0")).toBe(2366796840);
    expect(deriveSeed(MAX_SEED, "third")).toBe(65517137);
  });

  it("changes with the label and with the seed", () => {
    expect(new Set(["home", "away", "third"].map((label) => deriveSeed(42, label))).size).toBe(3);
    expect(deriveSeed(1, "home")).not.toBe(deriveSeed(2, "home"));
  });

  it("returns valid seeds", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const derived = deriveSeed(seed, "palette:3");
      expect(Number.isInteger(derived)).toBe(true);
      expect(derived).toBeGreaterThanOrEqual(0);
      expect(derived).toBeLessThanOrEqual(MAX_SEED);
    }
  });

  it.each([-1, 1.5, MAX_SEED + 1])("rejects invalid seed %d", (seed) => {
    expect(() => deriveSeed(seed, "home")).toThrow(/Seed must be an integer/);
  });
});
```

Em `tests/core/club.test.ts`, após `"rejects negative pattern weights"`:

```ts
  it("accepts pattern weights up to 1,000,000 and rejects larger ones", () => {
    const withWeight = (weight: number) => ({ ...galaticos, style: { categories: [], patternWeights: { stripes: weight } } });
    expect(parseClubIdentity(withWeight(1_000_000)).style.patternWeights).toEqual({ stripes: 1_000_000 });
    expect(() => parseClubIdentity(withWeight(1_000_001))).toThrow(/patternWeights/);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/random.test.ts tests/core/club.test.ts`
Expected: FAIL — `deriveSeed` não exportado; `"Sum of weights must be finite"` não lançado; peso 1_000_001 aceito.

- [ ] **Step 3: Implementar em `src/core/random.ts`**

Substitua o trecho entre `export const MAX_SEED = 0xffffffff;` e `let state = seed;` por:

```ts
export const MAX_SEED = 0xffffffff;

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) throw new Error(`Seed must be an integer between 0 and ${MAX_SEED}, got ${seed}`);
}

// FNV-1a 32 bits: sub-seed estável por rótulo, independente da sequência de qualquer rng. Mudar o algoritmo muda todos os kits gerados.
export function deriveSeed(seed: number, label: string): number {
  assertSeed(seed);
  const text = `${seed}:${label}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return hash;
}

// mulberry32: rápido, 32 bits de estado e sequência idêntica em qualquer plataforma, o que garante reprodutibilidade por seed.
export function createRng(seed: number): Rng {
  assertSeed(seed);
  let state = seed;
```

Em `weighted`, logo após `if (total === 0) throw new Error("No options with positive weight");`:

```ts
      if (!Number.isFinite(total)) throw new Error("Sum of weights must be finite");
```

- [ ] **Step 4: Implementar o teto em `src/core/club.ts`**

Arquivo completo:

```ts
import { z } from "zod";
import { ClubIdSchema, HexColorSchema, parseWith } from "./primitives.js";

// O teto mantém finita a soma dos pesos em rng.weighted.
const PatternWeightSchema = z.number().nonnegative().max(1_000_000);

export const ClubIdentitySchema = z.strictObject({
  id: ClubIdSchema,
  name: z.string().min(1),
  // String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário.
  fmUniqueId: z.string().regex(/^\d+$/, "must be the numeric FM Unique ID as a string").optional(),
  palette: z.strictObject({ primary: HexColorSchema, secondary: HexColorSchema.optional(), accent: HexColorSchema.optional() }),
  style: z
    .strictObject({ categories: z.array(z.string()).default([]), patternWeights: z.record(z.string(), PatternWeightSchema).optional() })
    .default({ categories: [] }),
});

export type ClubIdentity = z.infer<typeof ClubIdentitySchema>;

export function parseClubIdentity(input: unknown): ClubIdentity {
  return parseWith(ClubIdentitySchema, input, "club identity");
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/core/random.test.ts tests/core/club.test.ts`
Expected: PASS.

- [ ] **Step 6: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/random.ts src/core/club.ts tests/core/random.test.ts tests/core/club.test.ts
git commit -m "feat: derive stable sub-seeds and reject non-finite pattern weight sums"
```

---

### Task 5: `colorDistance` e accent que evita o neutro

**Files:**
- Modify: `src/core/color.ts` (fim do arquivo)
- Modify: `src/core/palette.ts`
- Test: `tests/core/color.test.ts`, `tests/core/palette.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `colorDistance(a: string, b: string): number` (ΔE OKLab, 0 a ~1). `deriveAccent` mantém assinatura e uma única chamada `rng.range`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/color.test.ts`, troque o import por `import { colorDistance, contrastRatio, normalizeHex } from "../../src/core/color.js";` e adicione no fim:

```ts
describe("colorDistance", () => {
  it("is 0 for identical colors and 1 for black and white", () => {
    expect(colorDistance("#123456", "#123456")).toBe(0);
    expect(colorDistance("#000000", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("matches known OKLab distances", () => {
    expect(colorDistance("#123456", "#ffffff")).toBeCloseTo(0.685, 3);
    expect(colorDistance("#ffffff", "#f0f0f0")).toBeCloseTo(0.045, 3);
  });

  it("is symmetric", () => {
    expect(colorDistance("#c8102e", "#ffd700")).toBeCloseTo(colorDistance("#ffd700", "#c8102e"), 10);
  });
});
```

Em `tests/core/palette.test.ts`, troque o import de palette por `import { bestNeutral, MIN_ACCENT_CONTRAST, resolvePalette } from "../../src/core/palette.js";` e adicione no fim do `describe("resolvePalette")`:

```ts
  // Antes destas luminosidades extras, todas estas primárias caíam sempre no neutro.
  it.each(["#808080", "#4682b4", "#cd5c5c", "#708090", "#2e8b57"])("derives a chromatic accent for the mid-tone %s", (primary) => {
    for (let seed = 0; seed < 50; seed++) {
      const { accent } = resolvePalette({ primary }, createRng(seed));
      expect(accent).not.toBe(bestNeutral(primary));
      expect(contrastRatio(primary, accent)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/color.test.ts tests/core/palette.test.ts`
Expected: FAIL — `colorDistance` não existe; os 5 casos de tom médio recebem o neutro.

- [ ] **Step 3: Implementar `colorDistance` no fim de `src/core/color.ts`**

```ts

// ΔE OKLab: escala de 0 a ~1 que acompanha a percepção humana melhor que distância RGB ou contraste WCAG.
export function colorDistance(a: string, b: string): number {
  return new Color(a).deltaE(new Color(b), "OK");
}
```

- [ ] **Step 4: Implementar as luminosidades extras em `src/core/palette.ts`**

Logo após `const BLACK = "#000000";`:

```ts
// Primárias de luminosidade média raramente contrastam com o primeiro alvo; os seguintes evitam cair no neutro, que costuma repetir a secondary.
const ACCENT_LIGHTNESS_FOR_DARK = [0.85, 0.92, 0.75];
const ACCENT_LIGHTNESS_FOR_LIGHT = [0.35, 0.25, 0.45];
```

Substitua as três últimas linhas de `deriveAccent` (de `const candidate = ...` até o `return`) por:

```ts
  for (const target of lightness < 0.6 ? ACCENT_LIGHTNESS_FOR_DARK : ACCENT_LIGHTNESS_FOR_LIGHT) {
    const candidate = toHex(new Color("oklch", [target, 0.15, accentHue]));
    if (contrastRatio(primary, candidate) >= MIN_ACCENT_CONTRAST) return candidate;
  }
  // Branco ou preto sempre atinge contraste >= 4.5 contra qualquer cor, então o fallback garante o mínimo.
  return bestNeutral(primary);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/core/color.test.ts tests/core/palette.test.ts`
Expected: PASS.

- [ ] **Step 6: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/color.ts src/core/palette.ts tests/core/color.test.ts tests/core/palette.test.ts
git commit -m "feat: add OKLab color distance and avoid neutral accents for mid-tone primaries"
```

---

### Task 6: `kitType` e `generatedWith` no `KitDefinition`

**Files:**
- Modify: `src/core/primitives.ts`, `src/core/kit.ts`, `src/fm26/naming.ts`, `src/io/club-repository.ts:4-7`, `src/generator/kit-generator.ts:24`
- Modify: `tests/fixtures/kits.ts`, `tests/fm26/naming.test.ts:2`
- Modify: `clubs/galaticos-fc/kits/home/kit.json`
- Test: `tests/core/kit.test.ts`

**Interfaces:**
- Consumes: `MAX_SEED` (`src/core/random.ts`).
- Produces: `SeedSchema` (`src/core/primitives.ts`); `KIT_TYPES = ["home", "away", "third"] as const`, `KitTypeSchema`, `type KitType` (`src/core/kit.ts`); `KitDefinition` com `kitType: KitType` obrigatório e `generatedWith?: { seed: number }`. `src/fm26/naming.ts` deixa de exportar `KIT_TYPES`/`KitType`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/kit.test.ts`, troque o import de kit por:

```ts
import { KIT_TYPES, parseKitDefinition } from "../../src/core/kit.js";
import { MAX_SEED } from "../../src/core/random.js";
```

E adicione no fim do `describe("parseKitDefinition")`:

```ts
  it.each(KIT_TYPES)("accepts the %s kit type", (kitType) => {
    expect(parseKitDefinition(makeKit({ kitType })).kitType).toBe(kitType);
  });

  it("requires a known kit type", () => {
    const { kitType: _ignored, ...withoutType } = makeKit();
    expect(() => parseKitDefinition(withoutType)).toThrow(/kitType/);
    expect(() => parseKitDefinition({ ...makeKit(), kitType: "fourth" })).toThrow(/kitType/);
  });

  it("accepts the generation seed and keeps it through a JSON round trip", () => {
    const kit = makeKit({ generatedWith: { seed: MAX_SEED } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it.each([-1, 1.5, MAX_SEED + 1])("rejects the invalid generation seed %d", (seed) => {
    expect(() => parseKitDefinition({ ...makeKit(), generatedWith: { seed } })).toThrow(/generatedWith\.seed/);
  });

  it("rejects unknown keys in generatedWith", () => {
    expect(() => parseKitDefinition({ ...makeKit(), generatedWith: { seed: 1, attempt: 0 } })).toThrow(/attempt/);
  });
```

Em `tests/fixtures/kits.ts`, adicione `kitType: "home",` logo após `clubId: "galaticos-fc",`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/kit.test.ts`
Expected: FAIL — `KIT_TYPES` não exportado por `core/kit`; `kitType` rejeitado como chave desconhecida.

- [ ] **Step 3: Adicionar `SeedSchema` em `src/core/primitives.ts`**

Arquivo completo:

```ts
import { z } from "zod";
import { HEX_COLOR_PATTERN, normalizeHex } from "./color.js";
import { MAX_SEED } from "./random.js";

export const HexColorSchema = z.string().regex(HEX_COLOR_PATTERN, "must be a hex color like #1a2b3c or #abc").transform(normalizeHex);

// Também impede path traversal, pois o id vira nome de diretório em clubs/.
export const ClubIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must contain only lowercase letters, digits and hyphens");

export const SeedSchema = z.number().int().min(0).max(MAX_SEED);

export function parseWith<T extends z.ZodType>(schema: T, input: unknown, label: string): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid ${label}:\n${z.prettifyError(result.error)}`);
  return result.data;
}
```

- [ ] **Step 4: Reescrever `src/core/kit.ts`**

```ts
import { z } from "zod";
import { ClubIdSchema, HexColorSchema, parseWith, SeedSchema } from "./primitives.js";

export const KIT_TYPES = ["home", "away", "third"] as const;
export const COLOR_ROLES = ["primary", "secondary", "accent"] as const;
export const COLLAR_STYLES = ["round", "v-neck"] as const;
export const SLEEVE_STYLES = ["match-body", "solid"] as const;

export const KitTypeSchema = z.enum(KIT_TYPES);
export const ColorRoleSchema = z.enum(COLOR_ROLES);

export const KitDefinitionSchema = z.strictObject({
  clubId: ClubIdSchema,
  kitType: KitTypeSchema,
  // Seed do conjunto Home/Away/Third; ausente em kits escritos à mão.
  generatedWith: z.strictObject({ seed: SeedSchema }).optional(),
  colors: z.strictObject({ primary: HexColorSchema, secondary: HexColorSchema, accent: HexColorSchema }),
  pattern: z.strictObject({ id: z.string().min(1), base: ColorRoleSchema, overlay: ColorRoleSchema, params: z.record(z.string(), z.number()).default({}) }),
  collar: z.strictObject({ style: z.enum(COLLAR_STYLES), color: ColorRoleSchema }),
  sleeves: z.strictObject({ style: z.enum(SLEEVE_STYLES), color: ColorRoleSchema, cuffColor: ColorRoleSchema }),
  shorts: z.strictObject({ color: ColorRoleSchema }),
  socks: z.strictObject({ color: ColorRoleSchema }),
});

export type KitType = z.infer<typeof KitTypeSchema>;
export type ColorRole = z.infer<typeof ColorRoleSchema>;
export type CollarStyle = (typeof COLLAR_STYLES)[number];
export type KitDefinition = z.infer<typeof KitDefinitionSchema>;

export function parseKitDefinition(input: unknown): KitDefinition {
  return parseWith(KitDefinitionSchema, input, "kit definition");
}
```

- [ ] **Step 5: Apontar os consumidores de `KitType` para `core/kit`**

`src/fm26/naming.ts`: remova `export const KIT_TYPES = ...` e `export type KitType = ...`; o topo do arquivo fica:

```ts
import type { KitType } from "../core/kit.js";
import { ClubIdSchema, parseWith } from "../core/primitives.js";

export const RENDER_TYPES = ["2d", "3d"] as const;

export type RenderType = (typeof RENDER_TYPES)[number];
```

`src/io/club-repository.ts`: troque `import type { KitDefinition } from "../core/kit.js";` por `import type { KitDefinition, KitType } from "../core/kit.js";` e remova `import type { KitType } from "../fm26/naming.js";`.

`tests/fm26/naming.test.ts`: troque a linha 2 por:

```ts
import { KIT_TYPES } from "../../src/core/kit.js";
import { clubSlug, kitAssetFileName, kitAssetName, RENDER_TYPES } from "../../src/fm26/naming.js";
```

`src/generator/kit-generator.ts`: no objeto retornado por `generateKit`, adicione `kitType: "home",` logo após `clubId: identity.id,` (provisório; a Task 9 reescreve o generator).

`clubs/galaticos-fc/kits/home/kit.json`: adicione `"kitType": "home",` logo após `"clubId": "galaticos-fc",`, para o arquivo versionado continuar válido até a Task 14 regenerá-lo.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/core/kit.test.ts tests/fm26`
Expected: PASS.

- [ ] **Step 7: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/primitives.ts src/core/kit.ts src/fm26/naming.ts src/io/club-repository.ts src/generator/kit-generator.ts tests/fixtures/kits.ts tests/fm26/naming.test.ts tests/core/kit.test.ts clubs/galaticos-fc/kits/home/kit.json
git commit -m "feat: record kit type and generation seed in KitDefinition"
```

---

### Task 7: Módulo de validação

**Files:**
- Create: `src/core/validation.ts`
- Test: `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `colorDistance` (Task 5), `KIT_TYPES`/`KitType`/`KitDefinition`/`COLOR_ROLES`/`ColorRole` (Task 6), `Palette`, `ClubIdentity`, `listPatternTemplates`.
- Produces:
  - `interface ValidationIssue { rule: string; message: string }`
  - `MIN_COLOR_DISTANCE = 0.15`
  - `validateColors(colors: Partial<Record<ColorRole, string>>): ValidationIssue[]` — regra `distinct-colors`
  - `validateClub(identity: ClubIdentity): ValidationIssue[]` — `unknown-pattern`, `no-pattern-weight`, `distinct-colors`
  - `validatePalette(palette: Palette): ValidationIssue[]`
  - `validateKit(kit: KitDefinition): ValidationIssue[]` — `unknown-pattern`, `pattern-contrast`
  - `validateKitSet(kits: Partial<Record<KitType, KitDefinition>>): ValidationIssue[]` — `club-mismatch`, `kit-clash`
  - `formatIssues(issues: readonly ValidationIssue[]): string` — linhas `  - <rule>: <message>`

- [ ] **Step 1: Escrever os testes que falham em `tests/core/validation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import type { KitDefinition } from "../../src/core/kit.js";
import { formatIssues, validateClub, validateColors, validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

const PALETTE = { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" };

function club(overrides: Record<string, unknown> = {}) {
  return parseClubIdentity({ ...GALATICOS_CLUB, ...overrides });
}

function kitSet(): Record<"home" | "away" | "third", KitDefinition> {
  return {
    home: makeKit({ kitType: "home", pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} } }),
    away: makeKit({ kitType: "away", pattern: { id: "solid", base: "secondary", overlay: "accent", params: {} } }),
    third: makeKit({ kitType: "third", pattern: { id: "solid", base: "accent", overlay: "primary", params: {} } }),
  };
}

describe("validateColors", () => {
  it("accepts clearly different colors", () => {
    expect(validateColors(PALETTE)).toEqual([]);
  });

  it("reports each pair that is too similar", () => {
    expect(validateColors({ primary: "#123456", secondary: "#1a3d66" })).toEqual([
      { rule: "distinct-colors", message: "primary #123456 and secondary #1a3d66 are too similar (distance 0.039, minimum 0.15)" },
    ]);
    expect(validateColors({ primary: "#ffffff", secondary: "#f0f0f0", accent: "#ffffff" })).toHaveLength(3);
  });

  it("ignores missing roles", () => {
    expect(validateColors({ primary: "#123456" })).toEqual([]);
  });
});

describe("validateClub", () => {
  it("accepts the galaticos club", () => {
    expect(validateClub(club())).toEqual([]);
  });

  it("accepts clubs without pattern weights", () => {
    expect(validateClub(club({ style: { categories: [] } }))).toEqual([]);
  });

  it("reports unknown patterns", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { zigzag: 1, solid: 1 } } }));
    expect(issues).toEqual([{ rule: "unknown-pattern", message: 'style.patternWeights references unknown pattern "zigzag" (known: solid, stripes, sash)' }]);
  });

  it("reports clubs without any positive weight on a known pattern", () => {
    const issues = validateClub(club({ style: { categories: [], patternWeights: { solid: 0, zigzag: 5 } } }));
    expect(issues.map((issue) => issue.rule)).toEqual(["unknown-pattern", "no-pattern-weight"]);
  });

  it("checks only the colors the club provides", () => {
    expect(validateClub(club({ palette: { primary: "#123456" } }))).toEqual([]);
    expect(validateClub(club({ palette: { primary: "#123456", accent: "#1a3d66" } })).map((issue) => issue.rule)).toEqual(["distinct-colors"]);
  });
});

describe("validatePalette", () => {
  it("requires the three colors to be distinct", () => {
    expect(validatePalette(PALETTE)).toEqual([]);
    expect(validatePalette({ ...PALETTE, accent: "#f0f0f0" })).toEqual([
      { rule: "distinct-colors", message: "secondary #ffffff and accent #f0f0f0 are too similar (distance 0.045, minimum 0.15)" },
    ]);
  });
});

describe("validateKit", () => {
  it("accepts a coherent kit", () => {
    expect(validateKit(makeKit())).toEqual([]);
  });

  it("reports unknown patterns", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } });
    expect(validateKit(kit)).toEqual([{ rule: "unknown-pattern", message: 'home kit uses unknown pattern "zigzag" (known: solid, stripes, sash)' }]);
  });

  it("reports base and overlay using the same role", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "primary", params: {} } });
    expect(validateKit(kit)).toEqual([{ rule: "pattern-contrast", message: "home kit uses primary as both pattern base and overlay" }]);
  });

  it("reports base and overlay colors that are too similar, even for solid", () => {
    const kit = makeKit({ colors: { primary: "#123456", secondary: "#1a3d66", accent: "#ffd700" } });
    expect(validateKit(kit)).toEqual([
      { rule: "pattern-contrast", message: "home kit base #123456 and overlay #1a3d66 are too similar (distance 0.039, minimum 0.15)" },
    ]);
  });
});

describe("validateKitSet", () => {
  it("accepts kits with distinct base colors", () => {
    expect(validateKitSet(kitSet())).toEqual([]);
  });

  it("accepts partial sets", () => {
    expect(validateKitSet({ home: kitSet().home })).toEqual([]);
    expect(validateKitSet({})).toEqual([]);
  });

  it("reports kits whose base colors clash", () => {
    const set = kitSet();
    const away = makeKit({ kitType: "away", pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} } });
    expect(validateKitSet({ ...set, away })).toEqual([
      { rule: "kit-clash", message: "home base #123456 and away base #123456 are too similar (distance 0.000, minimum 0.15)" },
    ]);
  });

  it("reports kits from different clubs", () => {
    const set = kitSet();
    expect(validateKitSet({ ...set, third: { ...set.third, clubId: "kong-team" } })).toEqual([
      { rule: "club-mismatch", message: "kits belong to different clubs: galaticos-fc, kong-team" },
    ]);
  });
});

describe("formatIssues", () => {
  it("prints one indented line per issue", () => {
    const issues = [
      { rule: "a", message: "first" },
      { rule: "b", message: "second" },
    ];
    expect(formatIssues(issues)).toBe("  - a: first\n  - b: second");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/validation.test.ts`
Expected: FAIL — módulo `src/core/validation.js` não existe.

- [ ] **Step 3: Implementar `src/core/validation.ts`**

```ts
import { listPatternTemplates } from "../patterns/registry.js";
import type { ClubIdentity } from "./club.js";
import { colorDistance } from "./color.js";
import { COLOR_ROLES, KIT_TYPES, type ColorRole, type KitDefinition, type KitType } from "./kit.js";
import type { Palette } from "./palette.js";

export interface ValidationIssue {
  rule: string;
  message: string;
}

// ΔE OKLab abaixo disto parece a mesma cor em campo (branco × #f0f0f0 = 0.045, ouro × laranja = 0.121, vermelho × laranja = 0.155).
export const MIN_COLOR_DISTANCE = 0.15;

function pairs<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((first, index) => items.slice(index + 1).map((second): [T, T] => [first, second]));
}

function tooSimilar(a: string, b: string): string | undefined {
  const distance = colorDistance(a, b);
  return distance < MIN_COLOR_DISTANCE ? `too similar (distance ${distance.toFixed(3)}, minimum ${MIN_COLOR_DISTANCE})` : undefined;
}

function knownPatternIds(): string[] {
  return listPatternTemplates().map((template) => template.id);
}

export function validateColors(colors: Partial<Record<ColorRole, string>>): ValidationIssue[] {
  const roles = COLOR_ROLES.filter((role) => colors[role] !== undefined);
  return pairs(roles).flatMap(([a, b]) => {
    const problem = tooSimilar(colors[a]!, colors[b]!);
    return problem ? [{ rule: "distinct-colors", message: `${a} ${colors[a]} and ${b} ${colors[b]} are ${problem}` }] : [];
  });
}

export function validateClub(identity: ClubIdentity): ValidationIssue[] {
  const known = knownPatternIds();
  const weights = identity.style.patternWeights;
  const issues: ValidationIssue[] = [];
  for (const id of Object.keys(weights ?? {})) {
    if (!known.includes(id)) {
      issues.push({ rule: "unknown-pattern", message: `style.patternWeights references unknown pattern "${id}" (known: ${known.join(", ")})` });
    }
  }
  if (weights && !Object.entries(weights).some(([id, weight]) => known.includes(id) && weight > 0)) {
    issues.push({ rule: "no-pattern-weight", message: "style.patternWeights gives no known pattern a positive weight" });
  }
  return [...issues, ...validateColors(identity.palette)];
}

export function validatePalette(palette: Palette): ValidationIssue[] {
  return validateColors(palette);
}

export function validateKit(kit: KitDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = knownPatternIds();
  if (!known.includes(kit.pattern.id)) {
    issues.push({ rule: "unknown-pattern", message: `${kit.kitType} kit uses unknown pattern "${kit.pattern.id}" (known: ${known.join(", ")})` });
  }
  const { base, overlay } = kit.pattern;
  // O overlay também pinta as mangas "solid", então a regra vale mesmo para o padrão "solid".
  if (base === overlay) {
    issues.push({ rule: "pattern-contrast", message: `${kit.kitType} kit uses ${base} as both pattern base and overlay` });
  } else {
    const problem = tooSimilar(kit.colors[base], kit.colors[overlay]);
    if (problem) {
      issues.push({ rule: "pattern-contrast", message: `${kit.kitType} kit base ${kit.colors[base]} and overlay ${kit.colors[overlay]} are ${problem}` });
    }
  }
  return issues;
}

export function validateKitSet(kits: Partial<Record<KitType, KitDefinition>>): ValidationIssue[] {
  const present = KIT_TYPES.flatMap((kitType) => kits[kitType] ?? []);
  const issues: ValidationIssue[] = [];
  const clubIds = [...new Set(present.map((kit) => kit.clubId))];
  if (clubIds.length > 1) issues.push({ rule: "club-mismatch", message: `kits belong to different clubs: ${clubIds.join(", ")}` });
  // O FM precisa distinguir os uniformes em campo; a cor base domina a camisa.
  for (const [a, b] of pairs(present)) {
    const [colorA, colorB] = [a.colors[a.pattern.base], b.colors[b.pattern.base]];
    const problem = tooSimilar(colorA, colorB);
    if (problem) issues.push({ rule: "kit-clash", message: `${a.kitType} base ${colorA} and ${b.kitType} base ${colorB} are ${problem}` });
  }
  return issues;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `  - ${issue.rule}: ${issue.message}`).join("\n");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/validation.test.ts`
Expected: PASS (18 testes).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/validation.ts tests/core/validation.test.ts
git commit -m "feat: add deterministic club, palette, kit and kit set validation"
```

---

### Task 8: Overlay nunca cobre metade do tronco

**Files:**
- Modify: `src/patterns/stripes.ts:9`, `src/patterns/sash.ts:9`
- Test: `tests/renderers/renderer-2d.test.ts`

**Interfaces:**
- Consumes: `renderKit2dPng`, `makeKit`.
- Produces: `stripes.ratio` em `{ min: 0.2, max: 0.4, default: 0.3 }`; `sash.width` em `{ min: 30, max: 100, default: 70 }`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/renderers/renderer-2d.test.ts`, logo após `const ACCENT: Rgba = ...`:

```ts

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
```

No fim do `describe("renderKit2dPng")`:

```ts
  // A cor base precisa dominar a camisa; senão o Away (base secondary) pode parecer o Home e o kit-clash não percebe.
  it.each([3, 4, 5, 8, 15])("keeps the widest stripes (count %d) below half of the torso", async (count) => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count, ratio: 1 } } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });

  it.each([0, 1])("keeps the widest sash (direction %d) below half of the torso", async (direction) => {
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 1000, direction } } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });
```

`ratio: 1` e `width: 1000` são clampados ao máximo do template, então os testes medem o pior caso.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/renderers`
Expected: FAIL nos 7 casos novos (com os ranges atuais o overlay chega a 80% das listras e a faixa a 140 px).

- [ ] **Step 3: Limitar os ranges**

`src/patterns/stripes.ts`, linha `parameters`:

```ts
  parameters: { count: { min: 3, max: 15, default: 7, integer: true }, ratio: { min: 0.2, max: 0.4, default: 0.3 } },
```

`src/patterns/sash.ts`, linha `parameters`:

```ts
  parameters: { width: { min: 30, max: 100, default: 70 }, direction: { min: 0, max: 1, default: 0, integer: true } },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/renderers tests/patterns tests/generator`
Expected: PASS. Medido: pior caso de listras 47% do tronco (`count` 5), faixa 48%.

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/patterns/stripes.ts src/patterns/sash.ts tests/renderers/renderer-2d.test.ts
git commit -m "feat: cap stripes and sash coverage so the base color dominates the shirt"
```

---

### Task 9: Generator do conjunto Home/Away/Third

**Files:**
- Modify: `src/generator/kit-generator.ts` (reescrita)
- Modify: `src/cli/run-cli.ts` (import e uma linha)
- Test: `tests/generator/kit-generator.test.ts` (reescrita)

**Interfaces:**
- Consumes: `deriveSeed` (Task 4), `KitType`/`KIT_TYPES`/`COLOR_ROLES` (Task 6), `validateClub`/`validatePalette`/`formatIssues`/`ValidationIssue` (Task 7), `resolvePalette`/`Palette`.
- Produces:
  - `type KitSet = Record<KitType, KitDefinition>`
  - `MAX_PALETTE_ATTEMPTS = 20`
  - `generateKitSet(identity: ClubIdentity, seed: number): KitSet`
  - `generatePalette(identity: ClubIdentity, seed: number): Palette`
  - `generateKit(identity: ClubIdentity, kitType: KitType, palette: Palette, seed: number): KitDefinition` (`seed` é a do conjunto; o kit usa `deriveSeed(seed, kitType)`)
  - A antiga `generateKit(identity, seed)` deixa de existir.

- [ ] **Step 1: Reescrever `tests/generator/kit-generator.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { KIT_TYPES, parseKitDefinition } from "../../src/core/kit.js";
import { resolvePalette } from "../../src/core/palette.js";
import { createRng, deriveSeed } from "../../src/core/random.js";
import { validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { generateKit, generateKitSet, generatePalette, MAX_PALETTE_ATTEMPTS } from "../../src/generator/kit-generator.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const identity: ClubIdentity = parseClubIdentity(GALATICOS_CLUB);

function withWeights(patternWeights: Record<string, number>): ClubIdentity {
  return { ...identity, style: { ...identity.style, patternWeights } };
}

function withPalette(palette: ClubIdentity["palette"]): ClubIdentity {
  return { ...identity, palette };
}

describe("generateKitSet", () => {
  it("returns the same set for the same seed", () => {
    expect(generateKitSet(identity, 42)).toEqual(generateKitSet(identity, 42));
  });

  it("varies with the seed", () => {
    const distinct = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(generateKitSet(identity, seed))));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("produces one kit per type, all from the same club, palette and seed", () => {
    const set = generateKitSet(identity, 7);
    expect(Object.keys(set)).toEqual([...KIT_TYPES]);
    for (const kitType of KIT_TYPES) {
      expect(set[kitType]).toMatchObject({ clubId: "galaticos-fc", kitType, generatedWith: { seed: 7 } });
      expect(set[kitType].colors).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
    }
  });

  it("cycles the roles: home primary/secondary, away secondary/accent, third accent/primary", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { home, away, third } = generateKitSet(identity, seed);
      expect([home.pattern.base, home.pattern.overlay]).toEqual(["primary", "secondary"]);
      expect([away.pattern.base, away.pattern.overlay]).toEqual(["secondary", "accent"]);
      expect([third.pattern.base, third.pattern.overlay]).toEqual(["accent", "primary"]);
    }
  });

  it("produces definitions that pass schema validation after a JSON round trip", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const kit of Object.values(generateKitSet(identity, seed))) expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
    }
  });

  it("never produces an invalid kit or set from a valid palette", () => {
    const palettes: ClubIdentity["palette"][] = [
      identity.palette,
      { primary: "#c8102e" },
      { primary: "#808080" },
      { primary: "#ffd700" },
      { primary: "#000000" },
    ];
    for (const palette of palettes) {
      for (let seed = 0; seed < 100; seed++) {
        const set = generateKitSet(withPalette(palette), seed);
        for (const kit of Object.values(set)) expect(validateKit(kit)).toEqual([]);
        expect(validateKitSet(set)).toEqual([]);
      }
    }
  });

  it("keeps trims, shorts and socks consistent with the kit roles", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const kit of Object.values(generateKitSet(identity, seed))) {
        const { base, overlay } = kit.pattern;
        expect(kit.collar.color).not.toBe(base);
        expect(kit.sleeves.cuffColor).not.toBe(base);
        expect(kit.sleeves.color).toBe(overlay);
        expect([base, overlay]).toContain(kit.shorts.color);
        expect([kit.shorts.color, base]).toContain(kit.socks.color);
      }
    }
  });

  it("only picks patterns with positive weight", () => {
    const stripesOnly = withWeights({ stripes: 1, sash: 0 });
    for (let seed = 0; seed < 50; seed++) {
      for (const kit of Object.values(generateKitSet(stripesOnly, seed))) expect(kit.pattern.id).toBe("stripes");
    }
  });

  it("generates stripes params inside the template ranges", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { count, ratio } = generateKitSet(withWeights({ stripes: 1 }), seed).home.pattern.params;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(15);
      expect(ratio).toBeGreaterThanOrEqual(0.2);
      expect(ratio).toBeLessThanOrEqual(0.4);
    }
  });

  it("generates sash params inside the template ranges", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { width, direction } = generateKitSet(withWeights({ sash: 1 }), seed).home.pattern.params;
      expect(width).toBeGreaterThanOrEqual(30);
      expect(width).toBeLessThanOrEqual(100);
      expect([0, 1]).toContain(direction);
    }
  });

  it("uses template default weights when the club defines none", () => {
    const { patternWeights: _ignored, ...style } = identity.style;
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet({ ...identity, style }, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["solid", "stripes", "sash"]));
  });

  it("rejects invalid clubs before generating anything", () => {
    expect(() => generateKitSet(withWeights({ zigzag: 1 }), 1)).toThrow(
      'Club "galaticos-fc" is invalid:\n  - unknown-pattern: style.patternWeights references unknown pattern "zigzag"',
    );
    expect(() => generateKitSet(withWeights({ solid: 0 }), 1)).toThrow(/no-pattern-weight/);
    expect(() => generateKitSet(withPalette({ primary: "#123456", secondary: "#1a3d66" }), 1)).toThrow(
      /distinct-colors: primary #123456 and secondary #1a3d66/,
    );
  });
});

describe("generatePalette", () => {
  it("keeps the colors the club provides", () => {
    expect(generatePalette(identity, 1)).toEqual({ primary: "#123456", secondary: "#ffffff", accent: "#ffd700" });
  });

  it("retries with another sub-seed when the derived palette is invalid", () => {
    const club = withPalette({ primary: "#123456", secondary: "#ffafc2" });
    const firstAttempt = (seed: number) => resolvePalette(club.palette, createRng(deriveSeed(seed, "palette:0")));
    const seed = Array.from({ length: 100 }, (_, candidate) => candidate).find((candidate) => validatePalette(firstAttempt(candidate)).length > 0);
    expect(seed).toBeDefined();
    const palette = generatePalette(club, seed!);
    expect(validatePalette(palette)).toEqual([]);
    expect(palette.accent).not.toBe(firstAttempt(seed!).accent);
  });

  it("fails with the violated rule when no attempt produces a valid palette", () => {
    const club = withPalette({ primary: "#123456", accent: "#f0f0f0" });
    expect(() => generatePalette(club, 1)).toThrow(
      `Could not derive a valid palette for club "galaticos-fc" after ${MAX_PALETTE_ATTEMPTS} attempts:\n  - distinct-colors: secondary #ffffff and accent #f0f0f0 are too similar (distance 0.045, minimum 0.15)`,
    );
  });
});

describe("generateKit", () => {
  it("produces the same kit as the set for the same type, palette and seed", () => {
    const set = generateKitSet(identity, 99);
    expect(generateKit(identity, "away", generatePalette(identity, 99), 99)).toEqual(set.away);
  });
});
```

O secondary `#ffafc2` fica perto do accent derivado da navy em cerca de metade das sub-seeds: a tentativa 0 falha em algumas seeds e o retry acha uma paleta válida. O clube com `accent: "#f0f0f0"` e secondary derivada `#ffffff` falha em todas as tentativas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/generator`
Expected: FAIL — `generateKitSet`, `generatePalette` e `MAX_PALETTE_ATTEMPTS` não existem.

- [ ] **Step 3: Reescrever `src/generator/kit-generator.ts`**

```ts
import type { ClubIdentity } from "../core/club.js";
import { COLLAR_STYLES, COLOR_ROLES, SLEEVE_STYLES, type ColorRole, type KitDefinition, type KitType } from "../core/kit.js";
import { resolvePalette, type Palette } from "../core/palette.js";
import { createRng, deriveSeed, type Rng } from "../core/random.js";
import { formatIssues, validateClub, validatePalette, type ValidationIssue } from "../core/validation.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

export type KitSet = Record<KitType, KitDefinition>;

export const MAX_PALETTE_ATTEMPTS = 20;

// Papéis em ciclo (primary→secondary→accent→primary): cada par de kits divide no máximo uma cor e nunca inverte base e overlay, então os três se distinguem em campo.
const KIT_ROLES: Record<KitType, { base: ColorRole; overlay: ColorRole }> = {
  home: { base: "primary", overlay: "secondary" },
  away: { base: "secondary", overlay: "accent" },
  third: { base: "accent", overlay: "primary" },
};

export function generateKitSet(identity: ClubIdentity, seed: number): KitSet {
  const issues = validateClub(identity);
  if (issues.length > 0) throw new Error(`Club "${identity.id}" is invalid:\n${formatIssues(issues)}`);
  const palette = generatePalette(identity, seed);
  return {
    home: generateKit(identity, "home", palette, seed),
    away: generateKit(identity, "away", palette, seed),
    third: generateKit(identity, "third", palette, seed),
  };
}

// Só cores derivadas (secondary/accent ausentes no club.json) mudam entre tentativas; cores informadas pelo usuário já passaram por validateClub.
export function generatePalette(identity: ClubIdentity, seed: number): Palette {
  let issues: ValidationIssue[] = [];
  for (let attempt = 0; attempt < MAX_PALETTE_ATTEMPTS; attempt++) {
    const palette = resolvePalette(identity.palette, createRng(deriveSeed(seed, `palette:${attempt}`)));
    issues = validatePalette(palette);
    if (issues.length === 0) return palette;
  }
  throw new Error(`Could not derive a valid palette for club "${identity.id}" after ${MAX_PALETTE_ATTEMPTS} attempts:\n${formatIssues(issues)}`);
}

export function generateKit(identity: ClubIdentity, kitType: KitType, palette: Palette, seed: number): KitDefinition {
  const rng = createRng(deriveSeed(seed, kitType));
  const { base, overlay } = KIT_ROLES[kitType];
  const trimRoles = COLOR_ROLES.filter((role) => role !== base);
  // A ordem das chamadas ao rng faz parte do contrato de reprodutibilidade: reordenar muda os kits gerados para a mesma seed.
  const template = pickPattern(identity, rng);
  const params = randomParams(template, rng);
  const collarStyle = rng.pick(COLLAR_STYLES);
  const collarColor = rng.pick(trimRoles);
  const sleeveStyle = rng.pick(SLEEVE_STYLES);
  const cuffColor = rng.pick(trimRoles);
  const shortsColor = rng.pick([base, overlay]);
  const socksColor = rng.pick([shortsColor, base]);
  return {
    clubId: identity.id,
    kitType,
    generatedWith: { seed },
    colors: { ...palette },
    pattern: { id: template.id, base, overlay, params },
    collar: { style: collarStyle, color: collarColor },
    sleeves: { style: sleeveStyle, color: overlay, cuffColor },
    shorts: { color: shortsColor },
    socks: { color: socksColor },
  };
}

function pickPattern(identity: ClubIdentity, rng: Rng): PatternTemplate {
  const weights = identity.style.patternWeights;
  return rng.weighted(listPatternTemplates().map((template) => [template, weights ? (weights[template.id] ?? 0) : template.defaultWeight] as const));
}

function randomParams(template: PatternTemplate, rng: Rng): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [key, spec] of Object.entries(template.parameters)) {
    const value = rng.range(spec.min, spec.max);
    params[key] = spec.integer ? Math.round(value) : Number(value.toFixed(3));
  }
  return params;
}
```

- [ ] **Step 4: Manter a CLI compilando**

Em `src/cli/run-cli.ts`, troque `import { generateKit } from "../generator/kit-generator.js";` por `import { generateKitSet } from "../generator/kit-generator.js";` e `const kit = generateKit(club, seed);` por `const kit = generateKitSet(club, seed).home;`. Provisório: a Task 12 reescreve o `generate`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/generator tests/cli`
Expected: PASS (16 testes do generator; os de CLI seguem verdes com o Home do conjunto).

- [ ] **Step 6: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/generator/kit-generator.ts src/cli/run-cli.ts tests/generator/kit-generator.test.ts
git commit -m "feat: generate home, away and third kits from one validated palette"
```

---

### Task 10: Repositório: `listClubIds`, `loadKit` e `saveKit(kit)`

**Files:**
- Modify: `src/io/club-repository.ts` (reescrita)
- Modify: `src/cli/run-cli.ts` (uma linha)
- Test: `tests/io/club-repository.test.ts`

**Interfaces:**
- Consumes: `KitDefinitionSchema`, `KitTypeSchema`, `KitType` (Task 6).
- Produces:
  - `listClubIds(clubsDir?: string): Promise<string[]>` — subpastas com `club.json`, ordenadas; `Clubs directory not found: <dir>` se a pasta não existe.
  - `loadKit(clubId: string, kitType: KitType, clubsDir?: string): Promise<KitDefinition | undefined>` — `undefined` se o arquivo não existe; erros `<file> declares clubId "x", expected "y"`, `<file> declares kitType "x", expected "y"`, `Invalid kit definition in <file>:`.
  - `saveKit(kit: KitDefinition, clubsDir?: string): Promise<string>` — tipo vem de `kit.kitType`.
  - `kitDefinitionPath(clubId, kitType, clubsDir?)` valida `kitType` em runtime (`Invalid kit type`).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/io/club-repository.test.ts`, troque os imports do topo por:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseKitDefinition, type KitType } from "../../src/core/kit.js";
import { kitDefinitionPath, listClubIds, loadClub, loadKit, saveKit } from "../../src/io/club-repository.js";
import { GALATICOS_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
```

Mantenha o `describe("loadClub")` como está e substitua o `describe("saveKit")` inteiro por:

```ts
describe("listClubIds", () => {
  it("lists folders that contain a club.json, sorted", async () => {
    const dir = await makeClubsDir({ "kong-team": "{}", "galaticos-fc": "{}" });
    await mkdir(path.join(dir, "empty-folder"));
    await writeFile(path.join(dir, "notes.txt"), "");
    expect(await listClubIds(dir)).toEqual(["galaticos-fc", "kong-team"]);
  });

  it("returns an empty list for an empty directory", async () => {
    expect(await listClubIds(await makeClubsDir({}))).toEqual([]);
  });

  it("reports a missing directory", async () => {
    const dir = path.join(await makeClubsDir({}), "missing");
    await expect(listClubIds(dir)).rejects.toThrow(`Clubs directory not found: ${dir}`);
  });
});

describe("kitDefinitionPath", () => {
  it("rejects kit types outside home, away and third at runtime", () => {
    expect(() => kitDefinitionPath("galaticos-fc", "fourth" as KitType)).toThrow(/Invalid kit type/);
  });
});

describe("saveKit", () => {
  it("writes clubs/<id>/kits/<kitType>/kit.json and returns the path", async () => {
    const dir = await makeClubsDir({});
    const kit = makeKit({ kitType: "away" });
    const file = await saveKit(kit, dir);
    expect(file).toBe(path.join(dir, "galaticos-fc", "kits", "away", "kit.json"));
    expect(file).toBe(kitDefinitionPath("galaticos-fc", "away", dir));
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8")))).toEqual(kit);
  });

  it("overwrites a previously saved kit", async () => {
    const dir = await makeClubsDir({});
    await saveKit(makeKit(), dir);
    const file = await saveKit(makeKit({ shorts: { color: "primary" } }), dir);
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8"))).shorts.color).toBe("primary");
  });
});

describe("loadKit", () => {
  async function writeGalaticosKitFile(dir: string, kitType: KitType, content: unknown): Promise<string> {
    const file = kitDefinitionPath("galaticos-fc", kitType, dir);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
    return file;
  }

  it("loads a saved kit", async () => {
    const dir = await makeClubsDir({});
    const kit = makeKit({ kitType: "third", generatedWith: { seed: 42 } });
    await saveKit(kit, dir);
    expect(await loadKit("galaticos-fc", "third", dir)).toEqual(kit);
  });

  it("returns undefined when the kit does not exist", async () => {
    expect(await loadKit("galaticos-fc", "home", await makeClubsDir({}))).toBeUndefined();
  });

  it("rejects a kit saved in the folder of another kit type", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", makeKit({ kitType: "away" }));
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`${file} declares kitType "away", expected "home"`);
  });

  it("rejects a kit saved in the folder of another club", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", makeKit({ clubId: "kong-team" }));
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`${file} declares clubId "kong-team", expected "galaticos-fc"`);
  });

  it("names the file when the content is invalid", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", { ...makeKit(), kitType: undefined });
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`Invalid kit definition in ${file}`);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/io`
Expected: FAIL — `listClubIds` e `loadKit` não existem; `saveKit(kit, dir)` grava em `kits/<dir>/...` (assinatura antiga).

- [ ] **Step 3: Reescrever `src/io/club-repository.ts`**

```ts
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseClubIdentity, type ClubIdentity } from "../core/club.js";
import { KitDefinitionSchema, KitTypeSchema, type KitDefinition, type KitType } from "../core/kit.js";
import { ClubIdSchema, parseWith } from "../core/primitives.js";
import { CLUBS_DIR } from "../config/paths.js";
import { FileNotFoundError, readJsonFile } from "./json-file.js";

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function listClubIds(clubsDir: string = CLUBS_DIR): Promise<string[]> {
  const entries = await readdir(clubsDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    throw error.code === "ENOENT" ? new Error(`Clubs directory not found: ${clubsDir}`) : error;
  });
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (await isFile(path.join(clubsDir, entry.name, "club.json")))) ids.push(entry.name);
  }
  return ids.sort();
}

export async function loadClub(clubId: string, clubsDir: string = CLUBS_DIR): Promise<ClubIdentity> {
  const id = parseWith(ClubIdSchema, clubId, "club id");
  const file = path.join(clubsDir, id, "club.json");
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) throw new Error(`Club "${id}" not found (expected ${file})`);
    throw error;
  }
  const club = parseClubIdentity(raw);
  if (club.id !== id) throw new Error(`${file} declares id "${club.id}", expected "${id}"`);
  return club;
}

export function kitDefinitionPath(clubId: string, kitType: KitType, clubsDir: string = CLUBS_DIR): string {
  // kitType chega da linha de comando (--type); o tipo TS sozinho não impede um diretório arbitrário.
  const type = parseWith(KitTypeSchema, kitType, "kit type");
  return path.join(clubsDir, parseWith(ClubIdSchema, clubId, "club id"), "kits", type, "kit.json");
}

export async function loadKit(clubId: string, kitType: KitType, clubsDir: string = CLUBS_DIR): Promise<KitDefinition | undefined> {
  const file = kitDefinitionPath(clubId, kitType, clubsDir);
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) return undefined;
    throw error;
  }
  const kit = parseWith(KitDefinitionSchema, raw, `kit definition in ${file}`);
  if (kit.clubId !== clubId) throw new Error(`${file} declares clubId "${kit.clubId}", expected "${clubId}"`);
  if (kit.kitType !== kitType) throw new Error(`${file} declares kitType "${kit.kitType}", expected "${kitType}"`);
  return kit;
}

export async function saveKit(kit: KitDefinition, clubsDir: string = CLUBS_DIR): Promise<string> {
  const file = kitDefinitionPath(kit.clubId, kit.kitType, clubsDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(kit, null, 2)}\n`);
  return file;
}
```

- [ ] **Step 4: Ajustar a chamada na CLI**

Em `src/cli/run-cli.ts`, troque `const kitFile = await saveKit(kit, "home", values.clubs);` por `const kitFile = await saveKit(kit, values.clubs);`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/io tests/cli`
Expected: PASS.

- [ ] **Step 6: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/io/club-repository.ts src/cli/run-cli.ts tests/io/club-repository.test.ts
git commit -m "feat: list clubs, load saved kits and validate kit type at runtime"
```

---

### Task 11: `OUTPUT_DIR` e `kitRenderPath`

**Files:**
- Modify: `src/config/paths.ts`
- Test: `tests/config/paths.test.ts` (novo)

**Interfaces:**
- Consumes: `kitAssetFileName`, `RenderType` (`src/fm26/naming.ts`), `KitType`.
- Produces: `OUTPUT_DIR` (`<projeto>/output`); `kitRenderPath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string` = `<outDir>/<clubId>/<renderType>/<kitAssetFileName>`.

- [ ] **Step 1: Escrever os testes que falham em `tests/config/paths.test.ts`**

```ts
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../../src/config/paths.js";

describe("project directories", () => {
  it("places clubs/ and output/ side by side at the project root", async () => {
    expect(path.dirname(OUTPUT_DIR)).toBe(path.dirname(CLUBS_DIR));
    expect(path.basename(OUTPUT_DIR)).toBe("output");
    await expect(access(path.join(path.dirname(CLUBS_DIR), "package.json"))).resolves.toBeUndefined();
  });
});

describe("kitRenderPath", () => {
  it("builds <out>/<club id>/<render type>/<FM26 file name>", () => {
    expect(kitRenderPath("/tmp/out", "galaticos-fc", "away", "2d")).toBe(path.join("/tmp/out", "galaticos-fc", "2d", "galaticos_fc_away_2d.png"));
  });

  it("rejects invalid club ids", () => {
    expect(() => kitRenderPath("/tmp/out", "../escape", "home", "2d")).toThrow(/Invalid club id/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/config`
Expected: FAIL — `OUTPUT_DIR` e `kitRenderPath` não exportados.

- [ ] **Step 3: Reescrever `src/config/paths.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KitType } from "../core/kit.js";
import { kitAssetFileName, type RenderType } from "../fm26/naming.js";

// Dois níveis acima funciona tanto para src/config (tsx) quanto para dist/config (build).
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const CLUBS_DIR = path.join(PROJECT_ROOT, "clubs");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

export function kitRenderPath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string {
  return path.join(outDir, clubId, renderType, kitAssetFileName(clubId, kitType, renderType));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/config`
Expected: PASS (3 testes).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/config/paths.ts tests/config/paths.test.ts
git commit -m "feat: centralize the render output layout in config/paths"
```

---

### Task 12: CLI `generate` com conjunto, `--type` e `--all`

**Files:**
- Modify: `src/cli/run-cli.ts` (reescrita)
- Modify: `tests/fixtures/clubs.ts` (adiciona `KONG_CLUB`)
- Test: `tests/cli/run-cli.test.ts` (reescrita)

**Interfaces:**
- Consumes: `generateKitSet` (Task 9), `listClubIds`/`loadClub`/`saveKit` (Task 10), `kitRenderPath`/`OUTPUT_DIR`/`CLUBS_DIR` (Task 11), `deriveSeed` (Task 4), `KIT_TYPES`/`KitTypeSchema`/`KitType`.
- Produces: `runCli(argv, io)` com `generate (--club <id> | --all) [--type] [--seed] [--out] [--clubs]` e `render`; `USAGE`; `parseSeed` (inalterado); `KONG_CLUB` em `tests/fixtures/clubs.ts`. Comandos internos devolvem o exit code.

- [ ] **Step 1: Adicionar `KONG_CLUB` em `tests/fixtures/clubs.ts`**

Logo após o objeto `GALATICOS_CLUB`:

```ts

export const KONG_CLUB = { id: "kong-team", name: "Kong Team", palette: { primary: "#2e7d32" } };
```

- [ ] **Step 2: Reescrever `tests/cli/run-cli.test.ts`**

```ts
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSeed, runCli, USAGE } from "../../src/cli/run-cli.js";
import { KIT_TYPES, parseKitDefinition, type KitType } from "../../src/core/kit.js";
import { deriveSeed, MAX_SEED } from "../../src/core/random.js";
import { GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
import { makeTempDir } from "../fixtures/temp.js";

function captureIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  return { io: { log: (message: string) => void logs.push(message), error: (message: string) => void errors.push(message) }, logs, errors };
}

async function galaticosClubsDir(): Promise<string> {
  return makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
}

function kitFile(clubs: string, clubId: string, kitType: KitType): string {
  return path.join(clubs, clubId, "kits", kitType, "kit.json");
}

function pngFile(out: string, clubId: string, kitType: KitType): string {
  return path.join(out, clubId, "2d", `${clubId.replaceAll("-", "_")}_${kitType}_2d.png`);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("parseSeed", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["4294967295", MAX_SEED],
  ])("parses %s", (value, expected) => {
    expect(parseSeed(value)).toBe(expected);
  });

  it.each(["-1", "1.5", "abc", "4294967296", "", "1e3"])("rejects %j", (value) => {
    expect(() => parseSeed(value)).toThrow(`Invalid seed "${value}"`);
  });

  it("creates a valid random seed when omitted", () => {
    const seed = parseSeed(undefined);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(MAX_SEED);
  });
});

describe("runCli generate --club", () => {
  it("saves home, away and third definitions and writes their named 2D PNGs", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await makeTempDir("cli")];
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--out", out], io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      const kit = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")));
      expect(kit).toMatchObject({ clubId: "galaticos-fc", kitType, generatedWith: { seed: 42 } });
      expect(await sharp(pngFile(out, "galaticos-fc", kitType)).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    }
    expect(logs[0]).toBe("Seed: 42 (galaticos-fc)");
    expect(logs).toContain("Generated Galáticos FC kits (seed 42)");
    expect(logs).toContain(`  away 2D: ${pngFile(out, "galaticos-fc", "away")}`);
  });

  it("generates only the requested type, identical to the same type in the full set", async () => {
    const [full, single] = [await galaticosClubsDir(), await galaticosClubsDir()];
    const out = await makeTempDir("cli");
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "9", "--clubs", full, "--out", await makeTempDir("cli")], captureIo().io);
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "9", "--type", "away", "--clubs", single, "--out", out], captureIo().io)).toBe(0);
    expect(await readFile(kitFile(single, "galaticos-fc", "away"), "utf8")).toBe(await readFile(kitFile(full, "galaticos-fc", "away"), "utf8"));
    expect(await exists(kitFile(single, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(pngFile(out, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(pngFile(out, "galaticos-fc", "away"))).toBe(true);
  });

  it("keeps every versioned kit.json and logs the seed when a PNG cannot be written", async () => {
    const [clubs, out] = [await galaticosClubsDir(), await makeTempDir("cli")];
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    const before = await Promise.all(KIT_TYPES.map((kitType) => readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")));
    const blocker = path.join(await makeTempDir("cli"), "not-a-dir");
    await writeFile(blocker, "");
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "2", "--clubs", clubs, "--out", blocker], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(await Promise.all(KIT_TYPES.map((kitType) => readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")))).toEqual(before);
    expect(logs).toContain("Seed: 2 (galaticos-fc)");
  });

  it("is reproducible byte for byte for the same seed", async () => {
    const [first, second] = [await galaticosClubsDir(), await galaticosClubsDir()];
    const [firstOut, secondOut] = [await makeTempDir("cli"), await makeTempDir("cli")];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", first, "--out", firstOut], captureIo().io);
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", second, "--out", secondOut], captureIo().io);
    for (const kitType of KIT_TYPES) {
      expect(await readFile(kitFile(second, "galaticos-fc", kitType), "utf8")).toBe(await readFile(kitFile(first, "galaticos-fc", kitType), "utf8"));
      expect((await readFile(pngFile(secondOut, "galaticos-fc", kitType))).equals(await readFile(pngFile(firstOut, "galaticos-fc", kitType)))).toBe(true);
    }
  });

  it.each(["0", "4294967295"])("accepts the boundary seed %s", async (seed) => {
    const { io, logs } = captureIo();
    expect(
      await runCli(["generate", "--club", "galaticos-fc", "--seed", seed, "--clubs", await galaticosClubsDir(), "--out", await makeTempDir("cli")], io),
    ).toBe(0);
    expect(logs[0]).toBe(`Seed: ${seed} (galaticos-fc)`);
  });

  it.each([["--seed", "abc"], ["--seed=-1"], ["--seed", "4294967296"]])("rejects invalid seeds (%s %s)", async (...seedArgs) => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", ...seedArgs, "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toMatch(/Invalid seed/);
  });

  it("rejects unknown kit types", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--type", "fourth", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toContain("Invalid kit type");
  });

  it("reports clubs that fail validation", async () => {
    const clash = { ...GALATICOS_CLUB, palette: { primary: "#123456", secondary: "#1a3d66" } };
    const { io, errors } = captureIo();
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(clash) });
    expect(await runCli(["generate", "--club", "galaticos-fc", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors.join("\n")).toContain('Club "galaticos-fc" is invalid:\n  - distinct-colors: primary #123456 and secondary #1a3d66');
  });

  it("reports unknown clubs", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "ghost", "--clubs", await galaticosClubsDir()], io)).toBe(1);
    expect(errors.join("\n")).toMatch(/Club "ghost" not found/);
  });

  it("requires --club or --all, but not both", async () => {
    const missing = captureIo();
    expect(await runCli(["generate"], missing.io)).toBe(1);
    expect(missing.errors.join("\n")).toContain("Missing required option --club or --all");
    const both = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--all"], both.io)).toBe(1);
    expect(both.errors.join("\n")).toContain("Use either --club or --all, not both");
  });

  it("rejects unknown options", async () => {
    const { io } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--colour", "red"], io)).toBe(1);
  });
});

describe("runCli generate --all", () => {
  it("generates every club and logs one seed per club", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(0);
    for (const clubId of ["galaticos-fc", "kong-team"]) {
      for (const kitType of KIT_TYPES) expect(await exists(kitFile(clubs, clubId, kitType))).toBe(true);
      expect(logs.some((line) => new RegExp(`^Seed: \\d+ \\(${clubId}\\)$`).test(line))).toBe(true);
    }
    expect(logs.at(-1)).toBe("Generated 2 of 2 clubs");
  });

  it("derives a reproducible seed per club from --seed", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs } = captureIo();
    expect(await runCli(["generate", "--all", "--seed", "42", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(0);
    const kongSeed = deriveSeed(42, "kong-team");
    expect(logs).toContain(`Seed: ${kongSeed} (kong-team)`);
    const single = await makeClubsDir({ "kong-team": JSON.stringify(KONG_CLUB) });
    await runCli(["generate", "--club", "kong-team", "--seed", String(kongSeed), "--clubs", single, "--out", await makeTempDir("cli")], captureIo().io);
    expect(await readFile(kitFile(single, "kong-team", "third"), "utf8")).toBe(await readFile(kitFile(clubs, "kong-team", "third"), "utf8"));
  });

  it("keeps going when one club fails and exits with 1", async () => {
    const clubs = await makeClubsDir({ broken: "{ not json", "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[broken\] Invalid JSON in/);
    expect(await exists(kitFile(clubs, "kong-team", "home"))).toBe(true);
    expect(logs.at(-1)).toBe("Generated 1 of 2 clubs");
  });

  it("reports folders whose name is not a valid club id", async () => {
    const clubs = await makeClubsDir({ "Old Club": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--seed", "1", "--clubs", clubs, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[Old Club\] Invalid club id/);
    expect(await exists(kitFile(clubs, "kong-team", "away"))).toBe(true);
  });

  it("reports an empty clubs directory", async () => {
    const clubs = await makeClubsDir({});
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(errors).toEqual([`Error: No clubs found in ${clubs}`]);
  });
});

describe("runCli render", () => {
  it("renders a definition file without randomization", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    const png = path.join(dir, "nested", "kit.png");
    await writeFile(definition, JSON.stringify(makeKit()));
    expect(await runCli(["render", "--definition", definition, "--out", png], captureIo().io)).toBe(0);
    expect(await sharp(png).metadata()).toMatchObject({ width: 414, height: 414 });
  });

  it("reports invalid definitions", async () => {
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify({ ...makeKit(), colors: { primary: "blue" } }));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png")], io)).toBe(1);
    expect(errors.join("\n")).toContain("Invalid kit definition");
  });
});

describe("runCli usage", () => {
  it.each([[[]], [["explode"]]])("prints usage for %j", async (argv) => {
    const { io, errors } = captureIo();
    expect(await runCli(argv, io)).toBe(1);
    expect(errors).toEqual([USAGE]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/cli`
Expected: FAIL — só o Home é gerado, log `Seed: 42` sem o id, `--all`/`--type` desconhecidos.

- [ ] **Step 4: Reescrever `src/cli/run-cli.ts`**

```ts
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../config/paths.js";
import { KIT_TYPES, KitTypeSchema, parseKitDefinition, type KitType } from "../core/kit.js";
import { parseWith } from "../core/primitives.js";
import { deriveSeed, MAX_SEED } from "../core/random.js";
import { generateKitSet } from "../generator/kit-generator.js";
import { listClubIds, loadClub, saveKit } from "../io/club-repository.js";
import { readJsonFile } from "../io/json-file.js";
import { renderKit2dPng } from "../renderers/renderer-2d.js";

export interface CliIo {
  log(message: string): void;
  error(message: string): void;
}

interface GenerateOptions {
  kitTypes: readonly KitType[];
  outDir: string;
  clubsDir: string;
}

export const USAGE = [
  "Usage:",
  "  kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>]",
  "  kit-generator render --definition <kit.json> --out <file.png>",
].join("\n");

export function parseSeed(value: string | undefined): number {
  if (value === undefined) return randomInt(0, MAX_SEED + 1);
  if (!/^\d+$/.test(value) || Number(value) > MAX_SEED) throw new Error(`Invalid seed "${value}": expected an integer between 0 and ${MAX_SEED}`);
  return Number(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeOutput(file: string, content: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function resolveClubIds(values: { club?: string; all?: boolean }, clubsDir: string): Promise<string[]> {
  if (values.club !== undefined && values.all) throw new Error("Use either --club or --all, not both");
  if (values.club !== undefined) return [values.club];
  if (!values.all) throw new Error("Missing required option --club or --all");
  const ids = await listClubIds(clubsDir);
  if (ids.length === 0) throw new Error(`No clubs found in ${clubsDir}`);
  return ids;
}

async function generateClub(clubId: string, seed: number, options: GenerateOptions, io: CliIo): Promise<void> {
  // Seed impressa antes de qualquer efeito colateral, para reproduzir até uma execução que falhou.
  io.log(`Seed: ${seed} (${clubId})`);
  const club = await loadClub(clubId, options.clubsDir);
  const set = generateKitSet(club, seed);
  const kits = options.kitTypes.map((kitType) => set[kitType]);
  // Todos os PNGs antes do primeiro kit.json: uma falha de renderização não deixa o conjunto versionado pela metade.
  const pngFiles: string[] = [];
  for (const kit of kits) {
    const pngFile = kitRenderPath(options.outDir, club.id, kit.kitType, "2d");
    await writeOutput(pngFile, await renderKit2dPng(kit));
    pngFiles.push(pngFile);
  }
  const lines = [`Generated ${club.name} kits (seed ${seed})`];
  for (const [index, kit] of kits.entries()) {
    const kitFile = await saveKit(kit, options.clubsDir);
    lines.push(`  ${kit.kitType} definition: ${kitFile}`, `  ${kit.kitType} 2D: ${pngFiles[index]}`);
  }
  for (const line of lines) io.log(line);
}

async function generateCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    club: { type: "string" },
    all: { type: "boolean", default: false },
    type: { type: "string" },
    seed: { type: "string" },
    out: { type: "string", default: OUTPUT_DIR },
    clubs: { type: "string", default: CLUBS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const kitTypes = values.type === undefined ? KIT_TYPES : [parseWith(KitTypeSchema, values.type, "kit type")];
  const seed = values.seed === undefined ? undefined : parseSeed(values.seed);
  const clubIds = await resolveClubIds(values, values.clubs);
  const generateOptions: GenerateOptions = { kitTypes, outDir: path.resolve(values.out), clubsDir: values.clubs };
  if (!values.all) {
    await generateClub(clubIds[0]!, seed ?? parseSeed(undefined), generateOptions, io);
    return 0;
  }
  let generated = 0;
  for (const clubId of clubIds) {
    try {
      // Com --seed, cada clube recebe uma sub-seed própria; senão clubes com os mesmos pesos repetiriam as mesmas escolhas.
      await generateClub(clubId, seed === undefined ? parseSeed(undefined) : deriveSeed(seed, clubId), generateOptions, io);
      generated++;
    } catch (error) {
      io.error(`Error: [${clubId}] ${errorMessage(error)}`);
    }
  }
  io.log(`Generated ${generated} of ${clubIds.length} clubs`);
  return generated === clubIds.length ? 0 : 1;
}

async function renderCommand(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({ args, options: { definition: { type: "string" }, out: { type: "string" } }, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const kit = parseKitDefinition(await readJsonFile(values.definition));
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKit2dPng(kit));
  io.log(`Rendered ${values.definition} to ${out}`);
  return 0;
}

export async function runCli(argv: string[], io: CliIo = console): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "generate") return await generateCommand(args, io);
    if (command === "render") return await renderCommand(args, io);
    io.error(USAGE);
    return 1;
  } catch (error) {
    io.error(`Error: ${errorMessage(error)}`);
    return 1;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/cli`
Expected: PASS.

- [ ] **Step 6: Gate completo e commit**

Run: `npm run format && npm test && npm run typecheck && npm run build && npm run format:check`

```bash
git add src/cli/run-cli.ts tests/cli/run-cli.test.ts tests/fixtures/clubs.ts
git commit -m "feat: generate the full kit set per club with --type and --all"
```

---

### Task 13: CLI `validate`

**Files:**
- Modify: `src/cli/run-cli.ts`
- Test: `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `loadKit` (Task 10), `validateClub`/`validateKit`/`validateKitSet`/`formatIssues`/`ValidationIssue` (Task 7), `resolveClubIds` (Task 12).
- Produces: `kit-generator validate (--club <id> | --all) [--clubs <dir>]`; `OK <id> (<n> kits)` no stdout; `FAIL <id>\n<issues>` no stderr; exit 1 se algum falhar. Erros de leitura viram issue `invalid-file`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/cli/run-cli.test.ts`, antes de `describe("runCli usage", ...)`:

```ts
describe("runCli validate", () => {
  async function generatedClubsDir(): Promise<string> {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB), "kong-team": JSON.stringify(KONG_CLUB) });
    await runCli(["generate", "--all", "--seed", "3", "--clubs", clubs, "--out", await makeTempDir("cli")], captureIo().io);
    return clubs;
  }

  it("accepts freshly generated clubs", async () => {
    const { io, logs, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", await generatedClubsDir()], io)).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (3 kits)", "OK kong-team (3 kits)"]);
    expect(errors).toEqual([]);
  });

  it("accepts a valid club without kits", async () => {
    const { io, logs } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir()], io)).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (0 kits)"]);
  });

  it("reports every problem of a hand-edited kit set", async () => {
    const clubs = await generatedClubsDir();
    const away = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "away"), "utf8")));
    const clashing = { ...away, pattern: { ...away.pattern, base: "primary", overlay: "primary" } };
    await writeFile(kitFile(clubs, "galaticos-fc", "away"), JSON.stringify(clashing));
    const { io, logs, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(logs).toEqual(["OK kong-team (3 kits)"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("FAIL galaticos-fc\n");
    expect(errors[0]).toContain("  - pattern-contrast: away kit uses primary as both pattern base and overlay");
    expect(errors[0]).toContain("  - kit-clash: home base #123456 and away base #123456");
  });

  it("reports unreadable club and kit files as invalid-file", async () => {
    const clubs = await generatedClubsDir();
    await writeFile(kitFile(clubs, "galaticos-fc", "third"), JSON.stringify(makeKit({ kitType: "home" })));
    await writeFile(path.join(clubs, "kong-team", "club.json"), "{ not json");
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--all", "--clubs", clubs], io)).toBe(1);
    expect(errors[0]).toMatch(/^FAIL galaticos-fc\n  - invalid-file: .*declares kitType "home", expected "third"/);
    expect(errors[1]).toMatch(/^FAIL kong-team\n  - invalid-file: Invalid JSON in/);
  });

  it("reports club rules", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: { zigzag: 1 } } }) });
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", clubs], io)).toBe(1);
    expect(errors[0]).toContain('  - unknown-pattern: style.patternWeights references unknown pattern "zigzag"');
    expect(errors[0]).toContain("  - no-pattern-weight:");
  });

  it("requires --club or --all", async () => {
    const { io, errors } = captureIo();
    expect(await runCli(["validate"], io)).toBe(1);
    expect(errors).toEqual(["Error: Missing required option --club or --all"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/cli`
Expected: FAIL — `validate` cai no `USAGE`.

- [ ] **Step 3: Implementar em `src/cli/run-cli.ts`**

Imports: adicione `import type { ClubIdentity } from "../core/club.js";` antes do import de `core/kit`; troque o import de `core/kit` por `import { KIT_TYPES, KitTypeSchema, parseKitDefinition, type KitDefinition, type KitType } from "../core/kit.js";`; adicione `import { formatIssues, validateClub, validateKit, validateKitSet, type ValidationIssue } from "../core/validation.js";` após o import de `core/random`; troque o import do repositório por `import { listClubIds, loadClub, loadKit, saveKit } from "../io/club-repository.js";`.

Em `USAGE`, adicione como último item: `"  kit-generator validate (--club <id> | --all) [--clubs <dir>]",`.

Antes de `export async function runCli`:

```ts
// Junta todos os problemas do clube em vez de parar no primeiro, para o usuário corrigir tudo de uma vez.
async function validateClubFiles(clubId: string, clubsDir: string): Promise<{ kitCount: number; issues: ValidationIssue[] }> {
  let club: ClubIdentity;
  try {
    club = await loadClub(clubId, clubsDir);
  } catch (error) {
    return { kitCount: 0, issues: [{ rule: "invalid-file", message: errorMessage(error) }] };
  }
  const issues = validateClub(club);
  const kits: Partial<Record<KitType, KitDefinition>> = {};
  for (const kitType of KIT_TYPES) {
    try {
      const kit = await loadKit(club.id, kitType, clubsDir);
      if (kit) kits[kitType] = kit;
    } catch (error) {
      issues.push({ rule: "invalid-file", message: errorMessage(error) });
    }
  }
  const loaded = Object.values(kits);
  issues.push(...loaded.flatMap((kit) => validateKit(kit)), ...validateKitSet(kits));
  return { kitCount: loaded.length, issues };
}

async function validateCommand(args: string[], io: CliIo): Promise<number> {
  const options = { club: { type: "string" }, all: { type: "boolean", default: false }, clubs: { type: "string", default: CLUBS_DIR } } as const;
  const { values } = parseArgs({ args, options, strict: true });
  let failed = 0;
  for (const clubId of await resolveClubIds(values, values.clubs)) {
    const { kitCount, issues } = await validateClubFiles(clubId, values.clubs);
    if (issues.length === 0) {
      io.log(`OK ${clubId} (${kitCount} kits)`);
    } else {
      failed++;
      io.error(`FAIL ${clubId}\n${formatIssues(issues)}`);
    }
  }
  return failed === 0 ? 0 : 1;
}
```

Em `runCli`, logo após a linha do `render`:

```ts
    if (command === "validate") return await validateCommand(args, io);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/cli`
Expected: PASS (39 testes no arquivo).

- [ ] **Step 5: Gate completo e commit**

Run: `npm run format && npm test && npm run typecheck && npm run build && npm run format:check`
Expected: cerca de 243 testes passando.

```bash
git add src/cli/run-cli.ts tests/cli/run-cli.test.ts
git commit -m "feat: add validate command for club and kit files"
```

---

### Task 14: Regenerar o clube de exemplo, inspecionar e documentar

**Files:**
- Modify: `clubs/galaticos-fc/kits/home/kit.json`; Create: `clubs/galaticos-fc/kits/away/kit.json`, `clubs/galaticos-fc/kits/third/kit.json` (via CLI)
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md`

**Interfaces:**
- Consumes: CLI completa (Tasks 12–13).
- Produces: kits versionados do galaticos com seed 42; documentação da Fase 2a.

- [ ] **Step 1: Regenerar e validar**

Run: `npm run kit-generator -- generate --club galaticos-fc --seed 42 && npm run kit-generator -- validate --all`
Expected: `Seed: 42 (galaticos-fc)`, três `definition`/`2D`, depois `OK galaticos-fc (3 kits)`.

- [ ] **Step 2: Inspecionar os três PNGs**

Abra `output/galaticos-fc/2d/galaticos_fc_{home,away,third}_2d.png`. Critério: Home com base navy `#123456` e padrão branco; Away com base branca e padrão ouro `#ffd700`; Third com base ouro e padrão navy; em cada kit a cor base ocupa mais área que o padrão; os três parecem do mesmo clube e são distinguíveis à primeira vista. Se algum critério falhar, pare e reporte com o PNG; não ajuste parâmetros às cegas.

- [ ] **Step 3: Reescrever `README.md`**

````markdown
# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Specs, planos de execução e status: `docs/superpowers/`.

## Status

Fase 2a concluída: gera os kits Home, Away e Third de um clube com a mesma paleta, valida a coerência das cores e renderiza um PNG 2D 414×414 por kit. Ainda não existem escudo, patrocinadores e fabricantes (Fase 2b), textura 3D, `config.xml` nem exportação para o FM26 (Fase 3). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.

## Requisitos

- Node.js 22.12 ou superior

## Instalação

```bash
npm install
```

Os comandos abaixo são executados a partir da raiz do projeto.

## 1. Criar um clube

Crie `clubs/<id>/club.json`. O `id` usa só minúsculas, dígitos e `-`, e deve ser igual ao nome da pasta.

```json
{
  "id": "meu-clube",
  "name": "Meu Clube",
  "fmUniqueId": "123456789",
  "palette": { "primary": "#123456", "secondary": "#FFFFFF", "accent": "#FFD700" },
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } }
}
```

- Só `id`, `name` e `palette.primary` são obrigatórios.
- `secondary` e `accent` ausentes são derivados da cor primária.
- As cores informadas precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15). Cores quase iguais são rejeitadas, porque cada uma vira a cor base de um kit.
- `fmUniqueId` é o Unique ID real do clube no FM26, como string de dígitos. Informe você mesmo; o código nunca o inventa. Nesta fase ele é só validado, ainda não é usado.
- `patternWeights` aceita os padrões `solid`, `stripes` e `sash`, com pesos de 0 a 1.000.000. Sem ele, valem os pesos padrão (40/35/25).
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

Exemplo pronto: `clubs/galaticos-fc/club.json`.

## 2. Gerar os kits

```bash
npm run kit-generator -- generate --club galaticos-fc --seed 42
npm run kit-generator -- generate --all
```

Opções:

| Opção | Descrição |
|---|---|
| `--club <id>` | Clube em `clubs/<id>/club.json`. Use `--club` ou `--all` |
| `--all` | Gera todos os clubes de `clubs/` |
| `--type <tipo>` | Só `home`, `away` ou `third`. Sem ela, os três |
| `--seed <n>` | Inteiro de 0 a 4294967295. Sem ela, uma seed aleatória é sorteada e impressa (`Seed: N (<id>)`) |
| `--out <dir>` | Diretório dos PNGs. Padrão: `output/` na raiz do projeto; um caminho informado é relativo ao diretório atual |
| `--clubs <dir>` | Diretório dos clubes (padrão `clubs/` do projeto) |

Saída, por clube:

- `clubs/<id>/kits/{home,away,third}/kit.json`: definição de cada kit, versionável. `generatedWith.seed` guarda a seed usada. Gerar de novo sobrescreve.
- `output/<id>/2d/<slug>_{home,away,third}_2d.png`: PNG 414×414 com fundo transparente. O `<slug>` é o `id` com `-` trocado por `_` (ex.: `galaticos_fc_away_2d.png`).

Os três kits usam a mesma paleta e alternam os papéis das cores, para se distinguirem em campo:

| Kit | Cor base | Cor do padrão |
|---|---|---|
| Home | primary | secondary |
| Away | secondary | accent |
| Third | accent | primary |

A mesma seed sempre gera os mesmos kits, byte a byte, e `--type away` gera o mesmo Away da geração completa. Para seed que começa com `-`, o Node exige `--seed=-1` (com espaço, o `parseArgs` reclama de argumento ambíguo); de qualquer forma, seeds negativas, fracionárias, vazias ou maiores que 4294967295 são rejeitadas.

Com `--all`, cada clube recebe a própria seed, impressa no log. Com `--all --seed S`, a seed de cada clube é derivada de `S`; use a seed impressa com `--club` para reproduzir só aquele clube. Um clube com erro não interrompe os demais: o comando imprime `Error: [<id>] ...`, termina com o resumo `Generated N of M clubs` e código de saída 1.

## 3. Ajustar à mão e renderizar

Edite o `kit.json` (cores, padrão, parâmetros, gola, mangas) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Parâmetros de padrão fora da faixa são ajustados para o limite. Padrão desconhecido gera erro listando os conhecidos. Depois de editar, rode `validate`.

## 4. Validar

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- validate --club galaticos-fc
```

Confere o `club.json` e cada `kit.json` existente: schema, pasta certa, cores distinguíveis, padrão diferente da base e cores base diferentes entre Home, Away e Third. Imprime `OK <id> (<n> kits)` ou `FAIL <id>` seguido das regras violadas, e termina com código 1 se algum clube falhar.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
npm run format        # formata com Prettier (largura 160)
npm run format:check  # confere a formatação; faz parte do gate de cada fase
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas, validação), `src/patterns` (solid, stripes, sash), `src/generator` (conjunto Home/Away/Third), `src/renderers` (2D), `src/fm26` (nomes de arquivo), `src/io` (clubes, kits e JSON), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
````

- [ ] **Step 4: Reescrever `CLAUDE.md`**

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

CLI em TypeScript (ESM, Node >= 22.12) que gera uniformes aleatórios e reproduzíveis por seed para o Football Manager 2026. Estado atual: Fase 2a concluída. Cada clube ganha Home, Away e Third com a mesma paleta, validados por regras de coerência, e um PNG 2D 414×414 por kit. Escudo, patrocinadores e fabricantes (Fase 2b), exportação para o FM26 (`config.xml`, textura 3D, Fase 3) ainda não existem. Specs: `fm26-procedural-kit-generator-guide.md` (arquitetura), `fm26-kit-export-and-integration.md` (integração FM26) e `docs/superpowers/specs/`. Roadmap, decisões e pendências: `docs/superpowers/plans/2026-10-01-roadmap.md`. Leia o roadmap antes de iniciar qualquer fase nova.

## Comandos

```bash
npm install
npm test                                   # vitest run (toda a suíte)
npx vitest run tests/core/kit.test.ts      # um arquivo de teste
npx vitest run -t "nome do teste"          # um teste por nome
npm run typecheck                          # tsc -p tsconfig.json (inclui tests/)
npm run build                              # tsc -p tsconfig.build.json -> dist/ (só src/)
npm run format                             # Prettier (printWidth 160)
npm run format:check
npm run kit-generator -- generate --club galaticos-fc --seed 42   # Home, Away e Third
npm run kit-generator -- generate --all [--seed 42] [--type away]
npm run kit-generator -- validate --all
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Formatter: Prettier (`printWidth` 160; `npm run format` formata, `npm run format:check` confere). Não há linter. Uma fase só avança com `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes e os PNGs inspecionados visualmente.

## Arquitetura

Fluxo: `club.json` (identidade) → `generateKitSet(identity, seed)` → três `KitDefinition` (dado puro, salvos como `kits/<tipo>/kit.json`) → `renderKit2dPng` (SVG → Sharp → PNG).

- `src/core`: schemas Zod (`club.ts`, `kit.ts`, `primitives.ts`), RNG semeado (`random.ts`: mulberry32 + `deriveSeed` FNV-1a), cores via Color.js (`color.ts` com `colorDistance` ΔE OKLab, `palette.ts`) e regras de coerência (`validation.ts`). Os schemas usam `z.strictObject`: chave desconhecida em `club.json`/`kit.json` é erro de propósito (pega typos como `fmUniqueID`). `KIT_TYPES`/`KitType`/`KitTypeSchema` moram em `core/kit.ts`.
- `src/core/validation.ts`: funções puras que devolvem `ValidationIssue[]` (`rule` + `message`). `validateClub`, `validatePalette`, `validateKit`, `validateKitSet`; limite `MIN_COLOR_DISTANCE = 0.15`. Usadas pelo generator e pelo comando `validate`.
- `src/generator/kit-generator.ts`: **único** ponto que usa aleatoriedade. `generateKitSet` valida o clube, resolve uma paleta (até 20 tentativas com `deriveSeed(seed, "palette:<n>")`) e gera cada kit com `deriveSeed(seed, kitType)`. Papéis em ciclo: Home primary/secondary, Away secondary/accent, Third accent/primary. A ordem das chamadas ao `rng` dentro de `generateKit` é contrato de reprodutibilidade; reordenar muda os kits gerados para a mesma seed.
- `src/patterns`: cada padrão (`solid`, `stripes`, `sash`) é um `PatternTemplate` com `parameters` (min/max/default/integer) e `render()` que devolve fragmento SVG. Novos padrões entram no array de `registry.ts`. O `kit.json` guarda só `pattern.id` + `params`; `resolveParams` faz clamp e usa o default em valores ausentes ou inválidos. Os ranges mantêm o overlay abaixo de metade do tronco (há teste de pixel); um padrão novo precisa respeitar isso.
- `src/renderers`: determinístico. `shirt-2d-shape.ts` tem os paths da camisa (viewBox fixo, a gola muda o path do corpo); `renderer-2d.ts` monta o SVG com `clipPath` e rasteriza.
- `src/fm26/naming.ts`: única fonte de nomes de arquivo (`{slug}_{home|away|third}_{2d|3d}.png`, slug = `id` com `-` trocado por `_`). Não monte nomes de asset em outro lugar.
- `src/config/paths.ts`: `CLUBS_DIR`, `OUTPUT_DIR` e `kitRenderPath(outDir, clubId, kitType, renderType)`. Não monte caminhos de saída em outro lugar.
- `src/io`: `club-repository.ts` tem `listClubIds`, `loadClub` (o `id` do JSON deve bater com a pasta), `loadKit` (confere `clubId` e `kitType` contra a pasta) e `saveKit(kit, clubsDir)` (o tipo vem de `kit.kitType`); `json-file.ts` lê JSON com erros claros.
- `src/cli`: `run-cli.ts` tem `runCli(argv, io)` testável com `CliIo` injetado; comandos devolvem o exit code. `index.ts` é só o entrypoint. Erros viram `Error: ...` no stderr com exit code 1; no `--all`, `Error: [<id>] ...` por clube sem interromper os outros.

## Convenções e armadilhas

- `fmUniqueId` é string numérica informada pelo usuário; o código nunca o inventa nem o deriva do nome. Hoje só é validado.
- `generate` imprime `Seed: N (<id>)` antes de tudo, renderiza todos os PNGs pedidos e só depois grava os `kit.json`, para não sobrescrever kits versionados se a renderização falhar. Mantenha essa ordem.
- `generatedWith.seed` no `kit.json` é a seed do conjunto: `generate --club <id> --seed <ela>` reproduz o kit. `--type` só filtra o que é salvo; o conjunto inteiro é sempre gerado. No `--all --seed S`, cada clube usa `deriveSeed(S, id)`.
- `output/` e `dist/` são ignorados. `--out` e `--clubs` têm padrão relativo à raiz do projeto (`src/config/paths.ts`, funciona em `tsx` e em `dist/`); um `--out` informado é relativo ao diretório atual.
- `--seed` aceita inteiro 0..4294967295; seed que começa com `-` exige `--seed=-1` por causa do `parseArgs`, e mesmo assim é rejeitada.
- Imports internos usam extensão `.js` (`NodeNext` + `verbatimModuleSyntax`); use `import type` para tipos.
- Testes espelham `src/` em `tests/`; fixtures em `tests/fixtures/` (`makeClubsDir` e `makeTempDir` criam pastas temporárias apagadas ao fim de cada teste via `onTestFinished`; só podem ser chamadas dentro de um teste).
- `clubs/*/kits` fica fora do Prettier: esses arquivos são escritos por `JSON.stringify`.
- `docs/fm_templates/` são assets de referência do FM26 (UV, PSDs, máscaras) só para engenharia; o runtime nunca os lê.
- Código e comentários seguem o estilo do repositório: comentários em português, só para o "porquê"; declarações em uma linha quando couberem. O Prettier (largura 160) decide as quebras; interfaces ficam multilinha.
````

- [ ] **Step 5: Atualizar o roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. Troque a frase `Só a Fase 1 tem plano detalhado: \`docs/superpowers/plans/2026-10-01-fase-1-mvp-2d.md\`.` por `Planos detalhados: Fase 1 (\`docs/superpowers/plans/2026-10-01-fase-1-mvp-2d.md\`) e Fase 2a (spec \`docs/superpowers/specs/2026-10-01-fase-2a-conjunto-kits-validacao-design.md\`, plano \`docs/superpowers/plans/2026-10-01-fase-2a-conjunto-kits-validacao.md\`).`
2. Na tabela de status, a linha da Fase 2a passa a `| 2a — Conjunto Home/Away/Third e validação | **Concluída** (<data de hoje>, \`dev\` @ \`<git rev-parse --short HEAD>\`, <total de testes do npm test> testes) |`, preenchida com os valores reais.
3. A linha `Próximo passo: ...` passa a `Próximo passo: spec e plano da Fase 2b (assets, escudo, patrocinadores e fabricantes), com \`superpowers:brainstorming\` e depois \`superpowers:writing-plans\`.`
4. Em "Pendências herdadas da Fase 1", remova os itens resolvidos na 2a: typo do `sash.ts`; validação de `kitType` em runtime; seed no `kit.json`; layout de saída em `paths.ts`; `deriveAccent`; `rng.weighted`; coerência primary × secondary; Prettier e linhas acima de 160 colunas; limpeza de temporários; testes faltando; `@types/node`. Mantenha: `Render2dOptions.size`, teste do `fmUniqueId` do galaticos (Fase 3), trailer "Claude Haiku 4.5", README `npm link`, IDs de `clipPath` fixos.
5. Acrescente ao fim dessa seção: `**Herdado da Fase 2a:** mangas \`solid\` usam a cor do overlay e puxam a leitura do kit para ela (ex.: Home com mangas brancas); avaliar na Fase 4, junto com os componentes de manga. Retry de geração por kit fica para a 2b, quando existirem regras de kit que podem falhar com paleta válida (contraste de patrocinador).`
6. Na seção "Fase 2", troque o título por `## Fase 2 — Conjunto de kits, marcas e validação (2a CONCLUÍDA, 2b pendente)` e acrescente logo abaixo do pré-requisito: `Dividida em 2a (itens 1, 5 e 6, mais as pendências da Fase 1) e 2b (itens 2, 3 e 4). A 2a trocou os papéis de cor do item 1 por um ciclo (Away secondary/accent, Third accent/primary) e limitou a cobertura de \`stripes\`/\`sash\`; ver a spec da 2a.`

- [ ] **Step 6: Gate final**

Run: `npm test && npm run typecheck && npm run build && npm run format:check && npm run kit-generator -- validate --all`
Expected: tudo verde; `OK galaticos-fc (3 kits)`.

- [ ] **Step 7: Commit**

```bash
git add clubs/galaticos-fc/kits README.md CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: regenerate galaticos kits with seed 42 and document phase 2a"
```
