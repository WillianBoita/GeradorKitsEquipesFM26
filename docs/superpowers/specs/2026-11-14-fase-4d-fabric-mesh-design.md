# Fase 4d — Trama do tecido e canelado na textura 3D

**Data:** 2026-11-14
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 4, item 2, e "Limitações atuais"), spec da 3c (`docs/superpowers/specs/2026-10-07-fase-3c-renderer-3d-design.md`) e spec da 4c (`docs/superpowers/specs/2026-10-14-fase-4c-componentes-3d-design.md`, de onde vêm o método de medição do PSD e a pilha de desenho do renderer 3D).

## 1. Objetivo

A textura 3D ganha o acabamento de tecido do template do FM26, para o kit parecer menos chapado no jogo: a trama (`fabric texture`) na camisa e o canelado (`mesh`) nas meias e no cós do calção. O acabamento é do tecido, não do desenho do kit: vale para todos os kits, sem sorteio e sem campo no `kit.json`.

Critério de sucesso:

- `npm run export`, sem regerar kits, grava as texturas 3D de todos os clubes com a trama e o canelado.
- Nenhum `kit.json`, PNG 2D, `preview` ou guarda de seed muda.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes; texturas 3D inspecionadas visualmente (camisa clara e escura, meia clara e escura).
- No jogo, os itens da seção 9 conferem.

## 2. Escopo

Dentro:

- Trama na camisa: frente, costas, barras, manga curta e manga comprida (seções 3 a 6).
- Canelado nas meias e no cós do calção, em preto ou branco conforme a cor da peça (seções 3 a 6).

Fora, por decisão explícita:

- Costuras da camisa e do calção (`lines I shirt`, `lines I shorts`) e contorno e sombra das golas (camadas `lines` e `shadow`). Ficam para uma fase seguinte, depois do teste da 4d no jogo.
- Flag ou opção para desligar o acabamento, na API ou na CLI.
- Acabamento por kit: nada vai para o `kit.json` e os perfis não ganham pesos.
- Trama clara para camisa escura. O PSD só tem a trama preta (seção 10).
- Trama ou canelado no PNG 2D.
- Padrões por máscara FM26 (Fase 4e).

## 3. Medições do PSD

### 3.1 Método

As camadas saem do `docs/fm_templates/blank_26_3d.psd` por um script descartável, fora do repositório. Nesta máquina não há Python, então o script usa Node com `ag-psd` (leitura do PSD sem canvas, `useImageData`) e `sharp`. O método fica registrado para refazer a medição:

- Camada extraída como alfa em 1024×1024, na posição que ocupa no documento. As três camadas têm uma cor só (preto ou branco); o desenho está todo no alfa.
- Período: menor deslocamento `(dx, dy)` que reproduz a camada numa janela interna.
- Bloco: moda do alfa por célula do período, ancorado no canto superior esquerdo da zona (ou na origem da textura, para a trama).
- Alfa guardado como um dígito hex por pixel (alfa = dígito × 17). A trama é binária, então fica exata. No canelado, o arredondamento erra o alfa em até 8 níveis de 255, o que muda a cor final em menos de 1 nível.
- Conferência: a zona reconstruída pelo bloco é comparada com a camada, pixel a pixel.

### 3.2 Grupo `texture` do PSD

| Camada | Cor | Opacidade | Visível | Onde |
|---|---|---|---|---|
| `fabric texture` | preto | 10/255 (≈ 4%) | sim | camisa: coluna do tronco, asas e cantos das mangas |
| `mesh black` | preto | 31/255 (≈ 12%) | sim | meias e cós do calção |
| `mesh white` | branco | 31/255 (≈ 12%) | não | meias e cós do calção |

Todas com mistura `normal`. Na pilha do PSD, de cima para baixo: `collars`, `logos`, `lines`, `sleeve end` (punhos), `texture`, `sleeves lines` (costuras das mangas), `shirt`, `shorts`, `socks`. O acabamento cobre o desenho da camisa, do calção e das meias e as costuras da raglan, e fica abaixo de punhos, gola e logos.

