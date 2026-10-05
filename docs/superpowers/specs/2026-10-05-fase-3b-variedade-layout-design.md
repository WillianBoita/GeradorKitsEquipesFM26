# Fase 3b — Variedade de kits, camada de desenho compartilhada e layout UV

**Data:** 2026-10-05
**Specs de origem:** `fm26-procedural-kit-generator-guide.md` (seções 5, 6, 7, 9, 10 e 15), `fm26-kit-export-and-integration.md` (seções 12 e 13), roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 3, passos 2 e 3; Fase 4, itens 1, 2, 6 e 7; seção "Calibração da UV") e seção 11 da spec da 3a.

## 1. Objetivo

Fazer tudo o que não depende do teste da textura de calibração no jogo. A 3b entrega a variedade 2D que estava na Fase 4: nove padrões novos, perfis de estilo, tradições do clube e um contact sheet para inspeção. Também prepara a 3c com dois itens: uma camada de desenho compartilhada entre os renderers e o layout UV do FM26 como dado, com os valores ainda como hipótese.

Critério de sucesso:

- `npm run kit-generator -- preview` grava `output/kit_preview.html` com os kits salvos de todos os clubes.
- `preview --club <id> --samples 24` mostra 24 conjuntos com seeds 0 a 23. Num clube com `categories` e sem `patternWeights`, aparecem os padrões novos dos perfis listados.
- Galáticos e Kongs reproduzem os mesmos kits para as mesmas seeds.
- Os PNGs 2D de antes da refatoração saem idênticos byte a byte.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes, com os padrões novos inspecionados pelo preview.

## 2. Escopo

Reorganização do roadmap feita junto com esta spec:

- **3b (este documento):** camada de desenho compartilhada, layout UV como dado, padrões novos, perfis de estilo, tradições e preview.
- **3c (nova):** teste da textura de calibração no jogo, valores finais do layout, organização dos assets de referência em `assets/fm26/`, renderer 3D e 3D no `export`.
- **Fase 4:** perde os itens movidos para a 3b (padrões novos, perfis, tradições e preview). Fica com os componentes extraídos do PSD (golas `U`, `V`, `A1`, `A2`, mangas), o acabamento 3D (`fabric texture`, `mesh`) e os padrões por máscara do FM.

Fora da 3b, por decisão explícita:

- Renderer 3D e qualquer leitura do layout em runtime. O layout só é testado.
- 3D no `export`. A textura só entra no jogo depois da calibração (roadmap, seção "Calibração da UV").
- Perfis em arquivos JSON. Eles são uma constante TS, como o registry de padrões (seção 5).
- Cor fixa de calção e meias por tipo de kit (seção 6).
- Degradê sob os logos e `kit-clash` por conjunto de cores (seção 4.2).

## 3. Camada de desenho compartilhada

Módulo `src/renderers/kit-design.ts`. Ele resolve o que pintar em cada parte do kit, sem saber onde a parte fica. O renderer 2D passa a consumir só o resultado, e o renderer 3D da 3c usa a mesma camada.

```ts
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

export function kitDesign(kit: KitDefinition): KitDesign;
export function fillSvg(fill: KitFill, width: number, height: number): string;
```

- `kitDesign` resolve papéis em hex, busca o template (`getPatternTemplate`) e aplica `resolveParams`. Manga `match-body` recebe o mesmo fill do corpo; manga `solid` recebe `{ kind: "solid", color }`.
- `fillSvg` devolve o fragmento SVG de um fill num retângulo `width` × `height`: para `pattern`, o `<rect>` da base seguido de `template.render(...)`; para `solid`, um `<rect>`.
- `renderer-2d.ts` deixa de chamar `getPatternTemplate` e `resolveParams`. Manga `solid` continua desenhada como `<path>` preenchido, para o SVG não mudar.
- `shorts` e `socks` são resolvidos agora, mesmo sem uso no 2D, para a 3c receber o modelo completo.
- `backgroundRoles` (`core/logo-colors.ts`) continua chamando `colorAt` diretamente; não depende desta camada.

