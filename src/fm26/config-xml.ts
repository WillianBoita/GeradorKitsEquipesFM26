import { z } from "zod";
import { KIT_TYPES, KitTypeSchema, type KitType } from "../core/kit.js";
import { FmUniqueIdSchema, parseWith } from "../core/primitives.js";
import { formatIssues, type ValidationIssue } from "../core/validation.js";
import { RENDER_TYPES, type RenderType } from "./naming.js";

export interface ConfigRecord {
  from: string;
  to: string;
}

const RenderTypeSchema = z.enum(RENDER_TYPES);
const TARGET_FOLDERS: Record<RenderType, string> = { "2d": "kits", "3d": "kit_textures" };
const INDENT = "    ";
// Com from e to restritos a estes padrões não há o que escapar: o XML sai bem formado por construção.
const FROM_PATTERN = /^[a-z0-9_]+$/;
const TO_PATTERN = new RegExp(`^graphics/pictures/team/\\d+/(${Object.values(TARGET_FOLDERS).join("|")})/(${KIT_TYPES.join("|")})$`);

export function fmTargetPath(fmUniqueId: string, kitType: KitType, renderType: RenderType): string {
  const id = parseWith(FmUniqueIdSchema, fmUniqueId, "fmUniqueId");
  const type = parseWith(KitTypeSchema, kitType, "kit type");
  return `graphics/pictures/team/${id}/${TARGET_FOLDERS[parseWith(RenderTypeSchema, renderType, "render type")]}/${type}`;
}

function duplicates(records: readonly ConfigRecord[], key: keyof ConfigRecord): ValidationIssue[] {
  const seen = new Set<string>();
  const reported = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const record of records) {
    const value = record[key];
    if (seen.has(value) && !reported.has(value)) {
      issues.push({ rule: `duplicate-${key}`, message: `${key}="${value}" appears in more than one record` });
      reported.add(value);
    }
    seen.add(value);
  }
  return issues;
}

export function validateConfigRecords(records: readonly ConfigRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const record of records) {
    if (!FROM_PATTERN.test(record.from))
      issues.push({ rule: "invalid-from", message: `"${record.from}" must contain only lowercase letters, digits and underscores` });
    if (!TO_PATTERN.test(record.to)) {
      issues.push({ rule: "invalid-to", message: `"${record.to}" is not graphics/pictures/team/<fmUniqueId>/<kits|kit_textures>/<home|away|third>` });
    }
  }
  return [...issues, ...duplicates(records, "from"), ...duplicates(records, "to")];
}

export function buildConfigXml(records: readonly ConfigRecord[]): string {
  const issues = validateConfigRecords(records);
  if (issues.length > 0) throw new Error(`Invalid config.xml records:\n${formatIssues(issues)}`);
  const lines = [
    "<record>",
    `${INDENT}<boolean id="preload" value="false"/>`,
    `${INDENT}<boolean id="amap" value="false"/>`,
    `${INDENT}<list id="maps">`,
    ...records.map((record) => `${INDENT.repeat(2)}<record from="${record.from}" to="${record.to}"/>`),
    `${INDENT}</list>`,
    "</record>",
  ];
  return `${lines.join("\n")}\n`;
}
