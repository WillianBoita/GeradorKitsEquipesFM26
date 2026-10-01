# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

CLI em TypeScript (ESM, Node >= 22.12) que gera uniformes aleatórios e reproduzíveis por seed para o Football Manager 2026. Estado atual: Fase 1 (MVP 2D) concluída. Só existe o kit Home e o PNG 2D 414×414; exportação para o FM26 (`config.xml`, textura 3D) e kits Away/Third são fases futuras. Specs: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Roadmap, decisões e pendências: `docs/superpowers/plans/2026-10-01-roadmap.md`. Leia o roadmap antes de iniciar qualquer fase nova.

## Comandos

```bash
npm install
npm test                                   # vitest run (toda a suíte)
npx vitest run tests/core/kit.test.ts      # um arquivo de teste
npx vitest run -t "nome do teste"          # um teste por nome
npm run typecheck                          # tsc -p tsconfig.json (inclui tests/)
npm run build                              # tsc -p tsconfig.build.json -> dist/ (só src/)
npm run kit-generator -- generate --club galaticos-fc --seed 42
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Não há linter nem formatter configurados. Uma fase só avança com `npm test`, `npm run typecheck` e `npm run build` verdes e o PNG inspecionado visualmente.

## Arquitetura

Fluxo: `club.json` (identidade) → `generateKit(identity, seed)` → `KitDefinition` (dado puro, salvo como `kit.json`) → `renderKit2dPng` (SVG → Sharp → PNG).

- `src/core`: schemas Zod (`club.ts`, `kit.ts`, `primitives.ts`), RNG semeado (`random.ts`, mulberry32), cores via Color.js (`color.ts`, `palette.ts`). Os schemas usam `z.strictObject`: chave desconhecida em `club.json`/`kit.json` é erro de propósito (pega typos como `fmUniqueID`).
- `src/generator/kit-generator.ts`: **único** ponto que usa aleatoriedade. A ordem das chamadas ao `rng` é contrato de reprodutibilidade; reordenar muda os kits gerados para a mesma seed.
- `src/patterns`: cada padrão (`solid`, `stripes`, `sash`) é um `PatternTemplate` com `parameters` (min/max/default/integer) e `render()` que devolve fragmento SVG. Novos padrões entram no array de `registry.ts`. O `kit.json` guarda só `pattern.id` + `params`; `resolveParams` faz clamp e usa o default em valores ausentes ou inválidos.
- `src/renderers`: determinístico. `shirt-2d-shape.ts` tem os paths da camisa (viewBox fixo, a gola muda o path do corpo); `renderer-2d.ts` monta o SVG com `clipPath` e rasteriza.
- `src/fm26/naming.ts`: única fonte de nomes de arquivo (`{slug}_{home|away|third}_{2d|3d}.png`, slug = `id` com `-` trocado por `_`). Não monte nomes de asset em outro lugar.
- `src/io`: `club-repository.ts` carrega `clubs/<id>/club.json` (o `id` do JSON deve bater com o nome da pasta) e grava `clubs/<id>/kits/<tipo>/kit.json`; `json-file.ts` lê JSON com erros claros.
- `src/cli`: `run-cli.ts` tem `runCli(argv, io)` testável com `CliIo` injetado; `index.ts` é só o entrypoint. Erros viram `Error: ...` no stderr com exit code 1.

## Convenções e armadilhas

- `fmUniqueId` é string numérica informada pelo usuário; o código nunca o inventa nem o deriva do nome. Hoje só é validado.
- `generate` renderiza o PNG antes de salvar o `kit.json` para não sobrescrever o kit versionado se a renderização falhar. Mantenha essa ordem.
- `output/` e `dist/` são ignorados. `--out` é relativo ao diretório atual; `--clubs` tem padrão relativo à raiz do projeto (`src/config/paths.ts`, funciona em `tsx` e em `dist/`).
- `--seed` aceita inteiro 0..4294967295; seed que começa com `-` exige `--seed=-1` por causa do `parseArgs`, e mesmo assim é rejeitada.
- Imports internos usam extensão `.js` (`NodeNext` + `verbatimModuleSyntax`); use `import type` para tipos.
- Testes espelham `src/` em `tests/`; fixtures em `tests/fixtures/` (`makeClubsDir` cria clubes temporários em `/tmp`).
- `docs/fm_templates/` são assets de referência do FM26 (UV, PSDs, máscaras) só para engenharia; o runtime nunca os lê.
- Código e comentários seguem o estilo do repositório: comentários em português, só para o "porquê"; declarações em uma linha (largura alvo 160 colunas).
