/**
 * CI lane definitions owned by the CLI (one-round-loop P0 inversion).
 *
 * Every `.github/workflows/check.yml` lane body lives here as
 * {@link QualityTaskStep} plans so hosted CI and local replays execute the
 * same commands. GitHub-context orchestration (the desktop-IPC path filter,
 * commitlint range computation, fallow envelope
 * validation and artifact upload) stays in the workflow and arrives as flags.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { $RepoCliId } from "@beep/identity/packages";
import {
  isCiSync,
  readTurboCacheEnvironment,
  resolveTurboCacheStep,
  turboEnvExtendsAmbient,
  turboEnvOverrides,
} from "@beep/repo-cli-kit/cli/EnvConfig";
import {
  isLabsWorkspaceDir,
  LABS_TURBO_EXCLUDE_FILTER,
  LABS_TURBO_SELECT_FILTER,
} from "@beep/repo-cli-kit/cli/Labs/index";
import { resolveTurboCachePlan, turboCachePlanArgs } from "@beep/repo-cli-kit/cli/TurboCache";
import { runCaptured, runToExit } from "@beep/repo-cli-kit/process/StepExec";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import { assertCacheRuntimeKeyUnspecified, cacheRuntimeStep } from "../Cache/Cache.runtime.step.ts";
import { QualityCheckConcurrency } from "../Quality/Quality.schemas.ts";
import {
  QualityTaskStep,
  runQualityTaskStreamingLaneGroup,
  runQualityTaskStreamingStepGroup,
} from "../Quality/Tasks.ts";
import { CiCommandError, CiLanePartitionError, reportCiCommandError } from "./Ci.errors.ts";
import {
  ciCoveragePlan,
  ciCoverageTestArgs,
  runCiCoverageComparison,
  runCiCoveragePartition,
  runCiLabsCoverage,
} from "./CiCoverage.ts";
import { CI_LANE_DEFAULT_BASE, resolveCiLaneBase } from "./CiEventBase.ts";
import {
  CI_LANE_PARTITION_TABLE_PATH,
  CI_LANE_PARTITIONS,
  CiLanePartitionId,
  CiLanePartitionShard,
  ciLaneDefaultPlacements,
  PartitionedCiLane as PartitionedCiLaneSchema,
  withCiLaneDefaultPlacements,
} from "./CiLanePartitions.ts";
import { CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import { DOCS_POLICY_ROOT_TASKS } from "./DocsPolicy.ts";
import type { FsUtils } from "@beep/repo-utils";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubCheckFailurePolicy } from "../Quality/Quality.schemas.ts";
import type {
  CiCoverageArtifactPlan,
  QualityTaskConfigurationError,
  QualityTaskGroupFailed,
  QualityTaskLaneInput,
} from "../Quality/Tasks.ts";
import type { CiLanePartition, PartitionedCiLane } from "./CiLanePartitions.ts";

const $I = $RepoCliId.create("commands/Ci/CiLane");

type CiLaneEnvironment =
  | SecureRandom.SecureRandom
  | Digest.Digest
  | FileSystem.FileSystem
  | FsUtils
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Git;

const JSDOC_CI_INVENTORY_JSON_PATH = ".beep/ci/jsdoc-documentation.inventory.jsonc";
const STORYBOOK_PACKAGE_NAME = "@beep/storybook";
const STORYBOOK_BUILD_TASK = "storybook:build";
const STORYBOOK_TURBO_SELECT_FILTER = `--filter=${STORYBOOK_PACKAGE_NAME}`;
const STORYBOOK_STATIC_INDEX_PATH = "apps/storybook/storybook-static/index.html";
const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

/**
 * Parity classes for CI lanes (one-round-loop D2 taxonomy).
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CI_LANE_CLASS_VALUES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_CLASS_VALUES.includes("ci-native")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CI_LANE_CLASS_VALUES = ["cli-runnable", "workflow-gated", "ci-native"] as const;

/**
 * Parity class for a CI lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneClass } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLaneClass.is["cli-runnable"]("cli-runnable"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLaneClass = LiteralKit(CI_LANE_CLASS_VALUES).pipe(
  $I.annoteSchema("CiLaneClass", {
    description: "Parity class for a CI lane (cli-runnable, workflow-gated, or ci-native).",
  })
);

/**
 * Parity class for a CI lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import type { CiLaneClass } from "@beep/repo-cli/commands/Ci"
 *
 * const laneClass: CiLaneClass = "cli-runnable"
 * console.log(laneClass) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiLaneClass = typeof CiLaneClass.Type;

/**
 * Local replay fidelities for CI lanes.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CI_LANE_REPLAY_VALUES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_REPLAY_VALUES.includes("exact")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CI_LANE_REPLAY_VALUES = ["exact", "approximate", "none"] as const;

/**
 * Local replay fidelity for a CI lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneReplay } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLaneReplay.is.exact("exact"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLaneReplay = LiteralKit(CI_LANE_REPLAY_VALUES).pipe(
  $I.annoteSchema("CiLaneReplay", {
    description: "Local replay fidelity for a CI lane (exact, approximate, or none).",
  })
);

/**
 * Local replay fidelity for a CI lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import type { CiLaneReplay } from "@beep/repo-cli/commands/Ci"
 *
 * const replay: CiLaneReplay = "exact"
 * console.log(replay) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiLaneReplay = typeof CiLaneReplay.Type;

/**
 * Runnable CI lane identifiers (every check.yml lane with a CLI body).
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CI_LANE_ID_VALUES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_ID_VALUES.includes("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CI_LANE_ID_VALUES = [
  "build",
  "check",
  "codegen",
  "commitlint",
  "coverage",
  "desktop-ipc",
  "docgen",
  "docs-policy",
  "doctest",
  "ecosystem",
  "fallow",
  "jsdoc-ratchet",
  "labs",
  "lint",
  "lint-policy",
  "nix",
  "property",
  "repo-sanity",
  "sast",
  "secrets",
  "security",
  "storybook",
  "test-integration",
  "test-unit",
] as const;

/**
 * Runnable CI lane identifier.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneId } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLaneId.is.lint("lint"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLaneId = LiteralKit(CI_LANE_ID_VALUES).pipe(
  $I.annoteSchema("CiLaneId", {
    description: "Runnable CI lane identifier handled by beep ci lane.",
  })
);

/**
 * Runnable CI lane identifier.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import type { CiLaneId } from "@beep/repo-cli/commands/Ci"
 *
 * const lane: CiLaneId = "lint"
 * console.log(lane) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiLaneId = typeof CiLaneId.Type;

const isCiLaneId = S.is(CiLaneId);

/**
 * Docgen lane execution modes.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { DOCGEN_LANE_MODE_VALUES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DOCGEN_LANE_MODE_VALUES.includes("affected")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DOCGEN_LANE_MODE_VALUES = ["auto", "none", "affected", "full"] as const;

/**
 * Docgen lane execution mode.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { DocgenLaneMode } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DocgenLaneMode.is.affected("affected"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenLaneMode = LiteralKit(DOCGEN_LANE_MODE_VALUES).pipe(
  $I.annoteSchema("DocgenLaneMode", {
    description: "Docgen lane execution mode, including CLI-owned automatic scope selection.",
  })
);

/**
 * Docgen lane execution mode.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import type { DocgenLaneMode } from "@beep/repo-cli/commands/Ci"
 *
 * const mode: DocgenLaneMode = "affected"
 * console.log(mode) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocgenLaneMode = typeof DocgenLaneMode.Type;

const CiWorkflow = LiteralKit(["check", "heavy", "storybook"]).pipe(
  $I.annoteSchema("CiWorkflow", { description: "The workflow that produces a declared CI lane context." })
);

/**
 * Machine-readable descriptor for a hosted workflow lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneDescriptor } from "@beep/repo-cli/commands/Ci"
 *
 * const descriptor = CiLaneDescriptor.make({
 *   id: "lint",
 *   contextName: "Lint",
 *   required: true,
 *   laneClass: "cli-runnable",
 *   replay: "exact",
 *   flags: ["--affected", "--base", "--summarize"]
 * })
 * console.log(descriptor.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneDescriptor extends S.Opaque<CiLaneDescriptor, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    contextName: S.String,
    workflow: CiWorkflow.pipe(
      S.withConstructorDefault(Effect.succeed(CiWorkflow.Enum.check)),
      S.withDecodingDefaultTypeKey(Effect.succeed(CiWorkflow.Enum.check))
    ),
    required: S.Boolean,
    laneClass: CiLaneClass,
    replay: CiLaneReplay,
    flags: S.Array(S.String),
    notes: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("CiLaneDescriptor", {
      description: "Machine-readable descriptor for a hosted CI lane.",
    })
  )
) {}

const TURBO_SHAPE_FLAGS = ["--affected", "--base", "--summarize"] as const;
// Every partitioned lane can plan its partitions and prove a plan it was handed.
const PARTITION_PLAN_FLAGS = ["--plan-partitions", "--planned-partitions"] as const;

/**
 * Hosted lane inventory for check, heavy and storybook workflows.
 *
 * Order mirrors the packet parity table
 * (`goals/one-round-loop/research/ci-lane-parity.md`).
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CI_LANE_DESCRIPTORS } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * console.log(A.length(CI_LANE_DESCRIPTORS))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CI_LANE_DESCRIPTORS: ReadonlyArray<CiLaneDescriptor> = [
  CiLaneDescriptor.make({
    id: "pr-size",
    contextName: "PR Size Label",
    required: false,
    laneClass: "ci-native",
    replay: "none",
    flags: [],
    notes: "CLI-owned label diff; same-repository PR only.",
  }),
  CiLaneDescriptor.make({
    id: "lint",
    contextName: "Lint",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS, "--partition", "--dry-run", "--force", ...PARTITION_PLAN_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "lint-policy",
    workflow: "heavy",
    contextName: "Heavy / Lint Policy",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
    notes:
      "Pull-request runs pass --affected --base: `beep lint policy --affected` runs Turbo's changed scope unless the change set escalates it; push runs state --full.",
  }),
  CiLaneDescriptor.make({
    id: "repo-sanity",
    contextName: "Repo Sanity",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--changeset-status", "--docs-only"],
    notes:
      "Always validates the changeset graph and runs the private home path law; CI also passes --changeset-status on pull requests. A docs_only pull request runs --docs-only: the law, the changeset graph and the changeset status, and nothing that reads code-route paths.",
  }),
  CiLaneDescriptor.make({
    id: "docs-policy",
    contextName: "Docs Policy",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--base"],
    notes:
      "Runs on docs_only pull requests only (route-soundness-repair ROUT-02, D8): the knowledge, packet and Markdown root tasks in DOCS_POLICY_ROOT_TASKS plus `knowledge doctor ci --base`, which Heavy / Lint Policy runs for code pull requests and main pushes.",
  }),
  CiLaneDescriptor.make({
    id: "check",
    workflow: "heavy",
    contextName: "Heavy / Check",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "test-unit",
    contextName: "Test Unit",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS, "--partition", "--dry-run", "--force", "--coverage-output", ...PARTITION_PLAN_FLAGS],
    notes:
      "Runs unit suites under Bun; --coverage-output instruments that same execution and seals its partition receipt.",
  }),
  CiLaneDescriptor.make({
    id: "test-integration",
    contextName: "Heavy / Test Integration",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS, "--partition", "--dry-run", ...PARTITION_PLAN_FLAGS],
    notes:
      "Hosted partitions since 2026-11-09: `lps-int-N` runs one Vitest shard of @beep/law-practice-server's integration suite and `int-rest` runs the root integration lane for every other package; a fail-closed check.yml aggregate reports the context the heavy pool used to own.",
  }),
  CiLaneDescriptor.make({
    id: "coverage",
    workflow: "check",
    contextName: "Heavy / Coverage Regression",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS, "--compare-only", "--coverage-input"],
    notes:
      "The Check artifact consumer compares Bun/Istanbul unit and Labs receipts. Legacy callers without --compare-only retain the standalone producer until the old reusable workflow retires.",
  }),
  CiLaneDescriptor.make({
    id: "docgen",
    workflow: "heavy",
    contextName: "Heavy / Docgen",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--mode", "--base", "--head"],
    notes: "The CLI computes none/affected/full from the base-to-head diff when --mode auto is selected.",
  }),
  CiLaneDescriptor.make({
    id: "doctest",
    workflow: "heavy",
    contextName: "Heavy / Doctest",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: [],
    notes:
      "Always runs the full Turbo doctest fleet; the shared --base, --head, and --mode flags parse but have no doctest effect.",
  }),
  // This visible family context lands non-required; promotion is a later
  // branch-ruleset action after it establishes a stable green history.
  CiLaneDescriptor.make({
    id: "ecosystem",
    contextName: "Ecosystem Contracts",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
    notes: "Runs the first ecosystem member's type and bundle contracts explicitly.",
  }),
  CiLaneDescriptor.make({
    id: "codegen",
    contextName: "Codegen Drift",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
  }),
  CiLaneDescriptor.make({
    id: "desktop-ipc",
    contextName: "Professional Desktop IPC Stdio",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: [],
    notes:
      "Path filter, Rust toolchain setup, and the src-tauri cargo check + clippy steps (gated on desktop_rust_relevant from `beep ci change-profile`) stay in the workflow; the lane body builds the sidecar and runs the IPC proof.",
  }),
  CiLaneDescriptor.make({
    id: "fallow",
    contextName: "Fallow Advisory Envelopes",
    required: false,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--base", "--validate-envelopes"],
    notes:
      "Envelope validation and artifact upload stay in the workflow; --validate-envelopes replays validation locally.",
  }),
  CiLaneDescriptor.make({
    id: "jsdoc-ratchet",
    contextName: "JSDoc Ratchet",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--inventory"],
    notes:
      "Runs jsdoc-inventory before jsdoc-ratchet, matching hosted CI's sequence, unless --inventory <path> supplies a prebuilt inventory (then only the ratchet runs).",
  }),
  // Quality-lane audit D12: Build runs on pull requests affected-scoped with
  // remote-cache read; trusted main pushes run unscoped and are the only
  // cache writer. It dispatches from heavy.yml (the beep-ec2-heavy runner
  // group admits heavy.yml@main on pull requests, not check.yml jobs), so its
  // hosted context carries the Heavy prefix. Still non-required until it has
  // a stable green history.
  CiLaneDescriptor.make({
    id: "build",
    workflow: "heavy",
    contextName: "Heavy / Build",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
    notes:
      "Pull-request runs are affected-scoped (--affected --base) with remote-cache read; push runs are unscoped and write the cache.",
  }),
  CiLaneDescriptor.make({
    id: "commitlint",
    contextName: "Commitlint",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--from", "--to", "--last"],
    notes: "CI computes the commit range from event context and passes it as flags.",
  }),
  CiLaneDescriptor.make({
    id: "secrets",
    contextName: "Secret Scanning",
    required: true,
    laneClass: "ci-native",
    replay: "approximate",
    flags: [],
    notes:
      "CI runs the pinned gitleaks image with base-pinned config; the local lane approximates via beep quality github-checks secrets.",
  }),
  CiLaneDescriptor.make({
    id: "security",
    contextName: "Security",
    required: true,
    laneClass: "ci-native",
    replay: "approximate",
    flags: [],
    notes:
      "CI runs the OSV scanner action; the local lane approximates via beep quality github-checks security. See dependency-review for the CI-only sub-gate.",
  }),
  CiLaneDescriptor.make({
    id: "dependency-review",
    contextName: "Security",
    required: true,
    laneClass: "ci-native",
    // DELIBERATE fail-open: dependency review needs GitHub's dependency-graph API.
    // Record this CI-only constraint in the gate-integrity expectation file.
    replay: "none",
    flags: [],
    notes: "Requires the GitHub dependency-graph API; permanently CI-only.",
  }),
  CiLaneDescriptor.make({
    id: "nix",
    contextName: "Nix Shell",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
  }),
  CiLaneDescriptor.make({
    id: "sast",
    contextName: "SAST",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
  }),
  CiLaneDescriptor.make({
    id: "property",
    contextName: "Property Laws",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--affected", "--base", "--summarize", "--runs", "--seed", "--filter", "--shard"],
    notes:
      "Added by one-round-loop P1 (D3): schema property laws at a 400-run PR floor via BEEP_FC_NUM_RUNS, pinned to a fixed BEEP_FC_SEED so local and CI test identical inputs (one-round determinism; nightly rotates seeds); lands non-required, flips to required at P4 after a stable green history. Hosted CI runs it as four slices under one aggregate context: the two Vitest shards of @beep/repo-cli (--filter @beep/repo-cli --shard 1/2 and 2/2), packages/foundation with packages/drivers, and every other package; --filter takes comma-separated Turbo filters, and without --filter and --shard the lane runs everything.",
  }),
  // lab-apps-lifecycle P2 (ratified row 10): the single visible labs proof
  // lane. Labs are excluded from every required turbo lane (row 9); this lane
  // positively selects the labs glob and is PERMANENTLY non-required — never
  // add its "Labs" context to ruleset 10240248.
  CiLaneDescriptor.make({
    id: "labs",
    contextName: "Labs",
    required: false,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--summarize"],
    notes:
      "Path-gated in the workflow to direct apps/labs/** changes on PRs; push and local replays run the full labs glob. Zero labs => zero tasks (green).",
  }),
  // Quality-lane audit D13: Storybook used to build and browser-test on every
  // PR with no gate, no descriptor, and no local replay (584 s per PR). The
  // lane body now lives here, and its affected shape asks Turbo whether
  // @beep/storybook sits in the dependency-aware affected set (a dry-run
  // probe, so transitive workspace changes such as @beep/schema count).
  // storybook.yml carries only the goals_only gate, the Playwright browser
  // cache, and the artifact upload. Non-required: never add "Storybook" to
  // ruleset 10240248 without a stable green history.
  CiLaneDescriptor.make({
    id: "storybook",
    workflow: "storybook",
    contextName: "Storybook",
    required: false,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
    notes:
      "Builds and browser-tests @beep/storybook through one positive Turbo filter. --affected --base first probes `turbo run storybook:build --filter=@beep/storybook --affected --dry-run=json` (Turbo intersects the filter with its dependency-aware affected set) and skips the lane when the plan selects no @beep/storybook task, so local and PR replays run for transitive workspace changes and skip docs-only change sets; storybook.yml keeps only the goals_only gate and lets the lane decide. Requires Playwright Chromium (bunx playwright install chromium).",
  }),
];

/**
 * Options accepted by {@link runCiLane}.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneRunOptions } from "@beep/repo-cli/commands/Ci"
 *
 * const options = CiLaneRunOptions.make({
 *   affected: true,
 *   base: "origin/main",
 *   head: "HEAD",
 *   summarize: true,
 *   mode: "affected",
 *   to: "HEAD",
 *   last: false,
 *   changesetStatus: false,
 *   validateEnvelopes: false,
 *   dryRun: false,
 *   force: false
 * })
 * console.log(options.base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRunOptions extends S.Opaque<CiLaneRunOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    affected: S.Boolean,
    base: S.String,
    head: S.String,
    summarize: S.Boolean,
    mode: DocgenLaneMode,
    from: S.optionalKey(S.String),
    to: S.String,
    last: S.Boolean,
    changesetStatus: S.Boolean,
    validateEnvelopes: S.Boolean,
    runs: S.optionalKey(S.String),
    seed: S.optionalKey(S.String),
    filter: S.optionalKey(S.String),
    shard: S.optionalKey(CiLanePartitionShard),
    partition: S.optionalKey(CiLanePartitionId),
    plannedPartitions: CiLanePartitionId.pipe(S.Array, S.optionalKey),
    inventory: S.optionalKey(S.String),
    coverageOutput: S.optionalKey(S.String),
    coverageInput: S.optionalKey(S.String),
    compareOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    coverageOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    dryRun: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    force: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    docsOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("CiLaneRunOptions", {
      description: "Shape and optional Turbo scope for running one CI lane body.",
    })
  )
) {}

// The property lane invokes turbo directly (not through a root script, so it misses the
// CI concurrency cap in Quality/Tasks.ts). Turbo's default concurrency (~10) starved the
// hosted runner into 5-minute vitest test timeouts (workspace-use-cases property suite);
// see goals/quality-speedup/research/instantiation-census.md §5. Lane replay is CI-parity
// by design, so the cap applies unconditionally.
const CI_LANE_TURBO_CONCURRENCY_ARG = "--concurrency=4";

const turboShapeArgs = (options: CiLaneRunOptions): ReadonlyArray<string> => [
  ...(options.affected ? ["--affected"] : A.empty<string>()),
  ...(options.summarize ? ["--summarize"] : A.empty<string>()),
  // Commas separate several Turbo filters. Turbo unions the positive ones and subtracts the negated
  // ones, so two slices can cover a lane exactly once without a package table.
  ...O.match(O.fromUndefinedOr(options.filter), {
    onNone: A.empty<string>,
    onSome: (filter) =>
      A.map(A.filter(A.map(Str.split(filter, ","), Str.trim), Str.isNonEmpty), (entry) => `--filter=${entry}`),
  }),
];

// Vitest slice of the swept packages, forwarded behind Turbo's `--` so each package's own
// `vitest run` receives it. Only the property lane reads it.
const vitestShardPassThroughArgs = (options: CiLaneRunOptions): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(options.shard), {
    onNone: A.empty<string>,
    onSome: ({ index, total }) => ["--", `--shard=${index}/${total}`],
  });

const decodeCiLaneShardFlag = (raw: string) => {
  const parts = A.map(Str.split(raw, "/"), Number);
  return S.decodeUnknownEffect(CiLanePartitionShard)(A.length(parts) === 2 ? { index: parts[0], total: parts[1] } : {});
};

// Default BEEP_FC_NUM_RUNS floor for the property lane. A blank or
// whitespace-only `--runs` (e.g. `--runs ""`) would otherwise reach the
// lane as `BEEP_FC_NUM_RUNS=""`, which the parsers treat as absent — the

// sweep would silently drop to fast-check's 100-run default. Normalize
// blank input back to the intended floor.
const DEFAULT_PROPERTY_LANE_RUNS = "400";

// Fixed fast-check seed for the per-PR property lane (one-round-loop P1). A
// FIXED seed makes the lane deterministic so a local `beep ci lane property`
// and the CI Property Laws lane (which runs the same command) test identical
// inputs — a local green then predicts a CI green, closing the seed-dependent
// gap that otherwise costs extra CI rounds. The nightly sweep leaves this
// unset to rotate seeds for breadth. Read as a floor of a fixed constant so a
// blank `--seed ""` cannot silently drop determinism.
const DEFAULT_PROPERTY_LANE_SEED = "20260708";

const resolvePropertyLaneRuns = (runs: string | undefined): string =>
  pipe(
    O.fromNullishOr(runs),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => DEFAULT_PROPERTY_LANE_RUNS)
  );

const resolvePropertyLaneSeed = (seed: string | undefined): string =>
  pipe(
    O.fromNullishOr(seed),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => DEFAULT_PROPERTY_LANE_SEED)
  );

const rootScriptStep = (
  repoRoot: string,
  label: string,
  script: string,
  scriptArgs: ReadonlyArray<string>,
  env?: Readonly<Record<string, string>>
): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: A.isReadonlyArrayEmpty(scriptArgs) ? ["run", script] : ["run", script, "--", ...scriptArgs],
    cwd: repoRoot,
    ...O.getSomesStruct({ env: O.fromUndefinedOr(env) }),
  });

const bunRunStep = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["run", ...args],
    cwd: repoRoot,
  });

const jsdocRatchetStep = (repoRoot: string, inventoryPath: string): QualityTaskStep =>
  bunRunStep(repoRoot, "ci:jsdoc-ratchet:ratchet", ["beep", "quality", "jsdoc-ratchet", "--inventory", inventoryPath]);

// Lint and Test Unit still run on hosted 16GB ubuntu-24.04 runners (check.yml),
// not the 32GB beep-ec2-heavy fleet, so they keep the 16GB-survival turbo cap
// instead of inheriting the fleet default that boundedRootTurboArgs applies in CI.
const HOSTED_16GB_TURBO_CONCURRENCY_ARG = "--concurrency=2";
// Docs Policy's tasks are file walkers and git reads on a 4-vCPU hosted runner, with no
// compiler or test worker in the graph.
const DOCS_POLICY_TURBO_CONCURRENCY_ARG = "--concurrency=4";
const decodeUnknownQualityCheckConcurrencyOption = S.decodeUnknownOption(QualityCheckConcurrency);

const qualityCheckConcurrencyArg = (): string =>
  `--concurrency=${pipe(
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv, which Biome cannot read. Owner: @beep/repo-cli. Exit: Biome reads turbo global.* declarations, or the name joins allowedEnvVars (#1855).
    decodeUnknownQualityCheckConcurrencyOption(Bun.env.BEEP_QUALITY_CHECK_CONCURRENCY),
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv, which Biome cannot read. Owner: @beep/repo-cli. Exit: Biome reads turbo global.* declarations, or the name joins allowedEnvVars (#1855).
    O.getOrElse(() => (Bun.env.GITHUB_ACTIONS === "true" ? "2" : "3"))
  )}`;

const directTurboArgs = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  ...tasks,
  ...turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: isCiSync() })),
  ...args,
];

const rootTaskStep = (repoRoot: string, label: string, task: string, base?: string): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bunx",
    cwd: repoRoot,
    args: directTurboArgs([task], ["--summarize"]),
    ...O.getSomesStruct({
      env: O.map(O.fromUndefinedOr(base), (base) => ({ BEEP_PROOF_BASE: base })),
    }),
  });

const CI_LANE_PARTITION_REPAIR =
  "Regenerate the deterministic LPT placement from goals/ci-lane-economics/research/tail-attribution.md and update the partition table.";

const ciLanePartitionError = (
  reason: CiLanePartitionError["reason"],
  laneId: string,
  detail: string,
  partition?: string,
  cause?: unknown
): CiLanePartitionError =>
  CiLanePartitionError.make({
    reason,
    laneId,
    ...O.getSomesStruct({ cause: O.fromUndefinedOr(cause), partition: O.fromUndefinedOr(partition) }),
    tablePath: CI_LANE_PARTITION_TABLE_PATH,
    repair: CI_LANE_PARTITION_REPAIR,
    message: `${detail} Table: ${CI_LANE_PARTITION_TABLE_PATH}. Repair: ${CI_LANE_PARTITION_REPAIR}`,
  });

const firstDuplicate = (values: ReadonlyArray<string>): O.Option<string> => {
  let seen = HashSet.empty<string>();
  for (const value of values) {
    if (HashSet.has(seen, value)) {
      return O.some(value);
    }
    seen = HashSet.add(seen, value);
  }
  return O.none();
};

const NonNegativeTaskCount = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * Proven intersection for one CI lane partition.
 *
 * **Example** (Inspect the selected task count)
 *
 * ```ts
 * import { CiLanePartitionProof } from "@beep/repo-cli/commands/Ci"
 *
 * const proof = CiLanePartitionProof.make({
 *   laneId: "lint",
 *   partition: "lint-a",
 *   selectedTaskCount: 2,
 *   partitionTaskCount: 1,
 *   packages: ["@beep/repo-cli"]
 * })
 * console.log(proof.partitionTaskCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLanePartitionProof extends S.Opaque<CiLanePartitionProof, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: PartitionedCiLaneSchema,
    partition: CiLanePartitionId,
    selectedTaskCount: NonNegativeTaskCount,
    partitionTaskCount: NonNegativeTaskCount,
    packages: S.Array(S.String),
    shard: S.optionalKey(CiLanePartitionShard),
  }).pipe(
    $I.annoteSchema("CiLanePartitionProof", {
      description: "Validated intersection between Turbo's selected task set and one committed partition.",
    })
  )
) {}

const proveCiLanePartitionDefinition = Effect.fn("CiLane.proveCiLanePartitionDefinition")(function* (
  laneId: PartitionedCiLane,
  partitionId: CiLanePartitionId,
  lanePartitions: ReadonlyArray<CiLanePartition>,
  table: ReadonlyArray<CiLanePartition>
): Effect.fn.Return<CiLanePartition, CiLanePartitionError> {
  const duplicatePartition = firstDuplicate(A.map(lanePartitions, (candidate) => candidate.id));
  if (O.isSome(duplicatePartition)) {
    return yield* ciLanePartitionError(
      "duplicate-partition",
      laneId,
      `Partition id ${duplicatePartition.value} appears more than once in the ${laneId} table.`,
      partitionId
    );
  }

  const definition = yield* O.match(
    A.findFirst(table, (candidate) => candidate.id === partitionId),
    {
      onNone: () =>
        ciLanePartitionError(
          "invalid-assignment",
          laneId,
          `Partition ${partitionId} is absent from the committed table.`,
          partitionId
        ),
      onSome: Effect.succeed,
    }
  );

  if (definition.lane !== laneId) {
    return yield* ciLanePartitionError(
      "invalid-assignment",
      laneId,
      `Partition ${partitionId} belongs to ${definition.lane}, not ${laneId}.`,
      partitionId
    );
  }

  return definition;
});

const packageBins: (
  lanePartitions: ReadonlyArray<CiLanePartition>
) => ReadonlyArray<readonly [string, ReadonlyArray<CiLanePartition>]> = flow(
  A.reduce(HashMap.empty<string, ReadonlyArray<CiLanePartition>>(), (bins, candidate) =>
    A.reduce(candidate.packages, bins, (acc, name) =>
      HashMap.set(
        acc,
        name,
        O.match(HashMap.get(acc, name), {
          onNone: () => A.of(candidate),
          onSome: (existing) => A.append(existing, candidate),
        })
      )
    )
  ),
  HashMap.entries,
  A.fromIterable,
  A.sort(Order.mapInput(Order.String, ([name]: readonly [string, ReadonlyArray<CiLanePartition>]) => name))
);

const shardIndexSetEquivalence = A.makeEquivalence(Num.Equivalence);

const proveShardedPackageBins = Effect.fn("CiLane.proveShardedPackageBins")(function* (
  laneId: PartitionedCiLane,
  partitionId: CiLanePartitionId,
  packageName: string,
  bins: ReadonlyArray<CiLanePartition>
): Effect.fn.Return<void, CiLanePartitionError> {
  const binIds = A.join(
    A.map(bins, (bin) => bin.id),
    ", "
  );
  const shards = A.getSomes(A.map(bins, (bin) => O.fromUndefinedOr(bin.shard)));
  if (A.isReadonlyArrayEmpty(shards)) {
    if (A.length(bins) > 1) {
      return yield* ciLanePartitionError(
        "duplicate-package",
        laneId,
        `Package ${packageName} appears in more than one ${laneId} partition.`,
        partitionId
      );
    }
    return;
  }
  if (A.length(shards) !== A.length(bins)) {
    return yield* ciLanePartitionError(
      "sharded-package-unsharded",
      laneId,
      `Package ${packageName} is sharded in some ${laneId} partitions but unsharded in others (${binIds}).`,
      partitionId
    );
  }
  const oversizedBin = A.findFirst(bins, (bin) => A.length(bin.packages) !== 1);
  if (O.isSome(oversizedBin)) {
    return yield* ciLanePartitionError(
      "sharded-bin-package-count",
      laneId,
      `Partition ${oversizedBin.value.id} carries a shard but names ${A.length(oversizedBin.value.packages)} packages; a sharded partition holds exactly one.`,
      partitionId
    );
  }
  const totals = A.dedupe(A.map(shards, (shard) => shard.total));
  if (A.length(totals) !== 1) {
    return yield* ciLanePartitionError(
      "shard-total-mismatch",
      laneId,
      `Package ${packageName} has shards with different totals (${A.join(A.map(totals, String), ", ")}) across ${binIds}.`,
      partitionId
    );
  }
  const indexes = A.sort(
    A.map(shards, (shard) => shard.index),
    Order.Number
  );
  const duplicateIndex = firstDuplicate(A.map(indexes, String));
  if (O.isSome(duplicateIndex)) {
    return yield* ciLanePartitionError(
      "shard-index-duplicate",
      laneId,
      `Package ${packageName} has shard index ${duplicateIndex.value} more than once across ${binIds}.`,
      partitionId
    );
  }
  const total = O.getOrThrow(A.head(totals));
  if (!shardIndexSetEquivalence(indexes, A.range(1, total))) {
    return yield* ciLanePartitionError(
      "shard-set-incomplete",
      laneId,
      `Package ${packageName} has shard indexes ${A.join(A.map(indexes, String), ", ")} across ${binIds}; expected exactly 1..${total}.`,
      partitionId
    );
  }
});

const proveCiLanePartitionShards = Effect.fn("CiLane.proveCiLanePartitionShards")(function* (
  laneId: PartitionedCiLane,
  partitionId: CiLanePartitionId,
  lanePartitions: ReadonlyArray<CiLanePartition>
): Effect.fn.Return<void, CiLanePartitionError> {
  yield* Effect.forEach(
    packageBins(lanePartitions),
    ([packageName, bins]) => proveShardedPackageBins(laneId, partitionId, packageName, bins),
    { discard: true }
  );
});

const proveCiLanePartitionCoverage = Effect.fn("CiLane.proveCiLanePartitionCoverage")(function* (
  laneId: PartitionedCiLane,
  partitionId: CiLanePartitionId,
  workspacePackageNames: ReadonlyArray<string>,
  taskPackageNames: ReadonlyArray<string>,
  lanePartitions: ReadonlyArray<CiLanePartition>
): Effect.fn.Return<HashSet.HashSet<string>, CiLanePartitionError> {
  yield* proveCiLanePartitionShards(laneId, partitionId, lanePartitions);
  const assignedPackages = A.dedupe(A.flatMap(lanePartitions, (candidate) => candidate.packages));

  const workspacePackages = HashSet.fromIterable(workspacePackageNames);
  const taskPackages = HashSet.fromIterable(taskPackageNames);
  const assignedPackageSet = HashSet.fromIterable(assignedPackages);
  const staleWorkspacePackage = A.findFirst(assignedPackages, (name) => !HashSet.has(workspacePackages, name));
  if (O.isSome(staleWorkspacePackage)) {
    return yield* ciLanePartitionError(
      "stale-package",
      laneId,
      `Package ${staleWorkspacePackage.value} is assigned but absent from the workspace.`,
      partitionId
    );
  }

  const staleTaskPackage = A.findFirst(assignedPackages, (name) => !HashSet.has(taskPackages, name));
  if (O.isSome(staleTaskPackage)) {
    return yield* ciLanePartitionError(
      "stale-package",
      laneId,
      `Package ${staleTaskPackage.value} is assigned but has no executable ${laneId} task.`,
      partitionId
    );
  }

  const missingTaskPackage = A.findFirst(taskPackageNames, (name) => !HashSet.has(assignedPackageSet, name));
  if (O.isSome(missingTaskPackage)) {
    return yield* ciLanePartitionError(
      "missing-package",
      laneId,
      `Package ${missingTaskPackage.value} has an executable ${laneId} task but no deterministic placement.`,
      partitionId
    );
  }

  return assignedPackageSet;
});

/**
 * Prove complete, disjoint partition coverage and select one partition's tasks.
 *
 * **Details**
 *
 * The proof checks the entire current non-labs workspace task inventory before
 * considering the requested Turbo shape. An executable package the table does
 * not name takes its `ciLaneDefaultPlacements` bin first, so a new workspace
 * needs no table edit. The proof then fails closed for duplicate, stale, or
 * still-unplaced packages and intersects the dry-run selected task set with
 * the requested partition.
 *
 * **Example** (Prove a small lint partition)
 *
 * ```ts
 * import { proveCiLanePartition } from "@beep/repo-cli/commands/Ci"
 *
 * const proof = proveCiLanePartition(
 *   "lint",
 *   "lint-a",
 *   ["@beep/repo-cli"],
 *   ["@beep/repo-cli"],
 *   ["@beep/repo-cli"],
 *   false
 * )
 * console.log(proof)
 * ```
 *
 * @param laneId - Partitioned lane being proved.
 * @param partitionId - Requested partition for the lane.
 * @param workspacePackageNames - Every package currently in the workspace.
 * @param taskPackageNames - Every current non-labs workspace package with the lane task.
 * @param selectedTaskPackageNames - Executable packages selected by Turbo's shaped dry run.
 * @param affected - Whether Turbo may select only packages affected relative to the base.
 * @param table - Schema-backed table to validate; injectable for focused failure tests.
 * @returns A typed effect containing the requested partition intersection.
 * @category validation
 * @since 0.0.0
 */
