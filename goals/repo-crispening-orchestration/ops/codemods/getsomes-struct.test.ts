import { TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { runGetSomesStructCodemod } from "./getsomes-struct.codemod.ts";

const TestLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));

const FIXTURE_DIR = "__fixtures__/getsomes-struct";

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

const NEGATIVE_ONLY = `import * as R from "effect/Record";
import * as O from "effect/Option";

export const compactDict = (dict: Readonly<Record<string, O.Option<number>>>): Record<string, number> =>
  R.getSomes(dict);
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
    const dir = path.join(__dirname, `.tmp-getsomes-${label}-${process.pid}-${Date.now()}`);
    const subjectPath = path.join(dir, "subject.ts");
    yield* fs.makeDirectory(dir, { recursive: true });
    yield* fs.writeFileString(path.join(dir, "tsconfig.json"), TEMP_TSCONFIG);
    yield* fs.writeFileString(subjectPath, source);
    return yield* Effect.ensuring(
      body(subjectPath),
      fs.remove(dir, { recursive: true }).pipe(Effect.orElseSucceed(() => undefined))
    );
  });

layer(TestLayer, { timeout: 300_000 })("getsomes-struct codemod", (it) => {
  describe("golden diff", () => {
    it.effect(
      "rewrites the heterogeneous struct site to O.getSomesStruct and retargets the Option import",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const before = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "before.ts.txt"));
        const after = yield* fs.readFileString(path.join(__dirname, FIXTURE_DIR, "after.ts.txt"));

        yield* withSubject("golden", before, (subjectPath) =>
          Effect.gen(function* () {
            const results = yield* runGetSomesStructCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: true }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(after);
          })
        );
      })
    );
  });

  describe("negative case", () => {
    it.effect(
      "leaves R.getSomes applied to a homogeneous dictionary untouched (no write)",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;

        yield* withSubject("negative", NEGATIVE_ONLY, (subjectPath) =>
          Effect.gen(function* () {
            const results = yield* runGetSomesStructCodemod([subjectPath]);
            expect(results).toEqual([{ filePath: subjectPath, changed: false }]);
            const actual = yield* fs.readFileString(subjectPath);
            expect(actual).toBe(NEGATIVE_ONLY);
          })
        );
      })
    );
  });
});
