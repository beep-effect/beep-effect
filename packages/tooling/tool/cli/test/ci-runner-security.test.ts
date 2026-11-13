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
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";
import type { CiRelevanceLane } from "@beep/repo-cli/commands/Ci";

const SETUP_MONOREPO_ACTION = "./.github/actions/setup-monorepo-ci";
const LANE_GATED = "steps.lane-gate.outputs.should_run == 'true'";
const LANE_SKIPPED = "steps.lane-gate.outputs.should_run != 'true'";
type TierOneGates = { readonly setup: string; readonly skip: string };
// Repo Sanity also sets up, and reports no skip, on its documentation path.
const TIER_ONE_GATES: Readonly<Record<string, TierOneGates>> = {
  verify: {
    setup: `${LANE_GATED} || steps.lane-gate.outputs.docs_path == 'true'`,
    skip: `${LANE_SKIPPED} && steps.lane-gate.outputs.docs_path != 'true'`,
  },
};
const tierOneGates = (jobId: string): TierOneGates =>
  O.getOrElse(R.get(TIER_ONE_GATES, jobId), () => ({ setup: LANE_GATED, skip: LANE_SKIPPED }));
const laneRow = (lane: CiRelevanceLane): string =>
  O.getOrElse(O.fromUndefinedOr(ciOperationalPatterns.lanes?.[lane]), () => "");

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
const LANE_WRITE_TOKEN =
  "${{ github.event_name == 'push' && env.BEEP_CI_LANE_USES_TURBO == 'true' && secrets.TURBO_TOKEN || '' }}";
const SECRET_INPUT_LINES = [...A.map(SECRET_INPUTS, secretInputLine), `turbo-token: ${LANE_WRITE_TOKEN}`];
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

const workflowJobs = Effect.fnUntraced(function* (document: unknown) {
  return yield* decodeWorkflowJobs(yamlAt(document, ["jobs"]));
});

// Enumerate every job, including unexpected jobs without Turbo metadata.
const isYamlSequence = S.is(S.Array(S.Unknown));
const heavyLaneParameters = (document: unknown) =>
  decodeYamlRecord(yamlAt(document, ["jobs"]) ?? {}).pipe(
    Effect.flatMap((jobs) =>
      Effect.forEach(
        R.keys(jobs),
        (job) =>
          decodeYamlRecord(yamlAt(document, ["jobs", job, "env"]) ?? {}).pipe(
            Effect.map((env) => {
              const entries = O.fromUndefinedOr(yamlAt(document, ["jobs", job, "strategy", "matrix", "include"])).pipe(
                O.map((value) => {
                  assertTrue(isYamlSequence(value));
                  return value;
                }),
                O.getOrElse(A.empty)
              );
              return {
                job,
                id: env.BEEP_CI_LANE_ID,
                ids: [job, env.BEEP_CI_LANE_ID, ...A.map(entries, (entry) => yamlAt(entry, ["id"]))],
                name: env.BEEP_CI_LANE_NAME,
                uses_turbo: env.BEEP_CI_LANE_USES_TURBO,
                docgen_concurrency: env.BEEP_DOCGEN_CONCURRENCY,
              };
            })
          ),
        { concurrency: 1 }
      )
    )
  );

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
// first, through the fetched CI binary's `beep ci prune-apt`.
const PRUNE_APT_SOURCES = "beep ci prune-apt";
const assertPrunesAptSourcesBefore = (run: string, command: string): void => {
  assert.match(run, /^[\t ]*beep[\t ]+ci[\t ]+prune-apt[\t ]*$/mu);
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

// The slim entry the compiled CI binary is built from; `bun <entry>` stands in
// for the `beep` the fetch-beep-ci action puts on PATH.
const CI_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";
const FETCH_BEEP_CI_ACTION = "./.github/actions/fetch-beep-ci";
// The typed commands that replaced the cache-pilot shell adapters.
const CACHE_PILOT_HOST_SOURCE = "packages/tooling/tool/cli/src/commands/Ci/CiCachePilotHost.ts";
const CACHE_PILOT_INPUTS_SOURCE = "packages/tooling/tool/cli/src/commands/Ci/CiCachePilotInputs.ts";

const changeProfile = (
  cliEntry: string,
  cwd: string,
  eventName: string,
  outputPath = ""
): Readonly<Record<string, string>> => {
  const result = Bun.spawnSync(["bun", cliEntry, "ci", "change-profile", "origin/main", "HEAD"], {
    cwd,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_OUTPUT: outputPath,
      BEEP_CI_PR_BASE_SHA: "",
      BEEP_CI_PR_HEAD_SHA: "",
    },
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
    [check, "property-laws-shard", true],
    [check, "fallow-advisory", false],
    [check, "jsdoc-ratchet", false],
    [yield* workflowJobs(documents.heavyWorkflow), "verify", true],
    [yield* workflowJobs(documents.storybook), "storybook", false],
  ] satisfies ReadonlyArray<readonly [WorkflowJobs, string, boolean]>;
});

// One Turbo job's setup-monorepo-ci call: the remote-cache tuple comes from
// repository variables, the Turbo tokens from their explicit inputs, and the
// application secrets only where the job is allowed them.
const assertTurboJobSetup = (jobs: WorkflowJobs, jobId: string, appSecrets: boolean): void => {
  const inputs = setupMonorepoInputs(jobs, jobId);
  assert.strictEqual(
    inputs["turbo-remote-cache"],
    jobId === "verify" ? "${{ env.BEEP_CI_LANE_USES_TURBO }}" : "true",
    jobId
  );
  assert.strictEqual(inputs["turbo-api"], "${{ vars.TURBO_API }}", jobId);
  assert.strictEqual(inputs["turbo-team"], "${{ vars.TURBO_TEAM }}", jobId);
  assert.isUndefined(inputs["repository-secrets"], jobId);
  assert.strictEqual(
    inputs["turbo-token"],
    jobId === "verify" ? LANE_WRITE_TOKEN : secretReference("TURBO_TOKEN"),
    `${jobId} turbo-token`
  );
  assert.strictEqual(inputs["turbo-read-token"], secretReference("TURBO_READ_TOKEN"), `${jobId} turbo-read-token`);
  for (const [input, name] of APP_SECRET_INPUTS) {
    assert.strictEqual(inputs[input], appSecrets ? secretReference(name) : undefined, `${jobId} ${input}`);
  }
  assert.strictEqual(inputs["app-secrets"], appSecrets ? "true" : undefined, jobId);
};