export const proveCiLanePartition = Effect.fn("CiLane.proveCiLanePartition")(function* (
  laneId: PartitionedCiLane,
  partitionId: CiLanePartitionId,
  workspacePackageNames: ReadonlyArray<string>,
  taskPackageNames: ReadonlyArray<string>,
  selectedTaskPackageNames: ReadonlyArray<string>,
  affected: boolean,
  table: ReadonlyArray<CiLanePartition> = CI_LANE_PARTITIONS
): Effect.fn.Return<CiLanePartitionProof, CiLanePartitionError> {
  const lanePartitions = withCiLaneDefaultPlacements(
    A.filter(table, (candidate) => candidate.lane === laneId),
    taskPackageNames
  );
  const definition = yield* proveCiLanePartitionDefinition(
    laneId,
    partitionId,
    lanePartitions,
    A.appendAll(
      lanePartitions,
      A.filter(table, (candidate) => candidate.lane !== laneId)
    )
  );
  const assignedPackageSet = yield* proveCiLanePartitionCoverage(
    laneId,
    partitionId,
    workspacePackageNames,
    taskPackageNames,
    lanePartitions
  );

  const selectedPackages = HashSet.fromIterable(selectedTaskPackageNames);
  const unknownSelectedPackage = A.findFirst(
    selectedTaskPackageNames,
    (name) => !HashSet.has(assignedPackageSet, name)
  );
  if (O.isSome(unknownSelectedPackage)) {
    return yield* ciLanePartitionError(
      "unknown-selected-task",
      laneId,
      `Turbo selected ${unknownSelectedPackage.value}, which has no deterministic ${laneId} placement.`,
      partitionId
    );
  }

  const missingSelectedPackages = affected
    ? A.empty<string>()
    : A.filter(taskPackageNames, (name) => !HashSet.has(selectedPackages, name));
  if (A.isReadonlyArrayNonEmpty(missingSelectedPackages)) {
    return yield* ciLanePartitionError(
      "incomplete-selection",
      laneId,
      `Turbo's unscoped ${laneId} dry run omitted executable packages: ${A.join(missingSelectedPackages, ", ")}.`,
      partitionId
    );
  }

  const packages = A.filter(definition.packages, (name) => HashSet.has(selectedPackages, name));
  return CiLanePartitionProof.make({
    laneId,
    partition: partitionId,
    selectedTaskCount: A.length(selectedTaskPackageNames),
    partitionTaskCount: A.length(packages),
    packages,
    ...O.getSomesStruct({ shard: O.fromUndefinedOr(definition.shard) }),
  });
});

