import { Git } from "@beep/git/Git";
import {
  observabilityCommand,
  STANDARD_SECTION_BEGIN,
  STANDARD_SECTION_END,
} from "@beep/repo-cli/commands/Observability";
import { resolveShardScope } from "@beep/repo-cli/test/Cli";
import { lintCommand, makeSchemaFirstOwnerResolver } from "@beep/repo-cli/test/Lint";
import { githubCheckCheapGateLanes } from "@beep/repo-cli/test/Quality";
import { runGitOutput } from "@beep/repo-cli/test/RepoRun";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { describe, expect, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer, readProjectFile, withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import type { GitCommandErrorAdapter } from "@beep/repo-cli/test/RepoRun";

// The scoped writers resolve owners through the workspace list and stage through `Git`, so the
// test layer carries the platform services, `Git`, `FsUtils` and the ts-morph service beside a
// captured console.
const testLayer = Layer.mergeAll(
  NodeTestLayer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeTestLayer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeTestLayer))
);

const runLint = Command.runWith(lintCommand, { version: "0.0.0" });
const runObservability = Command.runWith(observabilityCommand, { version: "0.0.0" });

const schemaShard = (owner: string) => `standards/schema-catalog/${owner}.generated.jsonc`;
const spanShard = (owner: string) => `standards/instrumentation-catalog/${owner}.generated.jsonc`;
const standardPath = "standards/architecture/12-observability.md";
const sourceA = "packages/a/src/A.ts";
const sourceB = "packages/b/src/B.ts";
const sourceInfra = "infra/src/Stack.ts";
const sourceInfraLambda = "infra/lambda/Handler.ts";

const schemaModule = (name: string) =>
  A.join(
    [
      'import { $RepoCliId } from "@beep/identity/packages";',
      'import * as Effect from "effect/Effect";',
      'import * as S from "effect/Schema";',
      "",
      `const $I = $RepoCliId.create("fixture-${name}");`,
      "",
      `export class ${name}Model extends S.Class<${name}Model>($I\`${name}Model\`)(`,
      "  { id: S.String },",
      `  $I.annote("${name}Model", { description: "${name} fixture model." })`,
      ") {}",
      "",
      `export const run = Effect.fn("${name}.run")(function* () {});`,
      "",
    ],
    "\n"
  );

const writeFixture = Effect.fn("CatalogShardScopeTest.writeFixture")(function* () {
  // Root marker so findRepoRoot resolves the temp fixture as the repo root.
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile(
    "package.json",
    '{\n  "name": "@beep/test-root",\n  "private": true,\n  "type": "module",\n  "workspaces": ["infra", "packages/*"]\n}\n'
  );
  yield* writeProjectFile(
    "tsconfig.json",
    '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "Bundler"\n  }\n}\n'
  );
  yield* writeProjectFile(
    "packages/a/package.json",
    '{\n  "name": "@beep/a",\n  "version": "0.0.0",\n  "type": "module"\n}\n'
  );
  yield* writeProjectFile(
    "packages/b/package.json",
    '{\n  "name": "@beep/b",\n  "version": "0.0.0",\n  "type": "module"\n}\n'
  );
  // `infra` is a workspace member whose directory holds code the schema-first globs leave out
  // (`infra/lambda`); a scoped run must still match the full scan, which reads only `infra/{src,test}`.
  yield* writeProjectFile(
    "infra/package.json",
    '{\n  "name": "@beep/infra",\n  "version": "0.0.0",\n  "type": "module"\n}\n'
  );
  yield* writeProjectFile(sourceInfra, schemaModule("Infra"));
  yield* writeProjectFile(sourceInfraLambda, schemaModule("Lambda"));
  yield* writeProjectFile(sourceA, schemaModule("A"));
  yield* writeProjectFile(sourceB, schemaModule("B"));
  yield* writeProjectFile(standardPath, `# 12\n\n${STANDARD_SECTION_BEGIN}\n${STANDARD_SECTION_END}\n`);
});

const removeProjectFile = Effect.fn("CatalogShardScopeTest.removeProjectFile")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.remove(path.resolve(process.cwd(), relativePath));
});

