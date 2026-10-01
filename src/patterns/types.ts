export interface PatternParameter {
  min: number;
  max: number;
  default: number;
  integer?: boolean;
}

export interface PatternRenderContext {
  width: number;
  height: number;
  base: string;
  overlay: string;
  params: Record<string, number>;
}

export interface PatternTemplate {
  id: string;
  name: string;
  category: string;
  defaultWeight: number;
  parameters: Record<string, PatternParameter>;
  render(context: PatternRenderContext): string;
}