/**
 * List the partitions of one lane that a run has to allocate for a Turbo selection.
 *
 * **Details**
 *
 * A partition is needed when at least one of its packages (curated or
 * default-placed) is in the selection. The integration catch-all bin is always
 * needed: Turbo scopes its unsplit and serial tasks itself, and they are not
 * part of the parallel-task selection. `check.yml`'s Test Plan job builds the
 * shard matrices from this list, and every allocated partition re-derives it
 * from its own selection to prove the plan left nothing out.
 *
 * **Example** (Plan one affected lint package)
 *
 * ```ts
 * import { plannedCiLanePartitions } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(plannedCiLanePartitions("lint", ["@beep/repo-cli"], ["@beep/repo-cli"])) // ["lint-a"]
 * ```
 *
 * @param laneId - Partitioned lane being planned.
 * @param taskPackageNames - Every current non-labs workspace package with the lane task.
 * @param selectedTaskPackageNames - Executable packages selected by Turbo's shaped dry run.
 * @param table - Schema-backed table to plan from; injectable for focused tests.
 * @returns The needed partition ids, in table order.
 * @category utilities
 * @since 0.0.0
 */
export const plannedCiLanePartitions: {
  (
    laneId: PartitionedCiLane,
    taskPackageNames: ReadonlyArray<string>,
    selectedTaskPackageNames: ReadonlyArray<string>,
    table?: ReadonlyArray<CiLanePartition>
  ): ReadonlyArray<CiLanePartitionId>;
  (
    taskPackageNames: ReadonlyArray<string>,
    selectedTaskPackageNames: ReadonlyArray<string>,
    table?: ReadonlyArray<CiLanePartition>
  ): (laneId: PartitionedCiLane) => ReadonlyArray<CiLanePartitionId>;
} = dual(
  (args) => isPartitionedCiLane(args[0]),
  (
    laneId: PartitionedCiLane,
    taskPackageNames: ReadonlyArray<string>,
    selectedTaskPackageNames: ReadonlyArray<string>,
    table: ReadonlyArray<CiLanePartition> = CI_LANE_PARTITIONS
  ): ReadonlyArray<CiLanePartitionId> => {
    const selectedPackages = HashSet.fromIterable(selectedTaskPackageNames);
    return pipe(
      withCiLaneDefaultPlacements(
        A.filter(table, (candidate) => candidate.lane === laneId),
        taskPackageNames
      ),
      A.filter(
        (partition) =>
          isIntegrationRestPartition(laneId, O.fromUndefinedOr(partition.shard)) ||
          A.some(partition.packages, (name) => HashSet.has(selectedPackages, name))
      ),
      A.map((partition) => partition.id)
    );
  }
);

const partitionedLaneTask = (laneId: PartitionedCiLane): string =>
  PartitionedCiLaneSchema.match(laneId, {
    lint: () => "lint",
    "test-unit": () => "test",
    "test-integration": () => "test:integration:parallel",
  });

const partitionDryRunArgs = (laneId: PartitionedCiLane, options: CiLaneRunOptions): ReadonlyArray<string> =>
  directTurboArgs(
    [partitionedLaneTask(laneId)],
    [...(options.affected ? ["--affected"] : A.empty<string>()), LABS_TURBO_EXCLUDE_FILTER, "--only", "--dry-run=json"]
  );

// Hosted integration shards run one Vitest worker. On the 4-vCPU ubuntu-24.04 runner two workers
// gave almost no parallel gain (PR #3005 run 42600820554: 1.0-1.5x the 8-vCPU file-second sum)
// and the contention pushed native replays past their production operation and extraction
// deadlines; single-file partitions on the same run, effectively one worker, all passed.
const INTEGRATION_SHARD_VITEST_ARGS: ReadonlyArray<string> = ["--maxWorkers=1"];

const shardPassThroughArgs = (
  laneId: PartitionedCiLane,
  shard: O.Option<CiLanePartitionShard>
): ReadonlyArray<string> =>
  O.match(shard, {
    onNone: A.empty<string>,
    onSome: ({ index, total }) => [
      "--",
      `--shard=${index}/${total}`,
      ...(laneId === "test-integration" ? INTEGRATION_SHARD_VITEST_ARGS : A.empty<string>()),
    ],
  });

const partitionExecutionArgs = (
  laneId: PartitionedCiLane,
  packages: ReadonlyArray<string>,
  options: CiLaneRunOptions,
  shard: O.Option<CiLanePartitionShard>
): ReadonlyArray<string> =>
  directTurboArgs(
    A.map(packages, (name) => `${name}#${partitionedLaneTask(laneId)}`),
    [
      "--only",
      HOSTED_16GB_TURBO_CONCURRENCY_ARG,
      LABS_TURBO_EXCLUDE_FILTER,
      ...A.map(packages, (name) => `--filter=${name}`),
      ...(options.force || options.coverageOutput !== undefined ? ["--force"] : A.empty<string>()),
      ...(options.summarize ? ["--summarize"] : A.empty<string>()),
      ...(options.coverageOutput !== undefined
        ? [
            ...ciCoverageTestArgs,
            ...O.match(shard, { onNone: A.empty<string>, onSome: ({ index, total }) => [`--shard=${index}/${total}`] }),
          ]
        : shardPassThroughArgs(laneId, shard)),
    ]
  );

const shardedLanePackages = (laneId: PartitionedCiLane): ReadonlyArray<string> =>
  pipe(
    CI_LANE_PARTITIONS,
    A.filter((partition) => partition.lane === laneId && partition.shard !== undefined),
    A.flatMap((partition) => partition.packages),
    A.dedupe,
    A.sort(Order.String)
  );

// The integration catch-all bin is not a package list for Turbo: it runs today's root
// integration lane (parallel, unsplit and serial tasks alike) for every package the sharded
// bins do not own, so the hosted leg proves exactly what the heavy lane proved. Turbo's
// negated filters keep the sharded packages out; `--affected` still scopes pull requests.
const isIntegrationRestPartition = (laneId: PartitionedCiLane, shard: O.Option<CiLanePartitionShard>): boolean =>
  laneId === "test-integration" && O.isNone(shard);

const integrationRestLaneStep = (
  repoRoot: string,
  partition: CiLanePartitionId,
  options: CiLaneRunOptions
): QualityTaskStep =>
  rootScriptStep(
    repoRoot,
    `ci:test-integration:${partition}`,
    "test",
    [
      "--integration",
      ...A.map(shardedLanePackages("test-integration"), (name) => `--filter=!${name}`),
      ...turboShapeArgs(options),
    ],
    options.affected ? { TURBO_SCM_BASE: options.base } : undefined
  );

const partitionExecutionStep = (
  repoRoot: string,
  laneId: PartitionedCiLane,
  partition: CiLanePartitionId,
  packages: ReadonlyArray<string>,
  options: CiLaneRunOptions,
  shard: O.Option<CiLanePartitionShard>
): QualityTaskStep =>
  isIntegrationRestPartition(laneId, shard)
    ? integrationRestLaneStep(repoRoot, partition, options)
    : QualityTaskStep.make({
        label: `ci:${laneId}:${partition}`,
        command: "bunx",
        args: partitionExecutionArgs(laneId, packages, options, shard),
        cwd: repoRoot,
      });

/**
 * One partition's execution request: where it runs, which lane and partition, the selected
 * packages, the lane shape and the Vitest shard it carries, when any.
 *
 * **Example** (Describe the integration catch-all leg)
 *
 * ```ts
 * import { CiLanePartitionStepRequest, CiLaneRunOptions } from "@beep/repo-cli/commands/Ci"
 *
 * const options = CiLaneRunOptions.make({
 *   affected: true, base: "origin/main", head: "HEAD", summarize: true, mode: "auto",
 *   to: "HEAD", last: false, changesetStatus: false, validateEnvelopes: false
 * })
 * const request = CiLanePartitionStepRequest.make({
 *   repoRoot: "/repo", laneId: "test-integration", partition: "int-rest", packages: [], options
 * })
 * console.log(request.partition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLanePartitionStepRequest extends S.Opaque<
  CiLanePartitionStepRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    repoRoot: S.String,
    laneId: PartitionedCiLaneSchema,
    partition: CiLanePartitionId,
    packages: S.Array(S.String),
    options: CiLaneRunOptions,
    shard: S.optionalKey(CiLanePartitionShard),
  }).pipe(
    $I.annoteSchema("CiLanePartitionStepRequest", {
      description: "Execution request for one partition of a partitioned CI lane.",
    })
  )
) {}

/**
 * Build the exact process step one partition of a partitioned CI lane executes.
 *
 * **Example** (Plan the integration catch-all leg)
 *
 * ```ts
 * import { CiLanePartitionStepRequest, CiLaneRunOptions, ciLanePartitionStepForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * const options = CiLaneRunOptions.make({
 *   affected: true, base: "origin/main", head: "HEAD", summarize: true, mode: "auto",
 *   to: "HEAD", last: false, changesetStatus: false, validateEnvelopes: false
 * })
 * const step = ciLanePartitionStepForTesting(
 *   CiLanePartitionStepRequest.make({
 *     repoRoot: "/repo", laneId: "test-integration", partition: "int-rest", packages: [], options
 *   })
 * )
 * console.log(step.args)
 * ```
 *
 * @param request - Repository root, lane, partition, selected packages, lane shape and optional Vitest shard.
 * @returns The step the lane would run for that partition.
 * @category utilities
 * @since 0.0.0
 */
