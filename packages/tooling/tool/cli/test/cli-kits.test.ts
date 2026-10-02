import {
  allocateUniqueName,
  asRecord,
  boundedText,
  bytesEqual,
  csvValues,
  errorMessage,
  firstLine,
  hashFileSha256,
  isUnknownRecord,
  normalizedTokens,
  preflightOverwritableFile,
  progressFraction,
  progressPercent,
  RunMode,
  RunModeIs,
  renameOrFail,
  renderProgressBar,
  resolveRunMode,
  runModeFlagsConflict,
  shouldRenderFailureCause,
  unknownRecordKeys,
  unknownRecordProperty,
  validateDirectory,
  validatePathSegment,
  variadicStrings,
} from "@beep/repo-cli/test/Cli";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Data, Effect, FileSystem, HashSet, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeRunModeEffect = S.decodeEffect(RunMode);

const toError = (cause: unknown) => new Error(String(cause));

class InvalidPathSegment extends Data.TaggedError("InvalidPathSegment")<{
  readonly message: string;
}> {}

class FsGuardTestError extends Data.TaggedError("FsGuardTestError")<{ readonly message: string }> {}

describe("internal/cli/FailureRendering", () => {
  it("stays quiet by default so causes do not leak transcript paths", () => {
    expect(shouldRenderFailureCause([])).toBe(false);
    expect(shouldRenderFailureCause(["ai-metrics", "forwarder", "run"])).toBe(false);
  });

  it("opts in on --verbose anywhere in argv", () => {
    expect(shouldRenderFailureCause(["--verbose"])).toBe(true);
    expect(shouldRenderFailureCause(["ai-metrics", "--verbose", "run"])).toBe(true);
  });

  it("opts in on a verbose --log-level in either spelling", () => {
    expect(shouldRenderFailureCause(["--log-level", "debug"])).toBe(true);
    expect(shouldRenderFailureCause(["--log-level", "trace"])).toBe(true);
    expect(shouldRenderFailureCause(["--log-level=debug"])).toBe(true);
    expect(shouldRenderFailureCause(["--log-level=trace"])).toBe(true);
  });

  it("stays quiet for non-verbose levels and malformed flags", () => {
    expect(shouldRenderFailureCause(["--log-level", "info"])).toBe(false);
    expect(shouldRenderFailureCause(["--log-level=warn"])).toBe(false);
    // Trailing `--log-level` with no value must not read past the end of argv.
    expect(shouldRenderFailureCause(["run", "--log-level"])).toBe(false);
    expect(shouldRenderFailureCause(["--log-levels=debug"])).toBe(false);
  });
});

describe("internal/cli/RunMode", () => {
  it.effect("decodes the shared run-mode literals", () =>
    Effect.gen(function* () {
      expect(yield* decodeRunModeEffect("dry-run")).toBe("dry-run");
      expect(RunModeIs.write("write")).toBe(true);
      expect(RunModeIs.write("check")).toBe(false);
    })
  );

  it("resolves version-sync semantics via a compound dry-run condition", () => {
    const resolve = (write: boolean, dryRun: boolean) =>
      resolveRunMode(
        [
          [write && dryRun, "dry-run"],
          [write, "write"],
        ],
        "check"
      );

    expect(resolve(false, false)).toBe("check");
    expect(resolve(true, false)).toBe("write");
    expect(resolve(false, true)).toBe("check");
    expect(resolve(true, true)).toBe("dry-run");
  });

  it("resolves check/dry-run precedence with a write fallback", () => {
    const resolve = (check: boolean, dryRun: boolean) =>
      resolveRunMode(
        [
          [check, "check"],
          [dryRun, "dry-run"],
        ],
        "write"
      );

    expect(resolve(true, false)).toBe("check");
    expect(resolve(false, true)).toBe("dry-run");
    expect(resolve(false, false)).toBe("write");
    expect(resolve(true, true)).toBe("check");
  });

  it("resolveRunMode works data-first and data-last", () => {
    const candidates = [
      [false, "dry-run"],
      [true, "write"],
    ] as const;
    expect(resolveRunMode(candidates, "check")).toBe("write");
    expect(resolveRunMode("check")(candidates)).toBe("write");
  });

  it("runModeFlagsConflict works data-first and data-last", () => {
    expect(runModeFlagsConflict(true, true)).toBe(true);
    expect(runModeFlagsConflict(true, false)).toBe(false);
    expect(runModeFlagsConflict(true)(true)).toBe(true);
    expect(runModeFlagsConflict(false)(true)).toBe(false);
  });
});

