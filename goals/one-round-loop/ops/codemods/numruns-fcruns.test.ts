import { TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { runNumRunsFcRunsCodemod } from "./numruns-fcruns.codemod.ts";

const TestLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));

const FIXTURE_DIR = "__fixtures__/numruns-fcruns";

// A minimal, self-contained tsconfig so ts-morph loads only the subject file
// (the codemod resolves the nearest tsconfig walking up from the subject).
const TEMP_TSCONFIG = JSON.stringify(
  {
    $schema: "https://json.schemastore.org/tsconfig",
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      lib: ["ES2022"],
    },
    include: ["subject.ts"],
  },
  null,
  2
);

// No FastCheck import off effect/testing → the codemod must not touch the file.
const NEGATIVE_ONLY = `import { expect, it } from "vitest";

const options = { numRuns: 40 };

it("keeps unrelated numRuns objects untouched", () => {
  expect(options.numRuns).toBe(40);
});
`;

/** Materialize an in-repo temp dir (subject.ts + tsconfig.json), run body, always clean up. */
const withSubject = <A>(
  label: string,
  source: string,
  body: (subjectPath: string) => Effect.Effect<A, unknown, FileSystem.FileSystem | Path.Path>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = path.join(__dirname, `.tmp-numruns-${label}-${process.pid}-${Date.now()}`);
    const subjectPath = path.join(dir, "subject.ts");
    yield* fs.makeDirectory(dir, { recursive: true });
    yield* fs.writeFileString(path.join(dir, "tsconfig.json"), TEMP_TSCONFIG);
    yield* fs.writeFileString(subjectPath, source);
    return yield* Effect.ensuring(
      body(subjectPath),
      fs.remove(dir, { recursive: true }).pipe(Effect.orElseSucceed(() => undefined))
    );
  });

layer(TestLayer, { timeout: 300_000 })("numruns-fcruns codemod", (it) => {
  describe("golden diff", () => {
    it.effect(
      "rewrites literal fc.assert numRuns options to fcRuns and imports the helper",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const before = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "before.ts.txt"));
        const after = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "after.ts.txt"));

        yield* withSubject("golden", before, (subjectPath) =>
          Effect.gen(function* () {
            const results = yield* runNumRunsFcRunsCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: true }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(after);
          })
        );
      })
    );

    it.effect(
      "is idempotent (a second run reports no change)",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const after = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "after.ts.txt"));

        yield* withSubject("idempotent", after, (subjectPath) =>
          Effect.gen(function* () {
            const results = yield* runNumRunsFcRunsCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: false }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(after);
          })
        );
      })
    );
  });

  describe("negative case", () => {
    it.effect(
      "leaves files without a FastCheck import untouched (no write)",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;

        yield* withSubject("negative", NEGATIVE_ONLY, (subjectPath) =>
          Effect.gen(function* () {
            const results = yield* runNumRunsFcRunsCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: false }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(NEGATIVE_ONLY);
          })
        );
      })
    );
  });

  describe("closure carve-out", () => {
    // The subject is the SAME fixture the golden test rewrites; placing it under
    // a `@beep/test-utils` closure path (/drivers/pglite/) must make the codemod
    // skip it — proving `changed: false` is the guard, not an empty diff.
    it.effect(
      "skips files inside @beep/test-utils' dependency closure (would-be cyclic import)",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const before = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "before.ts.txt"));

        const dir = path.join(__dirname, `.tmp-numruns-closure-${process.pid}-${Date.now()}`);
        const nested = path.join(dir, "drivers", "pglite");
        const subjectPath = path.join(nested, "subject.ts");
        yield* fs.makeDirectory(nested, { recursive: true });
        yield* fs.writeFileString(path.join(nested, "tsconfig.json"), TEMP_TSCONFIG);
        yield* fs.writeFileString(subjectPath, before);

        yield* Effect.ensuring(
          Effect.gen(function* () {
            const results = yield* runNumRunsFcRunsCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: false }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(before);
          }),
          fs.remove(dir, { recursive: true }).pipe(Effect.orElseSucceed(() => undefined))
        );
      })
    );
  });
});
