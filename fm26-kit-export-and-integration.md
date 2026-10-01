# FM26 — Especificação de Integração e Exportação de Kits

Documento complementar ao guia principal do gerador procedural de kits. Define como o resultado deve ser organizado e integrado ao Football Manager 26.

## 1. Princípio

O `config.xml` é um **artefato gerado**, não um arquivo mantido manualmente.

```text
Club Identity
  ↓
KitDefinition
  ↓
2D Renderer / 3D Renderer
  ↓
PNG
  ↓
FM26 Exporter
  ├── arquivos PNG
  └── config.xml
```

## 2. Identificação do clube

Usar o **Unique ID numérico do clube no FM**.

Exemplo:

```json
{
  "id": "galaticos-fc",
  "name": "Galáticos FC",
  "fmUniqueId": "123456789"
}
```

Separar:

- `id`: identificador interno e estável do projeto;
- `fmUniqueId`: identificador real do clube no Football Manager.

O programa **não deve derivar nem inventar** o `fmUniqueId` a partir do nome.

O usuário deve obter o ID do clube efetivamente existente no FM/Editor e informá-lo ao projeto.

## 3. Estrutura de dados

Recomendação:

```text
clubs/
└── galaticos-fc/
    ├── club.json
    ├── logo.png
    └── kits/
        ├── home/
        ├── away/
        └── third/
```

`club.json`:

```json
{
  "id": "galaticos-fc",
  "name": "Galáticos FC",
  "fmUniqueId": "123456789"
}
```

## 4. Convenção de nomes

Formato:

```text
{club-slug}_{kit-type}_{render-type}.png
```

Exemplos:

```text
galaticos_fc_home_2d.png
galaticos_fc_away_2d.png
galaticos_fc_third_2d.png
galaticos_fc_home_3d.png
galaticos_fc_away_3d.png
galaticos_fc_third_3d.png
```

Regras:

- minúsculas;
- sem espaços;
- sem acentos;
- sem caracteres especiais;
- `_` como separador;
- nomes determinísticos;
- `.png` como extensão.

O `from` do XML usa o nome sem `.png`:

```xml
from="galaticos_fc_home_3d"
```

e não:

```xml
from="galaticos_fc_home_3d.png"
```

O Unique ID não precisa fazer parte do filename.

## 5. Diretórios FM26

### 2D

```text
graphics/pictures/team/{FM_UNIQUE_ID}/kits/{home|away|third}
```

### 3D

```text
graphics/pictures/team/{FM_UNIQUE_ID}/kit_textures/{home|away|third}
```

Exemplo:

```text
graphics/pictures/team/123456789/kit_textures/home
```

## 6. Resoluções

### 2D

```text
414 × 414 px
PNG
```

### 3D

```text
1024 × 1024 px
PNG
```

O renderer 3D deve usar o layout/UV específico do FM26. Não assumir compatibilidade de templates de versões anteriores.

## 7. Formato do `config.xml`

Estrutura base:

```xml
<record>
    <boolean id="preload" value="false"/>
    <boolean id="amap" value="false"/>

    <list id="maps">

        <!-- 2D -->
        <record
            from="galaticos_fc_home_2d"
            to="graphics/pictures/team/123456789/kits/home"/>

        <record
            from="galaticos_fc_away_2d"
            to="graphics/pictures/team/123456789/kits/away"/>

        <record
            from="galaticos_fc_third_2d"
            to="graphics/pictures/team/123456789/kits/third"/>

        <!-- 3D -->
        <record
            from="galaticos_fc_home_3d"
            to="graphics/pictures/team/123456789/kit_textures/home"/>

        <record
            from="galaticos_fc_away_3d"
            to="graphics/pictures/team/123456789/kit_textures/away"/>

        <record
            from="galaticos_fc_third_3d"
            to="graphics/pictures/team/123456789/kit_textures/third"/>

    </list>
</record>
```

O exporter deve gerar todos esses registros automaticamente.

## 8. Relação PNG → XML

Exemplo:

```text
galaticos_fc_home_3d.png
```

gera:

```xml
<record
    from="galaticos_fc_home_3d"
    to="graphics/pictures/team/123456789/kit_textures/home"/>
```

O nome deve ser produzido uma única vez pelo exporter e reutilizado no XML.

## 9. Output

Por clube:

```text
output/
└── galaticos-fc/
    ├── 2d/
    │   ├── galaticos_fc_home_2d.png
    │   ├── galaticos_fc_away_2d.png
    │   └── galaticos_fc_third_2d.png
    ├── 3d/
    │   ├── galaticos_fc_home_3d.png
    │   ├── galaticos_fc_away_3d.png
    │   └── galaticos_fc_third_3d.png
    └── config.xml
```

Também deve ser possível exportar vários clubes em conjunto e produzir um `config.xml` consolidado.

## 10. Processo do exporter

