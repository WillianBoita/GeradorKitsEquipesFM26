import { mkdir, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { exportConfigPath, exportFilePath } from "../config/paths.js";
import type { ClubIdentity } from "../core/club.js";
import { errorMessage } from "../core/errors.js";
import { KIT_TYPES, type KitDefinition, type KitType } from "../core/kit.js";
import type { ValidationIssue } from "../core/validation.js";
import { kitDefinitionPath, listClubIds, loadClub, loadKit } from "../io/club-repository.js";
import { buildConfigXml, fmTargetPath, type ConfigRecord } from "./config-xml.js";
import { kitAssetName, type RenderType } from "./naming.js";

// Resoluções exigidas pelo FM26 (spec de integração, seção 6), independentes do tamanho padrão de cada renderer.
export const FM26_RENDER_SIZES: Record<RenderType, number> = { "2d": 414, "3d": 1024 };

// Third é opcional: o clube só exporta menos registros.
const REQUIRED_KIT_TYPES: readonly KitType[] = ["home", "away"];

// kitTypes inclui kit.json ilegível: ele já vira invalid-file e não deve aparecer de novo como missing-kit.
export function validateExportClub(club: ClubIdentity, kitTypes: readonly KitType[], clubsDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (club.fmUniqueId === undefined) issues.push({ rule: "missing-fm-unique-id", message: `Club "${club.id}" has no fmUniqueId` });
  for (const kitType of REQUIRED_KIT_TYPES) {
    if (kitTypes.includes(kitType)) continue;
    issues.push({ rule: "missing-kit", message: `Club "${club.id}" has no ${kitType} kit (expected ${kitDefinitionPath(club.id, kitType, clubsDir)})` });
  }
  return issues;
}

// Mesmo ID em dois clubes geraria `to` duplicado e o FM aplicaria só um dos kits.
export function duplicateFmUniqueIdIssues(clubs: readonly ClubIdentity[]): Map<string, ValidationIssue[]> {
  const clubIdsByFmId = new Map<string, string[]>();
  for (const club of clubs) {
    if (club.fmUniqueId !== undefined) clubIdsByFmId.set(club.fmUniqueId, [...(clubIdsByFmId.get(club.fmUniqueId) ?? []), club.id]);
  }
  const issues = new Map<string, ValidationIssue[]>();
  for (const [fmUniqueId, clubIds] of clubIdsByFmId) {
    if (clubIds.length < 2) continue;
    for (const clubId of clubIds) {
      const others = clubIds.filter((other) => other !== clubId).map((other) => `"${other}"`);
      issues.set(clubId, [{ rule: "duplicate-fm-unique-id", message: `fmUniqueId "${fmUniqueId}" is also used by club ${others.join(", ")}` }]);
    }
  }
  return issues;
}

// O buffer vem do próprio renderer: a checagem pega erro de programa (tamanho ou formato), não arquivo corrompido.
export async function checkRenderedPng(png: Buffer, kitType: KitType, renderType: RenderType): Promise<ValidationIssue | undefined> {
  const label = `${kitType} ${renderType} render`;
  const size = FM26_RENDER_SIZES[renderType];
  const metadata = await sharp(png)
    .metadata()
    .catch(() => undefined);
  if (!metadata) return { rule: "invalid-render", message: `${label} is not an image` };
  if (metadata.format !== "png") return { rule: "invalid-render", message: `${label} is ${metadata.format}, expected png` };
  if (metadata.width !== size || metadata.height !== size) {
    return { rule: "invalid-render", message: `${label} is ${metadata.width}×${metadata.height}, expected ${size}×${size}` };
  }
  return undefined;
}

export type RenderKit = (kit: KitDefinition, renderType: RenderType) => Promise<Buffer>;

export interface ExportOptions {
  clubsDir: string;
  outDir: string;
  renderTypes: readonly RenderType[];
  renderKit: RenderKit;
}

export interface ExportedClub {
  club: ClubIdentity;
  kitTypes: KitType[];
}

export interface ExportResult {
  clubs: ExportedClub[];
  configFile: string;
  recordCount: number;
}

export interface ClubExportFailure {
  clubId: string;
  issues: ValidationIssue[];
}

export class ExportAbortedError extends Error {
  readonly failures: ClubExportFailure[];
  readonly clubCount: number;

  constructor(failures: ClubExportFailure[], clubCount: number) {
    super(`Export aborted, nothing was written (${failures.length} of ${clubCount} clubs failed)`);
    this.name = "ExportAbortedError";
    this.failures = failures;
    this.clubCount = clubCount;
  }
}

type ClubKits = Partial<Record<KitType, KitDefinition>>;

interface LoadedClub {
  clubId: string;
  club?: ClubIdentity;
  kits: ClubKits;
  issues: ValidationIssue[];
}

interface ExportFile {
  file: string;
  png: Buffer;
  record: ConfigRecord;
}

interface RenderedClub {
  files: ExportFile[];
  issues: ValidationIssue[];
}

async function isFile(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false,
  );
}

