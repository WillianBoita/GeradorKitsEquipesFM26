import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseKitDefinition } from "../../src/core/kit.js";
import { kitDefinitionPath, loadClub, saveKit } from "../../src/io/club-repository.js";
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

describe("saveKit", () => {
  it("writes clubs/<id>/kits/<type>/kit.json and returns the path", async () => {
    const dir = await makeClubsDir({});
    const file = await saveKit(makeKit(), "home", dir);
    expect(file).toBe(path.join(dir, "galaticos-fc", "kits", "home", "kit.json"));
    expect(file).toBe(kitDefinitionPath("galaticos-fc", "home", dir));
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8")))).toEqual(makeKit());
  });

  it("overwrites a previously saved kit", async () => {
    const dir = await makeClubsDir({});
    await saveKit(makeKit(), "home", dir);
    const file = await saveKit(makeKit({ shorts: { color: "primary" } }), "home", dir);
    expect(parseKitDefinition(JSON.parse(await readFile(file, "utf8"))).shorts.color).toBe("primary");
  });
});
