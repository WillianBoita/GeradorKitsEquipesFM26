# FM26 Procedural Kit Generator — Project Guide

## 1. Objetivo

Construir um gerador procedural de uniformes para Football Manager 2026 capaz de:

- gerar kits Home, Away e Third;
- produzir kits 2D e 3D a partir da mesma definição lógica;
- combinar automaticamente cores, padrões, gola, mangas, detalhes, patrocinadores e fabricante;
- gerar variações aleatórias, mas coerentes com a identidade de cada clube;
- permitir a criação de novos estilos/templates sem alterar o núcleo do programa;
- gerar os PNGs finais e os `config.xml` necessários para instalação no FM26;
- futuramente permitir uma interface visual para inspeção e edição, sem tornar a UI uma dependência do motor de geração.

O projeto deve ser tratado como um **motor procedural de design de uniformes**, e não como um simples editor de imagens.

---

## 2. Princípio central

A arquitetura deve separar:

1. **Identidade do clube**
2. **Regras de geração**
3. **Design abstrato do kit**
4. **Templates/padrões**
5. **Assets**
6. **Renderização 2D**
7. **Renderização 3D**
8. **Exportação para FM26**

Fluxo principal:

```text
Club Identity
      |
      v
Generation Rules
      |
      v
Kit Definition
      |
      +-------------------+
      |                   |
      v                   v
   2D Renderer         3D Renderer
      |                   |
      v                   v
  2D PNG              3D UV PNG
      |                   |
      +---------+---------+
                |
                v
          FM26 Export
                |
                v
           config.xml
```

O mesmo `KitDefinition` deve alimentar os dois renderizadores.

---

# 3. Tecnologias

## Obrigatórias / recomendadas

### TypeScript

Linguagem principal.

Motivos:

- tipagem forte;
- bom suporte para aplicações Node.js;
- facilidade para estruturar templates e schemas;
- possibilidade de reutilizar o núcleo posteriormente em uma aplicação web;
- ecossistema adequado para processamento de imagens e SVG.

### Node.js

Runtime inicial.

O gerador deve funcionar inicialmente como uma aplicação CLI/biblioteca, sem depender de browser.

### Sharp

Responsável principalmente por:

- composição de imagens;
- rasterização de SVG;
- resize;
- crop;
- transparência;
- blending;
- exportação PNG;
- processamento em lote.

Sharp deve ser o principal componente de rasterização/exportação.

### SVG

SVG deve ser usado como linguagem intermediária para elementos geométricos sempre que possível.

Isso permite representar:

- listras;
- diagonais;
- formas;
- gradientes;
- padrões;
- detalhes;
- elementos vetoriais.

Os designs não devem ser armazenados exclusivamente como imagens rasterizadas.

### SVG.js

Pode ser utilizado para facilitar a construção/manipulação programática de SVG.

Não deve ser obrigatório para todas as operações. SVG puro também é aceitável quando for mais simples.

### Color.js

Responsável por operações de cor.

Usar para:

- geração de variações;
- conversão entre espaços de cor;
- ajuste de luminosidade/saturação;
- cálculo de contraste;
- criação de paletas;
- validação de legibilidade.

### Fabric.js ou Konva

Não são dependências do núcleo inicial.

Podem ser adicionadas posteriormente se o projeto ganhar uma interface gráfica de edição.

---

# 4. Formato de dados

O motor não deve receber diretamente PNGs como definição de um uniforme.

A entrada principal deve ser uma estrutura declarativa.

Exemplo:

```ts
interface KitDefinition {
  clubId: string;

  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };

  pattern: PatternDefinition;

  collar: CollarDefinition;

  sleeves: SleeveDefinition;

  shorts: ShortsDefinition;

  socks: SocksDefinition;

  sponsor?: SponsorDefinition;

  manufacturer?: ManufacturerDefinition;

  details?: DetailDefinition[];
}
```

O formato deve ser serializável para JSON.

Isso permite:

- salvar kits;
- reproduzir uma geração;
- gerar milhares de kits;
- testar o renderer sem randomização;
- criar presets;
- versionar designs.

---

# 5. Identidade do clube

A identidade do clube deve ser separada da definição final do kit.

Exemplo:

```ts
interface ClubIdentity {
  clubId: string;
  name: string;

  palette: PaletteRules;

  style: StyleProfile;

  traditions?: TraditionRules;

  sponsors?: SponsorPool;

  manufacturer?: ManufacturerProfile;
}
```

A identidade determina limites e preferências.

Exemplo:

```json
{
  "clubId": "fnaf",
  "name": "FNAF",
  "style": {
    "categories": ["dark", "aggressive", "modern"],
    "patternFrequency": 0.8,
    "experimentalism": 0.6
  }
}
```

O gerador então cria kits dentro dessas características.

---

# 6. Randomização

A randomização deve ser **controlada**, não puramente aleatória.

Não fazer:

```text
random() -> qualquer coisa
```

Fazer:

```text
Club Identity
      |
      v
Allowed Options
      |
      v
Weighted Random Selection
      |
      v
Constraint Validation
      |
      v
Kit Definition
```

## Exemplo

Um clube tradicional pode ter:

```text
solid             40%
vertical stripes  25%
sash              15%
pinstripes        15%
experimental       5%
```

Um clube moderno pode ter:

```text
solid             10%
diagonal          25%
geometric         25%
gradient          15%
split              15%
experimental       10%
```

A randomização deve usar pesos configuráveis.

---

# 7. Regras de coerência

O gerador deve possuir uma camada de validação antes da renderização.

Exemplos:

- impedir texto escuro sobre fundo escuro;
- impedir patrocinador com contraste insuficiente;
- evitar primary e secondary praticamente idênticos;
- evitar combinações visualmente inválidas;
- manter cores importantes do clube;
- respeitar restrições de determinados templates;
- evitar excesso de elementos;
- garantir que o logo permaneça legível.

Conceitualmente:

```ts
const kit = generateKit(identity);

const validation = validateKit(kit);

if (!validation.valid) {
  regenerate();
}
```

A validação deve ser determinística quando possível.

---

# 8. Home / Away / Third

Home, Away e Third não devem ser três randomizações independentes.

Devem compartilhar uma identidade.

Exemplo:

```text
Club Identity
      |
      +----> Home
      |
      +----> Away
      |
      +----> Third
```

### Home

Deve normalmente priorizar a cor principal.

### Away

Pode priorizar a cor secundária ou uma combinação alternativa.

### Third

Pode permitir maior experimentação.

As três peças devem parecer pertencer ao mesmo clube.

---

# 9. Sistema de templates

Templates devem ser dados/configuração, não lógica fixa dentro do código.

Estrutura conceitual:

```text
templates/
├── solid/
├── stripes/
├── sash/
├── diagonal/
├── split/
├── gradient/
├── geometric/
└── retro/
```

Cada template deve declarar:

- nome;
- categoria;
- parâmetros disponíveis;
- cores utilizadas;
- regiões afetadas;
- restrições;
- peso/opções;
- eventualmente compatibilidade com determinados tipos de kit.

Exemplo:

```ts
interface PatternTemplate {
  id: string;
  name: string;
  category: string;

  parameters: Record<string, unknown>;

  render(context: RenderContext): SVGElement | string;
}
```

O código do template deve produzir geometria. Não deve produzir o PNG final.

---

# 10. Separar padrão de componentes

Não transformar um kit inteiro em um único template monolítico.

Separar:

```text
Base
Pattern
Collar
Sleeves
Cuffs
Shoulder details
Sponsor
Manufacturer logo
Club logo
Numbers
Additional details
```

Isso permite combinações.

Exemplo:

```text
Base: azul
Pattern: diagonal
Collar: V-neck
Sleeves: solid
Sponsor: branco
Details: vermelho
```

Outro kit pode usar:

```text
Base: azul
Pattern: pinstripes
Collar: round
Sleeves: stripes
Sponsor: branco
Details: vermelho
```

Sem criar dois templates completos.

---

# 11. Assets

Assets externos devem ficar separados do código.

Estrutura sugerida:

```text
assets/
├── clubs/
│   └── logos/
│
├── sponsors/
│
├── manufacturers/
│
├── fonts/
│
└── fm26/
    └── uv/
```

Os assets devem ser referenciados por ID.

Exemplo:

```ts
{
  id: "fazbear",
  file: "assets/sponsors/fazbear.png"
}
```

