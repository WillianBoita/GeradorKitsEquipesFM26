import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAssetRegistry } from "../../src/assets/registry.js";
import { checkAssetFiles, loadKitLogos, type AssetDirs } from "../../src/io/asset-repository.js";
import { LOGO_SVG, makeAssetsDir, makeOpaquePng, writeClubLogo } from "../fixtures/assets.js";
import { GALATICOS_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

async function setup(withLogo = true): Promise<AssetDirs> {
  const clubsDir = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
  if (withLogo) await writeClubLogo(clubsDir, "galaticos-fc");
  return { assetsDir: await makeAssetsDir(), clubsDir };
}

const BRANDED_KIT = makeKit({ badge: true, sponsor: { id: "luna-air", color: "accent" }, manufacturer: { id: "vertex", color: "accent" } });
const ALL_REFS = { badge: true, sponsors: ["luna-air", "orbita-bank"], manufacturers: ["vertex"] };

describe("loadKitLogos", () => {
  it("reads only the logos the kit declares", async () => {
    const dirs = await setup();
    const registry = await loadAssetRegistry(dirs.assetsDir);
    expect(await loadKitLogos(makeKit(), registry, dirs)).toEqual({});
    const logos = await loadKitLogos(BRANDED_KIT, registry, dirs);
    expect(Object.keys(logos).sort()).toEqual(["badge", "manufacturer", "sponsor"]);
    expect(logos.sponsor?.toString()).toBe(LOGO_SVG);
  });

  it("names the missing badge", async () => {
    const dirs = await setup(false);
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(
      `Club "galaticos-fc" badge not found: ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")}`,
    );
  });

  it("names the missing asset file", async () => {
    const dirs = await setup();
    const file = path.join(dirs.assetsDir, "manufacturers", "vertex.png");
    await rm(file);
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(`Manufacturer "vertex" file not found: ${file}`);
  });

  it("rejects ids missing from the registry", async () => {
    const dirs = await setup();
    const kit = makeKit({ sponsor: { id: "acme", color: "accent" } });
    await expect(loadKitLogos(kit, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow('Unknown sponsor "acme" (known: luna-air, orbita-bank)');
  });

  it("names files that are not images", async () => {
    const dirs = await setup();
    const file = path.join(dirs.assetsDir, "sponsors", "luna-air.svg");
    await writeFile(file, "not an image");
    await expect(loadKitLogos(BRANDED_KIT, await loadAssetRegistry(dirs.assetsDir), dirs)).rejects.toThrow(`Invalid image file: ${file}`);
  });
});

describe("checkAssetFiles", () => {
  it("accepts present images with transparency", async () => {
    const dirs = await setup();
    expect(await checkAssetFiles("galaticos-fc", ALL_REFS, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([]);
  });

  it("reports each missing file once", async () => {
    const dirs = await setup(false);
    const file = path.join(dirs.assetsDir, "manufacturers", "vertex.png");
    await rm(file);
    const refs = { badge: true, sponsors: [], manufacturers: ["vertex", "vertex"] };
    expect(await checkAssetFiles("galaticos-fc", refs, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([
      { rule: "missing-asset", message: `club badge not found: ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")}` },
      { rule: "missing-asset", message: `manufacturer "vertex" file not found: ${file}` },
    ]);
  });

  it("reports opaque logos and files that are not images", async () => {
    const dirs = await setup();
    await writeFile(path.join(dirs.assetsDir, "sponsors", "orbita-bank.png"), await makeOpaquePng(60, 20));
    await writeFile(path.join(dirs.assetsDir, "sponsors", "luna-air.svg"), "not an image");
    await writeFile(path.join(dirs.clubsDir, "galaticos-fc", "logo.png"), "not an image");
    expect(await checkAssetFiles("galaticos-fc", ALL_REFS, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([
      { rule: "invalid-file", message: `club badge ${path.join(dirs.clubsDir, "galaticos-fc", "logo.png")} is not a valid image` },
      { rule: "invalid-file", message: 'sponsor "luna-air" (sponsors/luna-air.svg) is not a valid image' },
      { rule: "opaque-logo", message: 'sponsor "orbita-bank" (sponsors/orbita-bank.png) has no transparent pixels' },
    ]);
  });

  it("skips ids missing from the registry", async () => {
    const dirs = await setup();
    const refs = { badge: false, sponsors: ["acme"], manufacturers: [] };
    expect(await checkAssetFiles("galaticos-fc", refs, await loadAssetRegistry(dirs.assetsDir), dirs)).toEqual([]);
  });
});
