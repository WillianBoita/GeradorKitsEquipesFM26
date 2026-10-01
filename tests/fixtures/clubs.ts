import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { makeTempDir } from "./temp.js";

export const GALATICOS_CLUB = {
  id: "galaticos-fc",
  name: "Galáticos FC",
  palette: { primary: "#123456", secondary: "#FFFFFF", accent: "#FFD700" },
  style: { categories: ["modern"], patternWeights: { solid: 20, stripes: 40, sash: 40 } },
};

export async function makeClubsDir(clubs: Record<string, string>): Promise<string> {
  const dir = await makeTempDir("clubs");
  for (const [id, content] of Object.entries(clubs)) {
    await mkdir(path.join(dir, id), { recursive: true });
    await writeFile(path.join(dir, id, "club.json"), content);
  }
  return dir;
}
