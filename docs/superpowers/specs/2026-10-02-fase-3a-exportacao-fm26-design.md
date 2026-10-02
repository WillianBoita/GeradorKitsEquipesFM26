# Fase 3a — Exportação para o FM26 (`config.xml` e pacote de gráficos)

**Data:** 2026-10-02
**Specs de origem:** `fm26-kit-export-and-integration.md` (seções 2, 4, 5, 7, 8, 10, 11, 14, 16), `fm26-procedural-kit-generator-guide.md` (seções 18 e 27) e roadmap `docs/superpowers/plans/2026-10-01-roadmap.md` (Fase 3, passos 6 a 8).

## 1. Objetivo

Novo comando `kit-generator export` (`npm run export`) que lê os `kit.json` salvos de todos os clubes, renderiza os PNGs e grava, numa única pasta, os PNGs e um `config.xml` gerado. O usuário copia a pasta para o `graphics/` do FM26 e os kits aparecem no jogo sem editar XML.

Critério de sucesso: com `clubs/galaticos-fc` (`fmUniqueId` preenchido e os três kits salvos), `npm run export` grava `output/fm26_export/galaticos_fc_{home,away,third}_2d.png` e `output/fm26_export/config.xml` com três registros; um clube inválido aborta o export sem gravar nada; `npm test`, `npm run typecheck`, `npm run build` e `npm run format:check` verdes; o usuário instala a pasta no FM26 e vê os kits 2D do clube no jogo.

## 2. Escopo

A Fase 3 do roadmap foi dividida em duas:

- **3a (este documento):** exporter, `config.xml`, comando `export`, só com PNGs 2D.
- **3b (spec própria, depois):** organização dos assets de referência, layout UV como dado, renderer 3D, textura de calibração testada no jogo e inclusão do 3D no export.

O exporter vem primeiro porque qualquer textura, inclusive a de calibração da 3b, só chega ao jogo através de um `config.xml`. A 3a também valida no jogo o layout de pastas e o mapeamento antes do 3D.

Fora da 3a, por decisão explícita:

- `--club` e `--all` no `export`: o comando sempre processa todos os clubes (seção 5).
- `config.xml` por clube ou em subpastas: ver seção 3.
- Limpeza da pasta de saída: o export nunca apaga arquivos (seção 6.3).
- Parse de XML em runtime: o XML é bem formado por construção (seção 4.3); `fast-xml-parser` continua só como dev dependency.

## 3. Layout do pacote

```text
output/fm26_export/
├── config.xml
├── galaticos_fc_home_2d.png
├── galaticos_fc_away_2d.png
├── galaticos_fc_third_2d.png
└── <outros clubes>_<tipo>_2d.png
```

- Uma pasta só, um PNG por kit e um único `config.xml` para todos os clubes.
- O FM26 ignora `from` com subpasta (bug reportado no tracker da Sports Interactive: "FM26 ignores config.xml paths containing any subfolder or subdirectory"); por isso os PNGs ficam na mesma pasta do `config.xml` e o `from` é só o nome do arquivo sem `.png`. Isso substitui o layout `output/<id>/{2d,3d}/` + `config.xml` da seção 9 do spec de integração.
- Pasta padrão `output/fm26_export/`. O `_` impede colisão com `output/<id>/` do `generate`, porque o id de clube só aceita `[a-z0-9-]`.
- Os nomes já são únicos entre clubes (`naming.ts`: slug do `id` + tipo + render), então a pasta plana não tem conflito.

## 4. `config.xml`

### 4.1 Formato

```xml
<record>
    <boolean id="preload" value="false"/>
    <boolean id="amap" value="false"/>
    <list id="maps">
        <record from="galaticos_fc_home_2d" to="graphics/pictures/team/1/kits/home"/>
        <record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>
        <record from="galaticos_fc_third_2d" to="graphics/pictures/team/1/kits/third"/>
    </list>
</record>
```

- Sem declaração XML e sem comentários; indentação de 4 espaços; um registro por linha; quebra de linha no fim do arquivo.
- Ordem determinística: clubes em ordem alfabética de `id` (`listClubIds`), depois `RENDER_TYPES` (`2d`, `3d`), depois `KIT_TYPES` (`home`, `away`, `third`).
- `to`: `graphics/pictures/team/{fmUniqueId}/kits/{tipo}` para 2D e `graphics/pictures/team/{fmUniqueId}/kit_textures/{tipo}` para 3D.