export const ciLanePartitionStepForTesting = (request: CiLanePartitionStepRequest): QualityTaskStep =>
  partitionExecutionStep(
    request.repoRoot,
    request.laneId,
    request.partition,
    request.packages,
    request.options,
    O.fromUndefinedOr(request.shard)
  );

/**
 * Selection and execution argv used by a partitioned CI lane.
 *
 * **Example** (Inspect execution argv)
 *
 * ```ts
 * import { CiLanePartitionArgs } from "@beep/repo-cli/commands/Ci"
 *
 * const args = CiLanePartitionArgs.make({ selection: ["turbo"], execution: ["turbo"] })
 * console.log(args.execution)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLanePartitionArgs extends S.Opaque<CiLanePartitionArgs, { readonly brand: unique symbol }>()(
  S.Struct({ selection: S.Array(S.String), execution: S.Array(S.String) }).pipe(
    $I.annoteSchema("CiLanePartitionArgs", {
      description: "Exact Turbo argv for partition selection and execution.",
    })
  )
) {}

/**
 * Render the log lines naming every executable package the curated table placed by default.
 *
 * **Details**
 *
 * One line per lane, listing `package -> partition` pairs, or no line when
 * every executable package is already in the committed table. The lane
 * prints these after the union proof so a hosted shard log says where a
 * freshly created package ran.
 *
 * **Example** (Render the default-placement line)
 *
 * ```ts
 * import { ciLaneDefaultPlacementLinesForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciLaneDefaultPlacementLinesForTesting("lint", ["@beep/repo-cli", "@beep/new-package"]))
 * ```
 *
 * @param laneId - Partitioned lane being proved.
 * @param taskPackageNames - Every current non-labs workspace package with the lane task.
 * @returns Zero or one log lines.
 * @category testing
 * @since 0.0.0
 */
export const ciLaneDefaultPlacementLinesForTesting: {
  (laneId: PartitionedCiLane, taskPackageNames: ReadonlyArray<string>): ReadonlyArray<string>;
  (taskPackageNames: ReadonlyArray<string>): (laneId: PartitionedCiLane) => ReadonlyArray<string>;
} = dual(
  2,
  (laneId: PartitionedCiLane, taskPackageNames: ReadonlyArray<string>): ReadonlyArray<string> =>
    pipe(
      ciLaneDefaultPlacements(
        A.filter(CI_LANE_PARTITIONS, (candidate) => candidate.lane === laneId),
        taskPackageNames
      ),
      A.match({
        onEmpty: A.empty<string>,
        onNonEmpty: (placements) =>
          A.of(
            `[ci] ${laneId} default placements (absent from ${CI_LANE_PARTITION_TABLE_PATH}): ${A.join(
              A.map(placements, (placement) => `${placement.packageName} -> ${placement.partition}`),
              ", "
            )}.`
          ),
      })
    )
);

/**
 * Build the selection and execution argv used by a partitioned CI lane.
 *
 * **Example** (Inspect partition argv)
 *
 * ```ts
 * import { CiLaneRunOptions, ciLanePartitionArgsForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * const options = CiLaneRunOptions.make({
 *   affected: false, base: "origin/main", head: "HEAD", summarize: false,
 *   mode: "auto", to: "HEAD", last: false, changesetStatus: false,
 *   validateEnvelopes: false
 * })
 * console.log(ciLanePartitionArgsForTesting("lint", ["@beep/repo-cli"], options))
 * ```
 *
 * @param laneId - Partitioned lane being planned.
 * @param packages - Proved package intersection for the execution command.
 * @param options - Requested lane shape and proof flags.
 * @returns Exact Turbo argv for the dry-run selection and package execution.
 * @category testing
 * @since 0.0.0
 */
export const ciLanePartitionArgsForTesting: {
  (
    laneId: PartitionedCiLane,
    packages: ReadonlyArray<string>,
    options: CiLaneRunOptions,
    shard?: CiLanePartitionShard
  ): CiLanePartitionArgs;
  (
    packages: ReadonlyArray<string>,
    options: CiLaneRunOptions,
    shard?: CiLanePartitionShard
  ): (laneId: PartitionedCiLane) => CiLanePartitionArgs;
} = dual(
  (args) => isPartitionedCiLane(args[0]),
  (
    laneId: PartitionedCiLane,
    packages: ReadonlyArray<string>,
    options: CiLaneRunOptions,
    shard?: CiLanePartitionShard
  ): CiLanePartitionArgs =>
    CiLanePartitionArgs.make({
      selection: partitionDryRunArgs(laneId, options),
      execution: partitionExecutionArgs(laneId, packages, options, O.fromUndefinedOr(shard)),
    })
);

class TurboDryRunTask extends S.Opaque<TurboDryRunTask, { readonly brand: unique symbol }>()(
  S.Struct({
    command: S.String,
    package: S.String,
    task: S.String,
    taskId: S.String,
  }).pipe(
    $I.annoteSchema("TurboDryRunTask", {
      description: "Task entry read from Turbo's JSON dry-run plan for a CI lane selection probe.",
    })
  )
) {}

class TurboDryRun extends S.Opaque<TurboDryRun, { readonly brand: unique symbol }>()(
  S.Struct({ tasks: S.Array(TurboDryRunTask) }).pipe(
    $I.annoteSchema("TurboDryRun", {
      description:
        "Turbo JSON dry-run document read by the partition proof and the Storybook affected probe to learn which tasks Turbo selected.",
    })
  )
) {}

const decodeTurboDryRun = S.decodeUnknownEffect(S.fromJsonString(TurboDryRun));
const TURBO_NONEXISTENT_TASK_COMMAND = "<NONEXISTENT>";

const turboRootLaneStep = (
  repoRoot: string,
  laneId: CiLaneId,
  script: string,
  prefixArgs: ReadonlyArray<string>,
  options: CiLaneRunOptions
): QualityTaskStep =>
  rootScriptStep(
    repoRoot,
    `ci:${laneId}`,
    script,
    [...prefixArgs, ...turboShapeArgs(options)],
    options.affected ? { TURBO_SCM_BASE: options.base } : undefined
  );

const turboTaskLaneStep = (
  repoRoot: string,
  laneId: CiLaneId,
  task: string,
  prefixArgs: ReadonlyArray<string>,
  options: CiLaneRunOptions
): QualityTaskStep =>
  QualityTaskStep.make({
    label: `ci:${laneId}`,
    command: "bunx",
    args: directTurboArgs([task], [...prefixArgs, ...turboShapeArgs(options)]),
    cwd: repoRoot,
    ...(options.affected ? { env: { TURBO_SCM_BASE: options.base } } : {}),
  });

const docgenLaneSteps = (repoRoot: string, options: CiLaneRunOptions): ReadonlyArray<QualityTaskStep> =>
  DocgenLaneMode.match(options.mode, {
    auto: () => [
      rootScriptStep(repoRoot, "ci:docgen", "docgen:local", ["--base", options.base, "--head", options.head]),
    ],
    none: A.empty<QualityTaskStep>,
    affected: () => [
      rootScriptStep(repoRoot, "ci:docgen", "docgen:local", ["--base", options.base, "--head", options.head]),
    ],
    full: () => [rootScriptStep(repoRoot, "ci:docgen", "docgen", A.empty<string>())],
  });

// The hosted workflow runs the full doctest fleet for both PRs and pushes.
const doctestLaneSteps = (repoRoot: string): ReadonlyArray<QualityTaskStep> => [
  QualityTaskStep.make({
    label: "ci:doctest",
    command: "bunx",
    args: directTurboArgs(["doctest"], [CI_LANE_TURBO_CONCURRENCY_ARG, "--summarize"]),
    cwd: repoRoot,
  }),
];

const CODEGEN_DRIVER_PACKAGE_DIRS = LiteralKit([
  "packages/drivers/acp",
  "packages/drivers/ecfr",
  "packages/drivers/govinfo",
  "packages/drivers/runpod",
]);

type CodegenDriverPackageDir = typeof CODEGEN_DRIVER_PACKAGE_DIRS.Type;

const codegenDriverPackageName = Str.replace("packages/drivers/", "");

const codegenDriverStep = (repoRoot: string, packageDir: CodegenDriverPackageDir): QualityTaskStep =>
  QualityTaskStep.make({
    label: `ci:codegen:${codegenDriverPackageName(packageDir)}`,
    command: "bun",
    args: ["run", "--cwd", packageDir, "generate:check"],
    cwd: repoRoot,
  });

const codegenDriverSteps = (repoRoot: string): ReadonlyArray<QualityTaskStep> =>
  A.map(CODEGEN_DRIVER_PACKAGE_DIRS.literals, (packageDir) => codegenDriverStep(repoRoot, packageDir));

const FALLOW_BLOCKING_LANES = ["audit", "dead-code", "health"] as const;
const FALLOW_ADVISORY_LANES = ["boundaries", "flags", "security", "fix-preview"] as const;
const FALLOW_ENVELOPE_REQUIRED_FIELDS = "schemaVersion,status,command,exitStatus,baseRef,rawOutputRef";
type FallowSubLane = readonly [lane: string, gateFlag: "--check" | "--advisory"];
const FALLOW_SUB_LANES: ReadonlyArray<FallowSubLane> = [
  ...A.map(FALLOW_BLOCKING_LANES, (lane): FallowSubLane => [lane, "--check"]),
  ...A.map(FALLOW_ADVISORY_LANES, (lane): FallowSubLane => [lane, "--advisory"]),
];
// The sub-lanes write disjoint envelopes, so they run abreast. Three keeps the
// hosted runner (4 vCPU, 16 GB) at about three Fallow project graphs at once.
const FALLOW_SUB_LANE_CONCURRENCY = 3;

const fallowReportPath = (lane: string, advisory: boolean): string =>
  `.beep/fallow/${lane}.${advisory ? "advisory" : "check"}.json`;

const fallowRunStep = (repoRoot: string, lane: string, gateFlag: string, base: string): QualityTaskStep =>
  rootTaskStep(
    repoRoot,
    `ci:fallow:${lane}`,
    `fallow:${lane}:${gateFlag === "--advisory" ? "advisory" : "check"}`,
    base
  );

const fallowEnvelopeCheckStep = (repoRoot: string, lane: string, advisory: boolean): QualityTaskStep =>
  QualityTaskStep.make({
    label: `ci:fallow:envelope-check:${lane}`,
    command: "bun",
    args: [
      "run",
      "beep",
      "quality",
      "fallow",
      "envelope-check",
      fallowReportPath(lane, advisory),
      "--require",
      FALLOW_ENVELOPE_REQUIRED_FIELDS,
      "--expect-subcommand",
      lane,
      "--expect-report-path",
      fallowReportPath(lane, advisory),
      "--require-raw-output",
    ],
    cwd: repoRoot,
  });

const fallowEnvelopeCheckSteps = (repoRoot: string): ReadonlyArray<QualityTaskStep> => [
  ...A.map(FALLOW_ADVISORY_LANES, (lane) => fallowEnvelopeCheckStep(repoRoot, lane, true)),
  ...A.map(FALLOW_BLOCKING_LANES, (lane) => fallowEnvelopeCheckStep(repoRoot, lane, false)),
];

const fallowRunPhaseSteps = (repoRoot: string, options: CiLaneRunOptions): ReadonlyArray<QualityTaskStep> => [
  ...A.map(FALLOW_SUB_LANES, ([lane, gateFlag]) => fallowRunStep(repoRoot, lane, gateFlag, options.base)),
  ...(options.validateEnvelopes ? fallowEnvelopeCheckSteps(repoRoot) : A.empty<QualityTaskStep>()),
];

/**
 * Build the step plan for a CI lane. Exposed for focused unit tests.
 *
 * The fallow lane's plan lists its subprocess steps in declaration order; its
 * runtime runs the seven Fallow sub-lanes three at a time and maintains
 * `.beep/fallow/status.md` accounting in that same order (see {@link runCiLane}).
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneRunOptions, ciLaneStepsForTesting } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const steps = ciLaneStepsForTesting("/repo", "lint", CiLaneRunOptions.make({
 *   affected: true,
 *   base: "origin/main",
 *   head: "HEAD",
 *   summarize: true,
 *   mode: "affected",
 *   to: "HEAD",
 *   last: false,
 *   changesetStatus: false,
 *   validateEnvelopes: false
 * }))
 * console.log(A.map(steps, (step) => step.label))
 * ```
 *
 * @param repoRoot - Repository root used as every subprocess working directory.
 * @param laneId - CI lane to plan.
 * @param options - Lane shape options.
 * @returns Planned steps in execution order.
 * @category testing
 * @since 0.0.0
 */
