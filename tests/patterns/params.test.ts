import { describe, expect, it } from "vitest";
import { resolveParams } from "../../src/patterns/params.js";
import type { PatternTemplate } from "../../src/patterns/types.js";

const template: PatternTemplate = {
  id: "test",
  name: "Test",
  category: "test",
  defaultWeight: 1,
  parameters: { count: { min: 2, max: 10, default: 4, integer: true }, ratio: { min: 0.1, max: 0.9, default: 0.5 } },
  render: () => "",
};

describe("resolveParams", () => {
  it("uses defaults for missing params", () => {
    expect(resolveParams(template, {})).toEqual({ count: 4, ratio: 0.5 });
  });

  it("clamps out-of-range values", () => {
    expect(resolveParams(template, { count: 100, ratio: -3 })).toEqual({ count: 10, ratio: 0.1 });
  });

  it("rounds integer params", () => {
    expect(resolveParams(template, { count: 3.6 }).count).toBe(4);
  });

  it("replaces non-finite values with defaults", () => {
    expect(resolveParams(template, { count: Number.NaN, ratio: Number.POSITIVE_INFINITY })).toEqual({ count: 4, ratio: 0.5 });
  });

  it("ignores unknown params", () => {
    expect(resolveParams(template, { foo: 1 })).toEqual({ count: 4, ratio: 0.5 });
  });
});