describe("internal/cli/UnknownProbe", () => {
  it("narrows non-array objects, rejecting arrays and primitives", () => {
    asRecord({ a: 1 }).pipe(O.isSome, assertTrue);
    asRecord([1, 2]).pipe(assertNone);
    asRecord("nope").pipe(assertNone);
    expect(isUnknownRecord({ a: 1 })).toBe(true);
    expect(isUnknownRecord([1, 2])).toBe(false);
    expect(isUnknownRecord(null)).toBe(false);
  });

  it("reads present properties data-first and data-last, rejecting arrays and missing keys", () => {
    assertSome(unknownRecordProperty({ name: "beep" }, "name"), "beep");
    assertSome(unknownRecordProperty("name")({ name: "beep" }), "beep");
    unknownRecordProperty({ name: "beep" }, "missing").pipe(assertNone);
    unknownRecordProperty([1, 2], "0").pipe(assertNone);
  });

  it("lists sorted keys and treats arrays and non-objects as empty", () => {
    expect(unknownRecordKeys({ b: 1, a: 2, c: 3 })).toStrictEqual(["a", "b", "c"]);
    expect(unknownRecordKeys([1, 2])).toStrictEqual([]);
    expect(unknownRecordKeys(42)).toStrictEqual([]);
  });
});

describe("internal/cli/Flags coercions", () => {
  it("splits comma lists, trimming and dropping empties", () => {
    expect(csvValues(" a , b , , c ")).toStrictEqual(["a", "b", "c"]);
    expect(csvValues("")).toStrictEqual([]);
  });

  it("normalizes tokens to trimmed lowercase", () => {
    expect(normalizedTokens(" Renovate , DEPENDABOT ")).toStrictEqual(["renovate", "dependabot"]);
  });

  it("keeps only string entries of a variadic argument array", () => {
    expect(variadicStrings(["a", 1, "b", null, "c"])).toStrictEqual(["a", "b", "c"]);
  });
});

