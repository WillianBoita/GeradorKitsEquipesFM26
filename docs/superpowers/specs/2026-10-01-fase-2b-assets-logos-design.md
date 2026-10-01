# Fase 2b — Assets, escudo, patrocinadores e fabricantes

**Data:** 2026-10-01
**Specs de origem:** `fm26-procedural-kit-generator-guide.md` (seções 4, 5, 7, 10, 11, 12, 13), `fm26-kit-export-and-integration.md` (seção 3, `clubs/<id>/logo.png`) e roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 2, itens 2, 3 e 4; pendência "retry de geração por kit").

## 1. Objetivo

O PNG 2D de cada kit passa a ter escudo do clube, patrocinador e fabricante. Os logos vêm de arquivos fornecidos pelo usuário, registrados por ID. Patrocinador e fabricante são sorteados por conjunto a partir de pools ponderados no `club.json`, recoloridos como silhueta numa cor legível sobre o fundo da camisa e, quando nenhuma cor única basta, ganham contorno. A escolha fica gravada no `kit.json`, que continua renderizável sem aleatoriedade.

Critério de sucesso:

- `kit-generator generate --club galaticos-fc --seed 42` grava os três `kit.json` e os três PNGs com escudo, patrocinador e fabricante legíveis, conferidos visualmente.
- O desenho dos três kits (paleta, padrão, parâmetros, gola, mangas, calção, meias) é idêntico ao da Fase 2a para a seed 42; o `kit.json` só ganha `badge`, `sponsor` e `manufacturer`.
- `kit-generator validate --all` termina com exit code 0.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes.

## 2. Escopo

Dentro: registry de assets, pools no `club.json`, campos de logo no `kit.json`, `colorAt` nos padrões, escolha de cor e contorno, composição no renderer 2D, regras de validação de assets e contraste, opções `--assets` e `--clubs` na CLI, assets de amostra e documentação.

Fora, por decisão explícita:

- **Retry de geração por kit.** Desnecessário: o par branco + preto sempre resolve o contraste (seção 5.4), então nenhuma regra de kit falha com paleta válida. Volta só se surgir uma regra que possa falhar.
- **Campos do guia `allowedPositions`, `preferredColors` e `minContrast` por asset.** O 2D tem uma única posição por logo e um único limite de contraste. Ficam para a Fase 4 se houver demanda.
- **Contraste do escudo.** O escudo mantém as cores originais e normalmente traz contorno próprio; não passa pela regra de contraste.
- **Logos em mangas e calção, nome e número.** Fora da 2b.
- **Posição dos logos na textura 3D.** Vem do layout UV da Fase 3 (`front.sponsor`, `front.clubBadge`, `front.manufacturer`).
- **Checagem `opaque-logo` no `generate`.** Só o `validate` faz, porque exige ler pixels.
- **Flag `--size`.** Continua inexistente.

## 3. Modelo de dados

### 3.1 Registry: `assets/registry.json`

Substitui o `data/assets.json` previsto no roadmap. Com o registry dentro da pasta de assets, um único `--assets <dir>` aponta para registry e arquivos juntos, e os testes usam uma pasta temporária, como já fazem com `--clubs`.

```json
{
  "sponsors": [
    { "id": "luna-air", "name": "Luna Air", "file": "sponsors/luna-air.svg" },
    { "id": "orbita-bank", "name": "Órbita Bank", "file": "sponsors/orbita-bank.svg" }
  ],
  "manufacturers": [{ "id": "vertex", "name": "Vertex", "file": "manufacturers/vertex.svg" }]
}
```

- Schema estrito em `src/assets/registry.ts`. `sponsors` e `manufacturers` são obrigatórios (podem ser listas vazias).
- `id`: `AssetIdSchema`, mesma regra de `ClubIdSchema` (`^[a-z0-9][a-z0-9-]*$`); único dentro de cada categoria (ID repetido é erro de schema).
- `name`: string não vazia; só para mensagens e documentação.
- `file`: caminho relativo à pasta de assets, com `/` como separador, terminando em `.png` ou `.svg`. Rejeitados: caminho absoluto, segmento `..`, segmento vazio. Assim nenhum asset escapa da pasta.
- SVG com `<text>` depende das fontes instaladas e quebra a reprodutibilidade entre máquinas; o README pede texto convertido em curvas.