const projectFileExists = Effect.fn("CatalogShardScopeTest.projectFileExists")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.resolve(process.cwd(), relativePath));
});

// `git.stagedChanges` lists added/modified paths only; the index diff also shows a staged removal.
const stagedPaths = (root: string) =>
  Effect.map(runGitOutput(root, ["diff", "--cached", "--name-only"], gitAdapter), (output) =>
    A.filter(Str.split(output, "\n"), Str.isNonEmpty)
  );

const gitAdapter: GitCommandErrorAdapter<Error> = {
  onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode, output }) => new Error(`${commandLine} exit ${exitCode}: ${output}`),
  onTruncated: O.none(),
};

// A committed fixture repository, so `--stage` has an index to add to and staged paths to read back.
const initFixtureRepository = Effect.fn("CatalogShardScopeTest.initFixtureRepository")(function* (root: string) {
  const git = yield* Git;
  yield* runGitOutput(root, ["init", "-q"], gitAdapter);
  yield* runGitOutput(root, ["config", "user.email", "catalog@example.test"], gitAdapter);
  yield* runGitOutput(root, ["config", "user.name", "Catalog Test"], gitAdapter);
  yield* runGitOutput(root, ["config", "commit.gpgsign", "false"], gitAdapter);
  yield* git.add(root, ["."]);
  yield* git.commit(root, "fixture");
});

