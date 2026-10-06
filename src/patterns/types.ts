export interface PatternParameter {
  min: number;
  max: number;
  default: number;
  integer?: boolean;
}

export type PatternLayer = "base" | "overlay";

// Região do tronco que uma camada de detalhe ocupa; o generator nunca põe duas camadas do mesmo kit na mesma região.
export type LayerSlot = "sides" | "shoulders" | "lower";

export interface PatternGeometry {
  width: number;
  height: number;
  params: Record<string, number>;
}

export interface PatternRenderContext extends PatternGeometry {
  base: string;
  overlay: string;
}

export interface PatternTemplate {
  id: string;
  name: string;
  category: string;
  parameters: Record<string, PatternParameter>;
  // Presente só nos padrões que podem ser camada (KitDefinition.layers): o render() deles desenha só o overlay, e nos ranges nada pinta as caixas de logo.
  layerSlot?: LayerSlot;
  render(context: PatternRenderContext): string;
  // Espelha render(): diz qual camada pinta o ponto. Mede o fundo atrás dos logos; um teste de pixel garante a coerência.
  colorAt(x: number, y: number, geometry: PatternGeometry): PatternLayer;
}
