# Fase 3b — Variedade de kits, camada de desenho compartilhada e layout UV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nove padrões novos, perfis de estilo, tradições do clube e um contact sheet HTML (`preview`), mais a camada de desenho compartilhada entre renderers e o layout UV do FM26 como dado, sem mudar os kits que Galáticos e Kongs geram para a mesma seed.

**Architecture:** `src/renderers/kit-design.ts` resolve o que pintar em cada parte do kit e o renderer 2D passa a consumir só isso. Os padrões novos seguem o contrato `render` + `colorAt` de `src/patterns/`. Os pesos do sorteio saem de `src/styles/` (perfis em constante TS + `patternCandidates`, que aplica as tradições), e o generator continua fazendo uma única chamada `rng.weighted` por kit. `src/preview/contact-sheet.ts` monta um HTML estático com os PNGs em base64, e a CLI ganha o comando `preview`. `src/fm26/layout.ts` guarda o layout UV hipotético; nada o lê em runtime nesta fase.

**Tech Stack:** TypeScript (ESM, NodeNext, `verbatimModuleSyntax`), Node >= 22.12, Zod 4, Sharp, Vitest, `fast-xml-parser` (só nos testes), Prettier (largura 160).

**Spec:** `docs/superpowers/specs/2026-10-05-fase-3b-variedade-layout-design.md`

## Global Constraints

- Imports internos com extensão `.js`; `import type` para tipos.
- Nenhuma dependência nova.
- Reprodutibilidade: a ordem das chamadas ao `rng` em `generateKit` não muda e nenhum rótulo novo de `deriveSeed` é criado. Os guardas da Task 1 (`Phase 3b baseline`) ficam verdes do começo ao fim do plano.
- Parâmetros de tamanho dos padrões novos são frações de `width`/`height`; o `sash` mantém a largura absoluta.
- Cobertura do overlay no tronco 2D: menos de 50% para todos os padrões, exceto `halves` e `checkers` (no máximo 51%).
- `classic` = solid 40, stripes 35, sash 25, sem normalizar, é o perfil de clube sem `categories` nem `patternWeights`.
- Nada lê `FM26_KIT_LAYOUT` em runtime; o runtime nunca lê `docs/fm_templates/` (os testes podem ler).
- Caminho de saída só via `src/config/paths.ts`; nome de arquivo e slug só via `src/fm26/naming.ts`.
- Comentários em português, só para o "porquê"; declarações em uma linha quando couberem; interfaces multilinha; `npm run format` decide as quebras.
- Mensagens de erro e de log em inglês, como no resto da CLI.
- Commits em inglês (Conventional Commits) terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Com `core.autocrlf=true`, um `git stash`/`git checkout` pode regravar arquivos em CRLF e quebrar o `format:check`; volte-os para LF com `sed -i 's/\r$//' <arquivo>`.

## Review Focus

- Categoria com typo ou maiúscula (`"categories": ["Modern"]`): o usuário espera que `generate` falhe com `unknown-style` listando os estilos conhecidos, não que gere com pesos inesperados. Teste na Task 6.
- Categoria repetida (`["modern", "modern"]`): espera os mesmos pesos de `["modern"]`. Teste na Task 6.
- `"traditions": {}` (objeto vazio): espera exatamente os mesmos kits de um clube sem `traditions`. Teste na Task 7.
- Clube só com Home e Away salvos no `preview`: espera dois kits e exit 0, sem erro pelo Third ausente. Teste na Task 4.
- `preview --out` apontando para uma pasta: espera `Error: EISDIR...` e exit 1, sem stack trace. Teste na Task 4.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/renderers/kit-design.ts` | Criar: `KitFill`, `KitDesign`, `kitDesign`, `fillSvg` |
| `src/renderers/renderer-2d.ts` | Modificar: consome `kitDesign`/`fillSvg` |
| `src/preview/contact-sheet.ts` | Criar: `PreviewKit`, `PreviewSection`, `kitDetails`, `buildContactSheetHtml` |
| `src/config/paths.ts` | Modificar: `PREVIEW_FILE`, `samplesPreviewPath` |
| `src/cli/run-cli.ts` | Modificar: comando `preview`, `parseSamples`, `USAGE`, `validateKitTraditions` no `validate` |
| `src/patterns/{pinstripes,hoops,diagonal,chevron,chest-band,center-band,checkers,halves,gradient}.ts` | Criar: um padrão por arquivo |
| `src/patterns/registry.ts` | Modificar: registra os nove padrões |
| `src/patterns/types.ts`, `solid.ts`, `stripes.ts`, `sash.ts` | Modificar: sai `defaultWeight` |
| `src/styles/profiles.ts` | Criar: `StyleProfile`, `STYLE_PROFILES`, `DEFAULT_STYLE_PROFILE`, `findStyleProfile`, `getStyleProfile`, `knownStyleIds` |
| `src/styles/pattern-weights.ts` | Criar: `resolvePatternWeights`, `patternCandidates` |
| `src/core/club.ts` | Modificar: `traditions` |
| `src/core/kit.ts` | Modificar: `visibleRoles` |
| `src/core/validation.ts` | Modificar: `unknown-style`, regras de tradição, `validateKitTraditions` |
| `src/generator/kit-generator.ts` | Modificar: sorteio por `patternCandidates`, `requiredColor` |
| `src/fm26/layout.ts` | Criar: `FM26_KIT_LAYOUT` e tipos |
| `tests/renderers/kit-design.test.ts`, `tests/preview/contact-sheet.test.ts`, `tests/styles/profiles.test.ts`, `tests/styles/pattern-weights.test.ts`, `tests/fm26/layout.test.ts` | Criar |
| `tests/renderers/renderer-2d.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/patterns/patterns.test.ts`, `tests/patterns/params.test.ts`, `tests/core/{club,kit,validation}.test.ts`, `tests/config/paths.test.ts`, `tests/cli/run-cli.test.ts` | Modificar |
| `README.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md` | Modificar: documentação da fase |

---

### Task 1: Guardas de referência antes da Fase 3b

Grava o estado atual que a fase não pode mudar: o SVG 2D dos padrões atuais e os conjuntos gerados para um clube com `patternWeights` e para um clube sem configuração. Os hashes foram calculados sobre o código de `dev` @ `a892e75`. Como na guarda da 2b (`keeps the Phase 2a design for seed 42`), estes testes passam já na criação.

**Files:**
- Modify: `tests/renderers/renderer-2d.test.ts`
- Modify: `tests/generator/kit-generator.test.ts`

**Interfaces:**
- Consumes: `renderKit2dSvg(kit)`, `generateKitSet(identity, seed, { badge })`, `makeKit`, `GALATICOS_CLUB`, `GALATICOS_BRANDED_CLUB`.
- Produces: os describes `renderKit2dSvg Phase 3b baseline` e `generateKitSet Phase 3b baseline`, que todas as tasks seguintes mantêm verdes.

- [ ] **Step 1: Adicionar a guarda do SVG**

Em `tests/renderers/renderer-2d.test.ts`, acrescente no topo `import { createHash } from "node:crypto";` (antes do import de `fast-xml-parser`) e, no fim do arquivo:

```ts
// Guarda da Fase 3b: passa antes e depois da camada de desenho compartilhada; o SVG 2D dos padrões atuais não pode mudar.
describe("renderKit2dSvg Phase 3b baseline", () => {
  it("keeps the SVG of every current pattern, collar and sleeve style", () => {
    const kits = ["solid", "stripes", "sash"].flatMap((id) =>
      (["round", "v-neck"] as const).flatMap((collar) =>
        (["match-body", "solid"] as const).map((sleeves) =>
          makeKit({
            pattern: { id, base: "primary", overlay: "secondary", params: {} },
            collar: { style: collar, color: "accent" },
            sleeves: { style: sleeves, color: "secondary", cuffColor: "accent" },
          }),
        ),
      ),
    );
    const digest = createHash("sha256")
      .update(kits.map((kit) => renderKit2dSvg(kit)).join("\n"))
      .digest("hex");
    expect(digest).toBe("acdafaa885203f9f125260033f4ef9b225720ea04165ad11f244a57e6ce96d40");
  });
});
```

- [ ] **Step 2: Adicionar a guarda do generator**

Em `tests/generator/kit-generator.test.ts`, acrescente `import { createHash } from "node:crypto";` como primeiro import e, no fim do arquivo:

```ts
function setsDigest(club: ClubIdentity, badge: boolean): string {
  const sets = Array.from({ length: 30 }, (_, seed) => generateKitSet(club, seed, { badge }));
  return createHash("sha256").update(JSON.stringify(sets)).digest("hex");
}

// Guarda da Fase 3b: passa antes e depois de padrões, perfis e tradições; estes clubes não podem mudar de kit para a mesma seed.
describe("generateKitSet Phase 3b baseline", () => {
  it("keeps the sets of a club with pattern weights and brands", () => {
    expect(setsDigest(branded, true)).toBe("a2633676e2aa3350ebc307ebcb9703442abbd64b45d68c0f44999582f73cc08a");
  });

  it("keeps the sets of a club without categories or pattern weights", () => {
    expect(setsDigest(parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } }), false)).toBe(
      "e69b9a924a8b3943500bf9730e543e41c7c6b6fca9fe0c95deff9d9907507eb5",
    );
  });
});
```

- [ ] **Step 3: Rodar as guardas**

Run: `npx vitest run tests/renderers/renderer-2d.test.ts tests/generator/kit-generator.test.ts -t "Phase 3b baseline"`
Expected: 3 testes PASS. Se um hash divergir, pare: o código de partida não é o de `a892e75` e os hashes precisam ser recalculados antes de seguir.

- [ ] **Step 4: Formatar e commitar**

```bash
npm run format
git add tests/renderers/renderer-2d.test.ts tests/generator/kit-generator.test.ts
git commit -m "test: pin the 2D SVG and generated kit sets before phase 3b

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Camada de desenho compartilhada

**Files:**
- Create: `src/renderers/kit-design.ts`
- Modify: `src/renderers/renderer-2d.ts`
- Test: `tests/renderers/kit-design.test.ts`

**Interfaces:**
- Consumes: `getPatternTemplate(id)`, `resolveParams(template, raw)`, `PatternTemplate`.
- Produces:
  - `type KitFill = { kind: "solid"; color: string } | { kind: "pattern"; base: string; overlay: string; template: PatternTemplate; params: Record<string, number> }`
  - `interface KitDesign { body: KitFill; sleeves: KitFill; cuffs: string; collar: string; shorts: string; socks: string }`
  - `kitDesign(kit: KitDefinition): KitDesign`
  - `fillSvg(fill: KitFill, width: number, height: number): string`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/renderers/kit-design.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPatternTemplate } from "../../src/patterns/registry.js";
import { fillSvg, kitDesign } from "../../src/renderers/kit-design.js";
import { makeKit } from "../fixtures/kits.js";

describe("kitDesign", () => {
  it("resolves the body pattern with hex colors and clamped params", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 99 } } });
    expect(kitDesign(kit).body).toEqual({
      kind: "pattern",
      base: "#123456",
      overlay: "#ffffff",
      template: getPatternTemplate("stripes"),
      params: { count: 15, ratio: 0.3 },
    });
  });

  it("gives match-body sleeves the body fill", () => {
    const design = kitDesign(makeKit({ sleeves: { style: "match-body", color: "accent", cuffColor: "secondary" } }));
    expect(design.sleeves).toBe(design.body);
  });

  it("gives solid sleeves the sleeve color", () => {
    expect(kitDesign(makeKit({ sleeves: { style: "solid", color: "accent", cuffColor: "secondary" } })).sleeves).toEqual({ kind: "solid", color: "#ffd700" });
  });

  it("resolves collar, cuffs, shorts and socks to hex", () => {
    const kit = makeKit({
      collar: { style: "round", color: "accent" },
      sleeves: { style: "solid", color: "secondary", cuffColor: "primary" },
      shorts: { color: "secondary" },
      socks: { color: "accent" },
    });
    expect(kitDesign(kit)).toMatchObject({ collar: "#ffd700", cuffs: "#123456", shorts: "#ffffff", socks: "#ffd700" });
  });

  it("throws for unknown patterns", () => {
    expect(() => kitDesign(makeKit({ pattern: { id: "zigzag", base: "primary", overlay: "secondary", params: {} } }))).toThrow(/Unknown pattern "zigzag"/);
  });
});

