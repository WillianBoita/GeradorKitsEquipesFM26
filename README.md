# GeradorKitsEquipesFM26
Projeto experimental para gerar kits aleatórios e personalizados para o Football Manager 2026. O intuito é testar as capacidades da IA.

Guias: `fm26-procedural-kit-generator-guide.md` (arquitetura) e `fm26-kit-export-and-integration.md` (integração FM26). Planos de execução: `docs/superpowers/plans/`.

## Requisitos

- Node.js 22.12 ou superior

## Clubes

Cada clube fica em `clubs/<id>/club.json`. O `id` é interno (minúsculas, dígitos e `-`). O `fmUniqueId` é o Unique ID real do clube no FM26, informado manualmente como string; nunca é inventado.

## Uso

```bash
npm install
npm run kit-generator -- generate --club galaticos-fc --seed 42
npm run kit-generator -- render --definition clubs/galaticos-fc/kits/home/kit.json --out output/preview.png
```

`generate` salva a definição do kit em `clubs/<id>/kits/home/kit.json` e o PNG 2D (414×414) em `output/<id>/2d/<slug>_home_2d.png`. A mesma seed sempre gera o mesmo kit; sem `--seed`, uma seed aleatória é sorteada e impressa.

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
```
