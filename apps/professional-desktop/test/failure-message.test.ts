import { describe, expect, it } from "vitest";
import { failureMessageOr } from "@/lib/failureMessage";

describe("failureMessageOr", () => {
  const orFallback = failureMessageOr("fallback");

  it("returns the redacted message for an Error with a non-empty message", () => {
    expect(orFallback(new Error("boom"))).toBe("boom");
  });

  it("falls back for an Error with an empty message", () => {
    expect(orFallback(new Error(""))).toBe("fallback");
  });

  it("reads a non-empty message from a plain object", () => {
    expect(orFallback({ message: "shaped" })).toBe("shaped");
  });

  it("falls back for message-less causes", () => {
    expect(orFallback({})).toBe("fallback");
    expect(orFallback("boom")).toBe("fallback");
    expect(orFallback(undefined)).toBe("fallback");
  });
});
