import { VERSION } from "@beep/dol";
import { describe, expect, it } from "vitest";

describe("@beep/dol", () => {
  it("exposes the package version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
