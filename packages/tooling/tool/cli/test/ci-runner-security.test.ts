import * as NodeURL from "node:url";
import {
  CI_LANE_DESCRIPTORS,
  CiOperationalPatterns,
  ciOperationalPatterns,
  isHeavyDocsOnlyPath,
  workflowJobContexts,
  workflowPolicyDiagnostics,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

const SETUP_MONOREPO_ACTION = "./.github/actions/setup-monorepo-ci";

// Explicit secret inputs of setup-monorepo-ci: the Turbo tokens plus the
// application secret block packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts allowlists. The script,
// the action's inputs, and every calling job carry the same names; the
// credential-policy assertions pin the three copies together.
const TURBO_SECRET_INPUTS: ReadonlyArray<readonly [string, string]> = [
  ["turbo-token", "TURBO_TOKEN"],
  ["turbo-read-token", "TURBO_READ_TOKEN"],
];
const APP_SECRET_INPUTS: ReadonlyArray<readonly [string, string]> = [
  ["database-url", "DATABASE_URL"],
  ["database-url-unpooled", "DATABASE_URL_UNPOOLED"],
  ["email-resend-api-key", "EMAIL_RESEND_API_KEY"],
  ["auth-secret", "AUTH_SECRET"],
  ["better-auth-secret", "BETTER_AUTH_SECRET"],
  ["better-auth-url", "BETTER_AUTH_URL"],
  ["security-trusted-origins", "SECURITY_TRUSTED_ORIGINS"],
  ["liveblocks-secret-key", "LIVEBLOCKS_SECRET_KEY"],
];
const SECRET_INPUTS: ReadonlyArray<readonly [string, string]> = [...TURBO_SECRET_INPUTS, ...APP_SECRET_INPUTS];
// The read-only Turbo token is the only secret a same-repository pull request
// may receive; the write token and every application secret are gated to
// push events in the workflow expression itself, so PR-controlled code never
// sees them even before the policy script runs.
const secretReference = (name: string): string =>
  name === "TURBO_READ_TOKEN"
    ? `\${{ secrets.${name} }}`
    : `\${{ github.event_name == 'push' && secrets.${name} || '' }}`;
const secretInputLine = ([input, name]: readonly [string, string]): string => `${input}: ${secretReference(name)}`;
const MATRIX_WRITE_TOKEN =
  "${{ github.event_name == 'push' && matrix.uses_turbo == 'true' && secrets.TURBO_TOKEN || '' }}";
const SECRET_INPUT_LINES = [...A.map(SECRET_INPUTS, secretInputLine), `turbo-token: ${MATRIX_WRITE_TOKEN}`];
const SECRET_REFERENCES = A.map(SECRET_INPUTS, ([, name]) => `secrets.${name}`);

const WorkflowStep = S.Struct({
  name: S.optionalKey(S.String),
  if: S.optionalKey(S.String),
  run: S.optionalKey(S.String),
  uses: S.optionalKey(S.String),
  with: S.optionalKey(S.Record(S.String, S.Unknown)),
  env: S.optionalKey(S.Record(S.String, S.Unknown)),
});
type WorkflowStep = typeof WorkflowStep.Type;
const WorkflowJobs = S.Record(
  S.String,
  S.Struct({
    permissions: S.optionalKey(S.Record(S.String, S.String)),
    steps: WorkflowStep.pipe(S.Array, S.optionalKey),
  })
);
type WorkflowJobs = typeof WorkflowJobs.Type;
const decodeWorkflowSteps = S.decodeUnknownEffect(S.Array(WorkflowStep));
const decodeWorkflowJobs = S.decodeUnknownEffect(WorkflowJobs);
const decodeInspectionPolicy = S.decodeUnknownEffect(
  S.Struct({ permissions: S.Record(S.String, S.String), on: S.Record(S.String, S.Unknown) })
);
const encodeJobsFixture = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeYamlRecord = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));
const decodeYamlRecords = S.decodeUnknownEffect(S.Array(S.Record(S.String, S.Unknown)));

const workflowJobs = Effect.fnUntraced(function* (document: unknown) {
  return yield* decodeWorkflowJobs(yamlAt(document, ["jobs"]));
});

// The heavy verify job's matrix lanes; each dispatches one `beep ci lane`.
const heavyMatrixLanes = (document: unknown) =>
  decodeYamlRecords(yamlAt(document, ["jobs", "verify", "strategy", "matrix", "include"]));

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

const stepRun = (steps: ReadonlyArray<WorkflowStep>, name: string): string =>
  O.getOrThrowWith(
    O.fromUndefinedOr(stepByName(steps, name).run),
    () => new Error(`Step "${name}" declares no run script.`)
  );

// Third-party apt sources on the hosted ubuntu-24.04 image (Google Chrome,
// Microsoft) fail `apt-get update` for minutes at a time ("Hash Sum mismatch",
// "403 Forbidden"); every lane that touches apt keeps only the Ubuntu archive
// first, through the shared prune script.
const PRUNE_APT_SOURCES = "scripts/ci-prune-apt-sources.sh";
const assertPrunesAptSourcesBefore = (run: string, command: string): void => {
  assert.include(run, `\n${PRUNE_APT_SOURCES}\n`);
  assert.include(run, command);
  assert.isBelow(
    O.getOrElse(Str.indexOf(PRUNE_APT_SOURCES)(run), constant(-1)),
    O.getOrElse(Str.indexOf(command)(run), constant(-1))
  );
};

const setupMonorepoStep = (jobs: WorkflowJobs, jobId: string): WorkflowStep =>
  O.getOrThrowWith(
    A.findFirst(jobSteps(jobs, jobId), (step) => step.uses === SETUP_MONOREPO_ACTION),
    () => new Error(`Job ${jobId} does not call ${SETUP_MONOREPO_ACTION}.`)
  );

const stepInputs = (step: WorkflowStep): Readonly<Record<string, unknown>> => step.with ?? {};

const stepEnvironment = (step: WorkflowStep): Readonly<Record<string, unknown>> => step.env ?? {};

const setupMonorepoInputs = (jobs: WorkflowJobs, jobId: string): Readonly<Record<string, unknown>> =>
  stepInputs(setupMonorepoStep(jobs, jobId));

// Every step that saves an Actions cache, as `job/step` labels.
const cacheSaveSteps = (jobs: WorkflowJobs): ReadonlyArray<string> =>
  A.flatMap(R.toEntries(jobs), ([jobId, job]) =>
    pipe(
      job.steps ?? [],
      A.filter((step) =>
        A.some(["actions/cache@", "actions/cache/save@"], (prefix) => Str.startsWith(prefix)(step.uses ?? ""))
      ),
      A.map((step) => `${jobId}/${step.name ?? ""}`)
    )
  );

// $GITHUB_ENV heredoc form written by packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts:
//   NAME<<delimiter\n<value lines>\ndelimiter
// The back-reference closes each block on its own delimiter line, so a value
// keeps every line shape (including empty) short of the delimiter itself.
const githubEnvBlock = /^([A-Za-z_][A-Za-z0-9_]*)<<(.+)\n([\s\S]*?)\n\2$/gmu;
const parseGithubEnv = (text: string): Readonly<Record<string, string>> =>
  pipe(
    Str.matchAll(githubEnvBlock)(text),
    A.fromIterable,
    A.map((block) => [block[1] ?? "", block[3] ?? ""] as const),
    R.fromEntries
  );

const parseProfileOutput = (text: string): Readonly<Record<string, string>> =>
  pipe(
    Str.split(text, "\n"),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.map((line) => {
      const separator = Str.indexOf("=")(line);
      return O.match(separator, {
        onNone: () => [line, ""] as const,
        onSome: (index) => [Str.slice(0, index)(line), Str.slice(index + 1)(line)] as const,
      });
    }),
    R.fromEntries
  );

const gitIn =
  (cwd: string) =>
  (args: ReadonlyArray<string>): string => {
    const result = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
    assert.strictEqual(result.exitCode, 0, result.stderr.toString());
    return Str.trim(result.stdout.toString());
  };

const changeProfile = (
  scriptPath: string,
  cwd: string,
  eventName: string,
  outputPath = ""
): Readonly<Record<string, string>> => {
  const result = Bun.spawnSync([scriptPath, "origin/main"], {
    cwd,
    env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_OUTPUT: outputPath },
    stderr: "pipe",
    stdout: "pipe",
  });
  assert.strictEqual(result.exitCode, 0, result.stderr.toString());
  return parseProfileOutput(result.stdout.toString());
};

// The workflow and action sources the credential-policy cases judge together,
// read and parsed once per case so each one sees the same documents.
const readCredentialPolicySources = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const readText = (relative: string) => fs.readFileString(path.join(repoRoot, relative));
  const workflowText = yield* readText(".github/workflows/check.yml");
  const heavyWorkflowText = yield* readText(".github/workflows/heavy.yml");
  const storybookText = yield* readText(".github/workflows/storybook.yml");
  const actionText = yield* readText(".github/actions/setup-monorepo-ci/action.yml");
  const jobEnvScriptText = yield* readText("packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts");

  return {
    workflowText,
    heavyWorkflowText,
    storybookText,
    actionText,
    jobEnvScriptText,
    workflow: parseWorkflowYaml(workflowText),
    heavyWorkflow: parseWorkflowYaml(heavyWorkflowText),
    storybook: parseWorkflowYaml(storybookText),
    action: parseWorkflowYaml(actionText),
  };
});

// A workflow that hands secrets only through the composite action's explicit
// inputs: no inline Turbo tuple, no secret inventory, and every remaining
// secret reference on an allowlisted input line.
const assertNoInlineCredentialTuple = (name: string, text: string): void => {
  const lines = Str.split(text, "\n");
  assert.lengthOf(A.filter(lines, Str.includes("TURBO_TOKEN:")), 0, name);
  assert.lengthOf(A.filter(lines, Str.includes("TURBO_CACHE:")), 0, name);
  assert.lengthOf(A.filter(lines, Str.includes("TURBO_API:")), 0, name);
  assert.notInclude(text, "toJSON(secrets)", name);
  assert.notInclude(text, "repository-secrets", name);
  assert.notInclude(text, "secrets.TURBO_TEAM", name);
  const secretLines = A.filter(lines, (line) =>
    A.some(SECRET_REFERENCES, (reference) => Str.includes(reference)(line))
  );
  for (const line of secretLines) {
    assert.include(SECRET_INPUT_LINES, Str.trim(line), `${name}: ${Str.trim(line)}`);
  }
};

// Every Turbo-backed job and whether it may receive the application secret block.
const turboJobTable = Effect.fnUntraced(function* (documents: {
  readonly workflow: unknown;
  readonly heavyWorkflow: unknown;
  readonly storybook: unknown;
}) {
  const check = yield* workflowJobs(documents.workflow);

  return [
    [check, "labs", true],
    [check, "lint-shard", true],
    [check, "test-unit-shard", true],
    [check, "property-laws", true],
    [check, "fallow-advisory", false],
    [yield* workflowJobs(documents.heavyWorkflow), "verify", true],
    [yield* workflowJobs(documents.storybook), "storybook", false],
  ] satisfies ReadonlyArray<readonly [WorkflowJobs, string, boolean]>;
});

// One Turbo job's setup-monorepo-ci call: the remote-cache tuple comes from
// repository variables, the Turbo tokens from their explicit inputs, and the
// application secrets only where the job is allowed them.
const assertTurboJobSetup = (jobs: WorkflowJobs, jobId: string, appSecrets: boolean): void => {
  const inputs = setupMonorepoInputs(jobs, jobId);
  assert.strictEqual(inputs["turbo-remote-cache"], jobId === "verify" ? "${{ matrix.uses_turbo }}" : "true", jobId);
  assert.strictEqual(inputs["turbo-api"], "${{ vars.TURBO_API }}", jobId);
  assert.strictEqual(inputs["turbo-team"], "${{ vars.TURBO_TEAM }}", jobId);
  assert.isUndefined(inputs["repository-secrets"], jobId);
  assert.strictEqual(
    inputs["turbo-token"],
    jobId === "verify" ? MATRIX_WRITE_TOKEN : secretReference("TURBO_TOKEN"),
    `${jobId} turbo-token`
  );
  assert.strictEqual(inputs["turbo-read-token"], secretReference("TURBO_READ_TOKEN"), `${jobId} turbo-read-token`);
  for (const [input, name] of APP_SECRET_INPUTS) {
    assert.strictEqual(inputs[input], appSecrets ? secretReference(name) : undefined, `${jobId} ${input}`);
  }
  assert.strictEqual(inputs["app-secrets"], appSecrets ? "true" : undefined, jobId);
};