### 3.3 Trama

Bloco de 18×18 px, binário, que se repete a partir da origem da textura: o pixel `(x, y)` usa a célula `(x mod 18, y mod 18)`. O desenho cobre 1/3 da área (6 pixels por linha).

```
f0000f0ff000000ff0
f0ff000000ff0f0000
00000ff0f0000f0ff0
ff0f0000f0ff000000
000f0ff000000ff0f0
ff000000ff0f0000f0
000ff0f0000f0ff000
0f0000f0ff000000ff
0f0ff000000ff0f000
000000ff0f0000f0ff
0ff0f0000f0ff00000
0000f0ff000000ff0f
0ff000000ff0f0000f
0000ff0f0000f0ff00
f0f0000f0ff000000f
00f0ff000000ff0f00
f000000ff0f0000f0f
00ff0f0000f0ff0000
```

Conferência contra a camada: nenhum pixel diferente no tronco (x 362–665, y 140–1000; 260.580 pixels) nem na asa esquerda; 14 a 31 pixels diferentes por ilha nas outras, todos nas bordas irregulares da camada, que não são copiadas (seção 5.1).

### 3.4 Canelado

Quatro zonas por lado. Os retângulos são do lado esquerdo da textura (direito do jogador), em pixels, intervalo semiaberto; o outro lado é uma translação em x, não um espelho. Cada bloco é ancorado no canto superior esquerdo do seu retângulo.

| Zona | Peça | Retângulo (esquerda) | Translação do outro lado | Bloco |
|---|---|---|---|---|
| `sockTop` | meia | x 7–234, y 433–486 | +783 | 7×1 |
| `sockMid` | meia | x 7–234, y 486–630 | +783 | 8×6 |
| `sockBase` | meia | x 7–234, y 630–702 | +783 | 7×1 |
| `waist` | calção | x 4–349, y 775–800 | +676, cortado em x = 1024 | 5×25 |

Blocos do `mesh black`:

```
sockTop:   9f03d30
sockMid:   0ff0ff00
           00f0f000
           00f0f00f
           f0f0f0ff
           00f0f00f
           00f0f000
sockBase:  309f03d
waist:     09f80
           09f90  × 2
           3afa3
           cefec
           1afa1
           09f90
           3afa3
           cefec
           1afa1
           09f90  × 10
           3afa3
           cefec
           1afa1
           08f70
           02510
```

Blocos do `mesh white`:

```
sockTop:   00f0063
sockMid:   000f0000
           000f0ff0
           000f0f00
           000f0f00
           ff0f0f00
           f00f0f00
sockBase:  6300f00
waist:     00000
           00008
           00009
           00004
           00000
           9000b
           1000a
           00004
           00000
           9000b
           1000a
           00009  × 9
           00004
           00000
           9000b
           1001a
           00000
```

Conferência contra as camadas, nos dois lados:

- `mesh black`: `sockTop`, `sockMid` e `waist` (lado esquerdo) sem nenhum pixel fora do arredondamento.
- `sockBase`, nos dois tons: cerca de 11% dos pixels diferem, todos depois de uma emenda de colagem do PSD perto da borda direita (um passo de 6 px no meio das listras de 7 px). O bloco regular não copia a emenda.
- `mesh white`: `sockTop` difere em 0,9% (outra emenda); `sockMid`, só na linha y 486, que no PSD é uma linha de transição irregular e aqui recebe o bloco.
- `waist` do lado direito: o PSD começa uma linha abaixo (y 776); aqui os dois lados usam o desenho do esquerdo.
- A coluna x = 3 do cós fica fora da região do calção do layout (x 4–351) e não é desenhada.

As zonas ficam dentro das regiões do layout: meias em x 3–237 e 786–1020, y 430–716; calção em x 4–351 e 676–1024, y 774–1018. A ponta da meia abaixo de y 702 e o calção abaixo de y 800 ficam lisos, como no PSD.

## 4. Dados (`src/fm26/fabric.ts`)

Módulo novo, só dados, no molde de `collars.ts`:

- `AlphaTile`: `width`, `height` e `rows`, uma string por linha com um dígito hex por pixel.
- `MeshTone`: `"black" | "white"`.
- `FM26_FABRIC`: `opacity` (10/255) e `tile` (seção 3.3).
- `FM26_MESH`: `opacity` (31/255) e `zones`; cada zona tem a peça (`sock` ou `shorts`), os dois retângulos (`UvRect`, pelo `rect()` do layout) e um bloco por tom (seção 3.4).

Os blocos ficam em pixels da textura de 1024, como os pontos das golas. As linhas repetidas do cós são escritas uma vez e repetidas no código.

## 5. Desenho

### 5.1 `src/renderers/fabric-finish.ts`

Módulo puro, no molde de `trim-stripes.ts`:

- `tilePatternSvg(id, tile, origin, color)`: devolve um `<pattern>` com `patternUnits="userSpaceOnUse"`, do tamanho do bloco, ancorado em `origin`, com `shape-rendering="crispEdges"`. Dentro dele, um `<rect>` de 1 px de altura por sequência de pixels com o mesmo dígito, na cor `color`; dígito abaixo de `f` vira `fill-opacity` (dígito / 15), e dígito `0` não gera nada.
- `meshTone(color)`: `black` ou `white`, o de maior `contrastRatio` com a cor da peça; no empate, `black`, que é o visível no PSD.

Um teste descartável confirmou que o `<pattern>` rasterizado pelo Sharp do projeto (0.35.5, librsvg 2.63.2) reproduz o bloco da trama sem nenhum pixel diferente e sem alfa intermediário, em 1024 e em 2048.

### 5.2 Renderer 3D (`src/renderers/renderer-3d.ts`)

A ordem do SVG passa a seguir a pilha do PSD (seção 3.2). O que é novo está em negrito:

1. Fundo, tronco com as camadas, raglan, mangas, calção e meias.
2. Costuras da raglan.
3. **Trama:** preto com `fill-opacity` de `FM26_FABRIC.opacity`, recortada pela união das regiões da camisa do layout: frente e costas com as barras (`rect` e `hem`), manga curta pelo `outline` (até a cava) e manga comprida pelo `rect`.
4. **Canelado:** para cada zona, os dois retângulos preenchidos pelo bloco do tom, com `fill-opacity` de `FM26_MESH.opacity`. O tom das zonas de meia sai de `meshTone(design.socks)`; o do cós, de `meshTone(design.shorts)`.
5. Punhos e gola.
6. Logos, compostos por cima do PNG, como hoje.

Consequências:

- Punhos, gola e logos ficam sem trama.
- A raglan fica dentro do tronco e recebe a trama.
- Fora das ilhas nada muda: o fundo continua liso na cor base do corpo.
- O recorte da trama é o das ilhas do layout, que têm sobra em relação ao PSD; as bordas irregulares da camada do PSD não são copiadas.
- A textura continua opaca.

`kitDesign` não muda: o tom do canelado é função pura de uma cor que ele já resolve.

## 6. O que não muda

- `kit.json`, schemas, generator, validação e pesos dos perfis. Nenhuma chamada nova ao `rng`.
- Renderer 2D, `preview` e as guardas `Phase 3b baseline`.
- CLI e estrutura do `export` (nomes, `config.xml`, tamanhos).
- `Render3dOptions`: continua com `size` e `logos`.

As texturas 3D de todos os kits mudam no próximo `npm run export`.

## 7. Testes

Espelhando `src/` em `tests/`:

- `fm26/fabric`:
  - todo bloco tem `height` linhas de `width` dígitos hex;
  - o bloco da trama é binário e cobre 1/3 das células;
  - cada zona do canelado tem os dois tons e os dois retângulos, dentro da região da sua peça no layout e da textura;
  - os retângulos de uma zona têm a mesma altura e o mesmo y.
- `renderers/fabric-finish`:
  - `tilePatternSvg` junta pixels vizinhos de mesmo dígito num retângulo, omite o dígito `0` e põe `fill-opacity` só abaixo de `f`;
  - `meshTone` devolve `black` para branco e amarelo, `white` para preto e azul escuro.
