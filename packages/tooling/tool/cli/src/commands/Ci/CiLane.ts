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

import { $RepoCliId } from "@beep/identity/packages";
import { decodePackageJsonEffect, findRepoRoot, jsonStringifyPretty, readPackageJsonFile } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Duration, Effect, FileSystem, HashSet, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { readTurboCacheEnvironment, turboEnvExtendsAmbient, turboEnvOverrides } from "../../internal/cli/EnvConfig.ts";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { LABS_TURBO_EXCLUDE_FILTER, LABS_TURBO_SELECT_FILTER } from "../../internal/cli/Labs/index.ts";
import { resolveTurboCachePlan, turboCachePlanArgs } from "../../internal/cli/TurboCache.ts";
import { isDoctestSourcePath } from "../../internal/jsdoc/DoctestSource.ts";
import { runCaptured, runToExit } from "../../internal/process/StepExec.ts";
import { QualityTaskStep, runQualityTaskStreamingStepGroup } from "../Quality/Tasks.ts";
import { CiCommandError } from "./Ci.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { QualityTaskConfigurationError, QualityTaskGroupFailed } from "../Quality/Tasks.ts";

const $I = $RepoCliId.create("commands/Ci/CiLane");

type CiLaneEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

const JSDOC_CI_INVENTORY_JSON_PATH = ".beep/ci/jsdoc-documentation.inventory.jsonc";
const JSDOC_CI_INVENTORY_MARKDOWN_PATH = ".beep/ci/jsdoc-documentation.inventory.md";
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
  "doctest",
  "ecosystem",
  "fallow",
  "jsdoc-ratchet",
  "knip",
  "labs",
  "lint",
  "lint-policy",
  "nix",
  "property",
  "repo-sanity",
  "sast",
  "secrets",
  "security",
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