describe("fillSvg", () => {
  it("paints a solid fill as one rect", () => {
    expect(fillSvg({ kind: "solid", color: "#ffd700" }, 100, 50)).toBe('<rect width="100" height="50" fill="#ffd700"/>');
  });

  it("paints the pattern over its base", () => {
    const body = kitDesign(makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 3 } } })).body;
    const svg = fillSvg(body, 414, 414);
    expect(svg.startsWith('<rect width="414" height="414" fill="#123456"/>')).toBe(true);
    expect(svg.match(/fill="#ffffff"/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/renderers/kit-design.test.ts`
Expected: FAIL (`Cannot find module '../../src/renderers/kit-design.js'`).

- [ ] **Step 3: Implementar `kit-design.ts`**

Crie `src/renderers/kit-design.ts`:

```ts
import type { ColorRole, KitDefinition } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

// O que pintar em cada parte do kit, sem saber onde a parte fica: o renderer 2D e o 3D (Fase 3c) desenham a partir daqui.
export type KitFill =
  | { kind: "solid"; color: string }
  | { kind: "pattern"; base: string; overlay: string; template: PatternTemplate; params: Record<string, number> };

export interface KitDesign {
  body: KitFill;
  sleeves: KitFill;
  cuffs: string;
  collar: string;
  shorts: string;
  socks: string;
}

export function kitDesign(kit: KitDefinition): KitDesign {
  const color = (role: ColorRole): string => kit.colors[role];
  const template = getPatternTemplate(kit.pattern.id);
  const body: KitFill = { kind: "pattern", base: color(kit.pattern.base), overlay: color(kit.pattern.overlay), template, params: resolveParams(template, kit.pattern.params) };
  return {
    body,
    sleeves: kit.sleeves.style === "match-body" ? body : { kind: "solid", color: color(kit.sleeves.color) },
    cuffs: color(kit.sleeves.cuffColor),
    collar: color(kit.collar.color),
    shorts: color(kit.shorts.color),
    socks: color(kit.socks.color),
  };
}

export function fillSvg(fill: KitFill, width: number, height: number): string {
  if (fill.kind === "solid") return `<rect width="${width}" height="${height}" fill="${fill.color}"/>`;
  const pattern = fill.template.render({ width, height, base: fill.base, overlay: fill.overlay, params: fill.params });
  return `<rect width="${width}" height="${height}" fill="${fill.base}"/>${pattern}`;
}
```

- [ ] **Step 4: Rodar o teste novo**

Run: `npx vitest run tests/renderers/kit-design.test.ts`
Expected: PASS.

- [ ] **Step 5: Trocar o renderer 2D para a camada**

Em `src/renderers/renderer-2d.ts`, troque os imports do topo:

```ts
import sharp from "sharp";
import { BRAND_KINDS, resolveLogoColor, type KitDefinition, type LogoSlot } from "../core/kit.js";
import { fillSvg, kitDesign } from "./kit-design.js";
import { badgeLayer, brandLogoLayers, type LogoLayer, type PixelBox } from "./logo-image.js";
import { bodyPath, collarPath, CUFFS_PATH, LOGO_BOXES, outlinePath, SHIRT_2D_VIEWBOX, SLEEVES_PATH, type LogoBox } from "./shirt-2d-shape.js";
```

e substitua a função `renderKit2dSvg` inteira por:

```ts
export function renderKit2dSvg(kit: KitDefinition, options: Render2dOptions = {}): string {
  const size = options.size ?? KIT_2D_SIZE;
  const view = SHIRT_2D_VIEWBOX;
  const design = kitDesign(kit);
  // Manga lisa continua um <path> preenchido, como antes da camada: o SVG 2D não pode mudar (guarda da Fase 3b).
  const sleeves =
    design.sleeves.kind === "solid"
      ? `<path d="${SLEEVES_PATH}" fill="${design.sleeves.color}"/>`
      : `<g clip-path="url(#sleeves)">${fillSvg(design.sleeves, view, view)}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">`,
    `<defs><clipPath id="body"><path d="${bodyPath(kit.collar.style)}"/></clipPath><clipPath id="sleeves"><path d="${SLEEVES_PATH}"/></clipPath></defs>`,
    `<g clip-path="url(#body)">${fillSvg(design.body, view, view)}</g>`,
    sleeves,
    `<path d="${CUFFS_PATH}" fill="none" stroke="${design.cuffs}" stroke-width="8"/>`,
    `<path d="${collarPath(kit.collar.style)}" fill="none" stroke="${design.collar}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${outlinePath(kit.collar.style)}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
}
```

- [ ] **Step 6: Rodar renderer, guarda e typecheck**

Run: `npx vitest run tests/renderers && npm run typecheck`
Expected: PASS, incluindo `renderKit2dSvg Phase 3b baseline` (o SVG não mudou). Se a guarda falhar, compare o SVG antigo e o novo de um kit da matriz e corrija a diferença; não altere o hash.

- [ ] **Step 7: Formatar e commitar**

```bash
npm run format
git add src/renderers/kit-design.ts src/renderers/renderer-2d.ts tests/renderers/kit-design.test.ts
git commit -m "refactor: extract the shared kit design layer from the 2D renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Contact sheet em HTML

**Files:**
- Create: `src/preview/contact-sheet.ts`
- Test: `tests/preview/contact-sheet.test.ts`

**Interfaces:**
- Consumes: `getPatternTemplate`, `resolveParams`, `KitDefinition`, `KitType`.
- Produces:
  - `interface PreviewKit { kitType: KitType; png: Buffer; details: string[] }`
  - `interface PreviewSection { title: string; kits: PreviewKit[] }`
  - `kitDetails(kit: KitDefinition): string[]`
  - `buildContactSheetHtml(title: string, sections: readonly PreviewSection[]): string`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/preview/contact-sheet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildContactSheetHtml, kitDetails, type PreviewKit, type PreviewSection } from "../../src/preview/contact-sheet.js";
import { makeKit } from "../fixtures/kits.js";

function section(title: string, ...pngs: Buffer[]): PreviewSection {
  return { title, kits: pngs.map((png): PreviewKit => ({ kitType: "home", png, details: ["solid · classic"] })) };
}

describe("buildContactSheetHtml", () => {
  it("is a complete HTML document", () => {
    const html = buildContactSheetHtml("Saved kits", []);
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>Saved kits</title>");
    expect(html).not.toContain("<script");
    expect(html.endsWith("</body></html>\n")).toBe(true);
  });

  it("embeds each PNG as base64 that decodes back to the original bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const html = buildContactSheetHtml("Saved kits", [section("Club", png)]);
    const sources = [...html.matchAll(/<img src="data:image\/png;base64,([^"]+)"/g)].map((match) => match[1]!);
    expect(sources).toHaveLength(1);
    expect(Buffer.from(sources[0]!, "base64").equals(png)).toBe(true);
  });

  it("renders one section per entry, in order, with the details of each kit", () => {
    const html = buildContactSheetHtml("Samples", [section("Seed 0", Buffer.from([1])), section("Seed 1", Buffer.from([2]), Buffer.from([3]))]);
    expect(html.indexOf("<h2>Seed 0</h2>")).toBeLessThan(html.indexOf("<h2>Seed 1</h2>"));
    expect(html.match(/<figure>/g)).toHaveLength(3);
    expect(html).toContain("<strong>home</strong><br>solid · classic");
  });

  it("escapes text that comes from the data", () => {
    const html = buildContactSheetHtml(`<Kongs & "Co">`, [{ title: "O'Brien <b>", kits: [{ kitType: "away", png: Buffer.from([1]), details: ["<i>"] }] }]);
    expect(html).toContain("<title>&lt;Kongs &amp; &quot;Co&quot;&gt;</title>");
    expect(html).toContain("<h2>O&#39;Brien &lt;b&gt;</h2>");
    expect(html).toContain("<br>&lt;i&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("kitDetails", () => {
  it("lists the pattern with category and resolved params, the seed and the brands", () => {
    const kit = makeKit({
      generatedWith: { seed: 42 },
      pattern: { id: "stripes", base: "primary", overlay: "secondary", params: { count: 7, ratio: 0.3 } },
      sponsor: { id: "luna-air", color: "accent" },
      manufacturer: { id: "vertex", color: "accent" },
    });
    expect(kitDetails(kit)).toEqual(["stripes · classic · count 7, ratio 0.3", "seed 42", "sponsor luna-air", "manufacturer vertex"]);
  });

  it("omits what the kit does not have", () => {
    expect(kitDetails(makeKit())).toEqual(["solid · classic"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/preview/contact-sheet.test.ts`
Expected: FAIL (`Cannot find module '../../src/preview/contact-sheet.js'`).

- [ ] **Step 3: Implementar `contact-sheet.ts`**

Crie `src/preview/contact-sheet.ts`:

```ts
import type { KitDefinition, KitType } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";

export interface PreviewKit {
  kitType: KitType;
  png: Buffer;
  details: string[];
}

export interface PreviewSection {
  title: string;
  kits: PreviewKit[];
}

const STYLE = [
  "body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f4f4f5;color:#18181b}",
  "h1{margin:0 0 24px;font-size:22px}h2{margin:0 0 12px;font-size:17px}section{margin-bottom:32px}",
  ".kits{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}",
  "figure{margin:0;padding:12px;background:#fff;border-radius:8px}img{display:block;width:100%;height:auto}",
  "figcaption{margin-top:8px;font-size:13px;line-height:1.5}strong{text-transform:capitalize}",
].join("");

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

export function kitDetails(kit: KitDefinition): string[] {
  const template = getPatternTemplate(kit.pattern.id);
  const params = Object.entries(resolveParams(template, kit.pattern.params))
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
  const lines = [[template.id, template.category, params].filter((part) => part !== "").join(" · ")];
  if (kit.generatedWith) lines.push(`seed ${kit.generatedWith.seed}`);
  if (kit.sponsor) lines.push(`sponsor ${kit.sponsor.id}`);
  if (kit.manufacturer) lines.push(`manufacturer ${kit.manufacturer.id}`);
  return lines;
}

// PNG embutido em base64: o arquivo é autossuficiente e os ids fixos de clipPath do SVG 2D nunca se repetem na página.
function kitHtml(kit: PreviewKit): string {
  const details = kit.details.map((line) => `<br>${escapeHtml(line)}`).join("");
  return `<figure><img src="data:image/png;base64,${kit.png.toString("base64")}" alt="${kit.kitType}"><figcaption><strong>${kit.kitType}</strong>${details}</figcaption></figure>`;
}

function sectionHtml(section: PreviewSection): string {
  return `<section><h2>${escapeHtml(section.title)}</h2><div class="kits">${section.kits.map(kitHtml).join("")}</div></section>`;
}

export function buildContactSheetHtml(title: string, sections: readonly PreviewSection[]): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    `<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>`,
    `<body><h1>${escapeHtml(title)}</h1>`,
    ...sections.map(sectionHtml),
    "</body></html>",
    "",
  ].join("\n");
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run tests/preview/contact-sheet.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Formatar e commitar**

```bash
npm run format
git add src/preview/contact-sheet.ts tests/preview/contact-sheet.test.ts
git commit -m "feat: build a self-contained HTML contact sheet of kits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Comando `preview`

**Files:**
- Modify: `src/config/paths.ts`
- Modify: `src/cli/run-cli.ts`
- Test: `tests/config/paths.test.ts`, `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `buildContactSheetHtml`, `kitDetails`, `PreviewKit`, `PreviewSection` (Task 3); `clubSlug` (`fm26/naming.ts`); `generateKitSet`, `loadKitLogos`, `renderKit2dPng`, `listClubIds`, `loadClub`, `loadKit`, `hasClubLogo`, `validateClubAssets`.
- Produces: `PREVIEW_FILE: string`, `samplesPreviewPath(clubId: string): string`, `parseSamples(value: string): number`, comando `kit-generator preview [--club <id> [--samples <n>]] [--out <file>] [--clubs <dir>] [--assets <dir>]`.

- [ ] **Step 1: Teste dos caminhos**

Em `tests/config/paths.test.ts`, inclua `PREVIEW_FILE` e `samplesPreviewPath` no import de `../../src/config/paths.js` e acrescente:

```ts
describe("preview paths", () => {
  it("places the saved-kits preview inside output/ with a name no club id can take", () => {
    expect(PREVIEW_FILE).toBe(path.join(OUTPUT_DIR, "kit_preview.html"));
    expect(ClubIdSchema.safeParse("kit_preview.html").success).toBe(false);
  });

  it("names the samples preview after the club slug", () => {
    expect(samplesPreviewPath("galaticos-fc")).toBe(path.join(OUTPUT_DIR, "kit_preview_galaticos_fc.html"));
  });

  it("rejects invalid club ids in the samples preview path", () => {
    expect(() => samplesPreviewPath("../escape")).toThrow(/Invalid club id/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/config/paths.test.ts`
Expected: FAIL (`PREVIEW_FILE` não exportado).

- [ ] **Step 3: Implementar os caminhos**

Em `src/config/paths.ts`, troque o import de `naming.js` por `import { clubSlug, kitAssetFileName, type RenderType } from "../fm26/naming.js";` e acrescente depois de `CONFIG_XML_FILE`:

```ts
// "_" e "." ficam fora de [a-z0-9-]: nenhum clube gera um output/<id>/ com estes nomes.
export const PREVIEW_FILE = path.join(OUTPUT_DIR, "kit_preview.html");

export function samplesPreviewPath(clubId: string): string {
  return path.join(OUTPUT_DIR, `kit_preview_${clubSlug(clubId)}.html`);
}
```

Run: `npx vitest run tests/config/paths.test.ts`
Expected: PASS.

- [ ] **Step 4: Testes da CLI**

Em `tests/cli/run-cli.test.ts`, acrescente `mkdir` ao import de `node:fs/promises` e, antes de `describe("runCli usage", ...)`:

```ts
describe("runCli preview", () => {
  async function generatedSetup(): Promise<{ clubs: string; assets: string }> {
    const setup = await brandedSetup();
    await runCli(["generate", "--all", "--seed", "3", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], captureIo().io);
    return setup;
  }

  async function preview(setup: { clubs: string; assets: string }, ...extra: string[]) {
    const out = path.join(await makeTempDir("cli"), "preview.html");
    const capture = captureIo();
    const code = await runCli(["preview", "--clubs", setup.clubs, "--assets", setup.assets, "--out", out, ...extra], capture.io);
    return { code, out, ...capture };
  }

  function imageCount(html: string): number {
    return html.match(/<img src="data:image\/png;base64,/g)?.length ?? 0;
  }

  it("writes the saved kits of every club into one HTML file", async () => {
    const { code, out, logs, errors } = await preview(await generatedSetup());
    expect(code).toBe(0);
    const html = await readFile(out, "utf8");
    expect(imageCount(html)).toBe(3);
    expect(html).toContain("<h2>Galáticos FC (galaticos-fc)</h2>");
    expect(html).toContain(`seed ${deriveSeed(3, "galaticos-fc")}`);
    expect(logs).toEqual([`Wrote ${out} (3 kits)`]);
    expect(errors).toEqual([]);
  });

  it("omits kit types that were never saved", async () => {
    const setup = await generatedSetup();
    await rm(kitFile(setup.clubs, "galaticos-fc", "third"));
    const { code, out, errors } = await preview(setup);
    expect(code).toBe(0);
    expect(imageCount(await readFile(out, "utf8"))).toBe(2);
    expect(errors).toEqual([]);
  });

  it("skips a broken club, keeps the others and exits with 1", async () => {
    const setup = await generatedSetup();
    await mkdir(path.join(setup.clubs, "kong-team"));
    await writeFile(path.join(setup.clubs, "kong-team", "club.json"), "{ not json");
    const { code, out, errors } = await preview(setup);
    expect(code).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: \[kong-team\] Invalid JSON in/);
    expect(imageCount(await readFile(out, "utf8"))).toBe(3);
  });

  it("generates seed samples of one club without saving any kit", async () => {
    const setup = await brandedSetup();
    const { code, out, logs } = await preview(setup, "--club", "galaticos-fc", "--samples", "3");
    expect(code).toBe(0);
    const html = await readFile(out, "utf8");
    expect(imageCount(html)).toBe(9);
    for (const seed of [0, 1, 2]) expect(html).toContain(`<h2>Seed ${seed}</h2>`);
    expect(logs).toEqual([`Wrote ${out} (9 kits)`]);
    for (const kitType of KIT_TYPES) expect(await exists(kitFile(setup.clubs, "galaticos-fc", kitType))).toBe(false);
  });

  it("aborts without writing when the single club fails", async () => {
    const { code, out, errors } = await preview(await brandedSetup(), "--club", "nope");
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/^Error: Club "nope" not found/);
    expect(await exists(out)).toBe(false);
  });

  const INVALID_OPTIONS: [string[], string][] = [
    [["--samples", "3"], "Error: --samples requires --club"],
    [["--club", "galaticos-fc", "--samples", "0"], 'Error: Invalid samples "0": expected an integer between 1 and 100'],
    [["--club", "galaticos-fc", "--samples", "101"], 'Error: Invalid samples "101": expected an integer between 1 and 100'],
    [["--club", "galaticos-fc", "--samples", "abc"], 'Error: Invalid samples "abc": expected an integer between 1 and 100'],
  ];

  it.each(INVALID_OPTIONS)("rejects %j", async (extra, message) => {
    const { code, out, errors } = await preview(await brandedSetup(), ...extra);
    expect(code).toBe(1);
    expect(errors).toEqual([message]);
    expect(await exists(out)).toBe(false);
  });

  it("reports an --out that is a directory", async () => {
    const setup = await generatedSetup();
    const { io, errors } = captureIo();
    expect(await runCli(["preview", "--clubs", setup.clubs, "--assets", setup.assets, "--out", await makeTempDir("cli")], io)).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Error: EISDIR/);
  });
});
```

E em `describe("runCli usage", ...)`:

```ts
  it("documents the preview command", () => {
    expect(USAGE).toContain("kit-generator preview [--club <id> [--samples <n>]] [--out <file>] [--clubs <dir>] [--assets <dir>]");
  });
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run tests/cli/run-cli.test.ts -t "preview"`
Expected: FAIL (o comando cai no `USAGE` e devolve 1 sem gravar).

- [ ] **Step 6: Implementar o comando**

Em `src/cli/run-cli.ts`:

1. Imports: acrescente `PREVIEW_FILE` e `samplesPreviewPath` ao import de `../config/paths.js` e adicione `import { buildContactSheetHtml, kitDetails, type PreviewKit, type PreviewSection } from "../preview/contact-sheet.js";`.
2. Linha nova no `USAGE`, depois da do `export`:

```ts
  "  kit-generator preview [--club <id> [--samples <n>]] [--out <file>] [--clubs <dir>] [--assets <dir>]",
```

3. `writeOutput` passa a aceitar texto:

```ts
async function writeOutput(file: string, content: string | Buffer): Promise<void> {
```

4. Depois de `exportCommand`, acrescente:

```ts
const MAX_SAMPLES = 100;

export function parseSamples(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_SAMPLES) {
    throw new Error(`Invalid samples "${value}": expected an integer between 1 and ${MAX_SAMPLES}`);
  }
  return Number(value);
}

interface ContactSheet {
  title: string;
  sections: PreviewSection[];
}

async function previewKit(kit: KitDefinition, registry: AssetRegistry, dirs: AssetDirs): Promise<PreviewKit> {
  const png = await renderKit2dPng(kit, { logos: await loadKitLogos(kit, registry, dirs) });
  return { kitType: kit.kitType, png, details: kitDetails(kit) };
}

async function savedKitsSection(clubId: string, registry: AssetRegistry, dirs: AssetDirs): Promise<PreviewSection> {
  const club = await loadClub(clubId, dirs.clubsDir);
  const kits: PreviewKit[] = [];
  for (const kitType of KIT_TYPES) {
    const kit = await loadKit(club.id, kitType, dirs.clubsDir);
    if (kit) kits.push(await previewKit(kit, registry, dirs));
  }
  return { title: `${club.name} (${club.id})`, kits };
}

// Sem --club, um clube com erro não esconde os outros, como no generate --all.
async function allSavedKitsSheet(clubsDir: string, registry: AssetRegistry, dirs: AssetDirs, io: CliIo): Promise<{ sheet: ContactSheet; failed: number }> {
  const clubIds = await listClubIds(clubsDir);
  if (clubIds.length === 0) throw new Error(`No clubs found in ${clubsDir}`);
  const sections: PreviewSection[] = [];
  let failed = 0;
  for (const clubId of clubIds) {
    try {
      sections.push(await savedKitsSection(clubId, registry, dirs));
    } catch (error) {
      failed++;
      io.error(`Error: [${clubId}] ${errorMessage(error)}`);
    }
  }
  return { sheet: { title: "Saved kits", sections }, failed };
}

async function samplesSheet(clubId: string, samples: number, registry: AssetRegistry, dirs: AssetDirs): Promise<ContactSheet> {
  const club = await loadClub(clubId, dirs.clubsDir);
  const assetIssues = validateClubAssets(club, registry);
  if (assetIssues.length > 0) throw new Error(`Club "${club.id}" is invalid:\n${formatIssues(assetIssues)}`);
  const badge = await hasClubLogo(club.id, dirs.clubsDir);
  const sections: PreviewSection[] = [];
  // Seeds 0..n-1 diretas, sem deriveSeed: "generate --club <id> --seed <n>" salva o conjunto escolhido no preview.
  for (let seed = 0; seed < samples; seed++) {
    const set = generateKitSet(club, seed, { badge });
    const kits: PreviewKit[] = [];
    for (const kitType of KIT_TYPES) kits.push(await previewKit(set[kitType], registry, dirs));
    sections.push({ title: `Seed ${seed}`, kits });
  }
  return { title: `${club.name}: seeds 0 to ${samples - 1}`, sections };
}

async function previewCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    club: { type: "string" },
    samples: { type: "string" },
    out: { type: "string" },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  if (values.samples !== undefined && values.club === undefined) throw new Error("--samples requires --club");
  const samples = values.samples === undefined ? undefined : parseSamples(values.samples);
  const registry = await loadAssetRegistry(values.assets);
  const dirs: AssetDirs = { assetsDir: values.assets, clubsDir: values.clubs };
  let sheet: ContactSheet;
  let failed = 0;
  let defaultOut = PREVIEW_FILE;
  if (values.club !== undefined && samples !== undefined) {
    sheet = await samplesSheet(values.club, samples, registry, dirs);
    defaultOut = samplesPreviewPath(values.club);
  } else if (values.club !== undefined) {
    sheet = { title: "Saved kits", sections: [await savedKitsSection(values.club, registry, dirs)] };
  } else {
    ({ sheet, failed } = await allSavedKitsSheet(values.clubs, registry, dirs, io));
  }
  const out = path.resolve(values.out ?? defaultOut);
  await writeOutput(out, buildContactSheetHtml(sheet.title, sheet.sections));
  const kitCount = sheet.sections.reduce((sum, section) => sum + section.kits.length, 0);
  io.log(`Wrote ${out} (${kitCount} kits)`);
  return failed === 0 ? 0 : 1;
}
```

5. Em `runCli`, depois da linha do `export`:

```ts
    if (command === "preview") return await previewCommand(args, io);
```

- [ ] **Step 7: Rodar a CLI e o typecheck**

Run: `npx vitest run tests/cli/run-cli.test.ts tests/config/paths.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Formatar e commitar**

```bash
npm run format
git add src/config/paths.ts src/cli/run-cli.ts tests/config/paths.test.ts tests/cli/run-cli.test.ts
git commit -m "feat: add the preview command for saved kits and seed samples

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Nove padrões novos

Os padrões entram com `defaultWeight: 0`: nenhum clube os sorteia até a Task 6 trazer os perfis, e as guardas da Task 1 continuam verdes. Os ranges abaixo foram medidos num protótipo com o tronco 2D real: cobertura máxima 0.457 (`hoops`), 0.443 (`center-band`), 0.406 (`diagonal`), 0.396 (`chest-band`), 0.328 (`chevron`), 0.278 (`gradient`), 0.238 (`pinstripes`); `checkers` 0.505 e `halves` 0.503. `colorAt` bateu com o render em todos os parâmetros extremos.

**Files:**
- Create: `src/patterns/pinstripes.ts`, `hoops.ts`, `diagonal.ts`, `chevron.ts`, `chest-band.ts`, `center-band.ts`, `checkers.ts`, `halves.ts`, `gradient.ts`
- Modify: `src/patterns/registry.ts`
- Test: `tests/patterns/patterns.test.ts`, `tests/renderers/renderer-2d.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `PatternTemplate`, `PatternGeometry` (`patterns/types.ts`), `fmt` (`patterns/svg.ts`), `stripesPattern`.
- Produces: `pinstripesPattern`, `hoopsPattern`, `diagonalPattern`, `chevronPattern`, `chestBandPattern`, `centerBandPattern`, `checkersPattern`, `halvesPattern`, `gradientPattern`; ids `pinstripes`, `hoops`, `diagonal`, `chevron`, `chest-band`, `center-band`, `checkers`, `halves`, `gradient`, registrados nesta ordem depois de `solid`, `stripes`, `sash`.

- [ ] **Step 1: Testes dos padrões**

Em `tests/patterns/patterns.test.ts`, substitua o `describe("registry", ...)` por:

```ts
const ALL_PATTERN_IDS = ["solid", "stripes", "sash", "pinstripes", "hoops", "diagonal", "chevron", "chest-band", "center-band", "checkers", "halves", "gradient"];

describe("registry", () => {
  it("lists the patterns in registry order", () => {
    expect(listPatternTemplates().map((template) => template.id)).toEqual(ALL_PATTERN_IDS);
  });

  it("throws a helpful error for unknown ids", () => {
    expect(() => getPatternTemplate("zigzag")).toThrow(`Unknown pattern "zigzag". Known patterns: ${ALL_PATTERN_IDS.join(", ")}`);
  });
});
```

E acrescente no fim do arquivo:

```ts
describe("new patterns colorAt", () => {
  const at = (id: string, params: Record<string, number>, x: number, y: number) => getPatternTemplate(id).colorAt(x, y, { width: SIZE, height: SIZE, params });

  it("draws pinstripes with the stripes geometry", () => {
    const params = { count: 20, ratio: 0.12 };
    for (let x = 0; x < SIZE; x += 3) expect(at("pinstripes", params, x, 100)).toBe(at("stripes", params, x, 100));
  });

  it("finds the hoops and the gaps between them", () => {
    expect(at("hoops", { count: 4, ratio: 0.3 }, 100, 50)).toBe("overlay");
    expect(at("hoops", { count: 4, ratio: 0.3 }, 100, 10)).toBe("base");
  });

  it("runs a diagonal stripe through the center and follows the direction", () => {
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 0 }, 207, 207)).toBe("overlay");
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 0 }, 177, 237)).toBe("base");
    expect(at("diagonal", { count: 7, ratio: 0.3, direction: 1 }, 177, 237)).toBe("overlay");
  });

  it("draws the chevron vertex at the depth and its arms at 45 degrees", () => {
    const params = { depth: 0.45, width: 0.1 };
    expect(at("chevron", params, 207, 186)).toBe("overlay");
    expect(at("chevron", params, 207, 250)).toBe("base");
    expect(at("chevron", params, 307, 86)).toBe("overlay");
    expect(at("chevron", params, 307, 186)).toBe("base");
  });

  it("places the chest band and the center band", () => {
    expect(at("chest-band", { position: 0.45, width: 0.15 }, 10, 186)).toBe("overlay");
    expect(at("chest-band", { position: 0.45, width: 0.15 }, 10, 240)).toBe("base");
    expect(at("center-band", { width: 0.14 }, 207, 10)).toBe("overlay");
    expect(at("center-band", { width: 0.14 }, 250, 10)).toBe("base");
  });

  it("alternates the checkers around a corner at the center", () => {
    expect(at("checkers", { size: 0.1 }, 208, 208)).toBe("base");
    expect(at("checkers", { size: 0.1 }, 250, 208)).toBe("overlay");
    expect(at("checkers", { size: 0.1 }, 206, 208)).toBe("overlay");
  });

  it("paints the halves on the chosen side", () => {
    expect(at("halves", { side: 0 }, 100, 207)).toBe("overlay");
    expect(at("halves", { side: 0 }, 300, 207)).toBe("base");
    expect(at("halves", { side: 1 }, 100, 207)).toBe("base");
    expect(at("halves", { side: 1 }, 300, 207)).toBe("overlay");
  });

  it("fades the gradient from the base to the overlay below the start", () => {
    const params = { start: 0.65 };
    expect(at("gradient", params, 207, 100)).toBe("base");
    expect(at("gradient", params, 207, 272)).toBe("base");
    expect(at("gradient", params, 207, 370)).toBe("overlay");
    expect(at("gradient", params, 207, 400)).toBe("overlay");
  });
});

describe("new patterns render", () => {
  it("draws one rect per hoop", () => {
    expect(renderWith(getPatternTemplate("hoops"), { count: 5 }).match(/<rect /g)).toHaveLength(5);
  });

  it("rotates the diagonal stripes according to direction", () => {
    expect(renderWith(getPatternTemplate("diagonal"), { direction: 0 })).toContain("rotate(45)");
    expect(renderWith(getPatternTemplate("diagonal"), { direction: 1 })).toContain("rotate(-45)");
  });

  it("draws the chevron as one polygon", () => {
    expect(renderWith(getPatternTemplate("chevron"), {}).match(/<polygon /g)).toHaveLength(1);
  });

  it("splits the halves at the middle", () => {
    expect(renderWith(getPatternTemplate("halves"), { side: 0 })).toBe('<rect x="0" y="0" width="207" height="414" fill="#ffffff"/>');
    expect(renderWith(getPatternTemplate("halves"), { side: 1 })).toBe('<rect x="207" y="0" width="207" height="414" fill="#ffffff"/>');
  });

  // O renderer 2D desenha o fill duas vezes (corpo e mangas match-body): um id no SVG ficaria repetido.
  it("draws the gradient with opacity bands, without defs or ids", () => {
    const svg = renderWith(getPatternTemplate("gradient"), {});
    expect(svg).toContain("fill-opacity");
    expect(svg).not.toMatch(/<defs|\sid=/);
  });
});
```

- [ ] **Step 2: Testes de cobertura e de logo no renderer**

Em `tests/renderers/renderer-2d.test.ts`, extraia a contagem do teste `keeps every logo box on the plain body with the %s collar` para um helper no topo (depois de `torsoOverlayShare`):

```ts
// Pixels das caixas de logo que não são a cor base lisa.
async function logoBoxMismatches(png: Buffer): Promise<number> {
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
  return off;
}
```

troque o corpo daquele teste por:

```ts
  it.each(["round", "v-neck"] as const)("keeps every logo box on the plain body with the %s collar", async (style) => {
    expect(await logoBoxMismatches(await renderKit2dPng(makeKit({ collar: { style, color: "accent" } })))).toBe(0);
  });
```

e acrescente dentro de `describe("renderKit2dPng", ...)`, depois dos testes de `sash`:

```ts
  // Piores casos medidos no protótipo da Fase 3b; valores acima do máximo passam pelo clamp de resolveParams.
  const WIDEST: [string, Record<string, number>][] = [
    ["pinstripes", { count: 12, ratio: 1 }],
    ["pinstripes", { count: 23, ratio: 1 }],
    ["pinstripes", { count: 30, ratio: 1 }],
    ["hoops", { count: 4, ratio: 1 }],
    ["hoops", { count: 7, ratio: 1 }],
    ["hoops", { count: 12, ratio: 1 }],
    ["diagonal", { count: 4, ratio: 1, direction: 1 }],
    ["diagonal", { count: 8, ratio: 1, direction: 0 }],
    ["diagonal", { count: 12, ratio: 1, direction: 0 }],
    ["chevron", { depth: 0.35, width: 1 }],
    ["chevron", { depth: 1, width: 1 }],
    ["chest-band", { position: 0.35, width: 1 }],
    ["chest-band", { position: 0.475, width: 1 }],
    ["chest-band", { position: 1, width: 1 }],
    ["center-band", { width: 1 }],
    ["gradient", { start: 0 }],
  ];

  it.each(WIDEST)("keeps the widest %s %j below half of the torso", async (id, params) => {
    const kit = makeKit({ pattern: { id, base: "primary", overlay: "secondary", params } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThan(0.5);
  });

  // Equilibrados: as duas cores dividem o tronco; o ciclo de papéis ainda separa os kits do conjunto (spec da 3b, seção 4.2).
  const BALANCED: [string, Record<string, number>][] = [
    ["checkers", { size: 0 }],
    ["checkers", { size: 0.064 }],
    ["checkers", { size: 0.105 }],
    ["checkers", { size: 1 }],
    ["halves", { side: 0 }],
    ["halves", { side: 1 }],
  ];

  it.each(BALANCED)("keeps the balanced %s %j at about half of the torso", async (id, params) => {
    const kit = makeKit({ pattern: { id, base: "primary", overlay: "secondary", params } });
    expect(await torsoOverlayShare(await renderKit2dPng(kit))).toBeLessThanOrEqual(0.51);
  });

  // start abaixo do mínimo vira 0.58 pelo clamp: o degradê começa abaixo da caixa do patrocinador (y 229).
  it("keeps every logo box on the plain base with the earliest gradient", async () => {
    const kit = makeKit({ pattern: { id: "gradient", base: "primary", overlay: "secondary", params: { start: 0 } } });
    expect(await logoBoxMismatches(await renderKit2dPng(kit))).toBe(0);
  });
```

- [ ] **Step 3: Teste no generator e mensagens de validação**

Em `tests/generator/kit-generator.test.ts`, acrescente `import { getPatternTemplate } from "../../src/patterns/registry.js";` e, dentro de `describe("generateKitSet", ...)`:

```ts
  const NEW_PATTERN_IDS = ["pinstripes", "hoops", "diagonal", "chevron", "chest-band", "center-band", "checkers", "halves", "gradient"];

  it.each(NEW_PATTERN_IDS)("generates valid %s kits with params inside the template ranges", (id) => {
    const template = getPatternTemplate(id);
    const club: ClubIdentity = { ...branded, style: { ...branded.style, patternWeights: { [id]: 1 } } };
    for (let seed = 0; seed < 20; seed++) {
      const set = generateKitSet(club, seed, { badge: true });
      for (const kit of Object.values(set)) {
        expect(kit.pattern.id).toBe(id);
        expect(validateKit(kit)).toEqual([]);
        for (const [key, spec] of Object.entries(template.parameters)) {
          const value = kit.pattern.params[key]!;
          expect(value).toBeGreaterThanOrEqual(spec.min);
          expect(value).toBeLessThanOrEqual(spec.max);
          if (spec.integer) expect(Number.isInteger(value)).toBe(true);
        }
      }
      expect(validateKitSet(set)).toEqual([]);
    }
  });
```

Em `tests/core/validation.test.ts`, acrescente depois de `const PALETTE = ...`:

```ts
const KNOWN_PATTERNS = "solid, stripes, sash, pinstripes, hoops, diagonal, chevron, chest-band, center-band, checkers, halves, gradient";
```

e troque as duas mensagens que terminam em `(known: solid, stripes, sash)` por `` `... (known: ${KNOWN_PATTERNS})` ``:

```ts
    expect(issues).toEqual([{ rule: "unknown-pattern", message: `style.patternWeights references unknown pattern "zigzag" (known: ${KNOWN_PATTERNS})` }]);
```

```ts
    expect(validateKit(kit)).toEqual([{ rule: "unknown-pattern", message: `home kit uses unknown pattern "zigzag" (known: ${KNOWN_PATTERNS})` }]);
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/patterns tests/renderers tests/generator tests/core/validation.test.ts`
Expected: FAIL (`Unknown pattern "pinstripes"` e a lista do registry só com três ids).

- [ ] **Step 5: Implementar os padrões**

`src/patterns/pinstripes.ts`:

```ts
import { stripesPattern } from "./stripes.js";
import type { PatternTemplate } from "./types.js";

// Mesmo desenho e colorAt de stripes; só os ranges mudam.
export const pinstripesPattern: PatternTemplate = {
  ...stripesPattern,
  id: "pinstripes",
  name: "Pinstripes",
  defaultWeight: 0,
  parameters: { count: { min: 12, max: 30, default: 20, integer: true }, ratio: { min: 0.08, max: 0.2, default: 0.12 } },
};
```

`src/patterns/hoops.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function hoopLayout({ height, params }: PatternGeometry): { period: number; hoopHeight: number; offset: number } {
  const period = height / params.count;
  const hoopHeight = period * params.ratio;
  return { period, hoopHeight, offset: (period - hoopHeight) / 2 };
}

export const hoopsPattern: PatternTemplate = {
  id: "hoops",
  name: "Hoops",
  category: "classic",
  defaultWeight: 0,
  parameters: { count: { min: 4, max: 12, default: 8, integer: true }, ratio: { min: 0.2, max: 0.4, default: 0.3 } },
  render(context) {
    const { period, hoopHeight, offset } = hoopLayout(context);
    return Array.from(
      { length: context.params.count },
      (_, index) => `<rect x="0" y="${fmt(index * period + offset)}" width="${fmt(context.width)}" height="${fmt(hoopHeight)}" fill="${context.overlay}"/>`,
    ).join("");
  },
  colorAt(_x, y, geometry) {
    const { period, hoopHeight, offset } = hoopLayout(geometry);
    const local = y - Math.floor(y / period) * period;
    return local >= offset && local <= offset + hoopHeight ? "overlay" : "base";
  },
};
```

`src/patterns/diagonal.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

function diagonalLayout({ width, height, params }: PatternGeometry): { period: number; stripeWidth: number; reach: number } {
  const diagonal = Math.hypot(width, height);
  const period = diagonal / params.count;
  return { period, stripeWidth: period * params.ratio, reach: Math.ceil(diagonal / 2 / period) + 1 };
}

export const diagonalPattern: PatternTemplate = {
  id: "diagonal",
  name: "Diagonal stripes",
  category: "modern",
  defaultWeight: 0,
  parameters: {
    count: { min: 4, max: 12, default: 7, integer: true },
    ratio: { min: 0.2, max: 0.4, default: 0.3 },
    direction: { min: 0, max: 1, default: 0, integer: true },
  },
  render(context) {
    const { width, height, overlay, params } = context;
    const { period, stripeWidth, reach } = diagonalLayout(context);
    // Comprimento maior que a diagonal do canvas, como no sash: a listra nunca termina dentro da camisa.
    const length = (width + height) * 2;
    const rects: string[] = [];
    for (let index = -reach; index <= reach; index++) {
      rects.push(`<rect x="${fmt(-length / 2)}" y="${fmt(index * period - stripeWidth / 2)}" width="${fmt(length)}" height="${fmt(stripeWidth)}"/>`);
    }
    const angle = params.direction === 0 ? 45 : -45;
    return `<g fill="${overlay}" transform="translate(${fmt(width / 2)} ${fmt(height / 2)}) rotate(${angle})">${rects.join("")}</g>`;
  },
  colorAt(x, y, geometry) {
    const { period, stripeWidth } = diagonalLayout(geometry);
    const [dx, dy] = [x - geometry.width / 2, y - geometry.height / 2];
    // Mesma convenção do sash: rotate(45) desce para a direita (dy = dx), rotate(-45) sobe (dy = -dx).
    const offset = (geometry.params.direction === 0 ? dy - dx : dy + dx) / Math.SQRT2;
    const local = offset - Math.round(offset / period) * period;
    return Math.abs(local) <= stripeWidth / 2 ? "overlay" : "base";
  },
};
```

`src/patterns/chevron.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const chevronPattern: PatternTemplate = {
  id: "chevron",
  name: "Chevron",
  category: "retro",
  defaultWeight: 0,
  parameters: { depth: { min: 0.35, max: 0.6, default: 0.45 }, width: { min: 0.06, max: 0.14, default: 0.1 } },
  render({ width, height, overlay, params }) {
    const center = width / 2;
    const vertex = params.depth * height;
    // Braços a 45°: a faixa de espessura t ocupa t·√2 na vertical, metade para cada lado da linha central.
    const half = (params.width * width) / Math.SQRT2;
    const points = [
      [0, vertex - half - center],
      [center, vertex - half],
      [width, vertex - half - center],
      [width, vertex + half - center],
      [center, vertex + half],
      [0, vertex + half - center],
    ];
    return `<polygon points="${points.map(([px, py]) => `${fmt(px!)},${fmt(py!)}`).join(" ")}" fill="${overlay}"/>`;
  },
  colorAt(x, y, { width, height, params }) {
    const offset = Math.abs(x - width / 2) + y - params.depth * height;
    return Math.abs(offset) <= (params.width * width) / Math.SQRT2 ? "overlay" : "base";
  },
};
```

`src/patterns/chest-band.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const chestBandPattern: PatternTemplate = {
  id: "chest-band",
  name: "Chest band",
  category: "retro",
  defaultWeight: 0,
  parameters: { position: { min: 0.35, max: 0.6, default: 0.45 }, width: { min: 0.1, max: 0.22, default: 0.15 } },
  render({ width, height, overlay, params }) {
    const band = params.width * height;
    return `<rect x="0" y="${fmt(params.position * height - band / 2)}" width="${fmt(width)}" height="${fmt(band)}" fill="${overlay}"/>`;
  },
  colorAt(_x, y, { height, params }) {
    return Math.abs(y - params.position * height) <= (params.width * height) / 2 ? "overlay" : "base";
  },
};
```

`src/patterns/center-band.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const centerBandPattern: PatternTemplate = {
  id: "center-band",
  name: "Center band",
  category: "retro",
  defaultWeight: 0,
  parameters: { width: { min: 0.08, max: 0.2, default: 0.14 } },
  render({ width, height, overlay, params }) {
    const band = params.width * width;
    return `<rect x="${fmt(width / 2 - band / 2)}" y="0" width="${fmt(band)}" height="${fmt(height)}" fill="${overlay}"/>`;
  },
  colorAt(x, _y, { width, params }) {
    return Math.abs(x - width / 2) <= (params.width * width) / 2 ? "overlay" : "base";
  },
};
```

`src/patterns/checkers.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

// Paridade que também vale para índices negativos (à esquerda e acima do centro).
function isOdd(value: number): boolean {
  return ((value % 2) + 2) % 2 === 1;
}

export const checkersPattern: PatternTemplate = {
  id: "checkers",
  name: "Checkers",
  category: "modern",
  defaultWeight: 0,
  parameters: { size: { min: 0.06, max: 0.15, default: 0.1 } },
  render({ width, height, overlay, params }) {
    const side = params.size * width;
    const reach = Math.ceil(Math.max(width, height) / 2 / side) + 1;
    const rects: string[] = [];
    for (let row = -reach; row < reach; row++) {
      for (let column = -reach; column < reach; column++) {
        if (!isOdd(row + column)) continue;
        rects.push(`<rect x="${fmt(width / 2 + column * side)}" y="${fmt(height / 2 + row * side)}" width="${fmt(side)}" height="${fmt(side)}"/>`);
      }
    }
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(x, y, { width, height, params }) {
    const side = params.size * width;
    return isOdd(Math.floor((x - width / 2) / side) + Math.floor((y - height / 2) / side)) ? "overlay" : "base";
  },
};
```

`src/patterns/halves.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternTemplate } from "./types.js";

export const halvesPattern: PatternTemplate = {
  id: "halves",
  name: "Halves",
  category: "modern",
  defaultWeight: 0,
  parameters: { side: { min: 0, max: 1, default: 0, integer: true } },
  render({ width, height, overlay, params }) {
    const half = width / 2;
    return `<rect x="${params.side === 0 ? 0 : fmt(half)}" y="0" width="${fmt(half)}" height="${fmt(height)}" fill="${overlay}"/>`;
  },
  colorAt(x, _y, { width, params }) {
    return (params.side === 0 ? x < width / 2 : x >= width / 2) ? "overlay" : "base";
  },
};
```

`src/patterns/gradient.ts`:

```ts
import { fmt } from "./svg.js";
import type { PatternGeometry, PatternTemplate } from "./types.js";

// Barra do tronco 2D (y = 382 no viewBox 414): abaixo dela o overlay é cheio.
const GRADIENT_END = 0.92;
// Faixas de ~2 px no 2D: degradê suave sem <defs> nem id.
const BAND_RATIO = 1 / 207;

function gradientLayout({ height, params }: PatternGeometry): { start: number; end: number; bands: number; band: number } {
  const start = params.start * height;
  const end = GRADIENT_END * height;
  const bands = Math.max(1, Math.round((end - start) / (BAND_RATIO * height)));
  return { start, end, bands, band: (end - start) / bands };
}

export const gradientPattern: PatternTemplate = {
  id: "gradient",
  name: "Gradient",
  category: "modern",
  defaultWeight: 0,
  // start mínimo 0.58 fica abaixo da caixa do patrocinador (y 229 = 0.553): os logos do 2D ficam sempre sobre a base pura.
  parameters: { start: { min: 0.58, max: 0.72, default: 0.65 } },
  render(context) {
    const { width, height, overlay } = context;
    const { start, end, bands, band } = gradientLayout(context);
    const rects: string[] = [];
    for (let index = 0; index < bands; index++) {
      rects.push(`<rect x="0" y="${fmt(start + index * band)}" width="${fmt(width)}" height="${fmt(band)}" fill-opacity="${fmt((index + 1) / bands)}"/>`);
    }
    rects.push(`<rect x="0" y="${fmt(end)}" width="${fmt(width)}" height="${fmt(height - end)}"/>`);
    return `<g fill="${overlay}">${rects.join("")}</g>`;
  },
  colorAt(_x, y, geometry) {
    const { start, end, bands, band } = gradientLayout(geometry);
    if (y < start) return "base";
    if (y >= end) return "overlay";
    // Opacidade 0.5 exata vira 127 ou 128 no PNG: só conta como overlay acima da metade, como o limiar do teste de pixel.
    return (Math.floor((y - start) / band) + 1) / bands > 0.5 ? "overlay" : "base";
  },
};
```

`src/patterns/registry.ts` passa a ser:

```ts
import { centerBandPattern } from "./center-band.js";
import { checkersPattern } from "./checkers.js";
import { chestBandPattern } from "./chest-band.js";
import { chevronPattern } from "./chevron.js";
import { diagonalPattern } from "./diagonal.js";
import { gradientPattern } from "./gradient.js";
import { halvesPattern } from "./halves.js";
import { hoopsPattern } from "./hoops.js";
import { pinstripesPattern } from "./pinstripes.js";
import { sashPattern } from "./sash.js";
import { solidPattern } from "./solid.js";
import { stripesPattern } from "./stripes.js";
import type { PatternTemplate } from "./types.js";

// Padrão novo entra no fim: a ordem participa do sorteio ponderado e reordenar muda os kits de uma seed.
const TEMPLATES: readonly PatternTemplate[] = [
  solidPattern,
  stripesPattern,
  sashPattern,
  pinstripesPattern,
  hoopsPattern,
  diagonalPattern,
  chevronPattern,
  chestBandPattern,
  centerBandPattern,
  checkersPattern,
  halvesPattern,
  gradientPattern,
];
```

(as funções `listPatternTemplates` e `getPatternTemplate` não mudam).

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run tests/patterns tests/renderers tests/generator tests/core/validation.test.ts && npm run typecheck`
Expected: PASS, incluindo a suíte genérica (`pattern %s`) para os nove ids novos e as guardas `Phase 3b baseline`.

- [ ] **Step 7: Formatar e commitar**

```bash
npm run format
git add src/patterns tests/patterns/patterns.test.ts tests/renderers/renderer-2d.test.ts tests/generator/kit-generator.test.ts tests/core/validation.test.ts
git commit -m "feat: add nine new shirt patterns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Perfis de estilo

**Files:**
- Create: `src/styles/profiles.ts`, `src/styles/pattern-weights.ts`
- Modify: `src/patterns/types.ts`, `src/patterns/solid.ts`, `src/patterns/stripes.ts`, `src/patterns/sash.ts` e os nove padrões da Task 5 (sai `defaultWeight`)
- Modify: `src/generator/kit-generator.ts`, `src/core/validation.ts`
- Test: `tests/styles/profiles.test.ts`, `tests/styles/pattern-weights.test.ts`, `tests/patterns/params.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/core/validation.test.ts`, `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `listPatternTemplates`, `ClubIdentity`.
- Produces:
  - `interface StyleProfile { id: string; name: string; patternWeights: Record<string, number> }`
  - `STYLE_PROFILES: readonly StyleProfile[]`, `DEFAULT_STYLE_PROFILE = "classic"`
  - `findStyleProfile(id: string): StyleProfile | undefined`, `getStyleProfile(id: string): StyleProfile`, `knownStyleIds(): string[]`
  - `resolvePatternWeights(identity: ClubIdentity): Record<string, number>`
  - `patternCandidates(identity: ClubIdentity): [PatternTemplate, number][]` (a Task 7 acrescenta `kitType`)
  - regra `unknown-style` em `validateClub`

- [ ] **Step 1: Testes dos perfis**

Crie `tests/styles/profiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listPatternTemplates } from "../../src/patterns/registry.js";
import { DEFAULT_STYLE_PROFILE, findStyleProfile, getStyleProfile, knownStyleIds, STYLE_PROFILES } from "../../src/styles/profiles.js";

const patternIds = listPatternTemplates().map((template) => template.id);

describe("STYLE_PROFILES", () => {
  it("lists classic, traditional, modern and retro", () => {
    expect(knownStyleIds()).toEqual(["classic", "traditional", "modern", "retro"]);
  });

  it("references only registered patterns, with positive weights", () => {
    for (const profile of STYLE_PROFILES) {
      for (const [id, weight] of Object.entries(profile.patternWeights)) {
        expect(patternIds).toContain(id);
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  it("reaches every registered pattern from at least one profile", () => {
    const reached = new Set(STYLE_PROFILES.flatMap((profile) => Object.keys(profile.patternWeights)));
    expect([...reached].sort()).toEqual([...patternIds].sort());
  });

  // As seeds de clubes sem estilo dependem destes números exatos.
  it("keeps classic equal to the weights used before profiles existed", () => {
    expect(DEFAULT_STYLE_PROFILE).toBe("classic");
    expect(getStyleProfile("classic").patternWeights).toEqual({ solid: 40, stripes: 35, sash: 25 });
  });
});

describe("getStyleProfile", () => {
  it("finds a profile by id", () => {
    expect(findStyleProfile("retro")?.name).toBe("Retro");
    expect(findStyleProfile("dark")).toBeUndefined();
  });

  it("throws a helpful error for unknown styles", () => {
    expect(() => getStyleProfile("dark")).toThrow('Unknown style "dark". Known styles: classic, traditional, modern, retro');
  });
});
```

Crie `tests/styles/pattern-weights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { listPatternTemplates } from "../../src/patterns/registry.js";
import { patternCandidates, resolvePatternWeights } from "../../src/styles/pattern-weights.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (style: object) => parseClubIdentity({ ...GALATICOS_CLUB, style });

describe("resolvePatternWeights", () => {
  it("uses the club pattern weights over its categories", () => {
    expect(resolvePatternWeights(club({ categories: ["retro"], patternWeights: { solid: 2 } }))).toEqual({ solid: 2 });
  });

  it("uses the raw classic weights when the club has no categories", () => {
    expect(resolvePatternWeights(club({ categories: [] }))).toEqual({ solid: 40, stripes: 35, sash: 25 });
  });

  it("normalizes a single profile", () => {
    const weights = resolvePatternWeights(club({ categories: ["modern"] }));
    expect(weights.diagonal).toBeCloseTo(0.2);
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });

  it("averages the normalized profiles", () => {
    const weights = resolvePatternWeights(club({ categories: ["traditional", "retro"] }));
    expect(weights.solid).toBeCloseTo(0.2);
    expect(weights.hoops).toBeCloseTo(0.175);
    expect(weights.pinstripes).toBeCloseTo(0.075);
    expect(weights["chest-band"]).toBeCloseTo(0.1);
  });

  it("treats a repeated category as one", () => {
    expect(resolvePatternWeights(club({ categories: ["modern", "modern"] }))).toEqual(resolvePatternWeights(club({ categories: ["modern"] })));
  });
});

describe("patternCandidates", () => {
  it("lists every registered pattern in registry order, with zero for the missing ones", () => {
    const candidates = patternCandidates(club({ categories: [], patternWeights: { sash: 3 } }));
    expect(candidates.map(([template]) => template.id)).toEqual(listPatternTemplates().map((template) => template.id));
    expect(candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight])).toEqual([["sash", 3]]);
  });
});
```

- [ ] **Step 2: Testes de generator, validação e CLI**

Em `tests/generator/kit-generator.test.ts`, substitua o teste `uses template default weights when the club defines none` por:

```ts
  it("uses the classic profile when the club configures no style", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [] } });
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["solid", "stripes", "sash"]));
  });

  it("draws from the profiles listed in categories", () => {
    const club = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: ["retro"] } });
    const ids = new Set(Array.from({ length: 300 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["hoops", "chest-band", "center-band", "chevron", "stripes", "solid"]));
  });
