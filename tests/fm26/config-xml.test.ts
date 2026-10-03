import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import type { KitType } from "../../src/core/kit.js";
import { buildConfigXml, fmTargetPath, fmTeamId, isGeneratedConfigXml, validateConfigRecords, type ConfigRecord } from "../../src/fm26/config-xml.js";
import type { RenderType } from "../../src/fm26/naming.js";

const GALATICOS_2D: ConfigRecord[] = [
  { from: "galaticos_fc_home_2d", to: "graphics/pictures/team/1/kits/home" },
  { from: "galaticos_fc_away_2d", to: "graphics/pictures/team/1/kits/away" },
  { from: "galaticos_fc_third_2d", to: "graphics/pictures/team/1/kits/third" },
];

describe("fmTeamId", () => {
  it("combines the editor ids as fmRandomId × 4294967296 + fmUniqueId", () => {
    expect(fmTeamId("2", "1")).toBe("4294967298");
    expect(fmTeamId("7", "0")).toBe("7");
  });

  // Valores reais do Galáticos e do Kongs no editor: o resultado passa de Number.MAX_SAFE_INTEGER.
  it("keeps every digit of ids beyond Number.MAX_SAFE_INTEGER", () => {
    expect(fmTeamId("2000778260", "249337767")).toBe("1070897556923446292");
    expect(fmTeamId("2000778246", "282836473")).toBe("1214773403651765254");
    expect(fmTeamId("4294967295", "4294967295")).toBe("18446744073709551615");
  });

  it("writes the decimal form without leading zeros", () => {
    expect(fmTeamId("007", "0")).toBe("7");
  });

  it.each([
    ["fmUniqueId", "4294967296", "0"],
    ["fmUniqueId", "12a", "0"],
    ["fmRandomId", "1", "4294967296"],
    ["fmRandomId", "1", "-1"],
  ])("rejects an invalid %s", (label, fmUniqueId, fmRandomId) => {
    expect(() => fmTeamId(fmUniqueId, fmRandomId)).toThrow(new RegExp(`Invalid ${label}`));
  });
});

describe("fmTargetPath", () => {
  it("maps 2D renders to kits/<type>", () => {
    expect(fmTargetPath("123456789", "home", "2d")).toBe("graphics/pictures/team/123456789/kits/home");
  });

  it("maps 3D renders to kit_textures/<type>", () => {
    expect(fmTargetPath("123456789", "third", "3d")).toBe("graphics/pictures/team/123456789/kit_textures/third");
  });

  it("accepts a 64-bit team id", () => {
    expect(fmTargetPath("18446744073709551615", "away", "2d")).toBe("graphics/pictures/team/18446744073709551615/kits/away");
  });

  it.each(["", "12a", "-1", "../1", "1.5"])("rejects the fmTeamId %j", (teamId) => {
    expect(() => fmTargetPath(teamId, "home", "2d")).toThrow(/Invalid fmTeamId/);
  });

  it("rejects unknown kit types at runtime", () => {
    expect(() => fmTargetPath("1", "fourth" as KitType, "2d")).toThrow(/Invalid kit type/);
  });

  it("rejects unknown render types at runtime", () => {
    expect(() => fmTargetPath("1", "home", "4d" as RenderType)).toThrow(/Invalid render type/);
  });
});