Garantia: antes da refatoração, um teste grava o SHA-256 do SVG 2D de um conjunto de kits que cobre os três padrões atuais, as duas golas e os dois estilos de manga. Depois da refatoração, o hash é igual. O PNG sai do SVG pelo Sharp e os logos são compostos depois, sem passar pela camada; SVG igual garante PNG igual, e o hash não depende da versão do Sharp.

## 4. Padrões novos

### 4.1 Os nove padrões

Um arquivo por padrão em `src/patterns/`, todos registrados no array de `registry.ts` depois de `solid`, `stripes` e `sash`, nesta ordem. Os parâmetros de tamanho são frações de `width` ou `height`, para o mesmo padrão escalar nas regiões 3D da 3c. O `sash` atual mantém a largura absoluta, porque mudar o significado de `params.width` mudaria os `kit.json` salvos.

| id | Categoria | Desenho | Parâmetros (ranges iniciais) |
|---|---|---|---|
| `pinstripes` | classic | listras verticais finas, mesmo layout de `stripes` | `count` 12–30 inteiro, `ratio` 0.08–0.2 |
| `hoops` | classic | listras horizontais: período = `height / count`, listra centrada no período | `count` 4–12 inteiro, `ratio` 0.2–0.4 |
| `diagonal` | modern | listras diagonais paralelas, uma delas passando pelo centro do canvas; `direction` 0 desce para a direita, como o `sash` | `count` 4–12 inteiro, `ratio` 0.2–0.4, `direction` 0–1 inteiro |
| `chevron` | retro | faixa em V com vértice em (`width / 2`, `depth × height`) e braços a 45° até as bordas | `depth` 0.35–0.6, `width` 0.06–0.14 (espessura em fração de `width`) |
| `chest-band` | retro | faixa horizontal centrada em `position × height` | `position` 0.35–0.6, `width` 0.1–0.22 (fração de `height`) |
| `center-band` | retro | faixa vertical centrada em `width / 2` | `width` 0.08–0.2 (fração de `width`) |
| `checkers` | modern | xadrez com um canto de quadrado no centro do canvas; overlay onde a soma dos índices de linha e coluna é ímpar | `size` 0.06–0.15 (lado em fração de `width`) |
| `halves` | modern | metades verticais divididas em `width / 2`; `side` 0 pinta o overlay à esquerda, 1 à direita | `side` 0–1 inteiro |
| `gradient` | modern | degradê vertical do base para o overlay, de `start × height` até `0.92 × height` (a barra do tronco 2D, y = 382 no viewBox 414) e overlay cheio abaixo | `start` 0.58–0.72 |

- Cada padrão implementa `render` e `colorAt`, e `colorAt` espelha o `render` (teste de pixel genérico).
- `gradient` é desenhado como faixas horizontais de overlay com `fill-opacity` crescente (altura de faixa `height / 207`, cerca de 2 px no 2D). Não usa `<defs>` nem `id`: o renderer 2D desenha o fill duas vezes (corpo e mangas `match-body`), e ids repetidos no mesmo SVG seriam ambíguos. `colorAt` devolve `overlay` onde a opacidade da faixa passa de 0.5: a opacidade 0.5 exata vira 127 ou 128 no PNG, e o teste de pixel só conta como overlay acima de 128.
- Os ranges da tabela são o ponto de partida. O plano os ajusta pelo teste de cobertura (seção 4.2), como a 2a fez com `stripes`.
- `PatternTemplate.defaultWeight` sai do tipo e dos três templates atuais: os pesos vêm só dos perfis e do clube (seção 5). `category` continua descritivo e aparece no preview.

### 4.2 Regras de validação

Cobertura do overlay no tronco 2D, medida no teste de pixel do renderer com os parâmetros que maximizam o overlay:

- Todos os padrões, menos `halves` e `checkers`: menos de 50%. A cor base precisa dominar a camisa, porque o `kit-clash` compara só a base.
- `halves` e `checkers` são equilibrados: até 51% (50% mais a tolerância de antialias e da caixa de medição assimétrica). A lista dos equilibrados fica no teste, não no template, porque nenhum código de runtime a usa.
- O `kit-clash` não muda. O ciclo de papéis (Home primary/secondary, Away secondary/accent, Third accent/primary) já impede dois kits com as mesmas cores invertidas, então um Home em metades primary/secondary nunca se confunde com outro kit do conjunto.