Não espalhar caminhos de arquivos pelo código.

---

# 12. Sistema de patrocinadores

Patrocinadores devem ser dados.

Exemplo:

```ts
interface SponsorDefinition {
  id: string;
  name: string;
  asset: string;

  preferredColors?: string[];

  allowedPositions: SponsorPosition[];

  minContrast?: number;
}
```

O gerador pode selecionar patrocinadores com pesos.

Também deve poder restringir:

- posição;
- escala;
- cor;
- compatibilidade com determinados estilos.

---

# 13. Sistema de cores

A cor não deve ser tratada apenas como strings RGB aleatórias.

O sistema deve compreender:

```text
Primary
Secondary
Accent
Neutral
Sponsor
Logo
Details
```

Deve ser possível gerar uma paleta a partir de uma identidade:

```text
Primary
    |
    +--> Secondary
    |
    +--> Accent
    |
    +--> Neutral
```

E aplicar regras de contraste.

Evitar simplesmente:

```ts
Math.random() * 255
```

para gerar cores.

A geração deve ser baseada em paletas coerentes.

---

# 14. Renderização 2D

O renderer 2D recebe um `KitDefinition`.

```text
KitDefinition
      |
      v
2D Renderer
      |
      v
SVG / composition
      |
      v
Sharp
      |
      v
414 × 414 PNG
```

O renderer 2D não deve conhecer regras de randomização.

Ele apenas renderiza uma definição já resolvida.

---

# 15. Renderização 3D

O renderer 3D também recebe o mesmo `KitDefinition`.

Porém, em vez de renderizar uma camisa frontal convencional, ele deve desenhar nas coordenadas da UV do FM26.

Fluxo:

```text
KitDefinition
      |
      v
3D Renderer
      |
      v
FM26 UV Layout
      |
      v
1024 × 1024 texture
      |
      v
PNG
```

A UV deve ser tratada como um asset/configuração externo.

Não hardcodar centenas de coordenadas diretamente dentro de funções de geração.

Exemplo:

```ts
interface UVRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FM26UVMap {
  shirtFront: UVRegion;
  shirtBack: UVRegion;
  leftSleeve: UVRegion;
  rightSleeve: UVRegion;
  collar: UVRegion;
  shorts: UVRegion;
  socks: UVRegion;
}
```

As coordenadas reais devem ser obtidas a partir do template/UV específico do FM26.

---

# 16. Resoluções FM26

O projeto deve trabalhar com os formatos utilizados pelos templates FM26.

## 2D

Target inicial:

```text
414 × 414
PNG
```

## 3D

Target inicial:

```text
1024 × 1024
PNG
```

A resolução 3D deve ser configurável no renderer, mas 1024×1024 deve ser o padrão.

Não assumir que templates de FM anteriores possuem a mesma UV.

O FM26 possui uma estrutura 3D específica associada ao novo pipeline gráfico/Unity.

---

# 17. Não acoplar o sistema ao Photoshop/GIMP

O projeto deve funcionar sem:

- Photoshop;
- GIMP;
- Photopea;
- Canva.

Arquivos PSD podem ser utilizados durante a fase de engenharia/referência para estudar ou preparar templates, mas não devem ser necessários para a geração.

O pipeline de produção deve ser:

```text
JSON
+
SVG
+
PNG assets
+
UV data
      |
      v
TypeScript
      |
      v
PNG
```

---

# 18. FM26 Export

A camada de exportação deve ser independente dos renderers.

Responsabilidades:

- gerar nomes corretos;
- organizar diretórios;
- gerar `config.xml`;
- associar cada asset ao ID do clube;
- copiar os arquivos para o layout de exportação.

Exemplo conceitual:

```text
output/
├── 2d/
│   ├── 1001_home.png
│   ├── 1001_away.png
│   └── 1001_third.png
│
├── 3d/
│   ├── 1001_home.png
│   ├── 1001_away.png
│   └── 1001_third.png
│
└── config.xml
```

A estrutura final pode ser ajustada ao formato esperado pelo FM26.

---

# 19. `config.xml`

A geração do XML deve ser feita por uma função própria.

Exemplo conceitual:

```ts
generateConfig({
  clubId,
  kitType,
  fileName
});
```

