# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Specs, planos de execução e status: `docs/superpowers/`.

## Status

Fase 2a concluída: gera os kits Home, Away e Third de um clube com a mesma paleta, valida a coerência das cores e renderiza um PNG 2D 414×414 por kit. Ainda não existem escudo, patrocinadores e fabricantes (Fase 2b), textura 3D, `config.xml` nem exportação para o FM26 (Fase 3). Ver `docs/superpowers/plans/2026-10-01-roadmap.md`.

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
  "style": { "categories": ["modern"], "patternWeights": { "solid": 20, "stripes": 40, "sash": 40 } }
}
```

- Só `id`, `name` e `palette.primary` são obrigatórios.
- `secondary` e `accent` ausentes são derivados da cor primária.
- As cores informadas precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15). Cores quase iguais são rejeitadas, porque cada uma vira a cor base de um kit.
- `fmUniqueId` é o Unique ID real do clube no FM26, como string de dígitos. Informe você mesmo; o código nunca o inventa. Nesta fase ele é só validado, ainda não é usado.
- `patternWeights` aceita os padrões `solid`, `stripes` e `sash`, com pesos de 0 a 1.000.000. Sem ele, valem os pesos padrão (40/35/25).
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

Exemplo pronto: `clubs/galaticos-fc/club.json`.

## 2. Gerar os kits

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

Saída, por clube:

- `clubs/<id>/kits/{home,away,third}/kit.json`: definição de cada kit, versionável. `generatedWith.seed` guarda a seed usada. Gerar de novo sobrescreve.
- `output/<id>/2d/<slug>_{home,away,third}_2d.png`: PNG 414×414 com fundo transparente. O `<slug>` é o `id` com `-` trocado por `_` (ex.: `galaticos_fc_away_2d.png`).

Os três kits usam a mesma paleta e alternam os papéis das cores, para se distinguirem em campo:

| Kit | Cor base | Cor do padrão |
|---|---|---|
| Home | primary | secondary |
| Away | secondary | accent |
| Third | accent | primary |

A mesma seed sempre gera os mesmos kits, byte a byte, e `--type away` gera o mesmo Away da geração completa. Para seed que começa com `-`, o Node exige `--seed=-1` (com espaço, o `parseArgs` reclama de argumento ambíguo); de qualquer forma, seeds negativas, fracionárias, vazias ou maiores que 4294967295 são rejeitadas.

Com `--all`, cada clube recebe a própria seed, impressa no log. Com `--all --seed S`, a seed de cada clube é derivada de `S`; use a seed impressa com `--club` para reproduzir só aquele clube. Um clube com erro não interrompe os demais: o comando imprime `Error: [<id>] ...`, termina com o resumo `Generated N of M clubs` e código de saída 1.

## 3. Ajustar à mão e renderizar

Edite o `kit.json` (cores, padrão, parâmetros, gola, mangas) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Parâmetros de padrão fora da faixa são ajustados para o limite. Padrão desconhecido gera erro listando os conhecidos. Depois de editar, rode `validate`.

## 4. Validar

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- validate --club galaticos-fc
```

Confere o `club.json` e cada `kit.json` existente: schema, pasta certa, cores distinguíveis, padrão diferente da base e cores base diferentes entre Home, Away e Third. Imprime `OK <id> (<n> kits)` ou `FAIL <id>` seguido das regras violadas, e termina com código 1 se algum clube falhar.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
npm run format        # formata com Prettier (largura 160)
npm run format:check  # confere a formatação; faz parte do gate de cada fase
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas, validação), `src/patterns` (solid, stripes, sash), `src/generator` (conjunto Home/Away/Third), `src/renderers` (2D), `src/fm26` (nomes de arquivo), `src/io` (clubes, kits e JSON), `src/config` (diretórios), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
