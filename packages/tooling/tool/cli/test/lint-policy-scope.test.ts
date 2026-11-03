import * as NodeURL from "node:url";
import {
  collectLintPolicyChangeFacts,
  DOCS_OXLINT_CONFIG,
  docsPluginBundleArgs,
  LintPolicyAffectedScope,
  LintPolicyAffectedTargets,
  LintPolicyChangeFacts,
  LintPolicyEscalation,
  LintPolicyFullScope,
  lintPolicyAffectedTargetsFromDryRun,
  lintPolicyEscalationTriggerForPath,
  localQualityConcurrencyPlan,
  PREBUILT_DOCS_OXLINT_CONFIG,
  planLintPolicyScope,
  prepareDocsOxlintConfig,
  readLintPolicySeal,
  rootLintPolicyStagesForTesting,
} from "@beep/repo-cli/test/Quality";
import { runGitOutput } from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";
import type { QualityTaskStep } from "@beep/repo-cli/test/Quality";
import type { GitCommandErrorAdapter } from "@beep/repo-cli/test/RepoRun";

const REPO_ROOT = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));

// The scope collector reads git and the filesystem; the prebuild spawns `bun build`.
const testLayer = Layer.mergeAll(NodeTestLayer, TestConsole.layer);

const gitAdapter: GitCommandErrorAdapter<Error> = {
  onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode, output }) => new Error(`${commandLine} exit ${exitCode}: ${output}`),
  onTruncated: O.none(),
};

const git = (root: string, args: ReadonlyArray<string>) => runGitOutput(root, args, gitAdapter);

const noSeal = (_path: string): boolean => false;
const facts = (
  changedPaths: ReadonlyArray<string>,
  extra: Partial<Pick<LintPolicyChangeFacts, "deletedPaths" | "deprecationPaths">> = {}
) =>
  LintPolicyChangeFacts.make({
    changedPaths,
    deletedPaths: extra.deletedPaths ?? [],
    deprecationPaths: extra.deprecationPaths ?? [],
  });

const turboTaskNames = (step: QualityTaskStep): ReadonlyArray<string> =>
  A.takeWhile(A.drop(step.args, 2), (arg) => !Str.startsWith("--")(arg));
const labels = (stages: ReadonlyArray<ReadonlyArray<QualityTaskStep>>) =>
  A.map(stages, (stage) => A.map(stage, (step) => step.label));
const stepLabelled = (stages: ReadonlyArray<ReadonlyArray<QualityTaskStep>>, label: string): QualityTaskStep =>
  O.getOrThrow(A.findFirst(A.flatten(stages), (step) => step.label === label));

const targets = LintPolicyAffectedTargets.make({
  jsdoc: ["packages/a", "packages/b"],
  deprecatedApis: ["packages/a", "packages/c"],
});

const TurboTaskCache = S.Struct({ cache: S.optionalKey(S.Boolean) });
const TurboTasks = S.Struct({ tasks: S.Record(S.String, TurboTaskCache) });
const decodeTurboTasks = S.decodeUnknownEffect(S.fromJsonString(TurboTasks));
const decodeJsonRecord = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.Unknown)));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

