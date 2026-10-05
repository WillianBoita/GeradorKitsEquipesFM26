# Fase 4a — Golas, corte de manga e frequência de manga lisa (2D)

**Data:** 2026-10-05
**Specs de origem:** roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 3, passo 1; Fase 4, item 1; pendência herdada da Fase 2a sobre mangas `solid`) e spec da 3b (seção 5, perfis de estilo).

## 1. Objetivo

Adiantar o que não depende do teste da textura de calibração no jogo. A 4a traz para o 2D duas golas e um corte de manga dos templates do FM26 (`blank_26.psd`, `blank_26_3d.psd`) e reduz a frequência de manga lisa, que hoje puxa a leitura do kit para a cor do overlay. Tudo entra pelos perfis de estilo, então clubes sem `categories` continuam gerando os mesmos kits para as mesmas seeds.

Critério de sucesso:

- `preview --club <id> --samples 24` num clube `retro` mostra golas `polo` e `polo-v`; num clube `modern`, mangas raglan.
- Clube sem `categories` nem `patternWeights` gera os mesmos conjuntos de antes para as mesmas seeds.
- Os `kit.json` salvos continuam válidos e renderizam o mesmo PNG.
- `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes, com as golas e os cortes novos inspecionados pelo preview.

## 2. Escopo

Leitura dos PSDs feita para esta spec (camadas extraídas com `ag-psd`, fora do repositório):

| Camada do FM26 | O que é | No projeto |
|---|---|---|
| gola `U` | gola redonda | `round` (já existe) |
| gola `V` | gola em V | `v-neck` (já existe) |
| gola `A1` | gola polo com abas e carcela | `polo` (nova) |
| gola `A2` | gola larga dobrada, abertura em V, sem carcela | `polo-v` (nova) |
| mangas `I I` | manga costurada no ombro | `set-in` (o desenho atual) |
| mangas `/ \` | manga raglan: costura diagonal da gola até a axila | `raglan` (novo) |

Fora da 4a, por decisão explícita:

- Organizar as referências em `assets/fm26/` (passo 1 da Fase 3). **Descartado:** `assets/` é a pasta de runtime (`--assets`, `registry.json`) e não deve receber 17 MB de referência de engenharia. As referências ficam em `docs/fm_templates/`. A `uv.webp` da raiz já não existe e nunca foi versionada.
- Listras de gola (`outer stripe`, `center stripe`) e de punho (`sleeve end`) dos PSDs.
- Golas e cortes no renderer 3D. Entram depois da calibração (3c), lendo os mesmos campos do `kit.json`.
- Override de golas ou cortes no `club.json`. `style.patternWeights` continua valendo só para padrões.
- Mudar a cor da manga lisa. Ela continua sendo o overlay (o visual do Arsenal); só a frequência muda.

## 3. Dados

`src/core/kit.ts`:

```ts
export const COLLAR_STYLES = ["round", "v-neck", "polo", "polo-v"] as const;
export const SLEEVE_STYLES = ["match-body", "solid"] as const;
export const SLEEVE_CUTS = ["set-in", "raglan"] as const;

