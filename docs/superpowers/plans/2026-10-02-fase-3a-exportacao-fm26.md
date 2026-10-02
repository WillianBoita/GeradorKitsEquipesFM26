# Fase 3a — Exportação para o FM26 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comando `kit-generator export` (`npm run export`) que renderiza os kits salvos de todos os clubes e grava, numa pasta plana `output/fm26_export/`, os PNGs 2D e um `config.xml` único, tudo ou nada.

**Architecture:** `src/fm26/config-xml.ts` (puro) monta o caminho FM (`to`), valida os registros e serializa o XML. `src/fm26/exporter.ts` carrega clubes e kits, valida as regras de export, renderiza em memória por uma função injetada (`RenderKit`), aborta com `ExportAbortedError` se algum clube falhar e só então grava PNGs e `config.xml`. A CLI liga `loadKitLogos` + `renderKit2dPng` como `RenderKit`.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Zod 4, Sharp, Vitest, `fast-xml-parser` (só nos testes), Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-02-fase-3a-exportacao-fm26-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova; `fast-xml-parser` continua em `devDependencies` e só aparece em `tests/`.
- Nome de arquivo e `from` só via `src/fm26/naming.ts` (`kitAssetName`, `kitAssetFileName`); caminho de saída só via `src/config/paths.ts`.
- Pasta padrão do export: `output/fm26_export/` (`FM26_EXPORT_DIR`); `config.xml` e PNGs na mesma pasta, sem subpastas.
- `to`: `graphics/pictures/team/{fmUniqueId}/kits/{tipo}` (2D) e `graphics/pictures/team/{fmUniqueId}/kit_textures/{tipo}` (3D).
- Resoluções FM26: 2D 414×414, 3D 1024×1024 (`FM26_RENDER_SIZES`).
- `home` e `away` obrigatórios, `third` opcional.
- Tudo ou nada: qualquer clube com issue → `ExportAbortedError` (`Export aborted, nothing was written (<n> of <total> clubs failed)`) e nenhum arquivo gravado.
- O export nunca apaga arquivos; sobrescreve só os que gera.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e de log em inglês, como no resto da CLI.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Clube criado mas nunca gerado (sem nenhum `kit.json`): o usuário espera ver `missing-kit` para `home` e para `away` na mesma execução, não um de cada vez. Teste na Task 4.
- `kit.json` ilegível: espera um único `invalid-file` com o caminho, sem um `missing-kit` duplicado para o mesmo tipo. Teste na Task 4.
- `badge: true` com `clubs/<id>/logo.png` apagado depois do `generate`: espera `render-failed` com o caminho do escudo e nada gravado. Teste na Task 5.
- Rodar `export` duas vezes na mesma pasta: o `config.xml` é reescrito (não acumula registros) e arquivos alheios continuam lá. Teste na Task 4.
- `--out` apontando para um arquivo existente: espera `Error: ...` e exit 1, sem stack trace. Teste na Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `clubs/galaticos-fc/club.json` | Modificar: `fmUniqueId` provisório `"1"` |
| `src/core/primitives.ts` | Modificar: `FmUniqueIdSchema` compartilhado |
| `src/core/club.ts` | Modificar: usa `FmUniqueIdSchema` |
| `src/core/errors.ts` | Criar: `errorMessage(error)` compartilhado entre CLI e exporter |
| `src/fm26/config-xml.ts` | Criar: `ConfigRecord`, `fmTargetPath`, `validateConfigRecords`, `buildConfigXml` |
| `src/fm26/exporter.ts` | Criar: regras de export, checagem de PNG, `exportKits`, `ExportAbortedError` |
| `src/config/paths.ts` | Modificar: `FM26_EXPORT_DIR`, `CONFIG_XML_FILE`, `exportFilePath`, `exportConfigPath` |
| `src/cli/run-cli.ts` | Modificar: comando `export`, `USAGE`, `errorMessage` importado |
| `package.json` | Modificar: script `export` |
| `tests/io/club-repository.test.ts` | Modificar: teste do clube empacotado |
| `tests/fm26/config-xml.test.ts` | Criar |
| `tests/fm26/exporter.test.ts` | Criar |
| `tests/config/paths.test.ts` | Modificar |
| `tests/cli/run-cli.test.ts` | Modificar |
| `README.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar: documentação da fase |

---

### Task 1: `fmUniqueId` provisório do Galáticos e teste do clube empacotado

O teste "loads the bundled galaticos-fc club" está vermelho desde o commit `8270571` (o clube trocou a primária para `#191970`). Esta tarefa deixa a suíte verde antes de começar e resolve a pendência herdada da Fase 1.

**Files:**
- Modify: `clubs/galaticos-fc/club.json`
- Modify: `tests/io/club-repository.test.ts:11-16`

**Interfaces:**
- Consumes: nada.
- Produces: `clubs/galaticos-fc/club.json` com `"fmUniqueId": "1"` (usado na Task 6 para o export real).

- [ ] **Step 1: Atualizar o teste**

Em `tests/io/club-repository.test.ts`, trocar:

```ts
  it("loads the bundled galaticos-fc club", async () => {
    const club = await loadClub("galaticos-fc");
    expect(club.name).toBe("Galáticos FC");
    expect(club.palette.primary).toBe("#123456");
    expect(club.fmUniqueId).toBeUndefined();
  });
```

por:

```ts
  it("loads the bundled galaticos-fc club", async () => {
    const club = await loadClub("galaticos-fc");
    expect(club.name).toBe("Galáticos FC");
    expect(club.palette.primary).toBe("#191970");
    expect(club.fmUniqueId).toBe("1");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/io/club-repository.test.ts -t "bundled"`
Expected: FAIL com `expected undefined to be '1'`.

- [ ] **Step 3: Preencher o ID no clube**

Em `clubs/galaticos-fc/club.json`, inserir a linha do `fmUniqueId` logo depois de `name`:

```json
{
  "id": "galaticos-fc",
  "name": "Galáticos FC",
  "fmUniqueId": "1",
  "palette": { "primary": "#191970", "secondary": "#8A00C4", "accent": "#F4FDFF" },
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS em todos os testes (358).

- [ ] **Step 5: Commit**

```bash
git add clubs/galaticos-fc/club.json tests/io/club-repository.test.ts
git commit -m "feat: give galaticos-fc a placeholder fmUniqueId for the FM26 export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `config.xml` (`src/fm26/config-xml.ts`)

**Files:**
- Modify: `src/core/primitives.ts`
- Modify: `src/core/club.ts:13`
- Create: `src/fm26/config-xml.ts`
- Test: `tests/fm26/config-xml.test.ts`

**Interfaces:**
- Consumes: `KIT_TYPES`, `KitTypeSchema`, `KitType` (`src/core/kit.ts`); `parseWith` (`src/core/primitives.ts`); `ValidationIssue`, `formatIssues` (`src/core/validation.ts`); `RENDER_TYPES`, `RenderType` (`src/fm26/naming.ts`).
- Produces:
  - `FmUniqueIdSchema` em `src/core/primitives.ts` (`z.string().regex(/^\d+$/)`).
  - `interface ConfigRecord { from: string; to: string }`
  - `fmTargetPath(fmUniqueId: string, kitType: KitType, renderType: RenderType): string` — lança `Invalid fmUniqueId`, `Invalid kit type` ou `Invalid render type`.
  - `validateConfigRecords(records: readonly ConfigRecord[]): ValidationIssue[]` — regras `invalid-from`, `invalid-to`, `duplicate-from`, `duplicate-to`.
  - `buildConfigXml(records: readonly ConfigRecord[]): string` — lança `Invalid config.xml records:` + issues formatadas quando `validateConfigRecords` acusa algo.

Nota: o spec diz que o exporter roda `validateConfigRecords` antes de serializar. Aqui a validação fica dentro de `buildConfigXml`, então nenhum chamador consegue serializar registro inválido; o exporter só chama `buildConfigXml`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/fm26/config-xml.test.ts`:

```ts
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import type { KitType } from "../../src/core/kit.js";
import { buildConfigXml, fmTargetPath, validateConfigRecords, type ConfigRecord } from "../../src/fm26/config-xml.js";
import type { RenderType } from "../../src/fm26/naming.js";