API de `src/assets/registry.ts`:

```ts
export interface AssetEntry { id: string; name: string; file: string }
export interface AssetRegistry { sponsors: AssetEntry[]; manufacturers: AssetEntry[] }
export type AssetKind = "sponsor" | "manufacturer";

export async function loadAssetRegistry(assetsDir: string): Promise<AssetRegistry>;
export function findAsset(registry: AssetRegistry, kind: AssetKind, id: string): AssetEntry | undefined;
export function getAsset(registry: AssetRegistry, kind: AssetKind, id: string): AssetEntry; // erro listando os IDs conhecidos
export function assetFilePath(assetsDir: string, entry: AssetEntry): string;
```

- `loadAssetRegistry` lê `<assetsDir>/registry.json`. Arquivo ausente: `Asset registry not found: <arquivo>`. Schema inválido: `Invalid asset registry in <arquivo>:` seguido do erro do Zod.
- `getAsset` com ID desconhecido: `Unknown sponsor "acme" (known: luna-air, orbita-bank)`; com categoria vazia, `(known: none)`.
- `assetFilePath` é o único lugar que monta caminho de asset de patrocinador ou fabricante.

`src/config/paths.ts` ganha `ASSETS_DIR = <projeto>/assets`, padrão do `--assets`.

### 3.2 Escudo: `clubs/<id>/logo.png`

- Por convenção, sem entrada no registry. `clubLogoPath(clubId, clubsDir)` em `src/io/club-repository.ts` monta o caminho, ao lado de `club.json` e `kits/`.
- Só PNG.
- Opcional: clube sem `logo.png` gera kits sem escudo.

### 3.3 `ClubIdentity`

Dois pools opcionais no topo do `club.json`, com o mesmo schema de peso de `patternWeights` (`0..1_000_000`):

```json
"sponsors": { "luna-air": 3, "orbita-bank": 1 },
"manufacturers": { "vertex": 1 }
```

- Sem pool: kits sem patrocinador (ou sem fabricante).
- Chaves validadas com `AssetIdSchema`.
- O sorteio percorre as chaves em ordem alfabética, então reordenar o JSON não muda o resultado de uma seed.

### 3.4 `KitDefinition`

Três campos opcionais no fim do schema, nesta ordem:

```ts
const LogoColorSchema = z.union([ColorRoleSchema, HexColorSchema]);
const BrandLogoSchema = z.strictObject({ id: AssetIdSchema, color: LogoColorSchema, outline: LogoColorSchema.optional() });

badge: z.boolean().optional(),
sponsor: BrandLogoSchema.optional(),
manufacturer: BrandLogoSchema.optional(),
```

- `color` e `outline` aceitam papel da paleta (`"accent"`) ou hex (`"#ffffff"`). O generator grava papel quando a cor vem da paleta e hex quando é branco ou preto. Editar a paleta à mão propaga para logos com papel.
- `badge: true` desenha o escudo; ausente ou `false`, não. O generator só grava `true`, e só quando `logo.png` existe no momento do `generate`.
- `outline` só existe quando nenhuma cor única passa no contraste.
- Kits da Fase 2a (sem esses campos) continuam válidos.
- `resolveLogoColor(kit, value)` em `src/core/kit.ts` converte papel ou hex no hex final.

Exemplo de trecho gerado:

```json
"badge": true,
"sponsor": { "id": "luna-air", "color": "primary", "outline": "secondary" },
"manufacturer": { "id": "vertex", "color": "#000000" }
```

### 3.5 Caixas dos logos

Em `src/renderers/shirt-2d-shape.ts`, no viewBox 414, com `LogoSlot = "badge" | "sponsor" | "manufacturer"`:

| Slot | Centro | Caixa (L×A) | Posição |
|---|---|---|---|
| `badge` | (250, 120) | 36×36 | peito esquerdo do jogador (direita de quem olha) |
| `manufacturer` | (164, 120) | 30×30 | peito direito do jogador |
| `sponsor` | (207, 205) | 124×48 | centro do peito |

As três caixas ficam dentro do tronco e abaixo das duas golas (o fundo da gola `v-neck` está em y = 100). Um teste garante isso.

