import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseClubIdentity, type ClubIdentity } from "../core/club.js";
import { KitDefinitionSchema, KitTypeSchema, type KitDefinition, type KitType } from "../core/kit.js";
import { ClubIdSchema, parseWith } from "../core/primitives.js";
import { CLUBS_DIR } from "../config/paths.js";
import { FileNotFoundError, readJsonFile } from "./json-file.js";

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function listClubIds(clubsDir: string = CLUBS_DIR): Promise<string[]> {
  const entries = await readdir(clubsDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    throw error.code === "ENOENT" ? new Error(`Clubs directory not found: ${clubsDir}`) : error;
  });
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (await isFile(path.join(clubsDir, entry.name, "club.json")))) ids.push(entry.name);
  }
  return ids.sort();
}

export async function loadClub(clubId: string, clubsDir: string = CLUBS_DIR): Promise<ClubIdentity> {
  const id = parseWith(ClubIdSchema, clubId, "club id");
  const file = path.join(clubsDir, id, "club.json");
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) throw new Error(`Club "${id}" not found (expected ${file})`);
    throw error;
  }
  const club = parseClubIdentity(raw);
  if (club.id !== id) throw new Error(`${file} declares id "${club.id}", expected "${id}"`);
  return club;
}

export function clubLogoPath(clubId: string, clubsDir: string = CLUBS_DIR): string {
  return path.join(clubsDir, parseWith(ClubIdSchema, clubId, "club id"), "logo.png");
}

export async function hasClubLogo(clubId: string, clubsDir: string = CLUBS_DIR): Promise<boolean> {
  return isFile(clubLogoPath(clubId, clubsDir));
}

export function kitDefinitionPath(clubId: string, kitType: KitType, clubsDir: string = CLUBS_DIR): string {
  // kitType chega da linha de comando (--type); o tipo TS sozinho não impede um diretório arbitrário.
  const type = parseWith(KitTypeSchema, kitType, "kit type");
  return path.join(clubsDir, parseWith(ClubIdSchema, clubId, "club id"), "kits", type, "kit.json");
}

export async function loadKit(clubId: string, kitType: KitType, clubsDir: string = CLUBS_DIR): Promise<KitDefinition | undefined> {
  const file = kitDefinitionPath(clubId, kitType, clubsDir);
  let raw: unknown;
  try {
    raw = await readJsonFile(file);
  } catch (error) {
    if (error instanceof FileNotFoundError) return undefined;
    throw error;
  }
  const kit = parseWith(KitDefinitionSchema, raw, `kit definition in ${file}`);
  if (kit.clubId !== clubId) throw new Error(`${file} declares clubId "${kit.clubId}", expected "${clubId}"`);
  if (kit.kitType !== kitType) throw new Error(`${file} declares kitType "${kit.kitType}", expected "${kitType}"`);
  return kit;
}

export async function saveKit(kit: KitDefinition, clubsDir: string = CLUBS_DIR): Promise<string> {
  const file = kitDefinitionPath(kit.clubId, kit.kitType, clubsDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(kit, null, 2)}\n`);
  return file;
}