export const ciLaneStepsForTesting: {
  (repoRoot: string, laneId: CiLaneId, options: CiLaneRunOptions): ReadonlyArray<QualityTaskStep>;
  (laneId: CiLaneId, options: CiLaneRunOptions): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
} = dual(
  3,
  (repoRoot: string, laneId: CiLaneId, options: CiLaneRunOptions): ReadonlyArray<QualityTaskStep> =>
    CiLaneId.match(laneId, {
      build: () => [turboRootLaneStep(repoRoot, "build", "build", A.empty<string>(), options)],
      // D2 admission profile: a solo proof uses measured-safe c3; any active
      // sibling lease lowers it to c2. Hosted CI has no local admission lease
      // and therefore takes the conservative c2 default.
      check: () => [turboRootLaneStep(repoRoot, "check", "check", [qualityCheckConcurrencyArg()], options)],
      codegen: () => [
        ...codegenDriverSteps(repoRoot),
        // The desktop migration bundle is generated from
        // packages/_internal/db-admin/drizzle, which the app has no dependency
        // edge to; this lane runs unaffected-gated so db-admin-only migration
        // PRs still prove bundle freshness.
        QualityTaskStep.make({
          label: "ci:codegen:desktop-migration-bundle",
          command: "bun",
          args: ["run", "--cwd", "apps/professional-desktop", "codegen:check"],
          cwd: repoRoot,
        }),
      ],
      commitlint: () =>
        options.last
          ? [
              QualityTaskStep.make({
                label: "ci:commitlint",
                command: "bunx",
                args: ["commitlint", "--last", "--verbose"],
                cwd: repoRoot,
              }),
            ]
          : [
              QualityTaskStep.make({
                label: "ci:commitlint",
                command: "bunx",
                args: ["commitlint", "--from", options.from ?? options.base, "--to", options.to, "--verbose"],
                cwd: repoRoot,
              }),
            ],
      coverage: () => [turboRootLaneStep(repoRoot, "coverage", "coverage", ["--concurrency=3"], options)],
      "desktop-ipc": () => [
        QualityTaskStep.make({
          label: "ci:desktop-ipc",
          command: "bun",
          args: ["run", "--cwd", "apps/professional-desktop", "beep:test:integration:ipc"],
          cwd: repoRoot,
        }),
      ],
      docgen: () => docgenLaneSteps(repoRoot, options),
      doctest: () => doctestLaneSteps(repoRoot),
      // Target the first ecosystem member explicitly. Generalize member
      // discovery only when a second ecosystem member exists.
      ecosystem: () => [
        QualityTaskStep.make({
          label: "ci:ecosystem:effect-drizzle:type-test",
          command: "bun",
          args: ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:type-test"],
          cwd: repoRoot,
        }),
        QualityTaskStep.make({
          label: "ci:ecosystem:effect-drizzle:bundle-probe",
          command: "bun",
          args: ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:bundle-probe"],
          cwd: repoRoot,
        }),
      ],
      fallow: () => fallowRunPhaseSteps(repoRoot, options),
      // Hosted CI regenerates the inventory into .beep/ci/ and ratchets it. A
      // caller that already ran the scan (root beep:preflight writes both the
      // committed artifact and the CI mirror from one `jsdoc-inventory`) passes
      // `--inventory <path>` and only the ratchet runs (quality-lane audit A3).
      "jsdoc-ratchet": () =>
        pipe(
          O.fromUndefinedOr(options.inventory),
          O.match({
            onNone: () => [
              rootTaskStep(repoRoot, "ci:jsdoc-ratchet:inventory", "jsdoc:inventory:check"),
              jsdocRatchetStep(repoRoot, JSDOC_CI_INVENTORY_JSON_PATH),
            ],
            onSome: (inventoryPath) => [jsdocRatchetStep(repoRoot, inventoryPath)],
          })
        ),
      // lab-apps-lifecycle P2 (ratified row 10): one bundled turbo invocation
      // over the labs glob. Deliberately no --affected: this lane's contract
      // runs the full labs set, even though the pinned clients intersect the
      // affected set with positive filters. The workflow path gate scopes
      // PRs, while push and local replays want the full labs set.
      labs: () => [
        QualityTaskStep.make({
          label: "ci:labs",
          command: "bunx",
          args: directTurboArgs(
            ["check", "lint", "test"],
            [
              LABS_TURBO_SELECT_FILTER,
              HOSTED_16GB_TURBO_CONCURRENCY_ARG,
              ...(options.summarize ? ["--summarize"] : A.empty<string>()),
            ]
          ),
          cwd: repoRoot,
        }),
      ],
      // Required Lint Policy owns the repo-policy battery. The Lint context
      // therefore runs only the package Turbo graph instead of duplicating
      // that battery through the root `bun run lint` aggregate. The lane
      // invokes turbo directly (bypassing Quality/Tasks.ts turboRunArgs), so
      // the hosted product-partition filter is applied here; root commands
      // include labs under lab-apps-lifecycle D15.
      lint: () => [
        turboTaskLaneStep(
          repoRoot,
          "lint",
          "lint",
          [HOSTED_16GB_TURBO_CONCURRENCY_ARG, LABS_TURBO_EXCLUDE_FILTER],
          options
        ),
      ],
      // The argv states the scope instead of inheriting it from ambient
      // `CI=true`. Pull requests (perf audit K1) run the changed scope, which
      // `beep lint policy` widens to the full sweep on deletions, `@deprecated`,
      // tsconfig, dependency, Turbo, lint-config or policy-implementation
      // changes; pushes and local replays without the affected shape run
      // `--full`. `--summarize` is accepted for the shared matrix argv: the
      // policy graphs always write their Turbo summaries.
      "lint-policy": () => [
        bunRunStep(repoRoot, "ci:lint-policy", [
          "beep",
          "lint",
          "policy",
          ...(options.affected ? ["--affected", "--base", options.base] : ["--full"]),
        ]),
      ],
      nix: () => [
        QualityTaskStep.make({
          label: "ci:nix:flake-check",
          command: "nix",
          args: ["--option", "warn-dirty", "false", "flake", "check", "--all-systems"],
          cwd: repoRoot,
        }),
        QualityTaskStep.make({
          label: "ci:nix:dev-shell",
          command: "nix",
          args: ["--option", "warn-dirty", "false", "develop", "--command", "echo", "Dev shell OK"],
          cwd: repoRoot,
        }),
      ],
      property: () => [
        QualityTaskStep.make({
          label: "ci:property",
          command: "bunx",
          // Keep sweeping after one red suite so a nightly run reports every
          // failing package instead of the first (#2687).
          args: [
            ...directTurboArgs(
              ["test:property"],
              [CI_LANE_TURBO_CONCURRENCY_ARG, "--continue=dependencies-successful", ...turboShapeArgs(options)]
            ),
            ...vitestShardPassThroughArgs(options),
          ],
          cwd: repoRoot,
          env: {
            BEEP_FC_NUM_RUNS: resolvePropertyLaneRuns(options.runs),
            BEEP_FC_SEED: resolvePropertyLaneSeed(options.seed),
            ...(options.affected ? { TURBO_SCM_BASE: options.base } : {}),
          },
        }),
      ],
      // A docs_only pull request never starts Heavy / Lint Policy, so this lane runs the policy
      // tasks a documentation diff can fail (DocsPolicy.ts) in one Turbo graph, then the knowledge
      // doctor against the review base, as the changed-scope Lint Policy plan does.
      "docs-policy": () => [
        QualityTaskStep.make({
          label: "ci:docs-policy:tasks",
          command: "bunx",
          cwd: repoRoot,
          args: directTurboArgs(DOCS_POLICY_ROOT_TASKS, [
            DOCS_POLICY_TURBO_CONCURRENCY_ARG,
            "--continue=dependencies-successful",
            "--summarize",
          ]),
        }),
        bunRunStep(repoRoot, "ci:docs-policy:knowledge-doctor", [
          "beep",
          "knowledge",
          "doctor",
          "ci",
          "--base",
          options.base,
        ]),
      ],
      "repo-sanity": () => {
        const homePaths = bunRunStep(repoRoot, "lint:private-home-paths", [
          "beep",
          "laws",
          "private-home-paths",
          "--check",
        ]);
        // lab-apps-lifecycle P2 (ratified row 8): route CI's changeset gate
        // through the path-aware wrapper so lab-only changes are exempt from
        // changeset ceremony.
        const changesetStatus = bunRunStep(repoRoot, "ci:repo-sanity:changeset-status", [
          "beep",
          "quality",
          "changeset-status",
          "--since",
          "origin/main",
        ]);
        // A documentation-only diff (prose, packet files, `.changeset/*.md`)
        // can fail only the public-repo home path law and the changeset
        // checks; every other step reads code-route paths (sources, manifests,
        // tool configuration, workflows). Docs Policy runs the knowledge and
        // packet policy on the same diffs.
        if (options.docsOnly) {
          return [
            homePaths,
            bunRunStep(repoRoot, "ci:repo-sanity:changeset-graph", ["beep", "quality", "changeset-graph"]),
            changesetStatus,
          ];
        }
        return [
          // Workflow policy runs inside the collecting body, not as its own
          // check.yml step: a separate step's red skipped the whole lane body,
          // the shadcn step included (hosted-setup-tax PERIH-02 follow-up).
          bunRunStep(repoRoot, "ci:repo-sanity:workflow-lint", ["beep", "ci", "workflow-lint"]),
          bunRunStep(repoRoot, "lint:schema-catalog", ["beep", "lint", "schema-catalog"]),
          bunRunStep(repoRoot, "ci:repo-sanity:catalog-usage", ["beep", "quality", "catalog-usage"]),
          // Required on every head: Heavy / Lint Policy also runs the law on
          // code PRs, but it is not a required context.
          homePaths,
          // A new reader of a scanned repository file (generated standards file or
          // root tooling input) in another package does not select the row's
          // owners, so the owner rows are checked here, on the pull request that
          // adds or removes the reader (hosted-setup-tax TURB-01). Readers are
          // TypeScript sources, a code-route shape, so the documentation path
          // never needs it: a documentation-only change cannot add or drop one.
          bunRunStep(repoRoot, "lint:coverage-owners", ["beep", "lint", "coverage-owners"]),
          // `audit:github repo-sanity` runs the changeset graph check (its
          // `repo-sanity:changeset-graph` lane), so this body carries no second
          // copy (hosted-setup-tax PERIL-04).
          bunRunStep(repoRoot, "ci:repo-sanity", ["audit:github", "repo-sanity"]),
          // The one hosted owner of the strict @shadcn/lint policy
          // (.oxlintrc.shadcn.json; hosted-setup-tax PERIH-02). Repo Sanity is
          // required, so a finding blocks the merge. The step group runs every
          // step and fails with all reds, so an earlier red cannot hide it.
          rootTaskStep(repoRoot, "ci:repo-sanity:shadcn", "lint:shadcn"),
          ...(options.changesetStatus ? [changesetStatus] : A.empty<QualityTaskStep>()),
        ];
      },
      sast: () => [bunRunStep(repoRoot, "ci:sast", ["beep", "quality", "github-checks", "sast"])],
      secrets: () => [bunRunStep(repoRoot, "ci:secrets", ["beep", "quality", "github-checks", "secrets"])],
      security: () => [bunRunStep(repoRoot, "ci:security", ["beep", "quality", "github-checks", "security"])],
      // Quality-lane audit D13: one positively-filtered build, the browser test
      // run, then the static-artifact proof storybook.yml uploads. No
      // --affected on the execution argv: the affected shape is answered once
      // by the dry-run probe in runCiStepLane, which then runs the lane whole.
      storybook: () => [
        QualityTaskStep.make({
          label: "ci:storybook:build",
          command: "bunx",
          args: directTurboArgs(
            ["storybook:build"],
            [STORYBOOK_TURBO_SELECT_FILTER, ...(options.summarize ? ["--summarize"] : A.empty<string>())]
          ),
          cwd: repoRoot,
        }),
        QualityTaskStep.make({
          label: "ci:storybook:test",
          command: "bunx",
          args: directTurboArgs(["test:storybook"], [STORYBOOK_TURBO_SELECT_FILTER]),
          cwd: repoRoot,
        }),
        QualityTaskStep.make({
          label: "ci:storybook:artifact",
          command: "test",
          args: ["-f", STORYBOOK_STATIC_INDEX_PATH],
          cwd: repoRoot,
        }),
      ],
      "test-integration": () => [turboRootLaneStep(repoRoot, "test-integration", "test", ["--integration"], options)],
      "test-unit": () => [
        turboRootLaneStep(repoRoot, "test-unit", "test", ["--unit", HOSTED_16GB_TURBO_CONCURRENCY_ARG], options),
      ],
    })
);

const renderStepCommand = (step: QualityTaskStep): string => A.join([step.command, ...step.args], " ");

const runLaneProcess = Effect.fn("CiLane.runLaneProcess")(function* (
  step: QualityTaskStep
): Effect.fn.Return<number, CiCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const resolved = yield* resolveTurboCacheStep(step);
  const stepEnv = resolved.env ?? {};
  yield* assertCacheRuntimeKeyUnspecified(resolved.command, resolved.args, Bun.env, stepEnv).pipe(
    CiCommandError.mapError("Rejected a caller-provided cache runtime identity.")
  );
  yield* Console.log(`[ci] ${step.label}: ${renderStepCommand(resolved)}`);
  // Lane bodies that shell out to Turbo need the same env hygiene the root
  // quality runner applies: no interactive TUI (it can leave a killed run's
  // terminal in mouse-capture mode) and no unresolved `op://` token/team
  // references leaking through as literal values on a workstation.
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args, Bun.env);
  const runtime = cacheRuntimeStep(resolved);
  return yield* runToExit({
    command: runtime.command,
    args: runtime.args,
    cwd: resolved.cwd,
    env: { ...envOverrides, ...stepEnv },
    extendEnv: turboEnvExtendsAmbient(resolved.command, resolved.args),
    stdio: "inherit",
  }).pipe(CiCommandError.mapError(`Failed to spawn ${renderStepCommand(resolved)}.`));
});

const runCiFallowLane = Effect.fn("CiLane.runCiFallowLane")(function* (
  repoRoot: string,
  options: CiLaneRunOptions
): Effect.fn.Return<void, CiCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed, CiLaneEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fallowDirectory = path.join(repoRoot, ".beep", "fallow");
  const statusPath = path.join(fallowDirectory, "status.md");

  yield* fs
    .makeDirectory(fallowDirectory, { recursive: true })
    .pipe(CiCommandError.mapError(`Failed to create ${fallowDirectory}.`));

  // Status lines keep declaration order whatever order the sub-lanes finish in,
  // and the permit stops two finishing sub-lanes from interleaving their writes.
  const statusLines = MutableHashMap.empty<string, string>();
  const statusPermit = yield* Semaphore.make(1);
  const writeStatus = Effect.fnUntraced(function* () {
    const lines = A.getSomes(A.map(FALLOW_SUB_LANES, ([lane]) => MutableHashMap.get(statusLines, lane)));
    const content = A.isReadonlyArrayEmpty(lines) ? "" : `${A.join(lines, "\n")}\n`;
    yield* fs.writeFileString(statusPath, content).pipe(CiCommandError.mapError(`Failed to write ${statusPath}.`));
  });
  yield* writeStatus();

  const runFallowSubLane = Effect.fnUntraced(function* ([lane, gateFlag]: FallowSubLane) {
    const [elapsed, exitCode] = yield* runLaneProcess(fallowRunStep(repoRoot, lane, gateFlag, options.base)).pipe(
      Effect.timed
    );
    const elapsedSeconds = Math.floor(Duration.toMillis(elapsed) / 1000);
    MutableHashMap.set(statusLines, lane, `- ${lane}: ${exitCode} (${elapsedSeconds}s)`);
    yield* Semaphore.withPermit(statusPermit, writeStatus());
    return exitCode;
  });

  const exitCodes = yield* Effect.forEach(FALLOW_SUB_LANES, runFallowSubLane, {
    concurrency: FALLOW_SUB_LANE_CONCURRENCY,
  });
  const blockingExitCodes = A.take(exitCodes, A.length(FALLOW_BLOCKING_LANES));

  yield* Effect.forEach(
    FALLOW_BLOCKING_LANES,
    Effect.fnUntraced(function* (lane) {
      const reportPath = path.join(repoRoot, fallowReportPath(lane, false));
      const content = yield* fs.readFileString(reportPath).pipe(Effect.orElseSucceed(() => ""));
      if (Str.isEmpty(content)) {
        return yield* CiCommandError.make({
          message: `Missing or empty Fallow envelope: ${fallowReportPath(lane, false)}`,
        });
      }
    }),
    { discard: true }
  );

  if (options.validateEnvelopes) {
    yield* runQualityTaskStreamingStepGroup("ci:fallow:envelope-check", fallowEnvelopeCheckSteps(repoRoot));
  }

  const blockingStatus = pipe(
    blockingExitCodes,
    A.findFirst((exitCode) => exitCode !== 0),
    O.getOrElse(() => 0)
  );
  if (blockingStatus !== 0) {
    return yield* CiCommandError.make({ message: `Fallow blocking lane(s) failed with status ${blockingStatus}.` });
  }
});

const isDocgenGlobalInput = (file: string): boolean =>
  Str.startsWith("packages/tooling/tool/docgen/")(file) ||
  Str.startsWith("packages/tooling/tool/cli/src/commands/Docgen/")(file) ||
  file === ".bun-version" ||
  file === "bun.lock" ||
  file === "package.json" ||
  file === "turbo.json" ||
  O.isSome(Str.match(/^tsconfig(?:\..*)?\.json$/u)(file));

const isDocgenRelevantInput = (file: string): boolean =>
  Str.startsWith("apps/")(file) ||
  Str.startsWith("packages/")(file) ||
  Str.startsWith("infra/")(file) ||
  Str.endsWith("/docgen.json")(file) ||
  O.isSome(Str.match(/\.(?:ts|tsx|mts|cts|md)$/u)(file));

/**
 * Select the canonical Docgen lane mode from changed repository paths.
 *
 * **Example** (Escalate a global Docgen input)
 *
 * ```ts
 * import { docgenLaneModeForChangedPaths } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(docgenLaneModeForChangedPaths(["bun.lock"])) // "full"
 * ```
 *
 * @param changedPaths - Normalized base-to-head repository paths.
 * @returns `none` for inert changes, `full` for global inputs, otherwise `affected`.
 * @category utilities
 * @since 0.0.0
 */
export const docgenLaneModeForChangedPaths = (changedPaths: ReadonlyArray<string>): DocgenLaneMode =>
  A.some(changedPaths, isDocgenGlobalInput)
    ? "full"
    : A.some(changedPaths, isDocgenRelevantInput)
      ? "affected"
      : "none";

const normalizedOutputPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(paths, A.map(normalizeSlashes), A.filter(Str.isNonEmpty), A.dedupe, A.sort(Order.String));