## 4. Padrões: `colorAt`

`PatternTemplate` ganha um método que espelha o `render()`:

```ts
export interface PatternGeometry {
  width: number;
  height: number;
  params: Record<string, number>;
}

colorAt(x: number, y: number, geometry: PatternGeometry): "base" | "overlay";
```

- `solid`: sempre `"base"`.
- `stripes`: `"overlay"` quando `x` cai dentro de uma listra (`period = width / count`, listra em `[i·period + offset, i·period + offset + stripeWidth]`).
- `sash`: `"overlay"` quando a distância do ponto à diagonal que passa pelo centro do canvas é ≤ `width / 2` do parâmetro; direção 0 desce para a direita (rotação 45°), direção 1 sobe para a direita (−45°).
- `params` chegam já resolvidos por `resolveParams`.
- Contrato: todo padrão novo implementa `colorAt` coerente com `render`. O teste genérico de padrões renderiza cada padrão e confere, pixel a pixel numa grade, que a cor bate com `colorAt` nos pontos longe de bordas.

## 5. Geração

### 5.1 Fluxo de `generateKitSet(identity, seed, options)`

```ts
export interface KitSetOptions { badge?: boolean }
export function generateKitSet(identity: ClubIdentity, seed: number, options: KitSetOptions = {}): KitSet;
```

1. `validateClub(identity)`, como hoje (agora inclui `no-asset-weight`).
2. `generatePalette(identity, seed)`, como hoje.
3. Patrocinador: se houver pool, `pickAsset(identity.sponsors, createRng(deriveSeed(seed, "sponsor")))`. Fabricante: idem com `"manufacturer"`. Um de cada por conjunto: Home, Away e Third compartilham patrocinador e fabricante; só as cores mudam.
4. Para cada tipo: `generateKit(identity, kitType, palette, seed)` exatamente como na 2a, e depois `withLogos(kit, { badge, sponsorId, manufacturerId })`, que acrescenta `badge`, `sponsor` e `manufacturer` com as cores da seção 5.3.

O generator não conhece o registry: confia nos IDs dos pools. Quem chama (`generate` na CLI) roda `validateClubAssets` antes.

### 5.2 Reprodutibilidade

- `generateKit` e a ordem das chamadas ao `rng` dentro dele não mudam. Patrocinador e fabricante usam RNGs próprios, derivados por rótulo; a escolha de cor não usa `rng`.
- Para a mesma seed, o desenho é idêntico ao da Fase 2a. Mudar um pool não altera o outro, nem a paleta, nem o desenho.
- Rótulos de `deriveSeed` em uso: `home`, `away`, `third`, `palette:<n>`, `sponsor`, `manufacturer` e, no `--all`, o `id` do clube.

### 5.3 Fundo e cor do logo

Módulo `src/core/logo-colors.ts`, puro e síncrono. `MIN_LOGO_CONTRAST = 3` (contraste WCAG 2.1 via `contrastRatio`, o mínimo da WCAG para elementos gráficos).

**Fundo:** `backgroundRoles(kit, slot)` amostra uma grade 24×24 de pontos (centro de cada célula) na caixa do slot, chama `colorAt` do padrão do kit e devolve os papéis com cobertura ≥ 5% (`MIN_BACKGROUND_SHARE = 0.05`), do mais coberto para o menos coberto. O primeiro é o papel dominante. Lascas abaixo de 5% são ignoradas.

**Candidatas**, nesta ordem: `primary`, `secondary`, `accent`, `#ffffff`, `#000000`. Não há deduplicação: quando a paleta já tem branco, o papel vem antes do hex em todos os passos, então o hex repetido nunca vence.

**Escolha** (`chooseLogoColors(colors, backgroundHexes)`, devolve `{ color, outline? }`):

