# Fase 3c — Renderer 3D e 3D no export

**Data:** 2026-10-07
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 3, passos 4 e 5, e a seção "Calibração da UV"), spec da 3a (seção 11, notas de UV) e spec da 3b (seção 8, layout UV como dado).

## 1. Objetivo

Os kits gerados aparecem em 3D no FM26. Cada kit ganha uma textura 1024×1024 mapeada em `kit_textures/<tipo>`, com o mesmo visual do PNG 2D: padrão do corpo na frente e nas costas, mangas, gola, punhos, calção e meias nas cores do kit e logos no peito.

Critério de sucesso:

- `npm run export` grava, para cada kit, o PNG 2D e a textura 3D, e o `config.xml` tem os registros `kits/` e `kit_textures/` (6 por clube com Home, Away e Third).
- `render --definition <kit.json> --out <arquivo> --render 3d` grava a textura de um kit.
- Os PNGs 2D, os `kit.json` salvos e as seeds não mudam.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes, texturas inspecionadas visualmente.
- No jogo, os kits 3D de todos os clubes aparecem e passam na conferência da seção 11.

## 2. Escopo

Dentro:

- Mapeamento do espaço do padrão 2D para as ilhas da UV (`src/renderers/uv-mapping.ts`).
- Renderer 3D (`src/renderers/renderer-3d.ts`) sobre `kitDesign`.
- Composição de logos compartilhada entre 2D e 3D (`src/renderers/kit-logos.ts`).
- Ajustes no layout: barras do tronco, espelhamento das mangas esquerdas, caixas de logo saem do layout.
- `export` com 2D e 3D; `render --render <2d|3d>`.

Fora, por decisão explícita:

- Estilo de gola (`polo`, `polo-v`, `v-neck`) e corte raglan no 3D: a textura pinta o anel da gola na cor da gola e ignora o corte (Fase 4).
- `fabric texture` e `mesh` dos PSDs (Fase 4).
- Logos em mangas, calção e costas, nome e número (o jogo desenha o número nas costas).
- Listras de calção e meias: calção e meias são lisos.
- 3D no `generate` e no `preview`: os dois seguem só 2D.
- Flag `--size` na CLI: o tamanho é configurável só na API do renderer.
- Validar no 3D a cor dos logos: o mapeamento garante o mesmo fundo do 2D (seção 5.4).

## 3. Evidência nova: frente e costas alinham pela barra

As máscaras do próprio FM (`docs/fm_templates/FM26 3D Assets/`) mostram que frente e costas usam a mesma escala vertical e se alinham pela barra, não pela linha da gola. Medindo as faixas na coluna (x = 400):

| Máscara | Faixa nas costas (distância da barra em y = 138) | Faixa na frente (distância da barra em y = 1001) |
|---|---|---|
| `13-0` (hoops) | 26–104 e 182–260 | 28–106 e 184–268 |
| `49-0` (hoops finos) | 0–42, 88–135, 182–229, 275–322 | 0–46, 91–138, 184–230, 276–323 |
| `19-0` (painéis) | 0–204 | 0–208 |
| `15-0` | 161–221 | 165–225 |

Consequências:

- As costas são a frente refletida na linha y ≈ 569, o ponto médio entre as barras (134 e 1004 no layout), e não na linha da gola (598). Os 58 px a mais das costas ficam do lado da gola.
- Com a mesma escala, as faixas horizontais se encontram nas laterais do corpo.
- As faixas finas das pontas da coluna (barras) continuam o desenho do tronco: na máscara `41-0` a faixa vertical atravessa a barra.

## 4. Layout (`src/fm26/layout.ts`)

```ts
export interface UvRegion {
  part: UvPart;
  side?: "left" | "right";
  rect: UvRect;
  rotation: 0 | 180;
  mirrored: boolean;
  // Faixa da barra: recebe a continuação do desenho da região.
  hem?: UvRect;
}

export interface Fm26KitLayout {
  textureSize: number;
  regions: UvRegion[];
  cuffs: UvRect[];
  collar: UvCircle;
}
```

Mudanças:

- `front` ganha `hem` x 357–668, y 1004–1018; `back` ganha `hem` x 357–668, y 118–134 (calibração de 2026-10-06: são as barras e recebem o desenho do corpo).
- `sleeve` e `longSleeve` do lado `left` passam a `mirrored: true`. A vista da manga (seção 5.3) põe o ombro à direita; o espelhamento leva o ombro para a borda interna da ilha da direita da textura. Hipótese: o jogo não mostrou a orientação das mangas em x nem as metades B/F (seção 11).
- `logos` sai do layout: as caixas de logo passam a ser derivadas das caixas 2D (seção 5.4), para que o fundo atrás do logo seja o mesmo do 2D.
- Os comentários de "hipótese a confirmar" das regiões confirmadas na calibração (tronco, lados, gola, asas e cantos) passam a citar o teste de 2026-10-06.