async function loadExportClub(clubId: string, clubsDir: string): Promise<LoadedClub> {
  let club: ClubIdentity;
  try {
    club = await loadClub(clubId, clubsDir);
  } catch (error) {
    return { clubId, kits: {}, issues: [{ rule: "invalid-file", message: errorMessage(error) }] };
  }
  const kits: ClubKits = {};
  const unreadable: KitType[] = [];
  const issues: ValidationIssue[] = [];
  for (const kitType of KIT_TYPES) {
    try {
      const kit = await loadKit(club.id, kitType, clubsDir);
      if (kit) kits[kitType] = kit;
    } catch (error) {
      unreadable.push(kitType);
      issues.push({ rule: "invalid-file", message: errorMessage(error) });
    }
  }
  const present = KIT_TYPES.filter((kitType) => kits[kitType] !== undefined || unreadable.includes(kitType));
  issues.push(...validateExportClub(club, present, clubsDir));
  return { clubId, club, kits, issues };
}

// Ordem dos registros: render (2d antes de 3d) e depois tipo de kit, como no exemplo do spec de integração.
async function renderClub(club: ClubIdentity, fmUniqueId: string, kits: ClubKits, options: ExportOptions): Promise<RenderedClub> {
  const files: ExportFile[] = [];
  const issues: ValidationIssue[] = [];
  for (const renderType of options.renderTypes) {
    for (const kitType of KIT_TYPES) {
      const kit = kits[kitType];
      if (!kit) continue;
      let png: Buffer;
      try {
        png = await options.renderKit(kit, renderType);
      } catch (error) {
        issues.push({ rule: "render-failed", message: `${kitType} ${renderType}: ${errorMessage(error)}` });
        continue;
      }
      const invalid = await checkRenderedPng(png, kitType, renderType);
      if (invalid) {
        issues.push(invalid);
        continue;
      }
      const record = { from: kitAssetName(club.id, kitType, renderType), to: fmTargetPath(fmUniqueId, kitType, renderType) };
      files.push({ file: exportFilePath(options.outDir, club.id, kitType, renderType), png, record });
    }
  }
  return { files, issues };
}

// Tudo ou nada: acumula os problemas de todos os clubes e só grava se nenhum falhou, para a pasta nunca perder um clube sem aviso.
export async function exportKits(options: ExportOptions): Promise<ExportResult> {
  const clubIds = await listClubIds(options.clubsDir);
  if (clubIds.length === 0) throw new Error(`No clubs found in ${options.clubsDir}`);
  const loaded: LoadedClub[] = [];
  for (const clubId of clubIds) loaded.push(await loadExportClub(clubId, options.clubsDir));
  const duplicates = duplicateFmUniqueIdIssues(loaded.flatMap((entry) => entry.club ?? []));
  const failures: ClubExportFailure[] = [];
  const exported: ExportedClub[] = [];
  const files: ExportFile[] = [];
  for (const entry of loaded) {
    const issues = [...entry.issues, ...(duplicates.get(entry.clubId) ?? [])];
    const fmUniqueId = entry.club?.fmUniqueId;
    // Clubes válidos renderizam mesmo depois de uma falha, para o usuário ver todos os problemas de uma vez.
    if (entry.club && fmUniqueId !== undefined && issues.length === 0) {
      const rendered = await renderClub(entry.club, fmUniqueId, entry.kits, options);
      issues.push(...rendered.issues);
      files.push(...rendered.files);
      exported.push({ club: entry.club, kitTypes: KIT_TYPES.filter((kitType) => entry.kits[kitType] !== undefined) });
    }
    if (issues.length > 0) failures.push({ clubId: entry.clubId, issues });
  }
  if (failures.length > 0) throw new ExportAbortedError(failures, clubIds.length);
  const records = files.map((file) => file.record);
  // buildConfigXml valida os registros: um registro inválido aborta antes de qualquer escrita.
  const xml = buildConfigXml(records);
  await mkdir(options.outDir, { recursive: true });
  for (const file of files) await writeFile(file.file, file.png);
  const configFile = exportConfigPath(options.outDir);
  await writeFile(configFile, xml);
  for (const file of files) {
    if (!(await isFile(file.file))) throw new Error(`config.xml references ${file.record.from} but ${file.file} was not written`);
  }
  return { clubs: exported, configFile, recordCount: records.length };
}
