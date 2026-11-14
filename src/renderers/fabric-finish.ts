import { contrastRatio } from "../core/color.js";
import type { AlphaTile, MeshTone } from "../fm26/fabric.js";

export const MESH_TONE_COLORS: Record<MeshTone, string> = { black: "#000000", white: "#ffffff" };

// Um retângulo de 1 px de altura por sequência de pixels com o mesmo alfa; crispEdges mantém o bloco sem antialias na textura de 1024.
export function tilePatternSvg(id: string, tile: AlphaTile, origin: { x: number; y: number }, color: string): string {
  const rects = tile.rows.flatMap((row, y) =>
    [...row.matchAll(/([1-9a-f])\1*/g)].map((run) => {
      const digit = parseInt(run[1]!, 16);
      return `<rect x="${run.index}" y="${y}" width="${run[0].length}" height="1"${digit < 15 ? ` fill-opacity="${digit / 15}"` : ""}/>`;
    }),
  );

  return `<pattern id="${id}" x="${origin.x}" y="${origin.y}" width="${tile.width}" height="${tile.height}" patternUnits="userSpaceOnUse"><g fill="${color}" shape-rendering="crispEdges">${rects.join("")}</g></pattern>`;
}

// Preto em peça clara e branco em peça escura, como as duas camadas do PSD; no empate fica o preto, que é a camada visível.
export function meshTone(color: string): MeshTone {
  return contrastRatio(color, MESH_TONE_COLORS.white) > contrastRatio(color, MESH_TONE_COLORS.black) ? "white" : "black";
}
