import { z } from "zod";
import { ClubIdSchema, HexColorSchema, parseWith } from "./primitives.js";

export const COLOR_ROLES = ["primary", "secondary", "accent"] as const;
export const COLLAR_STYLES = ["round", "v-neck"] as const;
export const SLEEVE_STYLES = ["match-body", "solid"] as const;

export const ColorRoleSchema = z.enum(COLOR_ROLES);

export const KitDefinitionSchema = z.object({
  clubId: ClubIdSchema,
  colors: z.object({ primary: HexColorSchema, secondary: HexColorSchema, accent: HexColorSchema }),
  pattern: z.object({ id: z.string().min(1), base: ColorRoleSchema, overlay: ColorRoleSchema, params: z.record(z.string(), z.number()).default({}) }),
  collar: z.object({ style: z.enum(COLLAR_STYLES), color: ColorRoleSchema }),
  sleeves: z.object({ style: z.enum(SLEEVE_STYLES), color: ColorRoleSchema, cuffColor: ColorRoleSchema }),
  shorts: z.object({ color: ColorRoleSchema }),
  socks: z.object({ color: ColorRoleSchema }),
});

export type ColorRole = z.infer<typeof ColorRoleSchema>;
export type CollarStyle = (typeof COLLAR_STYLES)[number];
export type KitDefinition = z.infer<typeof KitDefinitionSchema>;

export function parseKitDefinition(input: unknown): KitDefinition {
  return parseWith(KitDefinitionSchema, input, "kit definition");
}
