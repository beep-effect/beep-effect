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
});