1. **Cor única da paleta.** Score de uma candidata = menor contraste dela contra as cores do fundo. Entre os três papéis, vence o maior score, se for ≥ 3. Empate: ordem das candidatas.
2. **Branco ou preto.** Mesma regra entre `#ffffff` e `#000000`.
3. **Par com contorno.** Pares ordenados (`color`, `outline`) de candidatas diferentes. Um par é válido quando o contraste entre as duas é ≥ 3 e cada cor do fundo tem contraste ≥ 3 com `color` ou com `outline`. Entre os pares válidos, critérios em sequência:
   1. `color` da paleta antes de branco/preto;
   2. `outline` da paleta antes de branco/preto;
   3. maior contraste de `color` contra o fundo dominante (o logo se lê sobre a maior parte da caixa);
   4. ordem das candidatas (primeiro `color`, depois `outline`).

   Não há score contínuo no passo 3: os critérios 1 e 2 são discretos e o 3 compara cores diferentes, então o resultado não depende de empate exato entre floats.

O passo 3 sempre encontra solução (seção 5.4), então `chooseLogoColors` nunca devolve vazio para cores válidas. Se acontecer, `withLogos` lança erro interno.

Exemplos medidos com a paleta do galaticos (navy `#123456`, branco, ouro `#ffd700`):

| Contraste | Valor |
|---|---|
| ouro × branco | 1,40 |
| preto × navy | 1,65 |
| ouro × navy | 9,07 |
| navy × branco | 12,72 |
| preto × ouro | 14,97 |

| Fundo na caixa do patrocinador | Cobertura do overlay |
|---|---|
| `sash` largura 30 / 70 / 100 | 34% / 78% / 96% |
| `stripes` `ratio` 0,2 / 0,4 | 25% / 42% |

Home da seed 42 (navy com faixa branca de largura 86,7; branco dominante): nenhuma cor única passa. Pares válidos só com cores da paleta: (navy, branco), (branco, navy), (navy, ouro) e (ouro, navy). O critério 3 escolhe `color` navy (12,72 contra o branco, contra 1 do branco e 1,40 do ouro) e o 4 desempata o contorno: `color: "primary"`, `outline: "secondary"`. O navy se lê sobre a faixa branca; o contorno branco separa o logo do corpo navy.

### 5.4 Garantia por construção

Para qualquer cor de fundo, `max(contraste(branco, fundo), contraste(preto, fundo)) ≥ 4,58` (pior caso com luminância relativa ≈ 0,18), e branco × preto = 21. Logo o par branco/preto sempre passa no passo 3, todo kit gerado passa em `logo-contrast` e o retry por kit não tem o que resolver. Um teste de propriedade cobre muitas paletas e seeds.

## 6. Renderer 2D

### 6.1 API

```ts
export interface KitLogoImages {
  badge?: Buffer;
  sponsor?: Buffer;
  manufacturer?: Buffer;
}

export interface Render2dOptions {
  size?: number;
  logos?: KitLogoImages;
}
```

- `renderKit2dSvg(kit, options)` não muda: o SVG continua só com a camisa. Os testes atuais de SVG seguem válidos.
- `renderKit2dPng(kit, options)` rasteriza o SVG como hoje e, se o kit declara logos, compõe com `sharp.composite`.
- Kit sem `badge`, `sponsor` e `manufacturer` gera PNG byte a byte igual ao da Fase 2a.
- Kit que declara um logo sem o `Buffer` correspondente: erro `Kit declares a sponsor but no sponsor image was provided` (idem `badge` e `manufacturer`). Imagens a mais são ignoradas.

### 6.2 Composição

Para cada slot declarado (escudo, patrocinador, fabricante; as caixas não se sobrepõem, então a ordem não muda o resultado):

- Caixa em pixels = caixa do viewBox × `size / 414`, arredondada.
- O logo é redimensionado com `fit: "inside"` (sem distorção) e centralizado na caixa.
- SVG nunca é ampliado a partir de bitmap pequeno. O Sharp 0.35 já rasteriza o SVG direto no tamanho do `resize` (medido: um furo de 0,1 unidade num SVG de 6×2 continua com 2 px transparentes a 124 px de largura); um teste fixa esse comportamento, então não há cálculo de `density`.
- **Patrocinador e fabricante:** silhueta. O canal alfa do arquivo vira máscara de uma imagem sólida na cor `color` resolvida. Com `outline`, uma camada de contorno vai por baixo: o alfa dilatado (`sharp.dilate`) por `max(1, round(2 · size / 414))` px, na cor `outline`.
- **Escudo:** cores originais, sem recolorir.

O renderer recebe só `Buffer`s; nunca monta caminho nem lê disco.

## 7. Leitura de arquivos

