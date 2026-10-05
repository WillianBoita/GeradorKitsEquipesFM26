# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Specs, planos de execução e status: `docs/superpowers/`.

## Status

Fase 3b concluída: além do que a 3a entrega (kits Home, Away e Third com a mesma paleta, PNG 2D 414×414 com escudo, patrocinador e fabricante, export para o FM26 com `config.xml` gerado), o gerador tem 12 padrões de camisa, perfis de estilo, tradições do clube e um contact sheet HTML para inspecionar kits salvos ou amostras de seeds. A textura 3D ainda não existe (Fase 3c, que depende do teste da textura de calibração no jogo). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.

## Requisitos

- Node.js 22.12 ou superior

## Instalação

```bash
npm install
```

Os comandos abaixo são executados a partir da raiz do projeto.

## 1. Criar um clube

Crie `clubs/<id>/club.json`. O `id` usa só minúsculas, dígitos e `-`, e deve ser igual ao nome da pasta.

```json
{
  "id": "meu-clube",
  "name": "Meu Clube",
  "fmUniqueId": "2000778260",
  "palette": { "primary": "#123456", "secondary": "#FFFFFF", "accent": "#FFD700" },
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

- Só `id`, `name` e `palette.primary` são obrigatórios.
- `secondary` e `accent` ausentes são derivados da cor primária.
- As cores informadas precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15). Cores quase iguais são rejeitadas, porque cada uma vira a cor base de um kit.
- `fmUniqueId` é o Unique ID do clube no editor do FM26, como string de dígitos de 0 a 4294967295. Informe você mesmo; o código nunca o inventa. Só o `export` o usa (seção 7); o `generate` apenas o valida. O Random UID do editor não é usado.
- `style.categories` escolhe perfis de estilo (`classic`, `traditional`, `modern`, `retro`; ver "Perfis de estilo" na seção 4). Com mais de um perfil, o sorteio usa a média dos pesos deles. Sem `categories`, vale `classic`.
- `style.patternWeights` dá pesos de 0 a 1.000.000 por id de padrão (seção 4) e substitui os perfis. Padrão fora da lista fica com peso 0.
- `traditions` (opcional) fixa regras do clube; ver "Tradições do clube" abaixo.
- `sponsors` e `manufacturers` são opcionais: IDs do registry de logos (seção 2) com pesos de 0 a 1.000.000. Cada geração sorteia um patrocinador e um fabricante para o conjunto: Home, Away e Third usam os mesmos. Sem a chave, os kits saem sem patrocinador ou sem fabricante.
- Escudo: coloque um PNG com fundo transparente em `clubs/<id>/logo.png`. Ele aparece com as cores originais. Sem o arquivo, os kits saem sem escudo.
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

### Tradições do clube

```json
"traditions": { "forbiddenPatterns": ["sash"], "patterns": { "home": ["stripes", "pinstripes"] }, "requiredColor": "accent" }
```

- `forbiddenPatterns`: padrões que o gerador nunca sorteia.
- `patterns.home`, `patterns.away`, `patterns.third`: o sorteio daquele tipo fica restrito à lista. Se nenhum padrão da lista tiver peso no estilo do clube, todos da lista ficam com a mesma chance.
- `requiredColor` (`primary`, `secondary` ou `accent`): a cor aparece em todo kit, no padrão, na manga, na gola ou no punho. Quando o sorteio não a usa, a gola recebe essa cor.
- Um padrão ao mesmo tempo proibido e permitido é erro, assim como um tipo de kit sem nenhum padrão possível.

Exemplo pronto: `clubs/galaticos-fc/club.json` e `clubs/galaticos-fc/logo.png`.

## 2. Registrar patrocinadores e fabricantes

Os logos ficam em `assets/` e são registrados por ID em `assets/registry.json`:

```json
{
  "sponsors": [{ "id": "luna-air", "name": "Luna Air", "file": "sponsors/luna-air.svg" }],
  "manufacturers": [{ "id": "vertex", "name": "Vertex", "file": "manufacturers/vertex.svg" }]
}
```

- `id`: minúsculas, dígitos e `-`, único em cada lista. É o que o `club.json` e o `kit.json` referenciam.
- `file`: caminho relativo a `assets/`, com `/`, terminando em `.png` ou `.svg`. Caminho absoluto ou com `..` é rejeitado.
- Patrocinador e fabricante são usados como silhueta: só a transparência do arquivo importa, as cores dele são ignoradas. O gerador pinta o logo numa cor que contrasta com a camisa. Arquivo sem nenhuma transparência vira um retângulo sólido (o `validate` acusa).
- Em SVG, converta texto em curvas: `<text>` depende das fontes instaladas e o resultado muda de máquina para máquina.

Os logos de exemplo (`luna-air`, `orbita-bank`, `vertex`) e o escudo do galaticos são fictícios.

## 3. Gerar os kits

```bash
npm run kit-generator -- generate --club galaticos-fc --seed 42
npm run kit-generator -- generate --all
```

Opções:

| Opção | Descrição |
|---|---|
| `--club <id>` | Clube em `clubs/<id>/club.json`. Use `--club` ou `--all` |
| `--all` | Gera todos os clubes de `clubs/` |
| `--type <tipo>` | Só `home`, `away` ou `third`. Sem ela, os três |
| `--seed <n>` | Inteiro de 0 a 4294967295. Sem ela, uma seed aleatória é sorteada e impressa (`Seed: N (<id>)`) |
| `--out <dir>` | Diretório dos PNGs. Padrão: `output/` na raiz do projeto; um caminho informado é relativo ao diretório atual |
| `--clubs <dir>` | Diretório dos clubes (padrão `clubs/` do projeto) |
| `--assets <dir>` | Pasta dos logos, com o `registry.json` (padrão `assets/` do projeto) |

Saída, por clube:

- `clubs/<id>/kits/{home,away,third}/kit.json`: definição de cada kit, versionável. `generatedWith.seed` guarda a seed usada. Gerar de novo sobrescreve.
- `output/<id>/2d/<slug>_{home,away,third}_2d.png`: PNG 414×414 com fundo transparente. O `<slug>` é o `id` com `-` trocado por `_` (ex.: `galaticos_fc_away_2d.png`).

Os três kits usam a mesma paleta e alternam os papéis das cores, para se distinguirem em campo:

| Kit | Cor base | Cor do padrão |
|---|---|---|
| Home | primary | secondary |
| Away | secondary | accent |
| Third | accent | primary |

Logos:

- Escudo no peito esquerdo do jogador, fabricante no direito, patrocinador no centro.
- A cor do patrocinador e do fabricante contrasta (WCAG ≥ 3) com todas as cores da camisa atrás do logo: primeiro uma cor da paleta, depois branco ou preto. Se nenhuma cor sozinha serve (por exemplo, logo sobre uma faixa branca num kit azul-marinho), o logo ganha um contorno numa segunda cor.
- A escolha fica no `kit.json`, por exemplo `"sponsor": { "id": "luna-air", "color": "primary", "outline": "secondary" }`. `color` e `outline` aceitam papel da paleta ou hex. `"badge": true` desenha o escudo.

A mesma seed sempre gera os mesmos kits, byte a byte, e `--type away` gera o mesmo Away da geração completa. Para seed que começa com `-`, o Node exige `--seed=-1` (com espaço, o `parseArgs` reclama de argumento ambíguo); de qualquer forma, seeds negativas, fracionárias, vazias ou maiores que 4294967295 são rejeitadas.

Com `--all`, cada clube recebe a própria seed, impressa no log. Com `--all --seed S`, a seed de cada clube é derivada de `S`; use a seed impressa com `--club` para reproduzir só aquele clube. Um clube com erro (inclusive logo não registrado ou arquivo faltando) não interrompe os demais: o comando imprime `Error: [<id>] ...`, termina com o resumo `Generated N of M clubs` e código de saída 1.

## 4. Ajustar à mão e renderizar

Edite o `kit.json` (cores, padrão, parâmetros, gola, mangas, `badge`, `sponsor`, `manufacturer`) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

O escudo vem de `clubs/<clubId>/logo.png` (`--clubs <dir>` muda a pasta de clubes) e os logos de `assets/` (`--assets <dir>`). Parâmetros de padrão fora da faixa são ajustados para o limite. Padrão desconhecido gera erro listando os conhecidos. Depois de editar, rode `validate`.

### Estilos disponíveis no uniforme

Os valores aceitos no `kit.json`. Valor fora da lista é rejeitado, exceto o parâmetro numérico de padrão, que é ajustado para o limite.

**Padrão da camisa** (`pattern.id`). O padrão pinta o `overlay` sobre a cor `base`; o `generate` sorteia o padrão pelos pesos do `club.json` (perfis de estilo e tradições, abaixo).

| `pattern.id` | Categoria | Aparência | Parâmetros (mín–máx, padrão) |
|---|---|---|---|
| `solid` | classic | Cor lisa, só a `base` | nenhum |
| `stripes` | classic | Listras verticais | `count` 3–15 inteiro, 7; `ratio` 0.2–0.4, 0.3 (fração de cada faixa que a listra ocupa) |
| `sash` | classic | Faixa diagonal no tronco | `width` 30–100, 70 (largura da faixa); `direction` 0 ou 1, 0 (`0` desce para a direita, `\`; `1` sobe, `/`) |
| `pinstripes` | classic | Listras verticais finas | `count` 12–30 inteiro, 20; `ratio` 0.08–0.2, 0.12 |
| `hoops` | classic | Listras horizontais | `count` 4–12 inteiro, 8; `ratio` 0.2–0.4, 0.3 |
| `diagonal` | modern | Listras diagonais paralelas, uma pelo centro | `count` 4–12 inteiro, 7; `ratio` 0.2–0.4, 0.3; `direction` 0 ou 1, 0 |
| `chevron` | retro | Faixa em V com vértice no centro | `depth` 0.35–0.6, 0.45 (altura do vértice); `width` 0.06–0.14, 0.1 (espessura) |
| `chest-band` | retro | Faixa horizontal no peito | `position` 0.35–0.6, 0.45 (altura do centro); `width` 0.1–0.22, 0.15 |
| `center-band` | retro | Faixa vertical central | `width` 0.08–0.2, 0.14 |
| `checkers` | modern | Xadrez | `size` 0.06–0.15, 0.1 (lado do quadrado) |
| `halves` | modern | Metades verticais | `side` 0 ou 1, 0 (`0` pinta o `overlay` à esquerda, `1` à direita) |
| `gradient` | modern | Degradê da `base` para o `overlay` na parte de baixo | `start` 0.58–0.72, 0.65 (altura onde começa) |

Tamanhos e posições dos padrões novos são frações da largura ou da altura da camisa. Os limites mantêm o `overlay` abaixo de metade do tronco, para a `base` continuar dominante; `halves` e `checkers` dividem o tronco ao meio de propósito. O `gradient` começa sempre abaixo dos logos. Para `pattern.base` e `pattern.overlay` use um papel de cor (`primary`, `secondary` ou `accent`); os dois precisam ser cores diferentes e distinguíveis.

**Gola** (`collar.style`), desenhada com a cor `collar.color` (um papel de cor):

| `collar.style` | Aparência |
|---|---|
| `round` | Gola redonda |
| `v-neck` | Gola em V |

**Mangas** (`sleeves.style`):

| `sleeves.style` | Aparência |
|---|---|
| `match-body` | A manga continua o padrão do corpo |
| `solid` | A manga é lisa, na cor `sleeves.color` (o gerador usa a cor do padrão) |

O punho tem cor própria em `sleeves.cuffColor` nos dois estilos.

**Calção e meias** (`shorts.color` e `socks.color`): só têm cor, sem estilo, e ainda não são desenhados no PNG 2D; entram no 3D (Fase 3c).

**Papéis de cor.** `primary`, `secondary` e `accent` apontam para `colors` no `kit.json`, então editar uma cor da paleta atualiza padrão, gola, mangas, calção e meias de uma vez. Só as cores dos logos podem ser um hex fixo.

**Perfis de estilo** (`style.categories` no `club.json`):

| Perfil | Pesos dos padrões |
|---|---|
| `classic` (padrão) | solid 40, stripes 35, sash 25 |
| `traditional` | solid 30, stripes 25, pinstripes 15, hoops 15, sash 10, halves 5 |
| `modern` | solid 10, diagonal 20, gradient 20, checkers 15, halves 15, chevron 10, sash 10 |
| `retro` | hoops 20, chest-band 20, center-band 20, chevron 20, stripes 10, solid 10 |

## 5. Validar

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- validate --club galaticos-fc
```