describe("validateConfigRecords", () => {
  it("accepts 2D and 3D records for several clubs", () => {
    const records = [
      ...GALATICOS_2D,
      { from: "galaticos_fc_home_3d", to: "graphics/pictures/team/1/kit_textures/home" },
      { from: "kong_team_home_2d", to: "graphics/pictures/team/2/kits/home" },
    ];
    expect(validateConfigRecords(records)).toEqual([]);
  });

  it.each(["", "Galaticos FC", 'a"b', "galaticos-fc_home_2d", "../x"])("flags the from %j", (from) => {
    expect(validateConfigRecords([{ from, to: "graphics/pictures/team/1/kits/home" }]).map((issue) => issue.rule)).toEqual(["invalid-from"]);
  });

  it.each([
    "graphics/pictures/team/abc/kits/home",
    "graphics/pictures/team/1/kits/fourth",
    "graphics/pictures/team/1/logo",
    "graphics/pictures/team//kits/home",
    "/graphics/pictures/team/1/kits/home",
  ])("flags the to %j", (to) => {
    expect(validateConfigRecords([{ from: "galaticos_fc_home_2d", to }]).map((issue) => issue.rule)).toEqual(["invalid-to"]);
  });

  it("describes the expected target in invalid-to", () => {
    expect(validateConfigRecords([{ from: "galaticos_fc_home_2d", to: "x" }])).toEqual([
      { rule: "invalid-to", message: '"x" is not graphics/pictures/team/<fmTeamId>/<kits|kit_textures>/<home|away|third>' },
    ]);
  });

  it("flags each repeated from once", () => {
    const record = GALATICOS_2D[0]!;
    const issues = validateConfigRecords([
      record,
      { ...record, to: "graphics/pictures/team/2/kits/home" },
      { ...record, to: "graphics/pictures/team/3/kits/home" },
    ]);
    expect(issues).toEqual([{ rule: "duplicate-from", message: 'from="galaticos_fc_home_2d" appears in more than one record' }]);
  });

  it("flags a repeated to", () => {
    const issues = validateConfigRecords([GALATICOS_2D[0]!, { from: "kong_team_home_2d", to: "graphics/pictures/team/1/kits/home" }]);
    expect(issues).toEqual([{ rule: "duplicate-to", message: 'to="graphics/pictures/team/1/kits/home" appears in more than one record' }]);
  });
});

describe("isGeneratedConfigXml", () => {
  it("recognizes its own output, with and without records", () => {
    expect(isGeneratedConfigXml(buildConfigXml(GALATICOS_2D))).toBe(true);
    expect(isGeneratedConfigXml(buildConfigXml([]))).toBe(true);
  });

  it.each([
    ["another pack's map", '<record>\n    <list id="maps">\n        <record from="foreign" to="graphics/pictures/clubs/1/logo"/>\n    </list>\n</record>\n'],
    ["an extra tag", buildConfigXml(GALATICOS_2D).replace("</record>\n", '<boolean id="extra" value="true"/>\n</record>\n')],
    ["a hand-edited target", buildConfigXml(GALATICOS_2D).replace("kits/home", "kits/fourth")],
    ["free text", "hello"],
  ])("rejects %s", (_label, xml) => {
    expect(isGeneratedConfigXml(xml)).toBe(false);
  });
});

describe("buildConfigXml", () => {
  it("writes the FM26 config format with one record per line", () => {
    expect(buildConfigXml(GALATICOS_2D)).toBe(
      [
        "<record>",
        '    <boolean id="preload" value="false"/>',
        '    <boolean id="amap" value="false"/>',
        '    <list id="maps">',
        '        <record from="galaticos_fc_home_2d" to="graphics/pictures/team/1/kits/home"/>',
        '        <record from="galaticos_fc_away_2d" to="graphics/pictures/team/1/kits/away"/>',
        '        <record from="galaticos_fc_third_2d" to="graphics/pictures/team/1/kits/third"/>',
        "    </list>",
        "</record>",
        "",
      ].join("\n"),
    );
  });

  it("produces well-formed XML whose records read back in order", () => {
    const xml = buildConfigXml(GALATICOS_2D);
    expect(XMLValidator.validate(xml)).toBe(true);
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" }).parse(xml);
    expect(parsed.record.list.record).toEqual(GALATICOS_2D);
    expect(parsed.record.boolean).toEqual([
      { id: "preload", value: "false" },
      { id: "amap", value: "false" },
    ]);
  });

  it("keeps an empty map list well-formed", () => {
    const xml = buildConfigXml([]);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('    <list id="maps">\n    </list>\n');
  });

  it("refuses to serialize records that would break the XML", () => {
    expect(() => buildConfigXml([{ from: 'a"b', to: "graphics/pictures/team/1/kits/home" }])).toThrow(/Invalid config\.xml records:\n {2}- invalid-from/);
  });
});