`src/io/asset-repository.ts`:

```ts
export interface AssetDirs {
  assetsDir: string;
  clubsDir: string;
}

export interface AssetRefs {
  badge: boolean;
  sponsors: string[];
  manufacturers: string[];
}

export async function loadKitLogos(kit: KitDefinition, registry: AssetRegistry, dirs: AssetDirs): Promise<KitLogoImages>;
export async function checkAssetFiles(clubId: string, refs: AssetRefs, registry: AssetRegistry, dirs: AssetDirs): Promise<ValidationIssue[]>;
```

- `loadKitLogos` lê só o que o kit declara: `clubLogoPath` para `badge: true`; `assetFilePath` para `sponsor` e `manufacturer`.
- Arquivo ausente: `Sponsor "luna-air" file not found: <caminho>` (idem `Manufacturer`), e `Club "galaticos-fc" badge not found: <caminho>`.
- ID fora do registry: erro de `getAsset`.
- Arquivo que não é imagem (texto, PNG corrompido): `Invalid image file: <caminho>`. O Sharp sozinho só diria `Input buffer contains unsupported image format`, sem dizer qual arquivo.
- `checkAssetFiles` confere cada arquivo uma vez: o `validate` junta, sem repetição, os IDs dos pools e dos kits, e `badge` é verdadeiro se algum kit declara escudo. IDs fora do registry são pulados (a regra `unknown-asset` já os acusa). Devolve `missing-asset` e `opaque-logo`.

## 8. Validação

Novas regras, todas com o formato atual de `ValidationIssue`:

| Função | Regra | Quando falha |
|---|---|---|
| `validateClub(identity)` (pura) | `no-asset-weight` | pool `sponsors` ou `manufacturers` presente sem nenhum peso positivo |
| `validateClubAssets(identity, registry)` (pura) | `unknown-asset` | ID de pool ausente do registry |
| `validateKitAssets(kit, registry)` (pura) | `unknown-asset` | `sponsor.id` ou `manufacturer.id` ausente do registry |
| `validateKit(kit)` (pura) | `logo-contrast` | sem `outline`: contraste de `color` < 3 contra alguma cor do fundo; com `outline`: contraste `color` × `outline` < 3, ou alguma cor do fundo com contraste < 3 contra as duas |
| `checkAssetFiles` (I/O) | `missing-asset` | arquivo do registry inexistente para um ID usado, ou `badge: true` sem `logo.png` |
| | `opaque-logo` | patrocinador ou fabricante sem nenhum pixel transparente (canal alfa todo 255): viraria um retângulo sólido |
| | `invalid-file` | arquivo de logo (ou `logo.png`) existe mas não é imagem |

`logo-contrast` é pulada quando o padrão é desconhecido (sem `colorAt` não há fundo; `unknown-pattern` já acusa).

Exemplos de mensagem:

- `unknown-asset: sponsors references unknown sponsor "acme" (known: luna-air, orbita-bank)`
- `logo-contrast: home kit sponsor #ffd700 has contrast 1.40 against secondary #ffffff (minimum 3)` (o papel do fundo, como `backgroundRoles` devolve)
- `logo-contrast: home kit sponsor #123456 and its outline #000000 have contrast 1.65 (minimum 3)`
- `opaque-logo: sponsor "luna-air" (sponsors/luna-air.png) has no transparent pixels`

## 9. CLI

```
kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>] [--assets <dir>]
kit-generator render --definition <kit.json> --out <file.png> [--clubs <dir>] [--assets <dir>]
kit-generator validate (--club <id> | --all) [--clubs <dir>] [--assets <dir>]
```

`--assets` tem padrão `ASSETS_DIR`. Um valor informado é relativo ao diretório atual, como `--clubs`.

### 9.1 `generate`

- Carrega o registry uma vez, antes do laço de clubes. Erro no registry encerra o comando com `Error: ...`.
- Por clube, nesta ordem: loga `Seed: <n> (<id>)`; `loadClub`; `validateClubAssets` (issues viram `Club "<id>" is invalid:` + `formatIssues`); verifica se `clubLogoPath` existe; `generateKitSet(club, seed, { badge })`; para cada kit pedido, `loadKitLogos` e renderiza o PNG; só depois grava os `kit.json`.
- No `--all`, erro de asset de um clube vira `Error: [<id>] ...` e não interrompe os demais, como os outros erros.

