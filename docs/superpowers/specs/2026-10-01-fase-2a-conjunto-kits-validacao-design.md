# Fase 2a — Conjunto Home/Away/Third e validação de coerência

**Data:** 2026-10-01
**Specs de origem:** `fm26-procedural-kit-generator-guide.md` (seções 6, 7, 8, 20, 21, 23) e roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 2 e pendências herdadas da Fase 1).

## 1. Objetivo

`kit-generator generate --club galaticos-fc --seed 42` passa a gerar os três kits do clube (Home, Away, Third) com a mesma paleta, cada um com cor base diferente, validados por regras determinísticas de coerência antes de renderizar. Novos comandos `generate --all` e `validate` operam sobre todos os clubes de `clubs/`.

Critério de sucesso: o comando acima grava `clubs/galaticos-fc/kits/{home,away,third}/kit.json` e `output/galaticos-fc/2d/galaticos_fc_{home,away,third}_2d.png`; `kit-generator validate --all` termina com exit code 0; os três PNGs, inspecionados visualmente, parecem do mesmo clube e são distinguíveis entre si; `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes.

## 2. Escopo

A Fase 2 do roadmap foi dividida em duas:

- **2a (este documento):** conjunto Home/Away/Third, validação de coerência, CLI `validate` e `generate --all`, pendências herdadas da Fase 1 e backlog de qualidade.
- **2b (spec própria, depois):** registry de assets, escudo, patrocinadores, fabricantes, logos no renderer 2D e regras de contraste de logo/patrocinador.

Fora da 2a, por decisão explícita:

- `style.experimentalism`: o Third não tem regra extra de experimentação. Com três padrões clássicos não há o que pesar; volta na Fase 4 com padrões experimentais.
- Retry de geração por kit: com uma paleta válida nenhuma regra de kit falha (ver seção 5.4), então o retry existe só na paleta. O retry por kit entra na 2b junto com as regras de patrocinador.
- Limite de elementos e restrições declaradas por template: nada a limitar hoje; entram quando houver logos (2b) e templates com restrições (Fase 4).
- Flag `--size`: não existe, então `Render2dOptions.size` continua sem validação de entrada.

## 3. Modelo de dados

### 3.1 `KitDefinition`

Dois campos novos em `src/core/kit.ts`, nesta ordem logo após `clubId`:

```ts
kitType: KitTypeSchema,                                        // "home" | "away" | "third", obrigatório
generatedWith: z.strictObject({ seed: SeedSchema }).optional(), // seed do conjunto que gerou o kit
```

- `KIT_TYPES`, `KitType` e `KitTypeSchema` passam a morar em `src/core/kit.ts`. `src/fm26/naming.ts` importa de lá e continua exportando `RENDER_TYPES`.
- `SeedSchema` (`z.number().int().min(0).max(MAX_SEED)`) fica em `src/core/primitives.ts`.
- `generatedWith` é opcional porque um `kit.json` escrito à mão não tem seed. Ele guarda a seed do **conjunto**: `generate --club <id> --seed <generatedWith.seed>` reproduz o kit.
- O schema continua estrito. O `clubs/galaticos-fc/kits/home/kit.json` atual (sem `kitType`) fica inválido; a última tarefa regenera os três kits do clube com seed 42.

### 3.2 `ClubIdentity`

`style.patternWeights` ganha máximo de `1_000_000` por peso, para que a soma nunca deixe de ser finita.

## 4. Geração

### 4.1 Sub-seeds

`deriveSeed(seed, label)` em `src/core/random.ts`: FNV-1a de 32 bits sobre a string `"<seed>:<label>"`, devolvendo inteiro em `0..MAX_SEED`. Valida `seed` com a mesma regra de `createRng`.

Rótulos usados: `home`, `away`, `third` (seed de cada kit), `palette:<n>` (tentativa `n` da paleta) e, no `generate --all`, o `id` do clube.

Consequências:

- Cada kit tem sua própria sequência de `rng`; o contrato de ordem das chamadas vale dentro de `generateKit`.
- `generateKitSet` sempre gera os três kits. `--type away` só filtra o que é renderizado e salvo, então o Away da seed 42 é o mesmo com ou sem `--type`.
- Os kits da seed 42 mudam em relação à Fase 1. Esperado.

### 4.2 Fluxo de `generateKitSet(identity, seed)`

1. `validateClub(identity)`. Se houver issues, lança `Club "<id>" is invalid:` seguido de `formatIssues`. Retry não resolve cor ou peso informado pelo usuário.
2. `generatePalette(identity, seed)`: para `n` de `0` a `MAX_PALETTE_ATTEMPTS - 1` (`20`), resolve a paleta com `createRng(deriveSeed(seed, "palette:<n>"))` e aceita a primeira que passa em `validatePalette`. Se nenhuma passar, lança `Could not derive a valid palette for club "<id>" after 20 attempts:` seguido das issues da última tentativa.
3. Para cada tipo em `KIT_TYPES`: `generateKit(identity, kitType, palette, seed)`.

Retorno: `KitSet = Record<KitType, KitDefinition>`.

### 4.3 `generateKit(identity, kitType, palette, seed)`

Usa `createRng(deriveSeed(seed, kitType))`. Papéis por tipo, em ciclo `primary → secondary → accent → primary`:

| Tipo | base | overlay |
|---|---|---|
| home | primary | secondary |
| away | secondary | accent |
| third | accent | primary |

Cada par de kits divide no máximo uma cor e nenhum par inverte base e overlay. A primeira versão desta tabela (Away secondary/primary, Third accent/primary ou secondary) foi descartada depois da inspeção visual do protótipo: Home e Away, e às vezes Away e Third, saíam como as mesmas duas cores trocadas, por exemplo listras navy/branco nos dois kits da seed 2024. A regra `kit-clash` não pega esse caso porque compara só a cor base.

Demais papéis, iguais para os três tipos e idênticos ao comportamento atual do Home:

- gola e punho: papéis diferentes da base, na ordem de `COLOR_ROLES`;
- mangas `solid`: cor do overlay;
- calção: base ou overlay;
- meias: cor do calção ou base.

Ordem das chamadas ao `rng` (contrato de reprodutibilidade): padrão, parâmetros do padrão, estilo da gola, cor da gola, estilo da manga, cor do punho, calção, meias.

O kit devolvido inclui `kitType` e `generatedWith: { seed }` (seed do conjunto).

`pickPattern` perde as checagens de peso desconhecido e de nenhum peso positivo, que migram para `validateClub`.

### 4.4 `deriveAccent`

Antes de cair no neutro, tenta três alvos de luminosidade OKLCH: `[0.85, 0.92, 0.75]` quando a primária tem `L < 0.6`, `[0.35, 0.25, 0.45]` caso contrário. Mesmo matiz e croma (`0.15`) da versão atual, e continua fazendo uma única chamada `rng.range`. Medido em 20 mil cores aleatórias: o fallback neutro cai de 13,3% para 0,7%.

### 4.5 `rng.weighted`

Lança `Sum of weights must be finite` quando a soma dos pesos válidos não é finita.

### 4.6 Cobertura máxima do overlay

A cor base precisa dominar a camisa. Senão um Away (base secondary) com listras largas de primary parece o Home, e a regra `kit-clash`, que olha só a base, não percebe. Novos ranges:

| Padrão | Parâmetro | Antes | Depois |
|---|---|---|---|
| `stripes` | `ratio` | 0.2–0.8, padrão 0.5 | 0.2–0.4, padrão 0.3 |
| `sash` | `width` | 30–140, padrão 80 | 30–100, padrão 70 |

Medido no tronco do renderer 2D (sem gola e mangas), no parâmetro máximo: listras cobrem no máximo 47% (`count` 5) e a faixa 48%. O teto de listras ficou em 0.4, e não em 0.45, porque com 0.45 e `count` 4 a cobertura chega a 49,7%: perto demais de 50% para um teste estável.

Um `kit.json` antigo com valor fora do range continua válido; `resolveParams` faz o clamp na renderização, como já fazia.

## 5. Validação

Módulo `src/core/validation.ts`, determinístico, sem I/O.

### 5.1 Tipos e distância de cor

```ts
export interface ValidationIssue {
  rule: string;
  message: string;
}
```

`colorDistance(a, b)` em `src/core/color.ts`: ΔE OKLab (`Color#deltaE(other, "OK")`). Limite `MIN_COLOR_DISTANCE = 0.15`.

