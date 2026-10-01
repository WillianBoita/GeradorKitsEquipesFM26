# Fase 2b — Assets, escudo, patrocinadores e fabricantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kit-generator generate --club galaticos-fc --seed 42` gera Home, Away e Third com escudo, patrocinador e fabricante legíveis no PNG 2D, com os logos registrados por ID e a escolha gravada no `kit.json`.

**Architecture:** `assets/registry.json` (lido por `src/assets/registry.ts`) registra patrocinadores e fabricantes por ID; o escudo fica em `clubs/<id>/logo.png`. O generator sorteia um patrocinador e um fabricante por conjunto (pools ponderados no `club.json`, RNG próprio por rótulo) e escolhe a cor de cada logo de forma determinística: `colorAt` dos padrões diz quais cores ficam atrás da caixa do logo e `chooseLogoColors` acha uma cor (ou cor + contorno) com contraste WCAG ≥ 3. A CLI lê os arquivos (`src/io/asset-repository.ts`) e entrega `Buffer`s ao renderer, que recolore a silhueta, desenha o contorno e compõe com Sharp.

**Tech Stack:** Node.js 24 (mínimo 22.12), TypeScript strict (ESM, NodeNext), Zod 4, Color.js (`colorjs.io`, contraste WCAG 2.1), Sharp 0.35, Vitest 5, tsx, Prettier 3.9.

**Spec:** `docs/superpowers/specs/2026-10-01-fase-2b-assets-logos-design.md` (leia antes de começar). Contexto: `docs/superpowers/plans/2026-10-01-roadmap.md` e `CLAUDE.md`.

## Global Constraints

- Node `>=22.12`; `"type": "module"`; TypeScript `strict`, `NodeNext`, `verbatimModuleSyntax` (`import type` para tipos); imports relativos com extensão `.js`.
- Aleatoriedade só via `Rng` e só no generator. A escolha de cor dos logos é determinística (sem `rng`). Renderers e padrões nunca importam `random.ts`.
- `generateKit` e a ordem das chamadas ao `rng` dentro dele não mudam: para a mesma seed, o desenho é idêntico ao da Fase 2a. Rótulos de `deriveSeed`: `home`, `away`, `third`, `palette:<n>`, `sponsor`, `manufacturer` e, no `--all`, o `id` do clube.
- Registry em `<assets>/registry.json`; `file` relativo à pasta de assets, com `/`, terminando em `.png` ou `.svg`, sem caminho absoluto, `.`, `..` ou segmento vazio. Caminho de logo de marca só via `assetFilePath`; caminho do escudo só via `clubLogoPath` (`clubs/<id>/logo.png`); `ASSETS_DIR` em `src/config/paths.ts`.
- Pools no `club.json`: `sponsors` e `manufacturers`, opcionais, pesos de `0` a `1_000_000`, sorteio sobre as chaves em ordem alfabética, um sorteio por conjunto.
- Contraste: `MIN_LOGO_CONTRAST = 3` (WCAG 2.1 via `contrastRatio`); fundo medido numa grade 24×24 da caixa; papéis com cobertura < `MIN_BACKGROUND_SHARE = 0.05` são ignorados. Candidatas na ordem `primary`, `secondary`, `accent`, `#ffffff`, `#000000`.
- Caixas no viewBox 414 (`LOGO_BOXES`): `badge` `{ x: 232, y: 102, width: 36, height: 36 }`, `manufacturer` `{ x: 149, y: 105, width: 30, height: 30 }`, `sponsor` `{ x: 145, y: 181, width: 124, height: 48 }`. Contorno de `2` unidades do viewBox, escalado e no mínimo 1 px.
- Kit sem `badge`, `sponsor` e `manufacturer` gera PNG byte a byte igual ao da Fase 2a (nenhum `composite`).
- `generate` imprime `Seed: <n> (<id>)` antes de qualquer efeito colateral, renderiza todos os PNGs pedidos e só depois grava os `kit.json`. O registry é carregado uma vez, antes do laço de clubes.
- Mensagens exatas (testadas): `Asset registry not found: <arquivo>`, `Invalid asset registry in <arquivo>:`, `Unknown <sponsor|manufacturer> "<id>" (known: <ids|none>)`, `Sponsor "<id>" file not found: <arquivo>`, `Manufacturer "<id>" file not found: <arquivo>`, `Club "<id>" badge not found: <arquivo>`, `Invalid image file: <arquivo>`, `Kit declares a <slot> but no <slot> image was provided`, `<sponsors|manufacturers> gives no <kind> a positive weight`, `<sponsors|manufacturers> references unknown <kind> "<id>" (known: ...)`, `<tipo> kit references unknown <kind> "<id>" (known: ...)`, `<tipo> kit <kind> <hex> has contrast <x.xx> against <papel> <hex> (minimum 3)`, `<tipo> kit <kind> <hex> with outline <hex> has contrast ...`, `<tipo> kit <kind> <hex> and its outline <hex> have contrast <x.xx> (minimum 3)`, `<kind> "<id>" file not found: <arquivo>`, `club badge not found: <arquivo>`, `<kind> "<id>" (<file>) has no transparent pixels`, `<kind> "<id>" (<file>) is not a valid image`, `club badge <arquivo> is not a valid image`.
- Formatação: Prettier `printWidth: 160` decide as quebras; rode `npm run format` antes de cada commit. Interfaces ficam multilinha. Comentários em português, só para o "porquê"; declarações em uma linha quando couberem.
- Nunca criar/editar arquivos com heredoc no Bash; usar Write/Edit. Nunca usar `cd`; os comandos abaixo rodam na raiz do projeto (diretório de trabalho da sessão).
- Commits em Conventional Commits, na branch `dev`, com o trailer de co-autoria do modelo que executa.
- Gate de cada tarefa: `npm test`, `npm run typecheck` e `npm run format:check` verdes antes do commit. `npm run build` também no fim das tarefas 1, 8, 11 e 12.

## Review Focus

1. Arquivo de logo que não é imagem (texto, PNG corrompido) no registry ou como `logo.png`: `generate`/`render` falham com `Invalid image file: <caminho>` e `validate` acusa `invalid-file`, nunca com o `Input buffer contains unsupported image format` cru do Sharp. Testes: Task 9 (`loadKitLogos`, `checkAssetFiles`) e Task 11 (`validate`).
2. Caminho de asset que tenta sair de `assets/` (`sponsors/../../x.png`, `./x.png`, `sponsors\x.png`, `/etc/x.png`, `sponsors//x.png`): registry rejeitado com a mensagem que nomeia o `registry.json`. Testes: Task 1.
3. SVG só com `viewBox`, minúsculo (6×2) ou enorme (4000×4000): o logo sai nítido no tamanho da caixa e o Sharp não estoura. Testes: Task 8 (`fitImage`).
4. `kit.json` editado à mão com `badge: true` num clube sem `logo.png`, ou `sponsor.id` fora do registry: `render`/`generate` falham nomeando clube ou ID; `validate` aponta `missing-asset`/`unknown-asset`. Testes: Task 9, Task 10 e Task 11.
5. `generate --all` com um clube de pool inválido ou arquivo de logo faltando: só aquele clube falha, nenhum `kit.json` dele é gravado, os outros são gerados, resumo `Generated N of M clubs`, exit code 1. Testes: Task 10.

---

## Estrutura de arquivos

```text
assets/registry.json                      novo: registry de patrocinadores e fabricantes
assets/sponsors/{luna-air,orbita-bank}.svg  novos: logos fictícios (só path)
assets/manufacturers/vertex.svg           novo
clubs/galaticos-fc/club.json              + pools (Task 12)
clubs/galaticos-fc/logo.png               novo: escudo (Task 12)
clubs/galaticos-fc/kits/*/kit.json        regenerados com seed 42 (Task 12)
src/
  assets/registry.ts         novo: schema, loadAssetRegistry, findAsset, getAsset, knownAssetIds, assetFilePath
  config/paths.ts            + ASSETS_DIR
  core/primitives.ts         + AssetIdSchema
  core/kit.ts                + BRAND_KINDS, BRAND_LISTS, LogoColorSchema, badge/sponsor/manufacturer, LogoSlot, isColorRole, resolveLogoColor
  core/club.ts               + pools sponsors/manufacturers
  core/logo-colors.ts        novo: backgroundRoles, chooseLogoColors, MIN_LOGO_CONTRAST
  core/validation.ts         + no-asset-weight, validateClubAssets, validateKitAssets, logo-contrast
  patterns/types.ts          + PatternGeometry, PatternLayer, colorAt
  patterns/{solid,stripes,sash}.ts  + colorAt
  renderers/shirt-2d-shape.ts  + LogoBox, LOGO_BOXES
  renderers/logo-image.ts    novo: fitImage, brandLogoLayers, badgeLayer
  renderers/renderer-2d.ts   + KitLogoImages, Render2dOptions.logos, composição
  generator/kit-generator.ts + KitSetOptions, sorteio por pool, logos
  io/club-repository.ts      + clubLogoPath, hasClubLogo
  io/asset-repository.ts     novo: loadKitLogos, checkAssetFiles
  cli/run-cli.ts             --assets; generate/render com logos; validate com regras de asset
tests/ (espelha src/) + tests/assets/registry.test.ts, tests/core/logo-colors.test.ts, tests/renderers/logo-image.test.ts, tests/io/asset-repository.test.ts, tests/fixtures/assets.ts (novos)
README.md, CLAUDE.md, docs/superpowers/plans/2026-10-01-roadmap.md   documentação final (Task 12)
```

---

### Task 1: Registry de assets e logos de amostra

**Files:**
- Modify: `src/core/primitives.ts`, `src/core/kit.ts`, `src/config/paths.ts`
- Create: `src/assets/registry.ts`, `assets/registry.json`, `assets/sponsors/luna-air.svg`, `assets/sponsors/orbita-bank.svg`, `assets/manufacturers/vertex.svg`
- Test: `tests/assets/registry.test.ts` (novo), `tests/config/paths.test.ts`

**Interfaces:**
- Consumes: `parseWith`, `ClubIdSchema` (`src/core/primitives.ts`); `readJsonFile`, `FileNotFoundError` (`src/io/json-file.ts`).
- Produces:
  - `AssetIdSchema` em `src/core/primitives.ts`.
  - `BRAND_KINDS = ["sponsor", "manufacturer"] as const`, `BRAND_LISTS = { sponsor: "sponsors", manufacturer: "manufacturers" } as const`, `type BrandKind` em `src/core/kit.ts`.
  - `ASSETS_DIR` em `src/config/paths.ts`.
  - Em `src/assets/registry.ts`: `AssetRegistrySchema`, `type AssetEntry = { id: string; name: string; file: string }`, `type AssetRegistry = { sponsors: AssetEntry[]; manufacturers: AssetEntry[] }`, `loadAssetRegistry(assetsDir: string): Promise<AssetRegistry>`, `findAsset(registry, kind: BrandKind, id: string): AssetEntry | undefined`, `knownAssetIds(registry, kind: BrandKind): string`, `getAsset(registry, kind: BrandKind, id: string): AssetEntry`, `assetFilePath(assetsDir: string, entry: AssetEntry): string`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/assets/registry.test.ts`:

```ts
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assetFilePath, findAsset, getAsset, knownAssetIds, loadAssetRegistry, type AssetRegistry } from "../../src/assets/registry.js";
import { ASSETS_DIR } from "../../src/config/paths.js";
import { makeTempDir } from "../fixtures/temp.js";

const REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.png" },
  ],
  manufacturers: [],
};

async function registryDir(content: unknown): Promise<string> {
  const dir = await makeTempDir("assets");
  await writeFile(path.join(dir, "registry.json"), JSON.stringify(content));
  return dir;
}

function withSponsorFile(file: string): unknown {
  return { ...REGISTRY, sponsors: [{ id: "luna-air", name: "Luna Air", file }] };
}

describe("loadAssetRegistry", () => {
  it("loads registry.json from the assets folder", async () => {
    expect(await loadAssetRegistry(await registryDir(REGISTRY))).toEqual(REGISTRY);
  });

  it("loads the bundled registry, whose files all exist", async () => {
    const registry = await loadAssetRegistry(ASSETS_DIR);
    const entries = [...registry.sponsors, ...registry.manufacturers];
    expect(entries.map((entry) => entry.id)).toEqual(["luna-air", "orbita-bank", "vertex"]);
    for (const entry of entries) await expect(access(assetFilePath(ASSETS_DIR, entry))).resolves.toBeUndefined();
  });

  it("reports a missing registry file", async () => {
    const dir = await makeTempDir("assets");
    await expect(loadAssetRegistry(dir)).rejects.toThrow(`Asset registry not found: ${path.join(dir, "registry.json")}`);
  });

  // Nenhum asset pode sair da pasta de assets.
  it.each(["/etc/logo.png", "../logo.png", "sponsors/../../logo.png", "./sponsors/logo.png", "sponsors\\logo.png", "sponsors//logo.png", "sponsors/logo.jpg", "sponsors/logo"])(
    "rejects the file path %j",
    async (file) => {
      const dir = await registryDir(withSponsorFile(file));
      await expect(loadAssetRegistry(dir)).rejects.toThrow(`Invalid asset registry in ${path.join(dir, "registry.json")}`);
    },
  );

  it("rejects ids repeated inside a list", async () => {
    const dir = await registryDir({ ...REGISTRY, sponsors: [REGISTRY.sponsors[0], REGISTRY.sponsors[0]] });
    await expect(loadAssetRegistry(dir)).rejects.toThrow(/ids must be unique/);
  });

  it("rejects invalid ids", async () => {
    const dir = await registryDir({ ...REGISTRY, manufacturers: [{ id: "Vertex", name: "Vertex", file: "manufacturers/vertex.svg" }] });
    await expect(loadAssetRegistry(dir)).rejects.toThrow(/manufacturers\[0\]\.id/);
  });

  it("rejects unknown keys and requires both lists", async () => {
    await expect(loadAssetRegistry(await registryDir({ ...REGISTRY, logos: [] }))).rejects.toThrow(/logos/);
    await expect(loadAssetRegistry(await registryDir({ sponsors: [] }))).rejects.toThrow(/manufacturers/);
  });
});

