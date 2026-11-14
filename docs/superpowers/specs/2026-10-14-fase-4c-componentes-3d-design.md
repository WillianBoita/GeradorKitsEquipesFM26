# Fase 4c — Golas, raglan e listras de acabamento no 3D

**Data:** 2026-10-14
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 4, item 1, e "Limitações atuais"), spec da 3c (`docs/superpowers/specs/2026-10-07-fase-3c-renderer-3d-design.md`) e spec da 4a (golas `polo`/`polo-v` e manga raglan no 2D).

## 1. Objetivo

A textura 3D passa a mostrar o que o 2D já sorteia: o estilo de gola (`round`, `v-neck`, `polo`, `polo-v`) e o corte raglan. Os kits ganham listras de acabamento na gola e nos punhos, sorteadas pelos perfis e desenhadas no 2D e no 3D. De quebra, a ilha da manga curta passa a ter a forma real da UV do FM26.

Critério de sucesso:

- `npm run export`, sem regerar kits, grava texturas com a gola do estilo do kit, a raglan, a cava corrigida e o punho da manga comprida.
- Um novo `generate` sorteia `trimStripe` nos clubes com perfil que tem listra; com a mesma seed, o resto do kit não muda.
- PNGs 2D de kits sem `trimStripe` e as guardas do clube sem categorias não mudam.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes; `preview` e texturas 3D inspecionados visualmente (cada gola × corte × listra).
- No jogo, os itens da seção 11 conferem.

## 2. Escopo

Dentro:

- Ilha da manga curta com o contorno da cava (seção 3).
- Golas `round` (U), `v-neck` (V), `polo` (A1) e `polo-v` (A2) na textura 3D (seção 4).
- Raglan na textura 3D: a manga avança sobre os ombros, com costura (seção 5).
- Punhos da manga comprida (seção 6).
- Listras de acabamento casadas na gola e nos punhos, estilos `single` e `double`: schema, pesos, sorteio, validação, 2D e 3D (seções 7 a 9).

Fora, por decisão explícita:

- Contorno escuro e sombra das golas (camadas `lines` e `shadow` do PSD). Só a costura da raglan entra.
- `fabric texture` e `mesh` (Fase 4d).
- Padrões por máscara FM26 (Fase 4e, adiada até avaliar a 4c e a 4d no jogo).
- Listras em calção e meias.
- Listras de gola e punho independentes: o sorteio é um só para as duas peças.

## 3. Evidência nova: a manga curta vai até a cava

O layout da 3c corta a manga curta no retângulo x 240–357 e deixa a coluna central (x 357–668) para o tronco. Três fontes mostram que a ilha da manga curta avança sobre a coluna até a curva da cava:

- A camada `sleeves I I` do `blank_26_3d.psd` (máscara da manga set-in) pinta, na asa esquerda, de x 242 até x ≈ 395 no alto e x ≈ 360 embaixo.
- O overlay `layout` do mesmo PSD mostra as asas azul-claras entrando na coluna com borda curva.
- A máscara `02-0` do FM (manga na cor 2) pinta a manga de x 270 a 394 em y 430 e a 379 em y 700; a asa direita é o espelho (630 → 663).

Hoje a faixa entre x 357 e a cava recebe o padrão do tronco. Com manga lisa de cor diferente, cerca de 25% do comprimento da manga, junto ao ombro, sai na cor do corpo. O teste da 3c não relatou isso, mas a raglan se apoia nessa borda, então a correção entra aqui. Ela muda a textura de todos os kits sem mudar nenhum `kit.json`.

## 4. Medições do PSD

As formas saem do `docs/fm_templates/blank_26_3d.psd` por um script descartável com `psd-tools`, fora do repositório (como o spike da calibração). O método fica registrado para refazer a medição:

- Camada extraída como alfa em 1024×1024, limiar 127.
- Cava: por linha (y 405–727), a última coluna pintada da asa esquerda da camada `sleeves I I`.
- Costuras da raglan: por coluna (x 380–514), o primeiro e o último pixel da camada `sleeves / \` em y 405–729.
- Golas: amostragem polar a cada 0,5° a partir de (514,5, 597,5), raio externo (último pixel) e interno (primeiro pixel) de cada camada `collar U`, `collar V`, `collar A1` (sem a carcela) e `collar A2`.
- Simplificação Douglas–Peucker com tolerância de 1 px, coordenadas arredondadas para 0,5 px.

O lado direito do jogador (esquerda da textura) é medido; o esquerdo é o espelho em x = 512, o centro das asas (242 + 782 = 1024). As golas são medidas inteiras, sem espelho.

### 4.1 Pontos medidos (px da textura)

Cava da asa esquerda, de cima para baixo:

```
380 410.5, 395 426.5, 395 469.5, 393 486.5, 392 534.5, 390 560.5, 385 586.5, 386 677.5, 377 703.5, 369 714.5, 360 722.5
```

Costura de cima da raglan (costas), da cava ao centro:

```
380.5 410, 394.5 427, 396.5 485, 401.5 506, 407.5 520, 414.5 531, 429.5 545, 454.5 556, 469.5 559, 514.5 562
```

Costura de baixo da raglan (frente), da cava ao centro:

```
380.5 700, 394.5 644, 404.5 625, 413.5 617, 428.5 610, 449.5 606, 514.5 604
```

Golas (contorno fechado; o primeiro ponto é o de ângulo 0°, à direita do centro, e a ordem segue o sentido horário da tela):

```
U externo:  561 597.5, 560 606, 556 618, 551 624, 551 626, 545 632, 531 640, 515 642, 498 640, 484 632, 478 626, 478 624, 473 618, 469 606, 468 597.5, 469 578, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 578
U interno:  549 597.5, 548 604, 542 615, 538 618, 538 620, 533 625, 522 629, 515 629, 507.5 629, 496 625, 491 620, 491 618, 487 615, 481 604, 480 597.5, 479 582.5, 483 573, 486 570, 495 564, 514.5 563, 534 564, 543 570, 546 573, 550 582.5, 550 596
V externo:  561 597.5, 558 612.5, 551 626, 535 640, 523 646, 515 652, 494 640, 478 626, 471 613, 468 597.5, 469 578, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 578
V interno:  549 597.5, 548 604, 539 620, 527 630, 525 630, 521 634, 515 637, 508 634, 504 630, 502 630, 490 620, 481 604, 480 597.5, 479 582.5, 483 573, 486 570, 495 564, 514.5 563, 534 564, 543 570, 546 573, 550 582.5, 550 596
A1 externo: 561 597.5, 558 625, 553.5 638, 543.5 637, 524 630.5, 502.5 631, 493 635, 480 638, 475.5 638, 474 636.5, 471 625, 468 597, 468 583, 470 574.5, 475 565, 479 561, 486 557, 497.5 554, 523 553, 543 557, 553 564, 560 578
A1 interno: 541 597.5, 536 612, 526 626, 525 631, 505 630, 505 627, 501 623, 492 604, 490 603, 489 597.5, 485 582, 488 577, 501 573, 525 572, 535 575, 539 579, 542 587.5
A2 externo: 562 597.5, 562 616.5, 560 631, 546 630, 535 640, 523 646, 515 652, 494 640, 483 630, 469 631, 467 616.5, 467 597.5, 469 577, 476 564, 482 559, 492.5 555, 514.5 553, 536.5 555, 547 559, 553 564, 560 577
A2 interno: 540 597.5, 533 625, 515 637, 508 634, 496 625, 489 597.5, 486 582, 491 573, 495 571, 511 571, 514.5 570, 529.5 572, 539 579, 542 586
```

Carcela da `polo` (A1): retângulo x 505–524, y 630–676.

Punhos da manga comprida (camada `sleeve end`): x 1–25 e 998–1022, y 3–317, nas bordas externas dos cantos.

### 4.2 Âncoras para os testes (px, tolerância de 2 px)

| Forma | Âncora |
|---|---|
| Gola U | banda em y 597: x 468–479 e 549–560; em x 514: y 553–562 (costas) e 629–641 (frente) |
| Gola V | ponta: em x 514, banda em y 637–651 |
| Gola A1 | carcela em (514, 660); aba em (480, 634) |
| Gola A2 | ombro da aba em (475, 628); ponta em (514, 648) |
| Cava | asa esquerda pintada como manga em (375, 460); espelho em (649, 460) |
| Raglan | ombro em (420, 580) dentro do recorte; (420, 520) fora |
| Punho da manga comprida | (13, 150) e (1010, 150) |

## 5. Layout (`src/fm26/layout.ts`) e formas (`src/fm26/collars.ts`)

### 5.1 Tipos novos

```ts
// Fração 0–1 da textura, como UvRect.
export interface UvPoint {
  x: number;
  y: number;
}
```

Um helper `points("x y, x y, ...")` converte pares em pixels, no formato da seção 4.1, em `UvPoint[]`, como `rect()` faz hoje (uma string só, para o Prettier não quebrar um número por linha), e um helper `mirrorX(points)` espelha em x = 512.

### 5.2 Manga curta

`UvRegion` ganha `outline?: UvPoint[]`: o contorno da ilha, quando ela não é o retângulo. A asa esquerda recebe a borda externa do retângulo (x 240), o topo e a base dele (y 405 e 725) e a cava da seção 4.1 do lado da coluna; a asa direita é o espelho em x = 512 (borda externa em 784, além do fim da manga no PSD, 782). `rect` continua sendo a base da transformação da vista; a vista não muda.

### 5.3 Punhos

`cuffs` passa a ter quatro retângulos: os dois da manga curta, como hoje (máscara `01-0` do FM, já confirmados no jogo), e os dois da manga comprida da seção 4.1. O comentário que dizia que as máscaras do FM não pintam punho na manga comprida passa a citar o PSD, que é o template de kits customizados.

### 5.4 Raglan

`Fm26KitLayout` ganha `raglan`:

```ts
export interface UvRaglan {
  // Ombros e faixa em volta da gola, frente e costas: a manga raglan pinta aqui.
  yoke: UvPoint[];
  // Costuras entre a manga e o tronco, do lado do tronco.
  seams: UvPoint[][];
}
```

As costuras medidas terminam em x 514,5; no layout elas param no eixo do espelho, em (512, 562) e (512, 604), para o lado espelhado não sobrepor. `yoke` é um polígono só: costura de cima da asa esquerda até o centro, a mesma espelhada até a asa direita, desce pela borda da asa direita, costura de baixo da direita ao centro e do centro à esquerda, e fecha na asa esquerda. O fechamento em x 380,5 cai dentro da manga, que é pintada por cima. `seams` são as quatro polilinhas (cima e baixo, dos dois lados).

### 5.5 Golas

`collar: UvCircle` sai do layout. O novo `src/fm26/collars.ts` exporta `FM26_COLLARS: Record<CollarStyle, UvCollar>`:

```ts
export interface UvCollar {
  outer: UvPoint[];
  inner: UvPoint[];
  // Peça por cima das listras e sem listra, como no PSD.
  placket?: UvRect;
}
```

Os pontos são os da seção 4.1. O miolo da gola (dentro de `inner`) fica com o que estiver embaixo, como o anel de hoje.

## 6. Renderer 3D (`src/renderers/renderer-3d.ts`)

Ordem de pintura:

1. Fundo na cor base do corpo (sem mudança).
2. Frente e costas com as camadas (sem mudança).
3. Raglan, só com `sleeveCut(kit) === "raglan"`: o `yoke` recebe o fill da manga. Manga lisa = cor da manga. Manga `match-body` = padrão do corpo sem camadas, levado pelas vistas da frente (parte abaixo de y 598) e das costas (acima), como no 2D, onde os triângulos da raglan pertencem às mangas e não recebem camadas.
4. Mangas curtas e compridas. A manga curta recorta pelo `outline`; a lisa vira `<path>` preenchido com o contorno em vez de `<rect>`. Pintadas depois do tronco e da raglan, cobrem a faixa da cava.
5. Costuras da raglan, só na raglan: `stroke="#000000"`, `stroke-opacity="0.2"`, largura 2, sem preenchimento (a camada `lines` do PSD usa preto com opacidade 51/255).
6. Punhos (os quatro) e listras dos punhos (seção 9).
7. Gola: forma `outer` + `inner` com `fill-rule="evenodd"` na cor da gola, listras (seção 9) e a carcela da `polo` por cima.
8. Logos (sem mudança).

`regionViews` continua igual para frente e costas. Nas mangas curtas, os retângulos das metades passam a cobrir a largura do `outline` em x (240–395 e 629–785), e o renderer recorta a região inteira pelo `outline`. `frontLogoBox` não muda.

## 7. Schema e validação

### 7.1 `core/kit.ts`

```ts
export const TRIM_STRIPE_STYLES = ["single", "double"] as const;
```

`KitDefinitionSchema` ganha `trimStripe: z.strictObject({ style: z.enum(TRIM_STRIPE_STYLES), color: ColorRoleSchema }).optional()`, logo depois de `sleeves`. Ausente = sem listra; os `kit.json` atuais continuam válidos. O campo é um só porque as listras de gola e punho são casadas.

`visibleRoles(kit)` passa a contar `trimStripe.color`.

### 7.2 `core/validation.ts`

- Regra nova `trim-stripe-color` em `validateKit`: a cor da listra é igual à da gola ou à do punho (`kit.collar.color` ou `kit.sleeves.cuffColor`). Mensagem no formato das outras regras de cor.
- `required-color` (em `validateKitTraditions`) já usa as cores visíveis e passa a aceitar a cor da listra; a mensagem cita "trim stripe".

## 8. Pesos e sorteio

### 8.1 `styles/profiles.ts`

```ts
// Ausência de listra entra como opção para o sorteio ponderado; não vai para o kit.json.
export const TRIM_STRIPE_OPTIONS = ["none", ...TRIM_STRIPE_STYLES] as const;
export type TrimStripeOption = (typeof TRIM_STRIPE_OPTIONS)[number];
```

`StyleProfile` ganha `trimStripeWeights: Weights<TrimStripeOption>`:

| Perfil | none | single | double |
|---|---|---|---|
| classic | 1 | — | — |
| traditional | 60 | 25 | 15 |
| modern | 75 | 20 | 5 |
| retro | 40 | 30 | 30 |

### 8.2 `styles/component-weights.ts`

`trimStripeCandidates(identity)` na ordem de `TRIM_STRIPE_OPTIONS`, como os outros candidatos (sem override no `club.json`).

### 8.3 `generator/kit-generator.ts`

Depois de `pickLayers`, como último sorteio:

```ts
const stripe = rng.weighted(trimStripeCandidates(identity));
// A cor da listra só é sorteada quando sai listra; é o último sorteio, então não desloca nada.
const stripeColor = stripe === "none" ? undefined : rng.pick(COLOR_ROLES.filter((role) => role !== collarColor && role !== cuffColor));
```

Sobra sempre um papel ou mais (três papéis, no máximo dois excluídos). `trimStripe` só é gravado quando sai listra.

A correção do `requiredColor` na gola não colide com a listra: ela só age quando o papel exigido não está em `visibleRoles(kit)`, e a cor da listra é visível. A gola nova nunca é a cor da listra, sem troca nem chamada extra ao `rng`.

### 8.4 Efeito nas seeds

- `classic` sempre sorteia `none` e não sorteia cor: os kits do clube sem categorias não mudam, nem a guarda dele.
- A guarda do clube `branded` (`modern`) muda de propósito.
- Clubes com `categories`, num novo `generate` com a mesma seed, mantêm o resto do kit (palette, padrão, gola, mangas, camadas, logos) e só ganham `trimStripe` quando ele sai.
- A listra usa o mesmo `rng` depois das camadas: uma tradição que proíbe camadas muda quantos números as camadas consomem e pode mudar a listra, mas nada antes dela.

## 9. Desenho das listras

### 9.1 Faixas

`src/renderers/trim-stripes.ts` (puro) define as faixas de cada estilo em fração de uma largura nominal `W`, medidas a partir da borda da peça:

| Estilo | Faixas |
|---|---|
| `single` | 0,375–0,625 (no meio) |
| `double` | 0,1–0,3 e 0,7–0,9 |

E dois modos de transformar as faixas em traços, ambos devolvendo a sequência `{ width, paint: "stripe" \| "trim" }` a desenhar depois da peça:

- **Centrado** (`centeredStripeStrokes(W, style)`): para peças desenhadas como traço de largura `W` ao longo de uma linha central. Cada faixa com início abaixo de 0,5 vira um traço de listra de largura (1 − 2·início)·W e, se o fim estiver abaixo de 0,5, um traço da peça de largura (1 − 2·fim)·W por cima. `single` = um traço de 0,25 W; `double` = listra de 0,8 W e peça de 0,4 W.
- **Da borda** (`edgeStripeStrokes(W, style)`): para peças preenchidas, traçando o contorno recortado pela própria peça. Para cada faixa, da mais funda para a mais rasa: traço de listra de largura 2·fim·W e traço da peça de largura 2·início·W.

### 9.2 `kitDesign`

`KitDesign` ganha `trimStripe?: { style: TrimStripeStyle; color: string }`, já com a cor resolvida. Os renderers só posicionam.

### 9.3 2D

- Gola `round` e `v-neck`: modo centrado sobre o traço do decote (`W` = 10).
- Gola `polo` e `polo-v`: modo centrado sobre o traço do decote e modo da borda nas abas (`W` = 8, recortado por cada aba). O trim da `polo` se divide em `flaps` e `placket` em `shirt-2d-shape.ts`; a carcela vem depois das listras e fica sem listra. Sem listra, o path desenhado continua o mesmo texto de hoje.
- Punhos: modo centrado sobre `CUFFS_PATH` (`W` = 8).
- Com listra, o contorno escuro da silhueta deixa de passar pelo decote: ele corre no meio do traço da gola e cobriria a listra `single`. A listra marca a gola no lugar dele.
- Sem `trimStripe`, o SVG é byte a byte o atual (guarda da 3b).

### 9.4 3D

- Gola: modo da borda sobre o contorno `outer`, recortado pela forma da gola, com `W` = 10 px em todos os estilos (nas golas polo, a listra fica junto à borda externa, como nas camadas `outer`/`inner` do A1 no PSD).
- Punhos: cada retângulo vira um traço na linha central do lado comprido, largura = lado curto, pontas `butt` (o pixel do punho fica igual ao do retângulo de hoje), e recebe o modo centrado com `W` = lado curto.
- As listras valem para os quatro punhos.

### 9.5 Preview

`kitDetails` (em `preview/contact-sheet.ts`) mostra a listra, por exemplo `trim: double accent`.

## 10. Testes

Espelhando `src/` em `tests/`:

- `core/kit`: o schema aceita `trimStripe`; chave desconhecida dentro dele é erro; `visibleRoles` conta a cor da listra.
- `core/validation`: `trim-stripe-color` dispara com a cor da gola e com a do punho; `required-color` aceita a cor da listra.
- `styles`: ordem de `trimStripeCandidates`; `classic` só com `none`; todo perfil tem `trimStripeWeights`.
- `generator`:
  - guarda `Phase 3b baseline` do clube sem categorias igual;
  - guarda do clube `branded` atualizada;
  - em 200 seeds de um clube `retro`, a cor da listra nunca é a da gola nem a do punho, e sai pelo menos uma `single` e uma `double`;
  - kit sem listra não tem a chave `trimStripe`;
  - um clube com categorias gera o mesmo kit de antes da 4c para a mesma seed, a menos de `trimStripe`.
- `renderers/trim-stripes`: larguras dos traços dos dois modos para `single` e `double`.
- `fm26/layout` e `fm26/collars`: pontos dentro de 0–1; contorno da manga dentro do bbox esperado; asa direita espelhada da esquerda.
- Renderer 2D:
  - SVG sem `trimStripe` idêntico ao atual;
  - pixels de listra no meio do decote (`single`) e perto das bordas (`double`), nos punhos e na aba da polo; carcela na cor da gola.
- Renderer 3D:
  - regressão da cava: manga lisa de cor própria em (375, 460) e (649, 460);
  - golas nas âncoras da seção 4.2; a forma muda com o estilo (a ponta da V em (514, 648) não é cor de gola na U);
  - raglan: (420, 580) na cor da manga lisa na raglan e na cor base do corpo na set-in; (420, 520) fora do recorte; costura presente no SVG só na raglan;
  - punhos da manga comprida na cor do punho;
  - listras nos punhos e na gola (U `single`: listra a 5 px da borda externa em y 597; `double`: listras a 2 e 8 px, peça a 5 px);
  - textura opaca e com 1024 px.

## 11. Teste no jogo

`npm run export` sem regerar já mostra a cava, as golas, a raglan e os punhos da manga comprida. As listras só aparecem depois de `generate --club <id> --seed <generatedWith.seed>` nos clubes com perfil que sorteia listra; a mesma seed mantém o resto do kit se o `club.json` (pools de marcas inclusive) não mudou.

Conferir:

1. Manga lisa de cor própria sem faixa da cor do corpo junto ao ombro.
2. Golas U, V, A1 (com carcela) e A2 no pescoço, sem emenda aparente nas costas.
3. Raglan com manga lisa e com `match-body`: ombro na cor da manga e costura do pescoço à axila.
4. Listras `single` e `double` na gola e nos punhos, na manga curta e na comprida.
5. Punho da manga comprida na ponta da manga.

## 12. Documentação

- Roadmap: status da 4c, resultado do teste no jogo, "Limitações atuais" (sem estilo de gola e raglan no 3D sai da lista) e o que fica para a 4d e a 4e.
- `CLAUDE.md`: `trimStripe` e `trim-stripe-color`, `collars.ts`, `outline` e `raglan` no layout, `trim-stripes.ts`, a ordem do sorteio em `generateKit` e a correção da cava.

## 13. Ordem de entrega

1. Schema, validação, pesos e sorteio (`core`, `styles`, `generator`), com as guardas.
2. `trim-stripes.ts` e listras no 2D.
3. Layout: contorno da manga, punhos da manga comprida, raglan; `collars.ts`.
4. Renderer 3D: cava, raglan, golas, punhos e listras.
5. `kitDetails`, inspeção visual, documentação.

## 14. Riscos

- As formas são aproximações do PSD (tolerância de 1 px na simplificação): uma diferença pequena na borda da gola ou da cava pode aparecer no jogo. Os pontos ficam no código, fáceis de ajustar.
- O espelho em x = 512 serve às asas; as golas são medidas inteiras porque o centro delas fica em x ≈ 514.
- A cava corrigida muda todas as texturas: um erro nela afeta todos os kits. O teste de regressão e o item 1 da seção 11 cobrem isso.
- O punho da manga comprida segue o PSD e não a máscara `01-0` do FM; se ficar errado no jogo, sai sem afetar o resto.
- Regerar com a mesma seed depende de o `club.json` não ter mudado desde o último `generate`; os pools de patrocinador mudaram recentemente (`bce42f0`), então um novo `generate` pode trocar o patrocinador.