```

Em `tests/core/validation.test.ts`, dentro de `describe("validateClub", ...)`:

```ts
  it("reports unknown style categories", () => {
    expect(validateClub(club({ style: { categories: ["modern", "dark"] } }))).toEqual([
      { rule: "unknown-style", message: 'style.categories references unknown style "dark" (known: classic, traditional, modern, retro)' },
    ]);
  });
```

Em `tests/cli/run-cli.test.ts`, dentro de `describe("runCli generate --club", ...)`:

```ts
  it("reports an unknown style category before generating anything", async () => {
    const clubs = await makeClubsDir({ "galaticos-fc": JSON.stringify({ ...GALATICOS_CLUB, style: { categories: ["Modern"] } }) });
    const { io, errors } = captureIo();
    const args = ["generate", "--club", "galaticos-fc", "--seed", "1", "--clubs", clubs, "--assets", await makeAssetsDir(), "--out", await makeTempDir("cli")];
    expect(await runCli(args, io)).toBe(1);
    expect(errors[0]).toContain('unknown-style: style.categories references unknown style "Modern" (known: classic, traditional, modern, retro)');
    expect(await exists(kitFile(clubs, "galaticos-fc", "home"))).toBe(false);
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/styles tests/generator tests/core/validation.test.ts tests/cli/run-cli.test.ts -t "style|profile|categories|classic|pattern weights|patternCandidates"`
Expected: FAIL (módulos de `src/styles/` inexistentes, `unknown-style` ausente).

- [ ] **Step 4: Implementar os perfis**

Crie `src/styles/profiles.ts`:

```ts
export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
}

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
export const DEFAULT_STYLE_PROFILE = "classic";

export const STYLE_PROFILES: readonly StyleProfile[] = [
  { id: "classic", name: "Classic", patternWeights: { solid: 40, stripes: 35, sash: 25 } },
  { id: "traditional", name: "Traditional", patternWeights: { solid: 30, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5 } },
  { id: "modern", name: "Modern", patternWeights: { solid: 10, diagonal: 20, gradient: 20, checkers: 15, halves: 15, chevron: 10, sash: 10 } },
  { id: "retro", name: "Retro", patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 10 } },
];

