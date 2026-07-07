import { VERSION } from "@beep/federal-register";
import { describe, expect, it } from "vitest";

describe("@beep/federal-register", () => {
  it("exposes the package version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