Os testes de `tests/fm26/layout.test.ts` que liam `logos` passam a valer para `hem` (dentro da textura, sem sobrepor regiões, encostado na sua região).

## 5. Mapeamento (`src/renderers/uv-mapping.ts`)

Módulo puro (sem Sharp). Converte o espaço do padrão 2D (viewBox 414 de `SHIRT_2D_VIEWBOX`, o mesmo em que `fillSvg` desenha) para a textura, em pixels de uma textura `FM26_TEXTURE_SIZE` (1024). O renderer usa as matrizes como `transform="matrix(a b c d e f)"`.

### 5.1 Janela do tronco

`src/renderers/shirt-2d-shape.ts` exporta `TORSO_WINDOW = { x: 112, y: 48, width: 190, height: 334 }`: a caixa do tronco 2D (lateral a lateral, linha do ombro até a barra em y = 382).

Escalas, tiradas da frente:

- `kx = front.width / TORSO_WINDOW.width` = 311 / 190 ≈ 1,637
- `ky = front.height / TORSO_WINDOW.height` = 406 / 334 ≈ 1,216

O esticamento horizontal de ≈ 1,35× em relação ao vertical é o tronco desenrolado: a borda do tronco 2D cai na costura lateral, então `side-lines` continua na lateral. Os logos não esticam (seção 5.4).

### 5.2 Vistas do tronco

Cada parte tem uma vista: o desenho da parte em pé, como visto de fora, com tamanho em pixels igual ao do `rect`. Depois, a vista vai para o `rect` aplicando `mirrored` (espelho horizontal) e depois `rotation`, como já descreve o comentário de `UvRegion`.

- **Frente**: janela x 112–302, y (382 − `rect.height`/`ky`)–382 = 48–382. A barra (y = 382) fica embaixo.
- **Costas**: mesma janela ancorada na barra, y (382 − 464/`ky`)–382 ≈ 0,3–382, espelhada na horizontal (vista de trás, o lado direito do jogador fica à direita). Com `rotation: 180`, o resultado é a frente refletida em y ≈ 569, com o mesmo x.
- **Barra**: a vista continua além da barra pela altura do `hem` (até y ≈ 394 na frente e ≈ 395 nas costas, dentro do quadrado 0–414). O renderer recorta o desenho em `rect` ∪ `hem`.

Fórmulas resultantes (pixels da textura): frente `X = 357 + (x − 112)·kx`, `Y = 598 + (y − 48)·ky`; costas com o mesmo `X` e `Y = 1138 − Y_frente`.

### 5.3 Vista das mangas

Para `sleeve` (asa, manga curta) e `longSleeve` (canto, manga comprida), com `L = rect.width` (comprimento) e `C = rect.height` (circunferência):

- Janela: x 112–302 (a largura do tronco) na circunferência, escala `C / 190`; y 48 até 48 + `L`/`ky` no comprimento, escala `ky`. Asa: y 48–144; canto: y 48–342. É o topo do tronco, com a mesma escala de pixel.
- A vista gira a janela 90° no sentido horário: o topo da janela (ombro) fica na borda direita da vista, o punho na esquerda, e x = 112 fica em cima. Listras verticais do padrão correm do ombro ao punho; hoops viram anéis em volta do braço.
- Manga da direita do jogador (lado esquerdo da textura, `mirrored: false`): ombro na borda direita da ilha, junto à coluna. Manga da esquerda (`mirrored: true`): ombro na borda esquerda, junto à coluna. As duas saem espelhadas em relação ao centro da textura.

Só a manga `match-body` usa a vista; ela recebe o padrão principal sem camadas, como no 2D.

### 5.4 Caixas de logo

`frontLogoBox(slot)` mapeia `LOGO_BOXES[slot]` com a transformação da frente e devolve um `UvRect`. Como a caixa 3D é a imagem da caixa 2D, o fundo atrás do logo é o mesmo que `backgroundRoles` mediu no 2D, e as cores de logo do `kit.json` continuam válidas no 3D.

| Logo | Caixa 2D | Caixa 3D (px) | Centro 3D | Quadrado do template |
|---|---|---|---|---|
| `badge` | 232, 102, 36×36 | x 553,4–612,4, y 663,6–707,4 | (583, 686) | (574, 691) |
| `manufacturer` | 149, 105, 30×30 | x 417,6–466,7, y 667,3–703,8 | (442, 686) | (456, 691) |
| `sponsor` | 145, 181, 124×48 | x 411,0–614,0, y 759,7–818,0 | (513, 789) | não marcado |

O patrocinador fica abaixo da hipótese antiga do layout (y 721–799). A altura dele se confere no jogo (seção 11).

## 6. Renderer 3D (`src/renderers/renderer-3d.ts`)

