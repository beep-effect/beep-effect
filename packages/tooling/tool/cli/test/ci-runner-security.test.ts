import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseDocument } from "yaml";
import type { Document } from "yaml";

const SETUP_MONOREPO_ACTION = "./.github/actions/setup-monorepo-ci";

// Explicit secret inputs of setup-monorepo-ci: the Turbo tokens plus the
// application secret block scripts/ci-job-env.mjs allowlists. The script,
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
const SECRET_INPUT_LINES = A.map(SECRET_INPUTS, secretInputLine);
const SECRET_REFERENCES = A.map(SECRET_INPUTS, ([, name]) => `secrets.${name}`);

const WorkflowStep = S.Struct({
  name: S.optionalKey(S.String),
  if: S.optionalKey(S.String),
  uses: S.optionalKey(S.String),
  with: S.optionalKey(S.Record(S.String, S.Unknown)),
  env: S.optionalKey(S.Record(S.String, S.Unknown)),
});
type WorkflowStep = typeof WorkflowStep.Type;
const WorkflowJobs = S.Record(S.String, S.Struct({ steps: WorkflowStep.pipe(S.Array, S.optionalKey) }));
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

const stepInputs = (step: WorkflowStep): Readonly<Record<string, unknown>> => step.with ?? {};

const stepEnvironment = (step: WorkflowStep): Readonly<Record<string, unknown>> => step.env ?? {};

const setupMonorepoInputs = (jobs: WorkflowJobs, jobId: string): Readonly<Record<string, unknown>> =>
  stepInputs(setupMonorepoStep(jobs, jobId));

// The cache key a job's post-lane Turbo fallback save step writes under.
const fallbackSaveKey = (jobs: WorkflowJobs, jobId: string): unknown =>
  stepInputs(stepByName(jobSteps(jobs, jobId), "Save post-lane Turbo fallback")).key;

// A parsed YAML document, failing the case on any parse error.
const parsedDocument = (text: string): Document => {
  const document = parseDocument(text);
  assert.lengthOf(document.errors, 0);
  return document;
};

