import { stripesPattern } from "./stripes.js";
import type { PatternTemplate } from "./types.js";

// Mesmo desenho e colorAt de stripes; só os ranges mudam.
export const pinstripesPattern: PatternTemplate = {
  ...stripesPattern,
  id: "pinstripes",
  name: "Pinstripes",
  defaultWeight: 0,
  parameters: { count: { min: 12, max: 30, default: 20, integer: true }, ratio: { min: 0.08, max: 0.2, default: 0.12 } },
};