Calibração (distâncias medidas): branco × `#f0f0f0` 0,045; navy × `#2b4a6f` 0,084; ouro × laranja 0,121; verde-escuro × verde-floresta 0,123 (todos reprovados); vermelho × laranja 0,155; branco × ouro 0,215; navy × branco 0,685 (aprovados).

### 5.2 Regras

| Função | Regra | Quando falha |
|---|---|---|
| `validateColors(colors)` | `distinct-colors` | dois papéis presentes com distância < 0,15 |
| `validateClub(identity)` | `unknown-pattern` | `patternWeights` cita padrão fora do registry |
| | `no-pattern-weight` | nenhum padrão com peso positivo |
| | `distinct-colors` | só sobre as cores informadas em `palette` |
| `validatePalette(palette)` | `distinct-colors` | sobre as três cores resolvidas |
| `validateKit(kit)` | `unknown-pattern` | `pattern.id` fora do registry |
| | `pattern-contrast` | `pattern.base` igual a `pattern.overlay`, ou cores com distância < 0,15 |
| `validateKitSet(kits)` | `club-mismatch` | kits com `clubId` diferentes |
| | `kit-clash` | cores base de dois kits com distância < 0,15 |

`pattern-contrast` vale também para o padrão `solid`, porque o overlay pinta as mangas `solid`.

