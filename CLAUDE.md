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