// `Git.changedFiles` over `<base>...<head>`, folded onto the capture's two error wordings (SPEC D-10).
const changedPathsBetween = Effect.fn("CiLane.changedPathsBetween")(function* (
  repoRoot: string,
  base: string,
  head: string,
  purpose: string
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, Git> {
  const git = yield* Git;
  return yield* git.changedFiles(repoRoot, { base, head }).pipe(
    Effect.mapBoth({
      onFailure: adaptGitKitError(GitCommand.changedFiles(base, head), {
        onSpawnFailure: () => CiCommandError.new(`Failed to resolve ${purpose}.`),
        onNonZeroExit: ({ exitCode }) =>
          CiCommandError.make({ message: `git diff for ${purpose} failed with exit code ${exitCode}.` }),
        onTruncated: O.none(),
      }),
      onSuccess: normalizedOutputPaths,
    })
  );
});

const resolveAutoDocgenLaneMode = Effect.fn("CiLane.resolveAutoDocgenLaneMode")(function* (
  repoRoot: string,
  base: string,
  head: string
): Effect.fn.Return<DocgenLaneMode, CiCommandError, Git> {
  const changedPaths = yield* changedPathsBetween(repoRoot, base, head, "automatic Docgen scope");
  const mode = docgenLaneModeForChangedPaths(changedPaths);
  yield* Console.log(`[ci] docgen: auto-selected ${mode} from ${A.length(changedPaths)} changed path(s)`);
  return mode;
});

// Quality-lane audit D13, revised for PR #1054 review: a path profile cannot
// see the workspace graph, so a change under packages/foundation/modeling/*
// that reaches @beep/ui and its stories used to skip the lane. Turbo owns that
// graph already: `--affected` intersected with the positive filter selects
// @beep/storybook#storybook:build exactly when its dependency closure (or a
// global input) changed against TURBO_SCM_BASE, and nothing otherwise.
const storybookAffectedProbeArgs = (): ReadonlyArray<string> =>
  directTurboArgs([STORYBOOK_BUILD_TASK], [STORYBOOK_TURBO_SELECT_FILTER, "--affected", "--dry-run=json"]);

const isStorybookBuildTask = (entry: TurboDryRunTask): boolean =>
  entry.package === STORYBOOK_PACKAGE_NAME &&
  entry.task === STORYBOOK_BUILD_TASK &&
  entry.command !== TURBO_NONEXISTENT_TASK_COMMAND;

const resolveStorybookLaneAffected = Effect.fn("CiLane.resolveStorybookLaneAffected")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<boolean, CiCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const probeArgs = storybookAffectedProbeArgs();
  const step = yield* resolveTurboCacheStep(
    QualityTaskStep.make({
      label: "ci:storybook:selection",
      command: "bunx",
      args: probeArgs,
      cwd: repoRoot,
      env: { TURBO_SCM_BASE: base },
    })
  );
  yield* Console.log(`[ci] ci:storybook: ${renderStepCommand(step)}`);
  const envOverrides = yield* turboEnvOverrides(step.command, step.args, Bun.env);
  const result = yield* runCaptured({
    command: step.command,
    args: step.args,
    cwd: repoRoot,
    env: { ...envOverrides, ...(step.env ?? {}) },
    extendEnv: turboEnvExtendsAmbient(step.command, step.args),
    source: "stdout",
    trim: true,
  }).pipe(CiCommandError.mapError("Failed to spawn Turbo's Storybook affected dry run."));
  if (result.exitCode !== 0) {
    return yield* CiCommandError.make({
      message: `Turbo's Storybook affected dry run exited with code ${result.exitCode}.`,
    });
  }
  if (result.truncated) {
    return yield* CiCommandError.make({
      message: "Turbo's Storybook affected dry run exceeded the capture bound.",
    });
  }
  const dryRun = yield* decodeTurboDryRun(result.output).pipe(
    CiCommandError.mapError("Turbo emitted invalid JSON for the Storybook affected dry run.")
  );
  const affected = A.some(dryRun.tasks, isStorybookBuildTask);
  yield* Console.log(
    `[ci] storybook: Turbo's affected plan (${base}...HEAD) ${affected ? "selects" : "does not select"} ${STORYBOOK_PACKAGE_NAME}#${STORYBOOK_BUILD_TASK} (${A.length(dryRun.tasks)} task(s) selected)`
  );
  return affected;
});

/**
 * Failure policy a step-planned CI lane runs its body under.
 *
 * **Details**
 *
 * `collect-all` runs every step and fails with all reds, so an earlier red
 * cannot hide a later step (Repo Sanity's shadcn step relies on this).
 * `fail-fast` runs one step at a time and stops at the first red: the JSDoc
 * ratchet's inventory and compare steps are a dependency chain.
 *
 * **Example** (Read a lane's failure policy)
 *
 * ```ts
 * import { ciLaneFailurePolicy } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciLaneFailurePolicy("repo-sanity")) // "collect-all"
 * ```
 *
 * @param laneId - CI lane whose runner is chosen.
 * @returns The policy {@link runCiLaneSteps} applies to that lane's steps.
 * @category policies
 * @since 0.0.0
 */
export const ciLaneFailurePolicy = (laneId: CiLaneId): GithubCheckFailurePolicy =>
  laneId === "jsdoc-ratchet" ? "fail-fast" : "collect-all";

/**
 * Run a step-planned CI lane's body under its {@link ciLaneFailurePolicy}.
 *
 * **Details**
 *
 * `beep ci lane <id>` plans the body and hands it to this runner, so a test
 * that substitutes the body steps exercises the same runner hosted CI uses.
 * The one exception is `docs-policy`: its steps run abreast as one buffered
 * collecting group, which still collects every red.
 *
 * **Example** (Run a lane body)
 *
 * ```ts
 * import { runCiLaneSteps } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runCiLaneSteps("repo-sanity", []))) // true
 * ```
 *
 * @param laneId - CI lane whose policy and log label apply.
 * @param steps - The lane body's steps in execution order.
 * @category use-cases
 * @since 0.0.0
 */
export const runCiLaneSteps = Effect.fn("CiLane.runCiLaneSteps")(function* (
  laneId: CiLaneId,
  steps: ReadonlyArray<QualityTaskStep>
) {
  // The JSDoc ratchet's inventory and compare are a dependency chain: never
  // compare yesterday's artifact after a failed scan.
  yield* ciLaneFailurePolicy(laneId) === "fail-fast"
    ? Effect.forEach(steps, (step) => runQualityTaskStreamingStepGroup(`ci:${laneId}`, [step]), { discard: true })
    : runQualityTaskStreamingStepGroup(`ci:${laneId}`, steps);
});

const runCiStepLane = Effect.fn("CiLane.runCiStepLane")(function* (
  repoRoot: string,
  laneId: CiLaneId,
  options: CiLaneRunOptions
): Effect.fn.Return<void, CiCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed, CiLaneEnvironment> {
  const resolvedOptions =
    laneId === "docgen" && options.mode === "auto"
      ? CiLaneRunOptions.make({
          ...options,
          mode: yield* resolveAutoDocgenLaneMode(repoRoot, options.base, options.head),
        })
      : options;
  // The Storybook lane's affected shape asks Turbo whether @beep/storybook is
  // in the dependency-aware affected set; storybook.yml keeps only the
  // goals_only gate, so PR and local replays skip the same change sets.
  if (laneId === "storybook" && options.affected && !(yield* resolveStorybookLaneAffected(repoRoot, options.base))) {
    yield* Console.log("[ci] storybook: @beep/storybook is outside Turbo's affected set for this change set (skipped)");
    return;
  }
  const steps = ciLaneStepsForTesting(repoRoot, laneId, resolvedOptions);
  if (A.isReadonlyArrayEmpty(steps)) {
    yield* Console.log(`[ci] ${laneId}: no steps for this configuration (skipped)`);
    return;
  }

  if (laneId === "docs-policy") {
    // The knowledge doctor reads only committed Git state (its own archive extractions of HEAD and
    // the merge-base), never a Turbo output, so it runs abreast of the task graph as it does in the
    // Lint Policy plan. Buffered output keeps each step's log whole; every red is still collected.
    yield* runQualityTaskStreamingStepGroup(`ci:${laneId}`, steps, A.length(steps), true);
    return;
  }

  yield* runCiLaneSteps(laneId, steps);
});

const runCiDoctestLane = Effect.fn("CiLane.runCiDoctestLane")(function* (repoRoot: string) {
  yield* runQualityTaskStreamingStepGroup("ci:doctest", doctestLaneSteps(repoRoot));
});

type PartitionedLaneRequest = {
  readonly laneId: PartitionedCiLane;
  readonly partition: CiLanePartitionId;
};

const isPartitionedCiLane = S.is(PartitionedCiLaneSchema);

const proofOnlyPartitionFlags = (options: CiLaneRunOptions): ReadonlyArray<string> => [
  ...(options.dryRun ? ["--dry-run"] : A.empty<string>()),
  ...(options.force ? ["--force"] : A.empty<string>()),
];

const validatePartitionedLaneRequest = Effect.fn("CiLane.validatePartitionedLaneRequest")(function* (
  laneId: CiLaneId,
  partition: CiLanePartitionId,
  options: CiLaneRunOptions
): Effect.fn.Return<PartitionedLaneRequest, CiLanePartitionError> {
  if (!isPartitionedCiLane(laneId)) {
    return yield* ciLanePartitionError(
      "invalid-options",
      laneId,
      `Lane ${laneId} does not support --partition.`,
      partition
    );
  }

  if (options.filter !== undefined) {
    return yield* ciLanePartitionError(
      "invalid-options",
      laneId,
      "--filter cannot be combined with --partition because Turbo unions filters instead of intersecting them.",
      partition
    );
  }

  const definition = A.findFirst(CI_LANE_PARTITIONS, (candidate) => candidate.id === partition);
  if (O.isNone(definition) || definition.value.lane !== laneId) {
    return yield* ciLanePartitionError(
      "invalid-assignment",
      laneId,
      `Partition ${partition} does not belong to lane ${laneId}.`,
      partition
    );
  }

  return { laneId, partition };
});

const resolvePartitionedLaneRequest = Effect.fn("CiLane.resolvePartitionedLaneRequest")(function* (
  laneId: CiLaneId,
  options: CiLaneRunOptions
): Effect.fn.Return<O.Option<PartitionedLaneRequest>, CiLanePartitionError> {
  if (options.partition !== undefined) {
    const validatePartitionedLaneRequest1 = yield* validatePartitionedLaneRequest(laneId, options.partition, options);
    return O.some(validatePartitionedLaneRequest1);
  }

  const proofOnlyFlags = proofOnlyPartitionFlags(options);
  if (A.isReadonlyArrayNonEmpty(proofOnlyFlags)) {
    return yield* ciLanePartitionError(
      "invalid-options",
      laneId,
      `${A.headNonEmpty(proofOnlyFlags)} requires --partition.`
    );
  }

  return O.none();
});

const runCiPartitionExecution = Effect.fn("CiLane.runCiPartitionExecution")(function* (
  repoRoot: string,
  request: PartitionedLaneRequest,
  options: CiLaneRunOptions,
  proof: CiLanePartitionProof,
  coveragePlan: CiCoverageArtifactPlan | undefined
) {
  const { laneId, partition } = request;
  const shard = O.fromUndefinedOr(proof.shard);
  // The integration catch-all leg always runs: Turbo applies the affected scope to its
  // parallel, unsplit and serial tasks itself, and only the parallel task is in the proof.
  const runnable = isIntegrationRestPartition(laneId, shard) || A.isReadonlyArrayNonEmpty(proof.packages);
  const step = runnable
    ? O.some(partitionExecutionStep(repoRoot, laneId, partition, proof.packages, options, shard))
    : O.none();
  if (options.dryRun) return yield* logPartitionDryRun(laneId, partition, step);
  if (O.isNone(step)) {
    if (coveragePlan !== undefined) yield* runCiCoveragePartition(repoRoot, options, coveragePlan, proof, undefined);
    yield* Console.log(`[ci] ${laneId} ${partition}: partition has no selected tasks (skipped).`);
    return;
  }
  yield* runPartitionStep(repoRoot, laneId, partition, options, proof, coveragePlan, step.value);
});

const logPartitionDryRun = Effect.fn("CiLane.logPartitionDryRun")(function* (
  laneId: PartitionedCiLane,
  partition: CiLanePartitionId,
  step: O.Option<QualityTaskStep>
) {
  if (O.isSome(step)) {
    yield* Console.log(`[ci] ${laneId} ${partition}: planned execution: ${renderStepCommand(step.value)}`);
  }
  yield* Console.log(`[ci] ${laneId} ${partition}: dry-run proof complete; no tasks executed.`);
});

const runPartitionStep = Effect.fn("CiLane.runPartitionStep")(function* (
  repoRoot: string,
  laneId: PartitionedCiLane,
  partition: CiLanePartitionId,
  options: CiLaneRunOptions,
  proof: CiLanePartitionProof,
  coveragePlan: CiCoverageArtifactPlan | undefined,
  step: QualityTaskStep
) {
  if (coveragePlan !== undefined) {
    yield* runCiCoveragePartition(repoRoot, options, coveragePlan, proof, step);
  } else {
    yield* runQualityTaskStreamingStepGroup(`ci:${laneId}:${partition}`, [step]);
  }
});

type PartitionedLaneSelection = {
  readonly coveragePlan: CiCoverageArtifactPlan | undefined;
  readonly selectedPackages: ReadonlyArray<string>;
  readonly taskPackageNames: ReadonlyArray<string>;
  readonly workspacePackageNames: ReadonlyArray<string>;
};

// One lane's Turbo selection and workspace inventory, shared by the partition proof and the
// partition plan so both read the same task set. `scope` names the caller in step labels and
// errors: a partition id, or "plan" for the plan. An instrumented Test Unit selection also
// carries every coverage owner, because the coverage planner can widen past Turbo's affected set.
const resolvePartitionedLaneSelection = Effect.fn("CiLane.resolvePartitionedLaneSelection")(function* (
  repoRoot: string,
  laneId: PartitionedCiLane,
  options: CiLaneRunOptions,
  scope: O.Option<CiLanePartitionId>,
  instrumented: boolean
): Effect.fn.Return<
  PartitionedLaneSelection,
  CiCommandError | CiLanePartitionError | QualityTaskConfigurationError,
  CiLaneEnvironment
> {
  const partition = O.getOrUndefined(scope);
  const label = O.getOrElse(scope, () => "plan");
  const task = partitionedLaneTask(laneId);
  const selectionArgs = partitionDryRunArgs(laneId, options);

  const selection = yield* resolveTurboCacheStep(
    QualityTaskStep.make({
      label: `ci:${laneId}:${label}:selection`,
      command: "bunx",
      args: selectionArgs,
      cwd: repoRoot,
      env: options.affected ? { TURBO_SCM_BASE: options.base } : {},
    })
  );
  yield* Console.log(`[ci] ci:${laneId}:${label}: ${renderStepCommand(selection)}`);
  const envOverrides = yield* turboEnvOverrides(selection.command, selection.args, Bun.env);
  const selectedResult = yield* runCaptured({
    command: selection.command,
    args: selection.args,
    cwd: repoRoot,
    env: { ...envOverrides, ...(selection.env ?? {}) },
    extendEnv: turboEnvExtendsAmbient(selection.command, selection.args),
    source: "stdout",
    trim: true,
  }).pipe(
    Effect.mapError((cause) =>
      ciLanePartitionError(
        "turbo-dry-run",
        laneId,
        `Failed to spawn Turbo's ${laneId} selection dry run.`,
        partition,
        cause
      )
    )
  );
  if (selectedResult.exitCode !== 0) {
    return yield* ciLanePartitionError(
      "turbo-dry-run",
      laneId,
      `Turbo's ${laneId} selection dry run exited with code ${selectedResult.exitCode}.`,
      partition
    );
  }
  if (selectedResult.truncated) {
    return yield* ciLanePartitionError(
      "turbo-dry-run",
      laneId,
      `Turbo's ${laneId} selection dry run exceeded the capture bound.`,
      partition
    );
  }

  const dryRun = yield* decodeTurboDryRun(selectedResult.output).pipe(
    Effect.mapError((cause) =>
      ciLanePartitionError(
        "turbo-dry-run",
        laneId,
        `Turbo emitted invalid JSON for the ${laneId} selection dry run.`,
        partition,
        cause
      )
    )
  );
  const selectedTaskPackages = pipe(
    dryRun.tasks,
    A.filter((entry) => entry.task === task && entry.command !== TURBO_NONEXISTENT_TASK_COMMAND),
    A.map((entry) => entry.package),
    A.dedupe,
    A.sort(Order.String)
  );

  const workspaces = yield* workspaceManifests(repoRoot).pipe(
    Effect.mapError((cause) =>
      ciLanePartitionError(
        "workspace-read",
        laneId,
        `Failed to resolve the current workspace package inventory for ${laneId}.`,
        partition,
        cause
      )
    )
  );
  const path = yield* Path.Path;
  const workspaceEntries = A.fromIterable(HashMap.entries(workspaces));
  const workspacePackageNames = pipe(
    workspaceEntries,
    A.map(([name]) => name),
    A.sort(Order.String)
  );
  const taskPackageNames = pipe(
    workspaceEntries,
    A.filter(([, workspace]) => {
      const relativeDir = normalizeSlashes(path.relative(repoRoot, workspace.dir));
      return !isLabsWorkspaceDir(relativeDir) && HashMap.has(workspace.manifest.scripts, task);
    }),
    A.map(([name]) => name),
    A.sort(Order.String)
  );

  const coveragePlan = instrumented ? yield* ciCoveragePlan(repoRoot, options) : undefined;
  const selectedPackages =
    coveragePlan === undefined
      ? selectedTaskPackages
      : A.sort(
          A.dedupe(
            A.appendAll(
              selectedTaskPackages,
              A.map(
                A.filter(coveragePlan.owners, (owner) => !isLabsWorkspaceDir(owner.packagePath)),
                (owner) => owner.packageName
              )
            )
          ),
          Order.String
        );
  return { coveragePlan, selectedPackages, taskPackageNames, workspacePackageNames };
});

