# Fase 4e — Acabamentos do calção e das meias, a partir das máscaras do FM26

**Data:** 2026-11-15
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 4, item 3, "padrões por máscara FM26"), spec da 4c (`docs/superpowers/specs/2026-10-14-fase-4c-componentes-3d-design.md`, de onde vem o modelo de estilo + cor da listra de acabamento) e spec da 4d (`docs/superpowers/specs/2026-11-14-fase-4d-fabric-mesh-design.md`, canelado das meias e do cós).

## 1. Objetivo

O calção e as meias, que saíam lisos em toda textura 3D, ganham os acabamentos que as máscaras dos kits procedurais do FM26 desenham nessas peças: listra lateral e barra no calção, dobra do cano e aros nas meias. O acabamento é sorteado por kit, pelos perfis de estilo, e vai para o `kit.json`.

Critério de sucesso:

- Clube com `style.categories` ganha `shorts.trim` e `socks.trim` num novo `generate`; o resto do kit fica igual para a mesma seed.
- Clube sem categorias (perfil `classic`) e os `kit.json` já salvos não mudam.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes; texturas 3D inspecionadas visualmente.
- No jogo, os itens da seção 8 conferem.

## 2. Abordagens e escopo

O item do roadmap era avaliar as máscaras RGB do FM (`docs/fm_templates/FM26 3D Assets/NN-V.png`) como templates de padrão. A avaliação, com as 58 máscaras lado a lado nas três variantes:

- Cerca de metade dos desenhos de tronco já existe no gerador de forma paramétrica: listras (03, 37, 41), faixas horizontais (13, 44, 49), diagonal (08, 20, 38), chevron (29, 52), xadrez (07), faixa central (09, 16–18), risca fina (12, 55).
- O que as máscaras têm e o gerador não tinha: desenho no calção e nas meias; desenho próprio de manga (faixas, xadrez); padrões de tronco com três cores (22–24, 31–33, 53–56); painéis assimétricos (26–28, 43).
- As variantes tratam das costas: `-0` é o desenho inteiro, `-1` abre um painel liso para o número e `-2` deixa as costas lisas.
- `04-0`, `03-1` e `03-2` não abrem como imagem.

Abordagens consideradas:

1. **Recolorir os bitmaps** (vermelho/verde/azul → cores do kit), com a máscara inteira no 3D e uma projeção no 2D. Entrega os 58 desenhos de uma vez, mas: os bitmaps não têm parâmetros nem `colorAt`, então ficam fora das regras de cobertura, das camadas e da borda dos logos; a gola e os punhos das máscaras (anel e barras fixos) conflitam com as golas e os cortes da 4a e da 4c; a projeção para o 2D perde as mangas; metade repete o que já existe; e os arquivos são do jogo, hoje só em `docs/fm_templates/`, fora do runtime.
2. **Desenhar no sistema que já existe só o que falta**, usando as máscaras como medida, como a 4c e a 4d fizeram com o PSD. **Escolhida.**
3. Não fazer nada com as máscaras. Deixa o calção e as meias lisos, a maior diferença visível para os kits do próprio jogo.

Dentro desta fase: acabamentos do calção e das meias (as duas peças que não tinham desenho nenhum).

Fora, por decisão explícita:

- Desenho próprio de manga, padrões de tronco com três cores, painéis assimétricos e painel liso do número nas costas. Candidatos a fases seguintes.
- Os outros desenhos de calção e meia das máscaras: calção com painel de cima (06, 07), listras verticais (08) e faixas horizontais (09); meia com faixa no meio da canela (06, 11–13, 55), listras verticais (03, 14, 16), xadrez (15) e bloco de cima (02).
- Acabamento de duas cores na mesma peça (12, 13, 55).
- Calção e meias no PNG 2D e no PNG do `preview`: o 2D continua mostrando só a camisa.
- Override por clube no `club.json`: como gola, manga e listra, os pesos vêm só dos perfis.

## 3. Medições das máscaras