/**
 * Machine-readable descriptor for one check.yml lane.
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
export class CiLaneDescriptor extends S.Class<CiLaneDescriptor>($I`CiLaneDescriptor`)(
  {
    id: S.String,
    contextName: S.String,
    required: S.Boolean,
    laneClass: CiLaneClass,
    replay: CiLaneReplay,
    flags: S.Array(S.String),
    notes: S.optionalKey(S.String),
  },
  $I.annote("CiLaneDescriptor", {
    description: "Machine-readable descriptor for one check.yml CI lane.",
  })
) {}

const TURBO_SHAPE_FLAGS = ["--affected", "--base", "--summarize"] as const;

/**
 * Full lane inventory for check.yml, including CI-only residue.
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
    notes: "Inline github-script API labeling; PR-only; no local replay.",
  }),
  CiLaneDescriptor.make({
    id: "lint",
    contextName: "Lint",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "lint-policy",
    contextName: "Heavy / Lint Policy",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
  }),
  CiLaneDescriptor.make({
    id: "repo-sanity",
    contextName: "Repo Sanity",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--changeset-status"],
    notes: "Always validates the changeset graph; CI also passes --changeset-status on pull requests.",
  }),
  CiLaneDescriptor.make({
    id: "check",
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
    flags: [...TURBO_SHAPE_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "test-integration",
    contextName: "Heavy / Test Integration",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "coverage",
    contextName: "Heavy / Coverage Regression",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [...TURBO_SHAPE_FLAGS],
  }),
  CiLaneDescriptor.make({
    id: "docgen",
    contextName: "Heavy / Docgen",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--mode", "--base", "--head"],
    notes: "The CLI computes none/affected/full from the base-to-head diff when --mode auto is selected.",
  }),
  CiLaneDescriptor.make({
    id: "doctest",
    contextName: "Heavy / Doctest",
    required: true,
    laneClass: "workflow-gated",
    replay: "exact",
    flags: ["--mode", "--base", "--head"],
    notes: "Lane-gate mode computation stays in the workflow and arrives as --mode.",
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
    notes: "Path filter and Rust toolchain setup stay in the workflow.",
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
    id: "knip",
    contextName: "Knip",
    required: true,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
  }),
  CiLaneDescriptor.make({
    id: "jsdoc-ratchet",
    contextName: "JSDoc Ratchet",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: [],
    notes: "Runs jsdoc-inventory before jsdoc-ratchet, matching hosted CI's sequence.",
  }),
  CiLaneDescriptor.make({
    id: "build",
    contextName: "Build",
    required: false,
    laneClass: "cli-runnable",
    replay: "exact",
    flags: ["--summarize"],
    notes: "Push-only in hosted CI.",
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
    flags: ["--affected", "--base", "--summarize", "--runs", "--seed"],
    notes:
      "Added by one-round-loop P1 (D3): schema property laws at a 400-run PR floor via BEEP_FC_NUM_RUNS, pinned to a fixed BEEP_FC_SEED so local and CI test identical inputs (one-round determinism; nightly rotates seeds); lands non-required, flips to required at P4 after a stable green history.",
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
 *   validateEnvelopes: false
 * })
 * console.log(options.base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRunOptions extends S.Class<CiLaneRunOptions>($I`CiLaneRunOptions`)(
  {
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
  },
  $I.annote("CiLaneRunOptions", {
    description: "Shape and optional Turbo scope for running one CI lane body.",
  })
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
  ...O.match(O.fromUndefinedOr(options.filter), {
    onNone: A.empty<string>,
    onSome: (filter) => [`--filter=${filter}`],
  }),
];

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

// Lint and Test Unit still run on hosted 16GB ubuntu-24.04 runners (check.yml),
// not the 32GB beep-ec2-heavy fleet, so they keep the 16GB-survival turbo cap
// instead of inheriting the fleet default that boundedRootTurboArgs applies in CI.
const HOSTED_16GB_TURBO_CONCURRENCY_ARG = "--concurrency=2";
const QualityCheckConcurrency = LiteralKit(["2", "3"]);

const qualityCheckConcurrencyArg = (): string =>
  `--concurrency=${pipe(
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
    S.decodeUnknownOption(QualityCheckConcurrency)(Bun.env.BEEP_QUALITY_CHECK_CONCURRENCY),
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
    O.getOrElse(() => (Bun.env.GITHUB_ACTIONS === "true" ? "2" : "3"))
  )}`;

const directTurboArgs = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  ...tasks,
  ...turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: Bun.env.CI === "true" })),
  ...args,
];

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
  DocgenLaneMode.$match(options.mode, {
    auto: () => [
      rootScriptStep(repoRoot, "ci:docgen", "docgen:local", ["--base", options.base, "--head", options.head]),
    ],
    none: A.empty<QualityTaskStep>,
    affected: () => [
      rootScriptStep(repoRoot, "ci:docgen", "docgen:local", ["--base", options.base, "--head", options.head]),
    ],
    full: () => [rootScriptStep(repoRoot, "ci:docgen", "docgen", A.empty<string>())],
  });

/**
 * Build the exact Vitest step for the Doctest lane.
 *
 * **When to use**
 *
 * Use to prove the hosted lane's final argv in focused tests and after
 * affected-file resolution, without performing Git I/O.
 *
 * **Example** (Build the full Doctest step)
 *
 * ```ts
 * import { doctestStepForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * const steps = doctestStepForTesting("/repo", undefined)
 * console.log(steps[0]?.args)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param files - Sorted affected source paths, or undefined for the full corpus.
 * @returns No step for an empty affected set; otherwise one exact Vitest step.
 * @category testing
 * @since 0.0.0
 */
export const doctestStepForTesting: {
  (files: ReadonlyArray<string> | undefined): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
  (repoRoot: string, files: ReadonlyArray<string> | undefined): ReadonlyArray<QualityTaskStep>;
} = dual(
  2,
  (repoRoot: string, files: ReadonlyArray<string> | undefined): ReadonlyArray<QualityTaskStep> =>
    files !== undefined && A.isReadonlyArrayEmpty(files)
      ? A.empty<QualityTaskStep>()
      : [
          QualityTaskStep.make({
            label: "ci:doctest",
            command: "bunx",
            args: ["vitest", "run", "--config", "vitest.docs.ts", ...(files ?? A.empty<string>())],
            cwd: repoRoot,
          }),
        ]
);

const doctestLaneSteps = (repoRoot: string, options: CiLaneRunOptions): ReadonlyArray<QualityTaskStep> =>
  DocgenLaneMode.$match(options.mode, {
    auto: A.empty<QualityTaskStep>,
    none: A.empty<QualityTaskStep>,
    affected: A.empty<QualityTaskStep>,
    full: () => doctestStepForTesting(repoRoot, undefined),
  });

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
  A.map(CODEGEN_DRIVER_PACKAGE_DIRS.Options, (packageDir) => codegenDriverStep(repoRoot, packageDir));

const FALLOW_BLOCKING_LANES = ["audit", "dead-code"] as const;
const FALLOW_ADVISORY_LANES = ["health", "boundaries", "flags", "security", "fix-preview"] as const;
const FALLOW_ENVELOPE_REQUIRED_FIELDS = "schemaVersion,status,command,exitStatus,baseRef,rawOutputRef";

