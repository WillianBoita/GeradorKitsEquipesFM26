import { FM26_TEXTURE_SIZE, type UvPoint } from "../../src/fm26/layout.js";

// Ray casting no centro do pixel (x, y) da textura 1024.
export function insidePolygon(shape: readonly UvPoint[], x: number, y: number): boolean {
  const [px, py] = [x + 0.5, y + 0.5];
  let inside = false;
  for (let index = 0, previous = shape.length - 1; index < shape.length; previous = index++) {
    const [ax, ay] = [shape[index]!.x * FM26_TEXTURE_SIZE, shape[index]!.y * FM26_TEXTURE_SIZE];
    const [bx, by] = [shape[previous]!.x * FM26_TEXTURE_SIZE, shape[previous]!.y * FM26_TEXTURE_SIZE];
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
