import Color from "colorjs.io";

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(hex: string): string {
  if (!HEX_COLOR_PATTERN.test(hex)) throw new Error(`Invalid hex color: "${hex}"`);
  const digits = hex.slice(1).toLowerCase();
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return `#${full}`;
}

export function contrastRatio(a: string, b: string): number {
  return new Color(a).contrast(new Color(b), "WCAG21");
}

export function toHex(color: Color): string {
  return color.to("srgb").toString({ format: "hex", collapse: false });
}