const fallowReportPath = (lane: string, advisory: boolean): string =>
  `.beep/fallow/${lane}.${advisory ? "advisory" : "check"}.json`;

const fallowRunStep = (repoRoot: string, lane: string, gateFlag: string, base: string): QualityTaskStep =>
  QualityTaskStep.make({
    label: `ci:fallow:${lane}`,
    command: "bun",
    args: [
      "run",
      "beep",
      "quality",
      "fallow",
      lane,
      gateFlag,
      "--base",
      base,
      "--out",
      fallowReportPath(lane, gateFlag === "--advisory"),
      "--quiet",
    ],
    cwd: repoRoot,
  });

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
  ...A.map(FALLOW_BLOCKING_LANES, (lane) => fallowRunStep(repoRoot, lane, "--check", options.base)),
  ...A.map(FALLOW_ADVISORY_LANES, (lane) => fallowRunStep(repoRoot, lane, "--advisory", options.base)),
  ...(options.validateEnvelopes ? fallowEnvelopeCheckSteps(repoRoot) : A.empty<QualityTaskStep>()),
];

/**
 * Build the step plan for a CI lane. Exposed for focused unit tests.
 *
 * The fallow lane's plan lists its subprocess steps in execution order; its
 * runtime additionally maintains `.beep/fallow/status.md` accounting (see
 * {@link runCiLane}).
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
    CiLaneId.$match(laneId, {
      build: () => [
        rootScriptStep(repoRoot, "ci:build", "build", options.summarize ? ["--summarize"] : A.empty<string>()),
      ],
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
      doctest: () => doctestLaneSteps(repoRoot, options),
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
      "jsdoc-ratchet": () => [
        bunRunStep(repoRoot, "ci:jsdoc-ratchet:inventory", [
          "beep",
          "quality",
          "jsdoc-inventory",
          "--output-json",
          JSDOC_CI_INVENTORY_JSON_PATH,
          "--output-markdown",
          JSDOC_CI_INVENTORY_MARKDOWN_PATH,
        ]),
        bunRunStep(repoRoot, "ci:jsdoc-ratchet:ratchet", [
          "beep",
          "quality",
          "jsdoc-ratchet",
          "--inventory",
          JSDOC_CI_INVENTORY_JSON_PATH,
        ]),
      ],
      knip: () => [bunRunStep(repoRoot, "ci:knip", ["beep", "quality", "knip"])],
      // lab-apps-lifecycle P2 (ratified row 10): one bundled turbo invocation
      // over the labs glob. Deliberately no --affected — turbo unions filter
      // selectors, so --affected plus the positive labs filter would WIDEN the
      // selection to affected-products plus labs; the workflow path gate scopes
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
      // the labs exclude filter is applied explicitly here (row 9).
      lint: () => [
        turboTaskLaneStep(
          repoRoot,
          "lint",
          "lint",
          [HOSTED_16GB_TURBO_CONCURRENCY_ARG, LABS_TURBO_EXCLUDE_FILTER],
          options
        ),
      ],
      // `--full` states the hosted scope in the argv instead of inheriting it
      // from ambient `CI=true`, so a local replay scans the same repo-wide
      // surface the required Lint Policy context does. Hosted runs are
      // unchanged: `beep lint policy` already forces the full sweep under CI.
      "lint-policy": () => [bunRunStep(repoRoot, "ci:lint-policy", ["beep", "lint", "policy", "--full"])],
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
          args: directTurboArgs(["test:property"], [CI_LANE_TURBO_CONCURRENCY_ARG, ...turboShapeArgs(options)]),
          cwd: repoRoot,
          env: {
            BEEP_FC_NUM_RUNS: resolvePropertyLaneRuns(options.runs),
            BEEP_FC_SEED: resolvePropertyLaneSeed(options.seed),
            ...(options.affected ? { TURBO_SCM_BASE: options.base } : {}),
          },
        }),
      ],
      "repo-sanity": () => [
        bunRunStep(repoRoot, "ci:repo-sanity:changeset-graph", ["beep", "quality", "changeset-graph"]),
        bunRunStep(repoRoot, "ci:repo-sanity", ["audit:github", "repo-sanity"]),
        ...(options.changesetStatus
          ? [
              // lab-apps-lifecycle P2 (ratified row 8): route CI's changeset
              // gate through the path-aware wrapper so lab-only changes are
              // exempt from changeset ceremony.
              bunRunStep(repoRoot, "ci:repo-sanity:changeset-status", [
                "beep",
                "quality",
                "changeset-status",
                "--since",
                "origin/main",
              ]),
            ]
          : A.empty<QualityTaskStep>()),
      ],
      sast: () => [bunRunStep(repoRoot, "ci:sast", ["beep", "quality", "github-checks", "sast"])],
      secrets: () => [bunRunStep(repoRoot, "ci:secrets", ["beep", "quality", "github-checks", "secrets"])],
      security: () => [bunRunStep(repoRoot, "ci:security", ["beep", "quality", "github-checks", "security"])],
      "test-integration": () => [turboRootLaneStep(repoRoot, "test-integration", "test", ["--integration"], options)],
      "test-unit": () => [
        turboRootLaneStep(repoRoot, "test-unit", "test", ["--unit", HOSTED_16GB_TURBO_CONCURRENCY_ARG], options),
      ],
    })
);

const renderStepCommand = (step: QualityTaskStep): string => A.join([step.command, ...step.args], " ");

const runLaneProcess = Effect.fn("CiLane.runLaneProcess")(function* (
  step: QualityTaskStep
): Effect.fn.Return<number, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[ci] ${step.label}: ${renderStepCommand(step)}`);
  // Lane bodies that shell out to Turbo need the same env hygiene the root
  // quality runner applies: no interactive TUI (it can leave a killed run's
  // terminal in mouse-capture mode) and no unresolved `op://` token/team
  // references leaking through as literal values on a workstation.
  const envOverrides = yield* turboEnvOverrides(step.command, step.args, Bun.env);
  return yield* runToExit({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: { ...envOverrides, ...(step.env ?? {}) },
    extendEnv: turboEnvExtendsAmbient(step.command, step.args),
    stdio: "inherit",
  }).pipe(CiCommandError.mapError(`Failed to spawn ${renderStepCommand(step)}.`));
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

  const statusLines = A.empty<string>();
  const writeStatus = Effect.fnUntraced(function* () {
    const content = A.isReadonlyArrayEmpty(statusLines) ? "" : `${A.join(statusLines, "\n")}\n`;
    yield* fs.writeFileString(statusPath, content).pipe(CiCommandError.mapError(`Failed to write ${statusPath}.`));
  });
  yield* writeStatus();

  const runFallowSubLane = Effect.fnUntraced(function* (lane: string, gateFlag: string) {
    const [elapsed, exitCode] = yield* runLaneProcess(fallowRunStep(repoRoot, lane, gateFlag, options.base)).pipe(
      Effect.timed
    );
    const elapsedSeconds = Math.floor(Duration.toMillis(elapsed) / 1000);
    A.appendInPlace(statusLines, `- ${lane}: ${exitCode} (${elapsedSeconds}s)`);
    yield* writeStatus();
    return exitCode;
  });

  const blockingExitCodes = yield* Effect.forEach(FALLOW_BLOCKING_LANES, (lane) => runFallowSubLane(lane, "--check"));
  yield* Effect.forEach(FALLOW_ADVISORY_LANES, (lane) => runFallowSubLane(lane, "--advisory"), { discard: true });

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

const normalizedOutputPaths = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/u)(output), A.map(normalizeSlashes), A.filter(Str.isNonEmpty), A.dedupe, A.sort(Order.String));

const resolveAutoDocgenLaneMode = Effect.fn("CiLane.resolveAutoDocgenLaneMode")(function* (
  repoRoot: string,
  base: string,
  head: string
): Effect.fn.Return<DocgenLaneMode, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "git",
    args: ["diff", "--name-only", `${base}...${head}`],
    cwd: repoRoot,
    source: "stdout",
  }).pipe(CiCommandError.mapError("Failed to resolve automatic Docgen scope."));
  if (result.exitCode !== 0) {
    return yield* CiCommandError.make({
      message: `git diff for automatic Docgen scope failed with exit code ${result.exitCode}.`,
    });
  }
  const changedPaths = normalizedOutputPaths(result.output);
  const mode = docgenLaneModeForChangedPaths(changedPaths);
  yield* Console.log(`[ci] docgen: auto-selected ${mode} from ${A.length(changedPaths)} changed path(s)`);
  return mode;
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
  const steps = ciLaneStepsForTesting(repoRoot, laneId, resolvedOptions);
  if (A.isReadonlyArrayEmpty(steps)) {
    yield* Console.log(`[ci] ${laneId}: no steps for this configuration (skipped)`);
    return;
  }

  yield* runQualityTaskStreamingStepGroup(`ci:${laneId}`, steps);
});

const DOCTEST_WORKSPACE_PATHS = [
  ":(glob)packages/**/package.json",
  ":(glob)apps/**/package.json",
  ":(glob)packages/**/src/**/*.ts",
  ":(glob)packages/**/src/**/*.tsx",
  ":(glob)apps/**/src/**/*.ts",
  ":(glob)apps/**/src/**/*.tsx",
] as const;