Contraste dos logos:

- O `colorAt` continua devolvendo só `base` ou `overlay`, e o contraste é medido contra essas duas cores.
- O `gradient` começa abaixo da caixa mais baixa de logo (sponsor, y 181–229 no viewBox 414, fração 0.553 < 0.58), então os logos do 2D ficam sempre sobre a cor base pura. Um teste confere isso no parâmetro mínimo de `start`.
- Logo que cai sobre as duas cores (`halves`, `checkers`, faixas) já é tratado pela 2b: `backgroundRoles` devolve os dois papéis e `chooseLogoColors` escolhe cor única ou par com contorno.

## 5. Perfis de estilo

Módulo `src/styles/profiles.ts`, constante TS sem I/O.

```ts
export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
}

export const STYLE_PROFILES: readonly StyleProfile[];
export const DEFAULT_STYLE_PROFILE = "classic";
```

| Perfil | Pesos |
|---|---|
| `classic` (padrão) | solid 40, stripes 35, sash 25 |
| `traditional` | solid 30, stripes 25, pinstripes 15, hoops 15, sash 10, halves 5 |
| `modern` | solid 10, diagonal 20, gradient 20, checkers 15, halves 15, chevron 10, sash 10 |
| `retro` | hoops 20, chest-band 20, center-band 20, chevron 20, stripes 10, solid 10 |

`classic` repete os `defaultWeight` atuais, então clube sem configuração continua gerando os mesmos kits.

Resolução dos pesos, em `src/styles/pattern-weights.ts`:

```ts
export function resolvePatternWeights(identity: ClubIdentity): Record<string, number>;
export function patternCandidates(identity: ClubIdentity, kitType: KitType): [PatternTemplate, number][];
```

1. `style.patternWeights` do clube, se existir. Substitui os perfis.
2. Senão, se `style.categories` não está vazio: média dos perfis listados, cada um normalizado para soma 1 antes da média, para um perfil com pesos maiores não dominar.
3. Senão: os pesos de `classic` sem normalização, iguais aos números de hoje.

`patternCandidates` aplica as tradições (seção 6) e devolve os pares na ordem do registry. O generator faz uma única chamada `rng.weighted` sobre eles, como hoje. Pesos zero são descartados por `rng.weighted`, então padrões novos com peso zero não alteram o sorteio.

Validação em `validateClub`: categoria que não é id de perfil vira `unknown-style` (`style.categories references unknown style "dark" (known: classic, traditional, modern, retro)`).

Mudança de comportamento: clube com `categories` e sem `patternWeights` passa a sortear pelos perfis, porque `categories` era guardado e ignorado. Galáticos e Kongs têm `patternWeights` e não mudam.

## 6. Tradições do clube

Campo opcional `traditions` no `club.json`:

```json
"traditions": {
  "forbiddenPatterns": ["sash"],
  "patterns": { "home": ["stripes", "pinstripes"] },
  "requiredColor": "accent"
}
```

Schema em `core/club.ts` (`z.strictObject`, como o resto):

- `forbiddenPatterns`: lista de ids de padrão, opcional.
- `patterns`: objeto com `home`, `away` e `third` opcionais, cada um uma lista não vazia de ids de padrão.
- `requiredColor`: papel de cor (`primary`, `secondary` ou `accent`), opcional.

### 6.1 Padrões proibidos e padrões por tipo

`patternCandidates(identity, kitType)` parte dos pesos resolvidos (seção 5):

1. Padrões de `forbiddenPatterns` recebem peso 0.
2. Se `patterns[kitType]` existe, só os padrões da lista ficam como candidatos, com os pesos resolvidos. Se todos tiverem peso 0, cada um recebe peso 1: a tradição vence o perfil.

Regras novas em `validateClub`:

| Regra | Quando falha |
|---|---|
| `unknown-pattern` | id desconhecido em `forbiddenPatterns` ou `patterns.<tipo>` (a regra já existe para `patternWeights`) |
| `tradition-conflict` | padrão listado em `patterns.<tipo>` e em `forbiddenPatterns` |
| `no-pattern-weight` | tipo sem `patterns.<tipo>` em que nenhum padrão sobra com peso positivo depois dos proibidos (a regra já existe para `patternWeights`) |

