import { z } from "zod";
import { KIT_TYPES, KitTypeSchema, type KitType } from "../core/kit.js";
import { FM_ID_PART_LIMIT, FmRandomIdSchema, FmUniqueIdSchema, parseWith } from "../core/primitives.js";
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

// Inteiro de 64 bits: fica em string para não perder precisão.
const FmTeamIdSchema = z.string().regex(/^\d+$/, "must be the numeric FM team id as a string");

// O FM26 localiza a pasta do time por fmRandomId × 2³² + fmUniqueId, não só pelo Unique ID. O resultado passa de Number.MAX_SAFE_INTEGER.
export function fmTeamId(fmUniqueId: string, fmRandomId: string): string {
  const unique = BigInt(parseWith(FmUniqueIdSchema, fmUniqueId, "fmUniqueId"));
  const random = BigInt(parseWith(FmRandomIdSchema, fmRandomId, "fmRandomId"));
  return (random * BigInt(FM_ID_PART_LIMIT) + unique).toString();
}

export function fmTargetPath(fmTeamId: string, kitType: KitType, renderType: RenderType): string {
  const id = parseWith(FmTeamIdSchema, fmTeamId, "fmTeamId");
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
      issues.push({ rule: "invalid-to", message: `"${record.to}" is not graphics/pictures/team/<fmTeamId>/<kits|kit_textures>/<home|away|third>` });
    }
  }
  return [...issues, ...duplicates(records, "from"), ...duplicates(records, "to")];
}

const RECORD_LINE = new RegExp(`^${INDENT.repeat(2)}<record from="([^"]*)" to="([^"]*)"/>$`);

// O formato é determinístico: só é "nosso" o arquivo cujas linhas são as fixas ou registros válidos. Protege o config.xml de outro pacote.
export function isGeneratedConfigXml(xml: string): boolean {
  const fixedLines = new Set(buildConfigXml([]).split("\n"));
  return xml.split("\n").every((line) => {
    if (fixedLines.has(line)) return true;
    const match = RECORD_LINE.exec(line);
    return match !== null && validateConfigRecords([{ from: match[1]!, to: match[2]! }]).length === 0;
  });
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
