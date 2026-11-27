import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import * as Bundle from "alchemy/Bundle";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const IDENTITY_SOURCE_PREFIX = "foundation/modeling/identity/src/";
const IDENTITY_CORE_SOURCE = "Id.ts";
const ALLOWED_IDENTITY_SOURCES = [
  { source: "Authority.ts", reason: "Import-free IdentityAuthority IRI root; loads neither registry." },
  { source: "Id.ts", reason: "Identity core supplying handler composers; loads neither registry." },
  { source: "Root.ts", reason: "Registry-free root $I composer; loads neither registry." },
  {
    source: "internal/Segment.ts",
    reason:
      "Segment grammar schemas import only Effect and erased @beep/types; no types source reaches maps and neither registry loads.",
  },
  { source: "internal/schemaStatics.ts", reason: "Schema statics attached by the core; loads neither registry." },
];

const identitySources = (sources: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(
    A.dedupe(
      A.filterMap(sources, (source) =>
        O.match(Str.lastIndexOf(IDENTITY_SOURCE_PREFIX)(source), {
          onNone: () => Result.failVoid,
          onSome: (at) => Result.succeed(Str.slice(at + IDENTITY_SOURCE_PREFIX.length)(source)),
        })
      )
    ),
    Str.Order
  );

const LIBRARY_ENTRIES = [
  "job-retry.ts",
  "runner-binaries-syncer.ts",
  "scale-down.ts",
  "scale-up.ts",
  "ssm-housekeeper.ts",
  "termination-watcher.ts",
  "webhook.ts",
];
const STACK_ENTRIES = ["reaper.ts"];
const NOT_AN_ENTRY = "Runtime.ts";

const oneNativeMemoryBundleAtATime = 1;

const SourceMap = S.fromJsonString(S.Struct({ sources: S.Array(S.String) }));
const decodeSourceMap = S.decodeUnknownEffect(SourceMap);

const handlerFiles = Effect.fn("handlerFiles")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(directory);
  return A.sort(
    A.filter(entries, (entry) => Str.endsWith(".ts")(entry) && entry !== NOT_AN_ENTRY),
    Str.Order
  );
});

const bundleLikeAlchemyFunctionBundle = Effect.fn("bundleLikeAlchemyFunctionBundle")(function* (main: string) {
  const input = yield* Bundle.resolveMainPath(main);
  const cwd = yield* Bundle.findCwdForBundle(input);
  const output = yield* Bundle.build(
    {
      input,
      cwd,
      platform: "node",
      external: Str.startsWith("@aws-sdk/"),
      resolve: { conditionNames: A.fromIterable(Bundle.NODE_CONDITION_NAMES) },
      transform: { define: { "globalThis.__ALCHEMY_HOST_IDENTITY__": '"AWS.IAM.Role"' } },
    },
    {
      format: "esm",
      sourcemap: true,
      minify: true,
      keepNames: true,
      entryFileNames: "index.js",
      codeSplitting: false,
    }
  );
  const map = yield* Effect.fromOption(A.findFirst(output.files, (file) => Str.endsWith(".map")(file.path)));
  const { sources } = yield* decodeSourceMap(
    P.isString(map.content) ? map.content : new TextDecoder().decode(map.content)
  );
  return sources;
});

const LAMBDA_DIR_DECLARATION = "const lambdaDir = `${import.meta.dirname}/internal/lambda`;";
const LAMBDA_DIR_MAIN_PREFIX = "main: `${lambdaDir}/";
const DIRNAME_MAIN_PREFIX = "main: `${import.meta.dirname}/internal/lambda/";

const lambdaDeclarations = Effect.fn("lambdaDeclarations")(function* (sourceDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(sourceDirectory, { recursive: true });
  const files = A.sort(A.filter(entries, Str.endsWith(".ts")), Str.Order);
  return yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(fs.readFileString(path.join(sourceDirectory, file)), (content) => {
        const lines = A.map(Str.split(content, "\n"), Str.trim);
        return {
          file,
          declaresLambdaDir: A.contains(lines, LAMBDA_DIR_DECLARATION),
          functions: A.length(A.filter(lines, Str.includes("Lambda.Function("))),
          mains: A.filter(lines, Str.startsWith("main: ")),
        };
      }),
    { concurrency: 1 }
  );
});

it.layer(BunServices.layer, { timeout: "240 seconds" })((it) => {
  describe("CiRunners Lambda handler bundles", () => {
    it.effect("declare every Lambda main inside the directories the bundle test lists", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const library = yield* lambdaDeclarations(
          path.resolve(import.meta.dirname, "../../../library/alchemy-github-runners/src")
        );
        const stack = yield* lambdaDeclarations(path.resolve(import.meta.dirname, "../src"));
        const declarations = A.filter(
          A.appendAll(library, stack),
          (row) => row.functions > 0 || A.isReadonlyArrayNonEmpty(row.mains)
        );

        expect(
          A.map(declarations, (row) => ({
            file: row.file,
            oneMainPerFunction: A.length(row.mains) === row.functions,
            unguardedMains: A.filter(row.mains, (main) =>
              Str.startsWith(LAMBDA_DIR_MAIN_PREFIX)(main)
                ? !row.declaresLambdaDir
                : !Str.startsWith(DIRNAME_MAIN_PREFIX)(main)
            ),
          }))
        ).toStrictEqual([
          { file: "RunnerFleet.ts", oneMainPerFunction: true, unguardedMains: [] },
          { file: "Reaper.ts", oneMainPerFunction: true, unguardedMains: [] },
        ]);
      })
    );

    it.effect(
      "embed only exact registry-free identity paths so unrelated package or term registrations cannot change Lambda code hashes",
      () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const libraryDirectory = path.resolve(
            import.meta.dirname,
            "../../../library/alchemy-github-runners/src/internal/lambda"
          );
          const stackDirectory = path.resolve(import.meta.dirname, "../src/internal/lambda");

          const libraryFiles = yield* handlerFiles(libraryDirectory);
          const stackFiles = yield* handlerFiles(stackDirectory);
          expect(
            { library: libraryFiles, stack: stackFiles },
            "every handler file except the shared Runtime.ts is a listed entry, so a new handler is bundled and guarded too"
          ).toStrictEqual({
            library: LIBRARY_ENTRIES,
            stack: STACK_ENTRIES,
          });

          const mains = A.appendAll(
            A.map(LIBRARY_ENTRIES, (entry) => path.join(libraryDirectory, entry)),
            A.map(STACK_ENTRIES, (entry) => path.join(stackDirectory, entry))
          );
          const report = yield* Effect.forEach(
            mains,
            (main) =>
              Effect.map(bundleLikeAlchemyFunctionBundle(main), (sources) => {
                const identity = identitySources(sources);
                return {
                  entry: path.basename(main),
                  loadsIdentityCore: A.contains(identity, IDENTITY_CORE_SOURCE),
                  outsideAllowed: A.filter(
                    identity,
                    (source) => !A.some(ALLOWED_IDENTITY_SOURCES, (allowed) => allowed.source === source)
                  ),
                };
              }),
            { concurrency: oneNativeMemoryBundleAtATime }
          );

          expect(
            report,
            "Alchemy hashes each zip with its source map, which embeds every loaded module; a registry there redeploys every function"
          ).toStrictEqual(
            A.map(mains, (main) => ({ entry: path.basename(main), loadsIdentityCore: true, outsideAllowed: [] }))
          );
        })
    );
  });
});