describe("registry lookups", () => {
  it("finds entries by kind and id", () => {
    expect(findAsset(REGISTRY, "sponsor", "orbita-bank")).toEqual(REGISTRY.sponsors[1]);
    expect(findAsset(REGISTRY, "manufacturer", "orbita-bank")).toBeUndefined();
    expect(getAsset(REGISTRY, "sponsor", "luna-air")).toEqual(REGISTRY.sponsors[0]);
  });

  it("lists the known ids when an id is unknown", () => {
    expect(() => getAsset(REGISTRY, "sponsor", "acme")).toThrow('Unknown sponsor "acme" (known: luna-air, orbita-bank)');
    expect(() => getAsset(REGISTRY, "manufacturer", "kong")).toThrow('Unknown manufacturer "kong" (known: none)');
    expect(knownAssetIds(REGISTRY, "manufacturer")).toBe("none");
  });

  it("resolves files inside the assets folder", () => {
    expect(assetFilePath("/tmp/assets", REGISTRY.sponsors[0]!)).toBe(path.join("/tmp/assets", "sponsors", "luna-air.svg"));
  });
});
```

Em `tests/config/paths.test.ts`, trocar o import para `import { ASSETS_DIR, CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../../src/config/paths.js";` e acrescentar dentro de `describe("project directories")`:

```ts
  it("places assets/ next to clubs/", () => {
    expect(path.dirname(ASSETS_DIR)).toBe(path.dirname(CLUBS_DIR));
    expect(path.basename(ASSETS_DIR)).toBe("assets");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/assets tests/config`
Expected: FAIL — `tests/assets/registry.test.ts` não carrega (`src/assets/registry.js` não existe) e `ASSETS_DIR` é `undefined`.

- [ ] **Step 3: Implementar**

`src/core/primitives.ts`, logo após `ClubIdSchema`:

```ts
// Mesma regra do id de clube: o id de asset vira chave de pool e parte de mensagens.
export const AssetIdSchema = ClubIdSchema;
```

`src/core/kit.ts`, logo após `export const SLEEVE_STYLES = ...`:

```ts
// Logos de marca: o id aponta para o registry de assets.
export const BRAND_KINDS = ["sponsor", "manufacturer"] as const;
// Nome da lista no registry e do pool no club.json para cada tipo de marca.
export const BRAND_LISTS = { sponsor: "sponsors", manufacturer: "manufacturers" } as const;
```

e, junto dos outros `type`:

```ts
export type BrandKind = (typeof BRAND_KINDS)[number];
```

`src/config/paths.ts`, logo após `OUTPUT_DIR`:

```ts
export const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
```

Criar `src/assets/registry.ts`:

```ts
import path from "node:path";
import { z } from "zod";
import { BRAND_LISTS, type BrandKind } from "../core/kit.js";
import { AssetIdSchema, parseWith } from "../core/primitives.js";
import { FileNotFoundError, readJsonFile } from "../io/json-file.js";

// Relativo à pasta de assets e sem como sair dela: nada de caminho absoluto, "\", segmento vazio, "." ou "..".
const AssetFileSchema = z
  .string()
  .regex(/^(?:[^/\\]+\/)*[^/\\]+\.(?:png|svg)$/, "must be a relative path inside the assets folder ending in .png or .svg")
  .refine((file) => !file.split("/").some((segment) => segment === "." || segment === ".."), "must not contain . or .. segments");

const AssetEntrySchema = z.strictObject({ id: AssetIdSchema, name: z.string().min(1), file: AssetFileSchema });
const AssetListSchema = z.array(AssetEntrySchema).refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, "ids must be unique");

export const AssetRegistrySchema = z.strictObject({ sponsors: AssetListSchema, manufacturers: AssetListSchema });

export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type AssetRegistry = z.infer<typeof AssetRegistrySchema>;

export async function loadAssetRegistry(assetsDir: string): Promise<AssetRegistry> {
  const file = path.join(assetsDir, "registry.json");
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) throw new Error(`Asset registry not found: ${file}`);
    throw error;
  }
  return parseWith(AssetRegistrySchema, raw, `asset registry in ${file}`);
}

export function findAsset(registry: AssetRegistry, kind: BrandKind, id: string): AssetEntry | undefined {
  return registry[BRAND_LISTS[kind]].find((entry) => entry.id === id);
}

export function knownAssetIds(registry: AssetRegistry, kind: BrandKind): string {
  const ids = registry[BRAND_LISTS[kind]].map((entry) => entry.id);
  return ids.length > 0 ? ids.join(", ") : "none";
}

export function getAsset(registry: AssetRegistry, kind: BrandKind, id: string): AssetEntry {
  const entry = findAsset(registry, kind, id);
  if (!entry) throw new Error(`Unknown ${kind} "${id}" (known: ${knownAssetIds(registry, kind)})`);
  return entry;
}

export function assetFilePath(assetsDir: string, entry: AssetEntry): string {
  return path.join(assetsDir, ...entry.file.split("/"));
}
```

Criar os logos de amostra (silhuetas: só a transparência importa; sem `<text>`).

`assets/sponsors/luna-air.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path fill-rule="evenodd" d="M4 20a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z M13 17a11 11 0 1 0 22 0a11 11 0 1 0 -22 0Z"/><path d="M44 9H116L111 15H44Z M52 18H106L101 24H52Z M60 27H96L91 33H60Z"/></svg>
```

`assets/sponsors/orbita-bank.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path fill-rule="evenodd" transform="rotate(-20 20 20)" d="M2 20a18 6 0 1 0 36 0a18 6 0 1 0 -36 0Z M5 20a15 3.5 0 1 0 30 0a15 3.5 0 1 0 -30 0Z"/><path d="M12 20a8 8 0 1 0 16 0a8 8 0 1 0 -16 0Z"/><path d="M46 9L81 3L116 9V12H46Z M50 14H58V28H50Z M66 14H74V28H66Z M82 14H90V28H82Z M98 14H106V28H98Z M46 30H116V35H46Z"/></svg>
```

`assets/manufacturers/vertex.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M3 6H13L20 22L27 6H37L20 36Z"/></svg>
```

`assets/registry.json`:

```json
{
  "sponsors": [
    { "id": "luna-air", "name": "Luna Air", "file": "sponsors/luna-air.svg" },
    { "id": "orbita-bank", "name": "Órbita Bank", "file": "sponsors/orbita-bank.svg" }
  ],
  "manufacturers": [{ "id": "vertex", "name": "Vertex", "file": "manufacturers/vertex.svg" }]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/assets tests/config`
Expected: PASS (todos os casos de `registry.test.ts` e `paths.test.ts`).

- [ ] **Step 5: Gate, build e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check && npm run build`
Expected: tudo verde.

```bash
git add src/core/primitives.ts src/core/kit.ts src/config/paths.ts src/assets/registry.ts assets tests/assets/registry.test.ts tests/config/paths.test.ts
git commit -m "feat: add asset registry for sponsors and manufacturers with sample logos"
```

---

### Task 2: Pools de patrocinador e fabricante no `club.json`

**Files:**
- Modify: `src/core/club.ts`, `src/core/validation.ts`
- Test: `tests/core/club.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `AssetIdSchema`, `BRAND_KINDS`, `BRAND_LISTS` (Task 1); `findAsset`, `knownAssetIds`, `type AssetRegistry` (Task 1).
- Produces:
  - `ClubIdentity.sponsors?: Record<string, number>` e `ClubIdentity.manufacturers?: Record<string, number>`.
  - Regra `no-asset-weight` dentro de `validateClub(identity)`.
  - `validateClubAssets(identity: ClubIdentity, registry: AssetRegistry): ValidationIssue[]` (regra `unknown-asset`).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/club.test.ts`, no fim do `describe("parseClubIdentity")`:

```ts
  it("accepts sponsor and manufacturer pools", () => {
    const club = parseClubIdentity({ ...galaticos, sponsors: { "luna-air": 3, "orbita-bank": 0 }, manufacturers: { vertex: 1 } });
    expect(club.sponsors).toEqual({ "luna-air": 3, "orbita-bank": 0 });
    expect(club.manufacturers).toEqual({ vertex: 1 });
  });

  it("rejects pool keys that are not asset ids", () => {
    expect(() => parseClubIdentity({ ...galaticos, sponsors: { "Luna Air": 1 } })).toThrow(/sponsors/);
  });

  it.each([-1, 1_000_001])("rejects the pool weight %d", (weight) => {
    expect(() => parseClubIdentity({ ...galaticos, manufacturers: { vertex: weight } })).toThrow(/manufacturers/);
  });

  it("rejects a misspelled pool key", () => {
    expect(() => parseClubIdentity({ ...galaticos, sponsor: { "luna-air": 1 } })).toThrow(/sponsor/);
  });
```

Em `tests/core/validation.test.ts`, trocar os imports do topo por:

```ts
import { describe, expect, it } from "vitest";
import type { AssetRegistry } from "../../src/assets/registry.js";
import { parseClubIdentity } from "../../src/core/club.js";
import type { KitDefinition } from "../../src/core/kit.js";
import { formatIssues, validateClub, validateClubAssets, validateColors, validateKit, validateKitSet, validatePalette } from "../../src/core/validation.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
```

logo após `const PALETTE = ...`:

```ts
const REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.svg" },
  ],
  manufacturers: [{ id: "vertex", name: "Vertex", file: "manufacturers/vertex.svg" }],
};
```

no fim do `describe("validateClub")`:

```ts
  it("accepts pools with at least one positive weight", () => {
    expect(validateClub(club({ sponsors: { "luna-air": 0, "orbita-bank": 2 }, manufacturers: { vertex: 1 } }))).toEqual([]);
  });

  it("reports pools without any positive weight", () => {
    expect(validateClub(club({ sponsors: { "luna-air": 0 }, manufacturers: {} }))).toEqual([
      { rule: "no-asset-weight", message: "sponsors gives no sponsor a positive weight" },
      { rule: "no-asset-weight", message: "manufacturers gives no manufacturer a positive weight" },
    ]);
  });