### 4.2 Módulo `src/fm26/config-xml.ts`

Puro, sem I/O.

```ts
export interface ConfigRecord {
  from: string;
  to: string;
}

export function fmTargetPath(fmUniqueId: string, kitType: KitType, renderType: RenderType): string;
export function buildConfigXml(records: readonly ConfigRecord[]): string;
export function validateConfigRecords(records: readonly ConfigRecord[]): ValidationIssue[];
```

- `fmTargetPath` valida `fmUniqueId` com a mesma regex do schema (`^\d+$`) e `kitType` com `KitTypeSchema`.
- O `from` vem sempre de `kitAssetName` (`naming.ts`); nenhum outro lugar monta o nome.

`validateConfigRecords`:

| Regra | Quando falha |
|---|---|
| `invalid-from` | `from` fora de `^[a-z0-9_]+$` |
| `invalid-to` | `to` fora de `^graphics/pictures/team/\d+/(kits\|kit_textures)/(home\|away\|third)$` |
| `duplicate-from` | dois registros com o mesmo `from` |
| `duplicate-to` | dois registros com o mesmo `to` |

### 4.3 XML bem formado

`from` e `to` só contêm `[a-z0-9_/]` depois de `validateConfigRecords`, então não há o que escapar e o documento é bem formado por construção. Os testes conferem com `XMLValidator` do `fast-xml-parser`. O exporter roda `validateConfigRecords` antes de serializar.

## 5. Exporter

### 5.1 Módulo `src/fm26/exporter.ts`

```ts
export type RenderKit = (kit: KitDefinition, renderType: RenderType) => Promise<Buffer>;

export interface ExportOptions {
  clubsDir: string;
  outDir: string;
  renderTypes: readonly RenderType[];
  renderKit: RenderKit;
}

export interface ExportedClub {
  club: ClubIdentity;
  kitTypes: KitType[];
}

export interface ExportResult {
  clubs: ExportedClub[];
  configFile: string;
  recordCount: number;
}

export interface ClubExportFailure {
  clubId: string;
  issues: ValidationIssue[];
}

export class ExportAbortedError extends Error {
  readonly failures: ClubExportFailure[];
  readonly clubCount: number;
}

export const FM26_RENDER_SIZES: Record<RenderType, number> = { "2d": 414, "3d": 1024 };

export async function exportKits(options: ExportOptions): Promise<ExportResult>;
```

- O renderer chega injetado em `renderKit`: o exporter não conhece padrão, logo nem renderer (seção 14 do spec de integração). A CLI liga `loadKitLogos` + `renderKit2dPng`.
- Na 3a a CLI passa `renderTypes: ["2d"]`; a 3b acrescenta `"3d"` e o renderer 3D na mesma função injetada.
- `FM26_RENDER_SIZES` é o requisito do FM (seção 6 do spec de integração), independente de `KIT_2D_SIZE` do renderer.
- `ExportAbortedError.message` = `Export aborted, nothing was written (<n> of <total> clubs failed)`; `failures` traz as issues de cada clube com falha, na ordem de `listClubIds`.

### 5.2 Fluxo

Tudo ou nada: o export percorre todos os clubes acumulando problemas e só grava se nenhum clube falhou.

1. `listClubIds(clubsDir)`. Diretório sem clubes: erro `No clubs found in <dir>`, como no `generate --all`.
2. **Carga e validação por clube.** `loadClub`; `loadKit` para `home`, `away` e `third`. Erro de leitura ou de schema vira issue `invalid-file` com a mensagem original. Regras de export (seção 6.1).
3. **Validação entre clubes.** `duplicate-fm-unique-id` (seção 6.2), marcada em todos os clubes envolvidos.
4. **Renderização em memória.** Para cada clube sem issues, cada kit presente e cada `renderType`: `renderKit`, depois a checagem do PNG (seção 6.1, `invalid-render`). Exceção do renderer (por exemplo, logo ausente) vira issue `render-failed` com a mensagem original. Um clube com falha não interrompe os outros, para listar todos os problemas de uma vez.
5. Se algum clube tem issues: lança `ExportAbortedError` e nada é gravado.
6. **Registros.** Monta os `ConfigRecord` na ordem da seção 4.1 e roda `validateConfigRecords`. Issue aqui é bug de programa: lança `Error` com as issues formatadas, antes de gravar.
7. **Gravação.** `mkdir -p outDir`; grava todos os PNGs em `exportFilePath(...)`; grava `config.xml` por último.
8. **Conferência.** Todo `from` tem `<outDir>/<from>.png` no disco; senão lança `Error` (`config.xml references <from> but <arquivo> was not written`).