it.layer(NodeServices.layer, { timeout: "30 seconds" })("CI runner security", (it) => {
  it.effect("requires a real apt-pruning command before refreshing package indexes", () =>
    Effect.sync(() => {
      const update = "sudo apt-get update";
      assert.doesNotThrow(() => assertPrunesAptSourcesBefore(`${PRUNE_APT_SOURCES}\n${update}`, update));
      assert.doesNotThrow(() => assertPrunesAptSourcesBefore(`  ${PRUNE_APT_SOURCES}\n${update}`, update));
      assert.throws(() => assertPrunesAptSourcesBefore(`bash scripts/ci-prune-apt-sources.sh\n${update}`, update));
      assert.throws(() => assertPrunesAptSourcesBefore(`# ${PRUNE_APT_SOURCES}\n${update}`, update));
      assert.throws(() => assertPrunesAptSourcesBefore(`echo ${PRUNE_APT_SOURCES}\n${update}`, update));
      assert.throws(() => assertPrunesAptSourcesBefore(`${update}\n${PRUNE_APT_SOURCES}`, update));
    })
  );

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
    "gives every Heavy caller the read-only permission ceiling required by its nested producer",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyYaml = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyYaml);
      const requested = yamlAt(heavy, ["jobs", "producer-execute", "permissions"]);
      expect(requested).toEqual({ contents: "read", actions: "read" });
      expect(yamlAt(heavy, ["permissions"])).toEqual({ contents: "read" });
      for (const { file, job } of [
        { file: "check.yml", job: "heavy" },
        { file: "heavy-admit.yml", job: "heavy" },
        { file: "cache-producer-inspect.yml", job: "inspect" },
        { file: "cache-producer-prepare.yml", job: "prepare" },
        { file: "cache-local-observe.yml", job: "observe" },
        { file: "cache-producer.yml", job: "produce" },
      ]) {
        const workflowYaml = yield* fs.readFileString(`${root}/.github/workflows/${file}`);
        const workflow = parseWorkflowYaml(workflowYaml);
        expect(yamlAt(workflow, ["jobs", job, "uses"])).toBe(
          "beep-effect/beep-effect/.github/workflows/heavy.yml@main"
        );
        const permissions = O.fromUndefinedOr(yamlAt(workflow, ["jobs", job, "permissions"])).pipe(
          O.getOrElse(() => yamlAt(workflow, ["permissions"]))
        );
        assert.deepEqual(permissions, requested, file);
      }
    })
  );
  it.effect(
    "scopes hosted governance reads to Security and exercises its job token on pull requests",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const readFileString1 = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const jobs = yield* workflowJobs(parseWorkflowYaml(readFileString1));
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
      // Workflow policy runs in the Repo Sanity lane body (no separate step,
      // so its red cannot skip the body); that step carries no secret env.
      expect(A.some(jobSteps(jobs, "verify"), (step) => step.name === "Check workflow policy")).toBe(false);
      expect(stepByName(jobSteps(jobs, "verify"), "Run verification lane").env).toBeUndefined();
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
      const readFileString2 = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseWorkflowYaml(readFileString2);
      const decodedYamlRecord = yield* decodeYamlRecord(yamlAt(workflow, ["on"]));
      const triggers = R.keys(decodedYamlRecord);
      expect(triggers).toContain("pull_request");
      expect(triggers).not.toContain("pull_request_target");
      expect(yamlAt(workflow, ["permissions"])).toEqual({ contents: "read" });
      expect(yamlAt(workflow, ["jobs", "security", "name"])).toBe("Security");
      // Security runs when the diff touches what it reads; every main push gets the full profile.
      expect(yamlAt(workflow, ["jobs", "security", "needs"])).toEqual(["change-profile"]);
      expect(yamlAt(workflow, ["jobs", "security", "if"])).toBe(
        "${{ !cancelled() && needs.change-profile.outputs.docs_only != 'true' && needs.change-profile.outputs.security_relevant != 'false' }}"
      );
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
    "hands the requested PR lane to the fetched binary's resource measurement",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const readFileString3 = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/heavy.yml"));
      const workflow = parseWorkflowYaml(readFileString3);
      const workflowJobs4 = yield* workflowJobs(workflow);
      const steps = jobSteps(workflowJobs4, "verify");
      assert.strictEqual(stepByName(steps, "Fetch beep CI binary").uses, FETCH_BEEP_CI_ACTION);
      assert.isBelow(stepIndexByName(steps, "Fetch beep CI binary"), stepIndexByName(steps, "Run verification lane"));
      const run = pipe(stepRun(steps, "Run verification lane"), Str.replaceAll("${{ env.BEEP_CI_LANE_ID }}", "check"));
      assert.notInclude(run, "scripts/ci-runner-resources.sh");
      // A recording `beep` stands in for the fetched binary.
      const fakeBeep = path.join(tempRoot, "beep");
      yield* fs.writeFileString(fakeBeep, '#!/usr/bin/env bash\nprintf "<%s>\\n" "$@"\nexit 7\n');
      yield* fs.chmod(fakeBeep, 0o755);
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
      assert.include(
        result.stdout.toString(),
        "<ci>\n<runner-resources>\n<check>\n<-->\n<bun>\n<run>\n<beep>\n<ci>\n<lane>\n<check>\n<--affected>\n<--base>\n<origin/main>\n<--summarize>\n"
      );
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
          "bun",
          path.join(root, CI_ENTRY),
          "ci",
          "runner-resources",
          "check",
          "--",
          "bash",
          "-c",
          'printf run >> "$1"; exit 7',
          "fixture",
          receipt,
        ],
        { env: { ...process.env, RUNNER_TEMP: temp }, stderr: "pipe", stdout: "pipe" }
      );
      assert.strictEqual(result.exitCode, 7);
      const readFileString6 = yield* fs.readFileString(receipt);
      assert.strictEqual(readFileString6, "run");
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
          "bun",
          path.join(repoRoot, CI_ENTRY),
          "ci",
          "runner-resources",
          "check",
          "--",
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
        ["bun", path.join(repoRoot, CI_ENTRY), "ci", "runner-resources", "check", "--", "bash", "-c", "exit 9"],
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
            "bun",
            path.join(repoRoot, CI_ENTRY),
            "ci",
            "runner-resources",
            "check",
            "--",
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
        ["bun", path.join(repoRoot, CI_ENTRY), "ci", "runner-resources", "check", "--", "bash", "-c", "exit 9"],
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
            "bun",
            path.join(repoRoot, CI_ENTRY),
            "ci",
            "runner-resources",
            "fixture",
            "--",
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
          [
            "bun",
            path.join(repoRoot, CI_ENTRY),
            "ci",
            "runner-resources",
            lane,
            "--",
            "bash",
            "-c",
            script,
            "fixture",
            proc,
          ],
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
      const result = Bun.spawnSync(
        ["bun", path.join(repoRoot, CI_ENTRY), "ci", "runner-resources", "fixture", "--", "cat"],
        {
          env: { ...process.env, RUNNER_TEMP: tempRoot },
          stdin: new TextEncoder().encode("fixture input\n"),
          stdout: "pipe",
          stderr: "pipe",
        }
      );
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
          "bun",
          path.join(repoRoot, CI_ENTRY),
          "ci",
          "runner-resources",
          "fixture",
          "--",
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
    "classifies pinned PR changes independently of newer main code in the merge checkout",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const cliEntry = path.join(repoRoot, CI_ENTRY);
      const git = gitIn(tempRoot);
      const commit = (message: string) => {
        git(["add", "."]);
        git(["commit", "-m", message]);
        return git(["rev-parse", "HEAD"]);
      };
      const profile = (base: string, head: string, eventName = "pull_request") => {
        const result = Bun.spawnSync(["bun", cliEntry, "ci", "change-profile"], {
          cwd: tempRoot,
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: eventName,
            GITHUB_OUTPUT: "",
            BEEP_CI_PR_BASE_SHA: base,
            BEEP_CI_PR_HEAD_SHA: head,
          },
          stderr: "pipe",
          stdout: "pipe",
        });
        assert.strictEqual(result.exitCode, 0, result.stderr.toString());
        return parseProfileOutput(result.stdout.toString());
      };
      const fullProfile = {
        goals_only: "false",
        docs_only: "false",
        desktop_rust_relevant: "true",
        codegen_relevant: "true",
        ecosystem_relevant: "true",
        nix_relevant: "true",
        desktop_ipc_relevant: "true",
        sast_relevant: "true",
        security_relevant: "true",
      };
      git(["init"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      git(["checkout", "-b", "fixture-main"]);
      yield* fs.makeDirectory(path.join(tempRoot, "packages/example"), { recursive: true });
      yield* fs.writeFileString(path.join(tempRoot, "packages/example/index.ts"), "export {};\n");
      const base = commit("baseline");
      git(["checkout", "-b", "fixture-docs"]);
      yield* fs.makeDirectory(path.join(tempRoot, "docs"));
      yield* fs.writeFileString(path.join(tempRoot, "docs/notes.md"), "# documentation\n");
      const docsHead = commit("docs branch");
      git(["checkout", "fixture-main"]);
      yield* fs.writeFileString(path.join(tempRoot, "packages/example/main.ts"), "export {};\n");
      commit("main advances with code");
      git(["merge", "--no-ff", "fixture-docs", "-m", "synthetic merge"]);
      const mergeHead = git(["rev-parse", "HEAD"]);
      assert.include(git(["diff", "--name-only", `${base}...HEAD`]), "packages/example/main.ts");
      assert.strictEqual(profile(base, docsHead).docs_only, "true");
      assert.strictEqual(profile(base, docsHead).desktop_rust_relevant, "false");
      assert.strictEqual(git(["rev-parse", "HEAD"]), mergeHead);
      assert.deepStrictEqual(profile(base, docsHead, "push"), fullProfile);
      const unknownRefs: ReadonlyArray<readonly [string, string]> = [
        ["", docsHead],
        [base, ""],
        ["missing-base", docsHead],
        [base, "missing-head"],
      ];
      for (const [unknownBase, unknownHead] of unknownRefs) {
        assert.deepStrictEqual(profile(unknownBase, unknownHead), fullProfile);
      }
      // Deletions and code renamed into docs keep verification active.
      git(["checkout", "-b", "fixture-code", base]);
      yield* fs.writeFileString(path.join(tempRoot, "packages/example/pr.ts"), "export {};\n");
      const codeHead = commit("PR changes code");
      git(["checkout", "--detach", mergeHead]);
      assert.strictEqual(profile(base, codeHead).docs_only, "false");
      git(["checkout", "-b", "fixture-deletion", base]);
      git(["rm", "packages/example/index.ts"]);
      const deletionHead = commit("PR deletes code");
      assert.strictEqual(profile(base, deletionHead).docs_only, "false");
      git(["checkout", "-b", "fixture-rename", base]);
      yield* fs.makeDirectory(path.join(tempRoot, "docs"), { recursive: true });
      git(["mv", "packages/example/index.ts", "docs/moved.md"]);
      const renameHead = commit("PR moves code into docs");
      assert.strictEqual(profile(base, renameHead).docs_only, "false");
      const typedRename = Bun.spawnSync(
        [
          "bun",
          path.join(repoRoot, "packages/tooling/tool/cli/src/bin.ts"),
          "--",
          "ci",
          "change-profile",
          base,
          "HEAD",
        ],
        {
          cwd: tempRoot,
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "pull_request",
            GITHUB_OUTPUT: "",
            BEEP_CI_PR_BASE_SHA: "",
            BEEP_CI_PR_HEAD_SHA: "",
          },
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      assert.strictEqual(typedRename.exitCode, 0, typedRename.stderr.toString());
      assert.deepStrictEqual(parseProfileOutput(typedRename.stdout.toString()), profile(base, renameHead));

      // Reusable Heavy retains the calling event's GitHub context.
      for (const name of ["check", "heavy", "storybook"]) {
        const source = yield* fs.readFileString(path.join(repoRoot, `.github/workflows/${name}.yml`));
        const workflow = parseWorkflowYaml(source);
        assert.strictEqual(
          yamlAt(workflow, ["env", "BEEP_CI_PR_BASE_SHA"]),
          "${{ github.event.pull_request.base.sha }}"
        );
        assert.strictEqual(
          yamlAt(workflow, ["env", "BEEP_CI_PR_HEAD_SHA"]),
          "${{ github.event.pull_request.head.sha }}"
        );
        assert.notInclude(source, 'beep ci change-profile "origin/');
        assert.notInclude(source, 'beep ci change-profile "$BEEP_COVERAGE_BASE_SHA"');
      }
    })
  );

  it.effect.each([
    { scenario: "packet prose" },
    { scenario: "nested fixture paths" },
    { scenario: "documentation and push" },
    { scenario: "goal helpers and mixed" },
  ] as const)("classifies $scenario without suppressing mixed or push runs", ({ scenario }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const cliEntry = path.join(repoRoot, CI_ENTRY);

      const git = gitIn(tempRoot);
      const profile = (eventName: string, outputPath = ""): Readonly<Record<string, string>> => {
        const bootstrap = changeProfile(cliEntry, tempRoot, eventName, outputPath);
        const typed = Bun.spawnSync(
          [
            "bun",
            path.join(repoRoot, "packages/tooling/tool/cli/src/bin.ts"),
            "--",
            "ci",
            "change-profile",
            "origin/main",
            "HEAD",
          ],
          {
            cwd: tempRoot,
            env: {
              ...process.env,
              GITHUB_EVENT_NAME: eventName,
              GITHUB_OUTPUT: "",
              BEEP_CI_PR_BASE_SHA: "",
              BEEP_CI_PR_HEAD_SHA: "",
            },
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
      const metadata = Effect.gen(function* () {
        yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# goals-only\n");
        git(["add", "."]);
        git(["commit", "-m", "goals-only"]);
        yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "ops"));
        yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "ops", "manifest.json"), "{}\n");
        git(["add", "."]);
        git(["commit", "-m", "goal metadata"]);
        for (const directory of ["history", "history/reflections", "research"]) {
          yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", directory), { recursive: true });
          yield* fs.writeFileString(path.join(tempRoot, "goals", "example", directory, ".gitkeep"), "");
        }
        git(["add", "."]);
        git(["commit", "-m", "generated packet scaffolding"]);
        return git(["rev-parse", "HEAD"]);
      });
      return yield* Match.value(scenario).pipe(
        Match.when("packet prose", () =>
          Effect.gen(function* () {
            const baselineProfile = profile("pull_request");
            assert.strictEqual(baselineProfile.goals_only, "false");
            assert.strictEqual(baselineProfile.docs_only, "false");
            assert.strictEqual(baselineProfile.desktop_rust_relevant, "false");
            yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "GOAL.md"), "# goals-only\n");
            git(["add", "."]);
            git(["commit", "-m", "goals-only"]);
            const outputPath = path.join(tempRoot, "profile-output.txt");
            assert.strictEqual(profile("pull_request", outputPath).goals_only, "true");
            assert.strictEqual(profile("pull_request").docs_only, "true");
            const readFileString7 = yield* fs.readFileString(outputPath);
            assert.strictEqual(parseProfileOutput(readFileString7).goals_only, "true");
            yield* fs.remove(outputPath);
            yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", "ops"));
            yield* fs.writeFileString(path.join(tempRoot, "goals", "example", "ops", "manifest.json"), "{}\n");
            git(["add", "."]);
            git(["commit", "-m", "goal metadata"]);
            assert.strictEqual(profile("pull_request").goals_only, "true");
            for (const directory of ["history", "history/reflections", "research"]) {
              yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", directory), { recursive: true });
              yield* fs.writeFileString(path.join(tempRoot, "goals", "example", directory, ".gitkeep"), "");
            }
            git(["add", "."]);
            git(["commit", "-m", "generated packet scaffolding"]);
            const scaffoldingProfile = profile("pull_request");
            assert.strictEqual(scaffoldingProfile.goals_only, "true");
            assert.strictEqual(scaffoldingProfile.docs_only, "true");
          })
        ),
        Match.when("nested fixture paths", () =>
          Effect.gen(function* () {
            const metadataHead = yield* metadata;
            for (const directory of ["docs", "designs", "history", "research"] as const) {
              git(["reset", "--hard", metadataHead]);
              yield* fs.makeDirectory(path.join(tempRoot, "goals", "example", directory, "fixtures"), {
                recursive: true,
              });
              yield* fs.writeFileString(
                path.join(tempRoot, "goals", "example", directory, "fixtures", "expected.md"),
                "# Executable test fixture\n"
              );
              git(["add", "."]);
              git(["commit", "-m", `nested ${directory} markdown fixture`]);
              const fixtureProfile = profile("pull_request");
              assert.strictEqual(fixtureProfile.goals_only, "false");
              // Heavy admission's path rule counts markdown outside the code roots
              // as documentation, wherever it sits.
              assert.strictEqual(fixtureProfile.docs_only, "true");
            }
          })
        ),
        Match.when("documentation and push", () =>
          Effect.gen(function* () {
            const metadataHead = yield* metadata;
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
            const docsProfile = profile("pull_request");
            assert.strictEqual(docsProfile.goals_only, "false");
            assert.strictEqual(docsProfile.docs_only, "true");
            assert.strictEqual(profile("push").docs_only, "false");
            yield* fs.makeDirectory(path.join(tempRoot, "packages", "demo"), { recursive: true });
            yield* fs.writeFileString(path.join(tempRoot, "packages", "demo", "README.md"), "# package readme\n");
            git(["add", "."]);
            git(["commit", "-m", "package readme"]);
            assert.strictEqual(profile("pull_request").docs_only, "false");
          })
        ),
        Match.when("goal helpers and mixed", () =>
          Effect.gen(function* () {
            const metadataHead = yield* metadata;
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
            const executableProfile = profile("pull_request");
            assert.strictEqual(executableProfile.goals_only, "false");
            assert.strictEqual(executableProfile.docs_only, "true");
            yield* fs.makeDirectory(path.join(tempRoot, "src"));
            yield* fs.writeFileString(path.join(tempRoot, "src", "index.ts"), "export {}\n");
            git(["add", "."]);
            git(["commit", "-m", "mixed"]);
            const mixedProfile = profile("pull_request");
            assert.strictEqual(mixedProfile.goals_only, "false");
            assert.strictEqual(mixedProfile.docs_only, "false");
            assert.strictEqual(profile("push").goals_only, "false");
          })
        ),
        Match.exhaustive
      );
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
      const cliEntry = path.join(repoRoot, CI_ENTRY);
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseWorkflowYaml(workflowText);
      const git = gitIn(tempRoot);
      const profile = (eventName: string) => changeProfile(cliEntry, tempRoot, eventName);
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
      // The gate reads its path expression from the checkout's pattern data; keep the
      // copy out of the fixture commits so every diff stays the one under test.
      const patternPath = "packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json";
      yield* fs.makeDirectory(path.dirname(path.join(tempRoot, patternPath)), { recursive: true });
      yield* fs.copyFile(path.join(repoRoot, patternPath), path.join(tempRoot, patternPath));
      yield* fs.writeFileString(path.join(tempRoot, ".git/info/exclude"), `${patternPath}\n`, { flag: "a" });
      yield* writeAndCommit("README.md", "# baseline\n", "baseline");
      const cratePath = "apps/professional-desktop/src-tauri/src/lib.rs";
      yield* writeAndCommit(cratePath, "pub fn baseline() {}\n", "baseline crate");
      git(["update-ref", "refs/remotes/origin/main", git(["rev-parse", "HEAD"])]);
      const baseline = git(["rev-parse", "HEAD"]);

      yield* writeAndCommit("docs/notes.md", "# docs only\n", "docs only");
      const docsHead = git(["rev-parse", "HEAD"]);
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

      const workflowJobs8 = yield* workflowJobs(workflow);
      const steps = jobSteps(workflowJobs8, "professional-desktop-ipc-stdio");
      const gateScript = Str.replaceAll(
        "beep ci change-profile",
        'bun "$BEEP_CI_PROFILE_ENTRY" ci change-profile'
      )(stepRun(steps, "Determine lane execution"));
      const gate = Effect.fnUntraced(function* (head: string, event = "pull_request") {
        const outputPath = path.join(tempRoot, ".git/desktop-gate-output");
        yield* fs.writeFileString(outputPath, "");
        const result = Bun.spawnSync(["bash", "-c", gateScript], {
          cwd: tempRoot,
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: event,
            GITHUB_BASE_REF: "main",
            GITHUB_OUTPUT: outputPath,
            BEEP_CI_PR_BASE_SHA: baseline,
            BEEP_CI_PR_HEAD_SHA: head,
            BEEP_CI_PROFILE_ENTRY: cliEntry,
          },
          stderr: "pipe",
          stdout: "pipe",
        });
        assert.strictEqual(result.exitCode, 0, result.stderr.toString());
        const output = yield* fs.readFileString(outputPath);
        return parseProfileOutput(output);
      });
      git(["reset", "--hard", baseline]);
      yield* fs.makeDirectory(path.join(tempRoot, "docs"), { recursive: true });
      git(["mv", cratePath, "docs/moved.md"]);
      git(["commit", "-m", "move crate source into docs"]);
      const renameHead = git(["rev-parse", "HEAD"]);
      git(["checkout", "--detach", baseline]);
      yield* writeAndCommit("packages/foundation/example/src/index.ts", "export {};\n", "main advances");
      const advancedMain = git(["rev-parse", "HEAD"]);
      git(["update-ref", "refs/remotes/origin/main", advancedMain]);
      git(["merge", "--no-ff", docsHead, "-m", "synthetic docs merge"]);
      const docsGate = yield* gate(docsHead);
      assert.strictEqual(docsGate.should_run, "false");
      assert.strictEqual(docsGate.rust_should_run, "false");
      git(["checkout", "--detach", advancedMain]);
      git(["merge", "--no-ff", renameHead, "-m", "synthetic renamed crate merge"]);
      const renameGate = yield* gate(renameHead);
      assert.strictEqual(renameGate.should_run, "true");
      assert.strictEqual(renameGate.rust_should_run, "true");
      const pushGate = yield* gate(renameHead, "push");
      assert.strictEqual(pushGate.should_run, "true");
      assert.strictEqual(pushGate.rust_should_run, "true");
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
      assert.include(workflowText, 'eval "$(beep ci change-profile');
      assert.include(workflowText, 'rust_should_run="$desktop_rust_relevant"');
      assert.include(workflowText, "run: cargo check --locked");
      assert.include(workflowText, "run: cargo clippy --locked -- -D warnings");
      assert.include(workflowText, "working-directory: apps/professional-desktop/src-tauri");
      assertPrunesAptSourcesBefore(stepRun(steps, "Install Tauri Linux system dependencies"), "sudo apt-get update");
      // The fetched binary is on PATH before the lane gate and the apt pruning.
      assert.strictEqual(stepByName(steps, "Fetch beep CI binary").uses, FETCH_BEEP_CI_ACTION);
      assert.isBelow(
        stepIndexByName(steps, "Fetch beep CI binary"),
        stepIndexByName(steps, "Determine lane execution")
      );
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
      const readFileString9 = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const workflow = parseWorkflowYaml(readFileString9);
      const workflowJobs10 = yield* workflowJobs(workflow);
      const steps = jobSteps(workflowJobs10, "labs");
      const gate = stepRun(steps, "Determine lane execution");

      assert.strictEqual(yamlAt(workflow, ["jobs", "labs", "name"]), "Labs");
      assert.include(gate, 'if [[ "$GITHUB_EVENT_NAME" == "pull_request" ]]; then');
      assert.include(
        gate,
        "grep -Eq '(^apps/labs/|^\\.github/workflows/check\\.yml$|^(bun\\.lock|package\\.json|turbo\\.json)$)'"
      );
      assert.include(gate, "labs_checks=false");
      assert.include(stepRun(steps, "Run Labs lane"), "run_lane ci lane labs --coverage-output .beep/ci-coverage/labs");
      // Coverage Regression needs the dedicated Labs job, while Verify owns Repo Sanity.
      assert.strictEqual(yamlAt(workflow, ["jobs", "verify", "env", "BEEP_CI_LANE_ID"]), "repo-sanity");
    })
  );

  it.effect(
    "detects forbidden lanes in unexpected jobs, declared ids, and legacy matrix entries",
    Effect.fnUntraced(function* () {
      for (const fixture of [
        { id: "coverage", yaml: "jobs:\n  coverage:\n    runs-on: ubuntu-24.04\n    steps: []\n" },
        {
          id: "effect-diagnostics",
          yaml: "jobs:\n  unexpected:\n    env:\n      BEEP_CI_LANE_ID: effect-diagnostics\n      BEEP_CI_LANE_USES_TURBO: false\n    steps: []\n",
        },
        {
          id: "labs",
          yaml: "jobs:\n  unexpected:\n    strategy:\n      matrix:\n        include:\n          - id: labs\n    steps: []\n",
        },
        { id: "coverage", yaml: "jobs:\n  coverage:\n    env:\n      BEEP_CI_LANE_ID: check\n    steps: []\n" },
      ]) {
        const lanes = yield* heavyLaneParameters(parseWorkflowYaml(fixture.yaml));
        const forbidden = A.findFirst(lanes, (lane) => A.contains(lane.ids, fixture.id));
        assert.throws(() => assertNone(forbidden));
      }
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
      const gated = LANE_GATED;
      for (const jobId of [
        "verify",
        "labs",
        "lint-shard",
        "test-unit-shard",
        "property-laws-shard",
        "fallow-advisory",
        "jsdoc-ratchet",
        "nix",
      ]) {
        const steps = jobSteps(jobs, jobId);
        const setupIndex = O.getOrThrow(A.findFirstIndex(steps, (step) => step.uses === SETUP_MONOREPO_ACTION));
        const gates = tierOneGates(jobId);
        assert.strictEqual(setupMonorepoStep(jobs, jobId).if, gates.setup, jobId);
        assert.isBelow(stepIndexByName(steps, "Determine lane execution"), setupIndex, jobId);
        assert.strictEqual(stepByName(steps, "Skip lane").if, gates.skip, jobId);
      }
      for (const jobId of [
        "labs",
        "lint-shard",
        "test-unit-shard",
        "property-laws-shard",
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
      const verifySteps = jobSteps(jobs, "verify");
      const verifyGate = stepRun(verifySteps, "Determine lane execution");
      // Repo Sanity is the required gate for documentation diffs too: the job
      // condition names only the cancel and Change Profile terms, never
      // docs_only, and a docs_only diff takes the documentation path (the home
      // path law and the changeset checks) instead of the lane body.
      assert.strictEqual(
        yamlAt(policy.workflow, ["jobs", "verify", "if"]),
        "${{ !cancelled() && needs.change-profile.result == 'success' }}"
      );
      assert.strictEqual(
        stepByName(verifySteps, "Determine lane execution").env?.DOCS_ONLY,
        "${{ needs.change-profile.outputs.docs_only }}"
      );
      assert.include(
        verifyGate,
        'if [[ "${{ env.BEEP_CI_LANE_ID }}" == "repo-sanity" && "$DOCS_ONLY" == "true" ]]; then\n  should_run=false\n  docs_path=true'
      );
      assert.include(verifyGate, 'echo "docs_path=$docs_path" >> "$GITHUB_OUTPUT"');
      const docsSanity = stepByName(verifySteps, "Check documentation sanity");
      assert.strictEqual(docsSanity.if, "steps.lane-gate.outputs.docs_path == 'true'");
      // The skills lock step of the lane body is skipped, on either path, only when the pull
      // request changes none of the `skills` pattern row's paths; an absent row keeps it.
      assert.include(verifyGate, "skills_lock=true");
      assert.include(verifyGate, "jq -r '.skills // empty'");
      assert.include(verifyGate, 'echo "skills_lock=$skills_lock" >> "$GITHUB_OUTPUT"');
      assert.strictEqual(yamlAt(docsSanity, ["env", "SKILLS_LOCK"]), "${{ steps.lane-gate.outputs.skills_lock }}");
      const docsSanityRun = stepRun(verifySteps, "Check documentation sanity");
      assert.include(docsSanityRun, 'if [[ "$SKILLS_LOCK" == "false" ]]; then');
      assert.include(docsSanityRun, "bun run beep ci lane repo-sanity --docs-only --skip-skills-lock\nelse");
      assert.include(docsSanityRun, "else\n  bun run beep ci lane repo-sanity --docs-only\nfi");
      const laneRun = stepRun(verifySteps, "Run verification lane");
      assert.include(
        laneRun,
        'if [[ "$GITHUB_EVENT_NAME" == "pull_request" && "${{ steps.lane-gate.outputs.skills_lock }}" == "false" ]]; then\n      run_lane ci lane repo-sanity --changeset-status --skip-skills-lock'
      );
      // A push never passes the skip.
      assert.include(laneRun, "else\n      run_lane ci lane repo-sanity\n    fi");
      // Codegen and Ecosystem read their path gates from the change-profile pattern data.
      assert.include(verifyGate, "'.lanes[$lane] // empty'");
      assert.include(laneRow("ecosystem"), "^packages/ecosystem/");
      assert.include(
        stepRun(jobSteps(jobs, "coverage-regression"), "Determine comparison execution"),
        '[[ "$docs_only" == "true" ]]'
      );

      const nix = jobSteps(jobs, "nix");
      assert.include(stepRun(nix, "Determine lane execution"), "'.lanes.nix // empty'");
      assert.include(laneRow("nix"), "^flake\\.(nix|lock)$");
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

      for (const jobId of ["lint", "test-unit"]) {
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
      const readFileString12 = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/release-desktop.yml"));
      const workflow = parseWorkflowYaml(readFileString12);
      const workflowJobs13 = yield* workflowJobs(workflow);
      const steps = jobSteps(workflowJobs13, "release-desktop");
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
    "gates Storybook browser setup on dependency selection and keeps the browser cache push-saved",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const cliEntry = path.join(repoRoot, CI_ENTRY);
      const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
      const workflow = parseWorkflowYaml(workflowText);
      const git = gitIn(tempRoot);
      const profile = (eventName: string) => changeProfile(cliEntry, tempRoot, eventName);

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
      const workflowJobs14 = yield* workflowJobs(workflow);
      const steps = jobSteps(workflowJobs14, "storybook");
      const setupGate = "steps.lane-gate.outputs.should_run == 'true'";
      assert.strictEqual(stepByName(steps, "Setup monorepo CI").if, setupGate);
      assert.strictEqual(stepByName(steps, "Select Storybook before browser provisioning").if, setupGate);
      const gate = "steps.storybook-selection.outputs.should_run == 'true'";
      for (const name of [
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
      const readDirectory15 = yield* fs.readDirectory(burstRoot);
      const entries = A.sort(readDirectory15, Order.String);
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
      const decodedWorkflowSteps = yield* decodeWorkflowSteps(yamlAt(action, ["runs", "steps"]));
      const exportEnvironment = stepEnvironment(stepByName(decodedWorkflowSteps, "Export job environment"));
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
      assert.deepStrictEqual(
        cacheSaveSteps(heavyJobs),
        A.map(["verify", "check", "docgen", "doctest", "build"], (job) => `${job}/Save main Docgen Turbo cache`)
      );
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
        "${{ github.event_name == 'push' && inputs.admitted && 'turbo-cache-write' || null }}"
      );
      const heavyLaneParameters16 = yield* heavyLaneParameters(heavyWorkflow);
      const buildLane = O.getOrThrowWith(
        A.findFirst(heavyLaneParameters16, (lane) => lane.id === "build"),
        () => new Error("heavy.yml declares no build lane.")
      );
      assert.strictEqual(buildLane.name, "Build");
      assert.strictEqual(buildLane.uses_turbo, "true");
      // Effect rules run inside the patched tsrs typecheck, so the standalone
      // diagnostics matrix lane is retired.
      const heavyLaneParameters17 = yield* heavyLaneParameters(heavyWorkflow);
      assertNone(A.findFirst(heavyLaneParameters17, (lane) => A.contains(lane.ids, "effect-diagnostics")));
      assertNone(A.findFirst(heavyLaneParameters17, (lane) => A.contains(lane.ids, "labs")));
      assert.notInclude(heavyWorkflowText, "run_lane ci lane effect-diagnostics");
      assert.notInclude(heavyWorkflowText, "commands/Quality/EffectDiagnostics.ts");
      // Test Integration runs as hosted check.yml partitions since 2026-11-09, never on this pool.
      assert.include(heavyWorkflowText, "check|build)");
      assert.notInclude(heavyWorkflowText, "BEEP_CI_LANE_ID: test-integration");
    })
  );

  it.effect(
    "keeps the lane shapes the workflows hand to the CLI",
    Effect.fnUntraced(function* () {
      const { workflowText, heavyWorkflowText } = yield* readCredentialPolicySources();

      assert.include(workflowText, 'eval "$(beep ci change-profile');
      assert.include(workflowText, 'if [[ "$docs_only" == "true" ]]');
      assert.include(heavyWorkflowText, 'if [[ "${{ env.BEEP_CI_LANE_ID }}" == "docgen"');
      assert.include(heavyWorkflowText, "^apps/|^packages/|^infra/");
      assert.include(workflowText, "- name: Skip lane");
      // The heavy lane ids live in heavy.yml; check.yml's verify matrix keeps
      // only arms for the ids it declares.
      assert.notInclude(workflowText, "check|test-integration|coverage)");
      assert.notInclude(workflowText, "lint-policy|codegen|ecosystem)");
      assert.include(workflowText, "codegen|ecosystem)");
      // typos runs inside Lint Policy (heavy.yml), lefthook, and check.yml's Docs
      // Policy job for docs_only pull requests, pinned to the same release.
      const typosPins = (text: string) =>
        A.dedupe(O.getOrElse(Str.match(/typos-cli@[0-9.]+/gu)(text), () => A.empty<string>()));
      assert.deepStrictEqual(typosPins(workflowText), typosPins(heavyWorkflowText));
      assert.lengthOf(typosPins(heavyWorkflowText), 1);
      assert.notInclude(workflowText, "install_typos");
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
        const readFileString18 = yield* fs.readFileString(outputPath);
        return parseGithubEnv(readFileString18);
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
      const readDirectory19 = yield* fs.readDirectory(path.join(repoRoot, ".github/workflows"));
      const workflowFiles = A.filter(readDirectory19, Str.endsWith(".yml"));
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
      // Repo Sanity's documentation path skips the cleanup and the application
      // secrets; every full lane run keeps both.
      const lawOnlyLight = "${{ steps.lane-gate.outputs.docs_path == 'true' && 'false' || 'true' }}";
      assert.strictEqual(setupMonorepoInputs(checkJobs, "verify")["free-disk"], lawOnlyLight);
      assert.strictEqual(setupMonorepoInputs(checkJobs, "verify")["app-secrets"], lawOnlyLight);
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
      assert.strictEqual(setup.with?.["turbo-remote-cache"], "${{ env.BEEP_CI_LANE_USES_TURBO }}");
      assert.strictEqual(yamlAt(workflow, ["jobs", "verify", "env", "BEEP_DOCGEN_CONCURRENCY"]), "3");
      assert.include(workflowText, 'eval "$(beep ci change-profile');
      assert.include(workflowText, 'if [[ "$goals_only" == "true" ]]');
      assert.include(workflowText, "- name: Skip lane");
      const heavyLaneParameters20 = yield* heavyLaneParameters(workflow);
      assert.strictEqual(
        O.getOrThrow(A.findFirst(heavyLaneParameters20, (lane) => lane.id === "docgen")).docgen_concurrency,
        "6"
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
      const exists21 = yield* fs.exists(path.join(repoRoot, "vitest.docs.ts"));
      assert.isFalse(exists21);
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
        "check.yml:Change Profile",
        "job-context-contract.yml:Active Static Context",
        "job-context-contract.yml:Skipped Static Context",
        "job-context-contract-pr.yml:Context Contract Probe",
        "job-context-contract-pr.yml:All Skipped Context Contract Probe",
        // Publishes the compiled pre-toolchain binary from main; a release step, not a quality lane.
        "beep-ci-binary.yml:Publish Beep CI Binary",
        "check.yml:Heavy Admission",
        "check.yml:Heavy",
        // Decides which shard jobs a run allocates; the aggregates and Coverage Regression judge them.
        "check.yml:Test Plan",
        "check.yml:Lint (${{ matrix.partition }})",
        "check.yml:Test Unit (${{ matrix.partition }})",
        "check.yml:Test Integration (${{ matrix.partition }})",
        "check.yml:Property Laws (${{ matrix.partition }})",
        "check.yml:Coverage Artifact Migration",
        "cache-warm.yml:Warm Turbo cache",
        // Manual source inspection is operational evidence, not a required quality lane.
        "cache-local-observe.yml:Observe local cache pilot",
        "heavy.yml:Heavy / Observe local cache pilot",
        "cache-producer-inspect.yml:Inspect producer sources and tools",
        "heavy.yml:Heavy / Inspect producer sources and tools",
        // A candidate adapter build grants no producer or quality verdict authority.
        "cache-producer-prepare.yml:Build candidate producer adapter",
        "heavy.yml:Heavy / Build candidate producer adapter",
        // Protected execution authenticates observations; required quality proof stays separate.
        "cache-producer.yml:Execute approved signed producer",
        "heavy.yml:Heavy / Execute approved signed producer",
        "data-sync.yml:Sync Official Data",
        // Post-merge publisher of the commit-message overlay ref; it proves the
        // ref with `beep history notes --check` and grants no quality verdict.
        "history-notes-publish.yml:Publish refs/notes/history",
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
        // Vercel app deploys: a release step gated on Turbo's affected set, not a quality lane.
        "vercel-deploy.yml:Plan Vercel deploys",
        "vercel-deploy.yml:Deploy ${{ matrix.project }} (${{ matrix.target }})",
      ];
      const readDirectory22 = yield* fs.readDirectory(`${root}/.github/workflows`);
      const files = A.filter(readDirectory22, Str.endsWith(".yml"));
      let observedContexts: ReadonlyArray<string> = [];
      for (const file of files) {
        const workflow = Str.replace(/\.yml$/, "")(file);
        const text = yield* fs.readFileString(`${root}/.github/workflows/${file}`);
        const workflowPolicyDiagnostics23 = yield* workflowPolicyDiagnostics(file, text);
        expect(workflowPolicyDiagnostics23).toEqual([]);
        const contexts = yield* workflowJobContexts(file, text);
        observedContexts = A.appendAll(
          observedContexts,
          A.map(contexts, (context) => `${file}:${context}`)
        );
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
      // A stale exemption would silently admit a future job of that name without a lane descriptor.
      expect(A.filter(exemptions, (exemption) => !A.contains(observedContexts, exemption))).toEqual([]);
    })
  );
  it.effect("keeps reusable Heavy callers compatible with the protected producer permission ceiling", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      const requested = yamlAt(heavy, ["jobs", "producer-execute", "permissions"]);
      expect(requested).toEqual({ contents: "read", actions: "read" });
      const callers = [
        ["check.yml", "heavy"],
        ["heavy-admit.yml", "heavy"],
        ["cache-producer-inspect.yml", "inspect"],
        ["cache-producer-prepare.yml", "prepare"],
        ["cache-local-observe.yml", "observe"],
        ["cache-producer.yml", "produce"],
      ] as const;
      for (const [file, job] of callers) {
        const text = yield* fs.readFileString(`${root}/.github/workflows/${file}`);
        const caller = parseWorkflowYaml(text);
        const diagnostics = yield* workflowPolicyDiagnostics(file, text);
        expect(diagnostics, file).toEqual([]);
        expect(yamlAt(caller, ["jobs", job, "uses"]), file).toBe(
          "beep-effect/beep-effect/.github/workflows/heavy.yml@main"
        );
        const allowed = yamlAt(caller, ["jobs", job, "permissions"]) ?? yamlAt(caller, ["permissions"]);
        expect(allowed, file).toEqual(requested);
      }
      // The caller ceiling permits validation; ordinary quality jobs still
      // strip Actions access and cannot select the protected producer mode.
      expect(yamlAt(heavy, ["jobs", "verify", "permissions"])).toEqual({ contents: "read" });
      const checkText = yield* fs.readFileString(`${root}/.github/workflows/check.yml`);
      const check = parseWorkflowYaml(checkText);
      expect(yamlAt(check, ["jobs", "heavy", "with", "producer_execution"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "producer-execute", "if"])).toContain(
        "github.workflow_ref == 'beep-effect/beep-effect/.github/workflows/cache-producer.yml@refs/heads/main'"
      );
    })
  );

  it.effect("keeps source inspection credential-free with bounded dependency diagnostics", () =>
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
      expect(yamlAt(workflow, ["jobs", "inspect", "permissions"])).toEqual(
        yamlAt(heavy, ["jobs", "producer-execute", "permissions"])
      );
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "permissions"])).toBeUndefined();
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_inspection"])).toEqual({
        description:
          "Run only the credential-free protected source inspection for the exact main manual dispatcher. Ordinary quality callers leave this off.",
        required: false,
        type: "boolean",
        default: false,
      });
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ inputs.admitted && !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.local_pilot_observation }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "if"])).toBe(
        A.join(
          [
            "inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution &&",
            "!inputs.local_pilot_observation &&",
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
      expect(yamlAt(heavy, ["jobs", "producer-inspect", "env"])).toEqual({
        PYTHONDONTWRITEBYTECODE: "1",
      });
      expect(yamlAt(heavy, ["env", "PYTHONDONTWRITEBYTECODE"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "verify", "env", "PYTHONDONTWRITEBYTECODE"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "env", "PYTHONDONTWRITEBYTECODE"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "producer-execute", "env", "PYTHONDONTWRITEBYTECODE"])).toBeUndefined();
      const workflowJobs24 = yield* workflowJobs(heavy);
      const steps = jobSteps(workflowJobs24, "producer-inspect");
      const setup = stepByName(steps, "Setup pinned toolchain without cache capabilities");
      expect(setup.uses).toBe(SETUP_MONOREPO_ACTION);
      expect(setup.with).toEqual({
        "turbo-remote-cache": "false",
        "r2-enabled": "false",
        "app-secrets": "false",
      });
      const sandboxName = "Ensure native sandbox inspection dependency";
      const sandbox = stepByName(steps, sandboxName);
      expect(sandbox.run).toBe("bun --no-env-file run beep ci cache-sandbox");
      const sandboxSource = yield* fs.readFileString(`${root}/${CACHE_PILOT_HOST_SOURCE}`);
      expect(sandboxSource).toContain('withPrivilege("dnf", ["install", "-y", "bubblewrap"])');
      expect(sandboxSource).toContain(
        'withPrivilege("apt-get", ["install", "-y", "--no-install-recommends", "bubblewrap"])'
      );
      expect(sandboxSource).toContain('bwrap: "/usr/bin/bwrap"');
      expect(sandboxSource).toContain('runStep(paths.bwrap, ["--version"])');
      expect(stepIndexByName(steps, sandboxName)).toBeLessThan(
        stepIndexByName(steps, "Write bounded source inspection")
      );
      const inspect = stepByName(steps, "Write bounded source inspection");
      expect(inspect.env).toEqual({ BEEP_TURBO_HOST_CACHE_DISABLED: "true" });
      expect(inspect.run).toContain("bun --no-env-file run beep cache producer-inspect");
      expect(inspect.run).toContain("set -euo pipefail");
      const diagnosticName = "Diagnose installed dependency drift without capabilities";
      const diagnostic = stepByName(steps, diagnosticName);
      expect(diagnostic.env).toEqual({ SOURCE_REPORT: "${{ steps.inspection.outputs.report }}" });
      expect(diagnostic.run).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
      expect(diagnostic.run).toContain(
        "/usr/bin/python3 -I -S goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.py"
      );
      expect(diagnostic.run).toContain('--source-report "$SOURCE_REPORT" --output "$diagnostic"');
      expect(diagnostic.run).toContain('--revision "$GITHUB_SHA"');
      expect(stepIndexByName(steps, "Write bounded source inspection")).toBeLessThan(
        stepIndexByName(steps, diagnosticName)
      );
      expect(stepIndexByName(steps, diagnosticName)).toBeLessThan(
        stepIndexByName(steps, "Bound inspection artifact publication")
      );
      const publication = stepByName(steps, "Bound inspection artifact publication");
      expect(publication.if).toBe(
        "always() && steps.inspection.outcome == 'success' && steps.inspection.outputs.report != ''"
      );
      expect(publication.env).toEqual({
        SOURCE_REPORT: "${{ steps.inspection.outputs.report }}",
        DIAGNOSTIC_REPORT: "${{ steps.dependency-diagnostics.outputs.report }}",
      });
      expect(publication.run).toContain('--publication-only --source-report "$SOURCE_REPORT"');
      expect(publication.run).toContain('--output "$DIAGNOSTIC_REPORT"');
      expect(publication.run).toContain('>> "$GITHUB_OUTPUT"');
      expect(stepIndexByName(steps, "Bound inspection artifact publication")).toBeLessThan(
        stepIndexByName(steps, "Retain inspection for at most one day")
      );
      const retain = stepByName(steps, "Retain inspection for at most one day");
      expect(retain.if).toBe(
        "always() && steps.inspection.outcome == 'success' && steps.inspection-publication.outputs.source == 'true'"
      );
      expect(retain.with).toEqual({
        name: "cache-producer-inspection-${{ github.run_id }}-${{ github.run_attempt }}",
        path: "${{ steps.inspection.outputs.report }}",
        "if-no-files-found": "error",
        "retention-days": 1,
        "compression-level": 0,
      });
      const dependencyRetain = stepByName(steps, "Retain dependency diagnostic for at most one day");
      expect(dependencyRetain.if).toBe("always() && steps.inspection-publication.outputs.diagnostic == 'true'");
      expect(dependencyRetain.with).toEqual({
        name: "cache-producer-dependencies-${{ github.run_id }}-${{ github.run_attempt }}",
        path: "${{ steps.dependency-diagnostics.outputs.report }}",
        "if-no-files-found": "warn",
        "retention-days": 1,
        "compression-level": 0,
      });
      const workflowPolicyDiagnostics25 = yield* workflowPolicyDiagnostics("cache-producer-inspect.yml", text);
      expect(workflowPolicyDiagnostics25).toEqual([]);
      const workflowPolicyDiagnostics26 = yield* workflowPolicyDiagnostics("heavy.yml", heavyText);
      expect(workflowPolicyDiagnostics26).toEqual([]);
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
      expect(yamlAt(workflow, ["jobs", "prepare", "permissions"])).toEqual(
        yamlAt(heavy, ["jobs", "producer-execute", "permissions"])
      );
      expect(yamlAt(heavy, ["permissions"])).toEqual({ contents: "read" });
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "permissions"])).toBeUndefined();
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_preparation"])).toEqual({
        description:
          "Build only the credential-free candidate adapter for the exact main manual dispatcher. This grants no producer or cache-write authority.",
        required: false,
        type: "boolean",
        default: false,
      });
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ inputs.admitted && !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.local_pilot_observation }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-prepare", "if"])).toBe(
        A.join(
          [
            "inputs.producer_preparation && !inputs.producer_inspection && !inputs.producer_execution &&",
            "!inputs.local_pilot_observation &&",
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
      const workflowJobs27 = yield* workflowJobs(heavy);
      const steps = jobSteps(workflowJobs27, "producer-prepare");
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
      const hostTools = "Ensure native build and ELF inspection prerequisites";
      const hostSetup = stepRun(steps, hostTools);
      expect(hostSetup).toContain("command -v cc");
      expect(hostSetup).toContain("command -v ld");
      expect(hostSetup).toContain("command -v readelf");
      expect(hostSetup).toContain("! command -v make");
      expect(hostSetup).toContain("! perl -MFindBin -MIPC::Cmd -MFile::Compare -MFile::Copy -e 'use 5.010;'");
      expect(hostSetup).toContain("dnf install -y gcc binutils make perl-core");
      expect(hostSetup).toContain("apt-get install -y --no-install-recommends gcc binutils make perl");
      expect(hostSetup).toContain("make --version");
      expect(hostSetup).toContain("perl --version");
      assertPrunesAptSourcesBefore(hostSetup, '"${privilege[@]}" apt-get update');
      expect(stepIndexByName(steps, hostTools)).toBeLessThan(stepIndexByName(steps, "Build pinned portable candidate"));
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
      expect(build.run).toContain("'hostCc':shutil.which('cc')");
      expect(build.run).toContain("'hostLinker':shutil.which('ld')");
      expect(build.run).toContain("'readelf':shutil.which('readelf')");
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
      const workflowPolicyDiagnostics28 = yield* workflowPolicyDiagnostics("cache-producer-prepare.yml", text);
      expect(workflowPolicyDiagnostics28).toEqual([]);
      const workflowPolicyDiagnostics29 = yield* workflowPolicyDiagnostics("heavy.yml", heavyText);
      expect(workflowPolicyDiagnostics29).toEqual([]);
    })
  );

  it.effect("restricts the protected producer caller to the closed main-only trial", () =>
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
      const expectedSecrets = {
        BEEP_CACHE_PRODUCER_STABLE_APPROVAL_JSON:
          "${{ inputs.channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_APPROVAL_JSON || '' }}",
        BEEP_CACHE_PRODUCER_CANARY_APPROVAL_JSON:
          "${{ inputs.channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_APPROVAL_JSON || '' }}",
        BEEP_CACHE_PRODUCER_STABLE_RUNTIME_JSON:
          "${{ inputs.channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_RUNTIME_JSON || '' }}",
        BEEP_CACHE_PRODUCER_CANARY_RUNTIME_JSON:
          "${{ inputs.channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_RUNTIME_JSON || '' }}",
        BEEP_CACHE_PRODUCER_STABLE_ISSUER_MATERIAL_BASE64:
          "${{ inputs.channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_ISSUER_MATERIAL_BASE64 || '' }}",
        BEEP_CACHE_PRODUCER_CANARY_ISSUER_MATERIAL_BASE64:
          "${{ inputs.channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_ISSUER_MATERIAL_BASE64 || '' }}",
        BEEP_CACHE_TRIAL_R2_ACCESS_KEY_ID: "${{ secrets.BEEP_CACHE_TRIAL_R2_ACCESS_KEY_ID }}",
        BEEP_CACHE_TRIAL_R2_SECRET_ACCESS_KEY: "${{ secrets.BEEP_CACHE_TRIAL_R2_SECRET_ACCESS_KEY }}",
        BEEP_CACHE_TRIAL_ARTIFACT_KEY: "${{ secrets.BEEP_CACHE_TRIAL_ARTIFACT_KEY }}",
        BEEP_CACHE_TRIAL_READER_BEARER: "${{ secrets.BEEP_CACHE_TRIAL_READER_BEARER }}",
        BEEP_CACHE_TRIAL_WRITER_BEARER: "${{ secrets.BEEP_CACHE_TRIAL_WRITER_BEARER }}",
      };
      const forwarded = yield* decodeYamlRecord(yamlAt(caller, ["jobs", "produce", "secrets"]));
      expect(forwarded).toEqual(expectedSecrets);
      for (const name of R.keys(expectedSecrets)) {
        expect(yamlAt(heavy, ["on", "workflow_call", "secrets", name, "required"])).toBe(false);
      }
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "producer_execution", "default"])).toBe(false);
      expect(yamlAt(heavy, ["jobs", "verify", "if"])).toBe(
        "${{ inputs.admitted && !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.local_pilot_observation }}"
      );
      expect(yamlAt(heavy, ["jobs", "producer-execute", "if"])).toBe(
        A.join(
          [
            "inputs.producer_execution && !inputs.producer_inspection && !inputs.producer_preparation &&",
            "!inputs.local_pilot_observation &&",
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
      const producerDiagnostics = yield* workflowPolicyDiagnostics("cache-producer.yml", text);
      expect(producerDiagnostics).toEqual([]);
      const heavyDiagnostics = yield* workflowPolicyDiagnostics("heavy.yml", heavyText);
      expect(heavyDiagnostics).toEqual([]);
    })
  );

  it.effect("binds producer installation and publication to their approved capabilities", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      const jobs = yield* workflowJobs(heavy);
      const steps = jobSteps(jobs, "producer-execute");
      const setup = stepByName(steps, "Setup pinned toolchain without trial capabilities");
      expect(setup.with).toEqual({
        "turbo-remote-cache": "false",
        "r2-enabled": "false",
        "app-secrets": "false",
      });
      expect(setup.env).toEqual({ PYTHONDONTWRITEBYTECODE: "1" });
      expect(A.filter(steps, (step) => step.env?.PYTHONDONTWRITEBYTECODE !== undefined)).toEqual([setup]);
      const download = stepByName(steps, "Download independently selected candidate");
      expect(download.with?.["artifact-ids"]).toBe("${{ steps.selection.outputs.artifact }}");
      expect(download.with?.["digest-mismatch"]).toBe("error");
      const installName = "Install independently approved issuer only";
      const runName = "Execute closed signed trial and retain private observation";
      const publishName = "Publish issued observation using storage capabilities only";
      expect(stepRun(steps, "Reserve exclusive private trial directory")).toContain(
        'trial_root="$HOME/.cache/beep/cache-producer-trial-v1"'
      );
      const install = stepByName(steps, installName);
      expect(A.sort(R.keys(install.env ?? {}), Order.String)).toEqual([
        "BEEP_CACHE_PRODUCER_APPROVAL_JSON",
        "BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64",
        "BEEP_CACHE_PRODUCER_RUNTIME_JSON",
      ]);
      // Name each secret statically; a missing stable value must not fall back to canary material.
      expect(install.env?.BEEP_CACHE_PRODUCER_APPROVAL_JSON).toBe(
        "${{ inputs.producer_channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_APPROVAL_JSON || inputs.producer_channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_APPROVAL_JSON || '' }}"
      );
      expect(install.env?.BEEP_CACHE_PRODUCER_RUNTIME_JSON).toBe(
        "${{ inputs.producer_channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_RUNTIME_JSON || inputs.producer_channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_RUNTIME_JSON || '' }}"
      );
      expect(install.env?.BEEP_CACHE_PRODUCER_ISSUER_MATERIAL_BASE64).toBe(
        "${{ inputs.producer_channel == 'stable' && secrets.BEEP_CACHE_PRODUCER_STABLE_ISSUER_MATERIAL_BASE64 || inputs.producer_channel == 'canary' && secrets.BEEP_CACHE_PRODUCER_CANARY_ISSUER_MATERIAL_BASE64 || '' }}"
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
      expect(stepRun(steps, "Prepare fixed full-pilot inputs without credentials")).toBe(
        "bun --no-env-file run beep ci cache-pilot-inputs signed"
      );
      const inputSource = yield* fs.readFileString(`${root}/${CACHE_PILOT_INPUTS_SOURCE}`);
      expect(inputSource).toContain('selection: "full"');
      expect(inputSource).toContain("Signed execution remains restricted to identity lint.");
      expect(stepByName(steps, publishName).env).toEqual({
        R2_ACCESS_KEY_ID: "${{ secrets.BEEP_CACHE_TRIAL_R2_ACCESS_KEY_ID }}",
        R2_SECRET_ACCESS_KEY: "${{ secrets.BEEP_CACHE_TRIAL_R2_SECRET_ACCESS_KEY }}",
      });
    })
  );

  it.effect("keeps other producer steps unprivileged and bounds public artifacts and cleanup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      const jobs = yield* workflowJobs(heavy);
      const steps = jobSteps(jobs, "producer-execute");
      const installName = "Install independently approved issuer only";
      const runName = "Execute closed signed trial and retain private observation";
      const publishName = "Publish issued observation using storage capabilities only";
      for (const step of A.filter(steps, (step) => step.name !== installName)) {
        expect(step.run ?? "").not.toContain("producer-install");
      }
      const unprivilegedValues = pipe(
        steps,
        A.filter((step) => !A.contains([installName, runName, publishName], step.name ?? "")),
        A.flatMap((step) => [...R.values(step.env ?? {}), ...R.values(step.with ?? {}), step.run ?? ""]),
        A.filter(S.is(S.String))
      );
      for (const value of unprivilegedValues) expect(value).not.toMatch(/\bsecrets\s*(?:\.|\[)/iu);
      for (const step of steps) {
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
      expect(stepRun(steps, "Remove only this trial's private files and worktrees")).toBe(
        "bun --no-env-file run beep ci cache-pilot-cleanup signed"
      );
      const cleanupSource = yield* fs.readFileString(`${root}/${CACHE_PILOT_HOST_SOURCE}`);
      expect(cleanupSource).toContain('trialRoot === `${yield* variable("HOME")}/.cache/beep/cache-producer-trial-v1`');
      expect(cleanupSource).toContain('runInherited("git", ["worktree", "remove", "--", tree])');
      expect(cleanupSource).not.toContain("--force");
    })
  );

  it.effect("refuses disabled or malformed producer selection before any private trial setup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      const jobs = yield* workflowJobs(heavy);
      const script = stepRun(jobSteps(jobs, "producer-execute"), "Require independent frozen trial selection");
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
        expect(result.exitCode).toBe(succeeds ? 0 : 1);
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
      const readFileString30 = yield* fs.readFileString(`${root}/.github/workflows/hub-pipe-security.yml`);
      const workflow = parseWorkflowYaml(readFileString30);
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
  it.effect("passes the admission route outputs to the optional hosted route inputs", () =>
    Effect.gen(function* () {
      const policy = yield* readCredentialPolicySources();
      for (const name of ["route_skips", "route_receipt"]) {
        expect(yamlAt(policy.heavyWorkflow, ["on", "workflow_call", "inputs", name, "type"])).toBe("string");
        expect(yamlAt(policy.heavyWorkflow, ["on", "workflow_call", "inputs", name, "default"])).toBe("");
        expect(yamlAt(policy.workflow, ["jobs", "heavy", "with", name])).toBe(
          `\${{ needs.admission.outputs.${name} }}`
        );
        expect(yamlAt(policy.workflow, ["jobs", "admission", "outputs", name])).toBe(
          `\${{ steps.decide.outputs.${name} }}`
        );
      }
      // The label-triggered caller is usually a pull request's first admission, so it forwards the
      // same route outputs as check.yml.
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const admitText = yield* fs.readFileString(`${root}/.github/workflows/heavy-admit.yml`);
      const admit = parseWorkflowYaml(admitText);
      for (const name of ["route_skips", "route_receipt"]) {
        expect(yamlAt(admit, ["jobs", "heavy", "with", name])).toBe(`\${{ needs.admission.outputs.${name} }}`);
        expect(yamlAt(admit, ["jobs", "admission", "outputs", name])).toBe(`\${{ steps.decide.outputs.${name} }}`);
      }
      const jobs = yield* workflowJobs(policy.heavyWorkflow);
      const gate = stepByName(jobSteps(jobs, "verify"), "Determine lane execution");
      expect(gate.env).toMatchObject({
        ROUTE_SKIPS: "${{ inputs.route_skips }}",
        ROUTE_RECEIPT: "${{ inputs.route_receipt }}",
        LANE_ID: "${{ env.BEEP_CI_LANE_ID }}",
      });
      expect(gate.run).toContain('"$GITHUB_EVENT_NAME" == "pull_request"');
      expect(gate.run).toContain('",${ROUTE_SKIPS}," == *",${LANE_ID},"*');
      expect(gate.run).toContain("### Verification route: skip-satisfied");
      expect(gate.run).not.toContain("${{ inputs.route_");
      const script = gate.run ?? "";
      const admitted = pipe(script, Str.indexOf("ADMITTED"), O.getOrThrow);
      const route = pipe(script, Str.indexOf("ROUTE_SKIPS"), O.getOrThrow);
      const goals = pipe(script, Str.indexOf("goals_only"), O.getOrThrow);
      expect(route).toBeLessThan(goals);
      expect(admitted).toBeLessThan(route);
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
      expect(yamlAt(policy.workflow, ["jobs", "coverage-regression", "if"])).toBe(
        "${{ !cancelled() && needs.admission.outputs.docs_only != 'true' }}"
      );
      expect(yamlAt(policy.workflow, ["jobs", "coverage-regression", "name"])).toBe(
        "${{ needs.admission.outputs.legacy_coverage == 'true' && 'Coverage Artifact Migration' || 'Heavy / Coverage Regression' }}"
      );
      const heavyLaneParameters31 = yield* heavyLaneParameters(policy.heavyWorkflow);
      expect(A.some(heavyLaneParameters31, (lane) => A.contains(lane.ids, "coverage"))).toBe(false);
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
        const workflowJobs32 = yield* workflowJobs(policy.workflow);
        const comparison = jobSteps(workflowJobs32, "coverage-regression");
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
          const argument1 = path.join(temp, "1.json");
          const encodedJobsFixture1 = yield* encodeJobsFixture([
            { jobs: [{ name: "Unrelated verification" }] },
            { jobs: [original] },
          ]);
          yield* fs.writeFileString(argument1, encodedJobsFixture1);
        }
        const argument2 = path.join(temp, "2.json");
        const encodedJobsFixture2 = yield* encodeJobsFixture([
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
        ]);
        yield* fs.writeFileString(argument2, encodedJobsFixture2);
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
        const readFileString33 = yield* fs.readFileString(output);
        expect(readFileString33).toBe(scenario.output);
        const readFileString34 = yield* fs.readFileString(calls);
        expect(readFileString34).toBe(scenario.original ? "1\n2\n" : "1\n");
        if (Str.isNonEmpty(scenario.output)) {
          const attempt = parseProfileOutput(scenario.output).attempt ?? "";
          const manifest = path.join(temp, `.beep/ci-coverage-inputs/unit-coverage-123-${attempt}-labs/manifest.json`);
          yield* fs.makeDirectory(path.dirname(manifest), { recursive: true });
          const encodedJobsFixture = yield* encodeJobsFixture({
            partitionId: "labs",
            identity: { runId: "123", runAttempt: Number(attempt) },
          });
          yield* fs.writeFileString(manifest, encodedJobsFixture);
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

  it.effect("reports Heavy coverage and integration contexts without a resolved reusable workflow probe", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const text = yield* fs.readFileString(path.join(root, ".github/workflows/check.yml"));
      const workflow = parseWorkflowYaml(text);
      const jobs = yield* workflowJobs(workflow);
      // heavy.yml@main declares neither context any more, so admission no longer
      // reads the resolved reusable revision to choose a migration name.
      const admission = jobSteps(jobs, "admission");
      expect(A.some(admission, (step) => step.name === "Determine coverage rollout context")).toBe(false);
      expect(text).not.toContain("steps.coverage-rollout");
      expect(text).not.toContain(".referenced_workflows[]?");
      expect(text).not.toContain("legacy_integration");
      expect(yamlAt(workflow, ["jobs", "admission", "outputs", "legacy_coverage"])).toBe("false");
      expect(yamlAt(workflow, ["jobs", "test-integration", "name"])).toBe("Heavy / Test Integration");
      const laneGate = stepByName(jobSteps(jobs, "coverage-regression"), "Determine comparison execution");
      expect(laneGate.env).not.toHaveProperty("LEGACY_COVERAGE");
      expect(laneGate.run ?? "").not.toContain("LEGACY_COVERAGE");
    })
  );
  it.effect("executes local and signed pilots with the private activation creation mask", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const jobs = yield* workflowJobs(parseWorkflowYaml(heavyText));
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const pilotSteps: ReadonlyArray<readonly [string, string]> = [
        ["local-pilot-observe", "Observe the existing local pilot"],
        ["producer-execute", "Execute closed signed trial and retain private observation"],
      ];
      for (const [job, name] of pilotSteps) {
        const script = stepRun(jobSteps(jobs, job), name);
        // Observe the mask at the real shell's execution boundary, without running a pilot.
        const child = yield* spawner.spawn(
          ChildProcess.make("/usr/bin/bash", ["-c", `umask 022\ntimeout() { umask; }\n${script}`], {
            env: { BEEP_CACHE_PRODUCER_PRIVATE_ROOT: "/private-pilot-fixture" },
            stdout: "pipe",
            stderr: "pipe",
          })
        );
        const [status, stdout, stderr] = yield* Effect.all(
          [
            child.exitCode,
            child.stdout.pipe(Stream.decodeText(), Stream.mkString),
            child.stderr.pipe(Stream.decodeText(), Stream.mkString),
          ],
          { concurrency: "unbounded" }
        );
        expect(Number(status)).toBe(0);
        expect(Str.trim(stdout)).toBe("0077");
        expect(stderr).toBe("");
      }
    })
  );
  it.effect("keeps manual local observations separate from protected producers and quality verdicts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* findRepoRoot();
      const heavyText = yield* fs.readFileString(`${root}/.github/workflows/heavy.yml`);
      const callerText = yield* fs.readFileString(`${root}/.github/workflows/cache-local-observe.yml`);
      const heavy = parseWorkflowYaml(heavyText);
      const caller = parseWorkflowYaml(callerText);
      expect(yamlAt(caller, ["on", "workflow_dispatch", "inputs", "computation", "options"])).toEqual([
        "@beep/types#lint",
        "@beep/identity#lint",
      ]);
      expect(yamlAt(caller, ["jobs", "observe", "secrets"])).toBeUndefined();
      expect(yamlAt(caller, ["concurrency", "cancel-in-progress"])).toBe(false);
      expect(yamlAt(heavy, ["on", "workflow_call", "inputs", "local_pilot_observation", "default"])).toBe(false);
      expect(yamlAt(heavy, ["jobs", "local-pilot-observe", "environment"])).toBeUndefined();
      expect(yamlAt(heavy, ["jobs", "local-pilot-observe", "timeout-minutes"])).toBe(20);
      expect(yamlAt(heavy, ["jobs", "local-pilot-observe", "runs-on"])).toBe("beep-ec2-heavy");
      expect(yamlAt(heavy, ["jobs", "local-pilot-observe", "if"])).toContain(
        "github.workflow_ref == 'beep-effect/beep-effect/.github/workflows/cache-local-observe.yml@refs/heads/main'"
      );
      const jobs = yield* workflowJobs(heavy);
      expect(setupMonorepoInputs(jobs, "local-pilot-observe")).toEqual({
        "turbo-remote-cache": "false",
        "r2-enabled": "false",
        "app-secrets": "false",
      });
      const localSteps = jobSteps(jobs, "local-pilot-observe");
      expect(stepRun(localSteps, "Observe the existing local pilot")).toContain("15m");
      expect(stepRun(localSteps, "Observe the existing local pilot")).toContain("cache pilot");
      expect(stepRun(localSteps, "Project only bounded digest and count evidence")).toContain(
        "bun --no-env-file run beep ci cache-local-summary"
      );
      expect(stepByName(localSteps, "Retain only the public summary for one day").with).toMatchObject({
        "retention-days": 1,
        path: "${{ steps.summary.outputs.path }}",
      });
      const local = yield* encodeJobsFixture(yamlAt(heavy, ["jobs", "local-pilot-observe"]));
      for (const forbidden of [
        "secrets.",
        "producer-install",
        "producer-run",
        "producer-publish",
        "BEEP_CACHE_PRODUCER_STORE",
      ])
        expect(local).not.toContain(forbidden);
      for (const job of ["verify", "producer-inspect", "producer-prepare", "producer-execute"])
        expect(yamlAt(heavy, ["jobs", job, "if"])).toContain("!inputs.local_pilot_observation");
    })
  );
});
const OperationalPatternsJson = S.fromJsonString(CiOperationalPatterns);
