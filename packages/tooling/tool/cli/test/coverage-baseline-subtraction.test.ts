import {
  coverageRegressionBaselinePath,
  subtractPackageFromCoverageRegressionBaseline,
} from "@beep/repo-cli/test/Quality";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, FileSystem, Layer, Path } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

const BaselineProjection = S.Struct({
  generated_at: S.String,
  git_sha: S.String,
  exemptions: S.Record(S.String, S.String),
  follow_ups: S.Record(S.String, S.String),
  packages: S.Record(S.String, S.Struct({ path: S.String })),
});

const provideNode = <A2, E, R2>(effect: Effect.Effect<A2, E, R2>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const withTempDirectory = <A2, E, R2>(use: (directory: string) => Effect.Effect<A2, E, R2>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (directory) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(directory, { recursive: true, force: true });
      })
  );

const zeroUncovered = { branches: 0, functions: 0, lines: 0, statements: 0 };

const packageRow = (packagePath: string) => ({
  path: packagePath,
  lines: 100,
  statements: 100,
  branches: 100,
  functions: 100,
  uncovered: zeroUncovered,
  files: {
    [`${packagePath}/src/index.ts`]: {
      lines: 100,
      statements: 100,
      branches: 100,
      functions: 100,
      uncovered: zeroUncovered,
    },
  },
});

const baselineFixture = {
  schema_version: 2,
  generated_at: "2026-08-17T00:00:00.000Z",
  git_sha: "0123456789abcdef0123456789abcdef01234567",
  command: "bun run coverage:baseline:write",
  epsilon: 0.001,
  minimum: { lines: 70, statements: 70, branches: 50, functions: 60 },
  exemptions: { "@beep/courtlistener": "Fixture exemption for the target." },
  follow_ups: {
    "@beep/alpha": "Fixture follow-up for the survivor.",
    "@beep/courtlistener": "Fixture follow-up for the target.",
  },
  packages: {
    "@beep/alpha": packageRow("packages/foundation/modeling/alpha"),
    "@beep/courtlistener": packageRow("packages/drivers/courtlistener"),
  },
};

const writeBaselineFixture = Effect.fn("writeBaselineFixture")(function* (repoRoot: string, document: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
  yield* fs.writeFileString(path.join(repoRoot, coverageRegressionBaselinePath), `${encodeJson(document)}\n`);
});

const readBaselineText = Effect.fn("readBaselineText")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(repoRoot, coverageRegressionBaselinePath));
});

describe("coverage baseline subtraction", () => {
  it("removes exactly the target's packages, exemptions, and follow_ups rows", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            yield* writeBaselineFixture(repoRoot, baselineFixture);
            yield* subtractPackageFromCoverageRegressionBaseline(repoRoot, "@beep/courtlistener");

            const text = yield* readBaselineText(repoRoot);
            expect(Str.startsWith("// Coverage regression baseline. Do not edit by hand.")(text)).toBe(true);
            expect(Str.includes("@beep/courtlistener")(text)).toBe(false);

            const decoded = yield* S.decodeUnknownEffect(BaselineProjection)(parse(text));
            expect(R.keys(decoded.packages)).toStrictEqual(["@beep/alpha"]);
            expect(R.keys(decoded.exemptions)).toStrictEqual([]);
            expect(R.keys(decoded.follow_ups)).toStrictEqual(["@beep/alpha"]);
            expect(R.get(decoded.packages, "@beep/alpha")).toStrictEqual(
              O.some({ path: "packages/foundation/modeling/alpha" })
            );
            // Provenance is inherited, matching how scoped merges carry it through.
            expect(decoded.generated_at).toBe(baselineFixture.generated_at);
            expect(decoded.git_sha).toBe(baselineFixture.git_sha);
          })
        )
      )
    ));

  it("leaves the document byte-identical when the target has no rows", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            yield* writeBaselineFixture(repoRoot, baselineFixture);
            const before = yield* readBaselineText(repoRoot);
            yield* subtractPackageFromCoverageRegressionBaseline(repoRoot, "@beep/round-trip-probe");
            const after = yield* readBaselineText(repoRoot);
            expect(after).toBe(before);
          })
        )
      )
    ));

  it("succeeds as a no-op when no committed baseline exists", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* subtractPackageFromCoverageRegressionBaseline(repoRoot, "@beep/courtlistener");
            const exists = yield* fs.exists(path.join(repoRoot, coverageRegressionBaselinePath));
            expect(exists).toBe(false);
          })
        )
      )
    ));

  it("refuses a schema-v1 document without touching the file", () =>
    Effect.runPromise(
      provideNode(
        withTempDirectory((repoRoot) =>
          Effect.gen(function* () {
            const legacy = {
              schema_version: 1,
              generated_at: "2026-01-01T00:00:00.000Z",
              git_sha: "feedfacefeedfacefeedfacefeedfacefeedface",
              command: "bun run coverage:baseline:write",
              epsilon: 0.001,
              packages: { "@beep/courtlistener": { path: "packages/drivers/courtlistener" } },
            };
            yield* writeBaselineFixture(repoRoot, legacy);
            const before = yield* readBaselineText(repoRoot);

            const exit = yield* Effect.exit(
              subtractPackageFromCoverageRegressionBaseline(repoRoot, "@beep/courtlistener")
            );
            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit)) {
              expect(Str.includes("schema version 1")(Cause.pretty(exit.cause))).toBe(true);
            }

            const after = yield* readBaselineText(repoRoot);
            expect(after).toBe(before);
          })
        )
      )
    ));
});