// A partition handed the run's planned list proves the plan allocated every partition its own
// selection needs. A partition the plan never allocated runs no job, so without this an omitted
// partition would read as a pass; any allocated sibling turns the omission into a failure.
const provePlannedCiLanePartitions = Effect.fn("CiLane.provePlannedCiLanePartitions")(function* (
  laneId: PartitionedCiLane,
  partition: CiLanePartitionId,
  options: CiLaneRunOptions,
  selection: PartitionedLaneSelection
): Effect.fn.Return<void, CiLanePartitionError> {
  const planned = options.plannedPartitions;
  if (planned === undefined) return;
  const unplanned = A.filter(
    plannedCiLanePartitions(laneId, selection.taskPackageNames, selection.selectedPackages),
    (needed) => !A.contains(planned, needed)
  );
  if (A.isReadonlyArrayNonEmpty(unplanned)) {
    return yield* ciLanePartitionError(
      "unplanned-partition",
      laneId,
      `The run's ${laneId} plan omits partition(s) with selected tasks: ${A.join(unplanned, ", ")}.`,
      partition
    );
  }
  yield* Console.log(`[ci] ${laneId} plan proved: every partition with selected tasks was allocated.`);
});

const runCiPartitionedLane = Effect.fn("CiLane.runCiPartitionedLane")(function* (
  repoRoot: string,
  request: PartitionedLaneRequest,
  options: CiLaneRunOptions
): Effect.fn.Return<
  void,
  CiCommandError | CiLanePartitionError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  CiLaneEnvironment
> {
  const { laneId, partition } = request;
  const selection = yield* resolvePartitionedLaneSelection(
    repoRoot,
    laneId,
    options,
    O.some(partition),
    laneId === "test-unit" && options.coverageOutput !== undefined
  );
  const proof = yield* proveCiLanePartition(
    laneId,
    partition,
    selection.workspacePackageNames,
    selection.taskPackageNames,
    selection.selectedPackages,
    options.affected
  );
  yield* Console.log(
    `[ci] ${laneId} partition union proved: ${selection.taskPackageNames.length} executable tasks, ${proof.selectedTaskCount} selected, ${proof.partitionTaskCount} in ${partition}.`
  );
  yield* Effect.forEach(ciLaneDefaultPlacementLinesForTesting(laneId, selection.taskPackageNames), Console.log, {
    discard: true,
  });
  yield* provePlannedCiLanePartitions(laneId, partition, options, selection);

  yield* runCiPartitionExecution(repoRoot, request, options, proof, selection.coveragePlan);
});

/**
 * Plan the partitions of one lane that a run must allocate.
 *
 * **Details**
 *
 * Runs the lane's Turbo selection dry run exactly as a partition does and
 * returns every partition with a selected task. Test Unit plans the
 * instrumented shape hosted shards run, so the coverage planner's owners are
 * part of the selection. Without the affected shape Turbo selects every task
 * and the plan is the lane's whole table.
 *
 * **Example** (Plan the affected Test Integration partitions)
 *
 * ```ts
 * import { CiLaneRunOptions, planCiLanePartitions } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = planCiLanePartitions("test-integration", CiLaneRunOptions.make({
 *   affected: true, base: "origin/main", head: "HEAD", summarize: false,
 *   mode: "auto", to: "HEAD", last: false, changesetStatus: false,
 *   validateEnvelopes: false
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param laneId - CI lane to plan; it must be a partitioned lane.
 * @param options - Lane shape (affected and base) the partitions will run with.
 * @returns The needed partition ids, in table order.
 * @category use-cases
 * @since 0.0.0
 */
export const planCiLanePartitions = Effect.fn("CiLane.planCiLanePartitions")(function* (
  laneId: CiLaneId,
  options: CiLaneRunOptions
): Effect.fn.Return<
  ReadonlyArray<CiLanePartitionId>,
  CiCommandError | CiLanePartitionError | QualityTaskConfigurationError,
  CiLaneEnvironment
> {
  if (!isPartitionedCiLane(laneId)) {
    return yield* ciLanePartitionError("invalid-options", laneId, `Lane ${laneId} has no partitions to plan.`);
  }
  if (options.partition !== undefined || options.filter !== undefined) {
    return yield* ciLanePartitionError(
      "invalid-options",
      laneId,
      "--plan-partitions plans the whole lane; it cannot be combined with --partition or --filter."
    );
  }
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const selection = yield* resolvePartitionedLaneSelection(repoRoot, laneId, options, O.none(), laneId === "test-unit");
  const planned = plannedCiLanePartitions(laneId, selection.taskPackageNames, selection.selectedPackages);
  yield* Console.log(
    `[ci] ${laneId} plan: ${A.length(planned)} partition(s) for ${A.length(selection.selectedPackages)} selected task(s) of ${A.length(selection.taskPackageNames)}: ${A.join(planned, ", ")}`
  );
  return planned;
});

const validateCiCoverageConsumerRequest = Effect.fn("CiLane.validateCiCoverageConsumerRequest")(function* (
  laneId: CiLaneId,
  options: CiLaneRunOptions
) {
  if (options.compareOnly !== (options.coverageInput !== undefined) || (options.compareOnly && laneId !== "coverage")) {
    return yield* CiCommandError.make({
      message: "--compare-only and --coverage-input must be used together on the coverage lane.",
    });
  }
});

const validateCiCoverageProducerRequest = Effect.fn("CiLane.validateCiCoverageProducerRequest")(function* (
  laneId: CiLaneId,
  options: CiLaneRunOptions
) {
  if (options.coverageOutput !== undefined && !A.contains(["test-unit", "labs"], laneId)) {
    return yield* CiCommandError.make({
      message: "--coverage-output requires a Test Unit partition or the Labs lane.",
    });
  }
  if (options.coverageOnly && (laneId !== "labs" || options.coverageOutput === undefined)) {
    return yield* CiCommandError.make({ message: "--coverage-only requires Labs with --coverage-output." });
  }
  if (options.coverageOutput !== undefined && laneId === "test-unit" && options.partition === undefined) {
    return yield* CiCommandError.make({ message: "Instrumented Test Unit execution requires --partition." });
  }
});

/**
 * Run a CI lane body exactly as hosted CI would.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneRunOptions, runCiLane } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = runCiLane("fallow", CiLaneRunOptions.make({
 *   affected: false,
 *   base: "origin/main",
 *   head: "HEAD",
 *   summarize: false,
 *   mode: "affected",
 *   to: "HEAD",
 *   last: false,
 *   changesetStatus: false,
 *   validateEnvelopes: false
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param laneId - CI lane to run.
 * @param options - Lane shape options (affected/base/mode/range flags).
 * @returns Effect that fails when the lane's verdict is red.
 * @category use-cases
 * @since 0.0.0
 */
export const runCiLane = Effect.fn("CiLane.runCiLane")(function* (
  laneId: CiLaneId,
  options: CiLaneRunOptions
): Effect.fn.Return<
  void,
  CiCommandError | CiLanePartitionError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  CiLaneEnvironment
> {
  yield* validateCiCoverageConsumerRequest(laneId, options);
  yield* validateCiCoverageProducerRequest(laneId, options);
  const partitionedRequest = yield* resolvePartitionedLaneRequest(laneId, options);
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));

  if (laneId === "coverage" && options.compareOnly) {
    yield* runCiCoverageComparison(repoRoot, options);
    return;
  }
  if (laneId === "labs" && options.coverageOutput !== undefined) {
    const checks = A.map(ciLaneStepsForTesting(repoRoot, "labs", options), (step) =>
      QualityTaskStep.make({ ...step, args: A.filter(step.args, (arg) => arg !== "test") })
    );
    yield* runCiLabsCoverage(repoRoot, options, checks);
    return;
  }
  yield* pipe(
    partitionedRequest,
    O.match({
      onNone: () =>
        pipe(
          Match.value(laneId),
          Match.when("doctest", () => runCiDoctestLane(repoRoot)),
          Match.when("fallow", () => runCiFallowLane(repoRoot, options)),
          Match.orElse((stepLaneId) => runCiStepLane(repoRoot, stepLaneId, options))
        ),
      onSome: (request) => runCiPartitionedLane(repoRoot, request, options),
    })
  );
});

const encodeCiLaneDescriptors = S.encodeUnknownEffect(S.Array(CiLaneDescriptor));

const printCiLaneList = Effect.fn("CiLane.printCiLaneList")(function* (): Effect.fn.Return<void, CiCommandError> {
  const encoded = yield* encodeCiLaneDescriptors(CI_LANE_DESCRIPTORS).pipe(
    CiCommandError.mapError("Failed to encode CI lane descriptors.")
  );
  const rendered = yield* jsonStringifyPretty(encoded).pipe(
    CiCommandError.mapError("Failed to render CI lane descriptors.")
  );
  yield* Console.log(rendered);
});

const docgenModeFlagChoices: ReadonlyArray<readonly [DocgenLaneMode, DocgenLaneMode]> = A.map(
  DOCGEN_LANE_MODE_VALUES,
  (mode) => [mode, mode] as const
);

const partitionFlagChoices: ReadonlyArray<readonly [CiLanePartitionId, CiLanePartitionId]> = A.map(
  CiLanePartitionId.literals,
  (partition) => [partition, partition] as const
);

// The run's partition plan travels between jobs as one JSON array: `--plan-partitions` publishes
// it as the `partitions` step output and `--planned-partitions` reads it back.
const PlannedCiLanePartitions = S.Array(CiLanePartitionId);
const decodePlannedCiLanePartitions = S.decodeUnknownEffect(S.fromJsonString(PlannedCiLanePartitions));
const PLANNED_PARTITIONS_OUTPUT = "partitions";

