# Guia: gerar uniformes novos

Passo a passo para gerar os uniformes (Home, Away e Third) de um clube ou de todos os clubes e levá-los ao FM26. Todos os comandos rodam a partir da raiz do projeto. Para a referência completa de opções, padrões e regras, veja o `README.md`.

## Visão geral

1. Cadastrar o clube (`clubs/<id>/club.json`, e o escudo opcional).
2. Escolher a seed pré-visualizando amostras.
3. Gerar e salvar os kits.
4. Validar.
5. Ajustar à mão, se quiser.
6. Exportar para o FM26.

A mesma seed gera sempre os mesmos kits. Por isso o `kit.json` guarda a seed usada em `generatedWith.seed`.

## 1. Uniforme novo para um clube

### 1.1 Criar o clube

Crie `clubs/<id>/club.json`. O `id` usa só minúsculas, dígitos e `-`, e precisa ser igual ao nome da pasta.

```json
{
  "id": "meu-clube",
  "name": "Meu Clube",
  "fmUniqueId": "2000778260",
  "palette": { "primary": "#123456", "secondary": "#FFFFFF", "accent": "#FFD700" },
  "style": { "categories": ["modern"] },
  "sponsors": { "luna-air": 3, "orbita-bank": 1 },
  "manufacturers": { "vertex": 1 }
}
```

Só `id`, `name` e `palette.primary` são obrigatórios. Os demais campos:

- `palette.secondary` e `palette.accent`: se faltarem, são derivados da primária. As cores precisam ser distinguíveis entre si (distância OKLab de pelo menos 0.15).
- `fmUniqueId`: Unique ID do clube no editor do FM26, como string numérica. Informe você mesmo; o projeto nunca o inventa. Só o `export` exige.
- `style.categories`: `classic` (padrão), `traditional`, `modern` ou `retro`. Define quais padrões de camisa podem ser sorteados.
- `style.patternWeights`: pesos por padrão. Substitui os perfis de estilo.
- `traditions`: regras fixas do clube (padrões proibidos, padrões por tipo de kit, cor obrigatória).
- `sponsors` e `manufacturers`: IDs de `assets/registry.json` com pesos. Sem a chave, o kit sai sem a marca.
- Escudo: PNG com fundo transparente em `clubs/<id>/logo.png`. Sem o arquivo, o kit sai sem escudo.

Chave desconhecida ou com typo (por exemplo `fmUniqueID`) é erro de propósito.

### 1.2 Cadastrar marcas novas (opcional)

Para usar um patrocinador ou fabricante que ainda não existe, coloque o arquivo (`.png` ou `.svg`, com transparência) em `assets/sponsors/` ou `assets/manufacturers/` e registre em `assets/registry.json`:

```json
{ "id": "meu-patrocinador", "name": "Meu Patrocinador", "file": "sponsors/meu-patrocinador.svg" }
```

O logo é usado como silhueta: só a transparência importa e o gerador escolhe uma cor com contraste. Em SVG, converta texto em curvas.

### 1.3 Escolher a seed

Gere amostras em memória, sem gravar nada, e abra o HTML no navegador:

```bash
npm run kit-generator -- preview --club meu-clube --samples 24
```

O arquivo sai em `output/kit_preview_<slug>.html`, com seeds de 0 a 23. Cada cartão mostra o padrão, os parâmetros, a seed e as marcas. Anote a seed do conjunto de que gostou. Se nenhum agradar, aumente `--samples` (até 100) ou ajuste o `club.json` (estilo, pesos, tradições) e repita.

### 1.4 Gerar e salvar

```bash
npm run kit-generator -- generate --club meu-clube --seed 42
```

Sem `--seed`, o comando sorteia uma e imprime `Seed: N (<id>)`; guarde esse número para reproduzir o resultado.

Saída:

- `clubs/meu-clube/kits/{home,away,third}/kit.json`: definição de cada kit (versionável).
- `output/meu-clube/2d/meu_clube_{home,away,third}_2d.png`: PNG 414×414.

Para salvar só um tipo, use `--type home|away|third`. O conjunto inteiro é sempre gerado; `--type` apenas filtra o que é gravado, e o resultado é igual ao da geração completa.

