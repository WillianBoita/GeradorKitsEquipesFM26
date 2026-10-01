import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { AssetRegistry } from "../../src/assets/registry.js";
import { makeTempDir } from "./temp.js";

// Retângulo 60×20 com furo central: tem transparência, como um logo de verdade.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill-rule="evenodd" d="M0 0H60V20H0Z M24 6H36V14H24Z"/></svg>`;

// Retângulo colorido com 2 px de margem transparente.
export async function makeLogoPng(width: number, height: number, color = "#ff00ff"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="${color}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function makeOpaquePng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#ff00ff" } })
    .png()
    .toBuffer();
}

export const TEST_REGISTRY: AssetRegistry = {
  sponsors: [
    { id: "luna-air", name: "Luna Air", file: "sponsors/luna-air.svg" },
    { id: "orbita-bank", name: "Órbita Bank", file: "sponsors/orbita-bank.png" },
  ],
  manufacturers: [{ id: "vertex", name: "Vertex", file: "manufacturers/vertex.png" }],
};

// Só pode ser chamada dentro de um teste (usa makeTempDir).
export async function makeAssetsDir(): Promise<string> {
  const dir = await makeTempDir("assets");
  const files: Record<string, string | Buffer> = {
    "registry.json": JSON.stringify(TEST_REGISTRY),
    "sponsors/luna-air.svg": LOGO_SVG,
    "sponsors/orbita-bank.png": await makeLogoPng(60, 20),
    "manufacturers/vertex.png": await makeLogoPng(30, 30),
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }
  return dir;
}

// Escudo verde 40×40: no PNG renderizado, o centro da caixa do escudo fica #00ff00.
export async function writeClubLogo(clubsDir: string, clubId: string): Promise<void> {
  await writeFile(path.join(clubsDir, clubId, "logo.png"), await makeLogoPng(40, 40, "#00ff00"));
}
