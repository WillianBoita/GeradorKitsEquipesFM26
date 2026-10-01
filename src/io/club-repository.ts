import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseClubIdentity, type ClubIdentity } from "../core/club.js";
import type { KitDefinition, KitType } from "../core/kit.js";
import { ClubIdSchema, parseWith } from "../core/primitives.js";
import { CLUBS_DIR } from "../config/paths.js";
import { FileNotFoundError, readJsonFile } from "./json-file.js";

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

export function kitDefinitionPath(clubId: string, kitType: KitType, clubsDir: string = CLUBS_DIR): string {
  return path.join(clubsDir, parseWith(ClubIdSchema, clubId, "club id"), "kits", kitType, "kit.json");
}

export async function saveKit(kit: KitDefinition, kitType: KitType, clubsDir: string = CLUBS_DIR): Promise<string> {
  const file = kitDefinitionPath(kit.clubId, kitType, clubsDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(kit, null, 2)}\n`);
  return file;
}