Os três kits usam a mesma paleta com papéis rotacionados:

| Kit | Cor base | Cor do padrão |
| --- | --- | --- |
| Home | primary | secondary |
| Away | secondary | accent |
| Third | accent | primary |

### 1.5 Validar

```bash
npm run kit-generator -- validate --club meu-clube
```

Imprime `OK <id> (<n> kits)` ou `FAIL <id>` com as regras violadas (cores indistinguíveis, padrão igual à base, logo sem contraste, tradição desrespeitada, asset não registrado etc.).

### 1.6 Ajustar à mão (opcional)

Edite o `kit.json` (cores, padrão e parâmetros, gola, mangas, marcas) e renderize sem sortear nada:

```bash
npm run kit-generator -- render --definition clubs/meu-clube/kits/home/kit.json --out output/preview.png
```

Rode `validate` depois de editar. Atenção: gerar de novo **sobrescreve** o `kit.json`, e as edições manuais se perdem.

## 2. Uniformes de todos os clubes

### 2.1 Gerar

```bash
npm run kit-generator -- generate --all
npm run kit-generator -- generate --all --seed 42
```

- Sem `--seed`, cada clube recebe uma seed própria, impressa no log (`Seed: N (<id>)`).
- Com `--all --seed S`, a seed de cada clube é derivada de `S` e do `id` do clube. Para reproduzir só um clube, use a seed impressa com `--club <id> --seed <ela>`.
- Um clube com erro não interrompe os outros: o comando imprime `Error: [<id>] ...`, termina com `Generated N of M clubs` e código de saída 1.
- `--all` sobrescreve os `kit.json` de todos os clubes. Se algum já foi ajustado à mão ou aprovado, faça commit antes ou gere só os clubes necessários com `--club`.

### 2.2 Conferir

```bash
npm run kit-generator -- validate --all
npm run kit-generator -- preview
```

O `preview` sem `--club` mostra os kits salvos de todos os clubes em `output/kit_preview.html`. Troque o kit de um clube que não agradou com `generate --club <id> --seed <outra>`.

## 3. Exportar para o FM26

Requisitos: todo clube tem `fmUniqueId` (únicos entre si) e os kits `home` e `away` gerados. O `third` é opcional.

```bash
npm run export
```

O export lê os `kit.json` salvos de **todos** os clubes e grava em `output/fm26_export/` um PNG por kit (`meu_clube_home_2d.png`, ...) e um único `config.xml`. É tudo ou nada: se qualquer clube tiver problema, nada é gravado e o comando lista os erros de cada clube.

Para instalar, copie `output/fm26_export/` para `graphics/kits/` dentro da pasta de usuário do FM26 (`Documentos/Sports Interactive/Football Manager 26/`). Essa é a pasta Documentos do Windows, a mesma onde o jogo grava os saves (`games/`). Com OneDrive ativo, ela fica em `OneDrive/Documentos`; uma cópia em `C:/Users/<usuário>/Documents` é ignorada.

O export nunca apaga arquivos e se recusa a sobrescrever um `config.xml` que ele não gerou. Use uma pasta só para ele (`--out <dir>`).

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Erro de schema com nome de chave | Typo no `club.json` ou `kit.json` (schema estrito) |
| Erro de cores indistinguíveis | Duas cores da paleta com distância OKLab menor que 0.15 |
| `unknown-asset` / arquivo de logo ausente | ID em `sponsors`/`manufacturers` não está no `registry.json`, ou o arquivo não existe |
| `unknown-style` | Categoria fora de `classic`, `traditional`, `modern`, `retro` |
| `tradition-conflict` | Padrão ao mesmo tempo proibido e permitido, ou tipo de kit sem padrão possível |
| `Error: Export aborted` | Algum clube sem `fmUniqueId`, sem kit `home`/`away`, ou com ID duplicado |
| Kits não aparecem no jogo | Pasta copiada para o Documentos errado (ver seção 3) |
| `format:check` falha após `git checkout`/`stash` | Arquivos regravados em CRLF; volte para LF com `sed -i 's/\r$//'` |
