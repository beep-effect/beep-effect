import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Order, Path } from "effect";
import * as Str from "effect/String";
import { parseDocument } from "yaml";

const PUSH_GUARDED_TURBO_API =
  "${{ github.event_name == 'push' && vars.TURBO_API && secrets.TURBO_TOKEN && vars.TURBO_API || '' }}";
const PUSH_GUARDED_TURBO_TOKEN = "${{ github.event_name == 'push' && vars.TURBO_API && secrets.TURBO_TOKEN || '' }}";
const PUSH_GUARDED_TURBO_TEAM =
  "${{ github.event_name == 'push' && vars.TURBO_API && secrets.TURBO_TOKEN && vars.TURBO_TEAM || '' }}";
const PUSH_GUARDED_TURBO_CACHE =
  "${{ github.event_name == 'push' && vars.TURBO_API && secrets.TURBO_TOKEN && 'local:rw,remote:rw' || 'local:rw' }}";

const PUSH_ONLY_TURBO_API = "${{ vars.TURBO_API && secrets.TURBO_TOKEN && vars.TURBO_API || '' }}";
const PUSH_ONLY_TURBO_TOKEN = "${{ vars.TURBO_API && secrets.TURBO_TOKEN || '' }}";
const PUSH_ONLY_TURBO_TEAM = "${{ vars.TURBO_API && secrets.TURBO_TOKEN && vars.TURBO_TEAM || '' }}";
const PUSH_ONLY_TURBO_CACHE = "${{ vars.TURBO_API && secrets.TURBO_TOKEN && 'local:rw,remote:rw' || 'local:rw' }}";