Confere o `club.json` e cada `kit.json` existente: schema, pasta certa, cores distinguíveis, padrão diferente da base, cores base diferentes entre Home, Away e Third, IDs de patrocinador e fabricante registrados, arquivos de logo presentes, válidos e com transparência, contraste dos logos com a camisa, estilos conhecidos e as tradições do clube (padrão proibido, padrão fora da lista do tipo e cor obrigatória ausente). Imprime `OK <id> (<n> kits)` ou `FAIL <id>` seguido das regras violadas, e termina com código 1 se algum clube falhar.

## 6. Pré-visualizar

```bash
npm run kit-generator -- preview
npm run kit-generator -- preview --club galaticos-fc
npm run kit-generator -- preview --club galaticos-fc --samples 24
```

Gera uma página HTML para abrir no navegador, com os kits lado a lado e, em cada um, o padrão, os parâmetros, a seed e as marcas. Sem `--club`, mostra os `kit.json` salvos de todos os clubes em `output/kit_preview.html`; um clube com erro é pulado e o comando termina com código 1. Com `--club`, só os daquele clube. Com `--samples <n>` (1 a 100), gera em memória os conjuntos das seeds 0 a n-1, sem gravar nenhum `kit.json`, em `output/kit_preview_<slug>.html`; para salvar o conjunto de que gostou, rode `generate --club <id> --seed <n>`. Opções: `--out <arquivo>`, `--clubs <dir>` e `--assets <dir>`.

