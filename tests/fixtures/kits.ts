import type { KitDefinition } from "../../src/core/kit.js";

export function makeKit(overrides: Partial<KitDefinition> = {}): KitDefinition {
  return {
    clubId: "galaticos-fc",
    colors: { primary: "#123456", secondary: "#ffffff", accent: "#ffd700" },
    pattern: { id: "solid", base: "primary", overlay: "secondary", params: {} },
    collar: { style: "round", color: "accent" },
    sleeves: { style: "match-body", color: "secondary", cuffColor: "accent" },
    shorts: { color: "secondary" },
    socks: { color: "primary" },
    ...overrides,
  };
}