sleeves: z.strictObject({ style: z.enum(SLEEVE_STYLES), cut: z.enum(SLEEVE_CUTS).optional(), color: ColorRoleSchema, cuffColor: ColorRoleSchema }),
```

- Os valores novos entram no fim dos arrays, porque a ordem dos candidatos participa do sorteio (seção 4).
- `sleeves.cut` ausente significa `set-in`. O generator só grava `cut` quando sai `raglan`, como já faz com `badge`. Assim os `kit.json` antigos continuam válidos e o JSON gerado para clubes sem `categories` não muda. Um `kit.json` escrito à mão pode declarar `"cut": "set-in"`.
- Tipos novos: `SleeveStyle` e `SleeveCut`, ao lado de `CollarStyle`.
- `visibleRoles` não muda: o corte não muda quais papéis aparecem, e a gola já é visível.

## 4. Perfis e sorteio

### 4.1 Pesos por perfil

`StyleProfile` ganha três tabelas, com chaves tipadas pelos enums:

```ts
export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
  collarWeights: Partial<Record<CollarStyle, number>>;
  sleeveStyleWeights: Partial<Record<SleeveStyle, number>>;
  sleeveCutWeights: Partial<Record<SleeveCut, number>>;
}
```

| Perfil | `collarWeights` | `sleeveStyleWeights` | `sleeveCutWeights` |
|---|---|---|---|
| `classic` | round 1, v-neck 1 | match-body 1, solid 1 | set-in 1 |
| `traditional` | round 35, v-neck 25, polo 25, polo-v 15 | match-body 75, solid 25 | set-in 90, raglan 10 |
| `modern` | round 40, v-neck 40, polo-v 20 | match-body 80, solid 20 | set-in 50, raglan 50 |
| `retro` | round 15, v-neck 15, polo 35, polo-v 35 | match-body 70, solid 30 | set-in 80, raglan 20 |

Os números de `traditional`, `modern` e `retro` são ponto de partida e podem ser ajustados depois da inspeção pelo preview. Os de `classic` não: pesos iguais com `rng.weighted` dão o mesmo índice que `rng.pick` (`next() * 2 - 1 < 0` equivale a `floor(next() * 2) === 0`), e só `set-in` mantém o corte atual.

### 4.2 Resolução

Novo resolvedor em `src/styles/` para as três tabelas, com a mesma regra de `resolvePatternWeights` sem o override do clube:

- Clube sem `categories`: tabela de `classic` sem normalizar.
- Com `categories`: média das tabelas normalizadas dos perfis listados (categoria repetida conta uma vez), como nos padrões.
- Candidatos na ordem do array do enum (`COLLAR_STYLES`, `SLEEVE_STYLES`, `SLEEVE_CUTS`), não na ordem das chaves do perfil, para que reordenar uma tabela não mude o sorteio. Valor sem peso na tabela tem peso 0 e é descartado pelo `rng.weighted`.

Todo perfil tem ao menos um peso positivo em cada tabela, então a média nunca fica vazia.

### 4.3 Ordem do `rng` em `generateKit`

```ts
const template = pickPattern(identity, kitType, rng);
const params = randomParams(template, rng);
const collarStyle = rng.weighted(collarCandidates(identity));      // antes: rng.pick(COLLAR_STYLES)
const collarColor = rng.pick(trimRoles);
const sleeveStyle = rng.weighted(sleeveStyleCandidates(identity)); // antes: rng.pick(SLEEVE_STYLES)
const cuffColor = rng.pick(trimRoles);
const shortsColor = rng.pick([base, overlay]);
const socksColor = rng.pick([shortsColor, base]);
const sleeveCut = rng.weighted(sleeveCutCandidates(identity));     // novo, depois de todos os sorteios anteriores
```

- Gola e estilo de manga ficam na mesma posição; cada `weighted` consome um `next()`, como o `pick`.
- O corte é o último sorteio, para não deslocar nenhum anterior. O ajuste de `traditions.requiredColor` continua depois de tudo, sem chamada ao `rng`.

### 4.4 Efeito nas seeds

- Clube sem `categories` nem `patternWeights` (perfil `classic`): mesmos kits para as mesmas seeds. A guarda `Phase 3b baseline` desse clube passa sem mudança.
- Clube com `categories`: golas, estilo de manga e corte mudam para a mesma seed. A guarda `Phase 3b baseline` do clube `branded` (categoria `modern`) muda de digest de propósito; o valor é atualizado e o comentário da guarda registra a 4a.
- Galáticos (`modern`) e Kongs (`traditional`), regerados com a mesma seed, saem diferentes. Os `kit.json` salvos não mudam até serem regerados.

## 5. Desenho 2D

Tudo em `src/renderers/shirt-2d-shape.ts` e `src/renderers/renderer-2d.ts`. `kitDesign` não muda: forma é geometria, não cor.

### 5.1 Golas

Cada gola passa a ter `neckline` (o corte do corpo e o traço de largura 10, como hoje) e um `trim` opcional (path preenchido com a cor da gola, com contorno igual ao da silhueta: preto, opacidade 0.35, largura 2).

- `round` e `v-neck`: só `neckline`, idênticos aos atuais. O renderer só emite o `trim` quando ele existe, então o SVG delas não muda.
- `polo`: `neckline` redondo; `trim` com duas abas pontudas caindo no peito (ponta até y ≈ 96) e uma carcela estreita no centro (x ≈ 200–214, até y ≈ 125).
- `polo-v`: `neckline` em V com fundo em y = 100, como `v-neck`; `trim` com uma faixa larga acompanhando o V e abas abertas sobre os ombros, sem passar de y = 101.

Os números exatos dos paths saem da inspeção visual; os limites acima são restrição, verificada pelo teste da seção 7.

### 5.2 Corte de manga

- `set-in`: corpo, mangas e contorno atuais. Nenhum elemento novo no SVG.
- `raglan`: o corpo perde dois triângulos nos ombros, porque o decote vai direto às axilas (`L302 146` à direita, `L112 146` à esquerda). Cada manga ganha o triângulo correspondente (direita: `M249 48 L300 62 L378 140 L346 178 L302 146 Z`, esquerda espelhada). Uma costura diagonal (`M249 48 L302 146 M165 48 L112 146`) é desenhada com o traço do contorno; sem ela, a raglan com manga `match-body` seria invisível.
- A silhueta externa (`outlinePath`) e os punhos não mudam nos dois cortes.

`bodyPath` e o path das mangas passam a receber o corte (`bodyPath(collar, cut)`, `sleevesPath(cut)`); `SLEEVES_PATH` vira o caso `set-in`.

### 5.3 Ordem de desenho

Corpo, mangas, costura raglan, punhos, traço da gola, `trim` da gola, contorno. O `trim` fica por cima da manga raglan nos ombros.

### 5.4 Caixas de logo

`LOGO_BOXES` não muda. Geometria conferida:

- Costura raglan na faixa do escudo (y 102–138): x ≈ 280–298; o escudo termina em x = 268.
- Costura raglan na faixa do fabricante (y 105–135): x ≈ 116–134; o fabricante começa em x = 149.
- Carcela da `polo` (x ≈ 200–214) fica entre o fabricante (até x = 179) e o escudo (a partir de x = 232), e termina antes do patrocinador (y = 181).

Por isso `backgroundRoles` (`core/logo-colors.ts`) continua medindo só o padrão.

## 6. Preview

`kitDetails` (`src/preview/contact-sheet.ts`) ganha uma linha com gola, estilo de manga e corte, por exemplo `collar polo · sleeves solid · raglan`, para conferir a variedade no `preview --samples`.

## 7. Testes

TDD, espelhando `src/` em `tests/`:

- `tests/core/kit.test.ts`: aceita as golas novas e `cut` `set-in`/`raglan`; rejeita valor desconhecido; `kit.json` sem `cut` continua válido.
- `tests/styles/`: pesos exatos de `classic`; todo perfil com peso positivo em cada tabela; média normalizada com duas categorias; candidatos na ordem do enum.
- `tests/generator/kit-generator.test.ts`: guarda sem categorias inalterada; guarda `branded` atualizada; `cut` ausente quando o corte sai `set-in`; clube `modern` gera `raglan` e clube `retro` gera `polo` em alguma das seeds 0 a 49; o teste de propriedade existente cobre a validade dos kits.
- `tests/renderers/renderer-2d.test.ts`: guarda de SVG da 3b intacta; cada gola nova renderiza; caixas de logo só sobre o corpo liso para 4 golas × 2 cortes (estende o teste atual de golas); com manga lisa, um ponto do ombro (≈ 270, 66) tem a cor da manga na `raglan` e a do corpo na `set-in`; o pixel da carcela da `polo` tem a cor da gola.
- `tests/preview/`: `kitDetails` com a linha nova.

## 8. Documentação

- Roadmap: linha da 4a na tabela de status; passo 1 da Fase 3 marcado como descartado (seção 2); pendência da 2a sobre manga lisa resolvida pela frequência por perfil; item 1 da Fase 4 parcial (2D na 4a, 3D depois da 3c).
- `CLAUDE.md`: estado atual, perfis com pesos de gola e manga, `sleeves.cut` opcional, nova ordem do `rng` em `generateKit` e o efeito nas guardas de baseline.
