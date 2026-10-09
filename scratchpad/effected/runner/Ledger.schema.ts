/**
 * Schemas for the effected-port ledger: the resumable truth of which module
 * stands at which stage, what it must export, and what it owes.
 *
 * **Details**
 *
 * The ledger is a committed JSON file (`scratchpad/effected/PORT_LEDGER.json`).
 * Every read decodes through {@link Ledger}; every write encodes through
 * {@link LedgerJson}, so a hand edit that breaks the shape fails at the next
 * runner invocation rather than silently drifting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/runner/Ledger.schema");

/**
 * The twenty-nine module names the port tracks, in ledger order (wave, then
 * position inside the wave).
 *
 * **Example** (Count the roster)
 *
 * ```ts
 * import { MODULE_NAMES } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(MODULE_NAMES.length) // 29
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MODULE_NAMES = [
  "jsonl",
  "jsonc",
  "memfs",
  "yaml",
  "toml",
  "glob",
  "semver",
  "spdx",
  "schema-org",
  "github-references",
  "github-commands",
  "commands",
  "templates",
  "env",
  "engine",
  "git",
  "walker",
  "npm",
  "markdown",
  "github",
  "lockfiles",
  "tsconfig-json",
  "config-file",
  "package-json",
  "xdg",
  "sbom",
  "workspaces",
  "cli",
  "github-actions",
] as const;

/**
 * The literal domain of ported module names.
 *
 * **Example** (Guard a module name)
 *
 * ```ts
 * import { ModuleName } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(ModuleName.is.yaml("yaml")) // true
 * console.log(ModuleName.is.yaml("toml")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ModuleName = LiteralKit(MODULE_NAMES).annotate(
  $I.annote("ModuleName", { description: "One of the 29 @effected modules the lab ports." })
);

/**
 * The union of ported module name literals.
 *
 * @see {@link ModuleName} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ModuleName = typeof ModuleName.Type;

/**
 * The runner itself is audited like a module but has no upstream and no ledger
 * row; this literal names that pseudo-target.
 *
 * **Example** (Name the runner target)
 *
 * ```ts
 * import { RUNNER_TARGET } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(RUNNER_TARGET) // "runner"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNNER_TARGET = "runner";

/**
 * Every name the audit subcommands accept: the 29 modules plus the runner.
 *
 * **Example** (List the audit targets)
 *
 * ```ts
 * import { AUDIT_TARGETS } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(AUDIT_TARGETS.length) // 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AUDIT_TARGETS = [...MODULE_NAMES, RUNNER_TARGET] as const;

/**
 * The literal domain of audit targets.
 *
 * **Example** (Tell the runner apart from a module)
 *
 * ```ts
 * import { AuditTarget } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(AuditTarget.is.runner("runner")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuditTarget = LiteralKit(AUDIT_TARGETS).annotate(
  $I.annote("AuditTarget", { description: "A ported module name or the runner pseudo-target." })
);

/**
 * The union of audit target literals.
 *
 * @see {@link AuditTarget} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type AuditTarget = typeof AuditTarget.Type;

/**
 * The stage ladder every module climbs: 0 copy, 1 green, 2 documented,
 * 3 covered, 4 reviewed, 5 done.
 *
 * **Example** (Check a stage value)
 *
 * ```ts
 * import { Stage } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(Stage.is.number5(5)) // true
 * console.log(Stage.is.number5(6)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Stage = LiteralKit([0, 1, 2, 3, 4, 5]).annotate(
  $I.annote("Stage", { description: "Port stage reached by a module, 0 (copied) through 5 (done)." })
);

/**
 * The union of stage literals.
 *
 * @see {@link Stage} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type Stage = typeof Stage.Type;

/**
 * The stage after `stage`, or none past the final stage.
 *
 * **Example** (Advance a stage)
 *
 * ```ts
 * import { nextStage } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(nextStage(2))) // 3
 * console.log(O.isNone(nextStage(5))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const nextStage = (stage: Stage): O.Option<Stage> =>
  Stage.$match(stage, {
    number0: () => O.some<Stage>(1),
    number1: () => O.some<Stage>(2),
    number2: () => O.some<Stage>(3),
    number3: () => O.some<Stage>(4),
    number4: () => O.some<Stage>(5),
    number5: O.none<Stage>,
  });

/**
 * The final stage, at which a row is done.
 *
 * **Example** (Compare against the final stage)
 *
 * ```ts
 * import { DONE_STAGE } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(DONE_STAGE) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DONE_STAGE: Stage = 5;

/**
 * Lifecycle status of a ledger row.
 *
 * **Example** (Guard a status)
 *
 * ```ts
 * import { RowStatus } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(RowStatus.is.blocked("blocked")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RowStatus = LiteralKit(["pending", "in-progress", "done", "blocked"]).annotate(
  $I.annote("RowStatus", { description: "Whether a module is untouched, moving, done, or blocked." })
);

/**
 * The union of row status literals.
 *
 * @see {@link RowStatus} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type RowStatus = typeof RowStatus.Type;

/**
 * The facets an export name carries: a runtime value, a type, or both (a
 * class, or a value paired with a same-name type alias).
 *
 * **Details**
 *
 * The superset export rule (D2) compares facets: the lab must export every
 * upstream name with at least the upstream facets, so `both` satisfies
 * `value` and `type`, while `value` alone does not satisfy `type`.
 *
 * **Example** (Guard a kind)
 *
 * ```ts
 * import { ExportKind } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(ExportKind.is.both("both")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExportKind = LiteralKit(["value", "type", "both"]).annotate(
  $I.annote("ExportKind", { description: "Value, type, or both facets of one export name." })
);

/**
 * The union of export kind literals.
 *
 * @see {@link ExportKind} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ExportKind = typeof ExportKind.Type;

/**
 * Whether the facets `actual` cover the facets `expected` demands.
 *
 * **Example** (Compare facets)
 *
 * ```ts
 * import { exportKindCovers } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * import { pipe } from "effect/Function"
 *
 * console.log(exportKindCovers("both", "type")) // true
 * console.log(exportKindCovers("value", "type")) // false
 * console.log(pipe("type", exportKindCovers("type"))) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const exportKindCovers: {
  (expected: ExportKind): (actual: ExportKind) => boolean;
  (actual: ExportKind, expected: ExportKind): boolean;
} = dual(
  2,
  (actual: ExportKind, expected: ExportKind): boolean =>
    ExportKind.$match(actual, {
      both: () => true,
      value: () => ExportKind.is.value(expected),
      type: () => ExportKind.is.type(expected),
    })
);

/**
 * Runtime versus development (oracle) dependency.
 *
 * **Example** (Guard a dependency kind)
 *
 * ```ts
 * import { DepKind } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(DepKind.is.dev("dev")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DepKind = LiteralKit(["runtime", "dev"]).annotate(
  $I.annote("DepKind", { description: "Runtime dependency or test-only oracle dependency." })
);

/**
 * The union of dependency kind literals.
 *
 * @see {@link DepKind} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type DepKind = typeof DepKind.Type;

/**
 * The three read-only reviewer seats of the S4 loop.
 *
 * **Example** (Guard a seat)
 *
 * ```ts
 * import { ReviewSeat } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(ReviewSeat.is.fable("fable")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewSeat = LiteralKit(["grok", "sol", "fable"]).annotate(
  $I.annote("ReviewSeat", { description: "Reviewer seat: Grok 4.7, GPT-6.1-Sol, or Fable 5.1." })
);

/**
 * The union of reviewer seat literals.
 *
 * @see {@link ReviewSeat} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ReviewSeat = typeof ReviewSeat.Type;

/**
 * The provisional beep home recorded per module (D12), re-grilled at promotion.
 *
 * **Example** (Guard a home)
 *
 * ```ts
 * import { ProvisionalHome } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(ProvisionalHome.is.drivers("drivers")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvisionalHome = LiteralKit(["foundation/modeling", "tooling/test-kit", "tooling/library", "drivers"]).annotate(
  $I.annote("ProvisionalHome", { description: "Provisional package family a module would promote into." })
);

/**
 * The union of provisional home literals.
 *
 * @see {@link ProvisionalHome} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ProvisionalHome = typeof ProvisionalHome.Type;

/**
 * One export name with its facets and the entry (`.` or a subpath) it is
 * reachable from.
 *
 * **Example** (Describe an export)
 *
 * ```ts
 * import { ExportEntry } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const entry = ExportEntry.make({ name: "Yaml", kind: "value", entry: "." })
 * console.log(entry.name) // "Yaml"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportEntry extends S.Class<ExportEntry>($I`ExportEntry`)(
  {
    name: S.NonEmptyString,
    kind: ExportKind,
    entry: S.NonEmptyString,
  },
  $I.annote("ExportEntry", { description: "An exported name, its value/type facets, and its entry point." })
) {}

/**
 * A third-party dependency the port carries, with its Effect-native
 * replacement candidate (D3, section 13) or `null` for a permanent oracle.
 *
 * **Example** (Record an oracle dependency)
 *
 * ```ts
 * import { NewDep } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const dep = NewDep.make({ name: "minimatch", kind: "dev", spec: "^10.2.5", replacement: null })
 * console.log(dep.kind) // "dev"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NewDep extends S.Class<NewDep>($I`NewDep`)(
  {
    name: S.NonEmptyString,
    kind: DepKind,
    spec: S.NonEmptyString,
    replacement: S.NullOr(S.String),
  },
  $I.annote("NewDep", { description: "A dependency added for one module and its replacement candidate." })
) {}

/**
 * A recorded behaviour deviation from upstream (section 14): the adjusted
 * test, both behaviours, and the law or upstream-bug reason.
 *
 * **Example** (Record a law-driven deviation)
 *
 * ```ts
 * import { Deviation } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const deviation = Deviation.make({
 *   test: "scratchpad/test/jsonc/JsoncEdit.test.ts",
 *   upstreamBehaviour: "applyAll throws on overlap",
 *   labBehaviour: "applyAll fails with JsoncEditOverlapError",
 *   reason: "law:7",
 * })
 * console.log(deviation.reason) // "law:7"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Deviation extends S.Class<Deviation>($I`Deviation`)(
  {
    test: S.NonEmptyString,
    upstreamBehaviour: S.NonEmptyString,
    labBehaviour: S.NonEmptyString,
    reason: S.NonEmptyString,
  },
  $I.annote("Deviation", { description: "One observable difference from upstream and why it is allowed." })
) {}

/**
 * A reviewer finding parked as backlog rather than required (D11).
 *
 * **Example** (Park a finding)
 *
 * ```ts
 * import { BacklogItem } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const item = BacklogItem.make({ seat: "grok", round: 1, finding: "prefer Str.split", reason: "style only" })
 * console.log(item.round) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BacklogItem extends S.Class<BacklogItem>($I`BacklogItem`)(
  {
    seat: ReviewSeat,
    round: S.Int,
    finding: S.NonEmptyString,
    reason: S.NonEmptyString,
  },
  $I.annote("BacklogItem", { description: "A non-required reviewer finding and why it was parked." })
) {}

/**
 * Required and backlog counts one seat reported in one round.
 *
 * **Example** (Count a seat's findings)
 *
 * ```ts
 * import { SeatCounts } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const counts = SeatCounts.make({ required: 0, backlog: 3 })
 * console.log(counts.required) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SeatCounts extends S.Class<SeatCounts>($I`SeatCounts`)(
  {
    required: S.Int,
    backlog: S.Int,
  },
  $I.annote("SeatCounts", { description: "Required and backlog finding counts for one seat." })
) {}

/**
 * A seat's verdict for a round: its counts, or `unavailable` when quota or
 * availability kept it from reporting (section 12.2).
 *
 * **Example** (Decode an unavailable seat)
 *
 * ```ts
 * import { SeatVerdict } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(SeatVerdict)("unavailable")) // "unavailable"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SeatVerdict = S.Union([SeatCounts, S.Literal("unavailable")]).annotate(
  $I.annote("SeatVerdict", { description: "A seat's finding counts, or unavailable for that round." })
);

/**
 * The decoded seat verdict.
 *
 * @see {@link SeatVerdict} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type SeatVerdict = typeof SeatVerdict.Type;

/**
 * One S4 review round: the commit the seats read and each seat's verdict.
 *
 * **Example** (Record a closing round)
 *
 * ```ts
 * import { ReviewRound } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const round = ReviewRound.make({
 *   round: 1,
 *   commit: "abc123",
 *   seats: { grok: { required: 0, backlog: 1 }, sol: { required: 0, backlog: 0 }, fable: { required: 0, backlog: 2 } },
 * })
 * console.log(round.seats.grok) // { required: 0, backlog: 1 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRound extends S.Class<ReviewRound>($I`ReviewRound`)(
  {
    round: S.Int,
    commit: S.NonEmptyString,
    seats: S.Struct({ grok: SeatVerdict, sol: SeatVerdict, fable: SeatVerdict }),
  },
  $I.annote("ReviewRound", { description: "One review round and the three seat verdicts on one commit." })
) {}

/**
 * The commit that closed one stage; `null` until the commit exists and a
 * later ledger write backfills it from `git log`.
 *
 * **Example** (Record a pending stage commit)
 *
 * ```ts
 * import { StageCommit } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const commit = StageCommit.make({ stage: 0, sha: null })
 * console.log(commit.sha) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StageCommit extends S.Class<StageCommit>($I`StageCommit`)(
  {
    stage: Stage,
    sha: S.NullOr(S.NonEmptyString),
  },
  $I.annote("StageCommit", { description: "The commit sha that closed a stage, backfilled from git." })
) {}

/**
 * Why a row stopped: the stage it could not leave and the open findings.
 *
 * **Example** (Block a row)
 *
 * ```ts
 * import { BlockedState } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const blocked = BlockedState.make({ stage: 4, reason: "review-limit", findings: ["sol-5-2"] })
 * console.log(blocked.findings.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockedState extends S.Class<BlockedState>($I`BlockedState`)(
  {
    stage: Stage,
    reason: S.NonEmptyString,
    findings: S.Array(S.String),
  },
  $I.annote("BlockedState", { description: "The stage a module is stuck at and its remaining findings." })
) {}

/**
 * Where the module's source and tests live in the upstream checkout.
 *
 * **Example** (Point at upstream)
 *
 * ```ts
 * import { UpstreamPaths } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const paths = UpstreamPaths.make({ src: "packages/yaml/src", test: "packages/yaml/__test__" })
 * console.log(paths.src) // "packages/yaml/src"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpstreamPaths extends S.Class<UpstreamPaths>($I`UpstreamPaths`)(
  {
    src: S.NonEmptyString,
    test: S.NonEmptyString,
  },
  $I.annote("UpstreamPaths", { description: "Upstream-relative source and test directories of a module." })
) {}

/**
 * One module's row: its place in the waves, its stage, its export contract,
 * its dependencies, and every recorded decision.
 *
 * **Example** (Build a pending row)
 *
 * ```ts
 * import { LedgerRow } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const row = LedgerRow.make({
 *   id: "w1-memfs",
 *   module: "memfs",
 *   wave: 1,
 *   position: 1,
 *   stage: 0,
 *   status: "pending",
 *   provisionalHome: "tooling/test-kit",
 *   upstreamPaths: { src: "packages/memfs/src", test: "packages/memfs/__test__" },
 *   exportsExpected: [],
 *   exportsAdded: [],
 *   newDeps: [],
 *   fixturesBytes: 0,
 *   deviations: [],
 *   backlog: [],
 *   reviewRounds: [],
 *   commits: [],
 *   blocked: null,
 *   notes: [],
 *   closedAt: null,
 * })
 * console.log(row.status) // "pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerRow extends S.Class<LedgerRow>($I`LedgerRow`)(
  {
    id: S.NonEmptyString,
    module: ModuleName,
    wave: S.Int,
    position: S.Int,
    stage: Stage,
    status: RowStatus,
    provisionalHome: ProvisionalHome,
    upstreamPaths: UpstreamPaths,
    exportsExpected: S.Array(ExportEntry),
    exportsAdded: S.Array(ExportEntry),
    newDeps: S.Array(NewDep),
    fixturesBytes: S.Int,
    deviations: S.Array(Deviation),
    backlog: S.Array(BacklogItem),
    reviewRounds: S.Array(ReviewRound),
    commits: S.Array(StageCommit),
    blocked: S.NullOr(BlockedState),
    notes: S.Array(S.String),
    closedAt: S.NullOr(S.String),
  },
  $I.annote("LedgerRow", { description: "The resumable state of one module's port." })
) {}

/**
 * The most recent ledger transition, for the resume protocol.
 *
 * **Example** (Record a checkpoint)
 *
 * ```ts
 * import { LedgerCheckpoint } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const checkpoint = LedgerCheckpoint.make({ module: "jsonl", stage: 1, commit: "abc", at: "2026-10-07T00:00:00.000Z" })
 * console.log(checkpoint.stage) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerCheckpoint extends S.Class<LedgerCheckpoint>($I`LedgerCheckpoint`)(
  {
    module: ModuleName,
    stage: Stage,
    commit: S.NullOr(S.NonEmptyString),
    at: S.NonEmptyString,
  },
  $I.annote("LedgerCheckpoint", { description: "The last module, stage and commit the ledger recorded." })
) {}

/**
 * The whole ledger: header provenance plus one row per module.
 *
 * **Example** (Build an empty ledger)
 *
 * ```ts
 * import { Ledger } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * const ledger = Ledger.make({
 *   version: 1,
 *   effectedCommit: "af7566a9da2eff169cb74955efcc5ede1e5de9f8",
 *   startedAt: "2026-10-07T00:00:00.000Z",
 *   lastCheckpoint: null,
 *   rows: [],
 *   notes: [],
 * })
 * console.log(ledger.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Ledger extends S.Class<Ledger>($I`Ledger`)(
  {
    version: S.Literal(1),
    effectedCommit: S.NonEmptyString,
    startedAt: S.NonEmptyString,
    lastCheckpoint: S.NullOr(LedgerCheckpoint),
    rows: S.Array(LedgerRow),
    notes: S.Array(S.String),
  },
  $I.annote("Ledger", { description: "The effected-port ledger: provenance header and per-module rows." })
) {}

/**
 * The ledger as a two-space-indented JSON document, the on-disk form.
 *
 * **Example** (Round-trip a ledger through JSON)
 *
 * ```ts
 * import { Ledger, LedgerJson } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import * as S from "effect/Schema"
 *
 * const ledger = Ledger.make({
 *   version: 1,
 *   effectedCommit: "abc",
 *   startedAt: "2026-10-07T00:00:00.000Z",
 *   lastCheckpoint: null,
 *   rows: [],
 *   notes: [],
 * })
 * const text = S.encodeSync(LedgerJson)(ledger)
 * console.log(S.decodeUnknownSync(LedgerJson)(text).effectedCommit) // "abc"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LedgerJson = S.fromJsonString(Ledger, { space: 2 });