describe("lint policy escalation classes", () => {
  it("widens tsconfig, dependency, Turbo, lint-config and policy-implementation paths", () => {
    const sealed = (path: string): boolean => path === "packages/foundation/modeling/schema/src/Schema.ts";
    const cases: ReadonlyArray<readonly [string, string | undefined]> = [
      ["tsconfig.base.json", "tsconfig"],
      ["packages/demo/tsconfig.build.json", "tsconfig"],
      ["apps/web/jsconfig.json", "tsconfig"],
      ["bun.lock", "dependency-manifest"],
      ["package.json", "dependency-manifest"],
      ["packages/demo/package.json", "dependency-manifest"],
      [".bun-version", "dependency-manifest"],
      ["patches/effect@4.0.0.patch", "dependency-manifest"],
      ["turbo.json", "turbo-config"],
      ["packages/demo/turbo.json", "turbo-config"],
      [".oxlintrc.docs.json", "lint-configuration"],
      [".oxlintrc.deprecated-apis.jsonc", "lint-configuration"],
      ["biome.jsonc", "lint-configuration"],
      ["_typos.toml", "lint-configuration"],
      ["tsdoc.json", "lint-configuration"],
      ["standards/lint-policy.sweeps.jsonc", "lint-configuration"],
      ["standards/policy-tools.fingerprint.json", "lint-configuration"],
      ["packages/tooling/policy-pack/lint-rules/src/rules/docs.ts", "policy-implementation"],
      ["packages/tooling/tool/cli/src/commands/Lint/LintPolicy.command.ts", "policy-implementation"],
      ["packages/foundation/modeling/schema/src/Schema.ts", "policy-implementation"],
      ["packages/demo/src/index.ts", undefined],
      ["packages/demo/.oxlintrc.json", undefined],
      ["docs/runbooks/turbo-cache-inputs.md", undefined],
    ];
    for (const [path, expected] of cases) {
      expect([path, O.getOrUndefined(lintPolicyEscalationTriggerForPath(sealed, path))]).toEqual([path, expected]);
    }
  });

  it("keeps a source-only change set changed-scope", () => {
    const scope = planLintPolicyScope(facts(["packages/demo/src/index.ts", "docs/a.md"]), O.some(noSeal), "base");
    expect(scope).toEqual(LintPolicyAffectedScope.make({ base: "base", changedFileCount: 2 }));
  });

  it("widens on deletions, @deprecated sources, escalating paths and an unreadable seal", () => {
    const scope = planLintPolicyScope(
      facts(["packages/demo/src/index.ts", "packages/demo/src/gone.ts", "bun.lock"], {
        deletedPaths: ["packages/demo/src/gone.ts"],
        deprecationPaths: ["packages/demo/src/index.ts"],
      }),
      O.some(noSeal),
      "base"
    );
    expect(scope).toEqual(
      LintPolicyFullScope.make({
        escalations: [
          LintPolicyEscalation.make({ trigger: "deleted-path", path: "packages/demo/src/gone.ts" }),
          LintPolicyEscalation.make({ trigger: "deprecation-annotation", path: "packages/demo/src/index.ts" }),
          LintPolicyEscalation.make({ trigger: "dependency-manifest", path: "bun.lock" }),
        ],
      })
    );
    expect(planLintPolicyScope(facts([]), O.none(), "base")).toEqual(
      LintPolicyFullScope.make({
        escalations: [
          LintPolicyEscalation.make({
            trigger: "policy-seal-unreadable",
            path: "standards/policy-tools.fingerprint.json",
          }),
        ],
      })
    );
  });
});

describe("lint policy target probe", () => {
  it.effect("reads the selected package directories per target task", () =>
    Effect.gen(function* () {
      const plan = {
        tasks: [
          { task: "lint:jsdoc", directory: "packages/b", command: "beep-cli lint jsdoc --package ." },
          { task: "lint:jsdoc", directory: "packages/a", command: "beep-cli lint jsdoc --package ." },
          { task: "lint:deprecated-apis", directory: "packages/c", command: "beep-cli lint deprecated-apis" },
          { task: "lint:deprecated-apis", directory: "packages/d", command: "<NONEXISTENT>" },
          { task: "transit", directory: "packages/e", command: "<NONEXISTENT>" },
          { task: "lint:deprecated-apis", directory: "packages/c", command: "beep-cli lint deprecated-apis" },
        ],
      };
      const encodedJson = yield* encodeJson(plan);
      const parsed = yield* lintPolicyAffectedTargetsFromDryRun(encodedJson);
      expect(parsed).toEqual(
        LintPolicyAffectedTargets.make({ jsdoc: ["packages/a", "packages/b"], deprecatedApis: ["packages/c"] })
      );
      expect((yield* Effect.flip(lintPolicyAffectedTargetsFromDryRun("")))._tag).toBe("QualityTaskConfigurationError");
    })
  );
});

