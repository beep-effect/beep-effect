import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Order, Path } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseDocument } from "yaml";
import type { Document } from "yaml";

const SETUP_MONOREPO_ACTION = "./.github/actions/setup-monorepo-ci";

const WorkflowStep = S.Struct({
  name: S.optionalKey(S.String),
  if: S.optionalKey(S.String),
  uses: S.optionalKey(S.String),
  with: S.optionalKey(S.Record(S.String, S.Unknown)),
});
type WorkflowStep = typeof WorkflowStep.Type;
const WorkflowJobs = S.Record(S.String, S.Struct({ steps: S.optionalKey(S.Array(WorkflowStep)) }));
type WorkflowJobs = typeof WorkflowJobs.Type;
const decodeWorkflowSteps = S.decodeUnknownSync(S.Array(WorkflowStep));
const decodeWorkflowJobs = S.decodeUnknownSync(WorkflowJobs);

const workflowJobs = (document: Document): WorkflowJobs => decodeWorkflowJobs(document.toJS().jobs);

const jobSteps = (jobs: WorkflowJobs, jobId: string): ReadonlyArray<WorkflowStep> =>
  O.getOrThrowWith(
    O.flatMap(R.get(jobs, jobId), (job) => O.fromUndefinedOr(job.steps)),
    () => new Error(`Job ${jobId} declares no steps.`)
  );

const stepIndexByName = (steps: ReadonlyArray<WorkflowStep>, name: string): number =>
  O.getOrThrowWith(
    A.findFirstIndex(steps, (step) => step.name === name),
    () => new Error(`Step "${name}" is not declared.`)
  );

const stepByName = (steps: ReadonlyArray<WorkflowStep>, name: string): WorkflowStep =>
  O.getOrThrowWith(
    A.findFirst(steps, (step) => step.name === name),
    () => new Error(`Step "${name}" is not declared.`)
  );

const setupMonorepoStep = (jobs: WorkflowJobs, jobId: string): WorkflowStep =>
  O.getOrThrowWith(
    A.findFirst(jobSteps(jobs, jobId), (step) => step.uses === SETUP_MONOREPO_ACTION),
    () => new Error(`Job ${jobId} does not call ${SETUP_MONOREPO_ACTION}.`)
  );