### 6.2 Cor obrigatória

Função `visibleRoles(kit): ColorRole[]` em `core/kit.ts`: papéis visíveis na camisa = base, gola, punho, overlay quando o padrão não é `solid` e a cor da manga quando a manga é `solid`. Num kit gerado a manga `solid` usa o overlay, então o overlay só fica invisível com padrão `solid` e manga `match-body`. Calção e meias não contam: o PNG 2D mostra só a camisa.

No generator, depois de todos os sorteios de `generateKit`: se `requiredColor` não está em `visibleRoles`, a gola recebe esse papel. Não há chamada extra ao `rng`, então os outros atributos do kit não mudam. A gola sempre aceita o papel: ele não é a base (a base é sempre visível) e a gola sorteia entre os papéis diferentes da base.

### 6.3 Validação dos kits

`validateKitTraditions(identity, kit): ValidationIssue[]` em `core/validation.ts`, chamada pelo `validate` para cada `kit.json`. Pega kits editados à mão:

| Regra | Quando falha |
|---|---|
| `forbidden-pattern` | o padrão do kit está em `forbiddenPatterns` |
| `tradition-pattern` | existe `patterns.<tipo>` e o padrão do kit não está na lista |
| `required-color` | `requiredColor` não está em `visibleRoles(kit)` |

`generateKitSet` já roda `validateClub` antes de gerar, então tradições inválidas impedem a geração com a mensagem da regra.

## 7. Preview (contact sheet)

### 7.1 Comando

```
kit-generator preview [--club <id>] [--samples <n>] [--out <file>] [--clubs <dir>] [--assets <dir>]
```

- Sem `--club`: os `kit.json` salvos de todos os clubes.
- `--club <id>` sem `--samples`: os `kit.json` salvos desse clube.
- `--club <id> --samples <n>`, com `n` inteiro de 1 a 100: gera em memória os conjuntos das seeds `0` a `n - 1` com `generateKitSet` e não grava `kit.json`. Cada bloco leva o rótulo `Seed 7`, e `generate --club <id> --seed 7` salva o conjunto escolhido. Antes de gerar, o comando roda `validateClubAssets`; `badge` segue `hasClubLogo`, como no `generate`.
- `--samples` sem `--club` é erro (`Error: --samples requires --club`), assim como `n` fora de 1–100.
- Saída padrão: `output/kit_preview.html` para kits salvos e `output/kit_preview_<slug>.html` para amostras (slug de `naming.ts`). O id de clube só aceita `[a-z0-9-]`, então esses nomes não colidem com `output/<id>/`. `--out` é relativo ao diretório atual, como os outros caminhos informados.
- Caminhos em `src/config/paths.ts`: `PREVIEW_FILE` e `samplesPreviewPath(clubId)`.
- Sucesso: `Wrote <arquivo> (<n> kits)` no stdout, exit 0.
- Sem `--club`, um clube com erro (club.json inválido, logo ausente, falha de render) gera `Error: [<id>] <mensagem>` no stderr e é pulado, como no `generate --all`. O HTML é gravado com os outros clubes e o exit code é 1. Com `--club` (kits salvos ou amostras) há um clube só, e qualquer erro aborta sem gravar, como no `generate --club`. Tipos de kit sem `kit.json` são omitidos sem erro.

### 7.2 Módulo `src/preview/contact-sheet.ts`

Puro, sem I/O.

```ts
export interface PreviewKit {
  kitType: KitType;
  png: Buffer;
  details: string[];
}

export interface PreviewSection {
  title: string;
  kits: PreviewKit[];
}

export function kitDetails(kit: KitDefinition): string[];
export function buildContactSheetHtml(title: string, sections: readonly PreviewSection[]): string;
```

