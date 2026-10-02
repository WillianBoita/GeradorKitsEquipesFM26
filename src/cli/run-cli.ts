import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadAssetRegistry, type AssetRegistry } from "../assets/registry.js";
import { ASSETS_DIR, CLUBS_DIR, FM26_EXPORT_DIR, kitRenderPath, OUTPUT_DIR } from "../config/paths.js";
import type { ClubIdentity } from "../core/club.js";
import { errorMessage } from "../core/errors.js";
import { BRAND_LISTS, KIT_TYPES, KitDefinitionSchema, KitTypeSchema, type BrandKind, type KitDefinition, type KitType } from "../core/kit.js";
import { parseWith } from "../core/primitives.js";
import { deriveSeed, MAX_SEED } from "../core/random.js";
import { formatIssues, validateClub, validateClubAssets, validateKit, validateKitAssets, validateKitSet, type ValidationIssue } from "../core/validation.js";
import { ExportAbortedError, exportKits, type RenderKit } from "../fm26/exporter.js";
import { generateKitSet } from "../generator/kit-generator.js";
import { checkAssetFiles, loadKitLogos, type AssetDirs, type AssetRefs } from "../io/asset-repository.js";
import { hasClubLogo, listClubIds, loadClub, loadKit, saveKit } from "../io/club-repository.js";
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
  assetsDir: string;
  registry: AssetRegistry;
}