// $GITHUB_ENV heredoc form written by scripts/ci-job-env.mjs:
//   NAME<<delimiter\n<value lines>\ndelimiter
const parseGithubEnv = (text: string): Readonly<Record<string, string>> => {
  const lines = Str.split(text, "\n");
  const entries: Array<readonly [string, string]> = [];
  let index = 0;
  while (index < lines.length) {
    const header = Str.match(/^([A-Za-z_][A-Za-z0-9_]*)<<(.+)$/u)(lines[index] ?? "");
    if (O.isNone(header)) {
      index += 1;
      continue;
    }
    const name = header.value[1] ?? "";
    const delimiter = header.value[2] ?? "";
    const valueLines: Array<string> = [];
    index += 1;
    while (index < lines.length && lines[index] !== delimiter) {
      valueLines.push(lines[index] ?? "");
      index += 1;
    }
    entries.push([name, A.join(valueLines, "\n")]);
    index += 1;
  }
  return R.fromEntries(entries);
};

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
    "routes every Turbo job's cache credentials through the single setup-monorepo-ci policy",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const heavyWorkflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const storybookText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
      const actionText = yield* fs.readFileString(path.join(repoRoot, ".github/actions/setup-monorepo-ci/action.yml"));
      const workflow = parseDocument(workflowText);
      const heavyWorkflow = parseDocument(heavyWorkflowText);
      const storybook = parseDocument(storybookText);
      const action = parseDocument(actionText);

      assert.lengthOf(workflow.errors, 0);
      assert.lengthOf(heavyWorkflow.errors, 0);
      assert.lengthOf(storybook.errors, 0);
      assert.lengthOf(action.errors, 0);
      assert.isUndefined(workflow.getIn(["on", "pull_request_target"]));
      assert.isDefined(workflow.getIn(["on", "pull_request"]));

      // No workflow hand-copies the credential tuple any more: the selection
      // lives once in scripts/ci-job-env.mjs behind the composite action.
      for (const [name, text] of [
        ["check.yml", workflowText],
        ["heavy.yml", heavyWorkflowText],
        ["storybook.yml", storybookText],
      ] as const) {
        const lines = Str.split(text, "\n");
        assert.lengthOf(A.filter(lines, Str.includes("TURBO_TOKEN:")), 0, name);
        assert.lengthOf(A.filter(lines, Str.includes("TURBO_CACHE:")), 0, name);
        assert.lengthOf(A.filter(lines, Str.includes("TURBO_API:")), 0, name);
        assert.notInclude(text, "secrets.TURBO_TOKEN", name);
        assert.notInclude(text, "secrets.TURBO_READ_TOKEN", name);
        assert.notInclude(text, "secrets.TURBO_TEAM", name);
      }
      assert.include(actionText, "run: bun scripts/ci-job-env.mjs");
      assert.include(actionText, "BEEP_CI_HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}");

      const turboJobs: ReadonlyArray<readonly [WorkflowJobs, string, boolean]> = [
        [workflowJobs(workflow), "verify", true],
        [workflowJobs(workflow), "lint-shard", true],
        [workflowJobs(workflow), "test-unit-shard", true],
        [workflowJobs(workflow), "property-laws", true],
        [workflowJobs(workflow), "fallow-advisory", false],
        [workflowJobs(workflow), "build", true],
        [workflowJobs(heavyWorkflow), "verify", true],
        [workflowJobs(storybook), "build-and-test", false],
      ];
      for (const [jobs, jobId, appSecrets] of turboJobs) {
        const setup = setupMonorepoStep(jobs, jobId);
        assert.strictEqual(setup.with?.["turbo-remote-cache"], "true", jobId);
        assert.strictEqual(setup.with?.["turbo-api"], "${{ vars.TURBO_API }}", jobId);
        assert.strictEqual(setup.with?.["turbo-team"], "${{ vars.TURBO_TEAM }}", jobId);
        assert.strictEqual(setup.with?.["repository-secrets"], "${{ toJSON(secrets) }}", jobId);
        assert.strictEqual(setup.with?.["app-secrets"], appSecrets ? "true" : undefined, jobId);
      }
      // Pull requests never publish a cache entry; only the push-only Build job saves.
      for (const [jobs, jobId] of turboJobs) {
        if (jobId === "build") continue;
        assert.strictEqual(setupMonorepoStep(jobs, jobId).with?.["cache-write"], "false", jobId);
      }
      assert.strictEqual(workflow.getIn(["jobs", "build", "if"]), "github.event_name == 'push'");
      assert.strictEqual(setupMonorepoStep(workflowJobs(workflow), "build").with?.["cache-write"], "true");

      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]');
      assert.include(heavyWorkflowText, 'if [[ "${{ matrix.id }}" == "docgen"');
      assert.include(heavyWorkflowText, "^apps/|^packages/|^infra/");
      assert.include(workflowText, "- name: Skip lane");
      // The heavy lane ids live in heavy.yml; check.yml's verify matrix keeps
      // only arms for the ids it declares.
      assert.notInclude(workflowText, "check|test-integration|coverage)");
      assert.notInclude(workflowText, "lint-policy|codegen|ecosystem)");
      assert.include(workflowText, "codegen|ecosystem)");
      // typos runs only inside Lint Policy (heavy.yml) and lefthook.
      assert.notInclude(workflowText, "typos-cli");
      assert.notInclude(workflowText, "install_typos");
      assert.include(heavyWorkflowText, "typos-cli");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "gives same-repository pull requests read-only cache access while forks and untrusted events stay local-only",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-job-env.mjs");
      const secrets = {
        TURBO_TOKEN: "write-token",
        TURBO_READ_TOKEN: "read-token",
        DATABASE_URL: "postgres://push-only",
        AUTH_SECRET: "auth-secret\nwith newline",
        UNRELATED_SECRET: "never exported",
      };
      let scenario = 0;
      const jobEnv = Effect.fnUntraced(function* (input: {
        readonly eventName: string;
        readonly headRepository: string;
        readonly turboRemoteCache: boolean;
        readonly appSecrets: boolean;
        readonly turboApi?: string;
        readonly secretsJson?: string;
      }) {
        scenario += 1;
        const outputPath = path.join(tempRoot, `job-env-${scenario}.txt`);
        yield* fs.writeFileString(outputPath, "");
        const result = Bun.spawnSync([process.execPath, scriptPath], {
          cwd: repoRoot,
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: input.eventName,
            GITHUB_REPOSITORY: "beep-effect/beep-effect",
            GITHUB_ENV: outputPath,
            BEEP_CI_HEAD_REPOSITORY: input.headRepository,
            BEEP_CI_TURBO_REMOTE_CACHE: input.turboRemoteCache ? "true" : "false",
            BEEP_CI_APP_SECRETS: input.appSecrets ? "true" : "false",
            BEEP_CI_TURBO_API: input.turboApi ?? "https://cache.example.test",
            BEEP_CI_TURBO_TEAM: "team_beep",
            BEEP_CI_SECRETS_JSON: input.secretsJson ?? JSON.stringify(secrets),
          },
          stderr: "pipe",
          stdout: "pipe",
        });
        assert.strictEqual(result.exitCode, 0, result.stderr.toString());
        const stdout = result.stdout.toString();
        assert.notInclude(stdout, "write-token");
        assert.notInclude(stdout, "read-token");
        assert.notInclude(stdout, "postgres://");
        return parseGithubEnv(yield* fs.readFileString(outputPath));
      });

      const push = yield* jobEnv({
        eventName: "push",
        headRepository: "",
        turboRemoteCache: true,
        appSecrets: true,
      });
      assert.strictEqual(push.TURBO_TOKEN, "write-token");
      assert.strictEqual(push.TURBO_CACHE, "local:rw,remote:rw");
      assert.strictEqual(push.TURBO_API, "https://cache.example.test");
      assert.strictEqual(push.TURBO_TEAM, "team_beep");
      assert.strictEqual(push.TURBO_LOG_ORDER, "stream");
      assert.strictEqual(push.DATABASE_URL, "postgres://push-only");
      assert.strictEqual(push.AUTH_SECRET, "auth-secret\nwith newline");
      assert.strictEqual(push.BETTER_AUTH_URL, "");
      assert.isUndefined(push.UNRELATED_SECRET);

      const sameRepositoryPullRequest = yield* jobEnv({
        eventName: "pull_request",
        headRepository: "beep-effect/beep-effect",
        turboRemoteCache: true,
        appSecrets: true,
      });
      assert.strictEqual(sameRepositoryPullRequest.TURBO_TOKEN, "read-token");
      assert.strictEqual(sameRepositoryPullRequest.TURBO_CACHE, "local:rw,remote:r");
      assert.strictEqual(sameRepositoryPullRequest.TURBO_API, "https://cache.example.test");
      assert.strictEqual(sameRepositoryPullRequest.DATABASE_URL, "");
      assert.strictEqual(sameRepositoryPullRequest.AUTH_SECRET, "");

      const forkPullRequest = yield* jobEnv({
        eventName: "pull_request",
        headRepository: "someone-else/beep-effect",
        turboRemoteCache: true,
        appSecrets: true,
      });
      assert.strictEqual(forkPullRequest.TURBO_TOKEN, "");
      assert.strictEqual(forkPullRequest.TURBO_API, "");
      assert.strictEqual(forkPullRequest.TURBO_TEAM, "");
      assert.strictEqual(forkPullRequest.TURBO_CACHE, "local:rw");
      assert.strictEqual(forkPullRequest.DATABASE_URL, "");

      const partialTuple = yield* jobEnv({
        eventName: "push",
        headRepository: "",
        turboRemoteCache: true,
        appSecrets: false,
        turboApi: "",
      });
      assert.strictEqual(partialTuple.TURBO_TOKEN, "");
      assert.strictEqual(partialTuple.TURBO_CACHE, "local:rw");
      assert.isUndefined(partialTuple.DATABASE_URL);

      const turboOnly = yield* jobEnv({
        eventName: "push",
        headRepository: "",
        turboRemoteCache: true,
        appSecrets: false,
      });
      assert.strictEqual(turboOnly.TURBO_TOKEN, "write-token");
      assert.isUndefined(turboOnly.DATABASE_URL);

      const emptySecrets = yield* jobEnv({
        eventName: "push",
        headRepository: "",
        turboRemoteCache: true,
        appSecrets: true,
        secretsJson: "",
      });
      assert.strictEqual(emptySecrets.TURBO_CACHE, "local:rw");
      assert.strictEqual(emptySecrets.DATABASE_URL, "");
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
      const actionSteps = decodeWorkflowSteps(action.toJS().runs.steps);
      const turboRestore = stepByName(actionSteps, "Restore Turbo cache (local fallback only)");
      assert.strictEqual(
        Str.trim(String(turboRestore.with?.["restore-keys"])),
        "turbo-${{ runner.os }}-${{ startsWith(runner.name, 'beep-ci-') && 'fleet' || 'shared' }}-${{ github.job }}${{ inputs.turbo-cache-key-suffix }}-"
      );
      // The credential export precedes the Turbo restore so the local fallback
      // keys on the exported TURBO_TOKEN / TURBO_TEAM.
      assert.isBelow(
        stepIndexByName(actionSteps, "Export job environment"),
        stepIndexByName(actionSteps, "Restore Turbo cache (local fallback only)")
      );
      assert.isBelow(
        stepIndexByName(actionSteps, "Free runner disk"),
        stepIndexByName(actionSteps, "Install dependencies")
      );

      const checkJobs = workflowJobs(check);
      const heavyJobs = workflowJobs(heavy);
      assert.strictEqual(setupMonorepoStep(checkJobs, "verify").with?.["turbo-cache-key-suffix"], "-${{ matrix.id }}");
      assert.strictEqual(
        setupMonorepoStep(checkJobs, "lint-shard").with?.["turbo-cache-key-suffix"],
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(
        setupMonorepoStep(checkJobs, "test-unit-shard").with?.["turbo-cache-key-suffix"],
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(setupMonorepoStep(heavyJobs, "verify").with?.["turbo-cache-key-suffix"], "-${{ matrix.id }}");
      assert.include(
        String(stepByName(jobSteps(checkJobs, "verify"), "Save post-lane Turbo fallback").with?.key),
        "-${{ github.job }}-${{ matrix.id }}-"
      );
      assert.include(
        String(stepByName(jobSteps(checkJobs, "lint-shard"), "Save post-lane Turbo fallback").with?.key),
        "-${{ github.job }}-${{ matrix.partition }}-"
      );
      assert.include(
        String(stepByName(jobSteps(checkJobs, "test-unit-shard"), "Save post-lane Turbo fallback").with?.key),
        "-${{ github.job }}-${{ matrix.partition }}-"
      );
      assert.include(
        String(stepByName(jobSteps(heavyJobs, "verify"), "Save post-lane Turbo fallback").with?.key),
        "-${{ github.job }}-${{ matrix.id }}-"
      );
      // Disk cleanup is the composite action's job now; the shards keep the
      // 64 GiB short-circuit and the matrix lanes always clean.
      assert.notInclude(checkText, "Free runner disk");
      assert.notInclude(heavyText, "Free runner disk");
      assert.strictEqual(setupMonorepoStep(checkJobs, "verify").with?.["free-disk"], "true");
      assert.strictEqual(setupMonorepoStep(checkJobs, "lint-shard").with?.["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoStep(checkJobs, "test-unit-shard").with?.["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoStep(checkJobs, "fallow-advisory").with?.["free-disk"], "true");
      assert.strictEqual(setupMonorepoStep(heavyJobs, "verify").with?.["free-disk"], "true");
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
      const jobs = workflowJobs(workflow);
      const setup = setupMonorepoStep(jobs, "verify");
      assert.strictEqual(setup.with?.["turbo-remote-cache"], "true");
      assert.strictEqual(setup.with?.["cache-write"], "false");
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
      const steps = jobSteps(jobs, "verify");
      const restore = stepByName(steps, "Restore main Docgen Turbo cache");
      const save = stepByName(steps, "Save main Docgen Turbo cache");

      assert.include(restore.if, "github.event_name == 'pull_request'");
      assert.strictEqual(restore.uses, "actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
      assert.strictEqual(restore.with?.path, ".turbo/cache");
      assert.strictEqual(
        restore.with?.key,
        "turbo-${{ runner.os }}-docgen-main-${{ hashFiles('bun.lock') }}-${{ github.sha }}"
      );
      assert.strictEqual(
        Str.trim(String(restore.with?.["restore-keys"])),
        "turbo-${{ runner.os }}-docgen-main-${{ hashFiles('bun.lock') }}-"
      );

      assert.include(save.if, "github.event_name == 'push'");
      assert.strictEqual(save.uses, "actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
      assert.strictEqual(save.with?.path, ".turbo/cache");
      assert.strictEqual(
        save.with?.key,
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
