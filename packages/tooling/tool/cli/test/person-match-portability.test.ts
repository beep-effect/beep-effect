import {
  defaultPersonMatchBackendForPlatform,
  MatchPersonOptions,
  PersonMatchWorkerPolicyForTest,
  trustedUvExecutableNameForPlatform,
  trustedUvRootDirectoriesForPlatform,
  validatePersonMatchBackendPlatform,
} from "@beep/repo-cli/test/Files";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";

const makePersonMatchOptions = (
  backend: "buffalo-l" | "adaface-kprpe",
  compute: "auto" | "cpu" | "rocm"
): MatchPersonOptions =>
  MatchPersonOptions.make({
    backend,
    compute,
    detectionThreshold: 0.5,
    dir: "/photos/mixed",
    manifest: "/reports/matches.json",
    matchThreshold: 0.45,
    minFaceAreaPct: 2,
    references: "/photos/references",
    reviewThreshold: 0.35,
  });

describe("person-match backend portability", () => {
  it("keeps AdaFace as the Linux x64 default", () => {
    expect(defaultPersonMatchBackendForPlatform("linux", "x64")).toBe("adaface-kprpe");
  });

  it("selects Buffalo when AdaFace is unsupported", () => {
    expect(defaultPersonMatchBackendForPlatform("darwin", "arm64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("darwin", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("win32", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("linux", "arm64")).toBe("buffalo-l");
  });

  it("selects isolated CPU and ROCm environments from the compute policy", () => {
    expect(PersonMatchWorkerPolicyForTest.initialEnvironment(makePersonMatchOptions("buffalo-l", "auto"))).toBe(
      "primary"
    );
    expect(PersonMatchWorkerPolicyForTest.initialEnvironment(makePersonMatchOptions("adaface-kprpe", "auto"))).toBe(
      "primary"
    );
    expect(PersonMatchWorkerPolicyForTest.initialEnvironment(makePersonMatchOptions("adaface-kprpe", "rocm"))).toBe(
      "primary"
    );
    expect(PersonMatchWorkerPolicyForTest.initialEnvironment(makePersonMatchOptions("adaface-kprpe", "cpu"))).toBe(
      "cpu"
    );
  });

  it("retries only automatic AdaFace compute failures that can be served by the CPU distribution", () => {
    const automatic = makePersonMatchOptions("adaface-kprpe", "auto");
    const explicitRocm = makePersonMatchOptions("adaface-kprpe", "rocm");

    expect(
      PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(automatic, "primary", "pytorch-runtime-load-failed")
    ).toBe(true);
    expect(PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(automatic, "primary", "rocm-unavailable")).toBe(true);
    expect(PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(automatic, "primary", "device-probe-failed")).toBe(
      true
    );
    expect(
      PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(automatic, "primary", "runtime-dependency-missing")
    ).toBe(false);
    expect(
      PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(explicitRocm, "primary", "pytorch-runtime-load-failed")
    ).toBe(false);
    expect(PersonMatchWorkerPolicyForTest.shouldRetryAdaFaceOnCpu(automatic, "cpu", "rocm-unavailable")).toBe(false);
  });

  it("removes ROCm loader paths only from the CPU attempt", () => {
    expect(PersonMatchWorkerPolicyForTest.workerLibraryEnvironment("primary", O.none())).toStrictEqual({});
    expect(PersonMatchWorkerPolicyForTest.workerLibraryEnvironment("primary", O.some("/opt/rocm/lib"))).toStrictEqual({
      LD_LIBRARY_PATH: "/opt/rocm/lib",
    });
    expect(PersonMatchWorkerPolicyForTest.workerLibraryEnvironment("cpu", O.none())).toStrictEqual({
      LD_LIBRARY_PATH: undefined,
    });
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
