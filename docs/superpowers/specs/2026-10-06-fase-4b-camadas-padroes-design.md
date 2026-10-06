# Fase 4b — Camadas de detalhe e padrões novos (2D)

**Data:** 2026-10-06
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 4, item 3: padrões além das 2 cores) e specs da 3b (padrões, perfis) e da 4a (pesos por perfil, ordem do sorteio).

## 1. Objetivo

Kits menos genéricos. Hoje o padrão pinta com `base` e `overlay`, só 2 cores, e o `accent` aparece apenas em gola, punho, calção e meias. A 4b acrescenta:

- **Camadas de detalhe** (`layers`): até 2 padrões finos ou localizados desenhados sobre o padrão principal, cada um com uma cor de papel, o que traz o `accent` para dentro do desenho.
- **10 padrões novos**: formas geométricas, linhas em posições específicas e degradês não uniformes.

Tudo só no 2D. O 3D continua na 3c e lê os mesmos campos do `kit.json`.

Critério de sucesso:

- `preview --club <id> --samples 24` num clube `modern` ou `retro` mostra kits com 1 e 2 camadas, formas no tronco e os dois degradês.
- Clube sem `categories` nem `patternWeights` (perfil `classic`) gera os mesmos conjuntos de antes para as mesmas seeds.
- Os `kit.json` salvos continuam válidos e renderizam o mesmo PNG.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes, com os PNGs novos inspecionados pelo preview.

## 2. Escopo

Dentro:

- Campo `layers` opcional no `kit.json`, máximo 2 camadas, cor por papel.
- Região `layerSlot` nos templates de padrão (o template que a declara é `layerable`).
- Sorteio das camadas por perfil (`layerCountWeights`, `layerWeights`).
- Regras de validação das camadas.
- Renderer 2D e contact sheet.
- 10 padrões novos (seção 6).

Fora, por decisão explícita:

- Camadas no 3D (3c).
- Camadas nas mangas: a manga `match-body` recebe só o padrão principal.
- Override de camadas no `club.json` (como gola e manga, só perfis).
- Padrões atuais como camada: nenhum cabe na regra "fora das caixas de logo" (`chest-band` e `center-band` cortam o patrocinador; `pinstripes`, `sash` e `chevron` atravessam o peito). Ficam só como padrão principal.
- Camada com cor repetida de `base`/`overlay` validada por amostragem de pixel.
- Camadas cruzando as caixas de logo e `backgroundRoles` com terceira cobertura.
- Substituir `pattern` por uma lista de camadas (quebraria os `kit.json` salvos e as seeds antigas).

## 3. Dados

`src/core/kit.ts`:

```ts
export const MAX_LAYERS = 2;

const LayerSchema = z.strictObject({ id: z.string().min(1), color: ColorRoleSchema, params: z.record(z.string(), z.number()).default({}) });

layers: z.array(LayerSchema).max(MAX_LAYERS).optional(),
```

- `pattern` não muda. `layers` ausente = sem camadas, então os `kit.json` antigos continuam válidos e o JSON gerado para quem não sorteia camadas fica igual.
- O generator só grava `layers` quando sai pelo menos uma camada, como faz com `badge` e `sleeves.cut`.
- As camadas são desenhadas em ordem, uma sobre a outra, depois do padrão principal.
- `visibleRoles` inclui a cor de cada camada, então `traditions.requiredColor` pode ser satisfeito por uma camada.

`src/patterns/types.ts`: `PatternTemplate` ganha `layerSlot?: "sides" | "shoulders" | "lower"`, a região do tronco que a camada ocupa. Template com `layerSlot` é `layerable`; `listLayerTemplates()` (em `registry.ts`) lista esses templates na ordem do registry. Um template `layerable` é um padrão completo (`render()` e `colorAt`):

- Como camada, o `render()` recebe `overlay` igual à cor da camada e desenha só os elementos do overlay; o `<rect>` da base, que hoje vem de `fillSvg`, não é desenhado. O `colorAt` diz onde a camada pinta (`overlay`) e serve a `layer-logo-overlap` e aos testes, nunca a `backgroundRoles`.
- Como padrão principal ele também funciona, então o `patternWeights` de um `club.json` pode usá-lo. Os perfis põem os 8 `layerable` só em `layerWeights`.

## 4. Validação

`validateKit` ganha as regras abaixo, cada uma com um teste de erro:

- `unknown-layer`: id desconhecido no registry ou template sem `layerSlot`.
- `layer-duplicate`: dois ids iguais, ou id igual a `pattern.id`.
- `layer-color`: cor igual a `pattern.base` ou a `pattern.overlay`. Com `pattern.id === "solid"` só `pattern.base` conta, porque o overlay não é pintado. Os papéis têm ΔE ≥ `MIN_COLOR_DISTANCE` por `validatePalette`, então o contraste da camada vem por construção.
- `layer-logo-overlap`: o `colorAt` da camada, nos parâmetros resolvidos do kit, devolve `overlay` em algum ponto de uma caixa de `LOGO_BOXES` (mesma grade 24×24 de `backgroundRoles`). É uma rede de segurança além do teste genérico de pixel por padrão, que já impede isso nos extremos dos ranges. A regra mede qualquer id do registry, inclusive um sem `layerSlot` (que também recebe `unknown-layer`); só um id fora do registry fica sem medida.

Tradições:

- `forbiddenPatterns` vale também para camadas (`forbidden-pattern`).
- `traditions.patterns.<tipo>` vale só para o padrão principal.

`backgroundRoles` e `chooseLogoColors` não mudam: como as camadas ficam fora das caixas, o fundo dos logos é só o padrão principal.

## 5. Sorteio e perfis

### 5.1 Generator

As camadas são o **último sorteio** de `generateKit`, depois do `cut` e antes do passo de `requiredColor`, que continua sem `rng`. Os sorteios existentes não se deslocam. Ordem:

1. Quantidade, por `rng.weighted` sobre `layerCountCandidates(identity)` (0, 1 ou 2), em `component-weights.ts`.
2. Para cada camada:
   - O id, por `rng.weighted` sobre `layerCandidates(identity, exclude)`, na ordem do registry. A função zera ids em `forbiddenPatterns` e toda camada cuja região já está ocupada por um id de `exclude` (o `pattern.id` e os ids já sorteados): duas camadas na mesma região se sobrepõem (duas formas no tronco, a linha atravessando a forma), o que o protótipo mostrou feio.
   - A cor, por `rng.pick` entre os papéis livres (≠ `pattern.base` e ≠ `pattern.overlay`; em `solid`, só ≠ `pattern.base`). Fora do `solid` só sobra um papel, então as duas camadas têm a mesma cor; o `rng.pick` roda assim mesmo, para a ordem das chamadas não depender do padrão.
   - Os parâmetros, por `randomParams`.
3. Sem candidato de id, a camada é descartada, sem erro.

O passo de `requiredColor` roda depois e vê as cores das camadas em `visibleRoles`.

### 5.2 Perfis

`StyleProfile` ganha:

```ts
layerCountWeights: Weights<"0" | "1" | "2">;
layerWeights: Record<string, number>;
```

- `classic`: `layerCountWeights: { 0: 1 }`, `layerWeights: {}`. Seeds antigas e as guardas `Phase 3b baseline` não mudam.
- `traditional`: 0 (70%), 1 (30%). Favorece linhas finas (`double-pinline`, `side-lines`, `shoulder-line`).
- `modern`: 0 (30%), 1 (50%), 2 (20%). Favorece formas (`torso-circle`, `torso-diamond`, `torso-triangle`, `torso-cross`).
- `retro`: 0 (40%), 1 (45%), 2 (15%). Favorece `hoop-line`, `double-pinline`, `side-lines`.
- `profile-weights.ts` ganha a média normalizada das duas tabelas, como as demais.
- Sem override no `club.json`.
- Os números exatos de `layerWeights` e dos degradês em `patternWeights` ficam no plano; a seção 8 testa só a forma das tabelas.

Os dois degradês entram em `patternWeights` de `modern` (e, com peso menor, `retro`/`traditional`). Isso muda de propósito os kits de clubes com `categories` (Galáticos, Kongs) para a mesma seed, como já aconteceu na 4a. Os `kit.json` salvos e o `export` não mudam até um novo `generate`.

## 6. Padrões novos

Todos os tamanhos em fração de `width`/`height`, no fim do array do `registry.ts` (a ordem participa do sorteio), com `parameters` de min/max/default e `colorAt` quando principal.