const GALATICOS_2D: ConfigRecord[] = [
  { from: "galaticos_fc_home_2d", to: "graphics/pictures/team/1/kits/home" },
  { from: "galaticos_fc_away_2d", to: "graphics/pictures/team/1/kits/away" },
  { from: "galaticos_fc_third_2d", to: "graphics/pictures/team/1/kits/third" },
];

describe("fmTargetPath", () => {
  it("maps 2D renders to kits/<type>", () => {
    expect(fmTargetPath("123456789", "home", "2d")).toBe("graphics/pictures/team/123456789/kits/home");
  });

  it("maps 3D renders to kit_textures/<type>", () => {
    expect(fmTargetPath("123456789", "third", "3d")).toBe("graphics/pictures/team/123456789/kit_textures/third");
  });

  it.each(["", "12a", "-1", "../1", "1.5"])("rejects the fmUniqueId %j", (fmUniqueId) => {
    expect(() => fmTargetPath(fmUniqueId, "home", "2d")).toThrow(/Invalid fmUniqueId/);
  });

  it("rejects unknown kit types at runtime", () => {
    expect(() => fmTargetPath("1", "fourth" as KitType, "2d")).toThrow(/Invalid kit type/);
  });

  it("rejects unknown render types at runtime", () => {
    expect(() => fmTargetPath("1", "home", "4d" as RenderType)).toThrow(/Invalid render type/);
  });
});

describe("validateConfigRecords", () => {
  it("accepts 2D and 3D records for several clubs", () => {
    const records = [...GALATICOS_2D, { from: "galaticos_fc_home_3d", to: "graphics/pictures/team/1/kit_textures/home" }, { from: "kong_team_home_2d", to: "graphics/pictures/team/2/kits/home" }];
    expect(validateConfigRecords(records)).toEqual([]);
  });

  it.each(["", "Galaticos FC", 'a"b', "galaticos-fc_home_2d", "../x"])("flags the from %j", (from) => {
    expect(validateConfigRecords([{ from, to: "graphics/pictures/team/1/kits/home" }]).map((issue) => issue.rule)).toEqual(["invalid-from"]);
  });

  it.each(["graphics/pictures/team/abc/kits/home", "graphics/pictures/team/1/kits/fourth", "graphics/pictures/team/1/logo", "graphics/pictures/team//kits/home", "/graphics/pictures/team/1/kits/home"])(
    "flags the to %j",
    (to) => {
      expect(validateConfigRecords([{ from: "galaticos_fc_home_2d", to }]).map((issue) => issue.rule)).toEqual(["invalid-to"]);
    },
  );

  it("flags each repeated from once", () => {
    const record = GALATICOS_2D[0]!;
    const issues = validateConfigRecords([record, { ...record, to: "graphics/pictures/team/2/kits/home" }, { ...record, to: "graphics/pictures/team/3/kits/home" }]);
    expect(issues).toEqual([{ rule: "duplicate-from", message: 'from="galaticos_fc_home_2d" appears in more than one record' }]);
  });

  it("flags a repeated to", () => {
    const issues = validateConfigRecords([GALATICOS_2D[0]!, { from: "kong_team_home_2d", to: "graphics/pictures/team/1/kits/home" }]);
    expect(issues).toEqual([{ rule: "duplicate-to", message: 'to="graphics/pictures/team/1/kits/home" appears in more than one record' }]);
  });
});