Método: um script descartável, fora do repositório, lê a máscara com `sharp`, separa por canal (verde > 128 = cor 2) e imprime a caixa de cada componente conexo dentro das ilhas do calção e das meias. As bordas das máscaras têm antialias, então cada medida vale ± 1 px.

Orientação das ilhas, pelas máscaras e pelo canelado da 4d:

- **Meias** (ilhas x 6–235 e 789–1018, y 432–~702): o comprimento corre em y, com o cano em cima (a primeira zona do canelado, y 433–486, é a dobra). Faixa horizontal na textura dá a volta na perna. O outro lado é o mesmo desenho deslocado em x.
- **Calção** (ilhas x 7–349 e 679–1019, y 773–1016): o cós fica em cima (canelado em y 775–800) e a barra da perna embaixo. Cada ilha é uma perna, com as metades B/F lado a lado; a divisa entre elas, no meio da ilha, é a costura de fora da perna.

| Estilo | Máscara | Medida (px, textura 1024) | Guardado |
|---|---|---|---|
| `side-stripe` | 02 | x 156–182 e 844–870, y 773–1016 | mesmos x; y de borda a borda da região |
| `side-piping` | 03 | x 165–175 e 851–861, y 773–1016 | mesmos x; y de borda a borda da região |
| `hem-band` | 57 (e 10) | y 992–1013 (na 10, y 998–1016), largura da ilha | y 992 até a borda de baixo da região |
| `turnover` | 07, 58 | y 432–487, largura da ilha | borda de cima da região até y 486 |
| `top-hoops` | 08 | y 464–476 e 490–503 | iguais |
| `hoops` | 10 | y 455–500, 545–590 e 634–680 | iguais |

Decisões sobre as medidas:

- As faixas de lado a lado usam a largura do retângulo da região no layout (com a sobra), não a da ilha: o jogo pode amostrar além da ilha, e o fundo da região já é pintado assim.
- A listra lateral não é espelho nem deslocamento exato entre os lados (156–182 contra 844–870), então os dois x ficam guardados como medidos.
- A `hem-band` vai até a borda de baixo, como na máscara 10: parar em 1013, como na 57, deixaria um filete da cor do calção na barra.
- A `turnover` termina em 486, e não em 487: assim cobre exatamente a primeira zona do canelado, e a zona seguinte não começa com uma linha da cor da dobra.

## 4. Dados e schema

`src/core/kit.ts`:

- `SHORTS_TRIM_STYLES = ["side-stripe", "side-piping", "hem-band"]` e `SOCKS_TRIM_STYLES = ["turnover", "top-hoops", "hoops"]`.
- `shorts` e `socks` ganham `trim` opcional: `{ style, color }`, com `color` um papel de cor. Ausente = peça lisa, então os `kit.json` de antes da 4e continuam válidos. Chave desconhecida dentro de `trim` é erro, como no resto do schema.

`src/fm26/trims.ts`: `FM26_SHORTS_TRIMS` e `FM26_SOCKS_TRIMS`, um conjunto de retângulos por estilo e por lado do jogador (`TRIM_SIDES`: `right`, `left`), em fração da textura. Geometria fixa por estilo, sem parâmetros.

`src/core/validation.ts`: `validateKit` ganha `shorts-trim-color` e `socks-trim-color` (acabamento na cor da própria peça não aparece). As tradições não mudam: `visibleRoles` e `required-color` contam só o que aparece na camisa.

## 5. Sorteio

`src/styles/profiles.ts`: cada perfil ganha `shortsTrimWeights` e `socksTrimWeights`, com chaves de `SHORTS_TRIM_OPTIONS` e `SOCKS_TRIM_OPTIONS` (`none` mais os estilos).