Memória: o pacote inteiro fica em memória antes da gravação. 32 clubes × 3 kits × (2D ~50 KB + 3D ~1 MB na 3b) fica na casa de 100 MB, aceitável para uma CLI.

### 5.3 Caminhos (`src/config/paths.ts`)

- `FM26_EXPORT_DIR = <projeto>/output/fm26_export`, padrão do `--out`. Valor informado é relativo ao diretório atual, como os demais.
- `exportFilePath(outDir, clubId, kitType, renderType)` = `<outDir>/<kitAssetFileName(...)>`.
- `CONFIG_XML_FILE = "config.xml"` e `exportConfigPath(outDir)`.

## 6. Validações

### 6.1 Por clube

| Regra | Quando falha | Mensagem |
|---|---|---|
| `invalid-file` | `club.json` ou `kit.json` ilegível ou fora do schema | mensagem original de `loadClub`/`loadKit` |
| `missing-fm-unique-id` | `club.json` sem `fmUniqueId` | `Club "galaticos-fc" has no fmUniqueId` |
| `missing-kit` | falta `home` ou `away` | `Club "galaticos-fc" has no away kit (expected <caminho do kit.json>)` |
| `render-failed` | `renderKit` lançou | mensagem original, prefixada pelo kit e render (`home 2d: ...`) |
| `invalid-render` | buffer não é PNG ou tem dimensão diferente de `FM26_RENDER_SIZES` | `home 2d render is 400×400, expected 414×414` |

- `fmUniqueId` numérico e `id`/`name` presentes já são garantidos pelo schema de `club.json` (`invalid-file` quando violados).
- `third` ausente não é erro: o clube só gera menos registros.
- `invalid-render` usa `sharp(buffer).metadata()` (`format === "png"`, `width`, `height`). O buffer vem do próprio renderer, sem risco de PNG truncado; a checagem protege contra erro de programa no renderer, não contra arquivo corrompido.
- O export não roda `validateKit`/`validateKitSet`: coerência visual é papel do `validate`. Um kit que carrega e renderiza é exportável.

### 6.2 Entre clubes

`duplicate-fm-unique-id`: dois ou mais clubes com o mesmo `fmUniqueId`. Mensagem em cada clube envolvido: `fmUniqueId "1" is also used by club "<outro id>"`. Sem essa regra o `config.xml` teria `to` duplicado e o FM usaria só um dos kits.

### 6.3 Arquivos existentes

O export sobrescreve os PNGs e o `config.xml` que gera e nunca apaga nada. PNG antigo sem registro no `config.xml` fica inerte: o FM só aplica o que o `config.xml` mapeia. Isso também torna seguro apontar `--out` direto para uma pasta dentro do `graphics/` do FM26.

## 7. CLI

```
kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]
```

- Script `npm run export` (`"export": "tsx src/cli/index.ts export"` em `package.json`).
- Carrega o registry de assets uma vez; `renderKit` = `loadKitLogos(kit, registry, dirs)` + `renderKit2dPng(kit, { logos })`.
- Sucesso: uma linha por clube no stdout (`Exported Galáticos FC: home, away, third`) e no fim `Wrote 3 records to <outDir>/config.xml`. Exit 0.
- `ExportAbortedError`: para cada clube com falha, `Error: [<id>] Club cannot be exported:` seguido de `formatIssues` no stderr; no fim `Error: Export aborted, nothing was written (<n> of <total> clubs failed)`. Exit 1.
- Outros erros (registry inválido, sem clubes, falha de escrita): `Error: <mensagem>` e exit 1, pelo `catch` atual de `runCli`.
- `USAGE` ganha a linha do `export`.

## 8. Dados

- `clubs/galaticos-fc/club.json` ganha `"fmUniqueId": "1"`. Valor provisório informado pelo usuário em 2026-10-02; deve ser trocado pelo Unique ID real do clube substituído antes do teste no jogo. Se o ID `1` não existir no banco do FM26, o jogo não mostra os kits, e isso não é bug do exporter.
- O teste "loads the bundled galaticos-fc club" passa a afirmar `fmUniqueId === "1"` (pendência herdada da Fase 1).