describe("internal/cli/FsGuards", () => {
  it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("reports missing directory and rename paths through their typed error adapters", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const missing = path.join(root, "missing");
        const directoryErrors = {
          onStatError: (_cause: unknown, entry: string) => new FsGuardTestError({ message: `stat: ${entry}` }),
          onNotDirectory: (entry: string) => new FsGuardTestError({ message: `not directory: ${entry}` }),
          onRealPathError: (_cause: unknown, entry: string) => new FsGuardTestError({ message: `real path: ${entry}` }),
        };
        const directory = yield* validateDirectory(root, directoryErrors);
        expect(directory.canonicalDir).toBe(root);

        const directoryError = yield* validateDirectory(missing, directoryErrors).pipe(Effect.flip);
        expect(directoryError.message).toBe(`stat: ${missing}`);

        const renameError = yield* renameOrFail(missing, path.join(root, "renamed"), {
          onError: (_cause, source) => new FsGuardTestError({ message: `rename: ${source}` }),
        }).pipe(Effect.flip);
        expect(renameError.message).toBe(`rename: ${missing}`);
      })
    );
  });

  it("bytesEqual works data-first and data-last", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([2]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 2]))(new Uint8Array([1, 2]))).toBe(true);
    expect(bytesEqual(new Uint8Array([2]))(new Uint8Array([1]))).toBe(false);
  });

  it("allocateUniqueName works data-first and data-last", () => {
    const first = allocateUniqueName("photo", ".webp", HashSet.empty<string>());
    expect(first.targetName).toBe("photo.webp");
    expect(HashSet.has(first.usedTargetNames, "photo.webp")).toBe(true);

    const collided = allocateUniqueName("photo", ".webp", HashSet.make("photo.webp", "photo_01.webp"));
    expect(collided.targetName).toBe("photo_02.webp");

    const dataLast = allocateUniqueName(".webp", HashSet.make("photo.webp"))("photo");
    expect(dataLast.targetName).toBe("photo_01.webp");

    const caseCollided = allocateUniqueName("PHOTO", ".WEBP", HashSet.make("photo.webp", "Photo_01.webp"));
    expect(caseCollided.targetName).toBe("PHOTO_02.WEBP");
  });

  it.effect("validatePathSegment works data-first and data-last", () =>
    Effect.gen(function* () {
      const options = {
        onInvalid: (label: string, value: string) => new InvalidPathSegment({ message: `${label}: ${value}` }),
      };
      expect(yield* validatePathSegment("source", "ok", options)).toBeUndefined();
      expect(yield* validatePathSegment("ok", options)("source")).toBeUndefined();
      expect(yield* validatePathSegment("source", "..", options).pipe(Effect.flip)).toEqual(
        new InvalidPathSegment({ message: "source: .." })
      );
      expect(yield* validatePathSegment("..", options)("source").pipe(Effect.flip)).toEqual(
        new InvalidPathSegment({ message: "source: .." })
      );
    })
  );

  it("exposes both arities of the filesystem-dependent guards without running them", () => {
    const dirErrors = {
      onStatError: toError,
      onNotDirectory: (dir: string) => new Error(dir),
      onRealPathError: toError,
    };
    expect(Effect.isEffect(validateDirectory("/x", dirErrors))).toBe(true);
    expect(typeof validateDirectory(dirErrors)).toBe("function");
    expect(Effect.isEffect(validateDirectory(dirErrors)("/x"))).toBe(true);

    expect(Effect.isEffect(hashFileSha256("/x", toError))).toBe(true);
    expect(Effect.isEffect(hashFileSha256(toError)("/x"))).toBe(true);

    const preflightOptions = {
      overwrite: false,
      description: "manifest",
      onInspectError: toError,
      onRefuseOverwrite: (path: string) => new Error(path),
      onStatError: toError,
      onRefuseNonFile: (path: string) => new Error(path),
    };
    expect(Effect.isEffect(preflightOverwritableFile("/x", preflightOptions))).toBe(true);
    expect(Effect.isEffect(preflightOverwritableFile(preflightOptions)("/x"))).toBe(true);

    const renameOptions = { onError: toError };
    expect(Effect.isEffect(renameOrFail("/a", "/b", renameOptions))).toBe(true);
    expect(Effect.isEffect(renameOrFail("/b", renameOptions)("/a"))).toBe(true);
  });
});

describe("internal/cli/Timing text helpers", () => {
  it("bounds text with an ellipsis only past the limit, data-first and data-last", () => {
    expect(boundedText("abcdef", 6)).toBe("abcdef");
    expect(boundedText("abcdefghij", 6)).toBe("abc...");
    expect(boundedText(6)("abcdefghij")).toBe("abc...");
  });

  it("takes the trimmed first line of multi-line text", () => {
    expect(firstLine("  first line \nsecond")).toBe("first line");
    expect(firstLine("solo")).toBe("solo");
  });

  it("extracts an error message with a caller fallback, data-first and data-last", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(errorMessage(42, "fallback")).toBe("fallback");
    expect(errorMessage({ message: 7 }, "fallback")).toBe("fallback");
    expect(errorMessage("fallback")(new Error("boom"))).toBe("boom");
    expect(errorMessage("fallback")(42)).toBe("fallback");
  });
});

describe("internal/cli/Progress math", () => {
  it("computes count-based fill fraction data-first and data-last, treating a zero total as complete", () => {
    expect(progressFraction(1, 4)).toBe(0.25);
    expect(progressFraction(0, 0)).toBe(1);
    expect(progressFraction(9, 4)).toBe(1);
    expect(progressFraction(4)(1)).toBe(0.25);
  });

  it("formats a one-decimal percent data-first and data-last, treating a zero total as complete", () => {
    expect(progressPercent(1, 4)).toBe("25.0");
    expect(progressPercent(3, 0)).toBe("100.0");
    expect(progressPercent(4)(1)).toBe("25.0");
  });

  it("renders a fill/empty segment core clamped to the width", () => {
    expect(renderProgressBar({ fraction: 0.5, width: 4 })).toBe("##--");
    expect(renderProgressBar({ fraction: 1, width: 3 })).toBe("###");
    expect(renderProgressBar({ fraction: 0, width: 3, filledChar: "=", emptyChar: " " })).toBe("   ");
  });
});
