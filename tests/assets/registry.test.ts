import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assetFilePath, findAsset, getAsset, knownAssetIds, loadAssetRegistry, type AssetRegistry } from "../../src/assets/registry.js";
import { ASSETS_DIR } from "../../src/config/paths.js";
import { makeTempDir } from "../fixtures/temp.js";

const REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.png" },
  ],
  manufacturers: [],
};

async function registryDir(content: unknown): Promise<string> {
  const dir = await makeTempDir("assets");
  await writeFile(path.join(dir, "registry.json"), JSON.stringify(content));
  return dir;
}

function withSponsorFile(file: string): unknown {
  return { ...REGISTRY, sponsors: [{ id: "luna-air", name: "Luna Air", file }] };
}

describe("loadAssetRegistry", () => {
  it("loads registry.json from the assets folder", async () => {
    expect(await loadAssetRegistry(await registryDir(REGISTRY))).toEqual(REGISTRY);
  });

  it("loads the bundled registry, whose files all exist", async () => {
    const registry = await loadAssetRegistry(ASSETS_DIR);
    const entries = [...registry.sponsors, ...registry.manufacturers];
    expect(entries.map((entry) => entry.id)).toEqual(["luna-air", "orbita-bank", "vertex"]);
    for (const entry of entries) await expect(access(assetFilePath(ASSETS_DIR, entry))).resolves.toBeUndefined();
  });

  it("reports a missing registry file", async () => {
    const dir = await makeTempDir("assets");
    await expect(loadAssetRegistry(dir)).rejects.toThrow(`Asset registry not found: ${path.join(dir, "registry.json")}`);
  });

  // Nenhum asset pode sair da pasta de assets.
  it.each([
    "/etc/logo.png",
    "../logo.png",
    "sponsors/../../logo.png",
    "./sponsors/logo.png",
    "sponsors\\logo.png",
    "sponsors//logo.png",
    "sponsors/logo.jpg",
    "sponsors/logo",
  ])("rejects the file path %j", async (file) => {
    const dir = await registryDir(withSponsorFile(file));
    await expect(loadAssetRegistry(dir)).rejects.toThrow(`Invalid asset registry in ${path.join(dir, "registry.json")}`);
  });

  it("rejects ids repeated inside a list", async () => {
    const dir = await registryDir({ ...REGISTRY, sponsors: [REGISTRY.sponsors[0], REGISTRY.sponsors[0]] });
    await expect(loadAssetRegistry(dir)).rejects.toThrow(/ids must be unique/);
  });

  it("rejects invalid ids", async () => {
    const dir = await registryDir({ ...REGISTRY, manufacturers: [{ id: "Vertex", name: "Vertex", file: "manufacturers/vertex.svg" }] });
    await expect(loadAssetRegistry(dir)).rejects.toThrow(/manufacturers\[0\]\.id/);
  });

  it("rejects unknown keys and requires both lists", async () => {
    await expect(loadAssetRegistry(await registryDir({ ...REGISTRY, logos: [] }))).rejects.toThrow(/logos/);
    await expect(loadAssetRegistry(await registryDir({ sponsors: [] }))).rejects.toThrow(/manufacturers/);
  });
});

describe("registry lookups", () => {
  it("finds entries by kind and id", () => {
    expect(findAsset(REGISTRY, "sponsor", "orbita-bank")).toEqual(REGISTRY.sponsors[1]);
    expect(findAsset(REGISTRY, "manufacturer", "orbita-bank")).toBeUndefined();
    expect(getAsset(REGISTRY, "sponsor", "luna-air")).toEqual(REGISTRY.sponsors[0]);
  });

  it("lists the known ids when an id is unknown", () => {
    expect(() => getAsset(REGISTRY, "sponsor", "acme")).toThrow('Unknown sponsor "acme" (known: luna-air, orbita-bank)');
    expect(() => getAsset(REGISTRY, "manufacturer", "kong")).toThrow('Unknown manufacturer "kong" (known: none)');
    expect(knownAssetIds(REGISTRY, "manufacturer")).toBe("none");
  });

  it("resolves files inside the assets folder", () => {
    expect(assetFilePath("/tmp/assets", REGISTRY.sponsors[0]!)).toBe(path.join("/tmp/assets", "sponsors", "luna-air.svg"));
  });
});
