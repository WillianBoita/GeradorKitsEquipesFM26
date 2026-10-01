# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Planos de execução e status: `docs/superpowers/plans/`.

## Status

Fase 1 (MVP 2D) concluída: gera o kit Home de um clube e renderiza um PNG 2D 414×414. Ainda não existem kits Away/Third, textura 3D, `config.xml` nem exportação para o FM26 (Fases 2 e 3, ver `docs/superpowers/plans/2026-10-01-roadmap.md`).

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
- `fmUniqueId` é o Unique ID real do clube no FM26, como string de dígitos. Informe você mesmo; o código nunca o inventa. Nesta fase ele é só validado, ainda não é usado.
- `patternWeights` aceita os padrões `solid`, `stripes` e `sash`. Sem ele, valem os pesos padrão (40/35/25).
- Cores curtas ou maiúsculas (`#FFF`) são normalizadas para `#rrggbb` minúsculo.
- Chave desconhecida ou com typo (por exemplo `"fmUniqueID"`) é rejeitada com erro, tanto no `club.json` quanto no `kit.json`.

Exemplo pronto: `clubs/galaticos-fc/club.json`.

## 2. Gerar um kit

```bash
npm run kit-generator -- generate --club galaticos-fc --seed 42
```

Opções:

| Opção | Descrição |
|---|---|
| `--club <id>` | Obrigatória. Clube em `clubs/<id>/club.json` |
| `--seed <n>` | Inteiro de 0 a 4294967295. Sem ela, uma seed aleatória é sorteada e impressa (`Seed: N`) |
| `--out <dir>` | Diretório de saída dos PNGs (padrão `output`, relativo ao diretório atual) |
| `--clubs <dir>` | Diretório dos clubes (padrão `clubs/` do projeto) |

Saída:

- `clubs/<id>/kits/home/kit.json`: definição do kit, versionável. Gerar de novo sobrescreve.
- `output/<id>/2d/<slug>_home_2d.png`: PNG 414×414 com fundo transparente. O `<slug>` é o `id` com `-` trocado por `_` (ex.: `galaticos_fc_home_2d.png`).

A mesma seed sempre gera o mesmo kit, byte a byte. Anote a seed impressa para reproduzir um resultado sorteado. Para seed que começa com `-`, o Node exige `--seed=-1` (com espaço, o `parseArgs` reclama de argumento ambíguo); de qualquer forma, seeds negativas, fracionárias, vazias ou maiores que 4294967295 são rejeitadas.

## 3. Ajustar à mão e renderizar

Edite o `kit.json` (cores, padrão, parâmetros, gola, mangas) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

Parâmetros de padrão fora da faixa são ajustados para o limite. Padrão desconhecido gera erro listando os conhecidos.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
```

`build` gera `dist/cli/index.js`, executável com `node dist/cli/index.js generate ...`. O comando global `kit-generator` só existe se você rodar `npm link` por conta própria.

Estrutura: `src/core` (RNG, cores, schemas), `src/patterns` (solid, stripes, sash), `src/generator`, `src/renderers` (2D), `src/fm26` (nomes de arquivo), `src/io` (clubes e JSON), `src/cli`. Só o generator usa aleatoriedade; renderers e padrões são determinísticos.
