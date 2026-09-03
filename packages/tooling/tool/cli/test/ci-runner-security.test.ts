import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Order, Path } from "effect";
import * as Str from "effect/String";
import { parseDocument } from "yaml";

const PUSH_OR_SAME_REPO_READ_TURBO_API =
  "${{ github.event_name == 'push' && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && vars.TURBO_API || github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_READ_TOKEN && vars.TURBO_API || '' }}";
const PUSH_OR_SAME_REPO_READ_TURBO_TOKEN =
  "${{ github.event_name == 'push' && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN || github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_READ_TOKEN || '' }}";
const PUSH_OR_SAME_REPO_READ_TURBO_TEAM =
  "${{ github.event_name == 'push' && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && vars.TURBO_TEAM || github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_READ_TOKEN && vars.TURBO_TEAM || '' }}";
const PUSH_OR_SAME_REPO_READ_TURBO_CACHE =
  "${{ github.event_name == 'push' && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && 'local:rw,remote:rw' || github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_READ_TOKEN && 'local:rw,remote:r' || 'local:rw' }}";

const PUSH_ONLY_TURBO_API = "${{ vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && vars.TURBO_API || '' }}";
const PUSH_ONLY_TURBO_TOKEN = "${{ vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN || '' }}";
const PUSH_ONLY_TURBO_TEAM = "${{ vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && vars.TURBO_TEAM || '' }}";
const PUSH_ONLY_TURBO_CACHE =
  "${{ vars.TURBO_API && vars.TURBO_TEAM && secrets.TURBO_TOKEN && 'local:rw,remote:rw' || 'local:rw' }}";