`formatIssues(issues)` devolve uma linha `  - <rule>: <message>` por issue.

Exemplo de mensagem: `distinct-colors: primary #123456 and secondary #1a3d66 are too similar (distance 0.039, minimum 0.15)`.

### 5.3 Onde cada validação roda

- Generator: `validateClub` antes de tudo; `validatePalette` dentro do retry da paleta.
- CLI `validate`: `validateClub`, `validateKit` por kit salvo e `validateKitSet` no conjunto salvo.

### 5.4 Garantia por construção

Com paleta válida (três cores distintas duas a duas), todo kit gerado passa em `validateKit` e todo conjunto passa em `validateKitSet`: base e overlay são sempre papéis diferentes e as três bases são `primary`, `secondary` e `accent`. Um teste de propriedade cobre isso para muitas seeds e paletas.

## 6. Repositório e caminhos

`src/io/club-repository.ts`:

- `listClubIds(clubsDir)`: subpastas que contêm `club.json`, em ordem alfabética; ignora arquivos e pastas sem `club.json`.
- `saveKit(kit, clubsDir)`: o tipo vem de `kit.kitType`, sem argumento separado.
- `loadKit(clubId, kitType, clubsDir)`: `undefined` quando o arquivo não existe; erro quando o `clubId` ou o `kitType` do arquivo não batem com a pasta (`<file> declares kitType "away", expected "home"`).
- `kitDefinitionPath(clubId, kitType, clubsDir)`: valida `kitType` em runtime com `KitTypeSchema`.

`src/config/paths.ts`:

- `OUTPUT_DIR = <projeto>/output`, padrão do `--out`. Um `--out` informado continua relativo ao diretório atual.
- `kitRenderPath(outDir, clubId, kitType, renderType)` = `<outDir>/<clubId>/<renderType>/<kitAssetFileName>`. A CLI deixa de montar esse caminho.

## 7. CLI

```
kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>]
kit-generator render --definition <kit.json> --out <file.png>
kit-generator validate (--club <id> | --all) [--clubs <dir>]
```

### 7.1 `generate`

- Exatamente um entre `--club` e `--all`. Os dois juntos: `Use either --club or --all, not both`. Nenhum: `Missing required option --club or --all`.
- `--type` é validado com `KitTypeSchema`; sem ele, os três tipos.
- Para cada clube: loga `Seed: <n> (<id>)` antes de gerar (a seed aparece mesmo se algo falhar), gera o conjunto, renderiza **todos** os PNGs pedidos e só depois grava os `kit.json`. Assim uma falha de renderização não sobrescreve nenhum kit versionado.
- Log de sucesso: `Generated <nome> kits (seed <n>)` e, por tipo, `  <tipo> definition: <arquivo>` e `  <tipo> 2D: <arquivo>`.
- `--all`: percorre `listClubIds`. Com `--seed S`, a seed de cada clube é `deriveSeed(S, id)`; sem `--seed`, cada clube sorteia a sua. Como a seed de cada clube é logada, `generate --club <id> --seed <logada>` reproduz o resultado. Falha em um clube vira `Error: [<id>] <mensagem>` no stderr e não interrompe os demais; no fim loga `Generated <ok> of <total> clubs` e devolve exit code 1 se algum falhou. Diretório sem clubes: erro `No clubs found in <dir>`.

