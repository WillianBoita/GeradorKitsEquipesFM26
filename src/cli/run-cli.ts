import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CLUBS_DIR } from "../config/paths.js";
import { parseKitDefinition } from "../core/kit.js";
import { MAX_SEED } from "../core/random.js";
import { kitAssetFileName } from "../fm26/naming.js";
import { generateKitSet } from "../generator/kit-generator.js";
import { loadClub, saveKit } from "../io/club-repository.js";
import { readJsonFile } from "../io/json-file.js";
import { renderKit2dPng } from "../renderers/renderer-2d.js";

export interface CliIo {
  log(message: string): void;
  error(message: string): void;
}

export const USAGE = [
  "Usage:",
  "  kit-generator generate --club <id> [--seed <n>] [--out <dir>] [--clubs <dir>]",
  "  kit-generator render --definition <kit.json> --out <file.png>",
].join("\n");

export function parseSeed(value: string | undefined): number {
  if (value === undefined) return randomInt(0, MAX_SEED + 1);
  if (!/^\d+$/.test(value) || Number(value) > MAX_SEED) throw new Error(`Invalid seed "${value}": expected an integer between 0 and ${MAX_SEED}`);
  return Number(value);
}

async function writeOutput(file: string, content: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function generateCommand(args: string[], io: CliIo): Promise<void> {
  const options = {
    club: { type: "string" },
    seed: { type: "string" },
    out: { type: "string", default: "output" },
    clubs: { type: "string", default: CLUBS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  if (!values.club) throw new Error("Missing required option --club");
  const seed = parseSeed(values.seed);
  io.log(`Seed: ${seed}`);
  const club = await loadClub(values.club, values.clubs);
  const kit = generateKitSet(club, seed).home;
  const pngFile = path.resolve(values.out, club.id, "2d", kitAssetFileName(club.id, "home", "2d"));
  await writeOutput(pngFile, await renderKit2dPng(kit));
  // Salvar por último evita sobrescrever o kit.json versionado quando a renderização ou escrita do PNG falha.
  const kitFile = await saveKit(kit, values.clubs);
  io.log(`Generated ${club.name} home kit (seed ${seed})`);
  io.log(`  definition: ${kitFile}`);
  io.log(`  2D: ${pngFile}`);
}

async function renderCommand(args: string[], io: CliIo): Promise<void> {
  const { values } = parseArgs({ args, options: { definition: { type: "string" }, out: { type: "string" } }, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const kit = parseKitDefinition(await readJsonFile(values.definition));
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKit2dPng(kit));
  io.log(`Rendered ${values.definition} to ${out}`);
}

export async function runCli(argv: string[], io: CliIo = console): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "generate") await generateCommand(args, io);
    else if (command === "render") await renderCommand(args, io);
    else {
      io.error(USAGE);
      return 1;
    }
    return 0;
  } catch (error) {
    io.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