describe("lint policy plan stages", () => {
  const width = localQualityConcurrencyPlan().policyLint;

  it("runs the unfiltered state graph abreast of the affected medium graph, splitting the width", () => {
    const stages = rootLintPolicyStagesForTesting("/repo", {
      base: "origin/main",
      hosted: true,
      docsConfig: PREBUILT_DOCS_OXLINT_CONFIG,
      targets,
    });
    expect(labels(stages)).toEqual([
      ["lint:policy:cheap"],
      ["lint:policy:medium", "lint:policy:state"],
      ["knowledge:doctor"],
      ["lint:jsdoc"],
      ["lint:deprecated-apis"],
      ["quality:test-tsgo"],
    ]);
    const medium = stepLabelled(stages, "lint:policy:medium");
    const state = stepLabelled(stages, "lint:policy:state");
    expect(medium.args).toContain(`--concurrency=${Math.max(1, width - 1)}`);
    expect(medium.args).toContain("--affected");
    expect(medium.env?.TURBO_SCM_BASE).toBe("origin/main");
    expect(turboTaskNames(medium)).not.toContain("lint:jsdoc");
    expect(turboTaskNames(medium)).toEqual(
      expect.arrayContaining([
        "lint:jsdoc:root",
        "lint:jsdoc-module-tags",
        "jsdoc:inventory:check",
        "jsdoc:ratchet:check",
      ])
    );
    expect(state.args).toContain("--concurrency=1");
    expect(state.args).not.toContain("--affected");
    expect(state.env?.TURBO_SCM_BASE).toBeUndefined();
    expect(turboTaskNames(state)).toEqual([
      "knowledge:semantic-delta",
      "knowledge:refs-check",
      "goals:doctor",
      "lint:oxlint",
      "lint:shadcn",
      "lint:typos",
    ]);
  });

  it("runs one root oxlint per target task over Turbo's selected directories", () => {
    const stages = rootLintPolicyStagesForTesting("/repo", {
      base: "origin/main",
      hosted: true,
      docsConfig: PREBUILT_DOCS_OXLINT_CONFIG,
      targets,
    });
    expect(stepLabelled(stages, "lint:jsdoc")).toMatchObject({
      command: "bunx",
      args: ["oxlint", "--config", PREBUILT_DOCS_OXLINT_CONFIG, "--max-warnings=0", "packages/a", "packages/b"],
    });
    expect(A.drop(stepLabelled(stages, "lint:deprecated-apis").args, 3)).toEqual([
      "lint",
      "deprecated-apis",
      "--target",
      "packages/a",
      "--target",
      "packages/c",
    ]);
    // An empty selection plans no documentation or deprecated-API step at all.
    const empty = rootLintPolicyStagesForTesting("/repo", {
      base: "origin/main",
      hosted: true,
      targets: LintPolicyAffectedTargets.make({ jsdoc: [], deprecatedApis: [] }),
    });
    expect(A.flatten(labels(empty))).not.toContain("lint:jsdoc");
    expect(A.flatten(labels(empty))).not.toContain("lint:deprecated-apis");
  });

  it("keeps the per-package Turbo tasks when no target probe answered", () => {
    const stages = rootLintPolicyStagesForTesting("/repo", { base: "origin/main", hosted: true });
    expect(turboTaskNames(stepLabelled(stages, "lint:policy:medium"))).toContain("lint:jsdoc");
    expect(A.flatten(labels(stages))).not.toContain("lint:jsdoc");
    const deprecated = stepLabelled(stages, "lint:deprecated-apis");
    expect(turboTaskNames(deprecated)).toEqual(["lint:deprecated-apis"]);
    expect(deprecated.args).toContain("--affected");
  });

  it("keeps the full sweep's single graph and root sweeps, reading the prepared docs config", () => {
    const stages = rootLintPolicyStagesForTesting("/repo", { hosted: true, docsConfig: PREBUILT_DOCS_OXLINT_CONFIG });
    expect(labels(stages)).toEqual([
      ["lint:policy:cheap"],
      ["lint:policy:medium"],
      ["knowledge:doctor"],
      ["lint:jsdoc"],
      ["lint:deprecated-apis"],
      ["quality:test-tsgo"],
    ]);
    expect(stepLabelled(stages, "lint:policy:medium").args).toContain(`--concurrency=${width}`);
    expect(stepLabelled(stages, "lint:jsdoc").args).toEqual([
      "oxlint",
      ".",
      "--config",
      PREBUILT_DOCS_OXLINT_CONFIG,
      "--max-warnings=0",
    ]);
    expect(A.every(A.flatten(stages), (step) => !A.contains(step.args, "--affected"))).toBe(true);
  });
});