### 9.2 `render`

Carrega o registry de `--assets`, lê os logos do kit com `loadKitLogos` (escudo via `--clubs`, pelo `clubId` do kit) e renderiza. Kit sem logos renderiza como na 2a, mas o registry precisa existir.

### 9.3 `validate`

Por clube, além do que já faz: `validateClubAssets`; para cada kit, `validateKitAssets`; por fim `checkAssetFiles` uma vez, com os IDs dos pools e dos kits. Registry ausente ou inválido vira issue `invalid-file` em cada clube, e as regras que dependem dele são puladas.

## 10. Assets de amostra

Criados nesta fase, fictícios, desenhados só com `path` (sem `<text>`), com transparência:

- `assets/sponsors/luna-air.svg`, `assets/sponsors/orbita-bank.svg`
- `assets/manufacturers/vertex.svg`
- `assets/registry.json` com os três
- `clubs/galaticos-fc/logo.png`: escudo colorido, rasterizado uma vez a partir de um SVG próprio (só o PNG é versionado)
- `clubs/galaticos-fc/club.json` ganha `"sponsors": { "luna-air": 3, "orbita-bank": 1 }` e `"manufacturers": { "vertex": 1 }`
- Os três kits do galaticos são regerados com seed 42

## 11. Testes

- **Registry:** carrega o válido; rejeita ID repetido, caminho absoluto, `..`, extensão errada e chave desconhecida; arquivo de registry ausente; `getAsset` com ID desconhecido lista os conhecidos; `assetFilePath`.
- **Schemas:** `club.json` com pools; pool com chave inválida; `kit.json` com `badge`, `sponsor` e `manufacturer`; cor por papel e por hex; kit da 2a continua válido.
- **Padrões:** `colorAt` × `render` por pixel em `solid`, `stripes` e `sash` (as duas direções).
- **Caixas:** dentro do tronco e abaixo das golas `round` e `v-neck`.
- **`backgroundRoles`:** `solid` só base; faixa larga com overlay dominante; lasca < 5% ignorada.
- **`chooseLogoColors`:** cor única da paleta; branco/preto; par com contorno (caso Home do galaticos: `primary` + `secondary`); critérios 1, 3 e 4 do passo 3 com casos próprios (o critério 2 raramente decide: como as condições do par são simétricas, um par válido com `color` neutra sempre tem o espelho com `color` da paleta, que o critério 1 já prefere); propriedade da seção 5.4 para paletas aleatórias.
- **Generator:** mesmo patrocinador e fabricante nos três kits; pool ausente gera kit sem o campo; `badge` segue a opção; ordem das chaves do pool não muda o sorteio; desenho idêntico ao da 2a para a mesma seed; todo kit gerado passa em `validateKit`.
- **Validação:** cada regra nova com caso que passa e caso que falha.
- **Asset repository:** `loadKitLogos` lê só o declarado; mensagens de arquivo ausente; `checkAssetFiles` acusa `missing-asset` e `opaque-logo` uma vez por arquivo e pula IDs fora do registry.
- **Renderer:** pixel do patrocinador na cor `color`; pixel do contorno na cor `outline`; escudo com a cor original; kit da 2a byte a byte igual; erro de `Buffer` ausente; reprodutibilidade byte a byte com logos.
- **CLI:** `generate` com logos (fixtures de assets em pasta temporária via `--assets`); `--all` com um clube de asset inválido sem interromper os outros; `render` com `--clubs` e `--assets`; `validate` com cada regra nova.

Fixtures novas em `tests/fixtures/`: pasta de assets temporária com registry e logos pequenos (PNG gerado por Sharp e SVG só com `path`).

## 12. Documentação

Ao final: `README.md` (registry, pools, `logo.png`, campos de logo no `kit.json`, `--assets`, regras novas do `validate`, aviso sobre `<text>` em SVG), `CLAUDE.md` (estado da fase, `src/assets`, `asset-repository`, contrato de `colorAt`, `logo-colors`, rótulos de `deriveSeed`) e roadmap (status da 2b, registry em `assets/registry.json` em vez de `data/assets.json`, retry por kit descartado e por quê).