describe("CI runner security", () => {
  it.effect(
    "keeps the legacy non-ephemeral burst launcher retired",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const burstRoot = path.join(repoRoot, "goals/speed-loop/ops/runner-burst");
      const entries = A.sort(yield* fs.readDirectory(burstRoot), Order.String);
      const readme = yield* fs.readFileString(path.join(burstRoot, "README.md"));

      assert.deepStrictEqual(entries, ["README.md", "teardown-burst-runners.sh"]);
      assert.include(readme, "The manual launch path was retired");
      assert.include(readme, "there is no break-glass launch exception");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps same-repository and fork pull requests local-only while trusted pushes retain remote writes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseDocument(workflowText);

      assert.lengthOf(workflow.errors, 0);
      assert.isUndefined(workflow.getIn(["on", "pull_request_target"]));
      assert.isDefined(workflow.getIn(["on", "pull_request"]));

      const pullRequestControlledEnvPaths: ReadonlyArray<ReadonlyArray<string | number>> = [
        ["jobs", "verify", "env"],
        ["jobs", "property-laws", "env"],
        ["jobs", "fallow-advisory", "steps", 4, "env"],
      ];

      assert.strictEqual(workflow.getIn(["jobs", "fallow-advisory", "steps", 4, "name"]), "Run Fallow envelopes");
      for (const envPath of pullRequestControlledEnvPaths) {
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_API"]), PUSH_GUARDED_TURBO_API);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_TOKEN"]), PUSH_GUARDED_TURBO_TOKEN);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_TEAM"]), PUSH_GUARDED_TURBO_TEAM);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_CACHE"]), PUSH_GUARDED_TURBO_CACHE);
      }

      assert.strictEqual(workflow.getIn(["jobs", "build", "if"]), "github.event_name == 'push'");
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_API"]), PUSH_ONLY_TURBO_API);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_TOKEN"]), PUSH_ONLY_TURBO_TOKEN);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_TEAM"]), PUSH_ONLY_TURBO_TEAM);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_CACHE"]), PUSH_ONLY_TURBO_CACHE);

      const workflowLines = Str.split(workflowText, "\n");
      assert.lengthOf(A.filter(workflowLines, Str.includes("TURBO_TOKEN:")), 4);
      assert.lengthOf(A.filter(workflowLines, Str.includes("TURBO_CACHE:")), 4);
      assert.notInclude(workflowText, "'local:rw,remote:r'");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps pull request Docgen cache access restore-only",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const workflow = parseDocument(workflowText);

      assert.lengthOf(workflow.errors, 0);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_API"]), PUSH_GUARDED_TURBO_API);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_TOKEN"]), PUSH_GUARDED_TURBO_TOKEN);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_TEAM"]), PUSH_GUARDED_TURBO_TEAM);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_CACHE"]), PUSH_GUARDED_TURBO_CACHE);
      assert.strictEqual(
        workflow.getIn(["jobs", "verify", "env", "BEEP_DOCGEN_CONCURRENCY"]),
        "${{ matrix.docgen_concurrency || 3 }}"
      );
      assert.strictEqual(
        workflow.getIn(["jobs", "verify", "strategy", "matrix", "include", 4, "docgen_concurrency"]),
        6
      );
      const restorePath = ["jobs", "verify", "steps", 5] as const;
      const savePath = ["jobs", "verify", "steps", 8] as const;

      assert.strictEqual(workflow.getIn([...restorePath, "name"]), "Restore main Docgen Turbo cache");
      assert.include(workflow.getIn([...restorePath, "if"]), "github.event_name == 'pull_request'");
      assert.strictEqual(
        workflow.getIn([...restorePath, "uses"]),
        "actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9"
      );
      assert.strictEqual(workflow.getIn([...restorePath, "with", "path"]), ".turbo/cache");
      assert.strictEqual(
        workflow.getIn([...restorePath, "with", "key"]),
        "turbo-${{ runner.os }}-docgen-main-${{ hashFiles('bun.lock') }}-${{ github.sha }}"
      );
      assert.strictEqual(
        Str.trim(String(workflow.getIn([...restorePath, "with", "restore-keys"]))),
        "turbo-${{ runner.os }}-docgen-main-${{ hashFiles('bun.lock') }}-"
      );

      assert.strictEqual(workflow.getIn([...savePath, "name"]), "Save main Docgen Turbo cache");
      assert.include(workflow.getIn([...savePath, "if"]), "github.event_name == 'push'");
      assert.strictEqual(
        workflow.getIn([...savePath, "uses"]),
        "actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9"
      );
      assert.strictEqual(workflow.getIn([...savePath, "with", "path"]), ".turbo/cache");
      assert.strictEqual(
        workflow.getIn([...savePath, "with", "key"]),
        "turbo-${{ runner.os }}-docgen-main-${{ hashFiles('bun.lock') }}-${{ github.sha }}"
      );
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "forces full Doctest runs for lane tooling changes and gates affected package inputs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));

      assert.include(workflowText, "doctest_mode=full");
      assert.include(workflowText, "^vitest\\.docs\\.ts$");
      assert.include(workflowText, "^vitest\\.shared\\.ts$");
      assert.include(workflowText, "^package\\.json$");
      assert.include(workflowText, "^bun\\.lock$");
      assert.include(workflowText, "^\\.github/workflows/heavy\\.yml$");
      assert.include(workflowText, "^packages/tooling/tool/cli/src/commands/Docgen/");
      assert.include(workflowText, "^packages/tooling/tool/cli/src/internal/jsdoc/");
      assert.include(workflowText, "^packages/tooling/tool/cli/src/commands/Ci/CiLane\\.ts$");
      assert.include(workflowText, "packages/**/src/**/*.tsx");
      assert.include(workflowText, "apps/**/src/**/*.tsx");
      assert.include(workflowText, "packages/**/package.json");
      assert.include(workflowText, "packages/**/docgen.json");
      assert.include(workflowText, "packages/**/tsconfig*.json");
      assert.include(workflowText, "apps/**/package.json");
      assert.notInclude(workflowText, "grep -l -F 'import.meta.vitest'");
      assert.notInclude(workflowText, '[[ -f "$file" ]]');
      assert.include(workflowText, "The CLI owns package-graph expansion, existence filtering,");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps the root Doctest script in one-shot mode",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const packageJson = yield* fs.readFileString(path.join(repoRoot, "package.json"));

      assert.include(packageJson, '"doctest": "vitest run --config vitest.docs.ts"');
    }, provideScopedLayer(NodeServices.layer))
  );
});
