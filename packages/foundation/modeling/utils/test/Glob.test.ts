import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { GlobError, layer as GlobLayer, Glob as GlobService } from "@beep/utils/Glob";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Match } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { describe, expect, it } from "vitest";
import type { GlobOptions, Pattern } from "@beep/utils/Glob";

type TestEffect<A, E = never> = Effect.Effect<A, E, never>;

const runTest = <A, E>(effect: TestEffect<A, E>): Promise<A> => Effect.runPromise(effect);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

type Fixture = {
  readonly dir: string;
  readonly cleanup: TestEffect<void>;
};

const platformLayer = GlobLayer;
const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  [Str.replace(/\/+$/u, "")(base), ...segments.map((segment) => Str.replace(/^\/+|\/+$/gu, "")(segment))]
    .filter((segment) => segment.length > 0)
    .join("/");
const withFileSystem = <E>(use: (fs: FileSystem.FileSystem) => Effect.Effect<void, E>): TestEffect<void> =>
  provideScopedLayer(NodeServices.layer)(FileSystem.FileSystem.pipe(Effect.flatMap(use), Effect.orDie));
const makeDirectory = (path: string) => withFileSystem((fs) => fs.makeDirectory(path, { recursive: true }));
const makeTempDirectory: (prefix: string) => TestEffect<string> = Effect.fn("GlobTest.makeTempDirectory")(function* (
  prefix: string
) {
  const suffix = randomUUID();
  const dir = joinPath(tmpdir(), `${prefix}${suffix}`);
  yield* makeDirectory(dir);
  return dir;
});
const writeText = (path: string, content: string): TestEffect<void> =>
  withFileSystem((fs) => fs.writeFileString(path, content));
const removePath = (path: string) => withFileSystem((fs) => fs.remove(path, { recursive: true }));
const makeSymlink = (target: string, path: string) => withFileSystem((fs) => fs.symlink(target, path));

const acquireFixture: TestEffect<Fixture> = Effect.gen(function* () {
  const dir = yield* makeTempDirectory("beep-utils-glob-");

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
    cleanup: removePath(dir),
  };
});

const runGlob: (pattern: Pattern, options?: undefined | GlobOptions) => TestEffect<Array<string>, GlobError> =
  Effect.fn("GlobTest.runGlob")((pattern: Pattern, options?: undefined | GlobOptions) =>
    provideScopedLayer(platformLayer)(
      Effect.gen(function* () {
        const glob = yield* GlobService;
        return yield* glob.glob(pattern, options);
      })
    )
  );

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

describe("@beep/utils Glob", () => {
  it("accepts encoded optional causes in GlobError helpers", () => {
    const error = GlobError.new("src/*.ts", undefined);
    const thunkError = GlobError.newThunk("src/*.ts", undefined)();

    expect(O.isNone(error.cause)).toBe(true);
    expect(O.isNone(thunkError.cause)).toBe(true);
  });

  it("supports array patterns, ignore filters, and deduped deterministic output", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
            runGlob(["src/**/*.ts", "src/index.ts"], {
              cwd: fixture.dir,
              ignore: ["**/nested/**", "**/errors/**"],
            }),
          (fixture) => fixture.cleanup
        );
        const results = yield* program;

        expect(results).toEqual(["src/index.ts"]);
      })
    ));

  it("supports absolute paths and directory matches when nodir is false", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
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
            ),
          (fixture) => fixture.cleanup
        );
        yield* program;
      })
    ));

  it("supports nodir by returning only files", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
            runGlob("src/**", {
              cwd: fixture.dir,
              nodir: true,
            }),
          (fixture) => fixture.cleanup
        );
        const results = yield* program;

        expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
      })
    ));

  it("resolves an omitted cwd the same as an explicit current directory", () =>
    runTest(
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
    ));

  it("falls back to Node globbing when Bun.Glob is unavailable", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
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
            ),
          (fixture) => fixture.cleanup
        );
        yield* program;
      })
    ));

  it("treats percent-encoded and fragment characters as filesystem text across backends", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
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
            }),
          (fixture) => fixture.cleanup
        );

        yield* program;
      })
    ));

  it.each(["src/errors", "src/errors/", "src/errors/**"])(
    "applies the %s directory ignore consistently across backends",
    (ignore) =>
      runTest(
        Effect.gen(function* () {
          const program = Effect.acquireUseRelease(
            acquireFixture,
            (fixture) =>
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
              ),
            (fixture) => fixture.cleanup
          );

          yield* program;
        })
      )
  );

  it("surfaces non-missing Node filesystem errors as GlobError", () =>
    runTest(
      Effect.gen(function* () {
        const error = yield* withBunGlobDisabled(
          runGlob("**/*.ts", {
            cwd: "invalid\0cwd",
            nodir: true,
          })
        ).pipe(Effect.flip);

        expect(S.is(GlobError)(error)).toBe(true);
      })
    ));

  it("skips dangling symlinks in the Node fallback scanner", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
            makeSymlink(joinPath(fixture.dir, "missing.ts"), joinPath(fixture.dir, "src", "dangling.ts")).pipe(
              Effect.flatMap(() =>
                withBunGlobDisabled(
                  runGlob("src/**", {
                    cwd: fixture.dir,
                    nodir: true,
                  })
                )
              )
            ),
          (fixture) => fixture.cleanup
        );
        const results = yield* program;

        expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
      })
    ));

  it("does not recurse into symlinked directories", () =>
    runTest(
      Effect.gen(function* () {
        const program = Effect.acquireUseRelease(
          acquireFixture,
          (fixture) =>
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
            ),
          (fixture) => fixture.cleanup
        );
        const results = yield* program;

        expect(results).toEqual(["src/errors/problem.ts", "src/index.ts", "src/nested/deep.ts"]);
      })
    ));
});