Os destinos 2D e 3D são diferentes:

```text
2D:
graphics/pictures/team/{ID}/kits/{home|away|third}

3D:
graphics/pictures/team/{ID}/kit_textures/{home|away|third}
```

Não duplicar lógica manualmente.

---

# 20. Reprodutibilidade

Toda geração aleatória deve aceitar uma seed.

Exemplo:

```bash
kit-generator generate --club galaticos --seed 12345
```

Com a mesma seed:

```text
seed 12345
    ↓
mesma identidade
    ↓
mesmas escolhas
    ↓
mesmo KitDefinition
    ↓
mesmo resultado
```

Isso é importante para:

- debugging;
- testes;
- comparação de versões;
- regeneração;
- publicação de resultados.

---

# 21. CLI

A primeira interface do projeto deve ser CLI.

Comandos esperados:

```bash
kit-generator generate
kit-generator generate --club galaticos
kit-generator generate --all
kit-generator generate --seed 12345
kit-generator validate
kit-generator export
```

Também deve existir uma forma de gerar um kit sem randomização:

```bash
kit-generator render --definition ./kit.json
```

Isso facilita testes do renderer.

---

# 22. Estrutura sugerida do projeto

```text
fm26-kit-generator/
│
├── src/
│   ├── core/
│   │   ├── kit.ts
│   │   ├── club.ts
│   │   ├── palette.ts
│   │   ├── random.ts
│   │   └── validation.ts
│   │
│   ├── patterns/
│   │   ├── solid.ts
│   │   ├── stripes.ts
│   │   ├── sash.ts
│   │   ├── diagonal.ts
│   │   ├── split.ts
│   │   ├── gradient.ts
│   │   └── geometric.ts
│   │
│   ├── components/
│   │   ├── collar.ts
│   │   ├── sleeves.ts
│   │   ├── cuffs.ts
│   │   └── details.ts
│   │
│   ├── renderers/
│   │   ├── renderer-2d.ts
│   │   ├── renderer-3d.ts
│   │   └── render-context.ts
│   │
│   ├── fm26/
│   │   ├── uv-map.ts
│   │   ├── config.ts
│   │   └── exporter.ts
│   │
│   ├── assets/
│   │   └── registry.ts
│   │
│   └── cli/
│       └── index.ts
│
├── data/
│   ├── clubs/
│   ├── templates/
│   ├── sponsors/
│   ├── manufacturers/
│   └── palettes/
│
├── assets/
│   ├── logos/
│   ├── sponsors/
│   ├── manufacturers/
│   └── fm26/
│
├── tests/
│
└── output/
```

---

# 23. Testes

O projeto deve ter testes para:

### Core

- mesma seed → mesmo resultado;
- cores válidas;
- IDs válidos;
- identidade válida;
- kit válido.

### Patterns

- cada pattern gera SVG válido;
- parâmetros extremos não quebram o renderer.

### Colors

- contraste mínimo;
- cores inválidas rejeitadas;
- geração de paleta determinística com seed.

### Renderers

- 2D produz 414×414;
- 3D produz 1024×1024;
- PNG é válido;
- transparência funciona quando necessária.

### Export

- `config.xml` válido;
- IDs corretos;
- caminhos corretos;
- Home/Away/Third corretos.

---

# 24. O que NÃO fazer

## Não colocar randomização dentro do renderer

Errado:

```ts
renderKit() {
  const color = randomColor();
}
```

Correto:

```text
Generator
   ↓
KitDefinition
   ↓
Renderer
```

O renderer deve ser determinístico.

## Não criar um template completo para cada combinação

Evitar:

```text
blue-diagonal-red-vneck.png
blue-diagonal-white-vneck.png
red-diagonal-white-vneck.png
...
```

Isso explode combinatorialmente.

Usar componentes parametrizados.

## Não depender de screenshots do FM

Screenshots podem ser usados para validação visual, não como fonte de dados do renderer.

## Não misturar 2D e 3D

Os dois compartilham o `KitDefinition`, mas possuem renderers diferentes.

## Não usar templates antigos sem validar a UV

A estrutura 3D do FM26 deve ser tratada separadamente das versões anteriores.

---

# 25. Evolução futura

