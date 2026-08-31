import { privacySafeSystemTempRootForTesting } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";

describe("privacy-safe system temp root", () => {
  it("ignores a private ambient TMPDIR on POSIX hosts", () => {
    expect(
      privacySafeSystemTempRootForTesting({
        environment: { TMPDIR: "/home/example/.cache/managed-temp" },
        runtimePlatform: "linux",
      })
    ).toBe("/tmp");
  });

  it("uses the Windows system root instead of a per-user TEMP", () => {
    expect(
      privacySafeSystemTempRootForTesting({
        environment: {
          SystemRoot: "C:\\Windows",
          TEMP: "C:\\Users\\example\\AppData\\Local\\Temp",
        },
        runtimePlatform: "win32",
      })
    ).toBe("C:\\Windows\\Temp");
  });

  it("uses the canonical Windows fallback when the system root is absent", () => {
    expect(privacySafeSystemTempRootForTesting({ environment: {}, runtimePlatform: "win32" })).toBe(
      "C:\\Windows\\Temp"
    );
  });
});
