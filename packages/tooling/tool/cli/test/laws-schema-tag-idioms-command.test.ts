import { lawsCommand } from "@beep/repo-cli/commands/Laws";
import { runSchemaTagIdioms, SchemaTagIdiomsOptions } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";
import { withAncestorsHidden } from "./support/CommandTest.ts";

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const fence = Str.repeat(3)("`");
const schemaImport = 'import * as S from "effect/Schema"';
const violatingSource = `${schemaImport}\nexport const Bad = S.Struct({ _tag: S.Literal("Bad") })\n`;
const violatingMarkdown = A.join(
  [`${fence}ts`, schemaImport, 'const Doc = S.Struct({ kind: S.Literal("doc") })', fence],
  "\n"
);

const writeRepoFile = Effect.fn("SchemaTagIdiomsCommandTest.writeRepoFile")(function* (
  root: string,
  file: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});

const runGit = Effect.fn("SchemaTagIdiomsCommandTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const spawnFailure = ChildProcessSpawner.make(() =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "NotFound",
      module: "ChildProcess",
      method: "spawn",
      description: "git is not installed",
    })
  )
);

/** A git checkout holding one TS and one Markdown finding plus a deleted, a generated and a history file. */
const makeFixtureCheckout = Effect.fn("SchemaTagIdiomsCommandTest.makeFixtureCheckout")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "schema-tag-idioms-" });
  yield* writeRepoFile(root, "bun.lock", "");
  yield* writeRepoFile(root, "src/Bad.ts", violatingSource);
  yield* writeRepoFile(root, "src/_generated/Generated.ts", violatingSource);
  yield* writeRepoFile(root, "src/Gone.ts", violatingSource);
  yield* writeRepoFile(root, "docs/Guide.md", violatingMarkdown);
  yield* writeRepoFile(root, "goals/demo/SPEC.md", violatingMarkdown);
  yield* runGit(root, ["init", "--quiet"]);
  yield* runGit(root, ["add", "."]);
  yield* fs.remove(path.join(root, "src/Gone.ts"));
  return root;
});

/** The command reads `process.cwd()`, so the test moves into the checkout for the rest of its scope. */
const enterDirectory = (directory: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(directory);
      return previous;
    }),
    (previous) => Effect.sync(() => process.chdir(previous))
  );

it.layer(PlatformLayer, { timeout: "60 seconds" })((it) => {
  describe("schema-tag-idioms command", { concurrent: false }, () => {
    it.effect(
      "reports a checkout as text, and fails its strict text and JSON checks",
      Effect.fnUntraced(function* () {
        yield* enterDirectory(yield* makeFixtureCheckout());

        const report = yield* runInProcess(["schema-tag-idioms"]).pipe(withEmptyConfig, Effect.exit);
        const check = yield* runInProcess(["schema-tag-idioms", "--check"]).pipe(withEmptyConfig, Effect.exit);
        const json = yield* runInProcess(["schema-tag-idioms", "--check", "--json"]).pipe(withEmptyConfig, Effect.exit);

        assertTrue(Exit.isSuccess(report), failureText(report));
        expect(failureText(check)).toContain("effect-governance-schema-tag-idioms: check failed.");
        expect(failureText(json)).toContain("effect-governance-schema-tag-idioms: check failed.");
      })
    );

    it.effect(
      "fails a strict scan of a checkout and skips history, generated and deleted files",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout();

        const summary = yield* runSchemaTagIdioms(SchemaTagIdiomsOptions.make({ cwd: root, strictCheck: true }));

        expect(summary.scannedFiles).toBe(2);
        expect(summary.scannedFences).toBe(1);
        expect(summary.strictFailure).toBe(true);
        expect(A.map(summary.findings, (finding) => [finding.file, finding.rule, finding.line])).toEqual([
          ["src/Bad.ts", "struct-tag", 2],
          ["docs/Guide.md", "single-literal-field", 3],
        ]);
      })
    );

    it.effect(
      "fails with the law's execution error when the repository root, git listing or git spawn fails",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "schema-tag-idioms-bare-" });
        const notGit = yield* fs.makeTempDirectoryScoped({ prefix: "schema-tag-idioms-not-git-" });
        yield* fs.writeFileString(path.join(notGit, "bun.lock"), "");
        const run = (cwd: string) => runSchemaTagIdioms(SchemaTagIdiomsOptions.make({ cwd, strictCheck: true }));

        const noRoot = yield* run(bare).pipe(withAncestorsHidden(bare), Effect.exit);
        const noGit = yield* run(notGit).pipe(Effect.exit);
        const noSpawn = yield* run(notGit).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawnFailure),
          Effect.exit
        );

        expect(failureText(noRoot)).toContain("Failed to locate the repository root");
        expect(failureText(noGit)).toContain("failed with exit code");
        expect(failureText(noSpawn)).toContain("Failed to spawn git ls-files");
      })
    );
  });
});
