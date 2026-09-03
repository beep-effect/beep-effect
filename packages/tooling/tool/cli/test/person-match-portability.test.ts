import {
  defaultPersonMatchBackendForPlatform,
  MatchPersonOptions,
  PersonMatchModelArtifactVerifier,
  PersonMatchWorkerPolicyForTest,
  trustedUvExecutableNameForPlatform,
  trustedUvRootDirectoriesForPlatform,
  validatePersonMatchBackendPlatform,
} from "@beep/repo-cli/test/Files";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as TestConsole from "effect/testing/TestConsole";
import type { PersonMatchWorkerErrorCode } from "@beep/repo-cli/test/Files";

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

const workerFailureJson = (code: PersonMatchWorkerErrorCode): string =>
  `{"schemaVersion":"beep.files.match-person.worker.v3","ok":false,"limits":{"referenceImages":256,"candidateImages":10000,"facesPerImage":32,"reportedFaces":65536,"reportBytes":67108864,"diagnosticBytes":1048576},"error":{"code":"${code}","message":"simulated worker failure"},"elapsedSeconds":0}`;

const modelFailureCases = [
  { code: "model-acquisition-incomplete", tag: "MatchPersonModelAcquisitionError" },
  { code: "model-acquisition-failed", tag: "MatchPersonModelAcquisitionError" },
  { code: "model-integrity-failed", tag: "MatchPersonModelIntegrityError" },
  { code: "model-module-missing", tag: "MatchPersonModelIntegrityError" },
  { code: "model-state-mismatch", tag: "MatchPersonModelIntegrityError" },
  { code: "unexpected-model-artifact", tag: "MatchPersonModelIntegrityError" },
] satisfies ReadonlyArray<{
  readonly code: PersonMatchWorkerErrorCode;
  readonly tag: "MatchPersonModelAcquisitionError" | "MatchPersonModelIntegrityError";
}>;

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

  it.effect("keeps physical model verification fail-closed by default", () =>
    Effect.gen(function* () {
      const verifier = yield* PersonMatchModelArtifactVerifier;

      expect(typeof verifier).toBe("function");
    })
  );

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

  it.effect("rejects a retry-authorizing worker failure on a successful process exit", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        PersonMatchWorkerPolicyForTest.decodeWorkerExecution(
          workerFailureJson("pytorch-runtime-load-failed"),
          "",
          0,
          false
        )
      );

      expect(error._tag).toBe("MatchPersonProtocolError");
    })
  );

  it.effect("accepts only the worker-defined failure exit for a retry-authorizing report", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        PersonMatchWorkerPolicyForTest.decodeWorkerExecution(
          workerFailureJson("pytorch-runtime-load-failed"),
          "",
          2,
          false
        )
      );

      expect(error).toMatchObject({
        _tag: "MatchPersonRuntimeError",
        workerCode: "pytorch-runtime-load-failed",
      });
    })
  );

  it.effect("maps model worker failures into the matching typed acquisition or integrity channel", () =>
    Effect.forEach(
      modelFailureCases,
      ({ code, tag }) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            PersonMatchWorkerPolicyForTest.decodeWorkerExecution(workerFailureJson(code), "", 2, false)
          );

          expect(error._tag).toBe(tag);
        }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect("rejects bounded-output truncation and malformed worker JSON with diagnostics", () =>
    Effect.gen(function* () {
      const truncated = yield* Effect.flip(PersonMatchWorkerPolicyForTest.decodeWorkerExecution("", "", 2, true));
      const malformed = yield* Effect.flip(
        PersonMatchWorkerPolicyForTest.decodeWorkerExecution("not-json", "python traceback", 2, false)
      );

      expect(truncated).toMatchObject({
        _tag: "MatchPersonProtocolError",
        message: expect.stringContaining("JSON or diagnostics exceeded its safety bound"),
      });
      expect(malformed).toMatchObject({
        _tag: "MatchPersonProtocolError",
        message: expect.stringContaining("python traceback"),
      });
    })
  );

  it.effect("preserves a worker-failed diagnostic from either defined failure exit", () =>
    Effect.forEach([1, 2], (exitCode) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          PersonMatchWorkerPolicyForTest.decodeWorkerExecution(workerFailureJson("worker-failed"), "", exitCode, false)
        );

        expect(error).toMatchObject({
          _tag: "MatchPersonProtocolError",
          message: "Person-match worker failed [worker-failed]: simulated worker failure",
        });
      })
    )
  );

  it.effect("writes automatic setup fallback evidence only to stderr", () =>
    Effect.gen(function* () {
      yield* PersonMatchWorkerPolicyForTest.writeAdaFaceSetupFallbackDiagnostic("simulated setup failure");

      expect(A.map(yield* TestConsole.logLines, String)).toEqual([]);
      expect(A.map(yield* TestConsole.errorLines, String)).toEqual([
        "Person-match primary environment setup failed; retrying the pinned CPU environment: simulated setup failure",
      ]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

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