```ts
export const KIT_3D_SIZE = FM26_TEXTURE_SIZE;

export interface Render3dOptions {
  size?: number;
  logos?: KitLogoImages;
}

export function renderKit3dSvg(kit: KitDefinition, options?: Render3dOptions): string;
export function renderKit3dPng(kit: KitDefinition, options?: Render3dOptions): Promise<Buffer>;
```

- SVG com `viewBox="0 0 1024 1024"` e `width`/`height` = `size` (padrão 1024). O layout em fração é multiplicado por `textureSize`.
- Ordem do desenho, todos a partir de `kitDesign(kit)`:
  1. Fundo: `<rect>` cobrindo a textura inteira na cor base do padrão do corpo (`design.body.base`). As máscaras do FM e a textura de calibração são opacas; isso substitui o "transparência fora das regiões" do passo 4 do roadmap.
  2. Regiões, na ordem de `layout.regions` (elas não se sobrepõem):
     - frente e costas: `fillSvg(design.body, 414, 414, design.bodyLayers)` dentro da transformação da vista, recortado em `rect` ∪ `hem`. As camadas aparecem na frente e nas costas; a `shoulder-line` cruza o ombro;
     - mangas (asas e cantos): manga `solid` vira `<rect>` na cor da manga; `match-body` usa `fillSvg(design.sleeves, 414, 414)` na vista da seção 5.3, recortado no `rect`;
     - calção e meias: `<rect>` de cada região na cor de `design.shorts` e `design.socks`.
  3. Punhos: `<rect>` de `layout.cuffs` na cor do punho, só nas asas. As máscaras do FM não pintam punho na manga comprida.
  4. Gola: anel de `layout.collar` (`<circle>` com `stroke` de largura `outerRadius − innerRadius`) na cor da gola.
- Os padrões não usam `id`, então `fillSvg` pode aparecer várias vezes no mesmo SVG. Os `clipPath` do renderer têm ids fixos e únicos dentro do SVG.
- `renderKit3dPng` rasteriza com Sharp e compõe os logos por cima, nas caixas da seção 5.4 escaladas por `size / 1024`. Sem logos, não há `composite`.
- Saída: PNG RGBA com alfa 255 em todo pixel, o formato da textura de calibração que o jogo aceitou.
- Determinístico: sem `rng`; mesmo kit, mesmo SVG.

## 7. Logos compartilhados (`src/renderers/kit-logos.ts`)

- `KitLogoImages` e a montagem das camadas de logo (`logoLayers`, hoje privada em `renderer-2d.ts`) passam para `kit-logos.ts`.
- A função recebe a caixa em pixels de cada slot e a espessura do contorno: `kitLogoLayers(kit, images, boxes, outlineWidth)`. O erro de imagem ausente (`Kit declares a <slot> but no <slot> image was provided`) não muda.
- 2D: caixas de `LOGO_BOXES` escaladas por `size / 414`, contorno `max(1, round(2 · size / 414))`, como hoje. O PNG 2D fica byte a byte igual. A guarda de SVG (`Phase 3b baseline`) não cobre logos, então a extração é conferida comparando o PNG 2D com os três logos antes e depois (script e hashes temporários em `output/`, ignorada pelo git), além dos testes de pixel de logo de `renderer-2d.test.ts`.
- 3D: caixas de `frontLogoBox`, contorno `max(1, round(2 · ky · size / 1024))`, a mesma proporção em relação à altura do logo.
- `src/io/asset-repository.ts` e os testes passam a importar `KitLogoImages` de `kit-logos.ts`.

## 8. CLI e export

- `export`: `renderTypes: ["2d", "3d"]` e um `renderKit` que lê os logos do kit e escolhe `renderKit2dPng` ou `renderKit3dPng` pelo `renderType`. Os registros saem como hoje: 2D antes de 3D, e por tipo de kit dentro de cada um. `exporter.ts` não muda: já é genérico, e `checkRenderedPng` já exige 1024×1024 no 3D. O comentário "Só 2D na 3a" sai.
- `render`: nova opção `--render <2d|3d>`, padrão `2d`. Valor fora de `RENDER_TYPES` dá `Error: Invalid render type "<valor>": expected 2d or 3d` com exit code 1. `USAGE` ganha a opção.
- `generate`, `validate` e `preview` não mudam.

## 9. Erros

Os mesmos do 2D: padrão desconhecido (`getPatternTemplate`) e imagem de logo ausente lançam erro. No `render`, viram `Error: ...` com exit code 1. No `export`, viram `render-failed` do clube e abortam tudo antes de gravar, como hoje.

## 10. Testes