const isDoctestPackageInput = (packageDir: string, file: string): boolean => {
  const prefix = `${packageDir}/`;
  if (!Str.startsWith(prefix)(file)) return false;
  const relativePath = Str.slice(Str.length(prefix))(file);
  return (
    Str.startsWith("src/")(relativePath) ||
    relativePath === "package.json" ||
    relativePath === "docgen.json" ||
    O.isSome(Str.match(/^tsconfig(?:\..*)?\.json$/u)(relativePath))
  );
};

const packageDependencies = (manifest: {
  readonly dependencies: O.Option<Readonly<Record<string, string>>>;
  readonly devDependencies: O.Option<Readonly<Record<string, string>>>;
  readonly peerDependencies: O.Option<Readonly<Record<string, string>>>;
}): ReadonlyArray<string> =>
  pipe(
    [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies],
    A.flatMap(O.match({ onNone: A.empty<string>, onSome: R.keys })),
    A.filter(Str.startsWith("@beep/")),
    A.dedupe
  );

const expandDoctestDependents = (
  changedPackageNames: HashSet.HashSet<string>,
  workspaces: ReadonlyArray<readonly [name: string, dir: string, dependencies: ReadonlyArray<string>]>
): HashSet.HashSet<string> => {
  let affected = changedPackageNames;
  let priorSize = -1;
  while (HashSet.size(affected) !== priorSize) {
    priorSize = HashSet.size(affected);
    affected = A.reduce(workspaces, affected, (selected, [name, , dependencies]) =>
      A.some(dependencies, (dependency) => HashSet.has(selected, dependency)) ? HashSet.add(selected, name) : selected
    );
  }
  return affected;
};

