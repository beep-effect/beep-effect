import { tmpdir } from "node:os";
import { it } from "@beep/test-runner";
import { GlobError, layer as GlobLayer, Glob as GlobService } from "@beep/utils/Glob";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Match } from "effect";
import * as Crypto from "effect/Crypto";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GlobOptions, Pattern } from "@beep/utils/Glob";

const isGlobError = S.is(GlobError);

const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  [Str.replace(/\/+$/u, "")(base), ...segments.map((segment) => Str.replace(/^\/+|\/+$/gu, "")(segment))]
    .filter((segment) => segment.length > 0)
    .join("/");
const withFileSystem = <E>(use: (fs: FileSystem.FileSystem) => Effect.Effect<void, E>) =>
  FileSystem.FileSystem.pipe(Effect.flatMap(use), Effect.orDie);
const makeDirectory = (path: string) => withFileSystem((fs) => fs.makeDirectory(path, { recursive: true }));
const makeTempDirectory = Effect.fn("GlobTest.makeTempDirectory")(function* (prefix: string) {
  const crypto = yield* Crypto.Crypto;
  const suffix = yield* crypto.randomUUIDv4;
  const dir = joinPath(tmpdir(), `${prefix}${suffix}`);
  yield* makeDirectory(dir);
  return dir;
});
const writeText = (path: string, content: string) => withFileSystem((fs) => fs.writeFileString(path, content));
const chmodPath = (path: string, mode: number) => withFileSystem((fs) => fs.chmod(path, mode));
const removePath = (path: string) => withFileSystem((fs) => fs.remove(path, { recursive: true }));
const makeSymlink = (target: string, path: string) => withFileSystem((fs) => fs.symlink(target, path));

const acquireFixture = Effect.gen(function* () {
  const dir = yield* Effect.acquireRelease(makeTempDirectory("beep-utils-glob-"), removePath);

  yield* makeDirectory(joinPath(dir, "src", "errors"));
  yield* makeDirectory(joinPath(dir, "src", "nested"));
  yield* makeDirectory(joinPath(dir, "%2F"));
  yield* makeDirectory(joinPath(dir, "symbols#%"));
  yield* writeText(joinPath(dir, "src", "index.ts"), "");
  yield* writeText(joinPath(dir, "src", "errors", "problem.ts"), "");
  yield* writeText(joinPath(dir, "src", "nested", "deep.ts"), "");
  yield* writeText(joinPath(dir, "%2F", "literal.ts"), "");
  yield* writeText(joinPath(dir, "symbols#%", "literal.ts"), "");
  yield* writeText(joinPath(dir, "README.md"), "");

  return {
    dir,
  };
});

const runGlob = Effect.fn("GlobTest.runGlob")(function* (pattern: Pattern, options?: GlobOptions) {
  const glob = yield* GlobService;
  return yield* glob.glob(pattern, options);
});

type GlobProgram = ReturnType<typeof runGlob>;

const disableBunGlob = (bunRef: typeof Bun) => {
  const originalGlob = bunRef.Glob;
  Reflect.set(bunRef, "Glob", undefined);
  return originalGlob;
};

const restoreBunGlob = (bunRef: typeof Bun, originalGlob: typeof Bun.Glob) => {
  Reflect.set(bunRef, "Glob", originalGlob);
};

class BunGlobMutationError extends S.TaggedError<BunGlobMutationError>()("BunGlobMutationError", {
  action: S.String,
  cause: S.Defect({ includeStack: true }),
}) {}

const toGlobMutationError =
  (action: string) =>
  (cause: unknown): BunGlobMutationError =>
    BunGlobMutationError.make({
      action,
      cause: cause instanceof Error ? cause : new Error(`Failed to ${action} Bun.Glob`),
    });

const withBunGlobDisabled = (effect: GlobProgram) => {
  const bunRef = globalThis.Bun;

  return Match.value(bunRef === undefined).pipe(
    Match.when(true, () => effect),
    Match.orElse(() =>
      Effect.acquireUseRelease(
        Effect.try({
          try: () => disableBunGlob(bunRef),
          catch: toGlobMutationError("disable"),
        }),
        () => effect,
        (originalGlob) =>
          Effect.try({
            try: () => restoreBunGlob(bunRef, originalGlob),
            catch: toGlobMutationError("restore"),
          })
      )
    )
  );
};