layer(testLayer, { timeout: "60 seconds" })("catalog shard scope", (it) => {
  describe("resolveShardScope", () => {
    it.effect(
      "maps staged paths to their workspace owners, including deleted paths, and skips unowned ones",
      Effect.fn("CatalogShardScopeTest.resolve")(function* () {
        yield* withTempWorkingDirectory((root) =>
          Effect.gen(function* () {
            yield* writeFixture();
            const ownerOf = yield* makeSchemaFirstOwnerResolver(root);
            const scope = yield* resolveShardScope(
              root,
              [sourceB, "packages/a/src/Gone.ts", sourceA, "scripts/root-only.ts", sourceInfra],
              ownerOf
            );

            // Owners dedupe and sort by package name; the deleted path still resolves by prefix.
            expect(A.map(scope.owners, (owner) => `${owner.owner} ${owner.directory}`)).toEqual([
              "@beep/a packages/a",
              "@beep/b packages/b",
              "@beep/infra infra",
            ]);
            expect(scope.skipped).toEqual(["scripts/root-only.ts"]);
          })
        );
      })
    );
  });

  describe("schema catalog", () => {
    it.effect(
      "writes only the owning package's shard, byte-identical to the full run, and removes an emptied one",
      Effect.fn("CatalogShardScopeTest.scopedSchemaCatalog")(function* () {
        yield* withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeFixture();
            yield* runLint(["schema-catalog", "--write"]);
            const fullA = yield* readProjectFile(schemaShard("@beep/a"));
            const fullB = yield* readProjectFile(schemaShard("@beep/b"));
            yield* removeProjectFile(schemaShard("@beep/a"));
            yield* removeProjectFile(schemaShard("@beep/b"));

            yield* runLint(["schema-catalog", "--write", sourceA]);
            expect(yield* readProjectFile(schemaShard("@beep/a"))).toBe(fullA);
            expect(yield* projectFileExists(schemaShard("@beep/b"))).toBe(false);

            // The package that lost its last schema loses its shard; the other shard is untouched.
            yield* runLint(["schema-catalog", "--write", sourceB]);
            expect(yield* readProjectFile(schemaShard("@beep/b"))).toBe(fullB);
            yield* removeProjectFile(sourceB);
            yield* runLint(["schema-catalog", "--write", sourceB]);
            expect(yield* projectFileExists(schemaShard("@beep/b"))).toBe(false);
            expect(yield* readProjectFile(schemaShard("@beep/a"))).toBe(fullA);
          })
        );
      })
    );

    it.effect(
      "keeps a workspace owner's scoped shard to the full scan's globs",
      Effect.fn("CatalogShardScopeTest.scopedWorkspaceOutsideGlobs")(function* () {
        yield* withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeFixture();
            yield* runLint(["schema-catalog", "--write"]);
            const fullInfra = yield* readProjectFile(schemaShard("@beep/infra"));
            expect(fullInfra).toContain(sourceInfra);
            expect(fullInfra).not.toContain(sourceInfraLambda);
            yield* removeProjectFile(schemaShard("@beep/infra"));

            // Staging the out-of-glob file still regenerates the owner, from in-glob files only.
            yield* runLint(["schema-catalog", "--write", sourceInfraLambda]);
            expect(yield* readProjectFile(schemaShard("@beep/infra"))).toBe(fullInfra);
          })
        );
      })
    );

    it.effect(
      "stages the shards a scoped write changed and nothing else",
      Effect.fn("CatalogShardScopeTest.stageSchemaCatalog")(function* () {
        yield* withTempWorkingDirectory((root) =>
          Effect.gen(function* () {
            yield* writeFixture();
            yield* runLint(["schema-catalog", "--write"]);
            yield* initFixtureRepository(root);
            yield* removeProjectFile(schemaShard("@beep/a"));

            yield* runLint(["schema-catalog", "--write", "--stage", sourceA]);
            expect(yield* stagedPaths(root)).toEqual([]);
            // The rewrite restored the committed bytes, so nothing is staged; a real change is.
            yield* removeProjectFile(sourceB);
            yield* runLint(["schema-catalog", "--write", "--stage", sourceB]);
            expect(yield* stagedPaths(root)).toEqual([schemaShard("@beep/b")]);
          })
        );
      })
    );
  });

  describe("instrumentation catalog", () => {
    it.effect(
      "writes only the owning package's shard, skips the standard section, and stages the change",
      Effect.fn("CatalogShardScopeTest.scopedInstrumentationCatalog")(function* () {
        yield* withTempWorkingDirectory((root) =>
          Effect.gen(function* () {
            yield* writeFixture();
            yield* runObservability(["catalog", "--write"]);
            const fullA = yield* readProjectFile(spanShard("@beep/a"));
            const fullStandard = yield* readProjectFile(standardPath);
            yield* initFixtureRepository(root);
            yield* removeProjectFile(spanShard("@beep/a"));
            yield* writeProjectFile(standardPath, `# 12\n\n${STANDARD_SECTION_BEGIN}\n${STANDARD_SECTION_END}\n`);

            yield* runObservability(["catalog", "--write", "--stage", sourceA]);
            // The report prints as one multi-line block.
            const report = A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n");
            expect(report).toContain(`[observability-catalog] ${standardPath}: skipped`);
            expect(yield* readProjectFile(spanShard("@beep/a"))).toBe(fullA);
            // The standard's generated section belongs to the full run.
            expect(yield* readProjectFile(standardPath)).not.toBe(fullStandard);
            expect(yield* stagedPaths(root)).toEqual([]);

            yield* removeProjectFile(sourceB);
            yield* runObservability(["catalog", "--write", "--stage", sourceB]);
            expect(yield* stagedPaths(root)).toEqual([spanShard("@beep/b")]);
          })
        );
      })
    );
  });

  describe("cheap gates", () => {
    it("keep both catalog checks registered so a local publish refuses on a stale shard", () => {
      const lanes = githubCheckCheapGateLanes("/repo");
      const lane = (id: string) => A.findFirst(lanes, (candidate) => candidate.id === id);

      // The schema-catalog gate runs through the root Turbo task, whose inputs include the
      // generated shards, so a stale shard misses the cache and the check runs and refuses.
      assertSome(
        O.map(lane("lint:schema-catalog"), ({ tier, step }) => ({
          tier,
          args: A.take([step.command, ...step.args], 4),
        })),
        { tier: "cheap-gates", args: ["bunx", "turbo", "run", "lint:schema-catalog"] }
      );
      assertSome(
        O.map(lane("observability:catalog-check"), ({ tier, step }) => ({ tier, args: [step.command, ...step.args] })),
        { tier: "cheap-gates", args: ["bun", "run", "beep", "observability", "catalog", "--check"] }
      );
    });
  });
});