// $GITHUB_ENV heredoc form written by scripts/ci-job-env.mjs:
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
  const jobEnvScriptText = yield* readText("scripts/ci-job-env.mjs");

  return {
    workflowText,
    heavyWorkflowText,
    storybookText,
    actionText,
    jobEnvScriptText,
    workflow: parsedDocument(workflowText),
    heavyWorkflow: parsedDocument(heavyWorkflowText),
    storybook: parsedDocument(storybookText),
    action: parsedDocument(actionText),
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
const turboJobTable = (documents: {
  readonly workflow: Document;
  readonly heavyWorkflow: Document;
  readonly storybook: Document;
}): ReadonlyArray<readonly [WorkflowJobs, string, boolean]> => {
  const check = workflowJobs(documents.workflow);

  return [
    [check, "verify", true],
    [check, "lint-shard", true],
    [check, "test-unit-shard", true],
    [check, "property-laws", true],
    [check, "fallow-advisory", false],
    [check, "build", true],
    [workflowJobs(documents.heavyWorkflow), "verify", true],
    [workflowJobs(documents.storybook), "storybook", false],
  ];
};

// One Turbo job's setup-monorepo-ci call: the remote-cache tuple comes from
// repository variables, the Turbo tokens from their explicit inputs, and the
// application secrets only where the job is allowed them.
const assertTurboJobSetup = (jobs: WorkflowJobs, jobId: string, appSecrets: boolean): void => {
  const inputs = setupMonorepoInputs(jobs, jobId);
  assert.strictEqual(inputs["turbo-remote-cache"], "true", jobId);
  assert.strictEqual(inputs["turbo-api"], "${{ vars.TURBO_API }}", jobId);
  assert.strictEqual(inputs["turbo-team"], "${{ vars.TURBO_TEAM }}", jobId);
  assert.isUndefined(inputs["repository-secrets"], jobId);
  for (const [input, name] of TURBO_SECRET_INPUTS) {
    assert.strictEqual(inputs[input], secretReference(name), `${jobId} ${input}`);
  }
  for (const [input, name] of APP_SECRET_INPUTS) {
    assert.strictEqual(inputs[input], appSecrets ? secretReference(name) : undefined, `${jobId} ${input}`);
  }
  assert.strictEqual(inputs["app-secrets"], appSecrets ? "true" : undefined, jobId);
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

      const git = gitIn(tempRoot);
      const profile = (eventName: string, outputPath = ""): Readonly<Record<string, string>> =>
        changeProfile(scriptPath, tempRoot, eventName, outputPath);

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
      assert.strictEqual(profile("pull_request", outputPath).goals_only, "true");
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
      }

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

      yield* fs.makeDirectory(path.join(tempRoot, "src"));
      yield* fs.writeFileString(path.join(tempRoot, "src", "index.ts"), "export {}\n");
      git(["add", "."]);
      git(["commit", "-m", "mixed"]);
      assert.strictEqual(profile("pull_request").goals_only, "false");
      assert.strictEqual(profile("push").goals_only, "false");
    }, provideScopedLayer(NodeServices.layer))
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
      const workflow = parseDocument(workflowText);
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

      const steps = jobSteps(workflowJobs(workflow), "professional-desktop-ipc-stdio");
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
      assert.include(workflowText, 'eval "$(scripts/ci-change-profile.sh');
      assert.include(workflowText, 'rust_should_run="$desktop_rust_relevant"');
      assert.include(workflowText, "run: cargo check --locked");
      assert.include(workflowText, "run: cargo clippy --locked -- -D warnings");
      assert.include(workflowText, "working-directory: apps/professional-desktop/src-tauri");
      // tauri-build needs the sidecar binary, so the cargo steps follow the
      // IPC proof that builds it.
      assert.isBelow(stepIndexByName(steps, "Run desktop IPC stdio proof"), stepIndexByName(steps, "Check Rust crate"));
      assert.isBelow(stepIndexByName(steps, "Check Rust crate"), stepIndexByName(steps, "Lint Rust crate"));
    }, provideScopedLayer(NodeServices.layer))
  );

  // Quality-lane audit D13 (revised in PR #1054 review): the workflow gates
  // Storybook only on goals_only and lets the lane decide through Turbo's
  // dependency-aware affected probe, restores the Playwright browser cache on
  // every event, and saves it only on trusted pushes. A path profile cannot
  // see transitive workspace dependencies, so none is emitted for Storybook.
  it.effect(
    "gates the Storybook lane on goals_only alone and keeps the browser cache push-saved",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const scriptPath = path.join(repoRoot, "scripts/ci-change-profile.sh");
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
      const workflow = parseDocument(workflowText);
      const git = gitIn(tempRoot);
      const profile = (eventName: string) => changeProfile(scriptPath, tempRoot, eventName);

      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
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

      assert.lengthOf(workflow.errors, 0);
      const steps = jobSteps(workflowJobs(workflow), "storybook");
      const gate = "steps.lane-gate.outputs.should_run == 'true'";
      for (const name of [
        "Setup monorepo CI",
        "Restore Playwright Chromium cache",
        "Install Playwright Chromium",
        "Run Storybook lane",
        "Upload Storybook static artifact",
      ]) {
        assert.strictEqual(stepByName(steps, name).if, gate, name);
      }
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]; then');
      assert.include(workflowText, 'shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")');
      const restore = stepByName(steps, "Restore Playwright Chromium cache");
      const save = stepByName(steps, "Save Playwright Chromium cache");
      assert.strictEqual(restore.with?.path, "~/.cache/ms-playwright");
      assert.strictEqual(restore.with?.key, "playwright-chromium-${{ runner.os }}-${{ hashFiles('bun.lock') }}");
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
      assert.strictEqual(workflow.getIn(["jobs", "storybook", "name"]), "Storybook");
      assert.strictEqual(
        workflow.getIn(["jobs", "storybook", "environment"]),
        "${{ github.event_name == 'push' && 'turbo-cache-write' || null }}"
      );
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
    "keeps every hand-copied Turbo credential and secret inventory out of the workflows",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();

      assert.isUndefined(policy.workflow.getIn(["on", "pull_request_target"]));
      assert.isDefined(policy.workflow.getIn(["on", "pull_request"]));
      // No workflow hand-copies the credential tuple any more: the selection
      // lives once in scripts/ci-job-env.mjs behind the composite action. The
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
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "maps each explicit setup-monorepo-ci secret input onto the policy script's allowlist",
    Effect.fnUntraced(function* () {
      const { action, actionText, jobEnvScriptText } = yield* readCredentialPolicySources();

      assert.include(actionText, "run: bun scripts/ci-job-env.mjs");
      assert.include(actionText, "BEEP_CI_HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}");
      // The action maps each explicit input to BEEP_CI_SECRET_<NAME>; the
      // script's allowlist names the same secrets.
      assert.notInclude(actionText, "toJSON(secrets)");
      assert.isUndefined(action.getIn(["inputs", "repository-secrets"]));
      const exportEnvironment = stepEnvironment(
        stepByName(decodeWorkflowSteps(action.toJS().runs.steps), "Export job environment")
      );
      assert.isUndefined(exportEnvironment.BEEP_CI_SECRETS_JSON);
      for (const [input, name] of SECRET_INPUTS) {
        assert.strictEqual(action.getIn(["inputs", input, "default"]), "", input);
        assert.strictEqual(exportEnvironment[`BEEP_CI_SECRET_${name}`], `\${{ inputs.${input} }}`, input);
        assert.include(jobEnvScriptText, `"${name}"`, name);
      }
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "routes every Turbo job's cache credentials through the single setup-monorepo-ci policy",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();

      for (const [jobs, jobId, appSecrets] of turboJobTable(policy)) {
        assertTurboJobSetup(jobs, jobId, appSecrets);
      }
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "saves the Turbo cache only from the Build job on push",
    Effect.fnUntraced(function* () {
      const policy = yield* readCredentialPolicySources();
      const { workflow, workflowText } = policy;

      // Pull requests never publish a cache entry; Build saves only on push.
      for (const [jobs, jobId] of turboJobTable(policy)) {
        if (jobId === "build") continue;
        assert.strictEqual(setupMonorepoInputs(jobs, jobId)["cache-write"], "false", jobId);
      }
      // Quality-lane audit D12: Build runs on pull requests (affected-scoped,
      // remote-cache read) and keeps the write environment for pushes only.
      assert.isUndefined(workflow.getIn(["jobs", "build", "if"]));
      assert.strictEqual(
        workflow.getIn(["jobs", "build", "environment"]),
        "${{ github.event_name == 'push' && 'turbo-cache-write' || null }}"
      );
      assert.strictEqual(
        setupMonorepoInputs(workflowJobs(workflow), "build")["cache-write"],
        "${{ github.event_name == 'push' && 'true' || 'false' }}"
      );
      assert.include(workflowText, 'bun run beep ci lane build "${shape_args[@]}"');
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps the lane shapes the workflows hand to the CLI",
    Effect.fnUntraced(function* () {
      const { workflowText, heavyWorkflowText } = yield* readCredentialPolicySources();

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
        const result = Bun.spawnSync([process.execPath, scriptPath], {
          cwd: repoRoot,
          env: {
            ...process.env,
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
      const action = parsedDocument(actionText);
      const check = parsedDocument(checkText);
      const heavy = parsedDocument(heavyText);

      assert.strictEqual(action.getIn(["inputs", "turbo-cache-key-suffix", "default"]), "");
      assert.include(actionText, "${{ github.job }}${{ inputs.turbo-cache-key-suffix }}-");
      const actionSteps = decodeWorkflowSteps(action.toJS().runs.steps);
      const turboRestore = stepByName(actionSteps, "Restore Turbo cache (local fallback only)");
      assert.strictEqual(
        Str.trim(String(stepInputs(turboRestore)["restore-keys"])),
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
      assert.strictEqual(setupMonorepoInputs(checkJobs, "verify")["turbo-cache-key-suffix"], "-${{ matrix.id }}");
      assert.strictEqual(
        setupMonorepoInputs(checkJobs, "lint-shard")["turbo-cache-key-suffix"],
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(
        setupMonorepoInputs(checkJobs, "test-unit-shard")["turbo-cache-key-suffix"],
        "-${{ matrix.partition }}"
      );
      assert.strictEqual(setupMonorepoInputs(heavyJobs, "verify")["turbo-cache-key-suffix"], "-${{ matrix.id }}");
      assert.include(String(fallbackSaveKey(checkJobs, "verify")), "-${{ github.job }}-${{ matrix.id }}-");
      assert.include(String(fallbackSaveKey(checkJobs, "lint-shard")), "-${{ github.job }}-${{ matrix.partition }}-");
      assert.include(
        String(fallbackSaveKey(checkJobs, "test-unit-shard")),
        "-${{ github.job }}-${{ matrix.partition }}-"
      );
      assert.include(String(fallbackSaveKey(heavyJobs, "verify")), "-${{ github.job }}-${{ matrix.id }}-");
      // Disk cleanup is the composite action's job now; the shards keep the
      // 64 GiB short-circuit and the matrix lanes always clean.
      assert.notInclude(checkText, "Free runner disk");
      assert.notInclude(heavyText, "Free runner disk");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "verify")["free-disk"], "true");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "lint-shard")["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "test-unit-shard")["free-disk-min-gib"], "64");
      assert.strictEqual(setupMonorepoInputs(checkJobs, "fallow-advisory")["free-disk"], "true");
      assert.strictEqual(setupMonorepoInputs(heavyJobs, "verify")["free-disk"], "true");
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
