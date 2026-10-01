# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Specs, planos de execução e status: `docs/superpowers/`.

## Status

Fase 2b concluída: gera os kits Home, Away e Third de um clube com a mesma paleta, valida a coerência das cores e renderiza um PNG 2D 414×414 por kit, com escudo, patrocinador e fabricante. Ainda não existem textura 3D, `config.xml` nem exportação para o FM26 (Fase 3). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.

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
  "fmUniqueId": "123456789",
  "palette": { "primary": "#123456", "secondary": "#FFFFFF", "accent": "#FFD700" },
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

- Só `id`, `name` e `palette.primary` são obrigatórios.
- `secondary` e `accent` ausentes são derivados da cor primária.
- As cores informadas precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15). Cores quase iguais são rejeitadas, porque cada uma vira a cor base de um kit.
- `fmUniqueId` é o Unique ID real do clube no FM26, como string de dígitos. Informe você mesmo; o código nunca o inventa. Nesta fase ele é só validado, ainda não é usado.
- `patternWeights` aceita os padrões `solid`, `stripes` e `sash`, com pesos de 0 a 1.000.000. Sem ele, valem os pesos padrão (40/35/25).
- `sponsors` e `manufacturers` são opcionais: IDs do registry de logos (seção 2) com pesos de 0 a 1.000.000. Cada geração sorteia um patrocinador e um fabricante para o conjunto: Home, Away e Third usam os mesmos. Sem a chave, os kits saem sem patrocinador ou sem fabricante.
- Escudo: coloque um PNG com fundo transparente em `clubs/<id>/logo.png`. Ele aparece com as cores originais. Sem o arquivo, os kits saem sem escudo.
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

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

## 5. Validar

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- validate --club galaticos-fc
```

Confere o `club.json` e cada `kit.json` existente: schema, pasta certa, cores distinguíveis, padrão diferente da base, cores base diferentes entre Home, Away e Third, IDs de patrocinador e fabricante registrados, arquivos de logo presentes, válidos e com transparência, e contraste dos logos com a camisa. Imprime `OK <id> (<n> kits)` ou `FAIL <id>` seguido das regras violadas, e termina com código 1 se algum clube falhar.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
npm run format        # formata com Prettier (largura 160)
npm run format:check  # confere a formatação; faz parte do gate de cada fase
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas, validação, cor dos logos), `src/patterns` (solid, stripes, sash), `src/generator` (conjunto Home/Away/Third), `src/renderers` (2D com logos), `src/assets` (registry de logos), `src/fm26` (nomes de arquivo), `src/io` (clubes, kits, JSON e arquivos de logo), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