// Every Glob consumer in this isolated file shares the process-wide Bun.Glob toggle.
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, GlobLayer), {
  concurrent: false,
  timeout: "5 seconds",
})("@beep/utils Glob", (it) => {
  it.effect("accepts encoded optional causes in GlobError helpers", () =>
    Effect.sync(() => {
      const error = GlobError.new("src/*.ts", undefined);
      const thunkError = GlobError.newThunk("src/*.ts", undefined)();

      assertNone(error.cause);
      assertNone(thunkError.cause);
    })
  );

  it.effect("supports array patterns, ignore filters, and deduped deterministic output", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        runGlob(["src/**/*.ts", "src/index.ts"], {
          cwd: fixture.dir,
          ignore: ["**/nested/**", "**/errors/**"],
        })
      );
      const results = yield* program;

      expect(results).toEqual(["src/index.ts"]);
    })
  );

  it.effect("does not traverse unrelated directories for a statically rooted pattern", () =>
    Effect.flatMap(acquireFixture, (fixture) =>
      Effect.gen(function* () {
        const unrelated = joinPath(fixture.dir, "unrelated");
        yield* makeDirectory(joinPath(unrelated, "nested"));
        const results = yield* Effect.acquireUseRelease(
          chmodPath(unrelated, 0),
          () => runGlob("src/**/*.ts", { cwd: fixture.dir }),
          () => chmodPath(unrelated, 0o700)
        );

        expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
      })
    )
  );

  it.effect("supports absolute paths and directory matches when nodir is false", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        runGlob("src/**", {
          absolute: true,
          cwd: fixture.dir,
        }).pipe(
          Effect.tap((results) =>
            Effect.sync(() => {
              expect(results).toContain(joinPath(fixture.dir, "src", "errors"));
              expect(results).toContain(joinPath(fixture.dir, "src", "index.ts"));
              expect(results).toContain(joinPath(fixture.dir, "src", "nested"));
              expect(results).toContain(joinPath(fixture.dir, "src", "nested", "deep.ts"));
            })
          )
        )
      );
      yield* program;
    })
  );

  it.effect("supports nodir by returning only files", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        runGlob("src/**", {
          cwd: fixture.dir,
          nodir: true,
        })
      );
      const results = yield* program;

      expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
    })
  );

  it.effect("resolves an omitted cwd the same as an explicit current directory", () =>
    Effect.gen(function* () {
      const implicitResults = yield* runGlob("package.json");
      const explicitResults = yield* runGlob("package.json", { cwd: "." });
      const implicitNodeResults = yield* withBunGlobDisabled(runGlob("package.json"));
      const explicitNodeResults = yield* withBunGlobDisabled(runGlob("package.json", { cwd: "." }));

      expect(implicitResults).toEqual(["package.json"]);
      expect(explicitResults).toEqual(implicitResults);
      expect(implicitNodeResults).toEqual(implicitResults);
      expect(explicitNodeResults).toEqual(implicitResults);
    })
  );

  it.effect("falls back to Node globbing when Bun.Glob is unavailable", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        withBunGlobDisabled(
          runGlob("src/**", {
            absolute: true,
            cwd: fixture.dir,
            ignore: ["**/errors/**"],
            nodir: true,
          })
        ).pipe(
          Effect.tap((results) =>
            Effect.sync(() => {
              expect(results).toEqual([
                joinPath(fixture.dir, "src", "index.ts"),
                joinPath(fixture.dir, "src", "nested", "deep.ts"),
              ]);
            })
          )
        )
      );
      yield* program;
    })
  );

  it.effect("treats percent-encoded and fragment characters as filesystem text across backends", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        Effect.gen(function* () {
          const options = {
            absolute: true,
            cwd: fixture.dir,
            nodir: true,
          };
          const pattern = ["%2F/*.ts", "symbols*/*.ts"];
          const bunResults = yield* runGlob(pattern, options);
          const nodeResults = yield* withBunGlobDisabled(runGlob(pattern, options));
          const expected = [
            joinPath(fixture.dir, "%2F", "literal.ts"),
            joinPath(fixture.dir, "symbols#%", "literal.ts"),
          ];

          expect(bunResults).toEqual(expected);
          expect(nodeResults).toEqual(expected);
        })
      );

      yield* program;
    })
  );

  it.effect.each(["src/errors", "src/errors/", "src/errors/**"])(
    "applies the %s directory ignore consistently across backends",
    (ignore) =>
      Effect.gen(function* () {
        const program = Effect.flatMap(acquireFixture, (fixture) =>
          Effect.forEach(
            [false, true],
            Effect.fnUntraced(function* (nodir) {
              const options = {
                cwd: fixture.dir,
                ignore,
                nodir,
              };
              const bunResults = yield* runGlob("src/**", options);
              const nodeResults = yield* withBunGlobDisabled(runGlob("src/**", options));
              const expected = nodir
                ? ["src/index.ts", "src/nested/deep.ts"]
                : ["src/index.ts", "src/nested", "src/nested/deep.ts"];

              expect(bunResults).toEqual(expected);
              expect(nodeResults).toEqual(expected);
            })
          )
        );

        yield* program;
      })
  );

  it.effect("surfaces non-missing Node filesystem errors as GlobError", () =>
    Effect.gen(function* () {
      const error = yield* withBunGlobDisabled(
        runGlob("**/*.ts", {
          cwd: "invalid\0cwd",
          nodir: true,
        })
      ).pipe(Effect.flip);

      expect(isGlobError(error)).toBe(true);
    })
  );

  it.effect("skips dangling symlinks in the Node fallback scanner", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        makeSymlink(joinPath(fixture.dir, "missing.ts"), joinPath(fixture.dir, "src", "dangling.ts")).pipe(
          Effect.flatMap(() =>
            withBunGlobDisabled(
              runGlob("src/**", {
                cwd: fixture.dir,
                nodir: true,
              })
            )
          )
        )
      );
      const results = yield* program;

      expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
    })
  );

  it.effect("does not recurse into symlinked directories", () =>
    Effect.gen(function* () {
      const program = Effect.flatMap(acquireFixture, (fixture) =>
        makeSymlink(fixture.dir, joinPath(fixture.dir, "src", "linked-root")).pipe(
          Effect.flatMap(
            Effect.fnUntraced(function* () {
              return yield* withBunGlobDisabled(
                runGlob("src/**", {
                  cwd: fixture.dir,
                  nodir: true,
                })
              );
            })
          )
        )
      );
      const results = yield* program;

      expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
    })
  );
});