Principais (2 cores, não `layerable`), no estilo de `gradient.ts` (faixas de opacidade, sem `<defs>`, limiar 0.5 no `colorAt`, com a divisão em faixas num helper comum aos três degradês). As bordas das faixas são inclinadas ou curvas, e o antialias delas soma duas faixas no mesmo pixel; o grupo usa `shape-rendering="crispEdges"`, e os anéis do radial são paths `evenodd` que repetem o mesmo círculo dos dois lados de cada borda:

- `gradient-diagonal`: degradê na diagonal do corpo.
- `gradient-radial`: degradê radial com centro e raio parametrizados.

Ambos mantêm a base pura sob as caixas de logo, como o `gradient` (início do degradê abaixo do patrocinador), e ficam abaixo de metade do tronco de overlay (teste de pixel).

`layerable`, com a região entre parênteses:

- `side-lines` (`sides`): uma faixa vertical larga em cada lateral, rente à borda do tronco (painel lateral).
- `double-pinline` (`sides`): dois filetes verticais finos e paralelos em cada lado, entre o painel lateral e as caixas de logo (x < 145 e x > 269 no viewBox 414).
- `shoulder-line` (`shoulders`): filete horizontal na altura dos ombros, acima das caixas de logo (y < 102).
- `torso-circle`, `torso-diamond`, `torso-cross`, `torso-triangle` (`lower`): contorno da forma centrado no tronco, abaixo do patrocinador (a caixa termina em y = 229, 0.553 da altura).
- `hoop-line` (`lower`): filete horizontal abaixo do patrocinador.

A geometria exata de cada um (coordenadas e ranges) fica no plano, validada pelos testes da seção 8.

## 7. Renderer e preview

- `KitDesign` ganha `bodyLayers: { template, color, params }[]` (cor já resolvida, params por `resolveParams`), separado de `body: KitFill`. Assim as mangas `match-body` continuam reusando `body`, sem camadas.
- `fillSvg(fill, width, height, layers = [])` desenha as camadas depois do padrão principal, no mesmo `clipPath`; o renderer 2D passa `bodyLayers` só no corpo.
- Kit sem `layers` gera SVG e PNG idênticos aos de antes.
- `kitDetails` do contact sheet lista as camadas.

## 8. Testes

- Pixel genérico, por padrão `layerable`: nenhum pixel pintado cai em `LOGO_BOXES`, nos extremos de cada parâmetro; a camada cobre menos de 15% do tronco; o `colorAt` espelha o `render()` (o teste genérico existente já cobre, porque todo template está no registry).
- Padrões principais novos: `colorAt` espelha `render()` (teste de pixel genérico existente), overlay abaixo de metade do tronco.
- Schema: `layers` opcional, máximo 2, cor e id válidos; `kit.json` antigo continua passando.
- Cada regra nova de `validateKit` (seção 4) com um caso de erro; tradições com camadas.
- Generator: a guarda `Phase 3b baseline` do clube sem categorias e a de SVG inalteradas (a do clube `branded`, `modern`, muda de propósito, como na 4a); determinismo por seed; propriedade em milhares de kits: camada nunca repete `base`/`overlay`, nunca repete id nem região, `layer-logo-overlap` nunca ocorre.
- Perfis: todo id de `layerWeights` existe no registry e é `layerable`; nenhum perfil põe `layerable` em `patternWeights`; todo perfil fora o `classic` tem peso positivo em 1 camada; `classic` tem só `{ 0: 1 }` e gera sempre 0 camadas.
- Renderer: PNG sem camadas idêntico ao de antes; PNG com camada tem a cor da camada no centro de um pixel esperado.

## 9. Ordem de entrega

Os perfis só podem citar padrões registrados, então os padrões vêm antes das tabelas de camada:

1. `layerSlot`, os 8 padrões de camada e os 2 degradês (com os pesos deles em `patternWeights`).
2. Schema, validação, `kitDesign` e renderer de camadas.
3. Perfis (contagem, `layerWeights`, médias) e generator.
4. Contact sheet, docs (`CLAUDE.md`, roadmap) e inspeção visual dos PNGs.

## 10. Riscos

- Combinação feia: contida por `layerable` (só padrões finos), máximo de 2 camadas, `layerWeights` por perfil, ids distintos e uma camada por região. Revisão visual pelo `preview --samples 24` na etapa 4.
- Seeds de clubes com `categories` mudam de novo (documentado, seção 5.2).
- No 3D (3c), camadas serão desenhadas por ilha da UV; linhas e degradês não continuam entre frente, costas e mangas.