/**
 * `beep ci lane` command: run one CI lane body or list the lane inventory.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { ciLaneCommand } from "@beep/repo-cli/commands/Ci"
 * import * as Command from "effect/cli/Command";
 * import * as Effect from "effect/Effect"
 *
 * const run = Command.run(ciLaneCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciLaneCommand = Command.make(
  "lane",
  {
    affected: Flag.Boolean("affected").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Run the turbo-backed lane in CI's --affected pull-request shape")
    ),
    selectionOnly: Flag.Boolean("selection-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Storybook only: write should_run to GITHUB_OUTPUT without building or testing")
    ),
    base: Flag.String("base").pipe(
      Flag.withDescription(
        `Base git ref for affected/docgen/fallow/commitlint shapes (default ${CI_LANE_DEFAULT_BASE})`
      ),
      Flag.optional
    ),
    eventBase: Flag.Boolean("event-base").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Resolve the base from the workflow event instead of --base: a pull request's verified merge commit first parent (else pull_request.base.sha), otherwise GITHUB_SHA"
      )
    ),
    head: Flag.String("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head git ref for docgen shapes")),
    summarize: Flag.Boolean("summarize").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Pass --summarize to the turbo-backed lane (CI always does)")
    ),
    mode: Flag.ChoiceWithValue("mode", docgenModeFlagChoices).pipe(
      Flag.withDefault("auto"),
      Flag.withDescription("Docgen lane mode; auto derives none/affected/full from --base...--head.")
    ),
    from: Flag.String("from").pipe(Flag.withDescription("Commitlint range start (defaults to --base)"), Flag.optional),
    to: Flag.String("to").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Commitlint range end")),
    last: Flag.Boolean("last").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Lint only the last commit (commitlint --last)")
    ),
    changesetStatus: Flag.Boolean("changeset-status").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Also run the changeset status check (CI passes this on pull requests)")
    ),
    docsOnly: Flag.Boolean("docs-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "repo-sanity: run only the checks a documentation-only diff can fail (home path law, changeset graph and status)"
      )
    ),
    validateEnvelopes: Flag.Boolean("validate-envelopes").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Also replay the fallow envelope validation steps locally")
    ),
    runs: Flag.String("runs").pipe(
      Flag.withDefault("400"),
      Flag.withDescription("BEEP_FC_NUM_RUNS floor for the property lane (values only raise, never lower)")
    ),
    seed: Flag.String("seed").pipe(
      Flag.withDefault(DEFAULT_PROPERTY_LANE_SEED),
      Flag.withDescription("BEEP_FC_SEED for the property lane; a fixed seed makes local and CI test identical inputs")
    ),
    filter: Flag.String("filter").pipe(
      Flag.withDescription(
        "Pass one package filter, or several separated by commas, to the Turbo invocation inside the selected lane"
      ),
      Flag.optional
    ),
    shard: Flag.String("shard").pipe(
      Flag.withDescription("property: run Vitest slice <index>/<total> of each swept package"),
      Flag.optional
    ),
    partition: Flag.ChoiceWithValue("partition", partitionFlagChoices).pipe(
      Flag.withDescription("Run one deterministic Lint, Test Unit or Test Integration package partition"),
      Flag.optional
    ),
    planPartitions: Flag.Boolean("plan-partitions").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Partitioned lanes: write the partitions with selected tasks to GITHUB_OUTPUT (partitions) and run nothing"
      )
    ),
    plannedPartitions: Flag.String("planned-partitions").pipe(
      Flag.withDescription(
        "With --partition: JSON array of the run's planned partitions; fail when one with selected tasks is missing"
      ),
      Flag.optional
    ),
    coverageOutput: Flag.String("coverage-output").pipe(
      Flag.withDescription("Seal instrumented unit/Labs coverage in this artifact directory"),
      Flag.optional
    ),
    coverageInput: Flag.String("coverage-input").pipe(
      Flag.withDescription("Compare downloaded producer artifacts from this directory"),
      Flag.optional
    ),
    compareOnly: Flag.Boolean("compare-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Coverage lane: validate and compare artifacts without running tests")
    ),
    coverageOnly: Flag.Boolean("coverage-only").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Labs artifact execution: skip the separately gated check/lint tasks")
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Prove a partition's full union and selected intersection without executing tasks")
    ),
    force: Flag.Boolean("force").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Proof-only partition replay: pass --force to Turbo task execution")
    ),
    list: Flag.Boolean("list").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the machine-readable lane inventory and exit")
    ),
    inventory: Flag.String("inventory").pipe(
      Flag.withDescription("jsdoc-ratchet: ratchet this pre-built inventory instead of regenerating it"),
      Flag.optional
    ),
    lane: Argument.Literals("lane", CI_LANE_ID_VALUES).pipe(
      Argument.withDescription("CI lane id to run"),
      Argument.optional
    ),
  },
  Effect.fnUntraced(function* ({
    affected,
    base: baseFlag,
    changesetStatus,
    docsOnly,
    eventBase,
    coverageOutput,
    coverageInput,
    compareOnly,
    coverageOnly,
    dryRun,
    filter,
    force,
    from,
    head,
    inventory,
    lane,
    last,
    list,
    mode,
    partition,
    planPartitions,
    plannedPartitions,
    runs,
    seed,
    selectionOnly,
    shard,
    summarize,
    to,
    validateEnvelopes,
  }) {
    const decodedShard = yield* O.match(shard, {
      onNone: () => Effect.succeedNone,
      onSome: (raw) =>
        decodeCiLaneShardFlag(raw).pipe(
          Effect.asSome,
          CiCommandError.mapError("--shard must be <index>/<total> with the index no larger than the total."),
          Effect.catchTag("CiCommandError", reportCiCommandError)
        ),
    });
    const decodedPlannedPartitions = yield* O.match(plannedPartitions, {
      onNone: () => Effect.succeedNone,
      onSome: (raw) =>
        decodePlannedCiLanePartitions(raw).pipe(
          Effect.asSome,
          CiCommandError.mapError("--planned-partitions must be a JSON array of partition ids."),
          Effect.catchTag("CiCommandError", reportCiCommandError)
        ),
    });
    const base = yield* resolveCiLaneBase(baseFlag, eventBase).pipe(
      Effect.catchTag("CiCommandError", reportCiCommandError)
    );
    const options = CiLaneRunOptions.make({
      affected,
      base,
      head,
      summarize,
      mode,
      ...O.getSomesStruct({
        filter,
        from,
        inventory,
        partition,
        coverageOutput,
        coverageInput,
        plannedPartitions: decodedPlannedPartitions,
        shard: decodedShard,
      }),
      compareOnly,
      coverageOnly,
      to,
      last,
      changesetStatus,
      validateEnvelopes,
      runs,
      seed,
      dryRun,
      force,
      docsOnly,
    });

    if (list) {
      return yield* printCiLaneList().pipe(Effect.catchTag("CiCommandError", reportCiCommandError));
    }

    if (selectionOnly) {
      return yield* Effect.gen(function* () {
        if (!O.contains(lane, "storybook")) {
          return yield* CiCommandError.make({ message: "--selection-only is supported only for the Storybook lane." });
        }
        const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
        const selected = affected ? yield* resolveStorybookLaneAffected(repoRoot, base) : true;
        const outputs = yield* ActionOutputs;
        yield* outputs
          .set("should_run", selected ? "true" : "false")
          .pipe(CiCommandError.mapError("Failed to write Storybook selection to GITHUB_OUTPUT."));
      }).pipe(Effect.catchTag("CiCommandError", reportCiCommandError));
    }

    if (planPartitions) {
      return yield* Effect.gen(function* () {
        const laneId = yield* Effect.fromOption(lane).pipe(
          CiCommandError.mapError("--plan-partitions requires a lane id.")
        );
        const planned = yield* planCiLanePartitions(laneId, options);
        const outputs = yield* ActionOutputs;
        yield* outputs
          .setJson(PLANNED_PARTITIONS_OUTPUT, planned, PlannedCiLanePartitions)
          .pipe(CiCommandError.mapError("Failed to write the partition plan to GITHUB_OUTPUT."));
      }).pipe(
        Effect.catchTags({
          CiCommandError: reportCiCommandError,
          CiLanePartitionError: reportCiCommandError,
        })
      );
    }

    return yield* O.match(lane, {
      onNone: () =>
        reportCiCommandError(
          CiCommandError.make({ message: "Specify a lane id or pass --list. See beep ci lane --list." })
        ),
      onSome: (laneId) =>
        runCiLane(laneId, options).pipe(
          Effect.catchTags({
            CiCommandError: reportCiCommandError,
            CiLanePartitionError: reportCiCommandError,
          })
        ),
    });
  })
).pipe(
  Command.withDescription("Run one check.yml CI lane body exactly as hosted CI does"),
  Command.provide(CiRunnerOutputsLive)
);

/**
 * The lanes `beep ci local` runs when no `--lanes` selection is given.
 *
 * **Example** (Count the default battery)
 *
 * ```ts
 * import { CI_LOCAL_DEFAULT_LANES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LOCAL_DEFAULT_LANES.includes("coverage")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CI_LOCAL_DEFAULT_LANES: ReadonlyArray<CiLaneId> = [
  "commitlint",
  "repo-sanity",
  "lint-policy",
  "lint",
  "check",
  "codegen",
  "jsdoc-ratchet",
  "secrets",
  "sast",
  "security",
  "build",
  "test-unit",
  "ecosystem",
  "labs",
  "storybook",
  "test-integration",
  "property",
  "docgen",
  "doctest",
  "coverage",
  "desktop-ipc",
  "fallow",
  "nix",
];

const CI_LOCAL_FAST_SKIPS: ReadonlyArray<CiLaneId> = ["coverage", "storybook", "test-integration", "nix"];

type CiLocalOptions = {
  readonly affected: boolean;
  readonly base: string;
  readonly fast: boolean;
  readonly lanes: O.Option<string>;
};

const parseCiLocalLaneSelection = Effect.fn("CiLane.parseCiLocalLaneSelection")(function* (
  options: CiLocalOptions
): Effect.fn.Return<ReadonlyArray<CiLaneId>, CiCommandError> {
  const requested = yield* O.match(options.lanes, {
    onNone: () => Effect.succeed(CI_LOCAL_DEFAULT_LANES),
    onSome: Effect.fnUntraced(function* (rawLanes) {
      const entries = pipe(Str.split(rawLanes, ","), A.map(Str.trim), A.filter(Str.isNonEmpty), A.dedupe);
      const invalid = A.filter(entries, (entry) => !isCiLaneId(entry));
      if (A.isReadonlyArrayNonEmpty(invalid)) {
        return yield* CiCommandError.make({
          message: `Unknown lane id(s): ${A.join(invalid, ", ")}. Valid ids: ${A.join(CI_LANE_ID_VALUES, ", ")}.`,
        });
      }

      return A.filter(entries, isCiLaneId);
    }),
  });

  return options.fast ? A.filter(requested, (laneId) => !A.contains(CI_LOCAL_FAST_SKIPS, laneId)) : requested;
});

// `Git.currentBranch` in `show-current` mode; a detached HEAD reads as the empty string the capture
// trimmed to (SPEC D-10).
const currentGitBranch = Effect.fn("CiLane.currentGitBranch")(function* (
  repoRoot: string
): Effect.fn.Return<string, CiCommandError, Git> {
  const git = yield* Git;
  return yield* git.currentBranch(repoRoot, { mode: "show-current" }).pipe(
    Effect.mapBoth({
      onFailure: adaptGitKitError(GitCommand.currentBranch("show-current"), {
        onSpawnFailure: () => CiCommandError.new("Failed to resolve the current git branch."),
        onNonZeroExit: ({ exitCode }) =>
          CiCommandError.make({ message: `git branch --show-current failed with exit code ${exitCode}.` }),
        onTruncated: O.none(),
      }),
      onSuccess: O.getOrElse(() => ""),
    })
  );
});

/**
 * Resolved shape for planning the local battery's lane dispatch steps.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLocalStepPlan } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = CiLocalStepPlan.make({
 *   affected: false,
 *   base: "origin/main",
 *   onMainBranch: false
 * })
 * console.log(plan.base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLocalStepPlan extends S.Opaque<CiLocalStepPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    affected: S.Boolean,
    base: S.String,
    onMainBranch: S.Boolean,
  }).pipe(
    $I.annoteSchema("CiLocalStepPlan", {
      description: "Resolved shape for planning the local battery's lane dispatch steps.",
    })
  )
) {}

const ciLocalLaneFlags = (laneId: CiLaneId, plan: CiLocalStepPlan): ReadonlyArray<string> => {
  const affectedFlags = plan.affected ? ["--affected", "--base", plan.base] : A.empty<string>();
  // check.yml gives every Turbo-backed matrix lane `--summarize` as well as the
  // affected shape. It only writes gitignored `.turbo/runs/*.json` receipts, so
  // replaying it locally costs nothing and keeps the dispatched argv identical
  // to the hosted one.
  const turboShapeFlags = [...affectedFlags, "--summarize"];

  return CiLaneId.match(laneId, {
    build: () => turboShapeFlags,
    check: () => turboShapeFlags,
    codegen: A.empty<string>,
    commitlint: () => ["--from", plan.base],
    coverage: () => turboShapeFlags,
    "desktop-ipc": A.empty<string>,
    docgen: () => ["--mode", plan.affected ? "auto" : "full", "--base", plan.base],
    "docs-policy": () => ["--base", plan.base],
    doctest: A.empty<string>,
    ecosystem: A.empty<string>,
    fallow: () => ["--base", plan.base, "--validate-envelopes"],
    "jsdoc-ratchet": A.empty<string>,
    // check.yml runs `ci lane labs --summarize` over the full labs set, so
    // local replay deliberately omits the affected shape too. The summary
    // is what folds the lab check/lint/test task hashes into the lane digest
    // (TTC ruling 58), so the local replay passes it too.
    labs: () => ["--summarize"],
    lint: () => turboShapeFlags,
    "lint-policy": () => turboShapeFlags,
    nix: A.empty<string>,
    property: () => turboShapeFlags,
    "repo-sanity": () => (plan.onMainBranch ? A.empty<string>() : ["--changeset-status"]),
    sast: A.empty<string>,
    secrets: A.empty<string>,
    security: A.empty<string>,
    // The affected shape drives the Turbo dry-run probe, not the execution
    // argv (see the storybook lane body).
    storybook: () => turboShapeFlags,
    "test-integration": () => turboShapeFlags,
    "test-unit": () => turboShapeFlags,
  });
};

/**
 * Build the `beep ci lane <id>` dispatch step for one lane.
 *
 * **Details**
 *
 * This is the single source of the argv every local replay of a hosted lane
 * runs — the local CI battery and Yeet's pre-push proof both dispatch through
 * it, so neither can drift into a cousin root command that only approximates
 * the hosted body (ship-velocity B1). Callers own the label because failure
 * attribution keys on it.
 *
 * **Example** (Dispatch the affected check lane)
 *
 * ```ts
 * import { CiLocalStepPlan, ciLaneDispatchStep } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = CiLocalStepPlan.make({ affected: true, base: "origin/main", onMainBranch: false })
 * console.log(ciLaneDispatchStep("/repo", "quality:check", "check", plan).args)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Lane label used for failure attribution.
 * @param laneId - CI lane to dispatch.
 * @param plan - Resolved local battery shape.
 * @returns The planned `beep ci lane` dispatch step.
 * @category constructors
 * @since 0.0.0
 */
export const ciLaneDispatchStep: {
  (repoRoot: string, label: string, laneId: CiLaneId, plan: CiLocalStepPlan): QualityTaskStep;
  (label: string, laneId: CiLaneId, plan: CiLocalStepPlan): (repoRoot: string) => QualityTaskStep;
} = dual(
  4,
  (repoRoot: string, label: string, laneId: CiLaneId, plan: CiLocalStepPlan): QualityTaskStep =>
    QualityTaskStep.make({
      label,
      command: "bun",
      args: ["run", "beep", "ci", "lane", laneId, ...ciLocalLaneFlags(laneId, plan)],
      cwd: repoRoot,
    })
);

/**
 * Build the local battery step plan. Exposed for focused unit tests.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLocalStepPlan, ciLocalStepsForTesting } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const steps = ciLocalStepsForTesting(
 *   "/repo",
 *   ["fallow"],
 *   CiLocalStepPlan.make({ affected: false, base: "origin/main", onMainBranch: false })
 * )
 * console.log(A.map(steps, (step) => step.label))
 * ```
 *
 * @param repoRoot - Repository root used as every subprocess working directory.
 * @param selection - Lanes to run, in order.
 * @param plan - Resolved local battery shape.
 * @returns One `beep ci lane` dispatch step per selected lane.
 * @category testing
 * @since 0.0.0
 */
export const ciLocalStepsForTesting: {
  (repoRoot: string, selection: ReadonlyArray<CiLaneId>, plan: CiLocalStepPlan): ReadonlyArray<QualityTaskStep>;
  (selection: ReadonlyArray<CiLaneId>, plan: CiLocalStepPlan): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
} = dual(
  3,
  (repoRoot: string, selection: ReadonlyArray<CiLaneId>, plan: CiLocalStepPlan): ReadonlyArray<QualityTaskStep> =>
    A.map(selection, (laneId) => ciLaneDispatchStep(repoRoot, `ci:local:${laneId}`, laneId, plan))
);

/**
 * Pair selected local-CI lane ids with their executable steps and known input digests.
 *
 * **Details**
 *
 * Local CI currently has no executor-issued Turbo task hash at planning time,
 * so each lane records an explicitly absent digest rather than substituting a
 * proof-tree hash.
 *
 * **Example** (Pair a local CI lane with its step)
 *
 * ```ts
 * import { CiLocalStepPlan, ciLocalLaneInputsForTesting, ciLocalStepsForTesting } from "@beep/repo-cli/commands/Ci"
 * import type { CiLaneId } from "@beep/repo-cli/commands/Ci"
 *
 * const selection: ReadonlyArray<CiLaneId> = ["check"]
 * const plan = CiLocalStepPlan.make({ affected: false, base: "origin/main", onMainBranch: false })
 * const inputs = ciLocalLaneInputsForTesting(selection, ciLocalStepsForTesting("/repo", selection, plan))
 * console.log(inputs[0]?.[0]) // "check"
 * ```
 *
 * @param selection - Stable selected local-CI lane ids.
 * @param steps - Executable steps created for the same ordered selection.
 * @returns Ordered lane inputs with absent executor digests.
 * @category utilities
 * @since 0.0.0
 */
export const ciLocalLaneInputsForTesting: {
  (selection: ReadonlyArray<CiLaneId>, steps: ReadonlyArray<QualityTaskStep>): ReadonlyArray<QualityTaskLaneInput>;
  (steps: ReadonlyArray<QualityTaskStep>): (selection: ReadonlyArray<CiLaneId>) => ReadonlyArray<QualityTaskLaneInput>;
} = dual(2, (selection: ReadonlyArray<CiLaneId>, steps: ReadonlyArray<QualityTaskStep>) =>
  A.map(A.zip(selection, steps), ([laneId, step]) => [laneId, step, O.none()])
);

/**
 * Run the faithful local CI battery: every locally-runnable check.yml lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { runCiLocal } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = runCiLocal({
 *   affected: true,
 *   base: "origin/main",
 *   fast: true,
 *   lanes: O.none()
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Local battery options (lane selection, fast preset, shape).
 * @returns Effect that fails when any selected lane's verdict is red.
 * @category use-cases
 * @since 0.0.0
 */
export const runCiLocal = Effect.fn("CiLane.runCiLocal")(function* (
  options: CiLocalOptions
): Effect.fn.Return<void, CiCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed, CiLaneEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const selection = yield* parseCiLocalLaneSelection(options);
  const branch = yield* currentGitBranch(repoRoot);
  const steps = ciLocalStepsForTesting(
    repoRoot,
    selection,
    CiLocalStepPlan.make({ affected: options.affected, base: options.base, onMainBranch: branch === "main" })
  );

  yield* Console.log(`[ci] local battery: ${A.join(selection, ", ")}`);
  yield* Console.log("[ci] CI-only (not replayed): pr-size, dependency-review — see beep ci lane --list");
  yield* Console.log("[ci] approximate replays: secrets, security (hosted CI runs pinned images/actions)");

  yield* runQualityTaskStreamingLaneGroup("ci:local", ciLocalLaneInputsForTesting(selection, steps));
});

/**
 * `beep ci local` command: replay the locally-runnable CI battery.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { ciLocalCommand } from "@beep/repo-cli/commands/Ci"
 * import * as Command from "effect/cli/Command";
 * import * as Effect from "effect/Effect"
 *
 * const run = Command.run(ciLocalCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciLocalCommand = Command.make(
  "local",
  {
    affected: Flag.Boolean("affected").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Replay CI's pull-request --affected shape instead of full runs")
    ),
    base: Flag.String("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for affected/docgen/fallow/commitlint shapes")
    ),
    fast: Flag.Boolean("fast").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the slow lanes: coverage, test-integration, nix")
    ),
    lanes: Flag.String("lanes").pipe(
      Flag.withDescription("Comma-separated lane ids to run (default: the full battery)"),
      Flag.optional
    ),
  },
  ({ affected, base, fast, lanes }) =>
    runCiLocal({ affected, base, fast, lanes }).pipe(Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Run the locally-runnable CI battery from the same lane definitions as hosted CI"));