```text
load club.json
  ↓
validate fmUniqueId
  ↓
load generated kits
  ↓
generate filenames
  ↓
generate XML records
  ↓
validate XML
  ↓
write config.xml
```

O usuário não deve precisar editar o XML.

## 11. Validações

### Clube

```text
fmUniqueId existe?
fmUniqueId é numérico?
id interno existe?
nome existe?
```

### Kits

```text
home existe?
away existe?
third é opcional?
```

### Arquivos

```text
filename válido?
filename duplicado?
PNG existe?
PNG possui resolução correta?
PNG é válido?
```

### XML

```text
XML é bem formado?
todo `from` corresponde a um arquivo?
todo `to` contém o FM Unique ID correto?
existem registros duplicados?
```

Exemplo de erro:

```text
ERROR: Club "galaticos-fc" has no fmUniqueId.
Export aborted.
```

## 12. Assets externos para a integração 3D

O principal asset externo é o **UV map do uniforme 3D do FM26**.

Organização:

```text
assets/
└── fm26/
    └── uv/
        └── fm26-kit-uv.png
```

Esse arquivo é uma referência técnica da malha/UV, não uma textura final.

Também é recomendado manter uma referência de layout/template, como o `blank_26.psd`:

```text
assets/
└── fm26/
    └── templates/
        └── blank_26.psd
```

O runtime não deve depender de Photoshop/GIMP. As informações necessárias devem ser convertidas para dados próprios.

Texturas reais do FM26 podem ser mantidas para validação:

```text
assets/
└── fm26/
    └── reference-kits/
        ├── reference-kit-01.png
        └── reference-kit-02.png
```

Templates de fabricantes podem ser referências opcionais.

## 13. Converter referência em dados próprios

Evitar coordenadas hard-coded:

```typescript
drawSponsor(432, 182);
drawLogo(721, 94);
```

Preferir:

```typescript
drawSponsor(layout.regions.front.sponsor);
drawLogo(layout.regions.front.clubBadge);
```

Com um arquivo como:

```text
assets/fm26/layout/fm26-kit-layout.json
```

Exemplo conceitual:

```json
{
  "textureSize": {
    "width": 1024,
    "height": 1024
  },
  "regions": {
    "front": {},
    "back": {},
    "leftSleeve": {},
    "rightSleeve": {},
    "collar": {}
  }
}
```

As coordenadas reais devem ser obtidas da referência/UV real do FM26.

## 14. Separação de responsabilidades

O renderer não deve saber que existe `config.xml`.

O exporter não deve saber como o padrão da camisa foi criado.

```text
KitDefinition
  ↓
Renderer
  ↓
PNG
  ↓
FM26 Exporter
  ↓
config.xml
```

Isso permite testar geração visual e integração separadamente.

## 15. Exportação de múltiplos clubes

Exemplos de comandos:

```bash
npm run export
npm run export -- --club galaticos-fc
npm run export -- --all
```

Saída:

```text
output/
├── galaticos-fc/
├── kong-team/
├── fnaf-team/
├── minecraft-team/
└── ps-team/
```

## 16. Regras para o agente de desenvolvimento

1. Nunca inventar um FM Unique ID.
2. Nunca derivar o Unique ID do nome do clube.
3. Nunca exigir edição manual do `config.xml`.
4. Nunca duplicar manualmente nomes de arquivos entre código e XML.
5. Gerar o XML a partir dos dados do projeto.
6. Manter `id` interno e `fmUniqueId` separados.
7. Não exigir o Unique ID no filename.
8. Validar IDs antes do export.
9. Validar correspondência entre `from` e arquivos.
10. Validar que o XML é bem formado.
11. Manter 2D e 3D como outputs independentes do mesmo `KitDefinition`.
12. Não assumir compatibilidade de templates antigos com FM26.
13. Não fazer o renderer depender de Photoshop/GIMP.
14. Tratar UV/template como assets de referência.
15. Converter conhecimento específico do template em dados próprios do projeto.

## 17. Estrutura final recomendada

```text
project/
├── assets/
│   └── fm26/
│       ├── uv/
│       │   └── fm26-kit-uv.png
│       ├── layout/
│       │   └── fm26-kit-layout.json
│       ├── templates/
│       │   └── blank_26.psd
│       └── reference-kits/
├── clubs/
│   ├── galaticos-fc/
│   │   ├── club.json
│   │   └── ...
│   ├── kong-team/
│   └── ...
├── src/
│   ├── generator/
│   ├── renderer-2d/
│   ├── renderer-3d/
│   └── exporter/
└── output/
```

O princípio central:

```text
FM Unique ID
  ↓
club.json
  ↓
FM26 Exporter
  ↓
filename + config.xml
  ↓
Football Manager 26
```

O `config.xml` deve ser tratado como **artefato gerado**, não como asset mantido manualmente.
