import {
  defaultPersonMatchBackendForPlatform,
  trustedUvExecutableNameForPlatform,
  trustedUvRootDirectoriesForPlatform,
  validatePersonMatchBackendPlatform,
} from "@beep/repo-cli/test/Files";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("person-match backend portability", () => {
  it("keeps AdaFace as the Linux x64 default", () => {
    expect(defaultPersonMatchBackendForPlatform("linux", "x64")).toBe("adaface-kprpe");
  });

  it("selects portable Buffalo defaults on unsupported hosts", () => {
    expect(defaultPersonMatchBackendForPlatform("darwin", "arm64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("darwin", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("win32", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("linux", "arm64")).toBe("buffalo-l");
  });

  it("uses the native uv executable name on Windows", () => {
    expect(trustedUvExecutableNameForPlatform("win32")).toBe("uv.exe");
    expect(trustedUvExecutableNameForPlatform("linux")).toBe("uv");
    expect(trustedUvExecutableNameForPlatform("darwin")).toBe("uv");
  });

  it("does not probe POSIX trusted roots on Windows", () => {
    expect(trustedUvRootDirectoriesForPlatform("win32")).toStrictEqual([]);
    expect(trustedUvRootDirectoriesForPlatform("linux")).toStrictEqual(["/usr/bin", "/usr/local/bin"]);
  });

  it.effect("accepts Buffalo on every platform represented by frozen wheel artifacts", () =>
    Effect.all(
      [
        validatePersonMatchBackendPlatform("buffalo-l", "linux", "x64"),
        validatePersonMatchBackendPlatform("buffalo-l", "linux", "arm64"),
        validatePersonMatchBackendPlatform("buffalo-l", "darwin", "x64"),
        validatePersonMatchBackendPlatform("buffalo-l", "darwin", "arm64"),
        validatePersonMatchBackendPlatform("buffalo-l", "win32", "x64"),
      ],
      { concurrency: 5, discard: true }
    )
  );

  it.effect("rejects explicit AdaFace before its platform-locked runtime can start", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(validatePersonMatchBackendPlatform("adaface-kprpe", "win32", "x64"));

      expect(error.message).toBe(
        "AdaFace KP-RPE is unavailable on win32/x64; its pinned ROCm PyTorch runtime supports only Linux x64. " +
          "Re-run with --backend buffalo-l --compute cpu."
      );
    })
  );

  it.effect("rejects Buffalo where its frozen CPU environment has no wheel set", () =>
    Effect.gen(function* () {
      const windowsArm = yield* Effect.flip(validatePersonMatchBackendPlatform("buffalo-l", "win32", "arm64"));
      const freeBsd = yield* Effect.flip(validatePersonMatchBackendPlatform("buffalo-l", "freebsd", "x64"));

      expect(windowsArm.message).toContain("unavailable on win32/arm64");
      expect(freeBsd.message).toContain("unavailable on freebsd/x64");
    })
  );
});
