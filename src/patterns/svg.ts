// Limita casas decimais para que o SVG gerado seja estável e comparável entre execuções.
export function fmt(value: number): string {
  return String(Number(value.toFixed(2)));
}