const byDoctestWorkspaceDirLengthDescending: Order.Order<
  readonly [name: string, dir: string, dependencies: ReadonlyArray<string>]
> = Order.mapInput(Order.Number, ([, dir]) => -Str.length(dir));

const resolveDeletedDoctestManifestRevision = Effect.fn("CiLane.resolveDeletedDoctestManifestRevision")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<string, never, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runCaptured({
    command: "git",
    args: ["merge-base", base, "HEAD"],
    cwd: repoRoot,
    source: "stdout",
    trim: true,
  }).pipe(
    Effect.map((result) =>
      pipe(
        result.output,
        O.liftPredicate(Str.isNonEmpty),
        O.filter(() => result.exitCode === 0),
        O.getOrElse(() => base)
      )
    ),
    Effect.orElseSucceed(() => base)
  );
});

const resolveAffectedDoctestFiles = Effect.fn("CiLane.resolveAffectedDoctestFiles")(function* (
  repoRoot: string,
  base: string,
  head: string
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, CiLaneEnvironment> {
  const result = yield* runCaptured({
    command: "git",
    args: ["diff", "--name-only", `${base}...${head}`, "--", "packages", "apps"],
    cwd: repoRoot,
    source: "stdout",
  }).pipe(CiCommandError.mapError("Failed to resolve affected Doctest source files."));
  if (result.exitCode !== 0) {
    return yield* CiCommandError.make({ message: `git diff for Doctest failed with exit code ${result.exitCode}.` });
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const changedPaths = normalizedOutputPaths(result.output);
  if (A.isReadonlyArrayEmpty(changedPaths)) return A.empty<string>();

  const trackedResult = yield* runCaptured({
    command: "git",
    args: ["ls-files", "--", ...DOCTEST_WORKSPACE_PATHS],
    cwd: repoRoot,
    source: "stdout",
  }).pipe(CiCommandError.mapError("Failed to resolve Doctest workspace files."));
  if (trackedResult.exitCode !== 0) {
    return yield* CiCommandError.make({
      message: `git ls-files for Doctest failed with exit code ${trackedResult.exitCode}.`,
    });
  }
  const trackedPaths = normalizedOutputPaths(trackedResult.output);
  const manifestPaths = A.filter(trackedPaths, Str.endsWith("/package.json"));
  const workspaces = yield* Effect.forEach(manifestPaths, (manifestPath) =>
    readPackageJsonFile(path.join(repoRoot, manifestPath)).pipe(
      Effect.map(
        (manifest) =>
          [manifest.name, normalizeSlashes(path.dirname(manifestPath)), packageDependencies(manifest)] as const
      ),
      CiCommandError.mapError(`Failed to read Doctest workspace manifest ${manifestPath}.`)
    )
  );
  const orderedWorkspaces = A.sort(workspaces, byDoctestWorkspaceDirLengthDescending);
  const changedManifestPaths = A.filter(changedPaths, Str.endsWith("/package.json"));
  const deletedPackageDirs = A.map(changedManifestPaths, path.dirname);
  const deletedManifestPaths = A.filter(
    changedManifestPaths,
    (manifestPath) => !A.contains(manifestPaths, manifestPath)
  );
  const deletedManifestRevision = yield* pipe(
    deletedManifestPaths,
    A.match({
      onEmpty: () => Effect.succeed(base),
      onNonEmpty: () => resolveDeletedDoctestManifestRevision(repoRoot, base),
    })
  );
  const deletedPackageNames = yield* Effect.forEach(deletedManifestPaths, (manifestPath) =>
    runCaptured({
      command: "git",
      args: ["show", `${deletedManifestRevision}:${manifestPath}`],
      cwd: repoRoot,
      source: "stdout",
    }).pipe(
      CiCommandError.mapError(`Failed to read deleted Doctest workspace manifest ${manifestPath}.`),
      Effect.flatMap((baseManifestResult) => {
        if (baseManifestResult.exitCode !== 0) {
          return Console.log(
            `[ci] doctest: skipped deleted workspace manifest ${manifestPath} (git show exited ${baseManifestResult.exitCode})`
          ).pipe(Effect.as(O.none<string>()));
        }
        return UnknownFromJsonString.decodeUnknownEffect(baseManifestResult.output).pipe(
          Effect.flatMap(decodePackageJsonEffect),
          Effect.map((manifest) => O.some(manifest.name)),
          Effect.catch(() =>
            Console.log(
              `[ci] doctest: skipped deleted workspace manifest ${manifestPath} (base content did not decode)`
            ).pipe(Effect.as(O.none<string>()))
          )
        );
      })
    )
  ).pipe(Effect.map(A.getSomes));
  const changedPackageNames = HashSet.fromIterable(
    A.appendAll(
      A.flatMap(changedPaths, (file) => {
        const directOwner = A.findFirst(orderedWorkspaces, ([, packageDir]) => isDoctestPackageInput(packageDir, file));
        const deletedPackageOwner = pipe(
          orderedWorkspaces,
          A.findFirst(([, packageDir]) => Str.startsWith(`${packageDir}/`)(file)),
          O.filter(() =>
            A.some(
              deletedPackageDirs,
              (deletedPackageDir) =>
                file === `${deletedPackageDir}/package.json` || Str.startsWith(`${deletedPackageDir}/`)(file)
            )
          )
        );
        return pipe(
          directOwner,
          O.orElse(() => deletedPackageOwner),
          O.match({ onNone: A.empty<string>, onSome: ([name]) => [name] })
        );
      }),
      deletedPackageNames
    )
  );
  const affectedPackageNames = expandDoctestDependents(changedPackageNames, workspaces);
  const affectedPackageDirs = pipe(
    workspaces,
    A.filter(([name]) => HashSet.has(affectedPackageNames, name)),
    A.map(([, packageDir]) => packageDir)
  );
  const directlyChangedSources = A.filter(changedPaths, isDoctestSourcePath);
  const packageSources = pipe(
    trackedPaths,
    A.filter(isDoctestSourcePath),
    A.filter((file) => A.some(affectedPackageDirs, (packageDir) => Str.startsWith(`${packageDir}/src/`)(file)))
  );
  const candidates = pipe(A.appendAll(directlyChangedSources, packageSources), A.dedupe, A.sort(Order.String));
  const existingCandidates = yield* Effect.filter(candidates, (file) =>
    fs
      .exists(path.join(repoRoot, file))
      .pipe(CiCommandError.mapError(`Failed to inspect affected Doctest path ${file}.`))
  );
  return yield* Effect.filter(existingCandidates, (file) =>
    fs
      .readFileString(path.join(repoRoot, file))
      .pipe(Effect.map(Str.includes("import.meta.vitest")), Effect.orElseSucceed(thunkFalse))
  );
});

const runCiDoctestLane = Effect.fn("CiLane.runCiDoctestLane")(function* (
  repoRoot: string,
  options: CiLaneRunOptions
): Effect.fn.Return<void, CiCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed, CiLaneEnvironment> {
  const files = yield* DocgenLaneMode.$match(options.mode, {
    auto: () => Effect.asSome(resolveAffectedDoctestFiles(repoRoot, options.base, options.head)),
    none: () => Effect.succeed(O.none<ReadonlyArray<string>>()),
    affected: () => Effect.asSome(resolveAffectedDoctestFiles(repoRoot, options.base, options.head)),
    full: () => Effect.succeed(O.none<ReadonlyArray<string>>()),
  });
  const steps =
    options.mode === "none" ? A.empty<QualityTaskStep>() : doctestStepForTesting(repoRoot, O.getOrUndefined(files));
  if (A.isReadonlyArrayEmpty(steps)) {
    yield* Console.log("[ci] doctest: no marked affected source files (skipped)");
    return;
  }
  yield* runQualityTaskStreamingStepGroup("ci:doctest", steps);
});

/**
 * Run a CI lane body exactly as hosted CI would.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { CiLaneRunOptions, runCiLane } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 *
 * const program = runCiLane("knip", CiLaneRunOptions.make({
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
): Effect.fn.Return<void, CiCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed, CiLaneEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));

  yield* pipe(
    Match.value(laneId),
    Match.when("doctest", () => runCiDoctestLane(repoRoot, options)),
    Match.when("fallow", () => runCiFallowLane(repoRoot, options)),
    Match.orElse((stepLaneId) => runCiStepLane(repoRoot, stepLaneId, options))
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

const reportCiCommandError = (error: CiCommandError) =>
  Console.error(`[ci] ${error.message}`).pipe(Effect.andThen(failWithReportedExit(`[ci] ${error.message}`)));

/**
 * `beep ci lane` command: run one CI lane body or list the lane inventory.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { ciLaneCommand } from "@beep/repo-cli/commands/Ci"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
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
    affected: Flag.boolean("affected").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Run the turbo-backed lane in CI's --affected pull-request shape")
    ),
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for affected/docgen/fallow/commitlint shapes")
    ),
    head: Flag.string("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head git ref for docgen shapes")),
    summarize: Flag.boolean("summarize").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Pass --summarize to the turbo-backed lane (CI always does)")
    ),
    mode: Flag.choiceWithValue("mode", docgenModeFlagChoices).pipe(
      Flag.withDefault("auto"),
      Flag.withDescription("Docgen lane mode; auto derives none/affected/full from --base...--head")
    ),
    from: Flag.string("from").pipe(Flag.withDescription("Commitlint range start (defaults to --base)"), Flag.optional),
    to: Flag.string("to").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Commitlint range end")),
    last: Flag.boolean("last").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Lint only the last commit (commitlint --last)")
    ),
    changesetStatus: Flag.boolean("changeset-status").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Also run the changeset status check (CI passes this on pull requests)")
    ),
    validateEnvelopes: Flag.boolean("validate-envelopes").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Also replay the fallow envelope validation steps locally")
    ),
    runs: Flag.string("runs").pipe(
      Flag.withDefault("400"),
      Flag.withDescription("BEEP_FC_NUM_RUNS floor for the property lane (values only raise, never lower)")
    ),
    seed: Flag.string("seed").pipe(
      Flag.withDefault(DEFAULT_PROPERTY_LANE_SEED),
      Flag.withDescription("BEEP_FC_SEED for the property lane; a fixed seed makes local and CI test identical inputs")
    ),
    filter: Flag.string("filter").pipe(
      Flag.withDescription("Pass one package filter to the Turbo invocation inside the selected lane"),
      Flag.optional
    ),
    list: Flag.boolean("list").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the machine-readable lane inventory and exit")
    ),
    lane: Argument.choice("lane", CI_LANE_ID_VALUES).pipe(
      Argument.withDescription("CI lane id to run"),
      Argument.optional
    ),
  },
  ({
    affected,
    base,
    changesetStatus,
    filter,
    from,
    head,
    lane,
    last,
    list,
    mode,
    runs,
    seed,
    summarize,
    to,
    validateEnvelopes,
  }) => {
    const options = CiLaneRunOptions.make({
      affected,
      base,
      head,
      summarize,
      mode,
      ...O.getSomesStruct({ filter, from }),
      to,
      last,
      changesetStatus,
      validateEnvelopes,
      runs,
      seed,
    });

    if (list) {
      return printCiLaneList().pipe(Effect.catchTag("CiCommandError", reportCiCommandError));
    }

    return O.match(lane, {
      onNone: () =>
        reportCiCommandError(
          CiCommandError.make({ message: "Specify a lane id or pass --list. See beep ci lane --list." })
        ),
      onSome: (laneId) => runCiLane(laneId, options).pipe(Effect.catchTag("CiCommandError", reportCiCommandError)),
    });
  }
).pipe(Command.withDescription("Run one check.yml CI lane body exactly as hosted CI does"));

const CI_LOCAL_DEFAULT_LANES: ReadonlyArray<CiLaneId> = [
  "commitlint",
  "repo-sanity",
  "lint-policy",
  "lint",
  "check",
  "codegen",
  "knip",
  "jsdoc-ratchet",
  "secrets",
  "sast",
  "security",
  "build",
  "test-unit",
  "ecosystem",
  "labs",
  "test-integration",
  "property",
  "docgen",
  "doctest",
  "coverage",
  "desktop-ipc",
  "fallow",
  "nix",
];

const CI_LOCAL_FAST_SKIPS: ReadonlyArray<CiLaneId> = ["coverage", "test-integration", "nix"];

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

const currentGitBranch = Effect.fn("CiLane.currentGitBranch")(function* (
  repoRoot: string
): Effect.fn.Return<string, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "git",
    args: ["branch", "--show-current"],
    cwd: repoRoot,
    source: "stdout",
    trim: true,
  }).pipe(CiCommandError.mapError("Failed to resolve the current git branch."));
  if (result.exitCode !== 0) {
    return yield* CiCommandError.make({
      message: `git branch --show-current failed with exit code ${result.exitCode}.`,
    });
  }
  return result.output;
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
export class CiLocalStepPlan extends S.Class<CiLocalStepPlan>($I`CiLocalStepPlan`)(
  {
    affected: S.Boolean,
    base: S.String,
    onMainBranch: S.Boolean,
  },
  $I.annote("CiLocalStepPlan", {
    description: "Resolved shape for planning the local battery's lane dispatch steps.",
  })
) {}

const ciLocalLaneFlags = (laneId: CiLaneId, plan: CiLocalStepPlan): ReadonlyArray<string> => {
  const affectedFlags = plan.affected ? ["--affected", "--base", plan.base] : A.empty<string>();
  // check.yml gives every Turbo-backed matrix lane `--summarize` as well as the
  // affected shape. It only writes gitignored `.turbo/runs/*.json` receipts, so
  // replaying it locally costs nothing and keeps the dispatched argv identical
  // to the hosted one.
  const turboShapeFlags = [...affectedFlags, "--summarize"];

  return CiLaneId.$match(laneId, {
    build: A.empty<string>,
    check: () => turboShapeFlags,
    codegen: A.empty<string>,
    commitlint: () => ["--from", plan.base],
    coverage: () => turboShapeFlags,
    "desktop-ipc": A.empty<string>,
    docgen: () => ["--mode", plan.affected ? "auto" : "full", "--base", plan.base],
    doctest: () => ["--mode", plan.affected ? "affected" : "full", "--base", plan.base],
    ecosystem: A.empty<string>,
    fallow: () => ["--base", plan.base, "--validate-envelopes"],
    "jsdoc-ratchet": A.empty<string>,
    knip: A.empty<string>,
    labs: A.empty<string>,
    lint: () => turboShapeFlags,
    "lint-policy": A.empty<string>,
    nix: A.empty<string>,
    property: () => turboShapeFlags,
    "repo-sanity": () => (plan.onMainBranch ? A.empty<string>() : ["--changeset-status"]),
    sast: A.empty<string>,
    secrets: A.empty<string>,
    security: A.empty<string>,
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
 *   ["knip"],
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
 * Run the faithful local CI battery: every locally-runnable check.yml lane.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { runCiLocal } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
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

  yield* runQualityTaskStreamingStepGroup("ci:local", steps);
});

/**
 * `beep ci local` command: replay the locally-runnable CI battery.
 *
 * **Example** (Configure a CI lane)
 *
 * ```ts
 * import { ciLocalCommand } from "@beep/repo-cli/commands/Ci"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
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
    affected: Flag.boolean("affected").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Replay CI's pull-request --affected shape instead of full runs")
    ),
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for affected/docgen/fallow/commitlint shapes")
    ),
    fast: Flag.boolean("fast").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the slow lanes: coverage, test-integration, nix")
    ),
    lanes: Flag.string("lanes").pipe(
      Flag.withDescription("Comma-separated lane ids to run (default: the full battery)"),
      Flag.optional
    ),
  },
  ({ affected, base, fast, lanes }) =>
    runCiLocal({ affected, base, fast, lanes }).pipe(Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Run the locally-runnable CI battery from the same lane definitions as hosted CI"));