describe("buildConfigXml", () => {
  it("writes the FM26 config format with one record per line", () => {
    expect(buildConfigXml(GALATICOS_2D)).toBe(
      [
        "<record>",
        '    <boolean id="preload" value="false"/>',
        '    <boolean id="amap" value="false"/>',
        '    <list id="maps">',
        '        <record from="galaticos_fc_home_2d" to="graphics/pictures/team/1/kits/home"/>',
        '        <record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>',
        '        <record from="galaticos_fc_third_2d" to="graphics/pictures/team/1/kits/third"/>',
        "    </list>",
        "</record>",
        "",
      ].join("\n"),
    );
  });

  it("produces well-formed XML whose records read back in order", () => {
    const xml = buildConfigXml(GALATICOS_2D);
    expect(XMLValidator.validate(xml)).toBe(true);
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" }).parse(xml);
    expect(parsed.record.list.record).toEqual(GALATICOS_2D);
    expect(parsed.record.boolean).toEqual([
      { id: "preload", value: "false" },
      { id: "amap", value: "false" },
    ]);
  });

  it("keeps an empty map list well-formed", () => {
    const xml = buildConfigXml([]);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('    <list id="maps">\n    </list>\n');
  });

  it("refuses to serialize records that would break the XML", () => {
    expect(() => buildConfigXml([{ from: 'a"b', to: "graphics/pictures/team/1/kits/home" }])).toThrow(/Invalid config\.xml records:\n {2}- invalid-from/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fm26/config-xml.test.ts`
Expected: FAIL com `Failed to load url ../../src/fm26/config-xml.js` (módulo não existe).

- [ ] **Step 3: Extrair `FmUniqueIdSchema`**

Em `src/core/primitives.ts`, depois de `AssetIdSchema`:

```ts
// String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário.
export const FmUniqueIdSchema = z.string().regex(/^\d+$/, "must be the numeric FM Unique ID as a string");
```

Em `src/core/club.ts`, trocar o import e a linha do campo:

```ts
import { AssetIdSchema, ClubIdSchema, FmUniqueIdSchema, HexColorSchema, parseWith } from "./primitives.js";
```

e

```ts
  // String para não perder precisão em IDs grandes; nunca derivado do nome, sempre informado pelo usuário.
  fmUniqueId: z.string().regex(/^\d+$/, "must be the numeric FM Unique ID as a string").optional(),
```

por

```ts
  fmUniqueId: FmUniqueIdSchema.optional(),
```

- [ ] **Step 4: Implementar `src/fm26/config-xml.ts`**

```ts
import { z } from "zod";
import { KIT_TYPES, KitTypeSchema, type KitType } from "../core/kit.js";
import { FmUniqueIdSchema, parseWith } from "../core/primitives.js";
import { formatIssues, type ValidationIssue } from "../core/validation.js";
import { RENDER_TYPES, type RenderType } from "./naming.js";

export interface ConfigRecord {
  from: string;
  to: string;
}

const RenderTypeSchema = z.enum(RENDER_TYPES);
const TARGET_FOLDERS: Record<RenderType, string> = { "2d": "kits", "3d": "kit_textures" };
const INDENT = "    ";
// Com from e to restritos a estes padrões não há o que escapar: o XML sai bem formado por construção.
const FROM_PATTERN = /^[a-z0-9_]+$/;
const TO_PATTERN = new RegExp(`^graphics/pictures/team/\\d+/(${Object.values(TARGET_FOLDERS).join("|")})/(${KIT_TYPES.join("|")})$`);

export function fmTargetPath(fmUniqueId: string, kitType: KitType, renderType: RenderType): string {
  const id = parseWith(FmUniqueIdSchema, fmUniqueId, "fmUniqueId");
  const type = parseWith(KitTypeSchema, kitType, "kit type");
  return `graphics/pictures/team/${id}/${TARGET_FOLDERS[parseWith(RenderTypeSchema, renderType, "render type")]}/${type}`;
}

function duplicates(records: readonly ConfigRecord[], key: keyof ConfigRecord): ValidationIssue[] {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const record of records) {
    const value = record[key];
    if (seen.has(value) && !reported.has(value)) {
      issues.push({ rule: `duplicate-${key}`, message: `${key}="${value}" appears in more than one record` });
      reported.add(value);
    }
    seen.add(value);
  }
  return issues;
}

export function validateConfigRecords(records: readonly ConfigRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const record of records) {
    if (!FROM_PATTERN.test(record.from)) issues.push({ rule: "invalid-from", message: `"${record.from}" must contain only lowercase letters, digits and underscores` });
    if (!TO_PATTERN.test(record.to)) {
      issues.push({ rule: "invalid-to", message: `"${record.to}" is not graphics/pictures/team/<fmUniqueId>/<kits|kit_textures>/<home|away|third>` });
    }
  }
  return [...issues, ...duplicates(records, "from"), ...duplicates(records, "to")];
}

export function buildConfigXml(records: readonly ConfigRecord[]): string {
  const issues = validateConfigRecords(records);
  if (issues.length > 0) throw new Error(`Invalid config.xml records:\n${formatIssues(issues)}`);
  const lines = [
    "<record>",
    `${INDENT}<boolean id="preload" value="false"/>`,
    `${INDENT}<boolean id="amap" value="false"/>`,
    `${INDENT}<list id="maps">`,
    ...records.map((record) => `${INDENT.repeat(2)}<record from="${record.from}" to="${record.to}"/>`),
    `${INDENT}</list>`,
    "</record>",
  ];
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/fm26/config-xml.test.ts tests/core/club.test.ts`
Expected: PASS (os testes de `club.test.ts` continuam passando: a mensagem do schema não mudou).

- [ ] **Step 6: Typecheck e formatação**

Run: `npm run typecheck && npm run format && npm run format:check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/primitives.ts src/core/club.ts src/fm26/config-xml.ts tests/fm26/config-xml.test.ts
git commit -m "feat: build and validate the FM26 config.xml records

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Caminhos do export e regras por clube

**Files:**
- Modify: `src/config/paths.ts`
- Create: `src/fm26/exporter.ts`
- Test: `tests/config/paths.test.ts`
- Test: `tests/fm26/exporter.test.ts`

**Interfaces:**
- Consumes: `kitAssetFileName`, `RenderType` (`src/fm26/naming.ts`); `kitDefinitionPath(clubId, kitType, clubsDir)` (`src/io/club-repository.ts`); `ClubIdentity` (`src/core/club.ts`); `ValidationIssue`.
- Produces:
  - `FM26_EXPORT_DIR: string` (`<projeto>/output/fm26_export`), `CONFIG_XML_FILE = "config.xml"`.
  - `exportFilePath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string` → `<outDir>/<kitAssetFileName>`.
  - `exportConfigPath(outDir: string): string` → `<outDir>/config.xml`.
  - `FM26_RENDER_SIZES: Record<RenderType, number>` = `{ "2d": 414, "3d": 1024 }`.
  - `validateExportClub(club: ClubIdentity, kitTypes: readonly KitType[], clubsDir: string): ValidationIssue[]` — `kitTypes` são os tipos cujo `kit.json` existe (legível ou não); regras `missing-fm-unique-id`, `missing-kit`.
  - `duplicateFmUniqueIdIssues(clubs: readonly ClubIdentity[]): Map<string, ValidationIssue[]>` — chave = `club.id`; regra `duplicate-fm-unique-id`.
  - `checkRenderedPng(png: Buffer, kitType: KitType, renderType: RenderType): Promise<ValidationIssue | undefined>` — regra `invalid-render`.

- [ ] **Step 1: Escrever os testes de caminhos**

Em `tests/config/paths.test.ts`, trocar o import:

```ts
import { ASSETS_DIR, CLUBS_DIR, CONFIG_XML_FILE, exportConfigPath, exportFilePath, FM26_EXPORT_DIR, kitRenderPath, OUTPUT_DIR } from "../../src/config/paths.js";
import { ClubIdSchema } from "../../src/core/primitives.js";
```

e acrescentar no fim do arquivo:

```ts
describe("FM26 export paths", () => {
  it("places the export folder inside output/ with a name no club id can take", () => {
    expect(path.dirname(FM26_EXPORT_DIR)).toBe(OUTPUT_DIR);
    expect(path.basename(FM26_EXPORT_DIR)).toBe("fm26_export");
    expect(ClubIdSchema.safeParse(path.basename(FM26_EXPORT_DIR)).success).toBe(false);
  });

  it("puts every PNG flat in the export folder, next to config.xml", () => {
    expect(exportFilePath("/tmp/out", "galaticos-fc", "away", "2d")).toBe(path.join("/tmp/out", "galaticos_fc_away_2d.png"));
    expect(exportConfigPath("/tmp/out")).toBe(path.join("/tmp/out", CONFIG_XML_FILE));
    expect(CONFIG_XML_FILE).toBe("config.xml");
  });

  it("rejects invalid club ids", () => {
    expect(() => exportFilePath("/tmp/out", "../escape", "home", "2d")).toThrow(/Invalid club id/);
  });
});
```

- [ ] **Step 2: Escrever os testes das regras**

Criar `tests/fm26/exporter.test.ts`:

```ts
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { checkRenderedPng, duplicateFmUniqueIdIssues, FM26_RENDER_SIZES, validateExportClub } from "../../src/fm26/exporter.js";
import { GALATICOS_CLUB, KONG_CLUB } from "../fixtures/clubs.js";

const GALATICOS_EXPORT = { ...GALATICOS_CLUB, fmUniqueId: "1" };
const KONG_EXPORT = { ...KONG_CLUB, fmUniqueId: "2" };

function club(input: object): ClubIdentity {
  return parseClubIdentity(input);
}

async function solidPng(width: number, height = width): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: "#123456" } })
    .png()
    .toBuffer();
}

describe("FM26_RENDER_SIZES", () => {
  it("matches the FM26 2D and 3D resolutions", () => {
    expect(FM26_RENDER_SIZES).toEqual({ "2d": 414, "3d": 1024 });
  });
});

describe("validateExportClub", () => {
  it("accepts a club with fmUniqueId, home and away", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["home", "away"], "/clubs")).toEqual([]);
  });

  it("requires the fmUniqueId", () => {
    expect(validateExportClub(club(GALATICOS_CLUB), ["home", "away", "third"], "/clubs")).toEqual([
      { rule: "missing-fm-unique-id", message: 'Club "galaticos-fc" has no fmUniqueId' },
    ]);
  });

  it("names the expected kit.json of every missing required kit", () => {
    expect(validateExportClub(club(GALATICOS_EXPORT), ["third"], "/clubs")).toEqual([
      { rule: "missing-kit", message: `Club "galaticos-fc" has no home kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "home", "kit.json")})` },
      { rule: "missing-kit", message: `Club "galaticos-fc" has no away kit (expected ${path.join("/clubs", "galaticos-fc", "kits", "away", "kit.json")})` },
    ]);
  });
});

describe("duplicateFmUniqueIdIssues", () => {
  it("is empty when every fmUniqueId is unique or absent", () => {
    expect(duplicateFmUniqueIdIssues([club(GALATICOS_EXPORT), club(KONG_EXPORT), club({ ...KONG_CLUB, id: "no-id" })]).size).toBe(0);
  });

  it("flags every club that shares an fmUniqueId, naming the others", () => {
    const issues = duplicateFmUniqueIdIssues([club(GALATICOS_EXPORT), club({ ...KONG_EXPORT, fmUniqueId: "1" }), club({ ...KONG_EXPORT, id: "fnaf" })]);
    expect(Object.fromEntries(issues)).toEqual({
      "galaticos-fc": [{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "kong-team"' }],
      "kong-team": [{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "galaticos-fc"' }],
    });
  });

  it("lists every other club when three share an fmUniqueId", () => {
    const issues = duplicateFmUniqueIdIssues([club(GALATICOS_EXPORT), club({ ...KONG_EXPORT, fmUniqueId: "1" }), club({ ...KONG_EXPORT, id: "fnaf", fmUniqueId: "1" })]);
    expect(issues.get("fnaf")).toEqual([{ rule: "duplicate-fm-unique-id", message: 'fmUniqueId "1" is also used by club "galaticos-fc", "kong-team"' }]);
  });
});

describe("checkRenderedPng", () => {
  it("accepts a PNG with the FM26 size of its render type", async () => {
    expect(await checkRenderedPng(await solidPng(414), "home", "2d")).toBeUndefined();
    expect(await checkRenderedPng(await solidPng(1024), "away", "3d")).toBeUndefined();
  });

  it("flags a PNG with the wrong size", async () => {
    expect(await checkRenderedPng(await solidPng(400), "home", "2d")).toEqual({ rule: "invalid-render", message: "home 2d render is 400×400, expected 414×414" });
    expect(await checkRenderedPng(await solidPng(414, 300), "third", "2d")).toEqual({ rule: "invalid-render", message: "third 2d render is 414×300, expected 414×414" });
  });

  it("flags an image that is not a PNG", async () => {
    const jpeg = await sharp({ create: { width: 414, height: 414, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toBuffer();
    expect(await checkRenderedPng(jpeg, "away", "2d")).toEqual({ rule: "invalid-render", message: "away 2d render is jpeg, expected png" });
  });

  it("flags bytes that are not an image", async () => {
    expect(await checkRenderedPng(Buffer.from("nope"), "home", "2d")).toEqual({ rule: "invalid-render", message: "home 2d render is not an image" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/config/paths.test.ts tests/fm26/exporter.test.ts`
Expected: FAIL (`exportFilePath`/`FM26_EXPORT_DIR` não exportados; `src/fm26/exporter.js` não existe).

- [ ] **Step 4: Implementar os caminhos**

Em `src/config/paths.ts`, depois de `ASSETS_DIR`:

```ts
// "_" fica fora de [a-z0-9-]: nenhum clube gera um output/<id>/ com este nome.
export const FM26_EXPORT_DIR = path.join(OUTPUT_DIR, "fm26_export");
export const CONFIG_XML_FILE = "config.xml";
```

e no fim do arquivo:

```ts
// Pasta plana: o FM26 ignora `from` com subpasta, então PNGs e config.xml ficam juntos.
export function exportFilePath(outDir: string, clubId: string, kitType: KitType, renderType: RenderType): string {
  return path.join(outDir, kitAssetFileName(clubId, kitType, renderType));
}

export function exportConfigPath(outDir: string): string {
  return path.join(outDir, CONFIG_XML_FILE);
}
```

- [ ] **Step 5: Implementar as regras em `src/fm26/exporter.ts`**

```ts
import sharp from "sharp";
import type { ClubIdentity } from "../core/club.js";
import type { KitType } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import { kitDefinitionPath } from "../io/club-repository.js";
import type { RenderType } from "./naming.js";

// Resoluções exigidas pelo FM26 (spec de integração, seção 6), independentes do tamanho padrão de cada renderer.
export const FM26_RENDER_SIZES: Record<RenderType, number> = { "2d": 414, "3d": 1024 };

// Third é opcional: o clube só exporta menos registros.
const REQUIRED_KIT_TYPES: readonly KitType[] = ["home", "away"];

// kitTypes inclui kit.json ilegível: ele já vira invalid-file e não deve aparecer de novo como missing-kit.
export function validateExportClub(club: ClubIdentity, kitTypes: readonly KitType[], clubsDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (club.fmUniqueId === undefined) issues.push({ rule: "missing-fm-unique-id", message: `Club "${club.id}" has no fmUniqueId` });
  for (const kitType of REQUIRED_KIT_TYPES) {
    if (kitTypes.includes(kitType)) continue;
    issues.push({ rule: "missing-kit", message: `Club "${club.id}" has no ${kitType} kit (expected ${kitDefinitionPath(club.id, kitType, clubsDir)})` });
  }
  return issues;
}

// Mesmo ID em dois clubes geraria `to` duplicado e o FM aplicaria só um dos kits.
export function duplicateFmUniqueIdIssues(clubs: readonly ClubIdentity[]): Map<string, ValidationIssue[]> {
  const clubIdsByFmId = new Map<string, string[]>();
  for (const club of clubs) {
    if (club.fmUniqueId !== undefined) clubIdsByFmId.set(club.fmUniqueId, [...(clubIdsByFmId.get(club.fmUniqueId) ?? []), club.id]);
  }
  const issues = new Map<string, ValidationIssue[]>();
  for (const [fmUniqueId, clubIds] of clubIdsByFmId) {
    if (clubIds.length < 2) continue;
    for (const clubId of clubIds) {
      const others = clubIds.filter((other) => other !== clubId).map((other) => `"${other}"`);
      issues.set(clubId, [{ rule: "duplicate-fm-unique-id", message: `fmUniqueId "${fmUniqueId}" is also used by club ${others.join(", ")}` }]);
    }
  }
  return issues;
}

// O buffer vem do próprio renderer: a checagem pega erro de programa (tamanho ou formato), não arquivo corrompido.
export async function checkRenderedPng(png: Buffer, kitType: KitType, renderType: RenderType): Promise<ValidationIssue | undefined> {
  const label = `${kitType} ${renderType} render`;
  const size = FM26_RENDER_SIZES[renderType];
  const metadata = await sharp(png)
    .metadata()
    .catch(() => undefined);
  if (!metadata) return { rule: "invalid-render", message: `${label} is not an image` };
  if (metadata.format !== "png") return { rule: "invalid-render", message: `${label} is ${metadata.format}, expected png` };
  if (metadata.width !== size || metadata.height !== size) {
    return { rule: "invalid-render", message: `${label} is ${metadata.width}×${metadata.height}, expected ${size}×${size}` };
  }
  return undefined;
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run tests/config/paths.test.ts tests/fm26/exporter.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck e formatação**

Run: `npm run typecheck && npm run format && npm run format:check`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/config/paths.ts src/fm26/exporter.ts tests/config/paths.test.ts tests/fm26/exporter.test.ts
git commit -m "feat: add FM26 export paths and per-club export rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `exportKits` (tudo ou nada)

**Files:**
- Create: `src/core/errors.ts`
- Modify: `src/cli/run-cli.ts` (remover o `errorMessage` local e importar o compartilhado)
- Modify: `src/fm26/exporter.ts`
- Test: `tests/fm26/exporter.test.ts`

**Interfaces:**
- Consumes: Task 2 (`buildConfigXml`, `fmTargetPath`, `ConfigRecord`); Task 3 (`exportFilePath`, `exportConfigPath`, `validateExportClub`, `duplicateFmUniqueIdIssues`, `checkRenderedPng`, `FM26_RENDER_SIZES`); `listClubIds`, `loadClub`, `loadKit` (`src/io/club-repository.ts`); `kitAssetName` (`src/fm26/naming.ts`); `KIT_TYPES`, `KitDefinition`.
- Produces:
  - `errorMessage(error: unknown): string` em `src/core/errors.ts`.
  - `type RenderKit = (kit: KitDefinition, renderType: RenderType) => Promise<Buffer>`
  - `interface ExportOptions { clubsDir: string; outDir: string; renderTypes: readonly RenderType[]; renderKit: RenderKit }`
  - `interface ExportedClub { club: ClubIdentity; kitTypes: KitType[] }`
  - `interface ExportResult { clubs: ExportedClub[]; configFile: string; recordCount: number }`
  - `interface ClubExportFailure { clubId: string; issues: ValidationIssue[] }`
  - `class ExportAbortedError extends Error { readonly failures: ClubExportFailure[]; readonly clubCount: number }` — mensagem `Export aborted, nothing was written (<n> of <total> clubs failed)`.
  - `exportKits(options: ExportOptions): Promise<ExportResult>` — lança `No clubs found in <dir>` sem clubes.

- [ ] **Step 1: Escrever os testes**

Em `tests/fm26/exporter.test.ts`, trocar o bloco de imports por:

```ts
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parseClubIdentity, type ClubIdentity } from "../../src/core/club.js";
import { KIT_TYPES, type KitType } from "../../src/core/kit.js";
import { buildConfigXml } from "../../src/fm26/config-xml.js";
import {
  checkRenderedPng,
  duplicateFmUniqueIdIssues,
  ExportAbortedError,
  exportKits,
  FM26_RENDER_SIZES,
  validateExportClub,
  type RenderKit,
} from "../../src/fm26/exporter.js";
import type { RenderType } from "../../src/fm26/naming.js";
import { kitDefinitionPath, saveKit } from "../../src/io/club-repository.js";
import { GALATICOS_CLUB, KONG_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";
import { makeTempDir } from "../fixtures/temp.js";
```

e acrescentar no fim do arquivo:

```ts
function fakeRenderer(sizes: Partial<Record<RenderType, number>> = {}): { renderKit: RenderKit; calls: string[] } {
  const calls: string[] = [];
  const renderKit: RenderKit = async (kit, renderType) => {
    calls.push(`${kit.clubId} ${kit.kitType} ${renderType}`);
    return solidPng(sizes[renderType] ?? FM26_RENDER_SIZES[renderType]);
  };
  return { renderKit, calls };
}

// Cada clube recebe os kits pedidos (padrão: os três), salvos como o generate salvaria.
async function clubsWithKits(clubs: Record<string, object>, kitTypes: Record<string, readonly KitType[]> = {}): Promise<string> {
  const dir = await makeClubsDir(Object.fromEntries(Object.entries(clubs).map(([id, content]) => [id, JSON.stringify(content)])));
  for (const id of Object.keys(clubs)) {
    for (const kitType of kitTypes[id] ?? KIT_TYPES) await saveKit(makeKit({ clubId: id, kitType }), dir);
  }
  return dir;
}

// A pasta de saída ainda não existe: um export abortado não pode criá-la.
async function outputDir(): Promise<string> {
  return path.join(await makeTempDir("export"), "fm26_export");
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

async function expectAbort(promise: Promise<unknown>): Promise<ExportAbortedError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ExportAbortedError);
  return error as ExportAbortedError;
}