export function knownStyleIds(): string[] {
  return STYLE_PROFILES.map((profile) => profile.id);
}

export function findStyleProfile(id: string): StyleProfile | undefined {
  return STYLE_PROFILES.find((profile) => profile.id === id);
}

export function getStyleProfile(id: string): StyleProfile {
  const profile = findStyleProfile(id);
  if (!profile) throw new Error(`Unknown style "${id}". Known styles: ${knownStyleIds().join(", ")}`);
  return profile;
}
```

Crie `src/styles/pattern-weights.ts`:

```ts
import type { ClubIdentity } from "../core/club.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
import { DEFAULT_STYLE_PROFILE, getStyleProfile } from "./profiles.js";

export function resolvePatternWeights(identity: ClubIdentity): Record<string, number> {
  if (identity.style.patternWeights) return identity.style.patternWeights;
  const ids = identity.style.categories;
  // Sem normalizar: os números de classic são os mesmos de antes dos perfis, e o sorteio fica idêntico ao das seeds antigas.
  if (ids.length === 0) return getStyleProfile(DEFAULT_STYLE_PROFILE).patternWeights;
  const weights: Record<string, number> = {};
  for (const id of ids) {
    const profile = getStyleProfile(id).patternWeights;
    const total = Object.values(profile).reduce((sum, weight) => sum + weight, 0);
    // Normalizar antes da média impede que um perfil com números maiores domine a combinação.
    for (const [pattern, weight] of Object.entries(profile)) weights[pattern] = (weights[pattern] ?? 0) + weight / total / ids.length;
  }
  return weights;
}