export const USAGE = [
  "Usage:",
  "  kit-generator generate (--club <id> | --all) [--type <home|away|third>] [--seed <n>] [--out <dir>] [--clubs <dir>] [--assets <dir>]",
  "  kit-generator render --definition <kit.json> --out <file.png> [--clubs <dir>] [--assets <dir>]",
  "  kit-generator validate (--club <id> | --all) [--clubs <dir>] [--assets <dir>]",
  "  kit-generator export [--out <dir>] [--clubs <dir>] [--assets <dir>]",
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
  const assetIssues = validateClubAssets(club, options.registry);
  if (assetIssues.length > 0) throw new Error(`Club "${club.id}" is invalid:\n${formatIssues(assetIssues)}`);
  const set = generateKitSet(club, seed, { badge: await hasClubLogo(club.id, options.clubsDir) });
  const kits = options.kitTypes.map((kitType) => set[kitType]);
  // Todos os PNGs antes do primeiro kit.json: uma falha de renderização não deixa o conjunto versionado pela metade.
  const pngFiles: string[] = [];
  for (const kit of kits) {
    const pngFile = kitRenderPath(options.outDir, club.id, kit.kitType, "2d");
    const logos = await loadKitLogos(kit, options.registry, options);
    await writeOutput(pngFile, await renderKit2dPng(kit, { logos }));
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
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const kitTypes = values.type === undefined ? KIT_TYPES : [parseWith(KitTypeSchema, values.type, "kit type")];
  const seed = values.seed === undefined ? undefined : parseSeed(values.seed);
  const clubIds = await resolveClubIds(values, values.clubs);
  const registry = await loadAssetRegistry(values.assets);
  const generateOptions: GenerateOptions = { kitTypes, outDir: path.resolve(values.out), clubsDir: values.clubs, assetsDir: values.assets, registry };
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
  const options = {
    definition: { type: "string" },
    out: { type: "string" },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  if (!values.definition) throw new Error("Missing required option --definition");
  if (!values.out) throw new Error("Missing required option --out");
  const kit = parseWith(KitDefinitionSchema, await readJsonFile(values.definition), `kit definition in ${values.definition}`);
  const registry = await loadAssetRegistry(values.assets);
  const logos = await loadKitLogos(kit, registry, { assetsDir: values.assets, clubsDir: values.clubs });
  const out = path.resolve(values.out);
  await writeOutput(out, await renderKit2dPng(kit, { logos }));
  io.log(`Rendered ${values.definition} to ${out}`);
  return 0;
}

type RegistryLoad = { registry: AssetRegistry } | { error: string };

function assetRefs(club: ClubIdentity, kits: KitDefinition[]): AssetRefs {
  const ids = (kind: BrandKind): string[] => [...Object.keys(club[BRAND_LISTS[kind]] ?? {}), ...kits.flatMap((kit) => kit[kind]?.id ?? [])];
  return { badge: kits.some((kit) => kit.badge === true), sponsors: ids("sponsor"), manufacturers: ids("manufacturer") };
}

// Junta todos os problemas do clube em vez de parar no primeiro, para o usuário corrigir tudo de uma vez.
async function validateClubFiles(clubId: string, dirs: AssetDirs, load: RegistryLoad): Promise<{ kitCount: number; issues: ValidationIssue[] }> {
  let club: ClubIdentity;
  try {
    club = await loadClub(clubId, dirs.clubsDir);
  } catch (error) {
    return { kitCount: 0, issues: [{ rule: "invalid-file", message: errorMessage(error) }] };
  }
  const issues = validateClub(club);
  const kits: Partial<Record<KitType, KitDefinition>> = {};
  for (const kitType of KIT_TYPES) {
    try {
      const kit = await loadKit(club.id, kitType, dirs.clubsDir);
      if (kit) kits[kitType] = kit;
    } catch (error) {
      issues.push({ rule: "invalid-file", message: errorMessage(error) });
    }
  }
  const loaded = Object.values(kits);
  issues.push(...loaded.flatMap((kit) => validateKit(kit)), ...validateKitSet(kits));
  // Sem registry não dá para conferir ids nem arquivos de logo; o erro do registry já explica o FAIL.
  if ("error" in load) {
    issues.push({ rule: "invalid-file", message: load.error });
  } else {
    issues.push(...validateClubAssets(club, load.registry), ...loaded.flatMap((kit) => validateKitAssets(kit, load.registry)));
    issues.push(...(await checkAssetFiles(club.id, assetRefs(club, loaded), load.registry, dirs)));
  }
  return { kitCount: loaded.length, issues };
}

async function validateCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    club: { type: "string" },
    all: { type: "boolean", default: false },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const clubIds = await resolveClubIds(values, values.clubs);
  const load: RegistryLoad = await loadAssetRegistry(values.assets).then(
    (registry) => ({ registry }),
    (error: unknown) => ({ error: errorMessage(error) }),
  );
  const dirs: AssetDirs = { assetsDir: values.assets, clubsDir: values.clubs };
  let failed = 0;
  for (const clubId of clubIds) {
    const { kitCount, issues } = await validateClubFiles(clubId, dirs, load);
    if (issues.length === 0) {
      io.log(`OK ${clubId} (${kitCount} kits)`);
    } else {
      failed++;
      io.error(`FAIL ${clubId}\n${formatIssues(issues)}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function exportCommand(args: string[], io: CliIo): Promise<number> {
  const options = {
    out: { type: "string", default: FM26_EXPORT_DIR },
    clubs: { type: "string", default: CLUBS_DIR },
    assets: { type: "string", default: ASSETS_DIR },
  } as const;
  const { values } = parseArgs({ args, options, strict: true });
  const registry = await loadAssetRegistry(values.assets);
  const dirs: AssetDirs = { assetsDir: values.assets, clubsDir: values.clubs };
  // Só 2D na 3a; a 3b escolhe o renderer pelo renderType.
  const renderKit: RenderKit = async (kit) => renderKit2dPng(kit, { logos: await loadKitLogos(kit, registry, dirs) });
  try {
    const result = await exportKits({ clubsDir: values.clubs, outDir: path.resolve(values.out), renderTypes: ["2d"], renderKit });
    for (const { club, kitTypes } of result.clubs) io.log(`Exported ${club.name}: ${kitTypes.join(", ")}`);
    io.log(`Wrote ${result.recordCount} records to ${result.configFile}`);
    return 0;
  } catch (error) {
    if (!(error instanceof ExportAbortedError)) throw error;
    for (const failure of error.failures) io.error(`Error: [${failure.clubId}] Club cannot be exported:\n${formatIssues(failure.issues)}`);
    io.error(`Error: ${error.message}`);
    return 1;
  }
}

export async function runCli(argv: string[], io: CliIo = console): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (command === "generate") return await generateCommand(args, io);
    if (command === "render") return await renderCommand(args, io);
    if (command === "validate") return await validateCommand(args, io);
    if (command === "export") return await exportCommand(args, io);
    io.error(USAGE);
    return 1;
  } catch (error) {
    io.error(`Error: ${errorMessage(error)}`);
    return 1;
  }
}