- `tests/renderers/uv-mapping.test.ts`:
  - os cantos de `TORSO_WINDOW` caem nos cantos da frente;
  - a barra (y = 382) cai em y = 1004 na frente e em y = 134 nas costas; para qualquer ponto, `Y_costas = 1138 − Y_frente` com o mesmo x (reflexão em 569);
  - nas 4 mangas, o ombro (y = 48) fica na borda junto à coluna e o punho na borda externa;
  - as janelas de todas as vistas, com a barra, ficam dentro do quadrado 0–414;
  - as caixas de logo ficam dentro da frente, e escudo e fabricante ficam a até 20 px do centro dos quadrados do `template.png`.
- `tests/renderers/renderer-3d.test.ts`:
  - PNG 1024×1024 e `size` configurável;
  - alfa 255 em todo pixel;
  - cor certa no centro de cada parte, com kits cujos papéis distinguem as partes (corpo, manga lisa, punho, gola, calção, meias);
  - costas = frente refletida em 569 com `halves` e `sash`, sem logos, numa grade de pontos fora das bordas;
  - manga `match-body` com `stripes`: a cor não muda ao longo do comprimento da asa (eixo x) numa mesma altura;
  - camada aparece na frente e nas costas;
  - com logos, só os pixels dentro das caixas mudam;
  - SVG determinístico;
  - erro com padrão desconhecido e com logo declarado sem imagem.
- Extração de `kit-logos.ts`: os testes de logo de `renderer-2d.test.ts` continuam passando sem alteração, e o PNG 2D com os três logos é comparado byte a byte antes e depois (seção 7); o módulo não ganha arquivo de teste próprio.
- `tests/fm26/layout.test.ts`: `hem` e `mirrored` das mangas esquerdas.
- CLI e export: `export` grava `_3d.png` de 1024 e o `config.xml` tem os registros `kit_textures`; `render --render 3d` grava 1024; `render --render 4d` falha com a mensagem da seção 8.

## 11. Teste no jogo

Último passo da fase, feito pelo usuário com o resultado de `npm run export`:

1. **Remover antes a pasta `graphics/kits/fm26_calibration/`**: o `config.xml` dela mapeia o Home e o Away 3D do Galáticos, e dois pacotes com o mesmo `to` deixam o teste ambíguo.
2. Instalar `output/fm26_export/` na pasta de kits do jogo, em Documentos (que pode ser `OneDrive/Documentos`).
3. Conferir, com prints de frente, costas e laterais:
   - os kits 3D de todos os clubes aparecem (Home, Away e Third);
   - o padrão do tronco é contínuo no ombro e as faixas horizontais se encontram nas laterais;
   - na manga `match-body`, as listras correm do ombro ao punho; num padrão assimétrico (`halves`, `sash`), as metades B/F e o espelhamento entre as mangas;
   - escudo no peito esquerdo do jogador, fabricante no direito, altura do patrocinador;
   - punhos da manga curta, anel da gola, calção e meias nas cores do kit;
   - emendas visíveis nas bordas das ilhas.
4. O resultado vai para o roadmap. Divergência de orientação vira ajuste de `mirrored`/`rotation` no layout, em commit próprio, sem mexer no renderer.

## 12. Documentação

- `CLAUDE.md`: estado atual (3c concluída), comandos (`render --render 3d`, `export` com 2D e 3D), arquitetura (`uv-mapping.ts`, `renderer-3d.ts`, `kit-logos.ts`, layout com `hem` e sem `logos`, export com 2D e 3D).
- Roadmap: status da 3c, resultado do teste no jogo, "Limitações atuais" e o que passa para a Fase 4.
- README: comandos novos.

## 13. Ordem de entrega

1. Layout: `hem`, `mirrored` das mangas esquerdas, `logos` sai.
2. `TORSO_WINDOW` e `uv-mapping.ts`.
3. `kit-logos.ts`, com o 2D byte a byte igual.
4. `renderer-3d.ts`.
5. CLI: `render --render` e `export` com 2D e 3D.
6. Documentação, inspeção visual das texturas e teste no jogo.

## 14. Riscos

- **Orientação das mangas**: em x e nas metades B/F, a orientação ainda é hipótese. Errada, ela só aparece em padrões assimétricos com manga `match-body`. A correção é de dado (`mirrored`/`rotation`).
- **Altura do patrocinador**: ela vem da caixa 2D. Se ficar baixa demais no jogo, subir só o 3D quebra a garantia do fundo igual ao 2D. A saída seria mover a caixa 2D (muda os PNGs 2D e as guardas) ou medir o fundo 3D na escolha da cor. As duas ficam fora desta fase.
- **Esticamento horizontal**: ≈ 1,35× deixa quadrados de `checkers` e diagonais mais largos no modelo. É aceito pela coerência com o 2D (borda do tronco na costura lateral e logos sobre o mesmo fundo).
- **Tempo de teste**: rasterizar 1024×1024 é mais lento que 414. Os testes de pixel devem usar poucos kits e reaproveitar o PNG entre asserções.