it.layer(NodeServices.layer, { timeout: "30 seconds" })("CI runner security", (it) => {
  it.effect.prop(
    "preserves arbitrary workflow permissions and step inputs through their codec",
    [Arbitrary.schema(WorkflowJobs)],
    Effect.fnUntraced(function* ([jobs]) {
      const encoded = yield* S.encodeEffect(WorkflowJobs)(jobs);
      const decoded = yield* decodeWorkflowJobs(encoded);
      assertTrue(S.toEquivalence(WorkflowJobs)(jobs, decoded));
    }),
    { arbitrary: { runs: 25 } }
  );
  it.effect.prop(
    "round-trips arbitrary operational patterns through the pre-runtime JSON codec",
    [Arbitrary.schema(CiOperationalPatterns)],
    Effect.fnUntraced(function* ([patterns]) {
      const encoded = yield* S.encodeEffect(OperationalPatternsJson)(patterns);
      const decoded = yield* S.decodeEffect(OperationalPatternsJson)(encoded);
      assertTrue(S.toEquivalence(CiOperationalPatterns)(patterns, decoded));
    }),
    { arbitrary: { runs: 25 } }
  );
  it.effect(
    "keeps the pre-runtime pattern projection synchronized with its schema owner",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const projection = yield* fs.readFileString(
        path.join(root, "packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json")
      );
      const decoded = yield* S.decodeEffect(OperationalPatternsJson)(projection);
      assert.deepEqual(decoded, ciOperationalPatterns);
      for (const file of ["README.md", "nested/note.md", "docs/runbooks/ci.md", "goals/demo/PLAN.md"]) {
        assert.isTrue(isHeavyDocsOnlyPath(file), file);
      }
      for (const file of ["packages/demo/README.md", "apps/demo/README.md", "infra/demo/README.md"]) {
        assert.isFalse(isHeavyDocsOnlyPath(file), file);
      }
    })
  );
  it.effect(
    "scopes hosted governance reads to Security and exercises its job token on pull requests",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const jobs = yield* workflowJobs(
        parseWorkflowYaml(yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml")))
      );
      expect(jobs.verify?.permissions).toEqual({ contents: "read" });
      expect(jobs.security?.permissions).toEqual({ contents: "read", actions: "read" });
      const securitySteps = jobSteps(jobs, "security");
      const hosted = stepByName(securitySteps, "Check hosted settings policy");
      expect(hosted.env).toEqual({ GH_TOKEN: "${{ github.token }}" });
      expect(hosted.if).toBeUndefined();
      expect(hosted.run).toContain("bun run beep ci ruleset --check");
      expect(hosted.run).toContain("bun run beep ci settings --check");
      expect(hosted.run).toContain("bun run beep ci held-group");
      assert.isAbove(
        stepIndexByName(securitySteps, "Check hosted settings policy"),
        stepIndexByName(securitySteps, "Dependency review")
      );
      const localPolicy = stepByName(jobSteps(jobs, "verify"), "Check workflow policy");
      expect(localPolicy.env).toBeUndefined();
      expect(localPolicy.run).toBe("bun run beep ci workflow-lint");
    })
  );

  // #1882: the dependency review runs PR code on every pull request, forks
  // included, so it may only ever hold the read-only job token. `pull_request`
  // (never `pull_request_target`) is what keeps fork tokens read-only and
  // secrets out of fork runs.
  it.effect(
    "runs the manifest-aware dependency review on every pull request with only a read token",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflow = parseWorkflowYaml(yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml")));
      const triggers = R.keys(yield* decodeYamlRecord(yamlAt(workflow, ["on"])));
      expect(triggers).toContain("pull_request");
      expect(triggers).not.toContain("pull_request_target");
      expect(yamlAt(workflow, ["permissions"])).toEqual({ contents: "read" });
      expect(yamlAt(workflow, ["jobs", "security", "name"])).toBe("Security");
      expect(yamlAt(workflow, ["jobs", "security", "if"])).toBeUndefined();
      const jobs = yield* workflowJobs(workflow);
      expect(jobs.security?.permissions).toEqual({ contents: "read", actions: "read" });
      const review = stepByName(jobSteps(jobs, "security"), "Dependency review");
      expect(review.if).toBe("github.event_name == 'pull_request'");
      expect(review.uses).toBeUndefined();
      expect(review.with).toBeUndefined();
      expect(review.env).toEqual({
        GH_TOKEN: "${{ github.token }}",
        GH_REPO: "${{ github.repository }}",
        BASE_SHA: "${{ github.event.pull_request.base.sha }}",
        HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
      });
      expect(review.run).toBe('bun run beep ci dependency-review --base "$BASE_SHA" --head "$HEAD_SHA"');
      const checkout = stepByName(jobSteps(jobs, "security"), "Checkout repository");
      expect(stepInputs(checkout)["persist-credentials"]).toBe(false);
      const text = S.decodeUnknownOption(S.String);
      assertTrue(
        A.every(jobSteps(jobs, "security"), (step) =>
          A.every(
            [...R.values(stepInputs(step)), ...R.values(stepEnvironment(step)), step.run],
            (value) => !O.exists(text(value), Str.includes("secrets."))
          )
        )
      );
    })
  );

  it.effect(
    "preserves the requested PR lane when an older checkout has no resource helper",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const workflow = parseWorkflowYaml(yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml")));
      const run = pipe(
        stepRun(jobSteps(yield* workflowJobs(workflow), "verify"), "Run verification lane"),
        Str.replaceAll("${{ matrix.id }}", "check")
      );
      const fakeBun = path.join(tempRoot, "bun");
      yield* fs.writeFileString(fakeBun, '#!/usr/bin/env bash\nprintf "<%s>\\n" "$@"\nexit 7\n');
      yield* fs.chmod(fakeBun, 0o755);
      const result = Bun.spawnSync(["bash", "-c", run], {
        cwd: tempRoot,
        env: {
          ...process.env,
          PATH: `${tempRoot}:${ambientPath}`,
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_BASE_REF: "main",
        },
        stderr: "pipe",
        stdout: "pipe",
      });
      assert.strictEqual(result.exitCode, 7);
      assert.include(result.stdout.toString(), "Runner resource helper unavailable");
      assert.include(
        result.stdout.toString(),
        "<run>\n<beep>\n<ci>\n<lane>\n<check>\n<--affected>\n<--base>\n<origin/main>\n<--summarize>\n"
      );
    })
  );

  it.effect(
    "runs the lane once when the measurement CLI cannot boot",
    Effect.fnUntraced(function* () {
      const ambientPath = yield* Config.String("PATH");
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const temp = yield* fs.makeTempDirectoryScoped();
      const fakeBun = path.join(temp, "bun");
      const receipt = path.join(temp, "lane-runs");
      yield* fs.writeFileString(fakeBun, "#!/usr/bin/env bash\nexit 42\n");
      yield* fs.chmod(fakeBun, 0o755);
      const result = Bun.spawnSync(
        [
          "bash",
          path.join(root, "scripts/ci-runner-resources.sh"),
          "check",
          "bash",
          "-c",
          'printf run >> "$1"; exit 7',
          "fixture",
          receipt,
        ],
        { env: { ...process.env, PATH: `${temp}:${ambientPath}` }, stderr: "pipe", stdout: "pipe" }
      );
      assert.strictEqual(result.exitCode, 7);
      assert.strictEqual(yield* fs.readFileString(receipt), "run");
      assert.include(result.stderr.toString(), "resource measurement unavailable");
    })
  );

  it.effect(
    "does not rerun a lane that fails after the measurement CLI starts it",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const temp = yield* fs.makeTempDirectoryScoped();
      const receipt = path.join(temp, "lane-runs");
      const result = Bun.spawnSync(
        [
          "bash",
          path.join(root, "scripts/ci-runner-resources.sh"),
          "check",
          "bash",
          "-c",
          'printf run >> "$1"; exit 7',
          "fixture",
          receipt,
        ],
        { env: { ...process.env, RUNNER_TEMP: temp }, stderr: "pipe", stdout: "pipe" }
      );
      assert.strictEqual(result.exitCode, 7);
      assert.strictEqual(yield* fs.readFileString(receipt), "run");
    })
  );

  it.effect(
    "preserves lane failure while emitting resource evidence without command arguments",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const summaryPath = path.join(tempRoot, "summary.md");
      const result = Bun.spawnSync(
        [
          "bash",
          path.join(repoRoot, "scripts/ci-runner-resources.sh"),
          "check",
          "bash",
          "-c",
          "exit 7",
          "private-argument",
        ],
        {
          env: { ...process.env, RUNNER_TEMP: tempRoot, GITHUB_STEP_SUMMARY: summaryPath },
          stderr: "pipe",
          stdout: "pipe",
        }
      );
      assert.strictEqual(result.exitCode, 7);
      const summary = yield* fs.readFileString(summaryPath);
      assert.include(summary, "| Lane exit status | 7 |");
      assert.include(summary, "Sampled used-memory peak GiB");
      assert.notInclude(summary, "private-argument");
      assert.notInclude(result.stdout.toString(), "private-argument");
    })
  );

  it.effect(
    "executes the lane when resource output storage is unavailable",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const blockedPath = path.join(tempRoot, "not-a-directory");
      yield* fs.writeFileString(blockedPath, "occupied");
      const result = Bun.spawnSync(
        ["bash", path.join(repoRoot, "scripts/ci-runner-resources.sh"), "check", "bash", "-c", "exit 9"],
        { env: { ...process.env, RUNNER_TEMP: blockedPath }, stderr: "pipe", stdout: "pipe" }
      );
      assert.strictEqual(result.exitCode, 9);
      assert.include(result.stderr.toString(), "resource measurement unavailable");
    })
  );

  it.effect(
    "discards resource evidence when sample or summary files become unwritable",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      for (const filename of ["check.tsv", "check.md"]) {
        const tempRoot = yield* fs.makeTempDirectoryScoped();
        const result = Bun.spawnSync(
          [
            "bash",
            path.join(repoRoot, "scripts/ci-runner-resources.sh"),
            "check",
            "bash",
            "-c",
            'target="$RUNNER_TEMP/beep-runner-resources/$1"; rm "$target"; mkdir "$target"; exit 7',
            "fixture",
            filename,
          ],
          { env: { ...process.env, RUNNER_TEMP: tempRoot }, stderr: "pipe", stdout: "pipe" }
        );
        assert.strictEqual(result.exitCode, 7);
        assert.include(result.stderr.toString(), "resource measurement unavailable");
        assert.notInclude(result.stdout.toString(), "### Runner resources:");
      }
    })
  );

  it.effect(
    "executes the lane when its sample file cannot be created",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(tempRoot, "beep-runner-resources", "check.tsv"), { recursive: true });
      const result = Bun.spawnSync(
        ["bash", path.join(repoRoot, "scripts/ci-runner-resources.sh"), "check", "bash", "-c", "exit 9"],
        { env: { ...process.env, RUNNER_TEMP: tempRoot }, stderr: "pipe", stdout: "pipe" }
      );
      assert.strictEqual(result.exitCode, 9);
      assert.include(result.stderr.toString(), "resource measurement unavailable");
      assert.notInclude(result.stdout.toString(), "### Runner resources:");
    })
  );

  it.effect(
    "samples a synthetic proc tree and preserves signal termination codes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const proc = path.join(tempRoot, "proc");
      yield* fs.makeDirectory(proc);
      yield* fs.writeFileString(path.join(proc, "meminfo"), "MemTotal: 2097152 kB\nMemAvailable: 1048576 kB\n");
      yield* fs.writeFileString(path.join(proc, "stat"), "cpu 100 0 100 800 0 0 0 0\n");
      yield* fs.writeFileString(path.join(proc, "vmstat"), "pswpin 5\npswpout 7\n");
      for (const [signal, code] of [
        ["TERM", 143],
        ["INT", 130],
        ["KILL", 137],
      ] as const) {
        const result = Bun.spawnSync(
          [
            "bash",
            path.join(repoRoot, "scripts/ci-runner-resources.sh"),
            "fixture",
            "bash",
            "-c",
            `kill -${signal} $$`,
          ],
          { env: { ...process.env, RUNNER_TEMP: tempRoot, BEEP_CI_PROC_ROOT: proc }, stdout: "pipe", stderr: "pipe" }
        );
        assert.strictEqual(result.exitCode, code);
        assert.include(result.stdout.toString(), `| Lane exit status | ${code} |`);
        assert.include(result.stdout.toString(), "| Host memory GiB | 2.00 |");
        assert.include(result.stdout.toString(), "| Sampled used-memory peak GiB | 1.00 |");
      }
    })
  );

  it.effect(
    "renders the exact runner-resources table with and without the CPU row",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const table = (stdout: string): string =>
        pipe(
          Str.split(stdout, "\n"),
          A.filter(Str.startsWith("| ")),
          A.map(Str.replace(/^\| Elapsed seconds \| \d+ \|$/u, "| Elapsed seconds | <n> |")),
          A.join("\n")
        );
      const head = ["| Measurement | Value |", "| --- | --- |"];
      const memory = [
        "| Elapsed seconds | <n> |",
        "| Memory samples (5-second interval) | 2 |",
        "| Host memory GiB | 2.00 |",
        "| Sampled used-memory peak GiB | 1.00 |",
        "| Minimum available memory GiB | 1.00 |",
      ];
      for (const [lane, script, cpuRows, swap] of [
        ["flat", "exit 3", [], "0 / 0"],
        [
          "busy",
          'printf "cpu 200 0 150 850 0 0 0 0\\n" > "$1/stat"; printf "pswpin 8\\npswpout 9\\n" > "$1/vmstat"; exit 3',
          ["| Host CPU busy percent (excluding I/O wait) | 75.0 |"],
          "3 / 2",
        ],
      ] as const) {
        const tempRoot = yield* fs.makeTempDirectoryScoped();
        const proc = path.join(tempRoot, "proc");
        yield* fs.makeDirectory(proc);
        yield* fs.writeFileString(path.join(proc, "meminfo"), "MemTotal: 2097152 kB\nMemAvailable: 1048576 kB\n");
        yield* fs.writeFileString(path.join(proc, "stat"), "cpu 100 0 100 800 0 0 0 0\n");
        yield* fs.writeFileString(path.join(proc, "vmstat"), "pswpin 5\npswpout 7\n");
        const result = Bun.spawnSync(
          ["bash", path.join(repoRoot, "scripts/ci-runner-resources.sh"), lane, "bash", "-c", script, "fixture", proc],
          { env: { ...process.env, RUNNER_TEMP: tempRoot, BEEP_CI_PROC_ROOT: proc }, stdout: "pipe", stderr: "pipe" }
        );
        assert.strictEqual(result.exitCode, 3);
        assert.strictEqual(
          table(result.stdout.toString()),
          A.join(
            [...head, "| Lane exit status | 3 |", ...memory, ...cpuRows, `| Swap-in / swap-out pages | ${swap} |`],
            "\n"
          )
        );
      }
    })
  );

  it.effect(
    "preserves caller stdin through the resource adapter",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const result = Bun.spawnSync(["bash", path.join(repoRoot, "scripts/ci-runner-resources.sh"), "fixture", "cat"], {
        env: { ...process.env, RUNNER_TEMP: tempRoot },
        stdin: new TextEncoder().encode("fixture input\n"),
        stdout: "pipe",
        stderr: "pipe",
      });
      assert.strictEqual(result.exitCode, 0);
      assert.include(result.stdout.toString(), "fixture input\n");
    })
  );

  it.effect(
    "refuses recovered final-sample evidence after a periodic sampling failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const result = Bun.spawnSync(
        [
          "bash",
          path.join(repoRoot, "scripts/ci-runner-resources.sh"),
          "fixture",
          "bash",
          "-c",
          'target="$RUNNER_TEMP/beep-runner-resources/fixture.tsv"; mv "$target" "$target.saved"; mkdir "$target"; sleep 6; rmdir "$target"; mv "$target.saved" "$target"; exit 9',
        ],
        { env: { ...process.env, RUNNER_TEMP: tempRoot }, stdout: "pipe", stderr: "pipe" }
      );
      assert.strictEqual(result.exitCode, 9);
      assert.include(result.stderr.toString(), "resource measurement unavailable");
      assert.notInclude(result.stdout.toString(), "### Runner resources:");
    })
  );

  it.effect(
    "classifies goals-only and docs-only pull requests without suppressing mixed or push runs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-change-profile.sh");

      const git = gitIn(tempRoot);
      const profile = (eventName: string, outputPath = ""): Readonly<Record<string, string>> => {
        const bootstrap = changeProfile(scriptPath, tempRoot, eventName, outputPath);
        const typed = Bun.spawnSync(
          [
            "bun",
            path.join(repoRoot, "packages/tooling/tool/cli/src/bin.ts"),
            "--",
            "ci",
            "change-profile",
            "origin/main",
          ],
          {
            cwd: tempRoot,
            env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_OUTPUT: "" },
            stdout: "pipe",
            stderr: "pipe",
          }
        );
        assert.strictEqual(typed.exitCode, 0, typed.stderr.toString());
        assert.deepEqual(parseProfileOutput(typed.stdout.toString()), bootstrap);
        return bootstrap;
      };

      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example"), { recursive: true });
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# baseline\n");
      git(["add", "."]);
      git(["commit", "-m", "baseline"]);
      git(["update-ref", "refs/remotes/origin/main", git(["rev-parse", "HEAD"])]);

      assert.strictEqual(profile("pull_request").goals_only, "false");
      assert.strictEqual(profile("pull_request").docs_only, "false");
      assert.strictEqual(profile("pull_request").desktop_rust_relevant, "false");
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# goals-only\n");
      git(["add", "."]);
      git(["commit", "-m", "goals-only"]);
      const outputPath = path.join(tempRoot, "profile-output.txt");
      assert.strictEqual(profile("pull_request", outputPath).goals_only, "true");
      // goals_only implies docs_only.
      assert.strictEqual(profile("pull_request").docs_only, "true");
      assert.strictEqual(parseProfileOutput(yield* fs.readFileString(outputPath)).goals_only, "true");
      yield* fs.remove(outputPath);

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "ops"));
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "ops", "manifest.json"), "{}\n");
      git(["add", "."]);
      git(["commit", "-m", "goal metadata"]);
      assert.strictEqual(profile("pull_request").goals_only, "true");
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
        assert.strictEqual(profile("pull_request").goals_only, "false");
        // Heavy admission's path rule counts markdown outside the code roots
        // as documentation, wherever it sits.
        assert.strictEqual(profile("pull_request").docs_only, "true");
      }

      // Documentation outside packet prose is docs-only, never goals-only; the
      // same file under a code root carries code.
      git(["reset", "--hard", metadataHead]);
      for (const [relative, content] of [
        ["docs/runbooks/ci.md", "# runbook\n"],
        ["research/ledger/claims.jsonl", "{}\n"],
        [".changeset/quiet-lane.md", "---\n---\n"],
        ["README.md", "# readme\n"],
      ] as const) {
        yield* fs.makeDirectory(path.dirname(path.join(tempRoot, relative)), { recursive: true });
        yield* fs.writeFileString(path.join(tempRoot, relative), content);
      }
      git(["add", "."]);
      git(["commit", "-m", "documentation only"]);
      assert.strictEqual(profile("pull_request").goals_only, "false");
      assert.strictEqual(profile("pull_request").docs_only, "true");
      assert.strictEqual(profile("push").docs_only, "false");
      yield* fs.makeDirectory(path.join(tempRoot, "packages", "demo"), { recursive: true });
      yield* fs.writeFileString(path.join(tempRoot, "packages", "demo", "README.md"), "# package readme\n");
      git(["add", "."]);
      git(["commit", "-m", "package readme"]);
      assert.strictEqual(profile("pull_request").docs_only, "false");

      git(["reset", "--hard", metadataHead]);

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "fixtures"));
      yield* fs.writeFileString(
        path.join(tempRoot, "goals", "example", "fixtures", "expected.md"),
        "# Executable test fixture\n"
      );
      git(["add", "."]);
      git(["commit", "-m", "goal markdown fixture"]);
      assert.strictEqual(profile("pull_request").goals_only, "false");

      yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "scripts"));
      yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "scripts", "verify.sh"), "exit 0\n");
      git(["add", "."]);
      git(["commit", "-m", "goal executable"]);
      assert.strictEqual(profile("pull_request").goals_only, "false");
      assert.strictEqual(profile("pull_request").docs_only, "false");

      yield* fs.makeDirectory(path.join(tempRoot, "src"));
      yield* fs.writeFileString(path.join(tempRoot, "src", "index.ts"), "export {}\n");
      git(["add", "."]);
      git(["commit", "-m", "mixed"]);
      assert.strictEqual(profile("pull_request").goals_only, "false");
      assert.strictEqual(profile("pull_request").docs_only, "false");
      assert.strictEqual(profile("push").goals_only, "false");
    })
  );

  // Quality-lane audit D15: the src-tauri crate is compiled (cargo check +
  // clippy -D warnings) inside desktop-ipc only when the crate, the workflow,
  // or the gate itself changed on a pull request; pushes always compile.
  it.effect(
    "gates the desktop-ipc cargo steps on src-tauri changes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-change-profile.sh");
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseWorkflowYaml(workflowText);
      const git = gitIn(tempRoot);
      const profile = (eventName: string) => changeProfile(scriptPath, tempRoot, eventName);
      const writeAndCommit = Effect.fnUntraced(function* (relativePath: string, content: string, message: string) {
        yield* fs.makeDirectory(path.dirname(path.join(tempRoot, relativePath)), { recursive: true });
        yield* fs.writeFileString(path.join(tempRoot, relativePath), content);
        git(["add", "."]);
        git(["commit", "-m", message]);
      });

      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      yield* writeAndCommit("README.md", "# baseline\n", "baseline");
      git(["update-ref", "refs/remotes/origin/main", git(["rev-parse", "HEAD"])]);
      const baseline = git(["rev-parse", "HEAD"]);

      yield* writeAndCommit("docs/notes.md", "# docs only\n", "docs only");
      assert.strictEqual(profile("pull_request").desktop_rust_relevant, "false");
      assert.strictEqual(profile("push").desktop_rust_relevant, "true");

      git(["reset", "--hard", baseline]);
      yield* writeAndCommit("apps/professional-desktop/src-tauri/src/lib.rs", "pub fn main() {}\n", "crate change");
      assert.strictEqual(profile("pull_request").desktop_rust_relevant, "true");

      git(["reset", "--hard", baseline]);
      yield* writeAndCommit(".github/workflows/check.yml", "name: Check\n", "workflow change");
      assert.strictEqual(profile("pull_request").desktop_rust_relevant, "true");

      git(["reset", "--hard", baseline]);
      yield* writeAndCommit("apps/professional-desktop/src/index.ts", "export {}\n", "desktop frontend change");
      assert.strictEqual(profile("pull_request").desktop_rust_relevant, "false");

      const steps = jobSteps(yield* workflowJobs(workflow), "professional-desktop-ipc-stdio");
      const laneGate = "steps.lane-gate.outputs.should_run == 'true'";
      const rustGate = `${laneGate} && steps.lane-gate.outputs.rust_should_run == 'true'`;
      for (const name of ["Install Tauri Linux system dependencies", "Check Rust crate", "Lint Rust crate"]) {
        assert.strictEqual(stepByName(steps, name).if, rustGate, name);
      }
      // build-sidecar.ts and sidecar-ipc-stdio.test.ts read the host target
      // triple from `rustc -vV`, so the toolchain is provisioned whenever the
      // lane runs, ahead of the IPC proof; only the Tauri packages and the
      // cargo steps wait on the crate gate.
      assert.strictEqual(stepByName(steps, "Setup Rust toolchain").if, laneGate);
      assert.isBelow(
        stepIndexByName(steps, "Setup Rust toolchain"),
        stepIndexByName(steps, "Run desktop IPC stdio proof")
      );
      assert.strictEqual(stepByName(steps, "Setup Rust toolchain").with?.components, "clippy");
      assert.strictEqual(
        stepByName(steps, "Setup Rust toolchain").with?.["cache-workspaces"],
        "apps/professional-desktop/src-tauri"
      );
      // The ~500 MB cargo cache restores and saves only when cargo runs (audit M13).
      assert.strictEqual(
        stepByName(steps, "Setup Rust toolchain").with?.cache,
        "${{ steps.lane-gate.outputs.rust_should_run }}"
      );
      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'rust_should_run="$desktop_rust_relevant"');
      assert.include(workflowText, "run: cargo check --locked");
      assert.include(workflowText, "run: cargo clippy --locked -- -D warnings");
      assert.include(workflowText, "working-directory: apps/professional-desktop/src-tauri");
      assertPrunesAptSourcesBefore(stepRun(steps, "Install Tauri Linux system dependencies"), "sudo apt-get update");
      const pruneScript = yield* fs.readFileString(path.join(repoRoot, PRUNE_APT_SOURCES));
      assert.include(pruneScript, "! -name 'ubuntu.sources'");
      const pruneInfo = yield* fs.stat(path.join(repoRoot, PRUNE_APT_SOURCES));
      assert.notStrictEqual(pruneInfo.mode & 0o111, 0, "prune script must be executable");
      // tauri-build needs the sidecar binary, so the cargo steps follow the
      // IPC proof that builds it.
      assert.isBelow(stepIndexByName(steps, "Run desktop IPC stdio proof"), stepIndexByName(steps, "Check Rust crate"));
      assert.isBelow(stepIndexByName(steps, "Check Rust crate"), stepIndexByName(steps, "Lint Rust crate"));
    })
  );

  // TTC ruling 58: the labs lane gained a Turbo input digest without losing its
  // pull-request path gate; pushes still run the full labs set, and the hosted
  // argv carries the --summarize that the digest folds.
  it.effect(
    "keeps the labs lane path gate and its summarized hosted argv",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflow = parseWorkflowYaml(yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml")));
      const steps = jobSteps(yield* workflowJobs(workflow), "labs");
      const gate = stepRun(steps, "Determine lane execution");

      assert.strictEqual(yamlAt(workflow, ["jobs", "labs", "name"]), "Labs");
      assert.include(gate, 'if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]]; then');
      assert.include(
        gate,
        "grep -Eq '(^apps/labs/|^\\.github/workflows/check\\.yml$|^(bun\\.lock|package\\.json|turbo\\.json)$)'"
      );
      assert.include(gate, "labs_checks=false");
      assert.include(stepRun(steps, "Run Labs lane"), "run_lane ci lane labs --coverage-output .beep/ci-coverage/labs");
      // Not a verify matrix leg: Coverage Regression `needs` the Labs job itself.
      assertNone(A.findFirst(yield* heavyMatrixLanes(workflow), (lane) => lane.id === "labs"));
    })
  );

  // Audit M15: tier-1 lanes decide before installing. Docs-only diffs (Heavy
  // admission's path rule) skip every lane that reads no documentation, Nix
  // and Ecosystem Contracts are path-gated on their real inputs, and SAST
  // dispatches without the monorepo setup. Audit M14: aggregators never start
  // inside a cancelled run. Pushes keep every lane.
  it.effect(
    "skips docs-only and path-gated tier-1 lanes before any install",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();
      const jobs = yield* workflowJobs(policy.workflow);
      const gated = "steps.lane-gate.outputs.should_run == 'true'";
      for (const jobId of [
        "verify",
        "labs",
        "lint-shard",
        "test-unit-shard",
        "property-laws",
        "fallow-advisory",
        "jsdoc-ratchet",
        "nix",
      ]) {
        const steps = jobSteps(jobs, jobId);
        const setupIndex = O.getOrThrow(A.findFirstIndex(steps, (step) => step.uses === SETUP_MONOREPO_ACTION));
        assert.strictEqual(setupMonorepoStep(jobs, jobId).if, gated, jobId);
        assert.isBelow(stepIndexByName(steps, "Determine lane execution"), setupIndex, jobId);
        assert.strictEqual(stepByName(steps, "Skip lane").if, "steps.lane-gate.outputs.should_run != 'true'", jobId);
      }
      for (const jobId of [
        "labs",
        "lint-shard",
        "test-unit-shard",
        "property-laws",
        "fallow-advisory",
        "jsdoc-ratchet",
      ]) {
        // Fallow's depth-100 checkout defaults an unclassifiable diff to a full run.
        assert.match(
          stepRun(jobSteps(jobs, jobId), "Determine lane execution"),
          /if \[\[ "\$(?:docs_only|\{docs_only:-false\})" == "true" \]\]; then\n\s+should_run=false/u,
          jobId
        );
      }
      const verifyGate = stepRun(jobSteps(jobs, "verify"), "Determine lane execution");
      assert.include(verifyGate, 'skip_profile="$docs_only"');
      // Repo Sanity validates `.changeset/*.md`, which the docs-only rule counts as documentation.
      assert.include(verifyGate, 'if [[ "${{ matrix.id }}" == "repo-sanity" ]]; then\n  skip_profile="$goals_only"');
      assert.include(verifyGate, "^packages/ecosystem/");
      assert.include(
        stepRun(jobSteps(jobs, "coverage-regression"), "Determine comparison execution"),
        '[[ "$docs_only" == "true" ]]'
      );

      const nix = jobSteps(jobs, "nix");
      assert.include(stepRun(nix, "Determine lane execution"), "^flake\\.(nix|lock)$");
      for (const name of ["Install Nix", "Setup Cachix (read-only)", "Run Nix checks"]) {
        assert.strictEqual(stepByName(nix, name).if, gated, name);
      }

      const sast = jobSteps(jobs, "sast");
      assertNone(A.findFirst(sast, (step) => step.uses === SETUP_MONOREPO_ACTION));
      assert.strictEqual(
        stepRun(sast, "Install dependencies for SAST dispatch"),
        "bun install --frozen-lockfile --ignore-scripts"
      );
      assert.include(stepRun(sast, "Run SAST"), "bun run beep ci lane sast");

      for (const jobId of ["lint", "test-unit", "coverage-regression"]) {
        assert.strictEqual(yamlAt(policy.workflow, ["jobs", jobId, "if"]), "${{ !cancelled() }}", jobId);
      }
    })
  );

  // Release lanes run only on `professional-desktop-v*` tags, so this parse is
  // the standing proof that the ubuntu-22.04 matrix leg prunes the third-party
  // apt sources before its first apt-get update, once checkout has put the
  // script in place.
  it.effect(
    "prunes third-party apt sources before the release desktop Linux apt update",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflow = parseWorkflowYaml(
        yield* fs.readFileString(path.join(repoRoot, ".github/workflows/release-desktop.yml"))
      );
      const steps = jobSteps(yield* workflowJobs(workflow), "release-desktop");
      const install = "Install Tauri Linux system dependencies";
      assert.strictEqual(stepByName(steps, install).if, "runner.os == 'Linux'");
      assertPrunesAptSourcesBefore(stepRun(steps, install), "sudo apt-get update");
      const checkoutIndex = O.getOrThrowWith(
        A.findFirstIndex(steps, (step) => Str.startsWith("actions/checkout@")(step.uses ?? "")),
        () => new Error("Job release-desktop declares no checkout step.")
      );
      assert.isBelow(checkoutIndex, stepIndexByName(steps, install));
    })
  );

  // Quality-lane audit D13 (revised in PR #1054 review): the workflow gates
  // Storybook only on docs_only and lets the lane decide through Turbo's
  // dependency-aware affected probe, restores the Playwright browser cache on
  // every event, and saves it only on trusted pushes. A path profile cannot
  // see transitive workspace dependencies, so none is emitted for Storybook.
  // The browser cache is keyed on the resolved Playwright version (audit M13):
  // a bun.lock key stored a new Chromium on every lockfile change.
  it.effect(
    "gates the Storybook lane on docs_only alone and keeps the browser cache push-saved",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-change-profile.sh");
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
      const workflow = parseWorkflowYaml(workflowText);
      const git = gitIn(tempRoot);
      const profile = (eventName: string) => changeProfile(scriptPath, tempRoot, eventName);

      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      yield* fs.writeFileString(path.join(tempRoot, "README.md"), "# baseline\n");
      git(["add", "."]);
      git(["commit", "-m", "baseline"]);
      git(["update-ref", "refs/remotes/origin/main", git(["rev-parse", "HEAD"])]);
      yield* fs.makeDirectory(path.join(tempRoot, "packages/foundation/schema/src"), { recursive: true });
      yield* fs.writeFileString(path.join(tempRoot, "packages/foundation/schema/src/index.ts"), "export {};\n");
      git(["add", "."]);
      git(["commit", "-m", "schema change"]);

      for (const eventName of ["pull_request", "push"]) {
        const emitted = profile(eventName);
        assert.notProperty(emitted, "storybook_relevant", eventName);
        assert.strictEqual(emitted.goals_only, "false", eventName);
      }
      assert.notInclude(workflowText, "storybook_relevant");
      const steps = jobSteps(yield* workflowJobs(workflow), "storybook");
      const gate = "steps.lane-gate.outputs.should_run == 'true'";
      for (const name of [
        "Setup monorepo CI",
        "Resolve Playwright version",
        "Restore Playwright Chromium cache",
        "Install Playwright Chromium",
        "Run Storybook lane",
      ]) {
        assert.strictEqual(stepByName(steps, name).if, gate, name);
      }
      assertPrunesAptSourcesBefore(
        stepRun(steps, "Install Playwright Chromium"),
        "bunx playwright install --with-deps chromium"
      );
      const upload = stepByName(steps, "Upload Storybook static artifact");
      assert.strictEqual(upload.if, `${gate} && hashFiles('apps/storybook/storybook-static/index.html') != ''`);
      assert.strictEqual(upload.with?.["if-no-files-found"], "error");
      assert.include(workflowText, 'if [[ "$docs_only" == "true" ]]; then');
      assert.include(workflowText, 'shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")');
      const restore = stepByName(steps, "Restore Playwright Chromium cache");
      const save = stepByName(steps, "Save Playwright Chromium cache");
      assert.include(stepRun(steps, "Resolve Playwright version"), "bunx playwright --version");
      assert.isBelow(stepIndexByName(steps, "Setup monorepo CI"), stepIndexByName(steps, "Resolve Playwright version"));
      assert.strictEqual(restore.with?.path, "~/.cache/ms-playwright");
      assert.strictEqual(
        restore.with?.key,
        "playwright-chromium-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}"
      );
      assert.isUndefined(restore.with?.["restore-keys"]);
      assert.include(save.if, "github.event_name == 'push'");
      assert.strictEqual(save.with?.key, restore.with?.key);
      assert.isBelow(
        stepIndexByName(steps, "Install Playwright Chromium"),
        stepIndexByName(steps, "Save Playwright Chromium cache")
      );
      assert.isBelow(
        stepIndexByName(steps, "Save Playwright Chromium cache"),
        stepIndexByName(steps, "Run Storybook lane")
      );
      assert.strictEqual(yamlAt(workflow, ["jobs", "storybook", "name"]), "Storybook");
      assert.strictEqual(
        yamlAt(workflow, ["jobs", "storybook", "environment"]),
        "${{ github.event_name == 'push' && 'turbo-cache-write' || null }}"
      );
    })
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
    })
  );

  it.effect(
    "keeps every hand-copied Turbo credential and secret inventory out of the workflows",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();

      assert.isUndefined(yamlAt(policy.workflow, ["on", "pull_request_target"]));
      assert.isDefined(yamlAt(policy.workflow, ["on", "pull_request"]));
      // No workflow hand-copies the credential tuple any more: the selection
      // lives once in packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts behind the composite action. The
      // only secret references left are the explicit input pass-throughs the
      // policy allowlists; `toJSON(secrets)` never reaches a step input, so a
      // job's log header cannot inventory the repository's secret names.
      for (const [name, text] of [
        ["check.yml", policy.workflowText],
        ["heavy.yml", policy.heavyWorkflowText],
        ["storybook.yml", policy.storybookText],
      ] as const) {
        assertNoInlineCredentialTuple(name, text);
      }
    })
  );

  it.effect(
    "maps each explicit setup-monorepo-ci secret input onto the policy script's allowlist",
    Effect.fnUntraced(function* () {
      const { action, actionText, jobEnvScriptText } = yield* readCredentialPolicySources();

      assert.include(actionText, "run: bun run beep ci job-env");
      assert.include(actionText, "BEEP_CI_HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}");
      // The action maps each explicit input to BEEP_CI_SECRET_<NAME>; the
      // script's allowlist names the same secrets.
      assert.notInclude(actionText, "toJSON(secrets)");
      assert.isUndefined(yamlAt(action, ["inputs", "repository-secrets"]));
      const exportEnvironment = stepEnvironment(
        stepByName(yield* decodeWorkflowSteps(yamlAt(action, ["runs", "steps"])), "Export job environment")
      );
      assert.isUndefined(exportEnvironment.BEEP_CI_SECRETS_JSON);
      for (const [input, name] of SECRET_INPUTS) {
        assert.strictEqual(yamlAt(action, ["inputs", input, "default"]), "", input);
        assert.strictEqual(exportEnvironment[`BEEP_CI_SECRET_${name}`], `\${{ inputs.${input} }}`, input);
        assert.include(jobEnvScriptText, `"${name}"`, name);
      }
    })
  );

  it.effect(
    "routes every Turbo job's cache credentials through the single setup-monorepo-ci policy",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();

      for (const [jobs, jobId, appSecrets] of yield* turboJobTable(policy)) {
        assertTurboJobSetup(jobs, jobId, appSecrets);
      }
    })
  );

  it.effect(
    "saves the Turbo cache only on push, with Build dispatched from heavy.yml",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();
      const { workflow, heavyWorkflow, heavyWorkflowText } = policy;

      // Pull requests never publish a cache entry. The SHA-keyed post-lane
      // Turbo fallback was write-only (audit M13: 589 entries, 7.4 GB, zero
      // restores), so the main Docgen cache and the push-only Playwright
      // browsers are the only saves left, both push-gated.
      const checkJobs = yield* workflowJobs(workflow);
      const heavyJobs = yield* workflowJobs(heavyWorkflow);
      const storybookJobs = yield* workflowJobs(policy.storybook);
      assert.deepStrictEqual(cacheSaveSteps(checkJobs), []);
      assert.deepStrictEqual(cacheSaveSteps(heavyJobs), ["verify/Save main Docgen Turbo cache"]);
      assert.deepStrictEqual(cacheSaveSteps(storybookJobs), ["storybook/Save Playwright Chromium cache"]);
      assert.include(
        stepByName(jobSteps(heavyJobs, "verify"), "Save main Docgen Turbo cache").if,
        "github.event_name == 'push'"
      );
      // Quality-lane audit D12: Build runs on pull requests (affected-scoped,
      // remote-cache read) and keeps the write environment for pushes only.
      // It dispatches from heavy.yml: the beep-ec2-heavy runner group admits
      // heavy.yml@main on pull requests, never a job declared in check.yml.
      assert.isUndefined(yamlAt(workflow, ["jobs", "build"]));
      assert.strictEqual(
        yamlAt(heavyWorkflow, ["jobs", "verify", "environment"]),
        "${{ github.event_name == 'push' && inputs.admitted && matrix.uses_turbo == 'true' && 'turbo-cache-write' || null }}"
      );
      const buildLane = O.getOrThrowWith(
        A.findFirst(yield* heavyMatrixLanes(heavyWorkflow), (lane) => lane.id === "build"),
        () => new Error("heavy.yml declares no build lane.")
      );
      assert.strictEqual(buildLane.name, "Build");
      assert.strictEqual(buildLane.uses_turbo, "true");
      // Effect rules run inside the patched tsrs typecheck, so the standalone
      // diagnostics matrix lane is retired.
      assertNone(A.findFirst(yield* heavyMatrixLanes(heavyWorkflow), (lane) => lane.id === "effect-diagnostics"));
      assert.notInclude(heavyWorkflowText, "run_lane ci lane effect-diagnostics");
      assert.notInclude(heavyWorkflowText, "commands/Quality/EffectDiagnostics.ts");
      assert.include(heavyWorkflowText, "check|test-integration|build)");
    })
  );

  it.effect(
    "keeps the lane shapes the workflows hand to the CLI",
    Effect.fnUntraced(function* () {
      const { workflowText, heavyWorkflowText } = yield* readCredentialPolicySources();

      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'if [[ "$docs_only" == "true" ]]');
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
    })
  );

  it.effect(
    "gives same-repository pull requests read-only cache access while forks and untrusted events stay local-only",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const secrets = {
        TURBO_TOKEN: "write-token",
        TURBO_READ_TOKEN: "read-token",
        DATABASE_URL: "postgres://push-only",
        AUTH_SECRET: "auth-secret\nwith newline",
        UNRELATED_SECRET: "never exported",
      };
      // The composite action hands the script one BEEP_CI_SECRET_<NAME>
      // variable per explicit input; the allowlist still decides what is
      // exported, so UNRELATED_SECRET stays out even when it is present.
      const secretEnvironment = (values: Readonly<Record<string, string>>) =>
        R.mapKeys(values, (name) => `BEEP_CI_SECRET_${name}`);
      let scenario = 0;
      const jobEnv = Effect.fnUntraced(function* (input: {
        readonly eventName: string;
        readonly headRepository: string;
        readonly turboRemoteCache: boolean;
        readonly appSecrets: boolean;
        readonly turboApi?: string;
        readonly secrets?: Readonly<Record<string, string>>;
      }) {
        scenario += 1;
        const outputPath = path.join(tempRoot, `job-env-${scenario}.txt`);
        yield* fs.writeFileString(outputPath, "");
        const result = Bun.spawnSync(["bun", "run", "beep", "ci", "job-env"], {
          cwd: repoRoot,
          env: {
            ...R.map(process.env, (value, name) => (Str.startsWith("BEEP_CI_SECRET_")(name) ? "" : value)),
            ...secretEnvironment(input.secrets ?? secrets),
            GITHUB_EVENT_NAME: input.eventName,
            GITHUB_REPOSITORY: "beep-effect/beep-effect",
            GITHUB_ENV: outputPath,
            BEEP_CI_HEAD_REPOSITORY: input.headRepository,
            BEEP_CI_TURBO_REMOTE_CACHE: input.turboRemoteCache ? "true" : "false",
            BEEP_CI_APP_SECRETS: input.appSecrets ? "true" : "false",
            BEEP_CI_TURBO_API: input.turboApi ?? "https://cache.example.test",
            BEEP_CI_TURBO_TEAM: "team_beep",
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
        secrets: {},
      });
      assert.strictEqual(emptySecrets.TURBO_CACHE, "local:rw");
      assert.strictEqual(emptySecrets.DATABASE_URL, "");
    })
  );

  // Audit M13: nothing ever restored the SHA-keyed local fallback (589
  // entries, 7.4 GB, zero restores on 2026-11-02), so the composite action
  // neither restores nor saves an Actions cache and takes no cache inputs.
  it.effect(
    "keeps the setup action free of Actions cache steps and their inputs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const actionText = yield* fs.readFileString(path.join(repoRoot, ".github/actions/setup-monorepo-ci/action.yml"));
      const checkText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const heavyText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const action = parseWorkflowYaml(actionText);
      const check = parseWorkflowYaml(checkText);
      const heavy = parseWorkflowYaml(heavyText);

      const retiredInputs = ["cache-turbo", "cache-write", "turbo-cache-key-suffix"];
      for (const input of retiredInputs) {
        assert.isUndefined(yamlAt(action, ["inputs", input]), input);
      }
      const actionSteps = yield* decodeWorkflowSteps(yamlAt(action, ["runs", "steps"]));
      assertNone(A.findFirst(actionSteps, (step) => Str.startsWith("actions/cache")(step.uses ?? "")));
      assert.isBelow(
        stepIndexByName(actionSteps, "Install dependencies"),
        stepIndexByName(actionSteps, "Export job environment")
      );
      assert.isBelow(
        stepIndexByName(actionSteps, "Free runner disk"),
        stepIndexByName(actionSteps, "Install dependencies")
      );
      const workflowFiles = A.filter(
        yield* fs.readDirectory(path.join(repoRoot, ".github/workflows")),
        Str.endsWith(".yml")
      );
      for (const file of workflowFiles) {
        const text = yield* fs.readFileString(path.join(repoRoot, ".github/workflows", file));
        for (const input of retiredInputs) {
          assert.notInclude(text, `${input}:`, `${file} passes the retired ${input} input`);
        }
      }

      // Disk cleanup is the composite action's job now; the shards keep the
      // 64 GiB short-circuit and the matrix lanes always clean.
      const checkJobs = yield* workflowJobs(check);
      const heavyJobs = yield* workflowJobs(heavy);
      assert.notInclude(checkText, "Free runner disk");
      assert.notInclude(heavyText, "Free runner disk");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "verify")["free-disk"], "true");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "labs")["free-disk"], "true");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "lint-shard")["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "test-unit-shard")["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "fallow-advisory")["free-disk"], "true");
      assert.strictEqual(setupMonorepoInputs(heavyJobs, "verify")["free-disk"], "true");
    })
  );

  it.effect(
    "keeps pull request Docgen cache access restore-only",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const workflow = parseWorkflowYaml(workflowText);
      const jobs = yield* workflowJobs(workflow);
      const setup = setupMonorepoStep(jobs, "verify");
      assert.strictEqual(setup.with?.["turbo-remote-cache"], "${{ matrix.uses_turbo }}");
      assert.strictEqual(
        yamlAt(workflow, ["jobs", "verify", "env", "BEEP_DOCGEN_CONCURRENCY"]),
        "${{ matrix.docgen_concurrency || 3 }}"
      );
      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]');
      assert.include(workflowText, "- name: Skip lane");
      assert.strictEqual(
        O.getOrThrow(A.findFirst(yield* heavyMatrixLanes(workflow), (lane) => lane.id === "docgen")).docgen_concurrency,
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
    })
  );

  it.effect(
    "runs full Doctest through the CLI without a workflow mode gate",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      assert.notInclude(workflowText, "doctest_mode");
      assert.notInclude(workflowText, "vitest.docs");
      assert.include(workflowText, "run_lane ci lane doctest\n");
      assert.notInclude(workflowText, "run_lane ci lane doctest --mode");
    })
  );

  it.effect(
    "retires the root Doctest script and keeps the plugin dependency",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const packageJson = yield* fs.readFileString(path.join(repoRoot, "package.json"));

      assert.notInclude(packageJson, '"doctest":');
      assert.include(packageJson, '"@effect/doctest": "catalog:"');
      assert.isFalse(yield* fs.exists(path.join(repoRoot, "vitest.docs.ts")));
    })
  );

  // Reusable Heavy is trusted at main; caller, scheduled, and skill-train orchestration jobs are exemptions.
  // Skills Replay comments on PRs; Relock and Batch Issue are the skill-train writers.
  it.effect(
    "maps every hosted job to a descriptor or explicit orchestration exemption",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = NodeURL.fileURLToPath(new URL("../../../../..", import.meta.url));
      const exemptions = [
        "check.yml:Heavy Admission",
        "check.yml:Heavy",
        "check.yml:Lint (${{ matrix.partition }})",
        "check.yml:Test Unit (${{ matrix.partition }})",
        "check.yml:Coverage Artifact Migration",
        "cache-warm.yml:Warm Turbo cache",
        // Manual source inspection is operational evidence, not a required quality lane.
        "cache-producer-inspect.yml:Inspect producer sources and tools",
        "heavy.yml:Heavy / Inspect producer sources and tools",
        // A candidate adapter build grants no producer or quality verdict authority.
        "cache-producer-prepare.yml:Build candidate producer adapter",
        "heavy.yml:Heavy / Build candidate producer adapter",
        // Protected execution authenticates observations; required quality proof stays separate.
        "cache-producer.yml:Execute approved signed producer",
        "heavy.yml:Heavy / Execute approved signed producer",
        "data-sync.yml:Sync Official Data",
        // Prod deploy of the Alchemy stack; environment-gated, not a local lane.
        "deploy-beep-effect-web.yml:Deploy beep-effect-web (prod)",
        "fleet-lane-probe.yml:Lane Probe (${{ inputs.lane }})",
        "fleet-shadow-check.yml:Shadow Probe",
        "heavy-admit.yml:Heavy Admission",
        "heavy-admit.yml:Heavy",
        // Native Windows verification consumes only the sparse script artifact;
        // these platform-specific jobs cannot run through the local CLI lane dispatcher.
        "hub-pipe-security.yml:Collect Windows pipe scripts",
        "hub-pipe-security.yml:Windows pipe owner authentication",
        "knowledge-baseline-mint.yml:Mint Knowledge Baseline",
        "property-laws-nightly.yml:Property Laws Sweep",
        "release-desktop.yml:Validate desktop release inputs",
        "release-desktop.yml:macOS arm64",
        "release-desktop.yml:macOS x64",
        "release-desktop.yml:Linux x64",
        "release-desktop.yml:Windows x64",
        "release-desktop.yml:Desktop release draft ready",
        "rerun-runner-loss.yml:Rerun Runner Loss",
        "skills-update-train.yml:Skills Replay",
        "skills-update-train.yml:Skills Relock",
        "skills-update-train.yml:Skills Train Batch Issue",
      ];
      const files = A.filter(yield* fs.readDirectory(`${root}/.github/workflows`), Str.endsWith(".yml"));
      for (const file of files) {
        const workflow = Str.replace(/\.yml$/, "")(file);
        const text = yield* fs.readFileString(`${root}/.github/workflows/${file}`);
        expect(yield* workflowPolicyDiagnostics(file, text)).toEqual([]);
        const contexts = yield* workflowJobContexts(file, text);
        const declared = A.map(
          A.filter(CI_LANE_DESCRIPTORS, (row) => row.workflow === workflow),
          (row) => row.contextName
        );
        expect(
          A.filter(
            contexts,
            (context) => !A.contains(declared, context) && !A.contains(exemptions, `${file}:${context}`)
          )
        ).toEqual([]);
        expect(A.filter(declared, (context) => !A.contains(contexts, context))).toEqual([]);
      }
    })
  );
  it.effect("keeps protected source inspection credential-free and retains only its bounded report", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const text = yield* fs.readFileString(`${root}/.github/workflows/cache-producer-inspect.yml`);
      const workflow = parseWorkflowYaml(text);
      const policy = yield* decodeInspectionPolicy(workflow);
      expect(policy.permissions).toEqual({ contents: "read" });
      expect(policy.on).toEqual({ workflow_dispatch: null });
      expect(yamlAt(workflow, ["jobs", "inspect", "if"])).toBe("github.ref == 'refs/heads/main'");
      // A matching label is insufficient: the live runner group admits the
      // Heavy workflow at main, and only jobs defined there can use the fleet.
      expect(yamlAt(workflow, ["jobs", "inspect", "uses"])).toBe(
        "beep-effect/beep-effect/.github/workflows/heavy.yml@main"
      );
      expect(yamlAt(workflow, ["jobs", "inspect", "with"])).toEqual({
        admitted: false,
        producer_inspection: true,
      });
      expect(yamlAt(workflow, ["jobs", "inspect", "runs-on"])).toBeUndefined();
      expect(yamlAt(workflow, ["jobs", "inspect", "steps"])).toBeUndefined();
      expect(yamlAt(workflow, ["jobs", "inspect", "secrets"])).toBeUndefined();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      expect(yamlAt(heavy, ["permissions"])).toEqual({ contents: "read" });
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_inspection"])).toEqual({
        description:
          "Run only the credential-free protected source inspection for the exact main manual dispatcher. Ordinary quality callers leave this off.",
        required: false,
        type: "boolean",
        default: false,
      });
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.producer_execution }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "if"])).toBe(
        A.join(
          [
            "inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution &&",
            "github.repository == 'beep-effect/beep-effect' &&",
            "github.event_name == 'workflow_dispatch' &&",
            "github.ref == 'refs/heads/main' &&",
            "github.workflow_ref == 'beep-effect/beep-effect/.github/workflows/cache-producer-inspect.yml@refs/heads/main'",
          ],
          " "
        )
      );
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "runs-on"])).toBe("beep-ec2-heavy");
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "environment"])).toBe("turbo-cache-write");
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "timeout-minutes"])).toBe(10);
      const steps = jobSteps(yield* workflowJobs(heavy), "producer-inspect");
      const setup = stepByName(steps, "Setup pinned toolchain without cache capabilities");
      expect(setup.uses).toBe(SETUP_MONOREPO_ACTION);
      expect(setup.with).toEqual({
        "turbo-remote-cache": "false",
        "r2-enabled": "false",
        "app-secrets": "false",
      });
      const sandboxName = "Ensure native sandbox inspection dependency";
      const sandbox = stepByName(steps, sandboxName);
      expect(sandbox.run).toContain("dnf install -y bubblewrap");
      expect(sandbox.run).toContain("apt-get install -y --no-install-recommends bubblewrap");
      expect(sandbox.run).toContain("test -x /usr/bin/bwrap");
      expect(sandbox.run).toContain("/usr/bin/bwrap --version");
      expect(stepIndexByName(steps, sandboxName)).toBeLessThan(
        stepIndexByName(steps, "Write bounded source inspection")
      );
      const inspect = stepByName(steps, "Write bounded source inspection");
      expect(inspect.env).toEqual({ BEEP_TURBO_HOST_CACHE_DISABLED: "true" });
      expect(inspect.run).toContain("bun --no-env-file run beep cache producer-inspect");
      const retain = stepByName(steps, "Retain inspection for at most one day");
      expect(retain.with).toEqual({
        name: "cache-producer-inspection-${{ github.run_id }}-${{ github.run_attempt }}",
        path: "${{ steps.inspection.outputs.report }}",
        "if-no-files-found": "error",
        "retention-days": 1,
        "compression-level": 0,
      });
      expect(yield* workflowPolicyDiagnostics("cache-producer-inspect.yml", text)).toEqual([]);
      expect(yield* workflowPolicyDiagnostics("heavy.yml", heavyText)).toEqual([]);
    })
  );

  it.effect("keeps candidate adapter builds main-only, credential-free and separate from proof", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const text = yield* fs.readFileString(`${root}/.github/workflows/cache-producer-prepare.yml`);
      const workflow = parseWorkflowYaml(text);
      const policy = yield* decodeInspectionPolicy(workflow);
      expect(policy.permissions).toEqual({ contents: "read" });
      expect(policy.on).toEqual({ workflow_dispatch: null });
      expect(yamlAt(workflow, ["concurrency"])).toEqual({
        group: "cache-producer-preparation-main",
        "cancel-in-progress": false,
      });
      expect(yamlAt(workflow, ["jobs", "prepare", "if"])).toBe("github.ref == 'refs/heads/main'");
      expect(yamlAt(workflow, ["jobs", "prepare", "uses"])).toBe(
        "beep-effect/beep-effect/.github/workflows/heavy.yml@main"
      );
      expect(yamlAt(workflow, ["jobs", "prepare", "with"])).toEqual({
        admitted: false,
        producer_preparation: true,
      });
      expect(yamlAt(workflow, ["jobs", "prepare", "secrets"])).toBeUndefined();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_preparation"])).toEqual({
        description:
          "Build only the credential-free candidate adapter for the exact main manual dispatcher. This grants no producer or cache-write authority.",
        required: false,
        type: "boolean",
        default: false,
      });
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.producer_execution }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "if"])).toBe(
        A.join(
          [
            "inputs.producer_preparation && !inputs.producer_inspection && !inputs.producer_execution &&",
            "github.repository == 'beep-effect/beep-effect' &&",
            "github.event_name == 'workflow_dispatch' &&",
            "github.ref == 'refs/heads/main' &&",
            "github.workflow_ref == 'beep-effect/beep-effect/.github/workflows/cache-producer-prepare.yml@refs/heads/main'",
          ],
          " "
        )
      );
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "runs-on"])).toBe("beep-ec2-heavy");
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "timeout-minutes"])).toBe(20);
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "environment"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "secrets"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "env"])).toEqual({
        BEEP_TURBO_HOST_CACHE_DISABLED: "true",
        RUSTUP_TOOLCHAIN: "1.96.0",
        CARGO_BUILD_JOBS: "2",
      });
      const steps = jobSteps(yield* workflowJobs(heavy), "producer-prepare");
      expect(stepByName(steps, "Checkout exact main source").with).toEqual({
        ref: "${{ github.sha }}",
        "fetch-depth": 0,
        filter: "blob:none",
        "persist-credentials": false,
      });
      expect(stepByName(steps, "Setup pinned Rust without shared caches").with).toEqual({
        toolchain: "1.96.0",
        target: "x86_64-unknown-linux-musl",
        cache: "false",
        override: "false",
        matcher: "false",
      });
      const install = stepByName(steps, "Install pinned portable build tools");
      expect(install.run).toContain("--require-hashes");
      expect(install.run).toContain("--only-binary=:all:");
      const buildRequirements = yield* fs.readFileString(`${root}/infra/r2-cache/policy-build-requirements.txt`);
      expect(buildRequirements).toContain("cargo-zigbuild==0.20.1");
      expect(buildRequirements).toContain(
        "--hash=sha256:cb9508149ee63d60e5110ff24b527ab25ed418a6329252aa4f86868197c55bf6"
      );
      expect(buildRequirements).toContain("ziglang==0.14.1");
      expect(buildRequirements).toContain(
        "--hash=sha256:6eb9d4d759b292c83810dbee2e9e8e3fbfbf01d864e6e9811bae711fd74e1c2f"
      );
      const build = stepByName(steps, "Build pinned portable candidate");
      expect(build.run).toContain("infra/r2-cache/policy.sh cargo-build-musl");
      expect(build.run).toContain("infra/r2-cache/policy.sh prepare");
      expect(build.run).toContain("readelf -lW");
      expect(build.run).toContain("size+len(encoded)>16*1024*1024");
      expect(build.run).toContain("len(encoded)>64*1024");
      expect(build.run).toContain("independent approval and runtime qualification are required");
      expect(build.run).toContain("'toolExecutables':{name:executable_digest(path)");
      expect(build.run).toContain("['rustup','which','rustc']");
      expect(stepByName(steps, "Retain candidate for at most one day").with).toEqual({
        name: "cache-producer-adapter-${{ github.run_id }}-${{ github.run_attempt }}",
        path: "${{ steps.scratch.outputs.artifact }}",
        "if-no-files-found": "error",
        "retention-days": 1,
        "compression-level": 0,
      });
      const cleanup = stepByName(steps, "Remove only this job's build scratch");
      expect(cleanup.if).toBe("always() && steps.scratch.outputs.root != ''");
      expect(cleanup.env).toEqual({ BUILD_SCRATCH_ROOT: "${{ steps.scratch.outputs.root }}" });
      expect(cleanup.run).toContain("*/beep/cache-producer-build.??????)");
      for (const step of steps) {
        if (step.name !== cleanup.name) expect(step.env).toBeUndefined();
        expect(step.uses).not.toBe(SETUP_MONOREPO_ACTION);
        expect(step.uses ?? "").not.toContain("actions/cache");
        expect(step.run ?? "").not.toContain("secrets.");
        expect(step.run ?? "").not.toContain("producer-install");
        expect(step.run ?? "").not.toContain("producer-run");
        expect(step.run ?? "").not.toContain("op read");
      }
      expect(yield* workflowPolicyDiagnostics("cache-producer-prepare.yml", text)).toEqual([]);
      expect(yield* workflowPolicyDiagnostics("heavy.yml", heavyText)).toEqual([]);
    })
  );

  it.effect("confines protected producer capabilities to the closed main-only trial", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const text = yield* fs.readFileString(`${root}/.github/workflows/cache-producer.yml`);
      const caller = parseWorkflowYaml(text);
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      expect(text).toMatch(/^[\u0000-\u007f]*$/u);
      expect(heavyText).toMatch(/^[\u0000-\u007f]*$/u);
      expect(text.length + heavyText.length).toBeLessThanOrEqual(64 * 1024);
      expect(yamlAt(caller, ["permissions"])).toEqual({ contents: "read", actions: "read" });
      expect(yamlAt(caller, ["on", "workflow_dispatch", "inputs", "channel", "options"])).toEqual(["stable", "canary"]);
      expect(yamlAt(caller, ["concurrency"])).toEqual({
        group: "cache-protected-producer-main",
        "cancel-in-progress": false,
      });
      expect(yamlAt(caller, ["jobs", "produce", "if"])).toBe("github.ref == 'refs/heads/main'");
      expect(yamlAt(caller, ["jobs", "produce", "uses"])).toBe(
        "beep-effect/beep-effect/.github/workflows/heavy.yml@main"
      );
      expect(yamlAt(caller, ["jobs", "produce", "with"])).toEqual({
        admitted: false,
        producer_execution: true,
        producer_channel: "${{ inputs.channel }}",
      });
      const secretNames = [
        "BEEP_CACHE_PRODUCER_STABLE_APPROVAL_JSON",
        "BEEP_CACHE_PRODUCER_CANARY_APPROVAL_JSON",
        "BEEP_CACHE_PRODUCER_STABLE_RUNTIME_JSON",
        "BEEP_CACHE_PRODUCER_CANARY_RUNTIME_JSON",
        "BEEP_CACHE_PRODUCER_STABLE_ISSUER_MATERIAL_BASE64",
        "BEEP_CACHE_PRODUCER_CANARY_ISSUER_MATERIAL_BASE64",
        "BEEP_CACHE_TRIAL_R2_ACCESS_KEY_ID",
        "BEEP_CACHE_TRIAL_R2_SECRET_ACCESS_KEY",
        "BEEP_CACHE_TRIAL_ARTIFACT_KEY",
        "BEEP_CACHE_TRIAL_READER_BEARER",
        "BEEP_CACHE_TRIAL_WRITER_BEARER",
      ];
      const forwarded = yield* decodeYamlRecord(yamlAt(caller, ["jobs", "produce", "secrets"]));
      expect(A.sort(R.keys(forwarded), Order.String)).toEqual(A.sort(secretNames, Order.String));
      for (const name of secretNames) {
        expect(R.get(forwarded, name)).toEqual(O.some("${{ secrets." + name + " }}"));
        expect(yamlAt(heavy, ["on", "workflow_call", "secrets", name, "required"])).toBe(false);
      }
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_execution", "default"])).toBe(false);
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-execute", "if"])).toBe(
        A.join(
          [
            "inputs.producer_execution && !inputs.producer_inspection && !inputs.producer_preparation &&",
            "(inputs.producer_channel == 'stable' || inputs.producer_channel == 'canary') &&",
            "github.repository == 'beep-effect/beep-effect' &&",
            "github.event_name == 'workflow_dispatch' &&",
            "github.ref == 'refs/heads/main' &&",
            "github.workflow_ref == 'beep-effect/beep-effect/.github/workflows/cache-producer.yml@refs/heads/main'",
          ],
          " "
        )
      );
      expect(yamlAt(heavy, ["jobs", "producer-execute", "environment"])).toBe("turbo-cache-write");
      expect(yamlAt(heavy, ["jobs", "producer-execute", "timeout-minutes"])).toBe(60);
      expect(yamlAt(heavy, ["jobs", "producer-execute", "permissions"])).toEqual({ contents: "read", actions: "read" });
      expect(yamlAt(heavy, ["jobs", "producer-execute", "env"])).toEqual({
        BEEP_TURBO_HOST_CACHE_DISABLED: "true",
        BEEP_CACHE_PRODUCER_CHANNEL: "${{ inputs.producer_channel }}",
      });
      const steps = jobSteps(yield* workflowJobs(heavy), "producer-execute");
      expect(stepByName(steps, "Setup pinned toolchain without trial capabilities").with).toEqual({
        "turbo-remote-cache": "false",
        "r2-enabled": "false",
        "app-secrets": "false",
      });
      const download = stepByName(steps, "Download independently selected candidate");
      expect(download.with?.["artifact-ids"]).toBe("${{ steps.selection.outputs.artifact }}");
      expect(download.with?.["digest-mismatch"]).toBe("error");
      const installName = "Install independently approved issuer only";
      const runName = "Execute closed signed trial and retain private observation";
      const publishName = "Publish issued observation using storage capabilities only";
      const install = stepByName(steps, installName);
      expect(A.sort(R.keys(install.env ?? {}), Order.String)).toEqual([
        "BEEP_CACHE_PRODUCER_APPROVAL_JSON",
        "BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64",
        "BEEP_CACHE_PRODUCER_RUNTIME_JSON",
      ]);
      // Select the key before lookup: a missing stable value must not fall back to canary material.
      expect(install.env?.BEEP_CACHE_PRODUCER_APPROVAL_JSON).toBe(
        "${{ secrets[inputs.producer_channel == 'stable' && 'BEEP_CACHE_PRODUCER_STABLE_APPROVAL_JSON' || 'BEEP_CACHE_PRODUCER_CANARY_APPROVAL_JSON'] }}"
      );
      expect(install.env?.BEEP_CACHE_PRODUCER_RUNTIME_JSON).toBe(
        "${{ secrets[inputs.producer_channel == 'stable' && 'BEEP_CACHE_PRODUCER_STABLE_RUNTIME_JSON' || 'BEEP_CACHE_PRODUCER_CANARY_RUNTIME_JSON'] }}"
      );
      expect(install.env?.BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64).toBe(
        "${{ secrets[inputs.producer_channel == 'stable' && 'BEEP_CACHE_PRODUCER_STABLE_ISSUER_MATERIAL_BASE64' || 'BEEP_CACHE_PRODUCER_CANARY_ISSUER_MATERIAL_BASE64'] }}"
      );
      expect(install.run).toContain("producer-install --from-environment");
      expect(stepIndexByName(steps, "Verify selected candidate before issuer delivery")).toBeLessThan(
        stepIndexByName(steps, installName)
      );
      expect(stepIndexByName(steps, "Prepare fixed full-pilot inputs without credentials")).toBeLessThan(
        stepIndexByName(steps, installName)
      );
      expect(stepRun(steps, runName)).toContain("timeout --signal=TERM --kill-after=30s 50m");
      expect(stepRun(steps, runName)).toContain("cache producer-run");
      expect(stepRun(steps, "Prepare fixed full-pilot inputs without credentials")).toContain("'selection':'full'");
      expect(stepByName(steps, publishName).env).toEqual({
        R2_ACCESS_KEY_ID: "${{ secrets.BEEP_CACHE_TRIAL_R2_ACCESS_KEY_ID }}",
        R2_SECRET_ACCESS_KEY: "${{ secrets.BEEP_CACHE_TRIAL_R2_SECRET_ACCESS_KEY }}",
      });
      for (const step of steps) {
        if (step.name !== installName) expect(step.run ?? "").not.toContain("producer-install");
        if (!A.contains([installName, runName, publishName], step.name ?? "")) {
          for (const value of R.values(step.env ?? {})) {
            if (S.is(S.String)(value)) expect(value).not.toContain("secrets.");
          }
        }
        expect(step.uses ?? "").not.toContain("actions/cache");
        expect(step.run ?? "").not.toContain("op read");
      }
      expect(stepByName(steps, "Retain only digest publication for one day").with).toEqual({
        name: "cache-producer-${{ github.run_id }}-${{ github.run_attempt }}",
        path: "${{ steps.private.outputs.root }}/publication/cache-producer.json",
        "if-no-files-found": "error",
        "retention-days": 1,
        "compression-level": 0,
      });
      expect(stepRun(steps, "Check bounded public digest report")).toContain("64*1024");
      expect(stepByName(steps, "Remove only this trial's private files and worktrees").if).toBe(
        "always() && steps.private.outputs.root != ''"
      );
      expect(yield* workflowPolicyDiagnostics("cache-producer.yml", text)).toEqual([]);
      expect(yield* workflowPolicyDiagnostics("heavy.yml", heavyText)).toEqual([]);
    })
  );

  it.effect("refuses disabled or malformed producer selection before any private trial setup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavy = parseWorkflowYaml(yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`));
      const script = stepRun(
        jobSteps(yield* workflowJobs(heavy), "producer-execute"),
        "Require independent frozen trial selection"
      );
      const directory = yield* fs.makeTempDirectoryScoped();
      const source = "1111111111111111111111111111111111111111";
      const base = {
        PATH: "/usr/bin:/bin",
        TRIAL_ENABLED: "true",
        EXPECTED_SOURCE: source,
        GITHUB_SHA: source,
        ADAPTER_RUN: "12",
        ADAPTER_ARTIFACT: "34",
        ADAPTER_SHA256: "1111111111111111111111111111111111111111111111111111111111111111",
      };
      const cases: ReadonlyArray<readonly [Readonly<Record<string, string>>, boolean]> = [
        [{}, true],
        [{ TRIAL_ENABLED: "" }, false],
        [{ EXPECTED_SOURCE: "private-marker" }, false],
        [{ ADAPTER_RUN: "" }, false],
        [{ ADAPTER_RUN: "1\nprivate-marker" }, false],
        [{ ADAPTER_ARTIFACT: "-1" }, false],
        [{ ADAPTER_SHA256: "private-marker" }, false],
      ];
      let index = 0;
      for (const [override, succeeds] of cases) {
        const output = `${directory}/output-${index++}`;
        yield* fs.writeFileString(output, "");
        const result = Bun.spawnSync(["/usr/bin/bash", "-c", script], {
          env: { ...base, ...override, GITHUB_OUTPUT: output },
          stdout: "pipe",
          stderr: "pipe",
        });
        expect(result.exitCode === 0).toBe(succeeds);
        const record = yield* fs.readFileString(output);
        if (succeeds) expect(record).toContain("run=12\nartifact=34\n");
        else expect(record).toBe("");
        expect(result.stdout.toString()).not.toContain("private-marker");
        expect(result.stderr.toString()).not.toContain("private-marker");
      }
    })
  );

  it.effect("keeps native Windows pipe verification read-only and bound to the collected scripts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const workflow = parseWorkflowYaml(yield* fs.readFileString(`${root}/.github/workflows/hub-pipe-security.yml`));
      const jobs = yield* workflowJobs(workflow);
      expect(yamlAt(workflow, ["permissions", "contents"])).toBe("read");
      expect(yamlAt(workflow, ["jobs", "pipe-scripts", "steps", 0, "with", "persist-credentials"])).toBe(false);
      expect(yamlAt(workflow, ["jobs", "pipe-scripts", "steps", 0, "with", "sparse-checkout"])).toBe(
        "/apps/practice-review-hub/deploy/windows/"
      );
      expect(yamlAt(workflow, ["jobs", "windows-pipe", "needs"])).toBe("pipe-scripts");
      expect(yamlAt(workflow, ["jobs", "windows-pipe", "runs-on"])).toBe("windows-latest");
      expect(yamlAt(workflow, ["jobs", "pipe-scripts", "steps", 1, "with", "name"])).toBe(
        yamlAt(workflow, ["jobs", "windows-pipe", "steps", 0, "with", "name"])
      );
      const verification = stepByName(
        jobSteps(jobs, "windows-pipe"),
        "Check same-user transfer and foreign-owned replacements"
      );
      expect(verification.run).toBe("./apps/practice-review-hub/deploy/windows/test-send-token.ps1");
      expect(yamlAt(workflow, ["jobs", "windows-pipe", "steps", 1, "shell"])).toBe("powershell");
    })
  );
  it.effect("keeps coverage comparison separate from Heavy and validates same-run producer artifacts", () =>
    Effect.gen(function* () {
      const policy = yield* readCredentialPolicySources();
      const jobs = yield* workflowJobs(policy.workflow);
      const comparison = jobSteps(jobs, "coverage-regression");
      expect(yamlAt(policy.workflow, ["jobs", "heavy", "needs"])).toEqual(["admission"]);
      // Audit M4: the comparison waits for Test Unit and the Labs producer, not
      // the whole verify matrix, and never starts inside a cancelled run.
      expect(yamlAt(policy.workflow, ["jobs", "coverage-regression", "needs"])).toEqual([
        "admission",
        "test-unit",
        "labs",
      ]);
      expect(yamlAt(policy.workflow, ["jobs", "coverage-regression", "if"])).toBe("${{ !cancelled() }}");
      expect(yamlAt(policy.workflow, ["jobs", "coverage-regression", "name"])).toBe(
        "${{ needs.admission.outputs.legacy_coverage == 'true' && 'Coverage Artifact Migration' || 'Heavy / Coverage Regression' }}"
      );
      expect(A.some(yield* heavyMatrixLanes(policy.heavyWorkflow), (lane) => lane.id === "coverage")).toBe(false);
      expect(policy.heavyWorkflowText).not.toContain("Verify coverage runtime features");
      expect(policy.heavyWorkflowText).not.toContain("append-turbo-summary --all");
      const download = stepByName(comparison, "Download coverage evidence");
      expect(download.uses).toBe("actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333");
      expect(download.with).toMatchObject({
        pattern: "unit-coverage-${{ github.run_id }}-*",
        path: ".beep/ci-coverage-inputs",
        "merge-multiple": false,
      });
      const compare = stepByName(comparison, "Compare coverage evidence");
      expect(compare.run).toContain("ci lane coverage --compare-only --coverage-input .beep/ci-coverage-inputs");
      expect(compare.run).not.toContain("ci lane test");
      assertNone(A.findFirst(comparison, (step) => step.uses === SETUP_MONOREPO_ACTION));
      expect(stepRun(comparison, "Install dependencies for coverage comparison")).toBe(
        "bun install --frozen-lockfile --ignore-scripts"
      );
      expect(stepByName(comparison, "Setup Node.js for coverage comparison").with?.["node-version"]).toBe("22.23.4");
      expect(
        A.every(comparison, (step) =>
          A.every(
            [...R.values(stepInputs(step)), ...R.values(stepEnvironment(step))],
            (value) => !Str.includes("secrets.")(String(value))
          )
        )
      ).toBe(true);
      expect(jobs["coverage-regression"]?.permissions).toEqual({ contents: "read", actions: "read" });
      for (const { job, name } of [
        { job: "test-unit-shard", name: "Upload Unit coverage evidence" },
        { job: "labs", name: "Upload Labs coverage evidence" },
      ]) {
        const upload = stepByName(jobSteps(jobs, job), name);
        expect(upload.if).toContain("always()");
        expect(upload.with?.["include-hidden-files"]).toBe(true);
        expect(upload.with?.["if-no-files-found"]).toBe("error");
        expect(upload.with?.name).toContain("${{ github.run_id }}-${{ github.run_attempt }}");
      }
      const labs = stepByName(jobSteps(jobs, "labs"), "Run Labs lane");
      expect(labs.run).toContain("--coverage-output .beep/ci-coverage/labs");
      expect(labs.run).toContain("--coverage-only");
      const gate = stepByName(comparison, "Determine comparison execution");
      expect(gate.run).toContain('[[ "$UNIT_RESULT" == "success" ]]');
      expect(gate.run).toContain('[[ "$ADMISSION_RESULT" == "success" ]]');
      expect(gate.run).not.toContain("verify.result");
    })
  );

  for (const scenario of [
    {
      name: "carried Labs execution",
      original: true,
      conclusion: "success",
      started: "08:00:00",
      completed: "08:04:00",
      output: "attempt=1\n",
    },
    {
      name: "actual Labs rerun",
      original: true,
      conclusion: "success",
      started: "09:00:00",
      completed: "09:04:00",
      output: "attempt=2\n",
    },
    {
      name: "failed latest Labs execution",
      original: true,
      conclusion: "failure",
      started: "09:00:00",
      completed: "09:04:00",
      output: "",
    },
    {
      name: "missing Labs attempt history",
      original: false,
      conclusion: "success",
      started: "08:00:00",
      completed: "08:04:00",
      output: "",
    },
  ]) {
    it.effect(`authenticates ${scenario.name} using the actual paginated workflow guard`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const policy = yield* readCredentialPolicySources();
        const comparison = jobSteps(yield* workflowJobs(policy.workflow), "coverage-regression");
        const authenticate = stepByName(comparison, "Authenticate latest Labs execution").run ?? "";
        const manifestGuard =
          Str.split(stepByName(comparison, "Compare coverage evidence").run ?? "", "shape_args=")[0] ?? "";
        expect(authenticate).toContain("--paginate --slurp");
        expect(manifestGuard).toContain('"$labs_manifest"');
        const temp = yield* fs.makeTempDirectoryScoped();
        const output = path.join(temp, "github-output");
        const calls = path.join(temp, "api-calls");
        yield* fs.writeFileString(output, "");
        yield* fs.writeFileString(
          path.join(temp, "gh"),
          '#!/bin/bash\nset -euo pipefail\n[[ "${@: -1}" =~ /attempts/([0-9]+)/jobs ]] || exit 24\nattempt="${BASH_REMATCH[1]}"\nprintf "%s\\n" "$attempt" >> "$API_CALLS"\ncat "$JOBS_FIXTURES/$attempt.json"\n'
        );
        yield* fs.chmod(path.join(temp, "gh"), 0o700);
        const original = {
          name: "Labs",
          run_attempt: 1,
          status: "completed",
          conclusion: "success",
          started_at: "2026-10-21T08:00:00Z",
          completed_at: "2026-10-21T08:04:00Z",
        };
        if (scenario.original) {
          yield* fs.writeFileString(
            path.join(temp, "1.json"),
            yield* encodeJobsFixture([{ jobs: [{ name: "Unrelated verification" }] }, { jobs: [original] }])
          );
        }
        yield* fs.writeFileString(
          path.join(temp, "2.json"),
          yield* encodeJobsFixture([
            { jobs: [{ name: "Unrelated verification" }] },
            {
              jobs: [
                {
                  ...original,
                  run_attempt: 2,
                  conclusion: scenario.conclusion,
                  started_at: `2026-10-21T${scenario.started}Z`,
                  completed_at: `2026-10-21T${scenario.completed}Z`,
                },
              ],
            },
          ])
        );
        const ambientPath = yield* Config.String("PATH");
        const env = {
          ...process.env,
          PATH: `${temp}:${ambientPath}`,
          RUNNER_TEMP: temp,
          GITHUB_OUTPUT: output,
          GITHUB_RUN_ID: "123",
          GITHUB_RUN_ATTEMPT: "2",
          GITHUB_REPOSITORY: "beep-effect/beep-effect",
          JOBS_FIXTURES: temp,
          API_CALLS: calls,
        };
        const result = Bun.spawnSync(["bash", "-c", authenticate], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
        expect(result.exitCode === 0).toBe(Str.isNonEmpty(scenario.output));
        expect(yield* fs.readFileString(output)).toBe(scenario.output);
        expect(yield* fs.readFileString(calls)).toBe(scenario.original ? "1\n2\n" : "1\n");
        if (Str.isNonEmpty(scenario.output)) {
          const attempt = parseProfileOutput(scenario.output).attempt ?? "";
          const manifest = path.join(temp, `.beep/ci-coverage-inputs/unit-coverage-123-${attempt}-labs/manifest.json`);
          yield* fs.makeDirectory(path.dirname(manifest), { recursive: true });
          yield* fs.writeFileString(
            manifest,
            yield* encodeJobsFixture({ partitionId: "labs", identity: { runId: "123", runAttempt: Number(attempt) } })
          );
          const accepted = Bun.spawnSync(["bash", "-c", manifestGuard], {
            cwd: temp,
            env: { ...env, LABS_PRODUCER_ATTEMPT: attempt },
            stdout: "pipe",
            stderr: "pipe",
          });
          expect(accepted.exitCode).toBe(0);
          yield* fs.remove(manifest);
          const missing = Bun.spawnSync(["bash", "-c", manifestGuard], {
            cwd: temp,
            env: { ...env, LABS_PRODUCER_ATTEMPT: attempt },
            stdout: "pipe",
            stderr: "pipe",
          });
          expect(missing.exitCode).not.toBe(0);
        }
      })
    );
  }

  it.effect("binds coverage rollout naming to GitHub's resolved reusable SHA and fails closed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const workflow = parseWorkflowYaml(yield* fs.readFileString(path.join(root, ".github/workflows/check.yml")));
      const jobs = yield* workflowJobs(workflow);
      const rollout = stepByName(jobSteps(jobs, "admission"), "Determine coverage rollout context");
      const script = rollout.run ?? "";
      expect(script).toContain(".referenced_workflows[]?");
      expect(script).toContain("length == 1");
      expect(script).toContain('git show "${heavy_sha}:.github/workflows/heavy.yml"');
      expect(script).not.toContain('git show "HEAD:');
      const temp = yield* fs.makeTempDirectoryScoped();
      const output = path.join(temp, "github-output");
      const fixture = path.join(temp, "resolved-heavy.yml");
      const calls = path.join(temp, "git-calls");
      const sha = "8086a42233ab3eab7265c8deb7a6f3816686d445";
      yield* fs.writeFileString(
        path.join(temp, "gh"),
        '#!/bin/bash\n[[ "${FAIL_API:-false}" != "true" ]] || exit 23\nprintf "%s\\n" "$RESOLVED_HEAVY_SHA"\n'
      );
      yield* fs.writeFileString(
        path.join(temp, "git"),
        '#!/bin/bash\nprintf "%s\\n" "$*" >> "$GIT_CALLS"\ncase "$1" in\n  fetch) exit 0 ;;\n  show) [[ "$2" == "$RESOLVED_HEAVY_SHA:.github/workflows/heavy.yml" ]] || exit 24; cat "$HEAVY_FIXTURE" ;;\n  *) exit 25 ;;\nesac\n'
      );
      yield* fs.chmod(path.join(temp, "gh"), 0o700);
      yield* fs.chmod(path.join(temp, "git"), 0o700);
      const ambientPath = yield* Config.String("PATH");
      for (const legacy of [true, false]) {
        yield* fs.writeFileString(
          fixture,
          legacy
            ? "on: push\njobs:\n  verify:\n    name: ${{ matrix.name }}\n    strategy:\n      matrix:\n        include:\n          - id: coverage\n            name: Coverage Regression\n"
            : "on: push\njobs:\n  verify:\n    name: Check\n"
        );
        yield* fs.writeFileString(output, "");
        const result = Bun.spawnSync(["bash", "-c", script], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${temp}:${ambientPath}`,
            RUNNER_TEMP: temp,
            GITHUB_OUTPUT: output,
            GITHUB_RUN_ID: "1",
            GITHUB_REPOSITORY: "beep-effect/beep-effect",
            RESOLVED_HEAVY_SHA: sha,
            HEAVY_FIXTURE: fixture,
            GIT_CALLS: calls,
          },
          stdout: "pipe",
          stderr: "pipe",
        });
        expect(result.stderr.toString()).toBe("");
        expect(result.exitCode).toBe(0);
        expect(yield* fs.readFileString(output)).toBe(`legacy_coverage=${legacy}\n`);
      }
      yield* fs.writeFileString(output, "");
      const failed = Bun.spawnSync(["bash", "-c", script], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${temp}:${ambientPath}`,
          RUNNER_TEMP: temp,
          GITHUB_OUTPUT: output,
          GITHUB_RUN_ID: "1",
          GITHUB_REPOSITORY: "beep-effect/beep-effect",
          RESOLVED_HEAVY_SHA: sha,
          HEAVY_FIXTURE: fixture,
          GIT_CALLS: calls,
          FAIL_API: "true",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(failed.exitCode).toBe(23);
      expect(yield* fs.readFileString(output)).toBe("");
      expect(yield* fs.readFileString(calls)).toContain(`show ${sha}:.github/workflows/heavy.yml`);
    })
  );
});
const OperationalPatternsJson = S.fromJsonString(CiOperationalPatterns);
