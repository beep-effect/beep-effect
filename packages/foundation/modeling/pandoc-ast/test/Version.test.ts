import { VERSION } from "@beep/pandoc-ast/Version";
import { describe, expect, it } from "@effect/vitest";

describe("Version", () => {
  it("matches the package version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
