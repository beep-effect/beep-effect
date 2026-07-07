import { VERSION } from "@beep/courtlistener";
import { describe, expect, it } from "vitest";

describe("@beep/courtlistener", () => {
  it("exposes the package version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