## 7. Exportar para o FM26

Preencha `fmUniqueId` no `club.json` de cada clube com o Unique ID do clube no editor do FM26 (o projeto nunca inventa esse número) e gere os kits. Depois:

```bash
npm run export
```

O comando lê os `kit.json` salvos de **todos** os clubes de `clubs/`, renderiza os PNGs 2D e grava tudo em `output/fm26_export/`: um PNG por kit (`galaticos_fc_home_2d.png`, ...) e um único `config.xml` que mapeia cada PNG para `graphics/pictures/team/<fmUniqueId>/kits/<tipo>`. Os PNGs ficam na mesma pasta do `config.xml` porque o FM26 ignora caminhos com subpasta no `from`.

Cada clube precisa de `fmUniqueId` e dos kits `home` e `away`; `third` é opcional. Dois clubes com o mesmo `fmUniqueId` são rejeitados. Se qualquer clube tiver problema, nada é gravado: o comando lista os erros de todos os clubes (`Error: [<id>] ...`) e termina com código 1. O export sobrescreve os arquivos que gera e nunca apaga nada da pasta.

Opções: `--out <dir>` (pasta de saída; use uma pasta só do export, porque o comando se recusa a sobrescrever um `config.xml` que ele não gerou), `--clubs <dir>` e `--assets <dir>`.

Instalação no jogo: copie a pasta `output/fm26_export/` para dentro de `graphics/kits/` na pasta de usuário do FM26, `Documentos/Sports Interactive/Football Manager 26/` (o nome da subpasta é livre). É a pasta Documentos do Windows, a mesma em que o FM26 grava os saves (`games/`). Com o backup do OneDrive ligado, ela fica em `OneDrive/Documentos`, e o jogo ignora uma cópia em `C:/Users/<usuário>/Documents`. No teste, os kits apareceram no jogo sem desligar o cache de skin nem recarregar a skin.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
npm run format        # formata com Prettier (largura 160)
npm run format:check  # confere a formatação; faz parte do gate de cada fase
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas, validação, cor dos logos), `src/patterns` (12 padrões), `src/styles` (perfis de estilo e pesos do sorteio), `src/generator` (conjunto Home/Away/Third), `src/renderers` (camada de desenho compartilhada e renderer 2D com logos), `src/preview` (contact sheet HTML), `src/assets` (registry de logos), `src/fm26` (nomes de arquivo, `config.xml`, exporter e layout UV ainda hipotético), `src/io` (clubes, kits, JSON e arquivos de logo), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
