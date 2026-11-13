import { Git } from "@beep/git/Git";
import { lintCommand } from "@beep/repo-cli";
import { COVERAGE_GENERATED_STANDARDS_OWNER_ROWS } from "@beep/repo-cli/test/Quality";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertInclude, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit } from "./support/CommandTest.ts";

// `beep lint coverage-owners` runs in Repo Sanity (hosted-setup-tax TURB-01):
// these cases drive the real command over scoped fixture checkouts.

const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const testLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    TestConsole.layer,
    FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer))),
    TSMorphServiceLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer)))
  )
);

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });

const READER_PATHS = A.dedupe(A.map(COVERAGE_GENERATED_STANDARDS_OWNER_ROWS, ([readerPath]) => readerPath));
const FALLOW_PATH = "standards/fallow.boundaries.generated.jsonc";
const SCHEMA_FIRST_PATH = "standards/schema-first.inventory.jsonc";

const readerSource = (paths: ReadonlyArray<string>): string =>
  `export const readers = [${A.join(
    A.map(paths, (path) => `"${path}"`),
    ", "
  )}];\n`;

const writeFile = Effect.fn("LintCoverageOwnersTest.writeFile")(function* (root: string, file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});

const workspacePackage = (name: string): string =>
  `{ "name": "${name}", "version": "0.0.0", "private": true, "scripts": { "coverage": "vitest run --coverage" } }\n`;

/** A scoped fixture checkout: a workspace root plus the given package manifests and sources. */
const writeFixture = Effect.fn("LintCoverageOwnersTest.writeFixture")(function* (
  files: ReadonlyArray<readonly [string, string]>,
  workspaces: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "lint-coverage-owners-" });
  yield* writeFile(
    root,
    "package.json",
    workspaces
      ? '{ "name": "fixture-root", "private": true, "workspaces": ["packages/*"] }\n'
      : '{ "name": "fixture-root", "private": true }\n'
  );
  yield* Effect.forEach(files, ([file, text]) => writeFile(root, file, text), { discard: true });
  return root;
});

const repoCliManifest = ["packages/cli/package.json", workspacePackage("@beep/repo-cli")] as const;

/** Error lines this run printed, after the lines earlier cases left in the shared TestConsole. */
const runAndCollectErrors = Effect.fn("LintCoverageOwnersTest.runAndCollectErrors")(function* (root: string) {
  const before = A.length(yield* TestConsole.errorLines);
  const exit = yield* Effect.exit(runLintCommand(["coverage-owners", "--repo-root", root]));
  const lines = pipe(yield* TestConsole.errorLines, A.drop(before), A.filter(P.isString));
  return { exit, lines } as const;
});

describe("coverage-owners lint command", { concurrent: false }, () => {
  it.layer(testLayer, { timeout: "60 seconds" })((it) => {
    it.effect("passes when the only readers are the row owner's", () =>
      Effect.gen(function* () {
        const root = yield* writeFixture(
          [repoCliManifest, ["packages/cli/test/readers.test.ts", readerSource(READER_PATHS)]],
          true
        );
        const { exit, lines } = yield* runAndCollectErrors(root);
        assertTrue(Exit.isSuccess(exit));
        deepStrictEqual(lines, []);
      })
    );

    it.effect("fails on a reader the rows miss and on a row whose reader is gone", () =>
      Effect.gen(function* () {
        const root = yield* writeFixture(
          [
            repoCliManifest,
            ["packages/cli/test/readers.test.ts", readerSource(A.filter(READER_PATHS, (path) => path !== FALLOW_PATH))],
            ["packages/kit/package.json", workspacePackage("@beep/repo-cli-kit")],
            ["packages/kit/test/Inventory.test.ts", readerSource([SCHEMA_FIRST_PATH])],
          ],
          true
        );
        const { exit, lines } = yield* runAndCollectErrors(root);
        expectReportedExit(exit);
        const report = A.join(A.filter(lines, Str.startsWith("[coverage-owners] ")), "\n");
        assertInclude(
          report,
          `[coverage-owners] ${SCHEMA_FIRST_PATH}: rows @beep/repo-cli; scan @beep/repo-cli, @beep/repo-cli-kit`
        );
        assertInclude(report, `[coverage-owners] ${FALLOW_PATH}: rows @beep/repo-cli; scan (none)`);
      })
    );

    it.effect("defaults to the enclosing checkout, whose rows equal its scan", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(runLintCommand(["coverage-owners"]));
        assertTrue(Exit.isSuccess(exit));
      })
    );

    it.effect("fails when the scan finds no workspace sources", () =>
      Effect.gen(function* () {
        const root = yield* writeFixture([], false);
        const before = A.length(yield* TestConsole.logLines);
        const { exit } = yield* runAndCollectErrors(root);
        expectReportedExit(exit);
        assertTrue(Exit.isFailure(exit));
        const logs = A.join(A.filter(A.drop(yield* TestConsole.logLines, before), P.isString), "\n");
        assertInclude(logs, "[coverage-owners] sources=0 drift=6");
      })
    );
  });
});