A arquitetura deve permitir adicionar posteriormente:

### Interface Web

```text
React
   ↓
Kit Generator API
   ↓
Core
```

### Preview 3D

Um visualizador WebGL/Three.js pode futuramente aplicar a mesma textura 3D a um modelo para preview.

Isso não deve fazer parte do MVP.

### Editor

Fabric.js/Konva podem ser adicionados para edição manual.

### Geração em massa

```bash
kit-generator generate --all
```

### Packs

Gerar automaticamente:

```text
32 clubes
× 3 kits
× 2 formatos
= 192 PNGs
```

mais `config.xml`.

---

# 26. MVP

A primeira versão deve ser pequena.

## Fase 1

Implementar:

- TypeScript;
- Node.js;
- Sharp;
- SVG;
- Color.js;
- `KitDefinition`;
- paletas;
- seed;
- 3 padrões;
- 2D renderer;
- PNG 414×414.

## Fase 2

Adicionar:

- Home/Away/Third;
- patrocinadores;
- logos;
- fabricantes;
- validação;
- exportação em lote.

## Fase 3

Adicionar:

- FM26 UV;
- 3D renderer;
- PNG 1024×1024;
- `config.xml`.

## Fase 4

Adicionar:

- mais templates;
- identidades de clubes;
- pesos;
- regras avançadas;
- preview.

## Fase 5

Opcional:

- interface web;
- editor manual;
- preview 3D;
- geração em massa pela UI.

---

# 27. Critério de sucesso

O projeto será considerado funcional quando for possível fornecer algo como:

```json
{
  "clubId": "galaticos",
  "name": "Galáticos FC",
  "identity": {
    "primary": "#123456",
    "secondary": "#FFFFFF",
    "accent": "#FFD700",
    "style": "modern"
  }
}
```

e executar:

```bash
kit-generator generate --club galaticos --seed 42
```

obtendo:

```text
Galáticos FC
├── Home
│   ├── 2D PNG
│   └── 3D PNG
│
├── Away
│   ├── 2D PNG
│   └── 3D PNG
│
├── Third
│   ├── 2D PNG
│   └── 3D PNG
│
└── config.xml
```

com os três kits visualmente relacionados, mas suficientemente diferentes.

---

# 28. Decisão arquitetural final

A regra mais importante para o projeto é:

> **O design do uniforme deve existir como dados abstratos antes de virar imagem.**

Portanto:

```text
Club Identity
      ↓
Procedural Generator
      ↓
KitDefinition
      ↓
┌─────────────┬─────────────┐
│             │             │
2D Renderer  3D Renderer   Future Renderers
│             │
↓             ↓
PNG           PNG
```

Isso mantém o projeto extensível e permite que a mesma identidade de clube seja utilizada para diferentes formas de apresentação.

A tecnologia gráfica deve ser substituível. O núcleo do projeto não deve saber se o resultado será renderizado por Sharp, SVG, Canvas ou outra tecnologia.

---

# 29. Referências técnicas

Durante a implementação, consultar e validar contra:

- FM26 3D texture/template discussions da comunidade Sortitoutsi;
- FM26-specific 3D kit templates;
- FM Kit Creator;
- KitDesigner FM26;
- documentação oficial das bibliotecas utilizadas.

As dimensões de trabalho inicialmente adotadas são:

```text
2D: 414 × 414 PNG
3D: 1024 × 1024 PNG
```

Essas dimensões devem permanecer configuráveis caso futuras versões do FM ou novos templates exijam alterações.

---

# 30. Regra para o agente de desenvolvimento

Antes de implementar qualquer funcionalidade:

1. Não duplicar lógica entre 2D e 3D.
2. Não colocar randomização dentro dos renderers.
3. Não hardcodar assets.
4. Não hardcodar combinações de kits.
5. Preferir dados/configuração a código quando algo for um atributo de design.
6. Manter geração determinística através de seed.
7. Manter o renderer determinístico.
8. Criar testes para novas regras.
9. Validar formatos e dimensões antes da exportação.
10. Manter a arquitetura aberta para uma futura interface web.

O objetivo não é criar apenas um conjunto de kits para uma liga específica.

O objetivo é criar um **motor reutilizável de geração procedural de uniformes para FM26**.