- HTML estático com CSS inline e sem JavaScript: uma seção por clube (ou por seed), com os kits lado a lado em grade.
- Cada PNG 2D, com logos, vai embutido como `data:image/png;base64,...`. O arquivo é autossuficiente e não colide com ids de `clipPath`, o que resolve a pendência herdada da Fase 1.
- `kitDetails` lista tipo, padrão com categoria e parâmetros (`stripes · classic · count 7, ratio 0.3`), seed, patrocinador e fabricante.
- Todo texto vindo de dados (nome do clube, ids) é escapado (`&`, `<`, `>`, `"`, `'`).
- Tamanho: 24 seeds × 3 PNGs de cerca de 50 KB dão cerca de 5 MB em base64, aceitável para um arquivo local.

## 8. Layout UV como dado

Módulo `src/fm26/layout.ts`, constante TS. Ele cumpre a seção 13 do spec de integração (coordenadas fora do código de desenho) sem loader de JSON, como os perfis. Nada lê o layout em runtime na 3b; o renderer 3D da 3c será o primeiro consumidor. Todos os valores são hipóteses da tabela do roadmap (seção "Calibração da UV"), exceto punhos e gola, medidos na máscara `01-0` do próprio FM. Cada valor hipotético leva um comentário curto dizendo que a 3c o confirma.

```ts
export interface UvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UvPart = "front" | "back" | "sleeve" | "longSleeve" | "sock" | "shorts";

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

export const FM26_KIT_LAYOUT: Fm26KitLayout;
```

- Coordenadas em fração 0–1 da textura (pixel / 1024). `textureSize` = 1024.
- `side` é o lado do jogador. Hipótese: o lado esquerdo da textura é o lado direito do jogador, como os rótulos `RIGHT …` do `template.png`.
- `rotation` e `mirrored` descrevem a transformação do desenho da região: primeiro espelha na horizontal (se `mirrored`), depois gira.

Valores iniciais (pixels em 1024 × 1024, intervalos semiabertos):

| Região | `rect` | `rotation` | Origem |
|---|---|---|---|
| `front` | x 357–668, y 598–1004 | 0 | hipótese |
| `back` | x 357–668, y 134–598 | 180 | hipótese ("BOLID 74" invertido) |
| `sleeve` direita / esquerda | x 240–357 / 668–785, y 405–725 | 0 | hipótese |
| `longSleeve` direita / esquerda | x 0–357 / 668–1024, y 0–326 | 0 | hipótese |
| `sock` direita / esquerda | x 3–237 / 786–1020, y 430–716 | 0 | hipótese |
| `shorts` direita / esquerda | x 4–351 / 676–1024, y 774–1018 | 0 | hipótese |

- `cuffs`: x 244–270 e 756–781, y 411–722 (barras azuis da máscara `01-0`).
- `collar`: centro (513, 597), raio interno 29, raio externo 43 (anel azul da máscara `01-0`).
- `logos.badge`: x 553–595, y 670–712 (quadrado direito do peito no `template.png` = peito esquerdo do jogador). `logos.manufacturer`: x 435–477, y 670–712. `logos.sponsor`: x 411–613, y 721–799 (hipótese: centro do peito abaixo dos quadrados, com a proporção da caixa 2D).
- As faixas finas acima e abaixo da coluna ficam fora do layout até a calibração dizer o que são.

## 9. CLI

- Comando novo `preview` (seção 7) e linha nova no `USAGE`.
- `validate` também roda `validateKitTraditions` para cada kit carregado.
- `generate` não muda de interface. Por dentro, o sorteio de padrão passa por `patternCandidates` e o kit recebe o ajuste de `requiredColor`.

## 10. Reprodutibilidade

- A ordem das chamadas ao `rng` em `generateKit` não muda, e nenhum rótulo novo de `deriveSeed` é criado (o preview usa as seeds `0..n-1` diretamente).
- Mesmos kits para a mesma seed: clubes com `patternWeights` e sem `traditions` (Galáticos e Kongs), e clubes sem `categories`, sem `patternWeights` e sem `traditions` (perfil `classic` com os pesos antigos).
- Kits diferentes para a mesma seed, por desenho: clube com `categories` e sem `patternWeights`, e clube com `traditions`.
- Os `kit.json` salvos nunca mudam: o generator só roda no `generate` e no preview de amostras.