// Ordem do registry: rng.weighted percorre os candidatos nesta ordem, e mudá-la muda os kits de uma seed.
export function patternCandidates(identity: ClubIdentity): [PatternTemplate, number][] {
  const weights = resolvePatternWeights(identity);
  return listPatternTemplates().map((template) => [template, weights[template.id] ?? 0]);
}
```

- [ ] **Step 5: Ligar generator e validação, remover `defaultWeight`**

Em `src/generator/kit-generator.ts`: acrescente `import { patternCandidates } from "../styles/pattern-weights.js";`, remova o import de `listPatternTemplates` e troque `pickPattern` por:

```ts
function pickPattern(identity: ClubIdentity, rng: Rng): PatternTemplate {
  return rng.weighted(patternCandidates(identity));
}
```

Em `src/core/validation.ts`: acrescente `import { findStyleProfile, knownStyleIds } from "../styles/profiles.js";` e, no começo de `validateClub`, logo depois de `const issues: ValidationIssue[] = [];`:

```ts
  for (const id of identity.style.categories) {
    if (!findStyleProfile(id)) issues.push({ rule: "unknown-style", message: `style.categories references unknown style "${id}" (known: ${knownStyleIds().join(", ")})` });
  }
```

Remova `defaultWeight` de:
- `src/patterns/types.ts` (a linha `defaultWeight: number;` da interface `PatternTemplate`);
- `src/patterns/solid.ts`, `stripes.ts`, `sash.ts` (linhas `defaultWeight: 40`, `35`, `25`);
- os nove arquivos da Task 5 (linha `defaultWeight: 0,`);
- `tests/patterns/params.test.ts` (linha `defaultWeight: 1,` do template de teste).

Confira que não sobrou nenhum: `grep -rn defaultWeight src tests` não deve imprimir nada.

- [ ] **Step 6: Rodar tudo e o typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, incluindo as duas guardas `generateKitSet Phase 3b baseline` (o clube sem estilo usa `classic` com os mesmos números e a mesma ordem).

- [ ] **Step 7: Formatar e commitar**

```bash
npm run format
git add src/styles src/patterns src/generator/kit-generator.ts src/core/validation.ts tests/styles tests/patterns/params.test.ts tests/generator/kit-generator.test.ts tests/core/validation.test.ts tests/cli/run-cli.test.ts
git commit -m "feat: weigh patterns by style profiles with classic as the default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tradições de padrão (proibidos e lista por tipo)

**Files:**
- Modify: `src/core/club.ts`, `src/styles/pattern-weights.ts`, `src/generator/kit-generator.ts`, `src/core/validation.ts`, `src/cli/run-cli.ts`
- Test: `tests/core/club.test.ts`, `tests/styles/pattern-weights.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/core/validation.test.ts`, `tests/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: `resolvePatternWeights`, `listPatternTemplates`, `KIT_TYPES`, `KitType`.
- Produces:
  - `ClubIdentity.traditions?: { forbiddenPatterns?: string[]; patterns?: { home?: string[]; away?: string[]; third?: string[] } }` (a Task 8 acrescenta `requiredColor`)
  - `patternCandidates(identity: ClubIdentity, kitType: KitType): [PatternTemplate, number][]`
  - regras `unknown-pattern` (tradições), `tradition-conflict`, `no-pattern-weight` (por tipo) em `validateClub`
  - `validateKitTraditions(identity: ClubIdentity, kit: KitDefinition): ValidationIssue[]` com `forbidden-pattern` e `tradition-pattern`

- [ ] **Step 1: Teste do schema**

Em `tests/core/club.test.ts`, dentro de `describe("parseClubIdentity", ...)`:

```ts
  it("accepts traditions with forbidden patterns and patterns per kit type", () => {
    const traditions = { forbiddenPatterns: ["sash"], patterns: { home: ["stripes", "pinstripes"] } };
    expect(parseClubIdentity({ ...galaticos, traditions }).traditions).toEqual(traditions);
  });

  const INVALID_TRADITIONS: [string, object, RegExp][] = [
    ["an unknown key", { forbidenPatterns: ["sash"] }, /forbidenPatterns/],
    ["an unknown kit type", { patterns: { fourth: ["solid"] } }, /fourth/],
    ["an empty pattern list", { patterns: { home: [] } }, /traditions\.patterns\.home/],
  ];

  it.each(INVALID_TRADITIONS)("rejects traditions with %s", (_label, traditions, error) => {
    expect(() => parseClubIdentity({ ...galaticos, traditions })).toThrow(error);
  });
