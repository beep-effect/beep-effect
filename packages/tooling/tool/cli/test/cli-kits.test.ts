import {
  allocateUniqueName,
  asRecord,
  boundedText,
  bytesEqual,
  csvValues,
  errorMessage,
  firstLine,
  hashFileChunkBytes,
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
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Data, Effect, FileSystem, HashSet, Layer, MutableList, Path, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeRunModeEffect = S.decodeEffect(RunMode);

const toError = (cause: unknown) => new Error(String(cause));

class InvalidPathSegment extends Data.TaggedError("InvalidPathSegment")<{
  readonly message: string;
}> {}

class FsGuardTestError extends Data.TaggedError("FsGuardTestError")<{ readonly message: string }> {}

const hashTestError = (_cause: unknown, filePath: string) => new FsGuardTestError({ message: `hash: ${filePath}` });

// The digest the previous whole-file implementation produced.
const decodeSha256FromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

// FIPS 180-4 / NIST CAVP SHA-256 example vectors.
const sha256Vectors = [
  { digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", text: "" },
  { digest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", text: "abc" },
  {
    digest: "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    text: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
  },
  { digest: "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0", text: Str.repeat(1_000_000)("a") },
];

const patternedBytes = (size: number, seed: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    bytes[index] = (index * 31 + seed * 17 + (index >>> 8)) & 0xff;
  }
  return bytes;
};

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

  it.layer(NodeServices.layer, { timeout: "120 seconds" })("hashFileSha256", (it) => {
    it.effect(
      "produces the published SHA-256 test vectors",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "fs-guards-hash-vectors-" });
        const digests = yield* Effect.forEach(sha256Vectors, ({ text }, index) => {
          const filePath = path.join(root, `vector-${index}.bin`);
          return fs.writeFileString(filePath, text).pipe(Effect.andThen(hashFileSha256(filePath, hashTestError)));
        });

        expect(digests).toEqual(A.map(sha256Vectors, ({ digest }) => digest));
      })
    );

    it.effect(
      "matches the whole-buffer schema digest across chunk boundaries",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "fs-guards-hash-parity-" });
        const sizes = [
          0,
          1,
          55,
          56,
          64,
          hashFileChunkBytes - 1,
          hashFileChunkBytes,
          hashFileChunkBytes + 1,
          3 * hashFileChunkBytes + 17,
        ];
        const pairs = yield* Effect.forEach(
          sizes,
          Effect.fnUntraced(function* (size) {
            const bytes = patternedBytes(size, size);
            const filePath = path.join(root, `parity-${size}.bin`);
            yield* fs.writeFile(filePath, bytes);
            return {
              streamed: yield* hashFileSha256(filePath, hashTestError),
              wholeBuffer: yield* decodeSha256FromBytes(bytes),
            };
          })
        );

        expect(A.map(pairs, ({ streamed }) => streamed)).toEqual(A.map(pairs, ({ wholeBuffer }) => wholeBuffer));
      })
    );

    it.effect(
      "hashes a file far larger than one chunk without reading it whole",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const crypto = yield* Crypto.Crypto;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "fs-guards-hash-large-" });
        const filePath = path.join(root, "large.bin");
        const chunkCount = 64;
        const totalBytes = chunkCount * hashFileChunkBytes;

        // Independent oracle: the platform digest over the same bytes, built
        // here once so the code under test never sees a whole-file buffer.
        const whole = new Uint8Array(totalBytes);
        yield* Effect.forEach(
          A.range(0, chunkCount - 1),
          (index) => {
            const chunk = patternedBytes(hashFileChunkBytes, index);
            whole.set(chunk, index * hashFileChunkBytes);
            return fs.writeFile(filePath, chunk, { flag: "a" });
          },
          { discard: true }
        );
        const expected = Hex.encode(yield* crypto.digest("SHA-256", whole));

        const chunkSizes = MutableList.make<number>();
        const requestedChunkSizes = MutableList.make<number | undefined>();
        const wholeFileReads = yield* Ref.make(0);
        const observedFs: FileSystem.FileSystem = {
          ...fs,
          readFile: (target) =>
            Ref.update(wholeFileReads, (count) => count + 1).pipe(Effect.andThen(fs.readFile(target))),
          stream: (target, options) => {
            MutableList.append(requestedChunkSizes, Number(options?.chunkSize));
            return fs
              .stream(target, options)
              .pipe(Stream.tap((chunk) => Effect.sync(() => MutableList.append(chunkSizes, chunk.byteLength))));
          },
        };

        const digest = yield* hashFileSha256(filePath, hashTestError).pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs)
        );
        const observedSizes = MutableList.toArray(chunkSizes);

        expect(digest).toBe(expected);
        expect(yield* Ref.get(wholeFileReads)).toBe(0);
        expect(MutableList.toArray(requestedChunkSizes)).toEqual([hashFileChunkBytes]);
        expect(A.length(observedSizes)).toBeGreaterThanOrEqual(chunkCount);
        expect(Math.max(...observedSizes)).toBeLessThanOrEqual(hashFileChunkBytes);
        expect(A.reduce(observedSizes, 0, (total, size) => total + size)).toBe(totalBytes);
      })
    );

    it.effect(
      "maps a missing file through the caller's error adapter",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "fs-guards-hash-missing-" });
        const missing = path.join(root, "missing.bin");

        const error = yield* hashFileSha256(missing, hashTestError).pipe(Effect.flip);

        expect(error).toEqual(new FsGuardTestError({ message: `hash: ${missing}` }));
      })
    );
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