## 11. Testes

- `tests/renderers/kit-design.test.ts`: fills por kit (padrão, manga `match-body` e `solid`, cores de gola, punho, calção e meias). O hash do SVG 2D gravado antes da refatoração (`tests/renderers/renderer-2d.test.ts`) continua igual.
- `tests/patterns/patterns.test.ts`: a suíte genérica cobre os nove padrões automaticamente pelo registry (SVG válido, parâmetros extremos, determinismo, `min <= default <= max`, `colorAt` espelha o `render`).
- `tests/renderers/renderer-2d.test.ts`: cobertura do overlay no parâmetro máximo de cada padrão novo (<50%; ≤51% para `halves` e `checkers`); com `gradient` no `start` mínimo, as caixas de logo ficam sobre a cor base pura.
- `tests/styles/profiles.test.ts`: todo id de padrão dos perfis existe no registry; todo padrão aparece em pelo menos um perfil; `classic` é igual aos pesos antigos; ordem de resolução (`patternWeights`, média normalizada de `categories`, `classic`).
- `tests/styles/pattern-weights.test.ts`: `patternCandidates` com proibidos, lista por tipo, lista com pesos zero (peso 1) e ordem do registry.
- `tests/generator/kit-generator.test.ts`: reprodutibilidade contra conjuntos gravados antes da mudança (clube com `patternWeights` e clube sem configuração, várias seeds); propriedade sobre muitas seeds: nunca sai padrão proibido, o padrão do tipo sempre está na lista e `requiredColor` está sempre em `visibleRoles`.
- `tests/core/club.test.ts`: schema de `traditions` (chave desconhecida é erro, lista vazia é erro, papel inválido é erro).
- `tests/core/validation.test.ts`: `unknown-style`, `unknown-pattern` em tradições, `tradition-conflict`, `no-pattern-weight` por tipo, `forbidden-pattern`, `tradition-pattern` e `required-color`, cada uma com caso que passa e caso que falha.
- `tests/core/kit.test.ts`: `visibleRoles`, incluindo `solid` com manga `match-body`.
- `tests/preview/contact-sheet.test.ts`: HTML com uma seção por entrada, `<img>` em base64 que decodifica para o PNG original, texto escapado, `kitDetails`.
- `tests/cli/run-cli.test.ts`: `preview` com kits salvos (arquivo gravado, exit 0); clube inválido (stderr com `Error: [<id>]`, HTML com os outros, exit 1); `--club --samples 3` (três seções, nenhum `kit.json` gravado); `--samples` sem `--club` e fora de 1–100 (exit 1); `validate` acusando `forbidden-pattern` num kit editado; `USAGE` com a linha nova.
- `tests/fm26/layout.test.ts`: retângulos dentro de 0–1; regiões sem sobreposição; centro de cada região não preto no `template.png`; centro dos punhos e do anel da gola azul na máscara `01-0`; caixas de logo dentro de `front`. Os testes leem `docs/fm_templates/`, que só é referência de engenharia; o runtime continua sem ler esses arquivos.

## 12. Documentação

Ao final:

- `README.md`: comando `preview`, lista de padrões com parâmetros, perfis de estilo, `traditions` no `club.json`.
- `CLAUDE.md`: módulos novos (`renderers/kit-design.ts`, `styles/`, `preview/`, `fm26/layout.ts`), perfil `classic` como padrão no lugar de `defaultWeight`, regra de cobertura com os padrões equilibrados, layout ainda hipotético.
- Roadmap: status da 3b, a 3c como próxima fase e a pendência de `clipPath` resolvida pelo preview.

## 13. Ordem de implementação

1. Hashes dos PNGs 2D e conjuntos de referência do generator, gravados antes de qualquer mudança.
2. Camada de desenho compartilhada (seção 3).
3. Preview (seção 7), para inspecionar os passos seguintes.
4. Padrões novos e remoção de `defaultWeight` (seção 4), com o perfil `classic` no mesmo passo para o generator continuar compilando.
5. Perfis de estilo (seção 5).
6. Tradições (seção 6).
7. Layout UV (seção 8).
8. Documentação (seção 12) e inspeção visual pelo preview.