### 7.2 `validate`

- Mesma regra de `--club`/`--all`.
- Por clube: `loadClub` + `validateClub`; para cada tipo, `loadKit` (schema e pasta) + `validateKit`; por fim `validateKitSet` sobre os kits encontrados. Erro de leitura ou de schema vira issue `invalid-file` com a mensagem original.
- Clube válido: `OK <id> (<n> kits)` no stdout. Inválido: `FAIL <id>` e as issues formatadas no stderr.
- Exit code 1 se algum clube falhar. Kit ausente não é erro nesta fase (Home e Away obrigatórios só no export da Fase 3).

### 7.3 `render`

Inalterado; passa a exigir o `kit.json` no formato novo.

## 8. Ferramentas e backlog

- `@types/node` fixado em `^22`, alinhado com `engines >= 22.12`.
- Prettier `3.9.9` como dev dependency, `.prettierrc.json` com `{ "printWidth": 160 }`, scripts `format` (`prettier --write .`) e `format:check` (`prettier --check .`). `.prettierignore`: `dist`, `output`, `docs`, `*.md`, `package-lock.json` e `clubs/*/kits` (gerado por `JSON.stringify`, não pelo formatter). O repositório é formatado num commit próprio, sem mudança de comportamento (corrige de passagem o typo de `src/patterns/sash.ts` e as linhas acima de 160 colunas). Interfaces passam a ser multilinha, como o Prettier exige. O gate de fase passa a incluir `npm run format:check`.
- Temporários de teste: `makeTempDir(prefix)` em `tests/fixtures/temp.ts` cria a pasta e registra `onTestFinished` para apagá-la. `makeClubsDir` e os testes de CLI usam essa função.
- Testes que faltavam: mangas `match-body` pintadas com o padrão; cores de punho e gola; geometria `v-neck` diferente de `round`; parâmetros do `sash` dentro do range; chaves com typo (`fmUniqueID`, `patternWeigths`) rejeitadas; `--seed=-1` e seeds `0` e `4294967295` via `runCli`; PNGs byte a byte iguais no teste de reprodutibilidade.

## 9. Testes desta fase

- `deriveSeed`: determinístico, sensível a seed e rótulo, dentro de `0..MAX_SEED`, rejeita seed inválida.
- `colorDistance` e `deriveAccent`: valores conhecidos; accent nunca igual ao neutro para as primárias de exemplo que antes caíam no fallback.
- Validação: cada regra com caso que passa e caso que falha, e a mensagem formatada.
- Renderer: no parâmetro máximo, `stripes` (várias contagens) e `sash` (duas direções) cobrem menos da metade do tronco.
- Generator: conjunto reproduzível por seed; Away igual com e sem filtro; papéis em ciclo (home primary/secondary, away secondary/accent, third accent/primary); paleta compartilhada; `generatedWith.seed`; retry da paleta encontra paleta válida quando a tentativa 0 falha; erro claro quando nenhuma tentativa passa; propriedade da seção 5.4; parâmetros de `stripes` e `sash` dentro dos novos ranges.
- Repositório: `listClubIds`, `loadKit` (ausente, divergência de pasta), `kitType` inválido rejeitado em runtime.
- CLI: `generate` com três kits, `--type`, `--all` (com e sem falha parcial, com seed derivada), conflitos de flags, `validate` OK e FAIL.

## 10. Documentação

Ao final: `README.md` (comandos novos, três kits, `validate`, `format`), `CLAUDE.md` (estado da fase, comandos, formatter, onde moram `KIT_TYPES` e validação, contrato de ordem do `rng` por kit) e roadmap (Fase 2 dividida em 2a/2b, status da 2a, pendências resolvidas).
