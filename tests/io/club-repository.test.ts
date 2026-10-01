import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseKitDefinition, type KitType } from "../../src/core/kit.js";
import { clubLogoPath, hasClubLogo, kitDefinitionPath, listClubIds, loadClub, loadKit, saveKit } from "../../src/io/club-repository.js";
import { writeClubLogo } from "../fixtures/assets.js";
import { GALATICOS_CLUB, makeClubsDir } from "../fixtures/clubs.js";
import { makeKit } from "../fixtures/kits.js";

describe("loadClub", () => {
  it("loads the bundled galaticos-fc club", async () => {
    const club = await loadClub("galaticos-fc");
    expect(club.name).toBe("Galáticos FC");
    expect(club.palette.primary).toBe("#123456");
    expect(club.fmUniqueId).toBeUndefined();
  });

  it("loads clubs from a custom directory", async () => {
    const dir = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
    expect((await loadClub("galaticos-fc", dir)).id).toBe("galaticos-fc");
  });

  it("reports missing clubs", async () => {
    const dir = await makeClubsDir({});
    await expect(loadClub("ghost", dir)).rejects.toThrow(/Club "ghost" not found/);
  });

  it("reports invalid JSON with the file name", async () => {
    const dir = await makeClubsDir({ broken: "{ not json" });
    await expect(loadClub("broken", dir)).rejects.toThrow(/Invalid JSON in .*broken.*club\.json/);
  });

  it("rejects ids that could escape the clubs directory", async () => {
    await expect(loadClub("../secrets")).rejects.toThrow(/Invalid club id/);
  });

  it("rejects club files whose id does not match the folder", async () => {
    const dir = await makeClubsDir({ alpha: JSON.stringify({ ...GALATICOS_CLUB, id: "beta" }) });
    await expect(loadClub("alpha", dir)).rejects.toThrow(/declares id "beta", expected "alpha"/);
  });

  it("reports invalid club content", async () => {
    const dir = await makeClubsDir({ bad: JSON.stringify({ ...GALATICOS_CLUB, id: "bad", palette: { primary: "azul" } }) });
    await expect(loadClub("bad", dir)).rejects.toThrow(/Invalid club identity/);
  });
});

describe("listClubIds", () => {
  it("lists folders that contain a club.json, sorted", async () => {
    const dir = await makeClubsDir({ "kong-team": "{}", "galaticos-fc": "{}" });
    await mkdir(path.join(dir, "empty-folder"));
    await writeFile(path.join(dir, "notes.txt"), "");
    expect(await listClubIds(dir)).toEqual(["galaticos-fc", "kong-team"]);
  });

  it("returns an empty list for an empty directory", async () => {
    expect(await listClubIds(await makeClubsDir({}))).toEqual([]);
  });

  it("reports a missing directory", async () => {
    const dir = path.join(await makeClubsDir({}), "missing");
    await expect(listClubIds(dir)).rejects.toThrow(`Clubs directory not found: ${dir}`);
  });
});

describe("kitDefinitionPath", () => {
  it("rejects kit types outside home, away and third at runtime", () => {
    expect(() => kitDefinitionPath("galaticos-fc", "fourth" as KitType)).toThrow(/Invalid kit type/);
  });
});

describe("saveKit", () => {
  it("writes clubs/<id>/kits/<kitType>/kit.json and returns the path", async () => {
    const dir = await makeClubsDir({});
    const kit = makeKit({ kitType: "away" });
    const file = await saveKit(kit, dir);
    expect(file).toBe(path.join(dir, "galaticos-fc", "kits", "away", "kit.json"));
    expect(file).toBe(kitDefinitionPath("galaticos-fc", "away", dir));
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8")))).toEqual(kit);
  });

  it("overwrites a previously saved kit", async () => {
    const dir = await makeClubsDir({});
    await saveKit(makeKit(), dir);
    const file = await saveKit(makeKit({ shorts: { color: "primary" } }), dir);
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8"))).shorts.color).toBe("primary");
  });
});

describe("loadKit", () => {
  async function writeGalaticosKitFile(dir: string, kitType: KitType, content: unknown): Promise<string> {
    const file = kitDefinitionPath("galaticos-fc", kitType, dir);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
    return file;
  }

  it("loads a saved kit", async () => {
    const dir = await makeClubsDir({});
    const kit = makeKit({ kitType: "third", generatedWith: { seed: 42 } });
    await saveKit(kit, dir);
    expect(await loadKit("galaticos-fc", "third", dir)).toEqual(kit);
  });

  it("returns undefined when the kit does not exist", async () => {
    expect(await loadKit("galaticos-fc", "home", await makeClubsDir({}))).toBeUndefined();
  });

  it("rejects a kit saved in the folder of another kit type", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", makeKit({ kitType: "away" }));
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`${file} declares kitType "away", expected "home"`);
  });

  it("rejects a kit saved in the folder of another club", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", makeKit({ clubId: "kong-team" }));
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`${file} declares clubId "kong-team", expected "galaticos-fc"`);
  });

  it("names the file when the content is invalid", async () => {
    const dir = await makeClubsDir({});
    const file = await writeGalaticosKitFile(dir, "home", { ...makeKit(), kitType: undefined });
    await expect(loadKit("galaticos-fc", "home", dir)).rejects.toThrow(`Invalid kit definition in ${file}`);
  });
});

describe("club logo", () => {
  it("lives at clubs/<id>/logo.png", () => {
    expect(clubLogoPath("galaticos-fc", "/tmp/clubs")).toBe(path.join("/tmp/clubs", "galaticos-fc", "logo.png"));
    expect(() => clubLogoPath("../escape", "/tmp/clubs")).toThrow(/Invalid club id/);
  });

  it("reports whether the club has a logo", async () => {
    const dir = await makeClubsDir({ "galaticos-fc": JSON.stringify(GALATICOS_CLUB) });
    expect(await hasClubLogo("galaticos-fc", dir)).toBe(false);
    await writeClubLogo(dir, "galaticos-fc");
    expect(await hasClubLogo("galaticos-fc", dir)).toBe(true);
  });
});
