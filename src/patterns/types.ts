export interface PatternParameter {
  min: number;
  max: number;
  default: number;
  integer?: boolean;
}

export type PatternLayer = "base" | "overlay";

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
  defaultWeight: number;
  parameters: Record<string, PatternParameter>;
  render(context: PatternRenderContext): string;
  // Espelha render(): diz qual camada pinta o ponto. Mede o fundo atrás dos logos; um teste de pixel garante a coerência.
  colorAt(x: number, y: number, geometry: PatternGeometry): PatternLayer;
}
