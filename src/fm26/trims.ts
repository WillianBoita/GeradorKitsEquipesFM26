import type { ShortsTrimStyle, SocksTrimStyle } from "../core/kit.js";
import { FM26_KIT_LAYOUT, FM26_TEXTURE_SIZE, rect, type UvRect } from "./layout.js";

// Lado do jogador; o direito fica à esquerda da textura.
export const TRIM_SIDES = ["right", "left"] as const;
export type TrimSide = (typeof TRIM_SIDES)[number];

// Retângulos que o acabamento pinta em cada ilha da peça.
export type TrimRects = Record<TrimSide, UvRect[]>;

type Span = [number, number];

// Região do layout em pixels da textura de 1024: as faixas vão até a borda dela, com a sobra que o jogo pode amostrar.
function regionPixels(part: "shorts" | "sock", side: TrimSide): { x0: number; y0: number; x1: number; y1: number } {
  const region = FM26_KIT_LAYOUT.regions.find((candidate) => candidate.part === part && candidate.side === side);
  if (!region) throw new Error(`Layout has no ${side} ${part} region`);
  const [x0, y0, x1, y1] = [region.rect.x, region.rect.y, region.rect.x + region.rect.width, region.rect.y + region.rect.height].map((value) =>
    Math.round(value * FM26_TEXTURE_SIZE),
  );

  return { x0: x0!, y0: y0!, x1: x1!, y1: y1! };
}

// Faixas de lado a lado da ilha, iguais nos dois lados: y em pixels; "top" e "bottom" encostam na borda da região.
function bands(part: "shorts" | "sock", ...spans: [number | "top", number | "bottom"][]): TrimRects {
  const side = (which: TrimSide): UvRect[] => {
    const { x0, y0, x1, y1 } = regionPixels(part, which);
    return spans.map(([top, bottom]) => rect(x0, top === "top" ? y0 : top, x1, bottom === "bottom" ? y1 : bottom));
  };

  return { right: side("right"), left: side("left") };
}

// Faixa de cima a baixo da ilha: x em pixels, medido em cada lado (na máscara os dois lados não são espelho exato nem deslocamento).
function columns(part: "shorts" | "sock", right: Span, left: Span): TrimRects {
  const side = (which: TrimSide, [x0, x1]: Span): UvRect[] => {
    const { y0, y1 } = regionPixels(part, which);
    return [rect(x0, y0, x1, y1)];
  };

  return { right: side("right", right), left: side("left", left) };
}

// Medidos nas máscaras do FM26 (spec da 4e, seção 3). A listra lateral cai na divisa entre as metades B/F da ilha, que é a costura de fora da perna.
export const FM26_SHORTS_TRIMS: Record<ShortsTrimStyle, TrimRects> = {
  // Máscara 02.
  "side-stripe": columns("shorts", [156, 182], [844, 870]),
  // Máscara 03.
  "side-piping": columns("shorts", [165, 175], [851, 861]),
  // Máscara 57 (y 992–1013), levada até a borda de baixo como na máscara 10: sem filete da cor do calção na barra.
  "hem-band": bands("shorts", [992, "bottom"]),
};

// O comprimento da meia corre em y, com o cano em cima: as faixas horizontais dão a volta na perna.
export const FM26_SOCKS_TRIMS: Record<SocksTrimStyle, TrimRects> = {
  // Máscaras 07 e 58 (y 432–487): a dobra do cano. Termina em 486, com a primeira zona do canelado, para a zona seguinte não começar com uma linha da cor da dobra.
  turnover: bands("sock", ["top", 486]),
  // Máscara 08.
  "top-hoops": bands("sock", [464, 476], [490, 503]),
  // Máscara 10.
  hoops: bands("sock", [455, 500], [545, 590], [634, 680]),
};