- Renderer 3D:
  - trama exata: numa janela da frente de um kit liso, cada pixel é a cor base onde a célula do bloco é `0` e a cor base com `FM26_FABRIC.opacity` de preto onde é `f` (tolerância de 1 nível pelo arredondamento);
  - trama presente nas costas, nas barras, na manga curta e na manga comprida;
  - trama ausente em punhos, gola, calção, meias e fora das ilhas (igualdade exata com a cor da peça);
  - canelado preto sobre meia clara e branco sobre meia escura, nas zonas `sockTop`, `sockMid` e `sockBase`, dos dois lados;
  - cós com o tom da cor do calção, independente do tom da meia;
  - meia abaixo de y 702 e calção abaixo de y 800 lisos;
  - textura opaca, com 1024 px, e SVG determinístico e válido.
- Testes atuais do renderer 3D:
  - os que comparam, com igualdade exata, pixels de áreas que passam a ter acabamento aceitam o desvio máximo dele, calculado das constantes de opacidade (`Math.ceil(255 × opacity) + 1`: 11 na camisa, 32 nas zonas do canelado). As cores dos testes diferem em mais de 100 níveis, então a tolerância não esconde troca de cor;
  - os de punhos, gola, logos, calção (fora do cós) e fundo continuam com igualdade exata.

## 8. Ordem de entrega

1. `src/fm26/fabric.ts` com os blocos e as zonas, e os testes dos dados.
2. `src/renderers/fabric-finish.ts` e os testes.
3. Renderer 3D: trama, depois canelado; ajuste dos testes atuais de cor.
4. Inspeção visual das texturas, medição do tamanho dos PNGs, documentação.

## 9. Teste no jogo

`npm run export`, sem regerar, já grava as texturas novas. Conferir:

1. Trama visível na camisa de um kit claro, de perto (tela do kit ou replay aproximado).
2. Camisa escura: a trama preta praticamente não aparece (seção 10); registrar se faz falta.
3. Canelado preto em meia clara e branco em meia escura.
4. Faixa do cós no alto do calção.
5. Punhos, gola e logos limpos, sem trama por cima.
6. Sem cintilação da trama com a câmera de jogo, de longe.

## 10. Riscos

- **Trama fraca.** A 4% sobre 1/3 dos pixels, ela escurece a camisa em cerca de 1,3% na média e pode não aparecer no jogo. O ajuste é `FM26_FABRIC.opacity`.
- **Camisa escura.** Preto sobre cor escura quase não muda nada, e sobre preto não muda nada. O PSD só tem a trama preta; uma trama clara para kits escuros é decisão para depois do teste no jogo.
- **Cintilação.** Um desenho de 1 px pode cintilar de longe. O template do FM usa o mesmo desenho, então o esperado é que não, mas só o jogo confirma.
- **Tamanho dos PNGs.** A trama acrescenta detalhe de alta frequência. Numa estimativa com o Home e o Away do Galáticos, o PNG 3D foi de 54 para 67 KB e de 63 para 73 KB (cerca de 20% maior). A medição final entra no roadmap.
- **Outros tamanhos.** Fora de 1024 (`size` só existe na API), a trama e o canelado saem com antialias.
- **Emendas do PSD.** O canelado é regular; as emendas de colagem do PSD (seção 3.4) não são copiadas.
- **Dados derivados do template.** Os blocos são medidos nos assets do jogo/comunidade, como as golas e a cava da 4c. Vale a mesma ressalva do roadmap: conferir a licença antes de publicar o repositório.

## 11. Documentação

- Roadmap: status da 4d, tamanho medido dos PNGs, resultado do teste no jogo, "Limitações atuais" (a falta de `fabric`/`mesh` sai da lista; costuras e contorno e sombra de gola continuam) e o próximo passo.
- `CLAUDE.md`: `src/fm26/fabric.ts`, `src/renderers/fabric-finish.ts`, a nova ordem de desenho do renderer 3D e a tolerância dos testes de cor nas áreas com acabamento.