describe("CI runner security", () => {
  it.effect(
    "classifies goals-only pull requests without suppressing mixed or push runs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-change-profile.sh");

      const git = (args: ReadonlyArray<string>): string => {
        const result = Bun.spawnSync(["git", ...args], {
          cwd: tempRoot,
          stderr: "pipe",
          stdout: "pipe",
        });
        assert.strictEqual(result.exitCode, 0, result.stderr.toString());
        return Str.trim(result.stdout.toString());
      };
      const profile = (eventName: string, outputPath = ""): string => {
        const result = Bun.spawnSync([scriptPath, "origin/main"], {
          cwd: tempRoot,
          env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_OUTPUT: outputPath },
          stderr: "pipe",
          stdout: "pipe",
        });
        assert.strictEqual(result.exitCode, 0, result.stderr.toString());
        return Str.trim(result.stdout.toString());
      };

      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example"), { recursive: true });
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# baseline\n");
      git(["add", "."]);
      git(["commit", "-m", "baseline"]);
      git(["update-ref", "refs/remotes/origin/main", git(["rev-parse", "HEAD"])]);

      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# goals-only\n");
      git(["add", "."]);
      git(["commit", "-m", "goals-only"]);
      const outputPath = path.join(tempRoot, "profile-output.txt");
      assert.strictEqual(profile("pull_request", outputPath), "goals_only=true");
      assert.strictEqual(Str.trim(yield* fs.readFileString(outputPath)), "goals_only=true");
      yield* fs.remove(outputPath);

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "ops"));
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "ops", "manifest.json"), "{}\n");
      git(["add", "."]);
      git(["commit", "-m", "goal metadata"]);
      assert.strictEqual(profile("pull_request"), "goals_only=true");
      const metadataHead = git(["rev-parse", "HEAD"]);

      for (const directory of ["docs", "designs", "history", "research"] as const) {
        git(["reset", "--hard", metadataHead]);
        yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", directory, "fixtures"), { recursive: true });
        yield* fs.writeFileString(
          path.join(tempRoot, "goals", "example", directory, "fixtures", "expected.md"),
          "# Executable test fixture\n"
        );
        git(["add", "."]);
        git(["commit", "-m", `nested ${directory} markdown fixture`]);
        assert.strictEqual(profile("pull_request"), "goals_only=false");
      }

      git(["reset", "--hard", metadataHead]);

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "fixtures"));
      yield* fs.writeFileString(
        path.join(tempRoot, "goals", "example", "fixtures", "expected.md"),
        "# Executable test fixture\n"
      );
      git(["add", "."]);
      git(["commit", "-m", "goal markdown fixture"]);
      assert.strictEqual(profile("pull_request"), "goals_only=false");

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "scripts"));
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "scripts", "verify.sh"), "exit 0\n");
      git(["add", "."]);
      git(["commit", "-m", "goal executable"]);
      assert.strictEqual(profile("pull_request"), "goals_only=false");

      yield* fs.makeDirectory(path.join(tempRoot, "src"));
      yield* fs.writeFileString(path.join(tempRoot, "src", "index.ts"), "export {}\n");
      git(["add", "."]);
      git(["commit", "-m", "mixed"]);
      assert.strictEqual(profile("pull_request"), "goals_only=false");
      assert.strictEqual(profile("push"), "goals_only=false");
    }, provideScopedLayer(NodeServices.layer))
  );

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
    "gives same-repository pull requests read-only cache access while forks stay local-only",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseDocument(workflowText);
      const heavyWorkflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const storybookText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
      const storybook = parseDocument(storybookText);

      assert.lengthOf(workflow.errors, 0);
      assert.lengthOf(storybook.errors, 0);
      assert.isUndefined(workflow.getIn(["on", "pull_request_target"]));
      assert.isDefined(workflow.getIn(["on", "pull_request"]));

      const pullRequestControlledEnvPaths: ReadonlyArray<ReadonlyArray<string | number>> = [
        ["jobs", "verify", "env"],
        ["jobs", "lint-shard", "env"],
        ["jobs", "test-unit-shard", "env"],
        ["jobs", "property-laws", "env"],
        ["jobs", "fallow-advisory", "steps", 4, "env"],
      ];

      assert.strictEqual(workflow.getIn(["jobs", "fallow-advisory", "steps", 4, "name"]), "Run Fallow envelopes");
      for (const envPath of pullRequestControlledEnvPaths) {
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_API"]), PUSH_OR_SAME_REPO_READ_TURBO_API);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_TOKEN"]), PUSH_OR_SAME_REPO_READ_TURBO_TOKEN);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_TEAM"]), PUSH_OR_SAME_REPO_READ_TURBO_TEAM);
        assert.strictEqual(workflow.getIn([...envPath, "TURBO_CACHE"]), PUSH_OR_SAME_REPO_READ_TURBO_CACHE);
      }

      assert.strictEqual(workflow.getIn(["jobs", "build", "if"]), "github.event_name == 'push'");
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_API"]), PUSH_ONLY_TURBO_API);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_TOKEN"]), PUSH_ONLY_TURBO_TOKEN);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_TEAM"]), PUSH_ONLY_TURBO_TEAM);
      assert.strictEqual(workflow.getIn(["jobs", "build", "env", "TURBO_CACHE"]), PUSH_ONLY_TURBO_CACHE);

      const workflowLines = Str.split(workflowText, "\n");
      assert.lengthOf(A.filter(workflowLines, Str.includes("TURBO_TOKEN:")), 6);
      assert.lengthOf(A.filter(workflowLines, Str.includes("TURBO_CACHE:")), 6);
      assert.include(workflowText, "github.event.pull_request.head.repo.full_name == github.repository");
      assert.include(workflowText, "secrets.TURBO_READ_TOKEN");
      assert.include(workflowText, "'local:rw,remote:r'");
      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]');
      assert.include(heavyWorkflowText, 'if [[ "${{ matrix.id }}" == "docgen"');
      assert.include(heavyWorkflowText, "^apps/|^packages/|^infra/");
      assert.include(workflowText, "- name: Skip lane");
      assert.strictEqual(
        storybook.getIn(["jobs", "build-and-test", "env", "TURBO_API"]),
        PUSH_OR_SAME_REPO_READ_TURBO_API
      );
      assert.strictEqual(
        storybook.getIn(["jobs", "build-and-test", "env", "TURBO_TOKEN"]),
        PUSH_OR_SAME_REPO_READ_TURBO_TOKEN
      );
      assert.strictEqual(
        storybook.getIn(["jobs", "build-and-test", "env", "TURBO_TEAM"]),
        PUSH_OR_SAME_REPO_READ_TURBO_TEAM
      );
      assert.strictEqual(
        storybook.getIn(["jobs", "build-and-test", "env", "TURBO_CACHE"]),
        PUSH_OR_SAME_REPO_READ_TURBO_CACHE
      );
      assert.notInclude(storybookText, "secrets.TURBO_TEAM");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "isolates local fallback caches for matrix lanes sharing a job id",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const actionText = yield* fs.readFileString(path.join(repoRoot, ".github/actions/setup-monorepo-ci/action.yml"));
      const checkText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const heavyText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const action = parseDocument(actionText);
      const check = parseDocument(checkText);
      const heavy = parseDocument(heavyText);

      assert.lengthOf(action.errors, 0);
      assert.lengthOf(check.errors, 0);
      assert.lengthOf(heavy.errors, 0);
      assert.strictEqual(action.getIn(["inputs", "turbo-cache-key-suffix", "default"]), "");
      assert.include(actionText, "${{ github.job }}${{ inputs.turbo-cache-key-suffix }}-");
      assert.strictEqual(
        Str.trim(String(action.getIn(["runs", "steps", 5, "with", "restore-keys"]))),
        "turbo-${{ runner.os }}-${{ startsWith(runner.name, 'beep-ci-') && 'fleet' || 'shared' }}-${{ github.job }}${{ inputs.turbo-cache-key-suffix }}-"
      );
      assert.strictEqual(
        check.getIn(["jobs", "verify", "steps", 4, "with", "turbo-cache-key-suffix"]),
        "-${{ matrix.id }}"
      );
      assert.strictEqual(
        check.getIn(["jobs", "lint-shard", "steps", 4, "with", "turbo-cache-key-suffix"]),
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(
        check.getIn(["jobs", "test-unit-shard", "steps", 4, "with", "turbo-cache-key-suffix"]),
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(
        heavy.getIn(["jobs", "verify", "steps", 4, "with", "turbo-cache-key-suffix"]),
        "-${{ matrix.id }}"
      );
      assert.include(
        String(check.getIn(["jobs", "verify", "steps", 9, "with", "key"])),
        "-${{ github.job }}-${{ matrix.id }}-"
      );
      assert.include(
        String(check.getIn(["jobs", "lint-shard", "steps", 8, "with", "key"])),
        "-${{ github.job }}-${{ matrix.partition }}-"
      );
      assert.include(
        String(check.getIn(["jobs", "test-unit-shard", "steps", 7, "with", "key"])),
        "-${{ github.job }}-${{ matrix.partition }}-"
      );
      assert.include(
        String(heavy.getIn(["jobs", "verify", "steps", 10, "with", "key"])),
        "-${{ github.job }}-${{ matrix.id }}-"
      );
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
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_API"]), PUSH_OR_SAME_REPO_READ_TURBO_API);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_TOKEN"]), PUSH_OR_SAME_REPO_READ_TURBO_TOKEN);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_TEAM"]), PUSH_OR_SAME_REPO_READ_TURBO_TEAM);
      assert.strictEqual(workflow.getIn(["jobs", "verify", "env", "TURBO_CACHE"]), PUSH_OR_SAME_REPO_READ_TURBO_CACHE);
      assert.strictEqual(
        workflow.getIn(["jobs", "verify", "env", "BEEP_DOCGEN_CONCURRENCY"]),
        "${{ matrix.docgen_concurrency || 3 }}"
      );
      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]');
      assert.include(workflowText, "- name: Skip lane");
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
