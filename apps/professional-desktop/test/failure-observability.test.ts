import { describe, expect, it } from "vitest";
import { failureMessageOr } from "@/lib/failureMessage";

describe("Professional Desktop failure observability", () => {
  it("redacts secrets and home paths before rendering client failure text", () => {
    const message = failureMessageOr("Operation failed.")(
      new Error("request failed at /home/ada/private with token=super-secret-value")
    );

    expect(message).not.toContain("/home/ada");
    expect(message).not.toContain("super-secret-value");
    expect(message).toContain("[REDACTED]");
  });

  it("uses the caller fallback for failures without a message", () => {
    expect(failureMessageOr("Operation failed.")({ reason: "unknown" })).toBe("Operation failed.");
  });
});
