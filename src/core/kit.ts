import { z } from "zod";
import { AssetIdSchema, ClubIdSchema, HexColorSchema, parseWith, SeedSchema } from "./primitives.js";

export const KIT_TYPES = ["home", "away", "third"] as const;
export const COLOR_ROLES = ["primary", "secondary", "accent"] as const;
export const COLLAR_STYLES = ["round", "v-neck"] as const;
export const SLEEVE_STYLES = ["match-body", "solid"] as const;
// Logos de marca: o id aponta para o registry de assets.
export const BRAND_KINDS = ["sponsor", "manufacturer"] as const;
// Nome da lista no registry e do pool no club.json para cada tipo de marca.
export const BRAND_LISTS = { sponsor: "sponsors", manufacturer: "manufacturers" } as const;

export const KitTypeSchema = z.enum(KIT_TYPES);
export const ColorRoleSchema = z.enum(COLOR_ROLES);
// Papel acompanha edições da paleta; hex cobre branco e preto, que não são papéis.
export const LogoColorSchema = z.union([ColorRoleSchema, HexColorSchema]);
const BrandLogoSchema = z.strictObject({ id: AssetIdSchema, color: LogoColorSchema, outline: LogoColorSchema.optional() });

export const KitDefinitionSchema = z.strictObject({
  clubId: ClubIdSchema,
  kitType: KitTypeSchema,
  // Seed do conjunto Home/Away/Third; ausente em kits escritos à mão.
  generatedWith: z.strictObject({ seed: SeedSchema }).optional(),
  colors: z.strictObject({ primary: HexColorSchema, secondary: HexColorSchema, accent: HexColorSchema }),
  pattern: z.strictObject({ id: z.string().min(1), base: ColorRoleSchema, overlay: ColorRoleSchema, params: z.record(z.string(), z.number()).default({}) }),
  collar: z.strictObject({ style: z.enum(COLLAR_STYLES), color: ColorRoleSchema }),
  sleeves: z.strictObject({ style: z.enum(SLEEVE_STYLES), color: ColorRoleSchema, cuffColor: ColorRoleSchema }),
  shorts: z.strictObject({ color: ColorRoleSchema }),
  socks: z.strictObject({ color: ColorRoleSchema }),
  badge: z.boolean().optional(),
  sponsor: BrandLogoSchema.optional(),
  manufacturer: BrandLogoSchema.optional(),
});

export type KitType = z.infer<typeof KitTypeSchema>;
export type ColorRole = z.infer<typeof ColorRoleSchema>;
export type CollarStyle = (typeof COLLAR_STYLES)[number];
export type BrandKind = (typeof BRAND_KINDS)[number];
export type LogoSlot = "badge" | BrandKind;
export type LogoColor = z.infer<typeof LogoColorSchema>;
export type BrandLogo = z.infer<typeof BrandLogoSchema>;
export type KitDefinition = z.infer<typeof KitDefinitionSchema>;

export function parseKitDefinition(input: unknown): KitDefinition {
  return parseWith(KitDefinitionSchema, input, "kit definition");
}

export function isColorRole(value: string): value is ColorRole {
  return (COLOR_ROLES as readonly string[]).includes(value);
}

export function resolveLogoColor(kit: KitDefinition, value: LogoColor): string {
  return isColorRole(value) ? kit.colors[value] : value;
}