```

- [ ] **Step 2: Testes dos candidatos**

Em `tests/styles/pattern-weights.test.ts`, troque o `describe("patternCandidates", ...)` inteiro por:

```ts
describe("patternCandidates", () => {
  const withTraditions = (traditions: object) => parseClubIdentity({ ...GALATICOS_CLUB, traditions });
  const positive = (candidates: ReturnType<typeof patternCandidates>) => candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight]);

  it("lists every registered pattern in registry order, with zero for the missing ones", () => {
    const candidates = patternCandidates(club({ categories: [], patternWeights: { sash: 3 } }), "home");
    expect(candidates.map(([template]) => template.id)).toEqual(listPatternTemplates().map((template) => template.id));
    expect(positive(candidates)).toEqual([["sash", 3]]);
  });

  it("gives forbidden patterns zero weight", () => {
    expect(positive(patternCandidates(withTraditions({ forbiddenPatterns: ["sash"] }), "away"))).toEqual([
      ["solid", 20],
      ["stripes", 40],
    ]);
  });

  it("keeps only the patterns listed for the kit type, in registry order", () => {
    const club = withTraditions({ patterns: { home: ["sash", "stripes"] } });
    expect(patternCandidates(club, "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["stripes", 40],
      ["sash", 40],
    ]);
    expect(patternCandidates(club, "away")).toHaveLength(listPatternTemplates().length);
  });

  it("draws uniformly from a list whose weights are all zero", () => {
    expect(patternCandidates(withTraditions({ patterns: { home: ["hoops", "halves"] } }), "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["hoops", 1],
      ["halves", 1],
    ]);
  });

  it("never revives a forbidden pattern in the uniform draw", () => {
    const club = withTraditions({ forbiddenPatterns: ["halves"], patterns: { home: ["hoops", "halves"] } });
    expect(patternCandidates(club, "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["hoops", 1],
      ["halves", 0],
    ]);
  });
});
```

- [ ] **Step 3: Testes de generator, validação e CLI**

Em `tests/generator/kit-generator.test.ts`, no fim do arquivo:

```ts
describe("generateKitSet traditions", () => {
  const traditional = (traditions: object): ClubIdentity => parseClubIdentity({ ...GALATICOS_CLUB, traditions });

  it("never picks a forbidden pattern", () => {
    const club = traditional({ forbiddenPatterns: ["sash"] });
    for (let seed = 0; seed < 200; seed++) {
      for (const kit of Object.values(generateKitSet(club, seed))) expect(kit.pattern.id).not.toBe("sash");
    }
  });

  it("picks the home pattern from its list, even when the weights leave it out", () => {
    const club = traditional({ patterns: { home: ["hoops", "pinstripes"] } });
    const ids = new Set(Array.from({ length: 200 }, (_, seed) => generateKitSet(club, seed).home.pattern.id));
    expect(ids).toEqual(new Set(["hoops", "pinstripes"]));
  });

  it("keeps the other kit types on the club weights", () => {
    const club = traditional({ patterns: { home: ["hoops"] } });
    for (let seed = 0; seed < 50; seed++) {
      const withTradition = generateKitSet(club, seed);
      const plain = generateKitSet(identity, seed);
      expect(withTradition.away).toEqual(plain.away);
      expect(withTradition.third).toEqual(plain.third);
    }
  });

  it("generates the same kits as a club without traditions when traditions is empty", () => {
    const club = traditional({});
    for (let seed = 0; seed < 50; seed++) expect(generateKitSet(club, seed)).toEqual(generateKitSet(identity, seed));
  });

  it("rejects conflicting traditions before generating", () => {
    expect(() => generateKitSet(traditional({ forbiddenPatterns: ["hoops"], patterns: { home: ["hoops"] } }), 1)).toThrow(/tradition-conflict/);
  });
});
```

Em `tests/core/validation.test.ts`, acrescente `validateKitTraditions` ao import de `../../src/core/validation.js` e, no fim do arquivo:

```ts
describe("validateClub traditions", () => {
  it("accepts valid traditions", () => {
    expect(validateClub(club({ traditions: { forbiddenPatterns: ["sash"], patterns: { home: ["stripes"] } } }))).toEqual([]);
  });

  it("reports unknown patterns in traditions", () => {
    const issues = validateClub(club({ traditions: { forbiddenPatterns: ["zigzag"], patterns: { away: ["zebra"] } } }));
    expect(issues).toEqual([
      { rule: "unknown-pattern", message: `traditions.forbiddenPatterns references unknown pattern "zigzag" (known: ${KNOWN_PATTERNS})` },
      { rule: "unknown-pattern", message: `traditions.patterns.away references unknown pattern "zebra" (known: ${KNOWN_PATTERNS})` },
    ]);
  });

  it("reports a pattern both allowed and forbidden", () => {
    expect(validateClub(club({ traditions: { forbiddenPatterns: ["stripes"], patterns: { third: ["stripes", "solid"] } } }))).toEqual([
      { rule: "tradition-conflict", message: 'traditions.patterns.third allows "stripes", which traditions.forbiddenPatterns forbids' },
    ]);
  });

  it("reports kit types left without any pattern by the forbidden list", () => {
    const traditions = { forbiddenPatterns: ["solid", "stripes", "sash"], patterns: { home: ["hoops"] } };
    expect(validateClub(club({ traditions }))).toEqual([
      { rule: "no-pattern-weight", message: "traditions.forbiddenPatterns leaves the away kit without a pattern with positive weight" },
      { rule: "no-pattern-weight", message: "traditions.forbiddenPatterns leaves the third kit without a pattern with positive weight" },
    ]);
  });
});

describe("validateKitTraditions", () => {
  const traditions = club({ traditions: { forbiddenPatterns: ["sash"], patterns: { home: ["stripes"] } } });
  const kitWith = (kitType: "home" | "away", id: string) => makeKit({ kitType, pattern: { id, base: "primary", overlay: "secondary", params: {} } });

  it("accepts kits that follow the traditions", () => {
    expect(validateKitTraditions(traditions, kitWith("home", "stripes"))).toEqual([]);
    expect(validateKitTraditions(traditions, kitWith("away", "solid"))).toEqual([]);
  });

  it("reports a forbidden pattern", () => {
    expect(validateKitTraditions(traditions, kitWith("away", "sash"))).toEqual([
      { rule: "forbidden-pattern", message: 'away kit uses pattern "sash", which traditions.forbiddenPatterns forbids' },
    ]);
  });

  it("reports a pattern outside the list of its kit type", () => {
    expect(validateKitTraditions(traditions, kitWith("home", "solid"))).toEqual([
      { rule: "tradition-pattern", message: 'home kit uses pattern "solid", but traditions.patterns.home allows only stripes' },
    ]);
  });

  it("ignores clubs without traditions", () => {
    expect(validateKitTraditions(club(), kitWith("home", "sash"))).toEqual([]);
  });
});
```

Em `tests/cli/run-cli.test.ts`, dentro de `describe("runCli validate", ...)`:

```ts
  it("reports a hand-edited kit that breaks a club tradition", async () => {
    const clubs = await generatedClubsDir();
    await writeFile(path.join(clubs, "galaticos-fc", "club.json"), JSON.stringify({ ...GALATICOS_CLUB, traditions: { forbiddenPatterns: ["sash"] } }));
    const home = parseKitDefinition(JSON.parse(await readFile(kitFile(clubs, "galaticos-fc", "home"), "utf8")));
    await writeFile(kitFile(clubs, "galaticos-fc", "home"), JSON.stringify({ ...home, pattern: { ...home.pattern, id: "sash", params: {} } }));
    const { io, errors } = captureIo();
    expect(await runCli(["validate", "--club", "galaticos-fc", "--clubs", clubs], io)).toBe(1);
    expect(errors[0]).toContain('  - forbidden-pattern: home kit uses pattern "sash", which traditions.forbiddenPatterns forbids');
  });
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/core tests/styles tests/generator tests/cli/run-cli.test.ts -t "tradition|patternCandidates"`
Expected: FAIL (chave `traditions` rejeitada pelo `z.strictObject`, `validateKitTraditions` inexistente).

- [ ] **Step 5: Implementar o schema**

Em `src/core/club.ts`, antes de `ClubIdentitySchema`:

```ts
const PatternIdListSchema = z.array(z.string().min(1));

const TraditionsSchema = z.strictObject({
  forbiddenPatterns: PatternIdListSchema.optional(),
  patterns: z
    .strictObject({ home: PatternIdListSchema.min(1).optional(), away: PatternIdListSchema.min(1).optional(), third: PatternIdListSchema.min(1).optional() })
    .optional(),
});
```

e, em `ClubIdentitySchema`, depois de `style`:

```ts
  traditions: TraditionsSchema.optional(),
```

- [ ] **Step 6: Implementar os candidatos e o generator**

Em `src/styles/pattern-weights.ts`, acrescente `import type { KitType } from "../core/kit.js";` e troque `patternCandidates` por:

```ts
// Ordem do registry: rng.weighted percorre os candidatos nesta ordem, e mudá-la muda os kits de uma seed.
export function patternCandidates(identity: ClubIdentity, kitType: KitType): [PatternTemplate, number][] {
  const weights = resolvePatternWeights(identity);
  const forbidden = new Set(identity.traditions?.forbiddenPatterns ?? []);
  const allowed = identity.traditions?.patterns?.[kitType];
  const templates = listPatternTemplates().filter((template) => allowed === undefined || allowed.includes(template.id));
  const weightOf = (template: PatternTemplate): number => (forbidden.has(template.id) ? 0 : (weights[template.id] ?? 0));
  // A tradição vence o perfil: uma lista só com pesos zero vira sorteio uniforme entre os padrões permitidos dela.
  const uniform = allowed !== undefined && templates.every((template) => weightOf(template) === 0);
  return templates.map((template) => [template, uniform && !forbidden.has(template.id) ? 1 : weightOf(template)]);
}
```

Em `src/generator/kit-generator.ts`, troque `pickPattern` por:

```ts
function pickPattern(identity: ClubIdentity, kitType: KitType, rng: Rng): PatternTemplate {
  return rng.weighted(patternCandidates(identity, kitType));
}
```

e, em `generateKit`, a chamada para `const template = pickPattern(identity, kitType, rng);`.

- [ ] **Step 7: Implementar a validação**

Em `src/core/validation.ts`, acrescente `import { patternCandidates } from "../styles/pattern-weights.js";` e a função:

```ts
function traditionIssues(identity: ClubIdentity, known: readonly string[]): ValidationIssue[] {
  const traditions = identity.traditions;
  if (!traditions) return [];
  const forbidden = traditions.forbiddenPatterns ?? [];
  const lists: [string, readonly string[]][] = [
    ["traditions.forbiddenPatterns", forbidden],
    ...KIT_TYPES.map((kitType): [string, readonly string[]] => [`traditions.patterns.${kitType}`, traditions.patterns?.[kitType] ?? []]),
  ];
  const issues: ValidationIssue[] = [];
  for (const [field, ids] of lists) {
    for (const id of ids) {
      if (!known.includes(id)) issues.push({ rule: "unknown-pattern", message: `${field} references unknown pattern "${id}" (known: ${known.join(", ")})` });
    }
  }
  for (const kitType of KIT_TYPES) {
    for (const id of traditions.patterns?.[kitType] ?? []) {
      if (forbidden.includes(id)) issues.push({ rule: "tradition-conflict", message: `traditions.patterns.${kitType} allows "${id}", which traditions.forbiddenPatterns forbids` });
    }
  }
  return issues;
}
```

Em `validateClub`, troque o `return [...issues, ...validateColors(identity.palette)];` por:

```ts
  issues.push(...traditionIssues(identity, known));
  const traditions = identity.traditions;
  // Os candidatos dependem de estilos e pesos válidos; quebrados, as regras acima já explicam o problema.
  if (traditions?.forbiddenPatterns && !issues.some((issue) => issue.rule === "unknown-style" || issue.rule === "no-pattern-weight")) {
    for (const kitType of KIT_TYPES) {
      if (traditions.patterns?.[kitType]) continue;
      if (!patternCandidates(identity, kitType).some(([, weight]) => weight > 0)) {
        issues.push({ rule: "no-pattern-weight", message: `traditions.forbiddenPatterns leaves the ${kitType} kit without a pattern with positive weight` });
      }
    }
  }
  return [...issues, ...validateColors(identity.palette)];
```

E depois de `validateKitAssets`:

```ts
// Pega kit.json editado à mão; o generator já respeita as tradições ao sortear.
export function validateKitTraditions(identity: ClubIdentity, kit: KitDefinition): ValidationIssue[] {
  const traditions = identity.traditions;
  if (!traditions) return [];
  const issues: ValidationIssue[] = [];
  const pattern = kit.pattern.id;
  if (traditions.forbiddenPatterns?.includes(pattern)) {
    issues.push({ rule: "forbidden-pattern", message: `${kit.kitType} kit uses pattern "${pattern}", which traditions.forbiddenPatterns forbids` });
  }
  const allowed = traditions.patterns?.[kit.kitType];
  if (allowed && !allowed.includes(pattern)) {
    issues.push({ rule: "tradition-pattern", message: `${kit.kitType} kit uses pattern "${pattern}", but traditions.patterns.${kit.kitType} allows only ${allowed.join(", ")}` });
  }
  return issues;
}
```

- [ ] **Step 8: Ligar no `validate`**

Em `src/cli/run-cli.ts`, acrescente `validateKitTraditions` ao import de `../core/validation.js` e, em `validateClubFiles`, troque:

```ts
  issues.push(...loaded.flatMap((kit) => validateKit(kit)), ...validateKitSet(kits));
```

por:

```ts
  issues.push(...loaded.flatMap((kit) => [...validateKit(kit), ...validateKitTraditions(club, kit)]), ...validateKitSet(kits));
```

- [ ] **Step 9: Rodar tudo e o typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, com as guardas `Phase 3b baseline` verdes.

- [ ] **Step 10: Formatar e commitar**

```bash
npm run format
git add src/core/club.ts src/styles/pattern-weights.ts src/generator/kit-generator.ts src/core/validation.ts src/cli/run-cli.ts tests/core/club.test.ts tests/styles/pattern-weights.test.ts tests/generator/kit-generator.test.ts tests/core/validation.test.ts tests/cli/run-cli.test.ts
git commit -m "feat: add forbidden and per-type pattern traditions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tradição de cor obrigatória

