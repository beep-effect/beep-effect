import { EcosystemPolarityOptions, runEcosystemPolarityCheck } from "@beep/repo-cli/commands/Lint/EcosystemPolarity";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { NodeTestLayer, withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

const writeJson = Effect.fn(function* (filePath: string, value: unknown) {
  yield* writeProjectFile(filePath, `${encodeJson(value)}\n`);
});

const writeMember = Effect.fn(function* (
  manifest: Readonly<Record<string, unknown>>,
  sourceFiles: Readonly<Record<string, string>> = {}
) {
  yield* writeJson("packages/ecosystem/member/package.json", {
    name: "@beep/member",
    private: true,
    beep: { family: "ecosystem" },
    ...manifest,
  });
  for (const [file, content] of R.toEntries(sourceFiles)) {
    yield* writeProjectFile(`packages/ecosystem/member/${file}`, content);
  }
});

const withFixtureRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  withTempWorkingDirectory(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.join(process.cwd(), ".git"));
      return yield* use;
    })
  );

const runFullCheck = runEcosystemPolarityCheck(EcosystemPolarityOptions.make({}));

describe("ecosystem polarity lint", () => {
  it("finds import, export, dynamic import, and literal require @beep source edges", () =>
    Effect.runPromise(
      withFixtureRepo(
        Effect.gen(function* () {
          yield* writeMember(
            {},
            {
              "src/index.ts": A.join(
                [
                  'import "@beep/imported";',
                  'export * from "@beep/exported";',
                  'export const dynamic = import("@beep/dynamic");',
                  'export const required = require("@beep/required");',
                ],
                "\n"
              ),
            }
          );

          const summary = yield* runFullCheck;
          expect(A.map(summary.violations, (violation) => violation.detail)).toEqual([
            "@beep/imported",
            "@beep/exported",
            "@beep/dynamic",
            "@beep/required",
          ]);
        })
      ).pipe(provideScopedLayer(NodeTestLayer))
    ));

  it("rejects runtime manifest edges and bundled dependency fields", () =>
    Effect.runPromise(
      withFixtureRepo(
        Effect.gen(function* () {
          yield* writeMember({
            peerDependencies: { "@beep/internal": "workspace:^", effect: "4.0.0" },
            bundledDependencies: [],
          });

          const summary = yield* runFullCheck;
          expect(A.map(summary.violations, (violation) => violation.kind)).toEqual([
            "runtime-dependency",
            "bundled-dependencies",
          ]);
        })
      ).pipe(provideScopedLayer(NodeTestLayer))
    ));

  it("ignores devDependencies, tests, and unrelated changed files", () =>
    Effect.runPromise(
      withFixtureRepo(
        Effect.gen(function* () {
          yield* writeMember(
            { devDependencies: { "@beep/test-utils": "workspace:^" } },
            { "test/index.test.ts": 'import "@beep/test-utils";\n' }
          );

          const fullSummary = yield* runFullCheck;
          expect(fullSummary.checkedMembers).toBe(1);
          expect(fullSummary.violations).toEqual([]);

          const changedSummary = yield* runEcosystemPolarityCheck(
            EcosystemPolarityOptions.make({ includePaths: ["packages/demo/src/index.ts"] })
          );
          expect(changedSummary.checkedMembers).toBe(0);
          expect(changedSummary.violations).toEqual([]);
        })
      ).pipe(provideScopedLayer(NodeTestLayer))
    ));

  it("expands a member src or manifest change to the member's full check", () =>
    Effect.runPromise(
      withFixtureRepo(
        Effect.gen(function* () {
          yield* writeMember(
            {},
            { "src/violation.ts": 'import "@beep/internal";\n', "src/changed.ts": "export {};\n" }
          );

          for (const changedFile of [
            "packages/ecosystem/member/src/changed.ts",
            "packages/ecosystem/member/package.json",
          ]) {
            const summary = yield* runEcosystemPolarityCheck(
              EcosystemPolarityOptions.make({ includePaths: [changedFile] })
            );
            expect(summary.checkedMembers).toBe(1);
            expect(summary.violations).toHaveLength(1);
            expect(summary.violations[0]?.detail).toBe("@beep/internal");
          }
        })
      ).pipe(provideScopedLayer(NodeTestLayer))
    ));
});