```

e um bloco novo depois do `describe("validateClub")`:

```ts
describe("validateClubAssets", () => {
  it("accepts clubs without pools or with registered ids", () => {
    expect(validateClubAssets(club(), REGISTRY)).toEqual([]);
    expect(validateClubAssets(club({ sponsors: { "luna-air": 1 }, manufacturers: { vertex: 1 } }), REGISTRY)).toEqual([]);
  });

  it("reports pool ids missing from the registry", () => {
    expect(validateClubAssets(club({ sponsors: { acme: 1, "luna-air": 1 }, manufacturers: { kong: 1 } }), REGISTRY)).toEqual([
      { rule: "unknown-asset", message: 'sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)' },
      { rule: "unknown-asset", message: 'manufacturers references unknown manufacturer "kong" (known: vertex)' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/club.test.ts tests/core/validation.test.ts`
Expected: FAIL — `sponsors`/`manufacturers` são chave desconhecida no schema estrito, `no-asset-weight` não existe e `validateClubAssets is not a function`.

- [ ] **Step 3: Implementar**

Substituir `src/core/club.ts` inteiro por:

```ts
import { z } from "zod";
import { AssetIdSchema, ClubIdSchema, HexColorSchema, parseWith } from "./primitives.js";

// O teto mantém finita a soma dos pesos em rng.weighted.
const WeightSchema = z.number().nonnegative().max(1_000_000);
// Pesos por id do registry de assets; o sorteio usa as chaves em ordem alfabética.
const AssetPoolSchema = z.record(AssetIdSchema, WeightSchema);

export const ClubIdentitySchema = z.strictObject({
  id: ClubIdSchema,
  name: z.string().min(1),
  // String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário.
  fmUniqueId: z.string().regex(/^\d+$/, "must be the numeric FM Unique ID as a string").optional(),
  palette: z.strictObject({ primary: HexColorSchema, secondary: HexColorSchema.optional(), accent: HexColorSchema.optional() }),
  style: z
    .strictObject({ categories: z.array(z.string()).default([]), patternWeights: z.record(z.string(), WeightSchema).optional() })
    .default({ categories: [] }),
  sponsors: AssetPoolSchema.optional(),
  manufacturers: AssetPoolSchema.optional(),
});

export type ClubIdentity = z.infer<typeof ClubIdentitySchema>;

export function parseClubIdentity(input: unknown): ClubIdentity {
  return parseWith(ClubIdentitySchema, input, "club identity");
}
```

Em `src/core/validation.ts`, trocar os imports do topo por:

```ts
import { findAsset, knownAssetIds, type AssetRegistry } from "../assets/registry.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { ClubIdentity } from "./club.js";
import { colorDistance } from "./color.js";
import { BRAND_KINDS, BRAND_LISTS, COLOR_ROLES, KIT_TYPES, type ColorRole, type KitDefinition, type KitType } from "./kit.js";
import type { Palette } from "./palette.js";
```

Em `validateClub`, logo antes de `return [...issues, ...validateColors(identity.palette)];`:

```ts
  for (const kind of BRAND_KINDS) {
    const pool = identity[BRAND_LISTS[kind]];
    if (pool && !Object.values(pool).some((weight) => weight > 0)) {
      issues.push({ rule: "no-asset-weight", message: `${BRAND_LISTS[kind]} gives no ${kind} a positive weight` });
    }
  }
```

Logo depois de `validateClub`:

```ts
export function validateClubAssets(identity: ClubIdentity, registry: AssetRegistry): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) =>
    Object.keys(identity[BRAND_LISTS[kind]] ?? {})
      .filter((id) => !findAsset(registry, kind, id))
      .map((id) => ({ rule: "unknown-asset", message: `${BRAND_LISTS[kind]} references unknown ${kind} "${id}" (known: ${knownAssetIds(registry, kind)})` })),
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core tests/generator`
Expected: PASS. O generator ainda ignora os pools (eles só entram na Task 7).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/club.ts src/core/validation.ts tests/core/club.test.ts tests/core/validation.test.ts
git commit -m "feat: add weighted sponsor and manufacturer pools to club identity"
```

---

### Task 3: Logos no `KitDefinition`

**Files:**
- Modify: `src/core/kit.ts`, `src/core/validation.ts`
- Test: `tests/core/kit.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `AssetIdSchema` (Task 1); `BRAND_KINDS`, `BRAND_LISTS`, `BrandKind` (Task 1); `findAsset`, `knownAssetIds` (Task 1); `REGISTRY` de `tests/core/validation.test.ts` (Task 2).
- Produces (em `src/core/kit.ts`):
  - `LogoColorSchema = z.union([ColorRoleSchema, HexColorSchema])`, `type LogoColor`, `type BrandLogo = { id: string; color: LogoColor; outline?: LogoColor }`.
  - `KitDefinition.badge?: boolean`, `KitDefinition.sponsor?: BrandLogo`, `KitDefinition.manufacturer?: BrandLogo`.
  - `type LogoSlot = "badge" | BrandKind`.
  - `isColorRole(value: string): value is ColorRole`, `resolveLogoColor(kit: KitDefinition, value: LogoColor): string`.
  - `validateKitAssets(kit: KitDefinition, registry: AssetRegistry): ValidationIssue[]` em `src/core/validation.ts`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/kit.test.ts`, trocar o import de `kit.js` por `import { KIT_TYPES, parseKitDefinition, resolveLogoColor } from "../../src/core/kit.js";` e acrescentar no fim do `describe("parseKitDefinition")`:

```ts
  it("accepts badge, sponsor and manufacturer and keeps them through a JSON round trip", () => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air", color: "primary", outline: "secondary" }, manufacturer: { id: "vertex", color: "#000000" } });
    expect(parseKitDefinition(JSON.parse(JSON.stringify(kit)))).toEqual(kit);
  });

  it("keeps Phase 2a kits without logos valid", () => {
    const kit = parseKitDefinition(makeKit());
    expect(kit).not.toHaveProperty("badge");
    expect(kit).not.toHaveProperty("sponsor");
    expect(kit).not.toHaveProperty("manufacturer");
  });

  it("normalizes hex logo colors", () => {
    expect(parseKitDefinition(makeKit({ sponsor: { id: "luna-air", color: "#FFF" } })).sponsor).toEqual({ id: "luna-air", color: "#ffffff" });
  });

  it("rejects logo colors that are neither a palette role nor a hex color", () => {
    expect(() => parseKitDefinition({ ...makeKit(), sponsor: { id: "luna-air", color: "gold" } })).toThrow(/sponsor\.color/);
  });

  it("rejects invalid logo ids and unknown logo keys", () => {
    expect(() => parseKitDefinition({ ...makeKit(), manufacturer: { id: "Vertex", color: "primary" } })).toThrow(/manufacturer\.id/);
    expect(() => parseKitDefinition({ ...makeKit(), sponsor: { id: "luna-air", color: "primary", colour: "accent" } })).toThrow(/colour/);
  });
```

e um bloco novo no fim do arquivo:

```ts
describe("resolveLogoColor", () => {
  it("resolves palette roles and keeps hex colors", () => {
    expect(resolveLogoColor(makeKit(), "accent")).toBe("#ffd700");
    expect(resolveLogoColor(makeKit(), "#000000")).toBe("#000000");
  });
});
```

Em `tests/core/validation.test.ts`, acrescentar `validateKitAssets` ao import de `validation.js` e um bloco novo depois do `describe("validateKit")`:

```ts
describe("validateKitAssets", () => {
  it("accepts kits without logos or with registered ids", () => {
    expect(validateKitAssets(makeKit(), REGISTRY)).toEqual([]);
    expect(validateKitAssets(makeKit({ sponsor: { id: "luna-air", color: "secondary" }, manufacturer: { id: "vertex", color: "secondary" } }), REGISTRY)).toEqual([]);
  });

  it("reports sponsor and manufacturer ids missing from the registry", () => {
    const kit = makeKit({ kitType: "away", sponsor: { id: "acme", color: "primary" }, manufacturer: { id: "kong", color: "primary" } });
    expect(validateKitAssets(kit, REGISTRY)).toEqual([
      { rule: "unknown-asset", message: 'away kit references unknown sponsor "acme" (known: luna-air, orbita-bank)' },
      { rule: "unknown-asset", message: 'away kit references unknown manufacturer "kong" (known: vertex)' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/kit.test.ts tests/core/validation.test.ts`
Expected: FAIL — `badge`/`sponsor`/`manufacturer` são chave desconhecida, `resolveLogoColor` e `validateKitAssets` não existem.

- [ ] **Step 3: Implementar**

Substituir `src/core/kit.ts` inteiro por:

```ts
import { z } from "zod";
import { AssetIdSchema, ClubIdSchema, HexColorSchema, parseWith, SeedSchema } from "./primitives.js";

export const KIT_TYPES = ["home", "away", "third"] as const;
export const COLOR_ROLES = ["primary", "secondary", "accent"] as const;
export const COLLAR_STYLES = ["round", "v-neck"] as const;
export const SLEEVE_STYLES = ["match-body", "solid"] as const;
// Logos de marca: o id aponta para o registry de assets.
export const BRAND_KINDS = ["sponsor", "manufacturer"] as const;
// Nome da lista no registry e do pool no club.json para cada tipo de marca.
export const BRAND_LISTS = { sponsor: "sponsors", manufacturer: "manufacturers" } as const;

export const KitTypeSchema = z.enum(KIT_TYPES);
export const ColorRoleSchema = z.enum(COLOR_ROLES);
// Papel acompanha edições da paleta; hex cobre branco e preto, que não são papéis.
export const LogoColorSchema = z.union([ColorRoleSchema, HexColorSchema]);
const BrandLogoSchema = z.strictObject({ id: AssetIdSchema, color: LogoColorSchema, outline: LogoColorSchema.optional() });

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
  badge: z.boolean().optional(),
  sponsor: BrandLogoSchema.optional(),
  manufacturer: BrandLogoSchema.optional(),
});

export type KitType = z.infer<typeof KitTypeSchema>;
export type ColorRole = z.infer<typeof ColorRoleSchema>;
export type CollarStyle = (typeof COLLAR_STYLES)[number];
export type BrandKind = (typeof BRAND_KINDS)[number];
export type LogoSlot = "badge" | BrandKind;
export type LogoColor = z.infer<typeof LogoColorSchema>;
export type BrandLogo = z.infer<typeof BrandLogoSchema>;
export type KitDefinition = z.infer<typeof KitDefinitionSchema>;

export function parseKitDefinition(input: unknown): KitDefinition {
  return parseWith(KitDefinitionSchema, input, "kit definition");
}

export function isColorRole(value: string): value is ColorRole {
  return (COLOR_ROLES as readonly string[]).includes(value);
}

export function resolveLogoColor(kit: KitDefinition, value: LogoColor): string {
  return isColorRole(value) ? kit.colors[value] : value;
}
```

Em `src/core/validation.ts`, logo depois de `validateKit`:

```ts
export function validateKitAssets(kit: KitDefinition, registry: AssetRegistry): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) => {
    const logo = kit[kind];
    if (!logo || findAsset(registry, kind, logo.id)) return [];
    return [{ rule: "unknown-asset", message: `${kit.kitType} kit references unknown ${kind} "${logo.id}" (known: ${knownAssetIds(registry, kind)})` }];
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core tests/io tests/cli`
Expected: PASS.

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/kit.ts src/core/validation.ts tests/core/kit.test.ts tests/core/validation.test.ts
git commit -m "feat: add badge, sponsor and manufacturer fields to the kit definition"
```

---

### Task 4: `colorAt` nos padrões

**Files:**
- Modify: `src/patterns/types.ts`, `src/patterns/solid.ts`, `src/patterns/stripes.ts`, `src/patterns/sash.ts`
- Test: `tests/patterns/patterns.test.ts`

**Interfaces:**
- Consumes: `resolveParams`, `getPatternTemplate`, `listPatternTemplates`.
- Produces (em `src/patterns/types.ts`):
  - `type PatternLayer = "base" | "overlay"`.
  - `interface PatternGeometry { width: number; height: number; params: Record<string, number> }`; `PatternRenderContext` passa a estender `PatternGeometry` com `base` e `overlay`.
  - `PatternTemplate.colorAt(x: number, y: number, geometry: PatternGeometry): PatternLayer` (params já resolvidos).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/patterns/patterns.test.ts`, acrescentar `import sharp from "sharp";` depois do import de `fast-xml-parser`, e logo depois de `function wrap(...)`:

```ts
// Padrão em branco sobre preto; compara colorAt com o pixel numa grade, pulando pontos a menos de 1,5 px de uma borda (antialias).
async function colorAtMismatches(template: PatternTemplate, raw: Record<string, number>): Promise<{ checked: number; mismatches: number }> {
  const geometry = { width: SIZE, height: SIZE, params: resolveParams(template, raw) };
  const svg = wrap(`<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>${template.render({ ...geometry, base: "#000000", overlay: "#ffffff" })}`);
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  let checked = 0;
  let mismatches = 0;
  for (let py = 2; py < SIZE; py += 7) {
    for (let px = 2; px < SIZE; px += 7) {
      const [x, y] = [px + 0.5, py + 0.5];
      const expected = template.colorAt(x, y, geometry);
      const stable = [-1.5, 1.5].every((delta) => template.colorAt(x + delta, y, geometry) === expected && template.colorAt(x, y + delta, geometry) === expected);
      if (!stable) continue;
      checked++;
      if ((data[(py * info.width + px) * info.channels]! > 128 ? "overlay" : "base") !== expected) mismatches++;
    }
  }
  return { checked, mismatches };
}

function paramSamples(template: PatternTemplate): Record<string, number>[] {
  return [{}, ...Object.entries(template.parameters).flatMap(([key, spec]) => [{ [key]: spec.min }, { [key]: spec.max }])];
}
```

Dentro do `describe.each(...)("pattern %s", ...)`, no fim:

```ts
  it("reports with colorAt the layer that render paints", async () => {
    for (const raw of paramSamples(template)) {
      const { checked, mismatches } = await colorAtMismatches(template, raw);
      expect(checked).toBeGreaterThan(1000);
      expect(mismatches).toBe(0);
    }
  });
```

No fim dos blocos específicos:

```ts
describe("colorAt", () => {
  const geometry = (params: Record<string, number>) => ({ width: SIZE, height: SIZE, params });

  it("is base everywhere for solid", () => {
    expect(getPatternTemplate("solid").colorAt(207, 207, geometry({}))).toBe("base");
  });

  it("finds the stripes and the gaps between them", () => {
    // count 7, ratio 0.3: período 59,14; a primeira listra vai de 20,7 a 38,4.
    const stripes = getPatternTemplate("stripes");
    expect(stripes.colorAt(30, 100, geometry({ count: 7, ratio: 0.3 }))).toBe("overlay");
    expect(stripes.colorAt(5, 100, geometry({ count: 7, ratio: 0.3 }))).toBe("base");
  });

  it("follows the sash direction", () => {
    const sash = getPatternTemplate("sash");
    expect(sash.colorAt(300, 300, geometry({ width: 70, direction: 0 }))).toBe("overlay");
    expect(sash.colorAt(300, 114, geometry({ width: 70, direction: 0 }))).toBe("base");
    expect(sash.colorAt(300, 114, geometry({ width: 70, direction: 1 }))).toBe("overlay");
    expect(sash.colorAt(300, 300, geometry({ width: 70, direction: 1 }))).toBe("base");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/patterns`
Expected: FAIL — `template.colorAt is not a function`.

- [ ] **Step 3: Implementar**

Substituir `src/patterns/types.ts` inteiro por:

```ts
export interface PatternParameter {
  min: number;
  max: number;
  default: number;
  integer?: boolean;
}

export type PatternLayer = "base" | "overlay";

export interface PatternGeometry {
  width: number;
  height: number;
  params: Record<string, number>;
}

export interface PatternRenderContext extends PatternGeometry {
  base: string;
  overlay: string;
}

export interface PatternTemplate {
  id: string;
  name: string;
  category: string;
  defaultWeight: number;
  parameters: Record<string, PatternParameter>;
  render(context: PatternRenderContext): string;
  // Espelha render(): diz qual camada pinta o ponto. Mede o fundo atrás dos logos; um teste de pixel garante a coerência.
  colorAt(x: number, y: number, geometry: PatternGeometry): PatternLayer;
}
```

Substituir `src/patterns/solid.ts` inteiro por:

```ts
import type { PatternTemplate } from "./types.js";

export const solidPattern: PatternTemplate = {
  id: "solid",
  name: "Solid",
  category: "classic",
  defaultWeight: 40,
  parameters: {},
  render: () => "",
  colorAt: () => "base",
};
```

Substituir `src/patterns/stripes.ts` inteiro por:

```ts
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function stripeLayout({ width, params }: PatternGeometry): { period: number; stripeWidth: number; offset: number } {
  const period = width / params.count;
  const stripeWidth = period * params.ratio;
  return { period, stripeWidth, offset: (period - stripeWidth) / 2 };
}

export const stripesPattern: PatternTemplate = {
  id: "stripes",
  name: "Vertical stripes",
  category: "classic",
  defaultWeight: 35,
  parameters: { count: { min: 3, max: 15, default: 7, integer: true }, ratio: { min: 0.2, max: 0.4, default: 0.3 } },
  render(context) {
    const { period, stripeWidth, offset } = stripeLayout(context);
    return Array.from(
      { length: context.params.count },
      (_, index) => `<rect x="${fmt(index * period + offset)}" y="0" width="${fmt(stripeWidth)}" height="${fmt(context.height)}" fill="${context.overlay}"/>`,
    ).join("");
  },
  colorAt(x, _y, geometry) {
    const { period, stripeWidth, offset } = stripeLayout(geometry);
    const local = x - Math.floor(x / period) * period;
    return local >= offset && local <= offset + stripeWidth ? "overlay" : "base";
  },
};
```

Em `src/patterns/sash.ts`, acrescentar depois do método `render`:

```ts
  colorAt(x, y, { width, height, params }) {
    const [dx, dy] = [x - width / 2, y - height / 2];
    // Distância ao eixo da faixa: rotate(45) desce para a direita (dy = dx), rotate(-45) sobe (dy = -dx).
    const distance = Math.abs(params.direction === 0 ? dy - dx : dy + dx) / Math.SQRT2;
    return distance <= params.width / 2 ? "overlay" : "base";
  },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/patterns tests/renderers`
Expected: PASS. Medido no protótipo: 0 divergências em listras (count 3/7/15) e faixa (largura 30/70/100, as duas direções). O SVG das listras não muda (os testes de renderer seguem verdes).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/patterns tests/patterns/patterns.test.ts
git commit -m "feat: add colorAt to pattern templates mirroring their SVG"
```

---

### Task 5: Caixas dos logos e cores legíveis

**Files:**
- Modify: `src/renderers/shirt-2d-shape.ts`
- Create: `src/core/logo-colors.ts`
- Test: `tests/renderers/renderer-2d.test.ts`, `tests/core/logo-colors.test.ts` (novo)

**Interfaces:**
- Consumes: `PatternTemplate.colorAt` (Task 4); `LogoSlot`, `LogoColor`, `COLOR_ROLES` (Task 3); `contrastRatio`; `Palette`.
- Produces:
  - Em `src/renderers/shirt-2d-shape.ts`: `interface LogoBox { x: number; y: number; width: number; height: number }` e `LOGO_BOXES: Record<LogoSlot, LogoBox>`.
  - Em `src/core/logo-colors.ts`: `MIN_LOGO_CONTRAST = 3`, `MIN_BACKGROUND_SHARE = 0.05`, `interface LogoColors { color: LogoColor; outline?: LogoColor }`, `backgroundRoles(kit: KitDefinition, slot: LogoSlot): ColorRole[]` (dominante primeiro), `chooseLogoColors(palette: Palette, background: readonly string[]): LogoColors | undefined`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/renderers/renderer-2d.test.ts`, acrescentar o import `import { LOGO_BOXES } from "../../src/renderers/shirt-2d-shape.js";` e, no fim do `describe("renderKit2dPng")`:

```ts
  // Cada caixa de logo fica inteira sobre o corpo liso: nenhuma toca gola, manga, contorno ou fundo transparente.
  it.each(["round", "v-neck"] as const)("keeps every logo box on the plain body with the %s collar", async (style) => {
    const png = await renderKit2dPng(makeKit({ collar: { style, color: "accent" } }));
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let off = 0;
    for (const box of Object.values(LOGO_BOXES)) {
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let x = box.x; x < box.x + box.width; x++) {
          const index = (y * info.width + x) * info.channels;
          if ([data[index], data[index + 1], data[index + 2], data[index + 3]].join() !== PRIMARY.join()) off++;
        }
      }
    }
    expect(off).toBe(0);
  });
```

Criar `tests/core/logo-colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/core/color.js";
import { isColorRole } from "../../src/core/kit.js";
import { backgroundRoles, chooseLogoColors, MIN_LOGO_CONTRAST, type LogoColors } from "../../src/core/logo-colors.js";
import { createRng } from "../../src/core/random.js";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { makeKit } from "../fixtures/kits.js";

const PALETTE = { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" };
const [NAVY, WHITE, GOLD] = [PALETTE.primary, PALETTE.secondary, PALETTE.accent];

describe("backgroundRoles", () => {
  it("returns only the base for a solid kit", () => {
    expect(backgroundRoles(makeKit(), "sponsor")).toEqual(["primary"]);
  });

  it("puts the dominant role first", () => {
    // Faixa de largura 70 cobre 78% da caixa do patrocinador.
    const kit = makeKit({ pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 70, direction: 0 } } });
    expect(backgroundRoles(kit, "sponsor")).toEqual(["secondary", "primary"]);
  });

  it("keeps the base first when stripes cover less of the box", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } } });
    expect(backgroundRoles(kit, "sponsor")).toEqual(["primary", "secondary"]);
  });

  it("ignores a sliver below 5% of the box", () => {
    // Com 10 listras de ratio 0.25, só a primeira coluna da grade 24×24 da caixa do fabricante (x = 149,625) cai numa listra: 4,2%.
    const params = { count: 10, ratio: 0.25 };
    expect(getPatternTemplate("stripes").colorAt(149.625, 120, { width: 414, height: 414, params })).toBe("overlay");
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params } });
    expect(backgroundRoles(kit, "manufacturer")).toEqual(["primary"]);
  });
});

describe("chooseLogoColors", () => {
  it("prefers the palette color with the highest contrast", () => {
    // Contra navy: branco 12,72, ouro 9,07.
    expect(chooseLogoColors(PALETTE, [NAVY])).toEqual({ color: "secondary" });
  });

  it("needs contrast against every background color", () => {
    expect(chooseLogoColors(PALETTE, [WHITE, GOLD])).toEqual({ color: "primary" });
  });

  it("falls back to white or black when no palette color reaches the minimum", () => {
    // Contra navy: vermelho-escuro 1,27, verde 2,48, branco 12,72.
    expect(chooseLogoColors({ primary: "#123456", secondary: "#8b0000", accent: "#2e7d32" }, [NAVY])).toEqual({ color: "#ffffff" });
  });

  it("adds an outline when no single color works, as on the galaticos home sash", () => {
    expect(chooseLogoColors(PALETTE, [WHITE, NAVY])).toEqual({ color: "primary", outline: "secondary" });
  });

  it("picks the fill that reads on the dominant background, as on the galaticos third stripes", () => {
    expect(chooseLogoColors(PALETTE, [GOLD, NAVY])).toEqual({ color: "primary", outline: "secondary" });
  });

  it("prefers a palette fill with a neutral outline over a neutral fill", () => {
    // Paleta toda clara sobre branco e preto: nenhum par só com a paleta passa; cinza-claro tem o maior contraste contra o branco dominante.
    expect(chooseLogoColors({ primary: "#ffd700", secondary: "#f5f5dc", accent: "#d3d3d3" }, ["#ffffff", "#000000"])).toEqual({ color: "accent", outline: "#000000" });
  });

  it("breaks ties between outlines by candidate order", () => {
    // Fill navy (secondary) vence pelo fundo dominante branco; ouro e cinza-claro servem de contorno, ouro vem antes.
    expect(chooseLogoColors({ primary: "#ffd700", secondary: "#123456", accent: "#d3d3d3" }, ["#ffffff", "#000000"])).toEqual({ color: "secondary", outline: "primary" });
  });

  it("always finds a legible choice", () => {
    const rng = createRng(2024);
    const hex = () => `#${Array.from({ length: 3 }, () => Math.floor(rng.next() * 256).toString(16).padStart(2, "0")).join("")}`;
    for (let index = 0; index < 500; index++) {
      const palette = { primary: hex(), secondary: hex(), accent: hex() };
      const background = [hex(), hex()];
      const choice: LogoColors | undefined = chooseLogoColors(palette, background);
      expect(choice).toBeDefined();
      const resolve = (value: string) => (isColorRole(value) ? palette[value] : value);
      const color = resolve(choice!.color);
      const outline = choice!.outline === undefined ? undefined : resolve(choice!.outline);
      if (outline !== undefined) expect(contrastRatio(color, outline)).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST);
      for (const bg of background) {
        expect(Math.max(contrastRatio(color, bg), outline === undefined ? 0 : contrastRatio(outline, bg))).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST);
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/logo-colors.test.ts tests/renderers`
Expected: FAIL — `src/core/logo-colors.js` não existe e `LOGO_BOXES` é `undefined` no teste das caixas.

- [ ] **Step 3: Implementar**

Em `src/renderers/shirt-2d-shape.ts`, trocar o import por `import type { CollarStyle, LogoSlot } from "../core/kit.js";` e acrescentar depois de `CUFFS_PATH`:

```ts
export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Escudo no peito esquerdo do jogador (direita de quem olha), fabricante no direito, patrocinador no centro; todas abaixo do fundo da gola v-neck (y = 100).
export const LOGO_BOXES: Record<LogoSlot, LogoBox> = {
  badge: { x: 232, y: 102, width: 36, height: 36 },
  manufacturer: { x: 149, y: 105, width: 30, height: 30 },
  sponsor: { x: 145, y: 181, width: 124, height: 48 },
};
```

Criar `src/core/logo-colors.ts`:

```ts
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import { LOGO_BOXES, SHIRT_2D_VIEWBOX } from "../renderers/shirt-2d-shape.js";
import { contrastRatio } from "./color.js";
import { COLOR_ROLES, type ColorRole, type KitDefinition, type LogoColor, type LogoSlot } from "./kit.js";
import type { Palette } from "./palette.js";

// Mínimo da WCAG 2.1 para elementos gráficos.
export const MIN_LOGO_CONTRAST = 3;
// Lascas do padrão abaixo disto não atrapalham a leitura do logo.
export const MIN_BACKGROUND_SHARE = 0.05;
const GRID = 24;
const NEUTRALS = ["#ffffff", "#000000"];

export interface LogoColors {
  color: LogoColor;
  outline?: LogoColor;
}

interface Candidate {
  value: LogoColor;
  hex: string;
  fromPalette: boolean;
}

// Mede no layout 2D, o mesmo que o renderer usa para posicionar os logos.
export function backgroundRoles(kit: KitDefinition, slot: LogoSlot): ColorRole[] {
  const template = getPatternTemplate(kit.pattern.id);
  const geometry = { width: SHIRT_2D_VIEWBOX, height: SHIRT_2D_VIEWBOX, params: resolveParams(template, kit.pattern.params) };
  const box = LOGO_BOXES[slot];
  let overlay = 0;
  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      const x = box.x + ((column + 0.5) * box.width) / GRID;
      const y = box.y + ((row + 0.5) * box.height) / GRID;
      if (template.colorAt(x, y, geometry) === "overlay") overlay++;
    }
  }
  const overlayShare = overlay / (GRID * GRID);
  const shares: [ColorRole, number][] = [
    [kit.pattern.base, 1 - overlayShare],
    [kit.pattern.overlay, overlayShare],
  ];
  const roles = shares
    .filter(([, share]) => share >= MIN_BACKGROUND_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([role]) => role);
  return [...new Set(roles)];
}

function candidates(palette: Palette): Candidate[] {
  return [...COLOR_ROLES.map((role) => ({ value: role, hex: palette[role], fromPalette: true })), ...NEUTRALS.map((hex) => ({ value: hex, hex, fromPalette: false }))];
}

// Maior contraste mínimo contra o fundo; empate fica com a primeira candidata.
function bestSingle(group: Candidate[], background: readonly string[]): Candidate | undefined {
  let best: Candidate | undefined;
  let bestScore = MIN_LOGO_CONTRAST;
  for (const candidate of group) {
    const score = Math.min(...background.map((color) => contrastRatio(candidate.hex, color)));
    if (score > bestScore || (best === undefined && score >= bestScore)) [best, bestScore] = [candidate, score];
  }
  return best;
}

// Preferência: cor única da paleta, branco/preto, par com contorno (spec da Fase 2b, seção 5.3).
export function chooseLogoColors(palette: Palette, background: readonly string[]): LogoColors | undefined {
  const all = candidates(palette);
  for (const group of [all.filter((candidate) => candidate.fromPalette), all.filter((candidate) => !candidate.fromPalette)]) {
    const single = bestSingle(group, background);
    if (single) return { color: single.value };
  }
  const dominant = background[0]!;
  const pairs = all
    .flatMap((color) => all.filter((outline) => outline !== color).map((outline) => ({ color, outline })))
    .filter(
      ({ color, outline }) =>
        contrastRatio(color.hex, outline.hex) >= MIN_LOGO_CONTRAST &&
        background.every((bg) => Math.max(contrastRatio(color.hex, bg), contrastRatio(outline.hex, bg)) >= MIN_LOGO_CONTRAST),
    );
  // sort é estável: o que empata nos três critérios segue a ordem das candidatas.
  pairs.sort(
    (a, b) =>
      Number(b.color.fromPalette) - Number(a.color.fromPalette) ||
      Number(b.outline.fromPalette) - Number(a.outline.fromPalette) ||
      contrastRatio(b.color.hex, dominant) - contrastRatio(a.color.hex, dominant),
  );
  const best = pairs[0];
  return best && { color: best.color.value, outline: best.outline.value };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/logo-colors.test.ts tests/renderers`
Expected: PASS. Os casos do galaticos foram medidos no protótipo: Home (faixa) e Third (listras) dão `primary` + contorno `secondary`; Away dá `primary` sem contorno; a propriedade não falhou em 20 mil sorteios.

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/renderers/shirt-2d-shape.ts src/core/logo-colors.ts tests/renderers/renderer-2d.test.ts tests/core/logo-colors.test.ts
git commit -m "feat: measure the background behind each logo and pick legible logo colors"
```

---

### Task 6: Regra `logo-contrast`

**Files:**
- Modify: `src/core/validation.ts`
- Test: `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `backgroundRoles`, `MIN_LOGO_CONTRAST` (Task 5); `resolveLogoColor`, `BRAND_KINDS` (Task 3); `contrastRatio`.
- Produces: `validateKit(kit)` passa a devolver issues `logo-contrast` para `sponsor` e `manufacturer` (pulada quando o padrão é desconhecido).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/core/validation.test.ts`, um bloco novo depois do `describe("validateKit")`:

```ts
describe("validateKit logo-contrast", () => {
  const sash = { id: "sash", base: "primary" as const, overlay: "secondary" as const, params: { width: 70, direction: 0 } };

  it("accepts a legible sponsor", () => {
    expect(validateKit(makeKit({ sponsor: { id: "luna-air", color: "secondary" } }))).toEqual([]);
  });

  it("reports a sponsor that disappears into the base", () => {
    expect(validateKit(makeKit({ sponsor: { id: "luna-air", color: "primary" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit sponsor #123456 has contrast 1.00 against primary #123456 (minimum 3)" },
    ]);
  });

  it("checks every color behind the logo", () => {
    expect(validateKit(makeKit({ pattern: sash, sponsor: { id: "luna-air", color: "accent" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit sponsor #ffd700 has contrast 1.40 against secondary #ffffff (minimum 3)" },
    ]);
  });

  it("accepts an outline that covers the colors the fill cannot", () => {
    expect(validateKit(makeKit({ pattern: sash, sponsor: { id: "luna-air", color: "accent", outline: "primary" } }))).toEqual([]);
  });

  it("reports an outline too close to the fill", () => {
    const kit = makeKit({ pattern: { id: "solid", base: "secondary", overlay: "primary", params: {} }, sponsor: { id: "luna-air", color: "primary", outline: "#000000" } });
    expect(validateKit(kit)).toEqual([{ rule: "logo-contrast", message: "home kit sponsor #123456 and its outline #000000 have contrast 1.65 (minimum 3)" }]);
  });

  it("names the outline when fill and outline both fail against the background", () => {
    const kit = makeKit({ sponsor: { id: "luna-air", color: "primary", outline: "#000000" } });
    expect(validateKit(kit)).toContainEqual({
      rule: "logo-contrast",
      message: "home kit sponsor #123456 with outline #000000 has contrast 1.65 against primary #123456 (minimum 3)",
    });
  });

  it("checks the manufacturer too", () => {
    expect(validateKit(makeKit({ manufacturer: { id: "vertex", color: "primary" } }))).toEqual([
      { rule: "logo-contrast", message: "home kit manufacturer #123456 has contrast 1.00 against primary #123456 (minimum 3)" },
    ]);
  });

  it("skips the rule when the pattern is unknown", () => {
    const kit = makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} }, sponsor: { id: "luna-air", color: "primary" } });
    expect(validateKit(kit).map((issue) => issue.rule)).toEqual(["unknown-pattern"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/validation.test.ts`
Expected: FAIL nos casos que esperam `logo-contrast` (hoje `validateKit` devolve `[]`).

- [ ] **Step 3: Implementar**

Em `src/core/validation.ts`, trocar os imports de `./color.js` e `./kit.js` e acrescentar o de `./logo-colors.js`:

```ts
import { colorDistance, contrastRatio } from "./color.js";
import { BRAND_KINDS, BRAND_LISTS, COLOR_ROLES, KIT_TYPES, resolveLogoColor, type ColorRole, type KitDefinition, type KitType } from "./kit.js";
import { backgroundRoles, MIN_LOGO_CONTRAST } from "./logo-colors.js";
```

Logo antes de `export function validateKit`:

```ts
function logoContrastIssues(kit: KitDefinition): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) => {
    const logo = kit[kind];
    if (!logo) return [];
    const color = resolveLogoColor(kit, logo.color);
    const outline = logo.outline === undefined ? undefined : resolveLogoColor(kit, logo.outline);
    const label = `${kit.kitType} kit ${kind} ${color}`;
    const issues: ValidationIssue[] = [];
    if (outline !== undefined && contrastRatio(color, outline) < MIN_LOGO_CONTRAST) {
      const contrast = contrastRatio(color, outline).toFixed(2);
      issues.push({ rule: "logo-contrast", message: `${label} and its outline ${outline} have contrast ${contrast} (minimum ${MIN_LOGO_CONTRAST})` });
    }
    for (const role of backgroundRoles(kit, kind)) {
      const background = kit.colors[role];
      const contrast = Math.max(contrastRatio(color, background), outline === undefined ? 0 : contrastRatio(outline, background));
      if (contrast < MIN_LOGO_CONTRAST) {
        const subject = outline === undefined ? label : `${label} with outline ${outline}`;
        issues.push({ rule: "logo-contrast", message: `${subject} has contrast ${contrast.toFixed(2)} against ${role} ${background} (minimum ${MIN_LOGO_CONTRAST})` });
      }
    }
    return issues;
  });
}
```

Em `validateKit`, trocar a primeira checagem e o `return` para que `logo-contrast` só rode com padrão conhecido:

```ts
  const known = knownPatternIds();
  const patternKnown = known.includes(kit.pattern.id);
  if (!patternKnown) {
    issues.push({ rule: "unknown-pattern", message: `${kit.kitType} kit uses unknown pattern "${kit.pattern.id}" (known: ${known.join(", ")})` });
  }
```

e, no fim de `validateKit`, trocar `return issues;` por:

```ts
  // Sem colorAt não há como medir o fundo; unknown-pattern já explica o problema.
  if (patternKnown) issues.push(...logoContrastIssues(kit));
  return issues;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core tests/generator tests/cli`
Expected: PASS.

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/core/validation.ts tests/core/validation.test.ts
git commit -m "feat: validate the contrast of sponsor and manufacturer logos"
```

---

### Task 7: Generator sorteia patrocinador e fabricante e escolhe as cores

**Files:**
- Modify: `src/generator/kit-generator.ts`, `tests/fixtures/clubs.ts`
- Test: `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: pools do `ClubIdentity` e `no-asset-weight` (Task 2); campos de logo (Task 3); `backgroundRoles`, `chooseLogoColors`, `LogoColors` (Task 5).
- Produces:
  - `interface KitSetOptions { badge?: boolean }` e `generateKitSet(identity: ClubIdentity, seed: number, options?: KitSetOptions): KitSet`.
  - Fixture `GALATICOS_BRANDED_CLUB` em `tests/fixtures/clubs.ts` (`GALATICOS_CLUB` + `sponsors: { "luna-air": 3, "orbita-bank": 1 }` + `manufacturers: { vertex: 1 }`).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/fixtures/clubs.ts`, depois de `GALATICOS_CLUB`:

```ts
export const GALATICOS_BRANDED_CLUB = { ...GALATICOS_CLUB, sponsors: { "luna-air": 3, "orbita-bank": 1 }, manufacturers: { vertex: 1 } };
```

Em `tests/generator/kit-generator.test.ts`, trocar o import da fixture por `import { GALATICOS_BRANDED_CLUB, GALATICOS_CLUB } from "../fixtures/clubs.js";`, acrescentar depois de `const identity = ...`:

```ts
const branded: ClubIdentity = parseClubIdentity(GALATICOS_BRANDED_CLUB);
```

No teste `"never produces an invalid kit or set from a valid palette"`, trocar a linha `const set = generateKitSet(withPalette(palette), seed);` por:

```ts
        const set = generateKitSet({ ...withPalette(palette), sponsors: branded.sponsors, manufacturers: branded.manufacturers }, seed);
```

E um bloco novo no fim do arquivo:

```ts
describe("generateKitSet logos", () => {
  // Guarda: passa antes e depois desta tarefa; a 2b não pode mudar o desenho dos kits já versionados.
  it("keeps the Phase 2a design for seed 42", () => {
    const { home, away, third } = generateKitSet(identity, 42);
    expect(home).toMatchObject({
      pattern: { id: "sash", base: "primary", overlay: "secondary", params: { width: 86.656, direction: 0 } },
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "secondary" },
      shorts: { color: "primary" },
      socks: { color: "primary" },
    });
    expect(away).toMatchObject({
      pattern: { id: "stripes", params: { count: 10, ratio: 0.214 } },
      collar: { style: "v-neck", color: "primary" },
      sleeves: { style: "match-body", color: "accent", cuffColor: "primary" },
      shorts: { color: "secondary" },
      socks: { color: "secondary" },
    });
    expect(third).toMatchObject({
      pattern: { id: "stripes", params: { count: 5, ratio: 0.305 } },
      collar: { style: "round", color: "primary" },
      sleeves: { style: "solid", color: "primary", cuffColor: "primary" },
      shorts: { color: "primary" },
      socks: { color: "accent" },
    });
  });

  it("adds logos without changing the design", () => {
    for (let seed = 0; seed < 30; seed++) {
      const withLogos = generateKitSet(branded, seed, { badge: true });
      const plain = generateKitSet(identity, seed);
      for (const kitType of KIT_TYPES) {
        const { badge: _badge, sponsor: _sponsor, manufacturer: _manufacturer, ...design } = withLogos[kitType];
        expect(design).toEqual(plain[kitType]);
      }
    }
  });

  it("shares one sponsor and one manufacturer across the set", () => {
    const sponsors = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const { home, away, third } = generateKitSet(branded, seed);
      expect(home.sponsor).toBeDefined();
      expect(away.sponsor?.id).toBe(home.sponsor?.id);
      expect(third.sponsor?.id).toBe(home.sponsor?.id);
      for (const kit of [home, away, third]) expect(kit.manufacturer?.id).toBe("vertex");
      sponsors.add(home.sponsor!.id);
    }
    expect(sponsors).toEqual(new Set(["luna-air", "orbita-bank"]));
  });

  it("chooses legible colors for the galaticos set of seed 42", () => {
    const { home, away, third } = generateKitSet(branded, 42);
    expect(home.sponsor).toMatchObject({ color: "primary", outline: "secondary" });
    expect(home.manufacturer).toMatchObject({ color: "primary", outline: "secondary" });
    expect(away.sponsor).toEqual({ id: away.sponsor!.id, color: "primary" });
    expect(third.sponsor).toMatchObject({ color: "primary", outline: "secondary" });
    expect(third.manufacturer).toEqual({ id: "vertex", color: "primary" });
  });

  it("leaves out the logos the club does not configure", () => {
    for (const kit of Object.values(generateKitSet(identity, 1))) {
      expect(kit).not.toHaveProperty("badge");
      expect(kit).not.toHaveProperty("sponsor");
      expect(kit).not.toHaveProperty("manufacturer");
    }
  });

  it("marks the badge only when asked", () => {
    for (const kit of Object.values(generateKitSet(identity, 1, { badge: true }))) expect(kit.badge).toBe(true);
  });

  it("never picks a pool entry with zero weight", () => {
    const club = { ...branded, sponsors: { "luna-air": 0, "orbita-bank": 1 } };
    for (let seed = 0; seed < 30; seed++) expect(generateKitSet(club, seed).home.sponsor?.id).toBe("orbita-bank");
  });

  it("does not depend on the key order of a pool", () => {
    const forward = { ...branded, sponsors: { "luna-air": 1, "orbita-bank": 1 } };
    const backward = { ...branded, sponsors: { "orbita-bank": 1, "luna-air": 1 } };
    for (let seed = 0; seed < 30; seed++) expect(generateKitSet(backward, seed)).toEqual(generateKitSet(forward, seed));
  });

  it("rejects pools without a positive weight", () => {
    expect(() => generateKitSet({ ...branded, manufacturers: { vertex: 0 } }, 1)).toThrow(/no-asset-weight/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/generator`
Expected: FAIL — os kits saem sem `sponsor`, `manufacturer` e `badge` (`"shares one sponsor..."`, `"chooses legible colors..."`, `"marks the badge..."`, `"never picks..."`). `"keeps the Phase 2a design"`, `"adds logos without changing the design"`, `"leaves out the logos..."`, `"does not depend on the key order..."` e `"rejects pools..."` já passam (guardas que precisam continuar verdes depois da implementação).

- [ ] **Step 3: Implementar**

Em `src/generator/kit-generator.ts`, trocar os imports do topo por:

```ts
import type { ClubIdentity } from "../core/club.js";
import { BRAND_KINDS, BRAND_LISTS, COLLAR_STYLES, COLOR_ROLES, SLEEVE_STYLES, type BrandKind, type ColorRole, type KitDefinition, type KitType } from "../core/kit.js";
import { backgroundRoles, chooseLogoColors, type LogoColors } from "../core/logo-colors.js";
import { resolvePalette, type Palette } from "../core/palette.js";
import { createRng, deriveSeed, type Rng } from "../core/random.js";
import { formatIssues, validateClub, validatePalette, type ValidationIssue } from "../core/validation.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
```

Depois de `export const MAX_PALETTE_ATTEMPTS = 20;`:

```ts
export interface KitSetOptions {
  badge?: boolean;
}

interface LogoChoice {
  badge: boolean;
  sponsor?: string;
  manufacturer?: string;
}
```

Substituir `generateKitSet` por:

```ts
export function generateKitSet(identity: ClubIdentity, seed: number, options: KitSetOptions = {}): KitSet {
  const issues = validateClub(identity);
  if (issues.length > 0) throw new Error(`Club "${identity.id}" is invalid:\n${formatIssues(issues)}`);
  const palette = generatePalette(identity, seed);
  const logos: LogoChoice = { badge: options.badge ?? false, sponsor: pickBrand(identity, "sponsor", seed), manufacturer: pickBrand(identity, "manufacturer", seed) };
  return {
    home: withLogos(generateKit(identity, "home", palette, seed), logos),
    away: withLogos(generateKit(identity, "away", palette, seed), logos),
    third: withLogos(generateKit(identity, "third", palette, seed), logos),
  };
}
```

No fim do arquivo:

```ts
// Um sorteio por conjunto, com RNG próprio por tipo de marca: mudar um pool não altera o outro nem o desenho dos kits.
function pickBrand(identity: ClubIdentity, kind: BrandKind, seed: number): string | undefined {
  const pool = identity[BRAND_LISTS[kind]];
  if (!pool) return undefined;
  // Ordem alfabética: reordenar as chaves no club.json não muda o resultado da seed.
  const entries = Object.keys(pool)
    .sort()
    .map((id) => [id, pool[id]] as const);
  return createRng(deriveSeed(seed, kind)).weighted(entries);
}

function withLogos(kit: KitDefinition, logos: LogoChoice): KitDefinition {
  const result: KitDefinition = { ...kit };
  if (logos.badge) result.badge = true;
  for (const kind of BRAND_KINDS) {
    const id = logos[kind];
    if (id !== undefined) result[kind] = { id, ...legibleColors(kit, kind) };
  }
  return result;
}

function legibleColors(kit: KitDefinition, kind: BrandKind): LogoColors {
  const colors = chooseLogoColors(
    kit.colors,
    backgroundRoles(kit, kind).map((role) => kit.colors[role]),
  );
  // Inalcançável com cores válidas: o par branco + preto sempre passa (spec da Fase 2b, seção 5.4).
  if (!colors) throw new Error(`No legible ${kind} color for the ${kit.kitType} kit of club "${kit.clubId}"`);
  return colors;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/generator tests/core`
Expected: PASS, inclusive a propriedade com pools (`validateKit` agora roda `logo-contrast` em cada kit gerado).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/generator/kit-generator.ts tests/fixtures/clubs.ts tests/generator/kit-generator.test.ts
git commit -m "feat: pick one sponsor and manufacturer per kit set with legible colors"
```

---

### Task 8: Renderer 2D compõe os logos

**Files:**
- Create: `src/renderers/logo-image.ts`, `tests/fixtures/assets.ts`, `tests/renderers/logo-image.test.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Test: `tests/renderers/renderer-2d.test.ts`

**Interfaces:**
- Consumes: `LOGO_BOXES`, `LogoBox` (Task 5); `BRAND_KINDS`, `resolveLogoColor`, `LogoSlot` (Task 3); `AssetRegistry` (Task 1, na fixture).
- Produces:
  - Em `src/renderers/logo-image.ts`: `interface PixelBox { left: number; top: number; width: number; height: number }`, `interface FittedImage { data: Buffer; width: number; height: number }` (RGBA bruto), `interface LogoLayer { input: Buffer; left: number; top: number }`, `fitImage(input: Buffer, width: number, height: number): Promise<FittedImage>`, `brandLogoLayers(input: Buffer, box: PixelBox, color: string, outline?: { color: string; width: number }): Promise<LogoLayer[]>`, `badgeLayer(input: Buffer, box: PixelBox): Promise<LogoLayer>`.
  - Em `src/renderers/renderer-2d.ts`: `interface KitLogoImages { badge?: Buffer; sponsor?: Buffer; manufacturer?: Buffer }` e `Render2dOptions.logos?: KitLogoImages`.
  - Fixture `tests/fixtures/assets.ts`: `LOGO_SVG`, `makeLogoPng(width, height, color?)`, `makeOpaquePng(width, height)`, `TEST_REGISTRY`, `makeAssetsDir()`, `writeClubLogo(clubsDir, clubId)`.

- [ ] **Step 1: Criar a fixture de assets**

Criar `tests/fixtures/assets.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { AssetRegistry } from "../../src/assets/registry.js";
import { makeTempDir } from "./temp.js";

// Retângulo 60×20 com furo central: tem transparência, como um logo de verdade.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill-rule="evenodd" d="M0 0H60V20H0Z M24 6H36V14H24Z"/></svg>`;

// Retângulo colorido com 2 px de margem transparente.
export async function makeLogoPng(width: number, height: number, color = "#ff00ff"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="${color}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function makeOpaquePng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#ff00ff" } })
    .png()
    .toBuffer();
}

export const TEST_REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.png" },
  ],
  manufacturers: [{ id: "vertex", name: "Vertex", file: "manufacturers/vertex.png" }],
};

// Só pode ser chamada dentro de um teste (usa makeTempDir).
export async function makeAssetsDir(): Promise<string> {
  const dir = await makeTempDir("assets");
  const files: Record<string, string | Buffer> = {
    "registry.json": JSON.stringify(TEST_REGISTRY),
    "sponsors/luna-air.svg": LOGO_SVG,
    "sponsors/orbita-bank.png": await makeLogoPng(60, 20),
    "manufacturers/vertex.png": await makeLogoPng(30, 30),
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }
  return dir;
}

// Escudo verde 40×40: no PNG renderizado, o centro da caixa do escudo fica #00ff00.
export async function writeClubLogo(clubsDir: string, clubId: string): Promise<void> {
  await writeFile(path.join(clubsDir, clubId, "logo.png"), await makeLogoPng(40, 40, "#00ff00"));
}
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `tests/renderers/logo-image.test.ts`:

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { brandLogoLayers, fitImage } from "../../src/renderers/logo-image.js";
import { makeLogoPng } from "../fixtures/assets.js";

describe("fitImage", () => {
  it("fits inside the box without distortion", async () => {
    const image = await fitImage(await makeLogoPng(60, 20), 124, 48);
    expect([image.width, image.height]).toEqual([124, 41]);
    expect(image.data).toHaveLength(124 * 41 * 4);
  });

  it("rasterizes SVG at the box scale instead of enlarging a small bitmap", async () => {
    // Furo de 0,1 unidade num SVG de 6×2: só sobra transparente a 124 px se o SVG for rasterizado já nessa escala.
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 2"><path fill-rule="evenodd" d="M0 0H6V2H0Z M2.95 0.5H3.05V1.5H2.95Z"/></svg>`);
    const image = await fitImage(svg, 124, 48);
    const row = Math.floor(image.height / 2);
    const alphas = Array.from({ length: 15 }, (_, offset) => image.data[(row * image.width + 55 + offset) * 4 + 3]!);
    expect(Math.min(...alphas)).toBe(0);
  });

  it("accepts SVGs much larger than the box", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000"><path d="M0 0H4000V4000H0Z"/></svg>`);
    const image = await fitImage(svg, 30, 30);
    expect([image.width, image.height]).toEqual([30, 30]);
  });
});

describe("brandLogoLayers", () => {
  const box = { left: 10, top: 20, width: 124, height: 48 };

  it("returns one centered silhouette in the logo color", async () => {
    const layers = await brandLogoLayers(await makeLogoPng(60, 20), box, "#ffd700");
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ left: 10, top: 23 });
    const { data, info } = await sharp(layers[0]!.input).raw().toBuffer({ resolveWithObject: true });
    const index = (20 * info.width + 62) * info.channels;
    expect([...data.subarray(index, index + 4)]).toEqual([0xff, 0xd7, 0x00, 255]);
  });

  it("puts the outline under the fill, grown by the outline width on every side", async () => {
    const layers = await brandLogoLayers(await makeLogoPng(60, 20), box, "#ffd700", { color: "#ffffff", width: 2 });
    expect(layers.map(({ left, top }) => [left, top])).toEqual([
      [8, 21],
      [10, 23],
    ]);
    const [outline, fill] = await Promise.all(layers.map((layer) => sharp(layer.input).metadata()));
    expect([outline!.width, outline!.height]).toEqual([fill!.width + 4, fill!.height + 4]);
  });
});
```

Em `tests/renderers/renderer-2d.test.ts`, trocar o import do renderer por `import { KIT_2D_SIZE, renderKit2dPng, renderKit2dSvg, type KitLogoImages } from "../../src/renderers/renderer-2d.js";`, acrescentar `import { LOGO_SVG, makeLogoPng } from "../fixtures/assets.js";` e, depois de `const ACCENT ...`, `const GREEN: Rgba = [0, 0xff, 0, 255];`. Bloco novo no fim do arquivo:

```ts
describe("renderKit2dPng logos", () => {
  const sponsorLogo = () => ({ sponsor: Buffer.from(LOGO_SVG) });
  const sponsorKit = (outline?: "secondary") => makeKit({ sponsor: { id: "luna-air", color: "accent", ...(outline ? { outline } : {}) } });

  it("renders a kit without logos exactly as the Phase 2a renderer", async () => {
    const kit = makeKit();
    const phase2a = await sharp(Buffer.from(renderKit2dSvg(kit))).png().toBuffer();
    expect((await renderKit2dPng(kit, { logos: sponsorLogo() })).equals(phase2a)).toBe(true);
  });

  // LOGO_SVG ocupa 124×41 a partir de (145, 184); o furo central fica entre x 194–219 e y 196–212.
  it("paints the sponsor silhouette with the logo color and leaves its hole transparent", async () => {
    const png = await renderKit2dPng(sponsorKit(), { logos: sponsorLogo() });
    expect(await pixelAt(png, 155, 205)).toEqual(ACCENT);
    expect(await pixelAt(png, 207, 205)).toEqual(PRIMARY);
  });

  it("draws the outline around the sponsor only when the kit asks for it", async () => {
    const withOutline = await renderKit2dPng(sponsorKit("secondary"), { logos: sponsorLogo() });
    const without = await renderKit2dPng(sponsorKit(), { logos: sponsorLogo() });
    expect(await pixelAt(withOutline, 155, 183)).toEqual(SECONDARY);
    expect(await pixelAt(withOutline, 155, 205)).toEqual(ACCENT);
    expect(await pixelAt(without, 155, 183)).toEqual(PRIMARY);
  });

  it("paints the manufacturer with its own color", async () => {
    const kit = makeKit({ manufacturer: { id: "vertex", color: "#000000" } });
    expect(await pixelAt(await renderKit2dPng(kit, { logos: { manufacturer: await makeLogoPng(30, 30) } }), 164, 120)).toEqual([0, 0, 0, 255]);
  });

  it("keeps the badge colors", async () => {
    const png = await renderKit2dPng(makeKit({ badge: true }), { logos: { badge: await makeLogoPng(40, 40, "#00ff00") } });
    expect(await pixelAt(png, 250, 120)).toEqual(GREEN);
  });

  it("scales logos with the image size", async () => {
    expect(await pixelAt(await renderKit2dPng(sponsorKit(), { size: 828, logos: sponsorLogo() }), 310, 410)).toEqual(ACCENT);
  });

  it.each(["badge", "sponsor", "manufacturer"] as const)("fails when the kit declares a %s without its image", async (slot) => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air", color: "accent" }, manufacturer: { id: "vertex", color: "accent" } });
    const logos: KitLogoImages = { badge: await makeLogoPng(40, 40), sponsor: Buffer.from(LOGO_SVG), manufacturer: await makeLogoPng(30, 30) };
    delete logos[slot];
    await expect(renderKit2dPng(kit, { logos })).rejects.toThrow(`Kit declares a ${slot} but no ${slot} image was provided`);
  });

  it("is deterministic with logos", async () => {
    const kit = makeKit({ badge: true, sponsor: { id: "luna-air", color: "accent", outline: "secondary" } });
    const logos = { badge: await makeLogoPng(40, 40, "#00ff00"), ...sponsorLogo() };
    expect((await renderKit2dPng(kit, { logos })).equals(await renderKit2dPng(kit, { logos }))).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/renderers`
Expected: FAIL — `src/renderers/logo-image.js` não existe; no renderer, os logos não aparecem (`ACCENT` esperado, `PRIMARY` recebido) e os casos de imagem ausente não lançam.

- [ ] **Step 4: Implementar**

Criar `src/renderers/logo-image.ts`:

```ts
import sharp from "sharp";

export interface PixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// RGBA bruto, já no tamanho final.
export interface FittedImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface LogoLayer {
  input: Buffer;
  left: number;
  top: number;
}

interface AlphaMask {
  data: Uint8Array;
  width: number;
  height: number;
}

// Com SVG, o Sharp rasteriza direto no tamanho do resize, sem ampliar bitmap pequeno (teste em logo-image.test.ts).
export async function fitImage(input: Buffer, width: number, height: number): Promise<FittedImage> {
  const { data, info } = await sharp(input).ensureAlpha().resize({ width, height, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function alphaMask(image: FittedImage): AlphaMask {
  const data = new Uint8Array(image.width * image.height);
  for (let index = 0; index < data.length; index++) data[index] = image.data[index * 4 + 3]!;
  return { data, width: image.width, height: image.height };
}

// Dilatação por disco; a máscara cresce `radius` px de cada lado para o contorno não ser cortado.
function dilate(mask: AlphaMask, radius: number): AlphaMask {
  const width = mask.width + 2 * radius;
  const height = mask.height + 2 * radius;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const [sourceX, sourceY] = [x - radius + dx, y - radius + dy];
          if (dx * dx + dy * dy > radius * radius || sourceX < 0 || sourceY < 0 || sourceX >= mask.width || sourceY >= mask.height) continue;
          max = Math.max(max, mask.data[sourceY * mask.width + sourceX]!);
        }
      }
      data[y * width + x] = max;
    }
  }
  return { data, width, height };
}

async function tint(mask: AlphaMask, hex: string): Promise<Buffer> {
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const data = Buffer.alloc(mask.width * mask.height * 4);
  for (let index = 0; index < mask.width * mask.height; index++) data.set([...rgb, mask.data[index]!], index * 4);
  return sharp(data, { raw: { width: mask.width, height: mask.height, channels: 4 } })
    .png()
    .toBuffer();
}

function centered(box: PixelBox, width: number, height: number): { left: number; top: number } {
  return { left: box.left + Math.floor((box.width - width) / 2), top: box.top + Math.floor((box.height - height) / 2) };
}

// Patrocinador e fabricante viram silhueta: só o alfa do arquivo importa, a cor vem do kit.
export async function brandLogoLayers(input: Buffer, box: PixelBox, color: string, outline?: { color: string; width: number }): Promise<LogoLayer[]> {
  const image = await fitImage(input, box.width, box.height);
  const mask = alphaMask(image);
  const { left, top } = centered(box, image.width, image.height);
  const fill = { input: await tint(mask, color), left, top };
  if (!outline) return [fill];
  return [{ input: await tint(dilate(mask, outline.width), outline.color), left: left - outline.width, top: top - outline.width }, fill];
}

export async function badgeLayer(input: Buffer, box: PixelBox): Promise<LogoLayer> {
  const image = await fitImage(input, box.width, box.height);
  const png = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
  return { input: png, ...centered(box, image.width, image.height) };
}
```

Substituir `src/renderers/renderer-2d.ts` inteiro por:

```ts
import sharp from "sharp";
import { BRAND_KINDS, resolveLogoColor, type ColorRole, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import { badgeLayer, brandLogoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";
import { bodyPath, collarPath, CUFFS_PATH, LOGO_BOXES, outlinePath, SHIRT_2D_VIEWBOX, SLEEVES_PATH, type LogoBox } from "./shirt-2d-shape.js";

export const KIT_2D_SIZE = 414;
// Espessura do contorno dos logos no viewBox 414; escala com o tamanho do PNG.
const OUTLINE_WIDTH = 2;

export interface KitLogoImages {
  badge?: Buffer;
  sponsor?: Buffer;
  manufacturer?: Buffer;
}

export interface Render2dOptions {
  size?: number;
  logos?: KitLogoImages;
}

export function renderKit2dSvg(kit: KitDefinition, options: Render2dOptions = {}): string {
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const color = (role: ColorRole): string => kit.colors[role];
  const template = getPatternTemplate(kit.pattern.id);
  const params = resolveParams(template, kit.pattern.params);
  const pattern = template.render({ width: view, height: view, base: color(kit.pattern.base), overlay: color(kit.pattern.overlay), params });
  const fabric = `<rect width="${view}" height="${view}" fill="${color(kit.pattern.base)}"/>${pattern}`;
  const sleeves =
    kit.sleeves.style === "match-body" ? `<g clip-path="url(#sleeves)">${fabric}</g>` : `<path d="${SLEEVES_PATH}" fill="${color(kit.sleeves.color)}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(kit.collar.style)}"/></clipPath><clipPath id="sleeves"><path d="${SLEEVES_PATH}"/></clipPath></defs>`,
    `<g clip-path="url(#body)">${fabric}</g>`,
    sleeves,
    `<path d="${CUFFS_PATH}" fill="none" stroke="${color(kit.sleeves.cuffColor)}" stroke-width="8"/>`,
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${color(kit.collar.color)}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
}

export async function renderKit2dPng(kit: KitDefinition, options: Render2dOptions = {}): Promise<Buffer> {
  const shirt = sharp(Buffer.from(renderKit2dSvg(kit, options)));
  const layers = await logoLayers(kit, options.size ?? KIT_2D_SIZE, options.logos ?? {});
  // Sem logos não há composite: o PNG fica byte a byte igual ao da Fase 2a.
  return (layers.length > 0 ? shirt.composite(layers) : shirt).png().toBuffer();
}

function requireImage(images: KitLogoImages, slot: LogoSlot): Buffer {
  const image = images[slot];
  if (!image) throw new Error(`Kit declares a ${slot} but no ${slot} image was provided`);
  return image;
}

function pixelBox(box: LogoBox, scale: number): PixelBox {
  return { left: Math.round(box.x * scale), top: Math.round(box.y * scale), width: Math.round(box.width * scale), height: Math.round(box.height * scale) };
}

async function logoLayers(kit: KitDefinition, size: number, images: KitLogoImages): Promise<LogoLayer[]> {
  const scale = size / SHIRT_2D_VIEWBOX;
  const layers: LogoLayer[] = [];
  if (kit.badge) layers.push(await badgeLayer(requireImage(images, "badge"), pixelBox(LOGO_BOXES.badge, scale)));
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (!logo) continue;
    const outline = logo.outline === undefined ? undefined : { color: resolveLogoColor(kit, logo.outline), width: Math.max(1, Math.round(OUTLINE_WIDTH * scale)) };
    layers.push(...(await brandLogoLayers(requireImage(images, kind), pixelBox(LOGO_BOXES[kind], scale), resolveLogoColor(kit, logo.color), outline)));
  }
  return layers;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/renderers`
Expected: PASS. Medido no protótipo: o logo 60×20 vira 124×41 na caixa do patrocinador, a camada de contorno fica 4 px maior e a 2 px para cima e para a esquerda.

- [ ] **Step 6: Gate, build e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check && npm run build`

```bash
git add src/renderers tests/fixtures/assets.ts tests/renderers
git commit -m "feat: composite badge, sponsor and manufacturer logos on the 2D render"
```

---

### Task 9: Leitura dos arquivos de logo

**Files:**
- Modify: `src/io/club-repository.ts`
- Create: `src/io/asset-repository.ts`, `tests/io/asset-repository.test.ts`
- Test: `tests/io/club-repository.test.ts`

**Interfaces:**
- Consumes: `loadAssetRegistry`, `findAsset`, `getAsset`, `assetFilePath` (Task 1); `BRAND_KINDS`, `BRAND_LISTS` (Task 1); `KitLogoImages` (Task 8); `ValidationIssue`; fixtures `makeAssetsDir`, `writeClubLogo`, `makeOpaquePng`, `LOGO_SVG` (Task 8).
- Produces:
  - Em `src/io/club-repository.ts`: `clubLogoPath(clubId: string, clubsDir?: string): string` e `hasClubLogo(clubId: string, clubsDir?: string): Promise<boolean>`.
  - Em `src/io/asset-repository.ts`: `interface AssetDirs { assetsDir: string; clubsDir: string }`, `interface AssetRefs { badge: boolean; sponsors: string[]; manufacturers: string[] }`, `loadKitLogos(kit, registry, dirs: AssetDirs): Promise<KitLogoImages>`, `checkAssetFiles(clubId: string, refs: AssetRefs, registry: AssetRegistry, dirs: AssetDirs): Promise<ValidationIssue[]>`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/io/club-repository.test.ts`, trocar o import do repositório por `import { clubLogoPath, hasClubLogo, kitDefinitionPath, listClubIds, loadClub, loadKit, saveKit } from "../../src/io/club-repository.js";`, acrescentar `import { writeClubLogo } from "../fixtures/assets.js";` e, no fim:

```ts
describe("club logo", () => {
  it("lives at clubs/<id>/logo.png", () => {
    expect(clubLogoPath("galaticos-fc", "/tmp/clubs")).toBe(path.join("/tmp/clubs", "galaticos-fc", "logo.png"));
    expect(() => clubLogoPath("../escape", "/tmp/clubs")).toThrow(/Invalid club id/);
  });

  it("reports whether the club has a logo", async () => {
    const dir = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
    expect(await hasClubLogo("galaticos-fc", dir)).toBe(false);
    await writeClubLogo(dir, "galaticos-fc");
    expect(await hasClubLogo("galaticos-fc", dir)).toBe(true);
  });
});
```

Criar `tests/io/asset-repository.test.ts`:

```ts
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAssetRegistry } from "../../src/assets/registry.js";
import { checkAssetFiles, loadKitLogos, type AssetDirs } from "../../src/io/asset-repository.js";
import { LOGO_SVG, makeAssetsDir, makeOpaquePng, writeClubLogo } from "../fixtures/assets.js";
import { GALATICOS_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

async function setup(withLogo = true): Promise<AssetDirs> {
  const clubsDir = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
  if (withLogo) await writeClubLogo(clubsDir, "galaticos-fc");
  return { assetsDir: await makeAssetsDir(), clubsDir };
}

const BRANDED_KIT = makeKit({ badge: true, sponsor: { id: "luna-air", color: "accent" }, manufacturer: { id: "vertex", color: "accent" } });
const ALL_REFS = { badge: true, sponsors: ["luna-air", "orbita-bank"], manufacturers: ["vertex"] };

describe("loadKitLogos", () => {
  it("reads only the logos the kit declares", async () => {
    const dirs = await setup();
    const registry = await loadAssetRegistry(dirs.assetsDir);
    expect(await loadKitLogos(makeKit(), registry, dirs)).toEqual({});
    const logos = await loadKitLogos(BRANDED_KIT, registry, dirs);
    expect(Object.keys(logos).sort()).toEqual(["badge", "manufacturer", "sponsor"]);
    expect(logos.sponsor?.toString()).toBe(LOGO_SVG);
  });

  it("names the missing badge", async () => {
    const dirs = await setup(false);
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(
      `Club "galaticos-fc" badge not found: ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")}`,
    );
  });

  it("names the missing asset file", async () => {
    const dirs = await setup();
    const file = path.join(dirs.assetsDir, "manufacturers", "vertex.png");
    await rm(file);
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(`Manufacturer "vertex" file not found: ${file}`);
  });

  it("rejects ids missing from the registry", async () => {
    const dirs = await setup();
    const kit = makeKit({ sponsor: { id: "acme", color: "accent" } });
    await expect(loadKitLogos(kit, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow('Unknown sponsor "acme" (known: luna-air, orbita-bank)');
  });

  it("names files that are not images", async () => {
    const dirs = await setup();
    const file = path.join(dirs.assetsDir, "sponsors", "luna-air.svg");
    await writeFile(file, "not an image");
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(`Invalid image file: ${file}`);
  });
});

describe("checkAssetFiles", () => {
  it("accepts present images with transparency", async () => {
    const dirs = await setup();
    expect(await checkAssetFiles("galaticos-fc", ALL_REFS, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([]);
  });

  it("reports each missing file once", async () => {
    const dirs = await setup(false);
    const file = path.join(dirs.assetsDir, "manufacturers", "vertex.png");
    await rm(file);
    const refs = { badge: true, sponsors: [], manufacturers: ["vertex", "vertex"] };
    expect(await checkAssetFiles("galaticos-fc", refs, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([
      { rule: "missing-asset", message: `club badge not found: ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")}` },
      { rule: "missing-asset", message: `manufacturer "vertex" file not found: ${file}` },
    ]);
  });

  it("reports opaque logos and files that are not images", async () => {
    const dirs = await setup();
    await writeFile(path.join(dirs.assetsDir, "sponsors", "orbita-bank.png"), await makeOpaquePng(60, 20));
    await writeFile(path.join(dirs.assetsDir, "sponsors", "luna-air.svg"), "not an image");
    await writeFile(path.join(dirs.clubsDir, "galaticos-fc", "logo.png"), "not an image");
    expect(await checkAssetFiles("galaticos-fc", ALL_REFS, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([
      { rule: "invalid-file", message: `club badge ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")} is not a valid image` },
      { rule: "invalid-file", message: 'sponsor "luna-air" (sponsors/luna-air.svg) is not a valid image' },
      { rule: "opaque-logo", message: 'sponsor "orbita-bank" (sponsors/orbita-bank.png) has no transparent pixels' },
    ]);
  });

  it("skips ids missing from the registry", async () => {
    const dirs = await setup();
    const refs = { badge: false, sponsors: ["acme"], manufacturers: [] };
    expect(await checkAssetFiles("galaticos-fc", refs, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/io`
Expected: FAIL — `clubLogoPath`/`hasClubLogo` não existem e `src/io/asset-repository.js` não carrega.

- [ ] **Step 3: Implementar**

Em `src/io/club-repository.ts`, logo depois de `loadClub`:

```ts
export function clubLogoPath(clubId: string, clubsDir: string = CLUBS_DIR): string {
  return path.join(clubsDir, parseWith(ClubIdSchema, clubId, "club id"), "logo.png");
}

export async function hasClubLogo(clubId: string, clubsDir: string = CLUBS_DIR): Promise<boolean> {
  return isFile(clubLogoPath(clubId, clubsDir));
}
```

Criar `src/io/asset-repository.ts`:

```ts
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { assetFilePath, findAsset, getAsset, type AssetRegistry } from "../assets/registry.js";
import { BRAND_KINDS, BRAND_LISTS, type BrandKind, type KitDefinition } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import type { KitLogoImages } from "../renderers/renderer-2d.js";
import { clubLogoPath } from "./club-repository.js";

export interface AssetDirs {
  assetsDir: string;
  clubsDir: string;
}

export interface AssetRefs {
  badge: boolean;
  sponsors: string[];
  manufacturers: string[];
}

const KIND_LABELS: Record<BrandKind, string> = { sponsor: "Sponsor", manufacturer: "Manufacturer" };

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// O Sharp só diria "unsupported image format", sem o arquivo; quem chama põe o caminho na mensagem.
async function isImage(content: Buffer): Promise<boolean> {
  try {
    await sharp(content).metadata();
    return true;
  } catch {
    return false;
  }
}

async function readImage(file: string, missing: string): Promise<Buffer> {
  const content = await readIfExists(file);
  if (!content) throw new Error(`${missing} not found: ${file}`);
  if (!(await isImage(content))) throw new Error(`Invalid image file: ${file}`);
  return content;
}

export async function loadKitLogos(kit: KitDefinition, registry: AssetRegistry, dirs: AssetDirs): Promise<KitLogoImages> {
  const images: KitLogoImages = {};
  if (kit.badge) images.badge = await readImage(clubLogoPath(kit.clubId, dirs.clubsDir), `Club "${kit.clubId}" badge`);
  for (const kind of BRAND_KINDS) {
    const logo = kit[kind];
    if (logo) images[kind] = await readImage(assetFilePath(dirs.assetsDir, getAsset(registry, kind, logo.id)), `${KIND_LABELS[kind]} "${logo.id}" file`);
  }
  return images;
}

// Confere cada arquivo uma vez; ids fora do registry ficam para a regra unknown-asset.
export async function checkAssetFiles(clubId: string, refs: AssetRefs, registry: AssetRegistry, dirs: AssetDirs): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (refs.badge) {
    const file = clubLogoPath(clubId, dirs.clubsDir);
    const content = await readIfExists(file);
    if (!content) issues.push({ rule: "missing-asset", message: `club badge not found: ${file}` });
    else if (!(await isImage(content))) issues.push({ rule: "invalid-file", message: `club badge ${file} is not a valid image` });
  }
  for (const kind of BRAND_KINDS) {
    for (const id of new Set(refs[BRAND_LISTS[kind]])) {
      const entry = findAsset(registry, kind, id);
      if (!entry) continue;
      const file = assetFilePath(dirs.assetsDir, entry);
      const label = `${kind} "${id}" (${entry.file})`;
      const content = await readIfExists(file);
      if (!content) issues.push({ rule: "missing-asset", message: `${kind} "${id}" file not found: ${file}` });
      else if (!(await isImage(content))) issues.push({ rule: "invalid-file", message: `${label} is not a valid image` });
      else if ((await sharp(content).stats()).isOpaque) issues.push({ rule: "opaque-logo", message: `${label} has no transparent pixels` });
    }
  }
  return issues;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/io`
Expected: PASS. Medido no protótipo: `sharp(...).stats().isOpaque` é `true` para PNG sem alfa e para SVG que cobre tudo, `false` para SVG com furo.

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/io tests/io
git commit -m "feat: read logo files for a kit and check asset files with clear errors"
```

---

### Task 10: CLI `generate` e `render` com logos

**Files:**
- Modify: `src/cli/run-cli.ts`
- Test: `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `ASSETS_DIR`, `loadAssetRegistry`, `AssetRegistry` (Task 1); `validateClubAssets` (Task 2); `resolveLogoColor` (Task 3); `generateKitSet(identity, seed, { badge })` (Task 7); `renderKit2dPng(kit, { logos })` (Task 8); `hasClubLogo`, `loadKitLogos` (Task 9); fixtures `GALATICOS_BRANDED_CLUB` (Task 7), `makeAssetsDir`, `writeClubLogo` (Task 8).
- Produces: opção `--assets <dir>` em `generate` e `render`; `--clubs <dir>` em `render`; `USAGE` novo (com `--assets` também no `validate`, que a Task 11 implementa).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/cli/run-cli.test.ts`, trocar os imports por:

```ts
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseSeed, runCli, USAGE } from "../../src/cli/run-cli.js";
import { KIT_TYPES, parseKitDefinition, resolveLogoColor, type KitType } from "../../src/core/kit.js";
import { deriveSeed, MAX_SEED } from "../../src/core/random.js";
import { makeAssetsDir, writeClubLogo } from "../fixtures/assets.js";
import { GALATICOS_BRANDED_CLUB, GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
import { makeTempDir } from "../fixtures/temp.js";
```

Depois de `async function exists(...)`:

```ts
async function pixelAt(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [...data.subarray(index, index + 4)];
}

function rgba(hex: string): number[] {
  return [...[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)), 255];
}

async function brandedSetup(withLogo = true): Promise<{ clubs: string; assets: string }> {
  const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_BRANDED_CLUB) });
  if (withLogo) await writeClubLogo(clubs, "galaticos-fc");
  return { clubs, assets: await makeAssetsDir() };
}

const GREEN = [0, 255, 0, 255];
```

Bloco novo depois de `describe("runCli generate --all")`:

```ts
describe("runCli generate with logos", () => {
  it("saves the logos in every kit.json and draws them on the PNGs", async () => {
    const { clubs, assets } = await brandedSetup();
    const out = await makeTempDir("cli");
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", out], captureIo().io)).toBe(0);
    const kits = await Promise.all(KIT_TYPES.map(async (kitType) => parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", kitType), "utf8")))));
    for (const kit of kits) {
      expect(kit.badge).toBe(true);
      expect(kit.sponsor?.id).toBe(kits[0]!.sponsor?.id);
      expect(kit.manufacturer?.id).toBe("vertex");
      const png = await readFile(pngFile(out, "galaticos-fc", kit.kitType));
      expect(await pixelAt(png, 250, 120)).toEqual(GREEN);
      expect(await pixelAt(png, 164, 120)).toEqual(rgba(resolveLogoColor(kit, kit.manufacturer!.color)));
    }
  });

  it("generates kits without a badge when the club has no logo.png", async () => {
    const { clubs, assets } = await brandedSetup(false);
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")], captureIo().io)).toBe(0);
    const kit = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "home"), "utf8")));
    expect(kit).not.toHaveProperty("badge");
    expect(kit.sponsor).toBeDefined();
  });

  it("rejects clubs whose pools reference unregistered assets", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, sponsors: { acme: 1 } }) });
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors.join("\n")).toContain('Club "galaticos-fc" is invalid:\n  - unknown-asset: sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)');
  });

  it("keeps generating the other clubs when one references an unregistered asset", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, manufacturers: { kong: 1 } }), "kong-team": JSON.stringify(KONG_CLUB) });
    const { io, logs, errors } = captureIo();
    expect(await runCli(["generate", "--all", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[galaticos-fc\] Club "galaticos-fc" is invalid:/);
    expect(await exists(kitFile(clubs, "galaticos-fc", "home"))).toBe(false);
    expect(await exists(kitFile(clubs, "kong-team", "home"))).toBe(true);
    expect(logs.at(-1)).toBe("Generated 1 of 2 clubs");
  });

  it("writes no kit.json when a registered logo file is missing", async () => {
    const { clubs, assets } = await brandedSetup();
    const missing = path.join(assets, "manufacturers", "vertex.png");
    await rm(missing);
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors.join("\n")).toContain(`Manufacturer "vertex" file not found: ${missing}`);
    for (const kitType of KIT_TYPES) expect(await exists(kitFile(clubs, "galaticos-fc", kitType))).toBe(false);
  });

  it("reports a missing asset registry", async () => {
    const assets = await makeTempDir("assets");
    const { io, errors } = captureIo();
    expect(await runCli(["generate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir(), "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`Error: Asset registry not found: ${path.join(assets, "registry.json")}`]);
  });

  it("is reproducible byte for byte with logos", async () => {
    const [first, second] = [await brandedSetup(), await brandedSetup()];
    const [firstOut, secondOut] = [await makeTempDir("cli"), await makeTempDir("cli")];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", first.clubs, "--assets", first.assets, "--out", firstOut], captureIo().io);
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "7", "--clubs", second.clubs, "--assets", second.assets, "--out", secondOut], captureIo().io);
    for (const kitType of KIT_TYPES) {
      expect(await readFile(kitFile(second.clubs, "galaticos-fc", kitType), "utf8")).toBe(await readFile(kitFile(first.clubs, "galaticos-fc", kitType), "utf8"));
      expect((await readFile(pngFile(secondOut, "galaticos-fc", kitType))).equals(await readFile(pngFile(firstOut, "galaticos-fc", kitType)))).toBe(true);
    }
  });
});
```

No fim do `describe("runCli render")`:

```ts
  it("renders the logos of a definition, with the badge from --clubs and the files from --assets", async () => {
    const { clubs, assets } = await brandedSetup();
    const dir = await makeTempDir("cli");
    const [definition, png] = [path.join(dir, "kit.json"), path.join(dir, "kit.png")];
    await writeFile(definition, JSON.stringify(makeKit({ badge: true, manufacturer: { id: "vertex", color: "#000000" } })));
    expect(await runCli(["render", "--definition", definition, "--out", png, "--clubs", clubs, "--assets", assets], captureIo().io)).toBe(0);
    expect(await pixelAt(await readFile(png), 250, 120)).toEqual(GREEN);
    expect(await pixelAt(await readFile(png), 164, 120)).toEqual([0, 0, 0, 255]);
  });

  it("names the missing badge when rendering", async () => {
    const { clubs, assets } = await brandedSetup(false);
    const dir = await makeTempDir("cli");
    const definition = path.join(dir, "kit.json");
    await writeFile(definition, JSON.stringify(makeKit({ badge: true })));
    const { io, errors } = captureIo();
    expect(await runCli(["render", "--definition", definition, "--out", path.join(dir, "kit.png"), "--clubs", clubs, "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`Error: Club "galaticos-fc" badge not found: ${path.join(clubs, "galaticos-fc", "logo.png")}`]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/cli`
Expected: FAIL — `--assets` é opção desconhecida (`parseArgs` strict) nos casos novos; os demais continuam verdes.

- [ ] **Step 3: Implementar**

Em `src/cli/run-cli.ts`, trocar o bloco de imports por:

```ts
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadAssetRegistry, type AssetRegistry } from "../assets/registry.js";
import { ASSETS_DIR, CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../config/paths.js";
import type { ClubIdentity } from "../core/club.js";
import { KIT_TYPES, KitDefinitionSchema, KitTypeSchema, type KitDefinition, type KitType } from "../core/kit.js";
import { parseWith } from "../core/primitives.js";
import { deriveSeed, MAX_SEED } from "../core/random.js";
import { formatIssues, validateClub, validateClubAssets, validateKit, validateKitSet, type ValidationIssue } from "../core/validation.js";
import { generateKitSet } from "../generator/kit-generator.js";
import { loadKitLogos } from "../io/asset-repository.js";
import { hasClubLogo, listClubIds, loadClub, loadKit, saveKit } from "../io/club-repository.js";
import { readJsonFile } from "../io/json-file.js";
import { renderKit2dPng } from "../renderers/renderer-2d.js";
```

Substituir `GenerateOptions` e `USAGE` por:

```ts
interface GenerateOptions {
  kitTypes: readonly KitType[];
  outDir: string;
  clubsDir: string;
  assetsDir: string;
  registry: AssetRegistry;
}

export const USAGE = [
  "Usage:",
  "  kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>] [--assets <dir>]",
  "  kit-generator render --definition <kit.json> --out <file.png> [--clubs <dir>] [--assets <dir>]",
  "  kit-generator validate (--club <id> | --all) [--clubs <dir>] [--assets <dir>]",
].join("\n");
```

Substituir `generateClub` por:

```ts
async function generateClub(clubId: string, seed: number, options: GenerateOptions, io: CliIo): Promise<void> {
  // Seed impressa antes de qualquer efeito colateral, para reproduzir até uma execução que falhou.
  io.log(`Seed: ${seed} (${clubId})`);
  const club = await loadClub(clubId, options.clubsDir);
  const assetIssues = validateClubAssets(club, options.registry);
  if (assetIssues.length > 0) throw new Error(`Club "${club.id}" is invalid:\n${formatIssues(assetIssues)}`);
  const set = generateKitSet(club, seed, { badge: await hasClubLogo(club.id, options.clubsDir) });
  const kits = options.kitTypes.map((kitType) => set[kitType]);
  // Todos os PNGs antes do primeiro kit.json: uma falha de renderização não deixa o conjunto versionado pela metade.
  const pngFiles: string[] = [];
  for (const kit of kits) {
    const pngFile = kitRenderPath(options.outDir, club.id, kit.kitType, "2d");
    const logos = await loadKitLogos(kit, options.registry, options);
    await writeOutput(pngFile, await renderKit2dPng(kit, { logos }));
    pngFiles.push(pngFile);
  }
  const lines = [`Generated ${club.name} kits (seed ${seed})`];
  for (const [index, kit] of kits.entries()) {
    const kitFile = await saveKit(kit, options.clubsDir);
    lines.push(`  ${kit.kitType} definition: ${kitFile}`, `  ${kit.kitType} 2D: ${pngFiles[index]}`);
  }
  for (const line of lines) io.log(line);
}
```

Em `generateCommand`, acrescentar `assets: { type: "string", default: ASSETS_DIR },` ao objeto `options` (depois de `clubs`), e trocar as linhas de `clubIds`/`generateOptions` por:

```ts
  const clubIds = await resolveClubIds(values, values.clubs);
  const registry = await loadAssetRegistry(values.assets);
  const generateOptions: GenerateOptions = { kitTypes, outDir: path.resolve(values.out), clubsDir: values.clubs, assetsDir: values.assets, registry };
```

Substituir `renderCommand` por:

```ts
async function renderCommand(args: string[], io: CliIo): Promise<number> {
  const options = { definition: { type: "string" }, out: { type: "string" }, clubs: { type: "string", default: CLUBS_DIR }, assets: { type: "string", default: ASSETS_DIR } } as const;
  const { values } = parseArgs({ args, options, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const kit = parseWith(KitDefinitionSchema, await readJsonFile(values.definition), `kit definition in ${values.definition}`);
  const registry = await loadAssetRegistry(values.assets);
  const logos = await loadKitLogos(kit, registry, { assetsDir: values.assets, clubsDir: values.clubs });
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKit2dPng(kit, { logos }));
  io.log(`Rendered ${values.definition} to ${out}`);
  return 0;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/cli`
Expected: PASS, inclusive os testes antigos (sem `--assets` eles usam `assets/` do projeto, criado na Task 1).

- [ ] **Step 5: Gate e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check`

```bash
git add src/cli/run-cli.ts tests/cli/run-cli.test.ts
git commit -m "feat: generate and render kits with logos from the asset registry"
```

---

### Task 11: CLI `validate` com regras de asset

**Files:**
- Modify: `src/cli/run-cli.ts`
- Test: `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `validateClubAssets` (Task 2); `validateKitAssets` (Task 3); `logo-contrast` em `validateKit` (Task 6); `checkAssetFiles`, `AssetDirs`, `AssetRefs` (Task 9); `BRAND_LISTS`, `BrandKind`; helpers de teste da Task 10 (`brandedSetup`, `kitFile`).
- Produces: `validate` com `--assets <dir>`; regras `unknown-asset`, `missing-asset`, `opaque-logo`, `invalid-file` (logo e registry) e `logo-contrast` no relatório.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/cli/run-cli.test.ts`, no fim do `describe("runCli validate")`:

```ts
  async function generatedBrandedSetup(): Promise<{ clubs: string; assets: string }> {
    const setup = await brandedSetup();
    await runCli(["generate", "--all", "--seed", "3", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], captureIo().io);
    return setup;
  }

  async function validateBranded(setup: { clubs: string; assets: string }) {
    const capture = captureIo();
    const code = await runCli(["validate", "--club", "galaticos-fc", "--clubs", setup.clubs, "--assets", setup.assets], capture.io);
    return { code, ...capture };
  }

  async function readHome(clubs: string) {
    return parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "home"), "utf8")));
  }

  it("accepts freshly generated clubs with logos", async () => {
    const { code, logs, errors } = await validateBranded(await generatedBrandedSetup());
    expect(code).toBe(0);
    expect(logs).toEqual(["OK galaticos-fc (3 kits)"]);
    expect(errors).toEqual([]);
  });

  it("reports unregistered ids in the club and in a hand-edited kit", async () => {
    const setup = await generatedBrandedSetup();
    await writeFile(path.join(setup.clubs, "galaticos-fc", "club.json"), JSON.stringify({ ...GALATICOS_BRANDED_CLUB, sponsors: { acme: 1 } }));
    const home = await readHome(setup.clubs);
    await writeFile(kitFile(setup.clubs, "galaticos-fc", "home"), JSON.stringify({ ...home, manufacturer: { ...home.manufacturer, id: "kong" } }));
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain('  - unknown-asset: sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)');
    expect(errors[0]).toContain('  - unknown-asset: home kit references unknown manufacturer "kong" (known: vertex)');
  });

  it("reports missing, opaque and broken logo files", async () => {
    const setup = await generatedBrandedSetup();
    await rm(path.join(setup.clubs, "galaticos-fc", "logo.png"));
    await rm(path.join(setup.assets, "manufacturers", "vertex.png"));
    await writeFile(path.join(setup.assets, "sponsors", "orbita-bank.png"), await makeOpaquePng(60, 20));
    await writeFile(path.join(setup.assets, "sponsors", "luna-air.svg"), "not an image");
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain(`  - missing-asset: club badge not found: ${path.join(setup.clubs, "galaticos-fc", "logo.png")}`);
    expect(errors[0]).toContain(`  - missing-asset: manufacturer "vertex" file not found: ${path.join(setup.assets, "manufacturers", "vertex.png")}`);
    expect(errors[0]).toContain('  - opaque-logo: sponsor "orbita-bank" (sponsors/orbita-bank.png) has no transparent pixels');
    expect(errors[0]).toContain('  - invalid-file: sponsor "luna-air" (sponsors/luna-air.svg) is not a valid image');
  });

  it("reports a hand-edited logo color without contrast", async () => {
    const setup = await generatedBrandedSetup();
    const home = await readHome(setup.clubs);
    const edited = { ...home, pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} }, sponsor: { id: home.sponsor!.id, color: "primary" } };
    await writeFile(kitFile(setup.clubs, "galaticos-fc", "home"), JSON.stringify(edited));
    const { code, errors } = await validateBranded(setup);
    expect(code).toBe(1);
    expect(errors[0]).toContain("  - logo-contrast: home kit sponsor #123456 has contrast 1.00 against primary #123456 (minimum 3)");
  });

  it("fails every club when the asset registry is missing", async () => {
    const assets = await makeTempDir("assets");
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", await galaticosClubsDir(), "--assets", assets], io)).toBe(1);
    expect(errors).toEqual([`FAIL galaticos-fc\n  - invalid-file: Asset registry not found: ${path.join(assets, "registry.json")}`]);
  });
```

Acrescentar `makeOpaquePng` ao import de `../fixtures/assets.js`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/cli`
Expected: FAIL — `validate` não aceita `--assets` (opção desconhecida).

- [ ] **Step 3: Implementar**

Em `src/cli/run-cli.ts`, trocar os imports de `kit.js`, `validation.js` e `asset-repository.js` por:

```ts
import { BRAND_LISTS, KIT_TYPES, KitDefinitionSchema, KitTypeSchema, type BrandKind, type KitDefinition, type KitType } from "../core/kit.js";
import { formatIssues, validateClub, validateClubAssets, validateKit, validateKitAssets, validateKitSet, type ValidationIssue } from "../core/validation.js";
import { checkAssetFiles, loadKitLogos, type AssetDirs, type AssetRefs } from "../io/asset-repository.js";
```

Depois de `resolveClubIds`:

```ts
type RegistryLoad = { registry: AssetRegistry } | { error: string };

function assetRefs(club: ClubIdentity, kits: KitDefinition[]): AssetRefs {
  const ids = (kind: BrandKind): string[] => [...Object.keys(club[BRAND_LISTS[kind]] ?? {}), ...kits.flatMap((kit) => kit[kind]?.id ?? [])];
  return { badge: kits.some((kit) => kit.badge === true), sponsors: ids("sponsor"), manufacturers: ids("manufacturer") };
}
```

Substituir `validateClubFiles` e `validateCommand` por:

```ts
// Junta todos os problemas do clube em vez de parar no primeiro, para o usuário corrigir tudo de uma vez.
async function validateClubFiles(clubId: string, dirs: AssetDirs, load: RegistryLoad): Promise<{ kitCount: number; issues: ValidationIssue[] }> {
  let club: ClubIdentity;
  try {
    club = await loadClub(clubId, dirs.clubsDir);
  } catch (error) {
    return { kitCount: 0, issues: [{ rule: "invalid-file", message: errorMessage(error) }] };
  }
  const issues = validateClub(club);
  const kits: Partial<Record<KitType, KitDefinition>> = {};
  for (const kitType of KIT_TYPES) {
    try {
      const kit = await loadKit(club.id, kitType, dirs.clubsDir);
      if (kit) kits[kitType] = kit;
    } catch (error) {
      issues.push({ rule: "invalid-file", message: errorMessage(error) });
    }
  }
  const loaded = Object.values(kits);
  issues.push(...loaded.flatMap((kit) => validateKit(kit)), ...validateKitSet(kits));
  // Sem registry não dá para conferir ids nem arquivos de logo; o erro do registry já explica o FAIL.
  if ("error" in load) {
    issues.push({ rule: "invalid-file", message: load.error });
  } else {
    issues.push(...validateClubAssets(club, load.registry), ...loaded.flatMap((kit) => validateKitAssets(kit, load.registry)));
    issues.push(...(await checkAssetFiles(club.id, assetRefs(club, loaded), load.registry, dirs)));
  }
  return { kitCount: loaded.length, issues };
}

async function validateCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    club: { type: "string" },
    all: { type: "boolean", default: false },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const clubIds = await resolveClubIds(values, values.clubs);
  const load: RegistryLoad = await loadAssetRegistry(values.assets).then(
    (registry) => ({ registry }),
    (error: unknown) => ({ error: errorMessage(error) }),
  );
  const dirs: AssetDirs = { assetsDir: values.assets, clubsDir: values.clubs };
  let failed = 0;
  for (const clubId of clubIds) {
    const { kitCount, issues } = await validateClubFiles(clubId, dirs, load);
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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/cli`
Expected: PASS, inclusive os testes antigos de `validate` (sem `--assets` eles usam o registry do projeto).

- [ ] **Step 5: Gate, build e commit**

Run: `npm run format && npm test && npm run typecheck && npm run format:check && npm run build`

```bash
git add src/cli/run-cli.ts tests/cli/run-cli.test.ts
git commit -m "feat: validate asset ids, logo files and logo contrast"
```

---

### Task 12: Galaticos de exemplo, inspeção visual e documentação

**Files:**
- Create: `clubs/galaticos-fc/logo.png` (via Sharp a partir de `output/galaticos-badge.svg`, que não é versionado)
- Modify: `clubs/galaticos-fc/club.json`, `clubs/galaticos-fc/kits/{home,away,third}/kit.json` (via CLI)
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md`

**Interfaces:**
- Consumes: CLI completa (Tasks 10–11) e os logos de amostra (Task 1).
- Produces: clube de exemplo com escudo, pools e kits da seed 42 com logos; documentação da Fase 2b.

- [ ] **Step 1: Criar o escudo do galaticos**

Criar `output/galaticos-badge.svg` (fica em `output/`, ignorado pelo git; só o PNG é versionado):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path d="M50 2L96 14V58C96 88 76 106 50 118C24 106 4 88 4 58V14Z" fill="#ffffff"/><path d="M50 9L89 19V58C89 84 72 99 50 110C28 99 11 84 11 58V19Z" fill="#123456"/><path d="M50.0 32.0L55.6 48.2L72.8 48.6L59.1 59.0L64.1 75.4L50.0 65.6L35.9 75.4L40.9 59.0L27.2 48.6L44.4 48.2Z" fill="#ffd700"/><path d="M30 86H70V91H30Z" fill="#ffd700"/></svg>
```

Run: `node --input-type=module -e "import sharp from 'sharp'; await sharp('output/galaticos-badge.svg', { density: 288 }).png().toFile('clubs/galaticos-fc/logo.png');"`
Run: `node --input-type=module -e "import sharp from 'sharp'; const meta = await sharp('clubs/galaticos-fc/logo.png').metadata(); console.log(meta.width, meta.height, meta.hasAlpha)"`
Expected: `400 480 true`.

- [ ] **Step 2: Pools no `club.json`**

Substituir `clubs/galaticos-fc/club.json` por:

```json
{
  "id": "galaticos-fc",
  "name": "Galáticos FC",
  "palette": { "primary": "#123456", "secondary": "#FFFFFF", "accent": "#FFD700" },
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

- [ ] **Step 3: Regenerar e validar**

Run: `npm run kit-generator -- generate --club galaticos-fc --seed 42 && npm run kit-generator -- validate --all`
Expected: `Seed: 42 (galaticos-fc)`, três `definition`/`2D`, depois `OK galaticos-fc (3 kits)`.

Run: `git diff clubs/galaticos-fc/kits`
Expected: em cada `kit.json`, só as chaves `badge`, `sponsor` e `manufacturer` foram acrescentadas; paleta, padrão, parâmetros, gola, mangas, calção e meias iguais aos da Fase 2a. Home: `sponsor` e `manufacturer` com `"color": "primary"` e `"outline": "secondary"`; Away: `"color": "primary"` sem contorno; Third: `sponsor` com `primary` + `secondary`, `manufacturer` `primary` sem contorno.

- [ ] **Step 4: Inspecionar os três PNGs**

Abra `output/galaticos-fc/2d/galaticos_fc_{home,away,third}_2d.png`. Critérios: o desenho de cada kit é o mesmo da Fase 2a (Home navy com faixa branca, Away branco com listras ouro, Third ouro com listras navy); escudo no peito esquerdo do jogador (direita de quem olha), com as cores originais (escudo navy, borda branca, estrela ouro); fabricante (`V` de `vertex`) no peito direito; patrocinador no centro do peito; logos nítidos, sem serrilhado grosseiro nem borrão; patrocinador e fabricante legíveis sobre todas as cores atrás deles (Home: os dois navy com contorno branco; Away: os dois navy sem contorno; Third: patrocinador navy com contorno branco, fabricante navy sem contorno); nenhum logo invade gola, mangas ou borda da camisa. Se algum critério falhar, pare e reporte com o PNG; não ajuste caixas nem cores às cegas.

- [ ] **Step 5: Reescrever `README.md`**

````markdown
# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Specs, planos de execução e status: `docs/superpowers/`.

## Status

Fase 2b concluída: gera os kits Home, Away e Third de um clube com a mesma paleta, valida a coerência das cores e renderiza um PNG 2D 414×414 por kit, com escudo, patrocinador e fabricante. Ainda não existem textura 3D, `config.xml` nem exportação para o FM26 (Fase 3). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.

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
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

- Só `id`, `name` e `palette.primary` são obrigatórios.
- `secondary` e `accent` ausentes são derivados da cor primária.
- As cores informadas precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15). Cores quase iguais são rejeitadas, porque cada uma vira a cor base de um kit.
- `fmUniqueId` é o Unique ID real do clube no FM26, como string de dígitos. Informe você mesmo; o código nunca o inventa. Nesta fase ele é só validado, ainda não é usado.
- `patternWeights` aceita os padrões `solid`, `stripes` e `sash`, com pesos de 0 a 1.000.000. Sem ele, valem os pesos padrão (40/35/25).
- `sponsors` e `manufacturers` são opcionais: IDs do registry de logos (seção 2) com pesos de 0 a 1.000.000. Cada geração sorteia um patrocinador e um fabricante para o conjunto: Home, Away e Third usam os mesmos. Sem a chave, os kits saem sem patrocinador ou sem fabricante.
- Escudo: coloque um PNG com fundo transparente em `clubs/<id>/logo.png`. Ele aparece com as cores originais. Sem o arquivo, os kits saem sem escudo.
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

Exemplo pronto: `clubs/galaticos-fc/club.json` e `clubs/galaticos-fc/logo.png`.

## 2. Registrar patrocinadores e fabricantes

Os logos ficam em `assets/` e são registrados por ID em `assets/registry.json`:

```json
{
  "sponsors": [{ "id": "luna-air", "name": "Luna Air", "file": "sponsors/luna-air.svg" }],
  "manufacturers": [{ "id": "vertex", "name": "Vertex", "file": "manufacturers/vertex.svg" }]
}
```

- `id`: minúsculas, dígitos e `-`, único em cada lista. É o que o `club.json` e o `kit.json` referenciam.
- `file`: caminho relativo a `assets/`, com `/`, terminando em `.png` ou `.svg`. Caminho absoluto ou com `..` é rejeitado.
- Patrocinador e fabricante são usados como silhueta: só a transparência do arquivo importa, as cores dele são ignoradas. O gerador pinta o logo numa cor que contrasta com a camisa. Arquivo sem nenhuma transparência vira um retângulo sólido (o `validate` acusa).
- Em SVG, converta texto em curvas: `<text>` depende das fontes instaladas e o resultado muda de máquina para máquina.

Os logos de exemplo (`luna-air`, `orbita-bank`, `vertex`) e o escudo do galaticos são fictícios.

## 3. Gerar os kits

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
| `--assets <dir>` | Pasta dos logos, com o `registry.json` (padrão `assets/` do projeto) |

Saída, por clube:

- `clubs/<id>/kits/{home,away,third}/kit.json`: definição de cada kit, versionável. `generatedWith.seed` guarda a seed usada. Gerar de novo sobrescreve.
- `output/<id>/2d/<slug>_{home,away,third}_2d.png`: PNG 414×414 com fundo transparente. O `<slug>` é o `id` com `-` trocado por `_` (ex.: `galaticos_fc_away_2d.png`).

Os três kits usam a mesma paleta e alternam os papéis das cores, para se distinguirem em campo:

| Kit | Cor base | Cor do padrão |
|---|---|---|
| Home | primary | secondary |
| Away | secondary | accent |
| Third | accent | primary |

Logos:

- Escudo no peito esquerdo do jogador, fabricante no direito, patrocinador no centro.
- A cor do patrocinador e do fabricante contrasta (WCAG ≥ 3) com todas as cores da camisa atrás do logo: primeiro uma cor da paleta, depois branco ou preto. Se nenhuma cor sozinha serve (por exemplo, logo sobre uma faixa branca num kit azul-marinho), o logo ganha um contorno numa segunda cor.
- A escolha fica no `kit.json`, por exemplo `"sponsor": { "id": "luna-air", "color": "primary", "outline": "secondary" }`. `color` e `outline` aceitam papel da paleta ou hex. `"badge": true` desenha o escudo.

A mesma seed sempre gera os mesmos kits, byte a byte, e `--type away` gera o mesmo Away da geração completa. Para seed que começa com `-`, o Node exige `--seed=-1` (com espaço, o `parseArgs` reclama de argumento ambíguo); de qualquer forma, seeds negativas, fracionárias, vazias ou maiores que 4294967295 são rejeitadas.

Com `--all`, cada clube recebe a própria seed, impressa no log. Com `--all --seed S`, a seed de cada clube é derivada de `S`; use a seed impressa com `--club` para reproduzir só aquele clube. Um clube com erro (inclusive logo não registrado ou arquivo faltando) não interrompe os demais: o comando imprime `Error: [<id>] ...`, termina com o resumo `Generated N of M clubs` e código de saída 1.

## 4. Ajustar à mão e renderizar

Edite o `kit.json` (cores, padrão, parâmetros, gola, mangas, `badge`, `sponsor`, `manufacturer`) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

O escudo vem de `clubs/<clubId>/logo.png` (`--clubs <dir>` muda a pasta de clubes) e os logos de `assets/` (`--assets <dir>`). Parâmetros de padrão fora da faixa são ajustados para o limite. Padrão desconhecido gera erro listando os conhecidos. Depois de editar, rode `validate`.

## 5. Validar

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- validate --club galaticos-fc
```

Confere o `club.json` e cada `kit.json` existente: schema, pasta certa, cores distinguíveis, padrão diferente da base, cores base diferentes entre Home, Away e Third, IDs de patrocinador e fabricante registrados, arquivos de logo presentes, válidos e com transparência, e contraste dos logos com a camisa. Imprime `OK <id> (<n> kits)` ou `FAIL <id>` seguido das regras violadas, e termina com código 1 se algum clube falhar.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
npm run format        # formata com Prettier (largura 160)
npm run format:check  # confere a formatação; faz parte do gate de cada fase
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas, validação, cor dos logos), `src/patterns` (solid, stripes, sash), `src/generator` (conjunto Home/Away/Third), `src/renderers` (2D com logos), `src/assets` (registry de logos), `src/fm26` (nomes de arquivo), `src/io` (clubes, kits, JSON e arquivos de logo), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
````

- [ ] **Step 6: Reescrever `CLAUDE.md`**

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

CLI em TypeScript (ESM, Node >= 22.12) que gera uniformes aleatórios e reproduzíveis por seed para o Football Manager 2026. Estado atual: Fase 2b concluída. Cada clube ganha Home, Away e Third com a mesma paleta, validados por regras de coerência, e um PNG 2D 414×414 por kit com escudo, patrocinador e fabricante. Exportação para o FM26 (`config.xml`, textura 3D, Fase 3) ainda não existe. Specs: `fm26-procedural-kit-generator-guide.md` (arquitetura), `fm26-kit-export-and-integration.md` (integração FM26) e `docs/superpowers/specs/`. Roadmap, decisões e pendências: `docs/superpowers/plans/2026-10-01-roadmap.md`. Leia o roadmap antes de iniciar qualquer fase nova.

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
npm run kit-generator -- generate --all [--seed 42] [--type away] [--assets assets]
npm run kit-generator -- validate --all
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Formatter: Prettier (`printWidth` 160; `npm run format` formata, `npm run format:check` confere). Não há linter. Uma fase só avança com `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes e os PNGs inspecionados visualmente.

## Arquitetura

Fluxo: `club.json` (identidade + pools de marcas) → `generateKitSet(identity, seed, { badge })` → três `KitDefinition` (dado puro, salvos como `kits/<tipo>/kit.json`) → `loadKitLogos` (lê escudo e logos) → `renderKit2dPng(kit, { logos })` (SVG → Sharp → PNG, logos compostos por cima).

- `src/core`: schemas Zod (`club.ts`, `kit.ts`, `primitives.ts`), RNG semeado (`random.ts`: mulberry32 + `deriveSeed` FNV-1a), cores via Color.js (`color.ts` com `colorDistance` ΔE OKLab e `contrastRatio` WCAG, `palette.ts`), regras de coerência (`validation.ts`) e cor dos logos (`logo-colors.ts`). Os schemas usam `z.strictObject`: chave desconhecida em `club.json`/`kit.json` é erro de propósito (pega typos como `fmUniqueID`). `KIT_TYPES`/`KitType`/`KitTypeSchema`, `BRAND_KINDS`/`BRAND_LISTS` e `resolveLogoColor` moram em `core/kit.ts`.
- `src/core/validation.ts`: funções puras que devolvem `ValidationIssue[]` (`rule` + `message`). `validateClub` (inclui `no-asset-weight`), `validateClubAssets` e `validateKitAssets` (`unknown-asset`, recebem o registry), `validatePalette`, `validateKit` (inclui `logo-contrast`), `validateKitSet`; limite `MIN_COLOR_DISTANCE = 0.15`. Usadas pelo generator e pelo comando `validate`.
- `src/core/logo-colors.ts`: `backgroundRoles(kit, slot)` amostra uma grade 24×24 da caixa do logo com `colorAt` e devolve os papéis com cobertura ≥ 5%, dominante primeiro; `chooseLogoColors(palette, background)` tenta cor única da paleta, depois branco/preto, depois par cor + contorno (`MIN_LOGO_CONTRAST = 3`). Puro e sem `rng`; mede no layout 2D (`LOGO_BOXES`). O par branco + preto sempre resolve, por isso não existe retry por kit.
- `src/assets/registry.ts`: schema e leitura de `assets/registry.json` (`loadAssetRegistry`, `findAsset`, `getAsset`, `knownAssetIds`, `assetFilePath`). `file` é relativo à pasta de assets e não pode sair dela. `assetFilePath` é o único lugar que monta caminho de logo de marca; `clubLogoPath` (em `io/club-repository.ts`) é o único do escudo (`clubs/<id>/logo.png`).
- `src/generator/kit-generator.ts`: **único** ponto que usa aleatoriedade. `generateKitSet` valida o clube, resolve uma paleta (até 20 tentativas com `deriveSeed(seed, "palette:<n>")`), gera cada kit com `deriveSeed(seed, kitType)` e depois acrescenta os logos: um patrocinador e um fabricante por conjunto, sorteados com `deriveSeed(seed, "sponsor" | "manufacturer")` sobre as chaves do pool em ordem alfabética. Papéis em ciclo: Home primary/secondary, Away secondary/accent, Third accent/primary. A ordem das chamadas ao `rng` dentro de `generateKit` é contrato de reprodutibilidade; reordenar muda os kits gerados para a mesma seed. O generator não conhece o registry: quem chama roda `validateClubAssets` antes.
- `src/patterns`: cada padrão (`solid`, `stripes`, `sash`) é um `PatternTemplate` com `parameters` (min/max/default/integer), `render()` que devolve fragmento SVG e `colorAt(x, y, geometry)` que diz qual camada (`base`/`overlay`) pinta o ponto. `colorAt` precisa espelhar o `render()` (há teste de pixel genérico). Novos padrões entram no array de `registry.ts`. O `kit.json` guarda só `pattern.id` + `params`; `resolveParams` faz clamp e usa o default em valores ausentes ou inválidos. Os ranges mantêm o overlay abaixo de metade do tronco (há teste de pixel); um padrão novo precisa respeitar isso.
- `src/renderers`: determinístico. `shirt-2d-shape.ts` tem os paths da camisa (viewBox fixo, a gola muda o path do corpo) e `LOGO_BOXES`; `renderer-2d.ts` monta o SVG com `clipPath`, rasteriza e compõe os logos; `logo-image.ts` encaixa a imagem na caixa, recolore a silhueta (só o alfa importa) e desenha o contorno por dilatação. O renderer recebe só `Buffer`s (`KitLogoImages`), nunca lê disco. Sem logos não há `composite` e o PNG é idêntico ao da Fase 2a.
- `src/fm26/naming.ts`: única fonte de nomes de arquivo (`{slug}_{home|away|third}_{2d|3d}.png`, slug = `id` com `-` trocado por `_`). Não monte nomes de asset em outro lugar.
- `src/config/paths.ts`: `CLUBS_DIR`, `OUTPUT_DIR`, `ASSETS_DIR` e `kitRenderPath(outDir, clubId, kitType, renderType)`. Não monte caminhos de saída em outro lugar.
- `src/io`: `club-repository.ts` tem `listClubIds`, `loadClub` (o `id` do JSON deve bater com a pasta), `loadKit` (confere `clubId` e `kitType` contra a pasta), `saveKit(kit, clubsDir)` (o tipo vem de `kit.kitType`), `clubLogoPath` e `hasClubLogo`; `asset-repository.ts` tem `loadKitLogos` (lê só o que o kit declara; arquivo ausente ou que não é imagem vira erro com o caminho) e `checkAssetFiles` (`missing-asset`, `invalid-file`, `opaque-logo`, um aviso por arquivo); `json-file.ts` lê JSON com erros claros.
- `src/cli`: `run-cli.ts` tem `runCli(argv, io)` testável com `CliIo` injetado; comandos devolvem o exit code. `index.ts` é só o entrypoint. Erros viram `Error: ...` no stderr com exit code 1; no `--all`, `Error: [<id>] ...` por clube sem interromper os outros. `--assets <dir>` (padrão `assets/`) em `generate`, `render` e `validate`; `render` também aceita `--clubs`.

## Convenções e armadilhas

- `fmUniqueId` é string numérica informada pelo usuário; o código nunca o inventa nem o deriva do nome. Hoje só é validado.
- `generate` carrega o registry uma vez, imprime `Seed: N (<id>)` antes de tudo por clube, renderiza todos os PNGs pedidos e só depois grava os `kit.json`, para não sobrescrever kits versionados se a renderização (ou a leitura de um logo) falhar. Mantenha essa ordem.
- `generatedWith.seed` no `kit.json` é a seed do conjunto: `generate --club <id> --seed <ela>` reproduz o kit. `--type` só filtra o que é salvo; o conjunto inteiro é sempre gerado. No `--all --seed S`, cada clube usa `deriveSeed(S, id)`. Rótulos de `deriveSeed` em uso: `home`, `away`, `third`, `palette:<n>`, `sponsor`, `manufacturer` e o `id` do clube.
- `badge: true` só é gravado quando `clubs/<id>/logo.png` existe no `generate`. Logos de patrocinador e fabricante são silhuetas: as cores do arquivo são ignoradas. SVG com `<text>` depende das fontes da máquina; use texto convertido em curvas.
- `output/` e `dist/` são ignorados. `--out`, `--clubs` e `--assets` têm padrão relativo à raiz do projeto (`src/config/paths.ts`, funciona em `tsx` e em `dist/`); um valor informado é relativo ao diretório atual.
- `--seed` aceita inteiro 0..4294967295; seed que começa com `-` exige `--seed=-1` por causa do `parseArgs`, e mesmo assim é rejeitada.
- Imports internos usam extensão `.js` (`NodeNext` + `verbatimModuleSyntax`); use `import type` para tipos.
- Testes espelham `src/` em `tests/`; fixtures em `tests/fixtures/` (`makeClubsDir`, `makeTempDir` e `makeAssetsDir` criam pastas temporárias apagadas ao fim de cada teste via `onTestFinished`; só podem ser chamadas dentro de um teste). `tests/fixtures/assets.ts` também tem `LOGO_SVG`, `makeLogoPng`, `makeOpaquePng` e `writeClubLogo`.
- `clubs/*/kits` fica fora do Prettier: esses arquivos são escritos por `JSON.stringify`.
- `docs/fm_templates/` são assets de referência do FM26 (UV, PSDs, máscaras) só para engenharia; o runtime nunca os lê.
- Código e comentários seguem o estilo do repositório: comentários em português, só para o "porquê"; declarações em uma linha quando couberem. O Prettier (largura 160) decide as quebras; interfaces ficam multilinha.
````

- [ ] **Step 7: Atualizar o roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`, aplicar estas trocas (texto antigo → novo):

1. Na linha 5, `Planos detalhados: Fase 1 (`docs/superpowers/plans/2026-10-01-fase-1-mvp-2d.md`) e Fase 2a (spec` → `Planos detalhados: Fase 1 (`docs/superpowers/plans/2026-10-01-fase-1-mvp-2d.md`), Fase 2a (spec`; e, no fim da mesma linha, `plano `docs/superpowers/plans/2026-10-01-fase-2a-conjunto-kits-validacao.md`).` → `plano `docs/superpowers/plans/2026-10-01-fase-2a-conjunto-kits-validacao.md`) e Fase 2b (spec `docs/superpowers/specs/2026-10-01-fase-2b-assets-logos-design.md`, plano `docs/superpowers/plans/2026-10-01-fase-2b-assets-logos.md`).`
2. Linha da tabela `| 2b — Assets, escudo, patrocinadores e fabricantes | Pendente; falta escrever a spec e o plano detalhado |` → `| 2b — Assets, escudo, patrocinadores e fabricantes | **Concluída** (2026-10-01, `dev` @ `<hash>`, <N> testes) |`, com `<hash>` = `git log -1 --format=%h` depois do commit da Task 11 e `<N>` = total de testes do último `npm test`.
3. `Próximo passo: spec e plano da Fase 2b (assets, escudo, patrocinadores e fabricantes), com `superpowers:brainstorming` e depois `superpowers:writing-plans`.` → `Próximo passo: spec e plano da Fase 3 (layout UV, renderer 3D e exportação), com `superpowers:brainstorming` e depois `superpowers:writing-plans`.`
4. `Retry de geração por kit fica para a 2b, quando existirem regras de kit que podem falhar com paleta válida (contraste de patrocinador).` → `O retry de geração por kit foi descartado na 2b: o par branco + preto sempre resolve o contraste dos logos, então nenhuma regra de kit falha com paleta válida (spec da 2b, seção 5.4).`
5. `sem logos, patrocinadores, `config.xml` nem exportação.` → `logos só no peito (sem mangas, calção, nome e número); sem `config.xml` nem exportação.`
6. Em "Decisões já tomadas", acrescentar o item: `- Logos por ID: patrocinadores e fabricantes em `assets/registry.json` (`file` relativo a `assets/`); escudo em `clubs/<id>/logo.png`. Logos de marca são silhuetas recoloridas pelo contraste com a camisa.`
7. `## Fase 2 — Conjunto de kits, marcas e validação (2a CONCLUÍDA, 2b pendente)` → `## Fase 2 — Conjunto de kits, marcas e validação (CONCLUÍDA)`.
8. Depois do parágrafo que começa com `Dividida em 2a (itens 1, 5 e 6`, acrescentar o parágrafo: `A 2b guardou o registry em `assets/registry.json` (e não em `data/assets.json`), não implementou `allowedPositions`, `preferredColors` nem `minContrast` por asset (uma posição por logo no 2D), escolhe a cor dos logos por contraste com contorno quando preciso e descartou o retry por kit; ver a spec da 2b.`
9. No passo 4 da Fase 3 (`**Renderer 3D.**`), depois de `desenha cada região no seu polígono da UV`, acrescentar: `, com os logos do kit (`badge`, `sponsor`, `manufacturer`, lidos por `loadKitLogos`) nas sub-regiões de logo`.

- [ ] **Step 8: Gate final e commit**

Run: `npm run format && npm test && npm run typecheck && npm run build && npm run format:check && npm run kit-generator -- validate --all`
Expected: tudo verde; `OK galaticos-fc (3 kits)`.

```bash
git add clubs/galaticos-fc README.md CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: add galaticos badge and sponsors, regenerate seed 42 kits and document phase 2b"
```
