import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLUBS_DIR, kitRenderPath, OUTPUT_DIR } from "../config/paths.js";
import { KIT_TYPES, KitTypeSchema, parseKitDefinition, type KitType } from "../core/kit.js";
import { parseWith } from "../core/primitives.js";
import { deriveSeed, MAX_SEED } from "../core/random.js";
import { generateKitSet } from "../generator/kit-generator.js";
import { listClubIds, loadClub, saveKit } from "../io/club-repository.js";
import { readJsonFile } from "../io/json-file.js";
import { renderKit2dPng } from "../renderers/renderer-2d.js";

export interface CliIo {
  log(message: string): void;
  error(message: string): void;
}

interface GenerateOptions {
  kitTypes: readonly KitType[];
  outDir: string;
  clubsDir: string;
}

export const USAGE = [
  "Usage:",
  "  kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>]",
  "  kit-generator render --definition <kit.json> --out <file.png>",
].join("\n");

export function parseSeed(value: string | undefined): number {
  if (value === undefined) return randomInt(0, MAX_SEED + 1);
  if (!/^\d+$/.test(value) || Number(value) > MAX_SEED) throw new Error(`Invalid seed "${value}": expected an integer between 0 and ${MAX_SEED}`);
  return Number(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeOutput(file: string, content: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function resolveClubIds(values: { club?: string; all?: boolean }, clubsDir: string): Promise<string[]> {
  if (values.club !== undefined && values.all) throw new Error("Use either --club or --all, not both");
  if (values.club !== undefined) return [values.club];
  if (!values.all) throw new Error("Missing required option --club or --all");
  const ids = await listClubIds(clubsDir);
  if (ids.length === 0) throw new Error(`No clubs found in ${clubsDir}`);
  return ids;
}

async function generateClub(clubId: string, seed: number, options: GenerateOptions, io: CliIo): Promise<void> {
  // Seed impressa antes de qualquer efeito colateral, para reproduzir até uma execução que falhou.
  io.log(`Seed: ${seed} (${clubId})`);
  const club = await loadClub(clubId, options.clubsDir);
  const set = generateKitSet(club, seed);
  const kits = options.kitTypes.map((kitType) => set[kitType]);
  // Todos os PNGs antes do primeiro kit.json: uma falha de renderização não deixa o conjunto versionado pela metade.
  const pngFiles: string[] = [];
  for (const kit of kits) {
    const pngFile = kitRenderPath(options.outDir, club.id, kit.kitType, "2d");
    await writeOutput(pngFile, await renderKit2dPng(kit));
    pngFiles.push(pngFile);
  }
  const lines = [`Generated ${club.name} kits (seed ${seed})`];
  for (const [index, kit] of kits.entries()) {
    const kitFile = await saveKit(kit, options.clubsDir);
    lines.push(`  ${kit.kitType} definition: ${kitFile}`, `  ${kit.kitType} 2D: ${pngFiles[index]}`);
  }
  for (const line of lines) io.log(line);
}

async function generateCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    club: { type: "string" },
    all: { type: "boolean", default: false },
    type: { type: "string" },
    seed: { type: "string" },
    out: { type: "string", default: OUTPUT_DIR },
    clubs: { type: "string", default: CLUBS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const kitTypes = values.type === undefined ? KIT_TYPES : [parseWith(KitTypeSchema, values.type, "kit type")];
  const seed = values.seed === undefined ? undefined : parseSeed(values.seed);
  const clubIds = await resolveClubIds(values, values.clubs);
  const generateOptions: GenerateOptions = { kitTypes, outDir: path.resolve(values.out), clubsDir: values.clubs };
  if (!values.all) {
    await generateClub(clubIds[0]!, seed ?? parseSeed(undefined), generateOptions, io);
    return 0;
  }
  let generated = 0;
  for (const clubId of clubIds) {
    try {
      // Com --seed, cada clube recebe uma sub-seed própria; senão clubes com os mesmos pesos repetiriam as mesmas escolhas.
      await generateClub(clubId, seed === undefined ? parseSeed(undefined) : deriveSeed(seed, clubId), generateOptions, io);
      generated++;
    } catch (error) {
      io.error(`Error: [${clubId}] ${errorMessage(error)}`);
    }
  }
  io.log(`Generated ${generated} of ${clubIds.length} clubs`);
  return generated === clubIds.length ? 0 : 1;
}

async function renderCommand(args: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({ args, options: { definition: { type: "string" }, out: { type: "string" } }, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const kit = parseKitDefinition(await readJsonFile(values.definition));
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKit2dPng(kit));
  io.log(`Rendered ${values.definition} to ${out}`);
  return 0;
}

export async function runCli(argv: string[], io: CliIo = console): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "generate") return await generateCommand(args, io);
    if (command === "render") return await renderCommand(args, io);
    io.error(USAGE);
    return 1;
  } catch (error) {
    io.error(`Error: ${errorMessage(error)}`);
    return 1;
  }
}