function record(clubSlug: string, fmUniqueId: string, kitType: KitType, renderType: RenderType = "2d") {
  return { from: `${clubSlug}_${kitType}_${renderType}`, to: `graphics/pictures/team/${fmUniqueId}/${renderType === "2d" ? "kits" : "kit_textures"}/${kitType}` };
}

describe("exportKits", () => {
  it("writes every 2D PNG and one config.xml into a flat folder", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    const result = await exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit });
    expect((await readdir(outDir)).sort()).toEqual(["config.xml", "galaticos_fc_away_2d.png", "galaticos_fc_home_2d.png", "galaticos_fc_third_2d.png"]);
    expect(await sharp(path.join(outDir, "galaticos_fc_home_2d.png")).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(buildConfigXml(KIT_TYPES.map((kitType) => record("galaticos_fc", "1", kitType))));
    expect(result).toEqual({
      clubs: [{ club: parseClubIdentity(GALATICOS_EXPORT), kitTypes: ["home", "away", "third"] }],
      configFile: path.join(outDir, "config.xml"),
      recordCount: 3,
    });
  });

  it("exports two records when the third kit is absent", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": ["home", "away"] });
    const outDir = await outputDir();
    const result = await exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit });
    expect(result.recordCount).toBe(2);
    expect(result.clubs[0]?.kitTypes).toEqual(["home", "away"]);
    expect(await exists(path.join(outDir, "galaticos_fc_third_2d.png"))).toBe(false);
  });

  it("orders records by club id, then render type, then kit type", async () => {
    const clubsDir = await clubsWithKits({ "kong-team": KONG_EXPORT, "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    await exportKits({ clubsDir, outDir, renderTypes: ["2d", "3d"], renderKit: fakeRenderer().renderKit });
    const expected = [
      ...(["2d", "3d"] as const).flatMap((renderType) => KIT_TYPES.map((kitType) => record("galaticos_fc", "1", kitType, renderType))),
      ...(["2d", "3d"] as const).flatMap((renderType) => KIT_TYPES.map((kitType) => record("kong_team", "2", kitType, renderType))),
    ];
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(buildConfigXml(expected));
    expect(await sharp(path.join(outDir, "kong_team_away_3d.png")).metadata()).toMatchObject({ width: 1024, height: 1024 });
  });

  it("aborts without writing anything when a club has no fmUniqueId", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_CLUB });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.message).toBe("Export aborted, nothing was written (1 of 1 clubs failed)");
    expect(error.failures).toEqual([{ clubId: "galaticos-fc", issues: [{ rule: "missing-fm-unique-id", message: 'Club "galaticos-fc" has no fmUniqueId' }] }]);
    expect(error.clubCount).toBe(1);
    expect(await exists(outDir)).toBe(false);
  });

  it("lists both missing required kits of a club that was never generated", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": [] });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures[0]?.issues).toEqual([
      { rule: "missing-kit", message: `Club "galaticos-fc" has no home kit (expected ${kitDefinitionPath("galaticos-fc", "home", clubsDir)})` },
      { rule: "missing-kit", message: `Club "galaticos-fc" has no away kit (expected ${kitDefinitionPath("galaticos-fc", "away", clubsDir)})` },
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("reports an unreadable kit.json once, as invalid-file", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    await writeFile(kitDefinitionPath("galaticos-fc", "away", clubsDir), "{ not json");
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    const issues = error.failures[0]?.issues ?? [];
    expect(issues.map((issue) => issue.rule)).toEqual(["invalid-file"]);
    expect(issues[0]?.message).toContain(kitDefinitionPath("galaticos-fc", "away", clubsDir));
    expect(await exists(outDir)).toBe(false);
  });

  it("reports an unreadable club.json as invalid-file", async () => {
    const clubsDir = await makeClubsDir({ "galaticos-fc": "{ not json" });
    const error = await expectAbort(exportKits({ clubsDir, outDir: await outputDir(), renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures[0]?.issues.map((issue) => issue.rule)).toEqual(["invalid-file"]);
  });

  it("rejects two clubs with the same fmUniqueId", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT, "kong-team": { ...KONG_EXPORT, fmUniqueId: "1" } });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit }));
    expect(error.failures.map((failure) => [failure.clubId, failure.issues.map((issue) => issue.rule)])).toEqual([
      ["galaticos-fc", ["duplicate-fm-unique-id"]],
      ["kong-team", ["duplicate-fm-unique-id"]],
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("turns a renderer exception into render-failed", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const renderKit: RenderKit = async (kit) => {
      if (kit.kitType === "away") throw new Error("Sponsor file missing");
      return solidPng(414);
    };
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit }));
    expect(error.failures[0]?.issues).toEqual([{ rule: "render-failed", message: "away 2d: Sponsor file missing" }]);
    expect(await exists(outDir)).toBe(false);
  });

  it("rejects a render with the wrong size", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT }, { "galaticos-fc": ["home", "away"] });
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer({ "2d": 400 }).renderKit }));
    expect(error.failures[0]?.issues).toEqual([
      { rule: "invalid-render", message: "home 2d render is 400×400, expected 414×414" },
      { rule: "invalid-render", message: "away 2d render is 400×400, expected 414×414" },
    ]);
    expect(await exists(outDir)).toBe(false);
  });

  it("lists the failures of every club and still renders the valid ones", async () => {
    const clubsDir = await clubsWithKits({ "alpha-fc": { ...KONG_CLUB, id: "alpha-fc" }, "galaticos-fc": GALATICOS_EXPORT, "kong-team": KONG_EXPORT }, { "kong-team": ["home"] });
    const renderer = fakeRenderer();
    const outDir = await outputDir();
    const error = await expectAbort(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: renderer.renderKit }));
    expect(error.message).toBe("Export aborted, nothing was written (2 of 3 clubs failed)");
    expect(error.failures.map((failure) => [failure.clubId, failure.issues.map((issue) => issue.rule)])).toEqual([
      ["alpha-fc", ["missing-fm-unique-id"]],
      ["kong-team", ["missing-kit"]],
    ]);
    expect(renderer.calls).toEqual(["galaticos-fc home 2d", "galaticos-fc away 2d", "galaticos-fc third 2d"]);
    expect(await exists(outDir)).toBe(false);
  });

  it("rewrites its own files on a second run and keeps files it did not write", async () => {
    const clubsDir = await clubsWithKits({ "galaticos-fc": GALATICOS_EXPORT });
    const outDir = await outputDir();
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "old_club_home_2d.png"), "stale");
    const options = { clubsDir, outDir, renderTypes: ["2d"] as const, renderKit: fakeRenderer().renderKit };
    await exportKits(options);
    const first = await readFile(path.join(outDir, "config.xml"), "utf8");
    await exportKits(options);
    expect(await readFile(path.join(outDir, "config.xml"), "utf8")).toBe(first);
    expect(await readFile(path.join(outDir, "old_club_home_2d.png"), "utf8")).toBe("stale");
    expect((await readdir(outDir)).sort()).toEqual(["config.xml", "galaticos_fc_away_2d.png", "galaticos_fc_home_2d.png", "galaticos_fc_third_2d.png", "old_club_home_2d.png"]);
  });

  it("fails without creating the output folder when there are no clubs", async () => {
    const clubsDir = await makeClubsDir({});
    const outDir = await outputDir();
    await expect(exportKits({ clubsDir, outDir, renderTypes: ["2d"], renderKit: fakeRenderer().renderKit })).rejects.toThrow(`No clubs found in ${clubsDir}`);
    expect(await exists(outDir)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fm26/exporter.test.ts`
Expected: FAIL (`exportKits`/`ExportAbortedError` não exportados).

- [ ] **Step 3: Extrair `errorMessage`**

Criar `src/core/errors.ts`:

```ts
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Em `src/cli/run-cli.ts`, apagar a função local:

```ts
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

e acrescentar o import (em ordem alfabética entre os imports de `../core/`):

```ts
import { errorMessage } from "../core/errors.js";
```

- [ ] **Step 4: Implementar `exportKits`**

Em `src/fm26/exporter.ts`, trocar o bloco de imports por:

```ts
import { mkdir, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { exportConfigPath, exportFilePath } from "../config/paths.js";
import type { ClubIdentity } from "../core/club.js";
import { errorMessage } from "../core/errors.js";
import { KIT_TYPES, type KitDefinition, type KitType } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import { kitDefinitionPath, listClubIds, loadClub, loadKit } from "../io/club-repository.js";
import { buildConfigXml, fmTargetPath, type ConfigRecord } from "./config-xml.js";
import { kitAssetName, type RenderType } from "./naming.js";
```

e acrescentar no fim do arquivo:

```ts
export type RenderKit = (kit: KitDefinition, renderType: RenderType) => Promise<Buffer>;

export interface ExportOptions {
  clubsDir: string;
  outDir: string;
  renderTypes: readonly RenderType[];
  renderKit: RenderKit;
}

export interface ExportedClub {
  club: ClubIdentity;
  kitTypes: KitType[];
}

export interface ExportResult {
  clubs: ExportedClub[];
  configFile: string;
  recordCount: number;
}

export interface ClubExportFailure {
  clubId: string;
  issues: ValidationIssue[];
}

export class ExportAbortedError extends Error {
  readonly failures: ClubExportFailure[];
  readonly clubCount: number;

  constructor(failures: ClubExportFailure[], clubCount: number) {
    super(`Export aborted, nothing was written (${failures.length} of ${clubCount} clubs failed)`);
    this.name = "ExportAbortedError";
    this.failures = failures;
    this.clubCount = clubCount;
  }
}

type ClubKits = Partial<Record<KitType, KitDefinition>>;

interface LoadedClub {
  clubId: string;
  club?: ClubIdentity;
  kits: ClubKits;
  issues: ValidationIssue[];
}

interface ExportFile {
  file: string;
  png: Buffer;
  record: ConfigRecord;
}

interface RenderedClub {
  files: ExportFile[];
  issues: ValidationIssue[];
}

async function isFile(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false,
  );
}

async function loadExportClub(clubId: string, clubsDir: string): Promise<LoadedClub> {
  let club: ClubIdentity;
  try {
    club = await loadClub(clubId, clubsDir);
  } catch (error) {
    return { clubId, kits: {}, issues: [{ rule: "invalid-file", message: errorMessage(error) }] };
  }
  const kits: ClubKits = {};
  const unreadable: KitType[] = [];
  const issues: ValidationIssue[] = [];
  for (const kitType of KIT_TYPES) {
    try {
      const kit = await loadKit(club.id, kitType, clubsDir);
      if (kit) kits[kitType] = kit;
    } catch (error) {
      unreadable.push(kitType);
      issues.push({ rule: "invalid-file", message: errorMessage(error) });
    }
  }
  const present = KIT_TYPES.filter((kitType) => kits[kitType] !== undefined || unreadable.includes(kitType));
  issues.push(...validateExportClub(club, present, clubsDir));
  return { clubId, club, kits, issues };
}

// Ordem dos registros: render (2d antes de 3d) e depois tipo de kit, como no exemplo do spec de integração.
async function renderClub(club: ClubIdentity, fmUniqueId: string, kits: ClubKits, options: ExportOptions): Promise<RenderedClub> {
  const files: ExportFile[] = [];
  const issues: ValidationIssue[] = [];
  for (const renderType of options.renderTypes) {
    for (const kitType of KIT_TYPES) {
      const kit = kits[kitType];
      if (!kit) continue;
      let png: Buffer;
      try {
        png = await options.renderKit(kit, renderType);
      } catch (error) {
        issues.push({ rule: "render-failed", message: `${kitType} ${renderType}: ${errorMessage(error)}` });
        continue;
      }
      const invalid = await checkRenderedPng(png, kitType, renderType);
      if (invalid) {
        issues.push(invalid);
        continue;
      }
      const record = { from: kitAssetName(club.id, kitType, renderType), to: fmTargetPath(fmUniqueId, kitType, renderType) };
      files.push({ file: exportFilePath(options.outDir, club.id, kitType, renderType), png, record });
    }
  }
  return { files, issues };
}

// Tudo ou nada: acumula os problemas de todos os clubes e só grava se nenhum falhou, para a pasta nunca perder um clube sem aviso.
export async function exportKits(options: ExportOptions): Promise<ExportResult> {
  const clubIds = await listClubIds(options.clubsDir);
  if (clubIds.length === 0) throw new Error(`No clubs found in ${options.clubsDir}`);
  const loaded: LoadedClub[] = [];
  for (const clubId of clubIds) loaded.push(await loadExportClub(clubId, options.clubsDir));
  const duplicates = duplicateFmUniqueIdIssues(loaded.flatMap((entry) => entry.club ?? []));
  const failures: ClubExportFailure[] = [];
  const exported: ExportedClub[] = [];
  const files: ExportFile[] = [];
  for (const entry of loaded) {
    const issues = [...entry.issues, ...(duplicates.get(entry.clubId) ?? [])];
    const fmUniqueId = entry.club?.fmUniqueId;
    // Clubes válidos renderizam mesmo depois de uma falha, para o usuário ver todos os problemas de uma vez.
    if (entry.club && fmUniqueId !== undefined && issues.length === 0) {
      const rendered = await renderClub(entry.club, fmUniqueId, entry.kits, options);
      issues.push(...rendered.issues);
      files.push(...rendered.files);
      exported.push({ club: entry.club, kitTypes: KIT_TYPES.filter((kitType) => entry.kits[kitType] !== undefined) });
    }
    if (issues.length > 0) failures.push({ clubId: entry.clubId, issues });
  }
  if (failures.length > 0) throw new ExportAbortedError(failures, clubIds.length);
  const records = files.map((file) => file.record);
  // buildConfigXml valida os registros: um registro inválido aborta antes de qualquer escrita.
  const xml = buildConfigXml(records);
  await mkdir(options.outDir, { recursive: true });
  for (const file of files) await writeFile(file.file, file.png);
  const configFile = exportConfigPath(options.outDir);
  await writeFile(configFile, xml);
  for (const file of files) {
    if (!(await isFile(file.file))) throw new Error(`config.xml references ${file.record.from} but ${file.file} was not written`);
  }
  return { clubs: exported, configFile, recordCount: records.length };
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/fm26/exporter.test.ts tests/cli/run-cli.test.ts`
Expected: PASS (a CLI continua verde com o `errorMessage` compartilhado).

- [ ] **Step 6: Typecheck e formatação**

Run: `npm run typecheck && npm run format && npm run format:check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/core/errors.ts src/cli/run-cli.ts src/fm26/exporter.ts tests/fm26/exporter.test.ts
git commit -m "feat: export all clubs to a flat FM26 folder, all or nothing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Comando `export` na CLI

**Files:**
- Modify: `src/cli/run-cli.ts`
- Modify: `package.json`
- Test: `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: Task 3 (`FM26_EXPORT_DIR`); Task 4 (`exportKits`, `ExportAbortedError`, `RenderKit`); `loadKitLogos`, `AssetDirs` (`src/io/asset-repository.ts`); `renderKit2dPng`; `formatIssues`.
- Produces: `kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]`; script `npm run export`; linha nova em `USAGE`.

- [ ] **Step 1: Escrever os testes**

Em `tests/cli/run-cli.test.ts`, trocar o import de `node:fs/promises`:

```ts
import { access, readFile, rm, writeFile } from "node:fs/promises";
```

por:

```ts
import { access, readFile, rm, unlink, writeFile } from "node:fs/promises";
```

Inserir antes de `describe("runCli usage", ...)`:

```ts
describe("runCli export", () => {
  // Clube com fmUniqueId e os três kits gerados pela seed 42; devolve também a pasta dos previews do generate.
  async function exportableClubs(club: object = { ...GALATICOS_CLUB, fmUniqueId: "1" }, assets?: string): Promise<{ clubs: string; preview: string }> {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify(club) });
    const preview = await makeTempDir("cli");
    const assetArgs = assets === undefined ? [] : ["--assets", assets];
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--out", preview, ...assetArgs], captureIo().io);
    return { clubs, preview };
  }

  async function exportDir(): Promise<string> {
    return path.join(await makeTempDir("cli"), "fm26_export");
  }

  it("writes the 2D PNGs and config.xml of every club into one folder", async () => {
    const { clubs } = await exportableClubs();
    const out = await exportDir();
    const { io, logs, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      expect(await sharp(path.join(out, `galaticos_fc_${kitType}_2d.png`)).metadata()).toMatchObject({ format: "png", width: 414, height: 414 });
    }
    const xml = await readFile(path.join(out, "config.xml"), "utf8");
    expect(xml).toContain('<record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>');
    expect(logs).toEqual(["Exported Galáticos FC: home, away, third", `Wrote 3 records to ${path.join(out, "config.xml")}`]);
    expect(errors).toEqual([]);
  });

  it("exports the same PNG the generate preview shows", async () => {
    const { clubs, preview } = await exportableClubs();
    const out = await exportDir();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], captureIo().io)).toBe(0);
    for (const kitType of KIT_TYPES) {
      expect((await readFile(path.join(out, `galaticos_fc_${kitType}_2d.png`))).equals(await readFile(pngFile(preview, "galaticos-fc", kitType)))).toBe(true);
    }
  });

  it("aborts without writing anything when a club has no fmUniqueId", async () => {
    const { clubs } = await exportableClubs(GALATICOS_CLUB);
    const out = await exportDir();
    const { io, logs, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(1);
    expect(errors).toEqual([
      'Error: [galaticos-fc] Club cannot be exported:\n  - missing-fm-unique-id: Club "galaticos-fc" has no fmUniqueId',
      "Error: Export aborted, nothing was written (1 of 1 clubs failed)",
    ]);
    expect(logs).toEqual([]);
    expect(await exists(out)).toBe(false);
  });

  it("reports a badge deleted after generate as a render failure with its path", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_BRANDED_CLUB, fmUniqueId: "1" }) });
    const assets = await makeAssetsDir();
    await writeClubLogo(clubs, "galaticos-fc");
    await runCli(["generate", "--club", "galaticos-fc", "--seed", "42", "--clubs", clubs, "--assets", assets, "--out", await makeTempDir("cli")], captureIo().io);
    const logo = path.join(clubs, "galaticos-fc", "logo.png");
    await unlink(logo);
    const out = await exportDir();
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--assets", assets, "--out", out], io)).toBe(1);
    expect(errors[0]).toContain(`  - render-failed: home 2d: Club "galaticos-fc" badge not found: ${logo}`);
    expect(errors.at(-1)).toBe("Error: Export aborted, nothing was written (1 of 1 clubs failed)");
    expect(await exists(out)).toBe(false);
  });

  it("reports an --out that is a file", async () => {
    const { clubs } = await exportableClubs();
    const out = path.join(await makeTempDir("cli"), "not-a-dir");
    await writeFile(out, "");
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", out], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: EEXIST/);
  });

  it("reports an empty clubs folder", async () => {
    const clubs = await makeClubsDir({});
    const { io, errors } = captureIo();
    expect(await runCli(["export", "--clubs", clubs, "--out", await exportDir()], io)).toBe(1);
    expect(errors).toEqual([`Error: No clubs found in ${clubs}`]);
  });
});
```

E, dentro de `describe("runCli usage", ...)`, acrescentar:

```ts
  it("documents the export command", () => {
    expect(USAGE).toContain("kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/cli/run-cli.test.ts -t "export"`
Expected: FAIL (o comando `export` imprime `USAGE` e devolve 1).

- [ ] **Step 3: Implementar o comando**

Em `src/cli/run-cli.ts`:

1. Trocar o import de caminhos:

```ts
import { ASSETS_DIR, CLUBS_DIR, FM26_EXPORT_DIR, kitRenderPath, OUTPUT_DIR } from "../config/paths.js";
```

2. Acrescentar o import do exporter (depois do import de `../core/validation.js`, antes de `../generator/kit-generator.js`):

```ts
import { ExportAbortedError, exportKits, type RenderKit } from "../fm26/exporter.js";
```

3. Acrescentar a linha ao `USAGE`, depois da linha do `validate`:

```ts
  "  kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]",
```

4. Acrescentar a função antes de `runCli`:

```ts
async function exportCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    out: { type: "string", default: FM26_EXPORT_DIR },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const registry = await loadAssetRegistry(values.assets);
  const dirs: AssetDirs = { assetsDir: values.assets, clubsDir: values.clubs };
  // Só 2D na 3a; a 3b escolhe o renderer pelo renderType.
  const renderKit: RenderKit = async (kit) => renderKit2dPng(kit, { logos: await loadKitLogos(kit, registry, dirs) });
  try {
    const result = await exportKits({ clubsDir: values.clubs, outDir: path.resolve(values.out), renderTypes: ["2d"], renderKit });
    for (const { club, kitTypes } of result.clubs) io.log(`Exported ${club.name}: ${kitTypes.join(", ")}`);
    io.log(`Wrote ${result.recordCount} records to ${result.configFile}`);
    return 0;
  } catch (error) {
    if (!(error instanceof ExportAbortedError)) throw error;
    for (const failure of error.failures) io.error(`Error: [${failure.clubId}] Club cannot be exported:\n${formatIssues(failure.issues)}`);
    io.error(`Error: ${error.message}`);
    return 1;
  }
}
```

5. Em `runCli`, depois da linha do `validate`:

```ts
    if (command === "export") return await exportCommand(args, io);
```

Em `package.json`, acrescentar o script depois de `kit-generator`:

```json
    "kit-generator": "tsx src/cli/index.ts",
    "export": "tsx src/cli/index.ts export"
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/cli/run-cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate completo**

Run: `npm test && npm run typecheck && npm run build && npm run format && npm run format:check`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/cli/run-cli.ts package.json tests/cli/run-cli.test.ts
git commit -m "feat: add the export command for the FM26 graphics folder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Export real, documentação e teste no jogo

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-10-01-roadmap.md`

**Interfaces:**
- Consumes: todo o resto.
- Produces: `output/fm26_export/` do Galáticos (não versionado) e a documentação da fase.

- [ ] **Step 1: Export real**

Run: `npm run export`
Expected: exit 0, com as linhas `Exported Galáticos FC: home, away, third` e `Wrote 3 records to <projeto>/output/fm26_export/config.xml`.

- [ ] **Step 2: Inspeção visual**

Abrir (Read) `output/fm26_export/galaticos_fc_home_2d.png`, `..._away_2d.png` e `..._third_2d.png` e conferir que batem com `output/galaticos-fc/2d/` do último `generate`. Ler `output/fm26_export/config.xml` e conferir os três registros com `to="graphics/pictures/team/1/kits/<tipo>"`.

- [ ] **Step 3: README**

Em `README.md`, trocar o parágrafo de `## Status` por:

```markdown
Fase 3a concluída: gera os kits Home, Away e Third de um clube com a mesma paleta, valida a coerência das cores, renderiza um PNG 2D 414×414 por kit (com escudo, patrocinador e fabricante) e exporta todos os clubes para o FM26 numa pasta com os PNGs e um `config.xml` gerado. A textura 3D ainda não existe (Fase 3b). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.
```

Inserir antes de `## Desenvolvimento`:

````markdown
## 6. Exportar para o FM26

Preencha `fmUniqueId` no `club.json` de cada clube com o Unique ID do clube no FM26 (o projeto nunca inventa esse número) e gere os kits. Depois:

```bash
npm run export
```

O comando lê os `kit.json` salvos de **todos** os clubes de `clubs/`, renderiza os PNGs 2D e grava tudo em `output/fm26_export/`: um PNG por kit (`galaticos_fc_home_2d.png`, ...) e um único `config.xml` que mapeia cada PNG para `graphics/pictures/team/<fmUniqueId>/kits/<tipo>`. Os PNGs ficam na mesma pasta do `config.xml` porque o FM26 ignora caminhos com subpasta no `from`.

Cada clube precisa de `fmUniqueId` e dos kits `home` e `away`; `third` é opcional. Dois clubes com o mesmo `fmUniqueId` são rejeitados. Se qualquer clube tiver problema, nada é gravado: o comando lista os erros de todos os clubes (`Error: [<id>] ...`) e termina com código 1. O export sobrescreve os arquivos que gera e nunca apaga nada da pasta.

Opções: `--out <dir>` (pasta de saída; pode apontar direto para dentro do `graphics/` do jogo), `--clubs <dir>` e `--assets <dir>`.

Instalação no jogo: copie a pasta `output/fm26_export/` para `Documents/Sports Interactive/Football Manager 26/graphics/kits/`. No FM26, em Preferências > Interface, desligue o cache de skin e recarregue a skin para o jogo ler o `config.xml` novo.
````

Em `## Desenvolvimento`, na linha de estrutura, trocar `` `src/fm26` (nomes de arquivo) `` por `` `src/fm26` (nomes de arquivo, `config.xml` e exporter) ``.

- [ ] **Step 4: CLAUDE.md**

Em `CLAUDE.md`:

1. Em `## Visão geral`, trocar a frase `Estado atual: Fase 2b concluída. Cada clube ganha Home, Away e Third com a mesma paleta, validados por regras de coerência, e um PNG 2D 414×414 por kit com escudo, patrocinador e fabricante. Exportação para o FM26 (\`config.xml\`, textura 3D, Fase 3) ainda não existe.` por:

```markdown
Estado atual: Fase 3a concluída. Cada clube ganha Home, Away e Third com a mesma paleta, validados por regras de coerência, e um PNG 2D 414×414 por kit com escudo, patrocinador e fabricante. `export` grava os PNGs 2D de todos os clubes e um `config.xml` único em `output/fm26_export/`. Textura 3D (Fase 3b) ainda não existe.
```

2. No bloco de `## Comandos`, depois da linha do `validate --all`, acrescentar:

```bash
npm run export                             # todos os clubes -> output/fm26_export/ (PNGs 2D + config.xml), tudo ou nada
```

3. Em `## Arquitetura`, trocar a linha `Fluxo: ...` por:

```markdown
Fluxo: `club.json` (identidade + pools de marcas) → `generateKitSet(identity, seed, { badge })` → três `KitDefinition` (dado puro, salvos como `kits/<tipo>/kit.json`) → `loadKitLogos` (lê escudo e logos) → `renderKit2dPng(kit, { logos })` (SVG → Sharp → PNG, logos compostos por cima). `export` relê os `kit.json` salvos → `exportKits` → PNGs + `config.xml`.
```

4. Depois do item de `src/fm26/naming.ts`, acrescentar:

```markdown
- `src/fm26/config-xml.ts`: puro. `fmTargetPath` (`graphics/pictures/team/<fmUniqueId>/kits|kit_textures/<tipo>`), `validateConfigRecords` (`invalid-from`, `invalid-to`, `duplicate-from`, `duplicate-to`) e `buildConfigXml`, que valida antes de serializar; com `from`/`to` restritos o XML é bem formado por construção (o `fast-xml-parser` só roda nos testes).
- `src/fm26/exporter.ts`: `exportKits` carrega todos os clubes, aplica `validateExportClub` (`missing-fm-unique-id`, `missing-kit`; `third` opcional), `duplicateFmUniqueIdIssues` e `checkRenderedPng` (`FM26_RENDER_SIZES`: 2D 414, 3D 1024), renderiza em memória por um `RenderKit` injetado (não conhece padrão nem logo) e só grava se nenhum clube falhou; senão lança `ExportAbortedError` com as issues de cada clube. PNGs primeiro, `config.xml` por último.
```

5. No item de `src/config/paths.ts`, acrescentar ao fim: `` `FM26_EXPORT_DIR` (`output/fm26_export`; o `_` impede colisão com id de clube), `exportFilePath` e `exportConfigPath` (pasta plana). ``

6. No item de `src/cli`, acrescentar ao fim: `` `export` (sem `--club`/`--all`: sempre todos os clubes) aceita `--out`, `--clubs` e `--assets`; `ExportAbortedError` vira `Error: [<id>] Club cannot be exported:` + issues e a linha final `Error: Export aborted, ...`. `errorMessage` mora em `core/errors.ts`. ``

7. Em `## Convenções e armadilhas`, trocar o item do `fmUniqueId` por:

```markdown
- `fmUniqueId` é string numérica informada pelo usuário (`FmUniqueIdSchema` em `core/primitives.ts`); o código nunca o inventa nem o deriva do nome. O do `galaticos-fc` (`"1"`) é provisório.
- O FM26 ignora `from` com subpasta: PNGs e `config.xml` ficam na mesma pasta, e o `from` é o `kitAssetName` sem `.png`. Não reintroduza subpastas no export.
- `export` é tudo ou nada e nunca apaga arquivos: PNG antigo sem registro fica inerte, porque o FM só aplica o que o `config.xml` mapeia.
```

- [ ] **Step 5: Roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. Na linha 5, acrescentar ao fim: `` Fase 3a (spec `docs/superpowers/specs/2026-10-02-fase-3a-exportacao-fm26-design.md`, plano `docs/superpowers/plans/2026-10-02-fase-3a-exportacao-fm26.md`). ``
2. Na tabela de status, trocar a linha da Fase 3 por duas linhas: `| 3a — Exportação FM26 (config.xml, pacote 2D) | **Concluída** (2026-10-02, \`dev\`, último commit de código <hash do commit da Task 5>, <n> testes) |` com o hash e a contagem reais de `git log -1 --format=%h` (antes deste commit de docs) e de `npm test`; e `| 3b — Layout UV, renderer 3D e calibração no jogo | Pendente; falta spec e plano |`.
3. Trocar `Próximo passo: ...` por: `Próximo passo: spec e plano da Fase 3b (layout UV, renderer 3D, textura de calibração e 3D no export), com \`superpowers:brainstorming\` e depois \`superpowers:writing-plans\`. As notas de UV levantadas na 3a estão na seção 11 da spec da 3a.`
4. Em "Qualidade e testes (backlog)", apagar o item `Teste "loads the bundled galaticos-fc club" afirma \`fmUniqueId\` ausente; ajustar na Fase 3 quando o clube de exemplo ganhar um ID real.`
5. Em "Limitações atuais", trocar `` `fmUniqueId` validado mas não usado; `` por `` `fmUniqueId` do Galáticos provisório (`"1"`); `` e `` sem `config.xml` nem exportação. `` por `` sem textura 3D. ``
6. Em "Decisões já tomadas", acrescentar: `` - Export FM26 (3a): pasta plana `output/fm26_export/` com todos os PNGs e um `config.xml` único, porque o FM26 ignora `from` com subpasta; isso substitui o layout por clube da seção 9 do spec de integração. `export` processa sempre todos os clubes (sem `--club`/`--all`), é tudo ou nada e nunca apaga arquivos. ``
7. No título `## Fase 3 — FM26: layout UV, renderer 3D e exportação`, acrescentar logo abaixo de `Pré-requisito: Fase 2 concluída.`: `` Dividida em 3a (passos 6 a 8, só 2D: **concluída**, ver spec da 3a) e 3b (passos 1 a 5 e o 3D no export). Mudanças em relação aos passos abaixo: saída plana em `output/fm26_export/` em vez de `output/<id>/{2d,3d}/`; sem `--club`/`--all`; `config.xml` único em vez de um por clube + consolidado. ``

- [ ] **Step 6: Gate e commit**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde.

```bash
git add README.md CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document the FM26 export and mark phase 3a done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Teste no jogo (portão do usuário)**

Pedir ao usuário: trocar `fmUniqueId` do Galáticos pelo Unique ID real do clube substituído (ou manter `"1"` se esse clube existir), rodar `npm run export`, copiar `output/fm26_export/` para `Documents/Sports Interactive/Football Manager 26/graphics/kits/`, recarregar a skin e conferir se os kits 2D aparecem no clube. Se os passos de instalação no jogo forem diferentes dos do README (pasta, nome da opção de cache), corrigir a seção "Instalação no jogo" do README com o que funcionou e commitar (`docs: fix FM26 install steps after in-game test`). A fase só fecha com a confirmação do usuário.
