import { readFile } from "node:fs/promises";

export class FileNotFoundError extends Error {
  readonly file: string;

  constructor(file: string) {
    super(`File not found: ${file}`);
    this.file = file;
  }
}

export async function readJsonFile(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new FileNotFoundError(file);
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${file}: ${(error as Error).message}`);
  }
}