| Perfil | Calção (`none` / `side-stripe` / `side-piping` / `hem-band`) | Meias (`none` / `turnover` / `top-hoops` / `hoops`) |
|---|---|---|
| `classic` | 1 / – / – / – | 1 / – / – / – |
| `traditional` | 55 / 20 / 10 / 15 | 40 / 35 / 15 / 10 |
| `modern` | 50 / 15 / 25 / 10 | 60 / 20 / 15 / 5 |
| `retro` | 40 / 30 / 10 / 20 | 25 / 30 / 20 / 25 |

`src/styles/component-weights.ts`: `shortsTrimCandidates` e `socksTrimCandidates`, na ordem das opções.

`src/generator/kit-generator.ts`: os dois sorteios entram depois da listra, primeiro o calção e depois as meias. Para cada peça: `rng.weighted` do estilo e, se não sair `none`, `rng.pick` da cor entre os dois papéis que a peça não usa. Por serem os últimos, nada anterior se desloca: tirando `trim`, os conjuntos do clube `branded` batem com o hash de antes da 4e (há teste). `classic` sorteia sempre `none`.

## 6. Desenho (`src/renderers`)

- `kit-design.ts`: `KitDesign` ganha `shortsTrim` e `socksTrim` (estilo e cor resolvida), ausentes sem acabamento.
- `renderer-3d.ts`: a região do calção ou da meia é o retângulo liso com os retângulos do acabamento por cima, antes da trama e do canelado. O canelado continua por cima de tudo na peça.
- Tom do canelado: uma zona inteiramente coberta por um acabamento usa o tom da cor do acabamento (é o caso da `turnover` na primeira zona das meias); as outras ficam com o tom da peça. Nos aros e na listra lateral, que cobrem só parte de uma zona, o canelado pode sumir sobre o acabamento (preto sobre escuro ou branco sobre claro), mas nunca fica no tom errado para a peça.
- Renderer 2D, `generate` e o PNG do `preview`: sem mudança. A legenda do `preview` (`kitDetails`) ganha as linhas `shorts <estilo> · <papel>` e `socks <estilo> · <papel>`.

## 7. Testes

- `tests/fm26/trims.test.ts`: retângulos em pixels iguais aos da seção 3; todos dentro da região da peça e do lado; e, contra a máscara de origem, o centro de cada retângulo é cor 2, um pixel para dentro de cada borda interna ainda é cor 2 e dois para fora já é a base.
- Schema, validação, perfis e candidatos: aceitam cada estilo, recusam estilo, cor e chave desconhecidos, `classic` só `none`.
- Generator: `classic` nunca sorteia; `retro` sorteia todos os estilos, nunca na cor da peça, usando as duas cores livres; guardas de hash (seção 5).
- Renderer 3D: pixel exato no calção fora do cós; dentro do desvio do canelado nas meias; a dobra com o canelado no tom dela; o acabamento de uma peça não muda nenhum pixel fora dela.

## 8. Teste no jogo

Os kits versionados só ganham os acabamentos com um novo `generate` de cada clube com a seed salva (`generatedWith.seed`); a simulação em 2026-11-15 mostrou que, para os 48 kits, só `shorts.trim` e `socks.trim` mudam (34 arquivos). Depois, `npm run export` e copiar o pacote. Conferir:

1. Listra lateral e filete: na costura de fora de cada perna, da cintura à barra, nos dois lados.
2. Barra do calção: na ponta da perna, dando a volta inteira.
3. Dobra: no alto da meia, com o canelado visível; aros dando a volta na perna, sem emenda visível atrás.
4. Meia e calção sem acabamento continuam como na 4d.

## 9. Riscos

- A orientação das metades B/F do calção e das meias nunca foi vista no jogo (roadmap, "Calibração da UV"). Os acabamentos desta fase não dependem dela: as faixas dão a volta inteira e a listra lateral fica na divisa das metades. Se a listra aparecer na parte de dentro da perna, a divisa é a costura de dentro, e a correção é mover a listra para as bordas da ilha.
- O jogo pode cobrir a parte de baixo da meia com a chuteira; o terceiro aro de `hoops` (y 634–680) pode ficar parcialmente escondido.