## 9. Testes desta fase

- `tests/fm26/config-xml.test.ts`: `fmTargetPath` (2D, 3D, ID inválido, tipo inválido); `buildConfigXml` com saída exata para os três registros 2D do Galáticos e para lista vazia; saída válida em `XMLValidator`; ordem preservada; cada regra de `validateConfigRecords` com caso que passa e caso que falha.
- `tests/fm26/exporter.test.ts`, com renderer falso que devolve PNG real do tamanho pedido via Sharp e registra as chamadas:
  - caminho feliz: PNGs e `config.xml` gravados, conteúdo do XML, `ExportResult`;
  - `third` ausente: dois registros;
  - dois clubes: ordem alfabética no XML;
  - `missing-fm-unique-id`, `missing-kit`, `invalid-file`, `duplicate-fm-unique-id`, `render-failed` e `invalid-render` (tamanho errado e buffer que não é PNG): `ExportAbortedError` com a regra certa e pasta de saída vazia;
  - dois clubes com falhas diferentes: as duas listadas no mesmo erro;
  - clube com falha não impede a renderização dos outros (o renderer falso é chamado para eles);
  - arquivos já existentes na pasta de saída não são apagados;
  - `renderTypes: ["2d", "3d"]` gera os registros 3D com `kit_textures` (prepara a 3b, renderer falso).
- `tests/cli/run-cli.test.ts`: `export` ponta a ponta com o renderer real sobre `makeClubsDir` + `makeAssetsDir` (PNGs 414×414 e `config.xml` gravados); clube sem `fmUniqueId` gera exit 1, mensagens no stderr e pasta vazia; `USAGE` com a linha nova.
- `tests/io/club-repository.test.ts`: `fmUniqueId` do Galáticos.

## 10. Documentação

Ao final: `README.md` (seção "Exportar para o FM26": comando, pasta gerada, onde copiar dentro de `Documents/Sports Interactive/Football Manager 26/graphics/`, recarregar a skin e desligar o cache de gráficos, com os passos confirmados no teste do usuário), `CLAUDE.md` (comando `export`, módulos `fm26/config-xml.ts` e `fm26/exporter.ts`, pasta plana por causa do bug de subpasta, export tudo ou nada) e roadmap (Fase 3 dividida em 3a/3b, status da 3a, decisões novas, layout do spec de integração substituído).

## 11. Notas para a 3b (levantadas nesta sessão)

Leitura de `docs/fm_templates/template.png`, `uv.webp` e das máscaras `FM26 3D Assets/NN-V.png`, a confirmar com a textura de calibração:

- O tronco é uma ilha em cruz centrada na gola (~515, 595 em 1024×1024): coluna central x ≈ 357–668, y ≈ 128–1012; asas laterais x ≈ 242–357 e 668–782, y ≈ 408–722.
- Metade de baixo da coluna = frente, em pé (quadrados de escudo e fabricante em ~455,690 e ~573,690). Metade de cima = costas, girada 180° ("BOLID 74" de cabeça para baixo e com ordem invertida).
- Consequência: o padrão das costas é o padrão da frente refletido na linha horizontal da gola (linha do ombro), o que deixa o desenho contínuo sobre o ombro. A máscara de faixa diagonal do FM (`08-0`) aparece como uma divisa `>` com vértice nessa linha, coerente com isso.
- As asas são a manga curta; a borda externa é o punho (barras azuis em x ≈ 244–270 e 756–782 na máscara `01-0`). Os cantos superiores (`RIGHT/LEFT SLEEVE`) são as mangas. Meias nas laterais do meio, calção nos cantos inferiores, como no `template.png`.
- As máscaras do FM pintam a textura inteira e opaca; o padrão fica só na coluna central e as mangas recebem cor lisa. Retângulos com sobra por região bastam; polígonos exatos não são necessários.
- O anel azul em volta da gola na máscara `01-0` é o acabamento da gola (cor 3).
- `FM26 3D Assets/04-0.png` está corrompido (só bytes zero).
- A `uv.webp` duplicada na raiz do repositório já foi removida; resta a de `docs/fm_templates/`.
