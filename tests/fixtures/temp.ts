import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

// Só pode ser chamada dentro de um teste: a pasta é apagada quando o teste termina, passe ou falhe.
export async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), `kitgen-${prefix}-`));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
