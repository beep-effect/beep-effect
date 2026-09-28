import { VERSION } from "@beep/pandoc-ast/Version";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("Version", () => {
  it("matches the package version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