**Files:**
- Modify: `src/core/club.ts`, `src/core/kit.ts`, `src/generator/kit-generator.ts`, `src/core/validation.ts`
- Test: `tests/core/club.test.ts`, `tests/core/kit.test.ts`, `tests/generator/kit-generator.test.ts`, `tests/core/validation.test.ts`

**Interfaces:**
- Consumes: `ColorRoleSchema`, `COLOR_ROLES`, `validateKitTraditions` (Task 7).
- Produces: `ClubIdentity.traditions.requiredColor?: ColorRole`; `visibleRoles(kit: KitDefinition): ColorRole[]` (ordem de `COLOR_ROLES`); regra `required-color` em `validateKitTraditions`.

- [ ] **Step 1: Testes**

Em `tests/core/club.test.ts`:

```ts
  it("accepts a required color role and rejects anything else", () => {
    expect(parseClubIdentity({ ...galaticos, traditions: { requiredColor: "accent" } }).traditions).toEqual({ requiredColor: "accent" });
    expect(() => parseClubIdentity({ ...galaticos, traditions: { requiredColor: "gold" } })).toThrow(/requiredColor/);
  });
```

Em `tests/core/kit.test.ts`, acrescente `visibleRoles` ao import de `../../src/core/kit.js` e:

```ts
describe("visibleRoles", () => {
  it("hides the overlay of a solid pattern with match-body sleeves", () => {
    expect(visibleRoles(makeKit())).toEqual(["primary", "accent"]);
  });

  it("shows the color of solid sleeves", () => {
    expect(visibleRoles(makeKit({ sleeves: { style: "solid", color: "secondary", cuffColor: "accent" } }))).toEqual(["primary", "secondary", "accent"]);
  });

  it("shows the overlay of a pattern", () => {
    const kit = makeKit({ pattern: { id: "stripes", base: "primary", overlay: "secondary", params: {} } });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary", "accent"]);
  });

  it("counts the collar and the cuffs", () => {
    const kit = makeKit({ collar: { style: "round", color: "secondary" }, sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" } });
    expect(visibleRoles(kit)).toEqual(["primary", "secondary"]);
  });
});
```

Em `tests/generator/kit-generator.test.ts`, acrescente `visibleRoles` ao import de `../../src/core/kit.js` e, dentro de `describe("generateKitSet traditions", ...)`:

```ts
  it("shows the required color on every kit, changing only the collar", () => {
    const club = traditional({ requiredColor: "accent" });
    let changed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const withTradition = generateKitSet(club, seed);
      const plain = generateKitSet(identity, seed);
      for (const kitType of KIT_TYPES) {
        expect(visibleRoles(withTradition[kitType])).toContain("accent");
        expect({ ...withTradition[kitType], collar: plain[kitType].collar }).toEqual(plain[kitType]);
        if (withTradition[kitType].collar.color !== plain[kitType].collar.color) changed++;
      }
    }
    expect(changed).toBeGreaterThan(0);
  });

  it("leaves a kit alone when its base already is the required color", () => {
    const club = traditional({ requiredColor: "primary" });
    for (let seed = 0; seed < 50; seed++) expect(generateKitSet(club, seed).home).toEqual(generateKitSet(identity, seed).home);
  });
```

Em `tests/core/validation.test.ts`, dentro de `describe("validateKitTraditions", ...)`:

```ts
  it("reports a kit that does not show the required color", () => {
    const required = club({ traditions: { requiredColor: "accent" } });
    const hidden = makeKit({ collar: { style: "round", color: "secondary" }, sleeves: { style: "match-body", color: "secondary", cuffColor: "secondary" } });
    expect(validateKitTraditions(required, hidden)).toEqual([
      { rule: "required-color", message: "home kit does not show accent #ffd700 (traditions.requiredColor) on the pattern, sleeves, collar or cuffs" },
    ]);
    expect(validateKitTraditions(required, makeKit())).toEqual([]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core tests/generator -t "required|visibleRoles"`
Expected: FAIL (`requiredColor` rejeitado pelo schema, `visibleRoles` inexistente).

- [ ] **Step 3: Implementar**

Em `src/core/club.ts`, acrescente `import { ColorRoleSchema } from "./kit.js";` e, em `TraditionsSchema`, depois de `patterns`:

```ts
  requiredColor: ColorRoleSchema.optional(),
```

Em `src/core/kit.ts`, depois de `resolveLogoColor`:

```ts
// Papéis que aparecem na camisa (o PNG 2D mostra só ela). O overlay só pinta o corpo fora do padrão solid, e a manga lisa tem cor própria.
export function visibleRoles(kit: KitDefinition): ColorRole[] {
  const roles: ColorRole[] = [kit.pattern.base, kit.collar.color, kit.sleeves.cuffColor];
  if (kit.pattern.id !== "solid") roles.push(kit.pattern.overlay);
  if (kit.sleeves.style === "solid") roles.push(kit.sleeves.color);
  return COLOR_ROLES.filter((role) => roles.includes(role));
}
```

Em `src/generator/kit-generator.ts`, acrescente `visibleRoles` ao import de `../core/kit.js` e troque o `return { ... }` de `generateKit` por uma constante seguida do ajuste (o objeto em si não muda, nem a ordem das chaves):

```ts
  const kit: KitDefinition = {
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
  const required = identity.traditions?.requiredColor;
  // Depois de todos os sorteios e sem chamada extra ao rng: o resto do kit fica igual ao de um clube sem a tradição.
  // A gola sempre aceita o papel: ele não é a base, que é sempre visível.
  if (required !== undefined && !visibleRoles(kit).includes(required)) kit.collar.color = required;
  return kit;
```

Em `src/core/validation.ts`, acrescente `visibleRoles` ao import de `./kit.js` e, em `validateKitTraditions`, antes do `return issues;`:

```ts
  const required = traditions.requiredColor;
  if (required !== undefined && !visibleRoles(kit).includes(required)) {
    issues.push({
      rule: "required-color",
      message: `${kit.kitType} kit does not show ${required} ${kit.colors[required]} (traditions.requiredColor) on the pattern, sleeves, collar or cuffs`,
    });
  }
```

- [ ] **Step 4: Rodar tudo e o typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, com as guardas `Phase 3b baseline` verdes (sem `traditions`, o ajuste da gola não roda).

- [ ] **Step 5: Formatar e commitar**

```bash
npm run format
git add src/core/club.ts src/core/kit.ts src/generator/kit-generator.ts src/core/validation.ts tests/core/club.test.ts tests/core/kit.test.ts tests/generator/kit-generator.test.ts tests/core/validation.test.ts
git commit -m "feat: add the required color tradition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Layout UV do FM26 como dado

Os valores vêm da medição do `template.png` e da máscara `01-0` (2026-10-05). Os pixels usados no teste foram conferidos: o centro de cada região cai numa ilha do template, e os centros dos punhos e quatro pontos do anel da gola (raio 36) são azuis na máscara.

**Files:**
- Create: `src/fm26/layout.ts`
- Test: `tests/fm26/layout.test.ts`

**Interfaces:**
- Consumes: `LogoSlot` (`core/kit.ts`).
- Produces: `UvRect`, `UvPart`, `UvRegion`, `UvCircle`, `Fm26KitLayout`, `FM26_TEXTURE_SIZE = 1024`, `FM26_KIT_LAYOUT`. Nenhum consumidor em runtime nesta fase; o renderer 3D da 3c será o primeiro.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/fm26/layout.test.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, type UvRect } from "../../src/fm26/layout.js";

// Referências de engenharia: só os testes as leem, o runtime nunca.
const TEMPLATES_DIR = fileURLToPath(new URL("../../docs/fm_templates/", import.meta.url));

type Rgb = [number, number, number];

async function readPixels(file: string): Promise<(x: number, y: number) => Rgb> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => {
    const index = (y * info.width + x) * info.channels;
    return [data[index]!, data[index + 1]!, data[index + 2]!];
  };
}

function allRects(): UvRect[] {
  return [...FM26_KIT_LAYOUT.regions.map((region) => region.rect), ...FM26_KIT_LAYOUT.cuffs, ...Object.values(FM26_KIT_LAYOUT.logos)];
}

function centerPixel(rect: UvRect): [number, number] {
  return [Math.floor((rect.x + rect.width / 2) * FM26_TEXTURE_SIZE), Math.floor((rect.y + rect.height / 2) * FM26_TEXTURE_SIZE)];
}

function overlaps(a: UvRect, b: UvRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function contains(outer: UvRect, inner: UvRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

// Azul puro = cor 3 (acabamento) nas máscaras RGB do FM.
function isTrimBlue([red, green, blue]: Rgb): boolean {
  return blue > 200 && red < 60 && green < 60;
}

describe("FM26_KIT_LAYOUT", () => {
  it("describes the 1024 texture of the FM26 3D kits", () => {
    expect(FM26_TEXTURE_SIZE).toBe(1024);
    expect(FM26_KIT_LAYOUT.textureSize).toBe(1024);
  });

  it("keeps every rect inside the texture with a positive size", () => {
    for (const rect of allRects()) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the collar ring inside the texture", () => {
    const { cx, cy, innerRadius, outerRadius } = FM26_KIT_LAYOUT.collar;
    expect(innerRadius).toBeGreaterThan(0);
    expect(outerRadius).toBeGreaterThan(innerRadius);
    for (const value of [cx - outerRadius, cy - outerRadius]) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of [cx + outerRadius, cy + outerRadius]) expect(value).toBeLessThanOrEqual(1);
  });

  it("never overlaps two regions", () => {
    const { regions } = FM26_KIT_LAYOUT;
    for (const [index, region] of regions.entries()) {
      for (const other of regions.slice(index + 1)) expect(overlaps(region.rect, other.rect), `${region.part} ${region.side} × ${other.part} ${other.side}`).toBe(false);
    }
  });

  it("names the player side of every paired part and of no other", () => {
    const sides = (part: string) =>
      FM26_KIT_LAYOUT.regions
        .filter((region) => region.part === part)
        .map((region) => region.side)
        .sort();
    for (const part of ["sleeve", "longSleeve", "sock", "shorts"]) expect(sides(part)).toEqual(["left", "right"]);
    for (const part of ["front", "back"]) expect(sides(part)).toEqual([undefined]);
  });

  it("records the back as turned 180 degrees and every other region upright and unmirrored", () => {
    for (const region of FM26_KIT_LAYOUT.regions) {
      expect(region.rotation).toBe(region.part === "back" ? 180 : 0);
      expect(region.mirrored).toBe(false);
    }
  });

  it("puts the center of every region on an island of the labeled template", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "template.png"));
    for (const region of FM26_KIT_LAYOUT.regions) {
      const [red, green, blue] = pixel(...centerPixel(region.rect));
      expect(red + green + blue, `${region.part} ${region.side}`).toBeGreaterThan(40);
    }
  });

  it("puts the cuffs and the collar ring on the trim color of the FM mask 01-0", async () => {
    const pixel = await readPixels(path.join(TEMPLATES_DIR, "FM26 3D Assets", "01-0.png"));
    for (const cuff of FM26_KIT_LAYOUT.cuffs) expect(isTrimBlue(pixel(...centerPixel(cuff)))).toBe(true);
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

  it("keeps the logo boxes on the front", () => {
    const front = FM26_KIT_LAYOUT.regions.find((region) => region.part === "front")!.rect;
    for (const box of Object.values(FM26_KIT_LAYOUT.logos)) expect(contains(front, box)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/fm26/layout.test.ts`
Expected: FAIL (`Cannot find module '../../src/fm26/layout.js'`).

- [ ] **Step 3: Implementar o layout**

Crie `src/fm26/layout.ts`:

```ts
import type { LogoSlot } from "../core/kit.js";

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
  logos: Record<LogoSlot, UvRect>;
}

export const FM26_TEXTURE_SIZE = 1024;

// Medido em pixels da textura 1024×1024 (intervalo semiaberto) e guardado em fração.
function rect(x0: number, y0: number, x1: number, y1: number): UvRect {
  return { x: x0 / FM26_TEXTURE_SIZE, y: y0 / FM26_TEXTURE_SIZE, width: (x1 - x0) / FM26_TEXTURE_SIZE, height: (y1 - y0) / FM26_TEXTURE_SIZE };
}

function region(part: UvPart, area: UvRect, side?: "left" | "right", rotation: 0 | 180 = 0): UvRegion {
  return side === undefined ? { part, rect: area, rotation, mirrored: false } : { part, side, rect: area, rotation, mirrored: false };
}

export const FM26_KIT_LAYOUT: Fm26KitLayout = {
  textureSize: FM26_TEXTURE_SIZE,
  // Hipóteses da leitura do template.png, a confirmar no jogo na 3c (roadmap, seção "Calibração da UV").
  // O lado esquerdo da textura é o lado direito do jogador, como os rótulos RIGHT do template.
  regions: [
    region("front", rect(357, 598, 668, 1004)),
    // "BOLID 74" aparece de cabeça para baixo e com a ordem invertida no template: costas giradas 180°.
    region("back", rect(357, 134, 668, 598), undefined, 180),
    region("sleeve", rect(240, 405, 357, 725), "right"),
    region("sleeve", rect(668, 405, 785, 725), "left"),
    region("longSleeve", rect(0, 0, 357, 326), "right"),
    region("longSleeve", rect(668, 0, 1024, 326), "left"),
    region("sock", rect(3, 430, 237, 716), "right"),
    region("sock", rect(786, 430, 1020, 716), "left"),
    region("shorts", rect(4, 774, 351, 1018), "right"),
    region("shorts", rect(676, 774, 1024, 1018), "left"),
  ],
  // Punhos e gola vêm da máscara 01-0 do próprio FM (cor 3, acabamento): evidência mais forte que as hipóteses das regiões.
  cuffs: [rect(244, 411, 270, 722), rect(756, 411, 781, 722)],
  collar: { cx: 513 / FM26_TEXTURE_SIZE, cy: 597 / FM26_TEXTURE_SIZE, innerRadius: 29 / FM26_TEXTURE_SIZE, outerRadius: 43 / FM26_TEXTURE_SIZE },
  logos: {
    // Quadrados brancos do peito no template: o da direita da textura é o peito esquerdo do jogador.
    badge: rect(553, 670, 595, 712),
    manufacturer: rect(435, 670, 477, 712),
    // O template não marca o patrocinador: centro do peito abaixo dos outros logos, com a proporção da caixa 2D.
    sponsor: rect(411, 721, 613, 799),
  },
};
```

- [ ] **Step 4: Rodar o teste e o typecheck**