layer(testLayer, { timeout: "60 seconds" })("lint policy change facts", (it) => {
  // Turbo's task-input selection is exactly as sound as a cache hit, so only tasks whose inputs
  // the cache contract certifies may run changed-scope; uncached state tasks run unfiltered.
  it.effect("scopes exactly the cached policy tasks and leaves the uncached state tasks unfiltered", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const turbo = yield* fs.readFileString(path.join(REPO_ROOT, "turbo.json")).pipe(Effect.flatMap(decodeTurboTasks));
      const cached = (task: string): O.Option<boolean> =>
        pipe(
          R.get(turbo.tasks, `//#${task}`),
          O.orElse(() => R.get(turbo.tasks, task)),
          O.map((definition) => definition.cache !== false)
        );
      const stages = rootLintPolicyStagesForTesting(REPO_ROOT, { base: "origin/main", hosted: true });
      const scoped = A.filter(A.flatten(stages), (step) => A.contains(step.args, "--affected"));
      const misplaced = [
        ...A.filter(A.flatMap(scoped, turboTaskNames), (task) => !O.exists(cached(task), (isCached) => isCached)),
        ...A.filter(
          turboTaskNames(stepLabelled(stages, "lint:policy:state")),
          (task) => !O.exists(cached(task), (isCached) => !isCached)
        ),
      ];
      expect(A.length(A.flatMap(scoped, turboTaskNames))).toBeGreaterThan(0);
      expect(misplaced).toEqual([]);
    })
  );
  it.effect("reads deletions and @deprecated sources from the range and the dirty tree", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const write = (file: string, content: string) =>
        fs
          .makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
          .pipe(Effect.andThen(fs.writeFileString(path.join(root, file), content)));
      yield* git(root, ["init", "-q"]);
      yield* git(root, ["config", "user.email", "policy@example.test"]);
      yield* git(root, ["config", "user.name", "Policy Test"]);
      yield* git(root, ["config", "commit.gpgsign", "false"]);
      yield* write("packages/demo/src/keep.ts", "export const keep = 1;\n");
      yield* write("packages/demo/src/gone.ts", "export const gone = 1;\n");
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "-q", "-m", "base"]);
      const git1 = yield* git(root, ["rev-parse", "HEAD"]);
      const base = Str.trim(git1);
      yield* fs.remove(path.join(root, "packages/demo/src/gone.ts"));
      yield* write("packages/demo/src/keep.ts", "/** @deprecated use next */\nexport const keep = 1;\n");
      yield* write("docs/notes.md", "@deprecated in prose is not a source\n");
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "-q", "-m", "change"]);
      yield* write("packages/demo/src/dirty.ts", "export const dirty = 1;\n");

      const collected = yield* collectLintPolicyChangeFacts(root, base);
      expect(collected).toEqual(
        LintPolicyChangeFacts.make({
          changedPaths: [
            "docs/notes.md",
            "packages/demo/src/dirty.ts",
            "packages/demo/src/gone.ts",
            "packages/demo/src/keep.ts",
          ],
          deletedPaths: ["packages/demo/src/gone.ts"],
          deprecationPaths: ["packages/demo/src/keep.ts"],
        })
      );
    })
  );

  it.effect("reads the live fingerprint seal, globs included, and none from a repository without one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const seal = yield* readLintPolicySeal(REPO_ROOT);
      const probe = (path: string) => O.map(seal, (isSealed) => isSealed(path));
      assertSome(probe("packages/tooling/tool/cli/src/commands/Quality/Tasks.ts"), true);
      // `shared` seals repo-cli assets through `packages/tooling/tool/cli/src/**/*.json`.
      assertSome(probe("packages/tooling/tool/cli/src/commands/Quality/asset.json"), true);
      assertSome(probe("docs/runbooks/turbo-cache-inputs.md"), false);
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped();
      const readLintPolicySeal2 = yield* readLintPolicySeal(madeTempDirectoryScoped);
      assertNone(readLintPolicySeal2);
    })
  );

  it.effect("seals an uncompilable glob by its literal prefix", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      // Past the compile length guard, so the glob cannot be compiled.
      const prefix = `packages/demo/${Str.repeat(70_000)("a")}`;
      yield* fs.makeDirectory(path.join(root, "standards"), { recursive: true });
      const argument = path.join(root, "standards/policy-tools.fingerprint.json");
      const encodedJson1 = yield* encodeJson({
        schemaVersion: "policy-tools-fingerprint/v2",
        shared: [`${prefix}*.json`],
        sharedTasks: [],
        check: [],
        entries: [],
      });
      yield* fs.writeFileString(argument, encodedJson1);
      const seal = yield* readLintPolicySeal(root);
      assertSome(
        O.map(seal, (isSealed) => isSealed(`${prefix}/x.json`)),
        true
      );
      assertSome(
        O.map(seal, (isSealed) => isSealed("packages/demo/src/index.ts")),
        false
      );
    })
  );

  it.effect("falls back to the source config when bun build rejects the plugin", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const source = "packages/tooling/policy-pack/lint-rules/src/rules/docs.index.ts";
      yield* fs.makeDirectory(path.join(root, path.dirname(source)), { recursive: true });
      yield* fs.writeFileString(path.join(root, source), "export default {{{ not typescript\n");
      yield* fs.writeFileString(path.join(root, DOCS_OXLINT_CONFIG), `{ "jsPlugins": ["./${source}"] }`);
      const prepareDocsOxlintConfig3 = yield* prepareDocsOxlintConfig(root);
      expect(prepareDocsOxlintConfig3).toBe(DOCS_OXLINT_CONFIG);
      const exists4 = yield* fs.exists(path.join(root, PREBUILT_DOCS_OXLINT_CONFIG));
      expect(exists4).toBe(false);
    })
  );

  it.effect("bundles the documentation plugin and derives a config that loads the bundle", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const source = "packages/tooling/policy-pack/lint-rules/src/rules/docs.index.ts";
      yield* fs.makeDirectory(path.join(root, path.dirname(source)), { recursive: true });
      yield* fs.writeFileString(path.join(root, source), 'export default { meta: { name: "beep" }, rules: {} };\n');
      yield* fs.writeFileString(
        path.join(root, DOCS_OXLINT_CONFIG),
        `{ // comments are JSONC\n "jsPlugins": ["./${source}"], "ignorePatterns": ["**/dist/**"] }\n`
      );
      const prepareDocsOxlintConfig5 = yield* prepareDocsOxlintConfig(root);
      expect(prepareDocsOxlintConfig5).toBe(PREBUILT_DOCS_OXLINT_CONFIG);
      const derived = yield* fs
        .readFileString(path.join(root, PREBUILT_DOCS_OXLINT_CONFIG))
        .pipe(Effect.flatMap(decodeJsonRecord));
      expect(derived).toEqual({
        jsPlugins: ["./packages/tooling/policy-pack/lint-rules/.prebuilt/rules/docs.index.js"],
        ignorePatterns: ["**/dist/**"],
      });
      const readFileString6 = yield* fs.readFileString(
        path.join(root, "packages/tooling/policy-pack/lint-rules/.prebuilt/rules/docs.index.js")
      );
      expect(readFileString6).toContain("beep");
      // Only the bundle and the config remain: the staging directory is gone.
      const readDirectory7 = yield* fs.readDirectory(
        path.join(root, "packages/tooling/policy-pack/lint-rules/.prebuilt/rules")
      );
      expect(readDirectory7).toEqual(["docs.index.js"]);
    })
  );

  it.effect("falls back to the source config when the plugin cannot be prebuilt", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const missing = yield* fs.makeTempDirectoryScoped();
      const prepareDocsOxlintConfig8 = yield* prepareDocsOxlintConfig(missing);
      expect(prepareDocsOxlintConfig8).toBe(DOCS_OXLINT_CONFIG);
      const other = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(other, DOCS_OXLINT_CONFIG), '{ "jsPlugins": ["./elsewhere.ts"] }');
      const prepareDocsOxlintConfig9 = yield* prepareDocsOxlintConfig(other);
      expect(prepareDocsOxlintConfig9).toBe(DOCS_OXLINT_CONFIG);
      const exists10 = yield* fs.exists(path.join(other, PREBUILT_DOCS_OXLINT_CONFIG));
      expect(exists10).toBe(false);
      expect(A.drop(docsPluginBundleArgs("/out/docs.index.js"), 2)).toEqual([
        "--target=node",
        "--format=esm",
        "--outfile=/out/docs.index.js",
        "--external",
        "@microsoft/*",
        "--external",
        "comment-parser",
        "--external",
        "are-docs-informative",
      ]);
    })
  );
});