Run: `npx vitest run tests/fm26/layout.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Formatar e commitar**

```bash
npm run format
git add src/fm26/layout.ts tests/fm26/layout.test.ts
git commit -m "feat: describe the FM26 UV layout as data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Inspeção visual e documentação

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-01-roadmap.md`

**Interfaces:**
- Consumes: o comando `preview` (Task 4) e tudo o que as tasks anteriores entregaram.
- Produces: documentação da fase; nenhum código.

- [ ] **Step 1: Gate completo**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: tudo verde. Anote o total de testes do `npm test` para o roadmap.

- [ ] **Step 2: Preview dos kits salvos**

Run: `npm run kit-generator -- preview`
Expected: `Wrote <projeto>/output/kit_preview.html (6 kits)`. Abra o arquivo no navegador e confira os seis kits de Galáticos e Kongs iguais aos PNGs de `output/<id>/2d/`.

- [ ] **Step 3: Preview de amostras com os perfis**

Crie com a ferramenta Write o arquivo `output/_preview_clubs/estilos-fc/club.json` (o `_` impede colisão com a pasta de um clube em `output/`, e `output/` é ignorada pelo git):

```json
{
  "id": "estilos-fc",
  "name": "Estilos FC",
  "palette": { "primary": "#0b3d91", "secondary": "#ffffff", "accent": "#e4002b" },
  "style": { "categories": ["traditional", "modern", "retro"] },
  "sponsors": { "luna-air": 1, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

Run: `npm run kit-generator -- preview --clubs output/_preview_clubs --club estilos-fc --samples 48 --out output/_preview_clubs/estilos.html`
Expected: `Wrote <projeto>/output/_preview_clubs/estilos.html (144 kits)`. Abra o HTML e confira, padrão por padrão: os nove padrões novos aparecem; a cor base domina a camisa (exceto `halves` e `checkers`, divididos ao meio); no `gradient` os logos ficam sobre a cor base lisa; listras, faixas e o V do `chevron` passam por trás dos logos sem prejudicar a leitura; o desenho continua nas mangas `match-body`. Anote qualquer problema visual e corrija antes de seguir (ajuste de range = novo teste de cobertura na Task 5). Apague `output/_preview_clubs` no fim.

- [ ] **Step 4: README**

Em `README.md`:

1. Seção "Status": troque o parágrafo por:

```markdown
Fase 3b concluída: além do que a 3a entrega (kits Home, Away e Third com a mesma paleta, PNG 2D 414×414 com escudo, patrocinador e fabricante, export para o FM26 com `config.xml` gerado), o gerador tem 12 padrões de camisa, perfis de estilo, tradições do clube e um contact sheet HTML para inspecionar kits salvos ou amostras de seeds. A textura 3D ainda não existe (Fase 3c, que depende do teste da textura de calibração no jogo). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.
```

2. Seção "1. Criar um clube": troque o item de `patternWeights` por:

```markdown
- `style.categories` escolhe perfis de estilo (`classic`, `traditional`, `modern`, `retro`; ver "Perfis de estilo" na seção 4). Com mais de um perfil, o sorteio usa a média dos pesos deles. Sem `categories`, vale `classic`.
- `style.patternWeights` dá pesos de 0 a 1.000.000 por id de padrão (seção 4) e substitui os perfis. Padrão fora da lista fica com peso 0.
- `traditions` (opcional) fixa regras do clube; ver "Tradições do clube" abaixo.
```

e acrescente, logo antes de "Exemplo pronto":

````markdown
### Tradições do clube

```json
"traditions": { "forbiddenPatterns": ["sash"], "patterns": { "home": ["stripes", "pinstripes"] }, "requiredColor": "accent" }
```

- `forbiddenPatterns`: padrões que o gerador nunca sorteia.
- `patterns.home`, `patterns.away`, `patterns.third`: o sorteio daquele tipo fica restrito à lista. Se nenhum padrão da lista tiver peso no estilo do clube, todos da lista ficam com a mesma chance.
- `requiredColor` (`primary`, `secondary` ou `accent`): a cor aparece em todo kit, no padrão, na manga, na gola ou no punho. Quando o sorteio não a usa, a gola recebe essa cor.
- Um padrão ao mesmo tempo proibido e permitido é erro, assim como um tipo de kit sem nenhum padrão possível.
````

3. Seção "Estilos disponíveis no uniforme": troque a tabela de padrões e o parágrafo seguinte por:

```markdown
| `pattern.id` | Categoria | Aparência | Parâmetros (mín–máx, padrão) |
|---|---|---|---|
| `solid` | classic | Cor lisa, só a `base` | nenhum |
| `stripes` | classic | Listras verticais | `count` 3–15 inteiro, 7; `ratio` 0.2–0.4, 0.3 (fração de cada faixa que a listra ocupa) |
| `sash` | classic | Faixa diagonal no tronco | `width` 30–100, 70 (largura da faixa); `direction` 0 ou 1, 0 (`0` desce para a direita, `\`; `1` sobe, `/`) |
| `pinstripes` | classic | Listras verticais finas | `count` 12–30 inteiro, 20; `ratio` 0.08–0.2, 0.12 |
| `hoops` | classic | Listras horizontais | `count` 4–12 inteiro, 8; `ratio` 0.2–0.4, 0.3 |
| `diagonal` | modern | Listras diagonais paralelas, uma pelo centro | `count` 4–12 inteiro, 7; `ratio` 0.2–0.4, 0.3; `direction` 0 ou 1, 0 |
| `chevron` | retro | Faixa em V com vértice no centro | `depth` 0.35–0.6, 0.45 (altura do vértice); `width` 0.06–0.14, 0.1 (espessura) |
| `chest-band` | retro | Faixa horizontal no peito | `position` 0.35–0.6, 0.45 (altura do centro); `width` 0.1–0.22, 0.15 |
| `center-band` | retro | Faixa vertical central | `width` 0.08–0.2, 0.14 |
| `checkers` | modern | Xadrez | `size` 0.06–0.15, 0.1 (lado do quadrado) |
| `halves` | modern | Metades verticais | `side` 0 ou 1, 0 (`0` pinta o `overlay` à esquerda, `1` à direita) |
| `gradient` | modern | Degradê da `base` para o `overlay` na parte de baixo | `start` 0.58–0.72, 0.65 (altura onde começa) |

Tamanhos e posições dos padrões novos são frações da largura ou da altura da camisa. Os limites mantêm o `overlay` abaixo de metade do tronco, para a `base` continuar dominante; `halves` e `checkers` dividem o tronco ao meio de propósito. O `gradient` começa sempre abaixo dos logos. Para `pattern.base` e `pattern.overlay` use um papel de cor (`primary`, `secondary` ou `accent`); os dois precisam ser cores diferentes e distinguíveis.
```

4. Troque o parágrafo "**Categorias de estilo do clube.** ..." por:

```markdown
**Perfis de estilo** (`style.categories` no `club.json`):

| Perfil | Pesos dos padrões |
|---|---|
| `classic` (padrão) | solid 40, stripes 35, sash 25 |
| `traditional` | solid 30, stripes 25, pinstripes 15, hoops 15, sash 10, halves 5 |
| `modern` | solid 10, diagonal 20, gradient 20, checkers 15, halves 15, chevron 10, sash 10 |
| `retro` | hoops 20, chest-band 20, center-band 20, chevron 20, stripes 10, solid 10 |
```

5. No parágrafo de calção e meias, troque "entram no 3D (Fase 3b)" por "entram no 3D (Fase 3c)".

6. Seção "5. Validar": acrescente ao fim da lista do que é conferido ", estilos conhecidos e as tradições do clube (padrão proibido, padrão fora da lista do tipo e cor obrigatória ausente)".

7. Depois da seção "5. Validar", insira a seção nova e renumere "6. Exportar para o FM26" para "7. Exportar para o FM26":

````markdown
## 6. Pré-visualizar

```bash
npm run kit-generator -- preview
npm run kit-generator -- preview --club galaticos-fc
npm run kit-generator -- preview --club galaticos-fc --samples 24
```

Gera uma página HTML para abrir no navegador, com os kits lado a lado e, em cada um, o padrão, os parâmetros, a seed e as marcas. Sem `--club`, mostra os `kit.json` salvos de todos os clubes em `output/kit_preview.html`; um clube com erro é pulado e o comando termina com código 1. Com `--club`, só os daquele clube. Com `--samples <n>` (1 a 100), gera em memória os conjuntos das seeds 0 a n-1, sem gravar nenhum `kit.json`, em `output/kit_preview_<slug>.html`; para salvar o conjunto de que gostou, rode `generate --club <id> --seed <n>`. Opções: `--out <arquivo>`, `--clubs <dir>` e `--assets <dir>`.
````

8. Seção "Desenvolvimento", parágrafo "Estrutura": troque por:

```markdown
Estrutura: `src/core` (RNG, cores, schemas, validação, cor dos logos), `src/patterns` (12 padrões), `src/styles` (perfis de estilo e pesos do sorteio), `src/generator` (conjunto Home/Away/Third), `src/renderers` (camada de desenho compartilhada e renderer 2D com logos), `src/preview` (contact sheet HTML), `src/assets` (registry de logos), `src/fm26` (nomes de arquivo, `config.xml`, exporter e layout UV ainda hipotético), `src/io` (clubes, kits, JSON e arquivos de logo), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
```

- [ ] **Step 5: CLAUDE.md**

Em `CLAUDE.md`:

1. Visão geral: troque o trecho "Estado atual: Fase 3a concluída (...); a próxima é a 3b (...), com spec escrita e sem plano. A 3c (renderer 3D e 3D no export) depende do teste da textura de calibração da UV no jogo (roadmap, seção "Calibração da UV")." por:

```markdown
Estado atual: Fase 3b concluída (12 padrões, perfis de estilo, tradições do clube, contact sheet `preview`, camada de desenho compartilhada e layout UV como dado); a próxima é a 3c (renderer 3D e 3D no export), que depende do teste da textura de calibração da UV no jogo (roadmap, seção "Calibração da UV").
```

2. Bloco "Comandos": depois da linha do `render`, acrescente:

```bash
npm run kit-generator -- preview                                   # kits salvos de todos os clubes -> output/kit_preview.html
npm run kit-generator -- preview --club galaticos-fc --samples 24  # seeds 0..23 em memória, sem gravar kit.json
```

3. "Arquitetura": acrescente ao fluxo, depois de `renderKit2dPng(kit, { logos })`, " — `kitDesign` resolve o que pintar e o renderer só posiciona". E acrescente os itens:

```markdown
- `src/renderers/kit-design.ts`: `kitDesign(kit)` resolve fills (`solid` ou `pattern` com template e params resolvidos) de corpo e mangas e as cores de gola, punho, calção e meias; `fillSvg` desenha um fill num retângulo. O renderer 2D consome só isso, e o 3D da 3c deve usar a mesma camada. Manga lisa continua `<path>` preenchido no 2D (o SVG não mudou na refatoração).
- `src/styles`: `profiles.ts` (perfis `classic`, `traditional`, `modern`, `retro` como constante TS) e `pattern-weights.ts` (`resolvePatternWeights`: `patternWeights` do clube, senão média normalizada dos perfis de `categories`, senão `classic` sem normalizar; `patternCandidates(identity, kitType)` aplica `forbiddenPatterns` e a lista por tipo, na ordem do registry).
- `src/preview/contact-sheet.ts`: puro; `buildContactSheetHtml` gera HTML estático com os PNGs em base64 (evita a colisão dos ids de `clipPath`) e `kitDetails` descreve cada kit.
- `src/fm26/layout.ts`: `FM26_KIT_LAYOUT`, regiões da UV em fração 0–1 com lado do jogador, rotação e espelhamento, punhos, gola e caixas de logo. Valores hipotéticos até a calibração; nada lê o layout em runtime antes do renderer 3D.
```

No item de `src/patterns`, troque "cada padrão (`solid`, `stripes`, `sash`)" por "cada padrão (12: `solid`, `stripes`, `sash`, `pinstripes`, `hoops`, `diagonal`, `chevron`, `chest-band`, `center-band`, `checkers`, `halves`, `gradient`)" e a frase final sobre cobertura por: "Os ranges mantêm o overlay abaixo de metade do tronco (teste de pixel); `halves` e `checkers` são equilibrados, até 51%, e a lista deles fica no teste. Padrão novo usa tamanhos em fração de `width`/`height`, entra no fim do array do registry (a ordem participa do sorteio) e precisa aparecer em algum perfil." No item do generator, troque a descrição do sorteio de padrão por "sorteia o padrão com uma chamada `rng.weighted` sobre `patternCandidates(identity, kitType)` e, depois de todos os sorteios, troca a cor da gola por `traditions.requiredColor` quando ela não está em `visibleRoles(kit)`, sem chamada extra ao `rng`". No item de `validation.ts`, acrescente `unknown-style`, `tradition-conflict`, `no-pattern-weight` por tipo e `validateKitTraditions` (`forbidden-pattern`, `tradition-pattern`, `required-color`). No item da CLI, acrescente o comando `preview` (`--club`, `--samples` 1–100, `--out`; sem `--club` pula clube com erro e termina com 1).

4. "Convenções e armadilhas": acrescente:

```markdown
- `defaultWeight` não existe mais: clube sem `categories` nem `patternWeights` usa o perfil `classic` (solid 40, stripes 35, sash 25, sem normalizar), que reproduz as seeds antigas. Mudar esses números ou a ordem do registry muda os kits dessas seeds; as guardas `Phase 3b baseline` em `tests/renderers/renderer-2d.test.ts` e `tests/generator/kit-generator.test.ts` pegam isso.
- `style.categories` agora muda o sorteio, e categoria desconhecida é erro (`unknown-style`).
```

- [ ] **Step 6: Roadmap**

Em `docs/superpowers/plans/2026-10-01-roadmap.md`:

1. Linha da 3b na tabela de status: troque o status por `**Concluída** (<data de hoje>, `dev` @ `<hash do commit da Task 9>`, <total de testes do Step 1> testes)`, com os valores reais de `git log` e do `npm test`.
2. "Próximo passo": troque a frase "Próximo passo: executar o plano da Fase 3b. Em paralelo, o teste da textura..." por "Próximo passo: teste da textura de calibração no jogo (seção "Calibração da UV"), depois spec e plano da 3c com `superpowers:brainstorming` e `superpowers:writing-plans`."
3. Em "Pendências herdadas da Fase 1", remova o item dos IDs de `clipPath` (o preview embute PNGs) e, em "Limitações atuais", troque "sem textura 3D" por "sem textura 3D (Fase 3c)".

- [ ] **Step 7: Conferir formatação e commitar**

Run: `npm run format:check`
Expected: verde (os `.md` ficam fora do Prettier, mas o comando confere o resto).

```bash
git add README.md CLAUDE.md docs/superpowers/plans/2026-10-01-roadmap.md
git commit -m "docs: document phase 3b

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
