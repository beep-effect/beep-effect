/**
 * Schemas for the verification route: the change taxonomy, the per-lane
 * footprint, the route plan, the hosted corpus, and the census and replay
 * reports (`goals/verification-route`, slice 1).
 *
 * **Details**
 *
 * `classify` is total: every hunk becomes a {@link ChangeAtom}, and a hunk the
 * taxonomy cannot place is `unknown`, never an error. A {@link CheckFootprint}
 * names the atom kinds that can change one lane's verdict; `unknown` is on
 * every footprint, so at the all-`unknown` record the route equals "run every
 * lane". The route selects lanes and never reorders them: ordering stays with
 * `WaveOrder` (time-to-certainty rulings 76–79).
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { OpaqueDefect } from "../../internal/schema/OpaqueDefect.ts";
import { CiLaneId } from "./CiLane.ts";

const $I = $RepoCliId.create("commands/Ci/Route");

// An optional string that decodes from an absent key and constructs as None by default; the
// shape every optional text field of the route shares (owning package, detail, conclusion,
// timestamps, cost source).
const OptionalText = S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

/**
 * Literal values of {@link ChangeAtomKind}, in census order.
 *
 * **Example** (The domain ends with the catch-all)
 *
 * ```ts import.meta.vitest name="The domain ends with the catch-all"
 * import { CHANGE_ATOM_KIND_VALUES } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * A.contains(CHANGE_ATOM_KIND_VALUES, "unknown") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CHANGE_ATOM_KIND_VALUES = [
  "src:module",
  "src:test",
  "src:story",
  "src:generated",
  "pkg:dep-version",
  "pkg:dep-added",
  "pkg:dep-removed",
  "pkg:script",
  "pkg:exports",
  "pkg:catalog",
  "pkg:manifest-other",
  "cfg:turbo",
  "cfg:tsconfig",
  "cfg:biome",
  "cfg:lint-rules",
  "cfg:vitest",
  "cfg:workflow",
  "docs:markdown",
  "packet",
  "lockfile",
  "toolchain-pin",
  "env",
  "asset",
  "commits",
  "unknown",
] as const;

/**
 * The kind of one classified unit of a diff.
 *
 * **Details**
 *
 * Semantic kinds (`pkg:*`) come from field-level diffs of structured files;
 * path kinds come from the owning path family. `unknown` is the total
 * catch-all and maps to every lane (exploration ruling "atom grain").
 *
 * **Example** (Guard an atom kind)
 *
 * ```ts import.meta.vitest name="Guard an atom kind"
 * import { ChangeAtomKind } from "@beep/repo-cli/commands/Ci"
 *
 * ChangeAtomKind.is.unknown("unknown") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChangeAtomKind = LiteralKit(CHANGE_ATOM_KIND_VALUES).pipe(
  $I.annoteSchema("ChangeAtomKind", {
    description: "The kind of one classified unit of a diff; unknown is the total catch-all.",
  })
);

/**
 * Type of {@link ChangeAtomKind}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type ChangeAtomKind = typeof ChangeAtomKind.Type;

/**
 * One classified unit of a diff: its kind, the path it came from, the owning
 * workspace package when the path has one, a human-readable detail, and a
 * digest over the content that produced it.
 *
 * **Example** (Construct an atom)
 *
 * ```ts import.meta.vitest name="Construct an atom"
 * import { ChangeAtom } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const atom = ChangeAtom.make({
 *   kind: "pkg:catalog",
 *   path: "package.json",
 *   detail: O.some("catalog @biomejs/biome 2.5.6 -> 9.9.9"),
 *   digest: "0f0f",
 * })
 * O.isNone(atom.pkg) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangeAtom extends S.Opaque<ChangeAtom, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: ChangeAtomKind,
    path: S.NonEmptyString,
    pkg: OptionalText,
    detail: OptionalText,
    digest: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ChangeAtom", {
      description: "One classified unit of a diff with its kind, path, owning package, detail and digest.",
    })
  )
) {}

/**
 * The classified diff of one head against its merge base.
 *
 * **Example** (An empty change set)
 *
 * ```ts import.meta.vitest name="An empty change set"
 * import { ChangeSet } from "@beep/repo-cli/commands/Ci"
 *
 * const empty = ChangeSet.make({ base: "aaaa", head: "bbbb", changedPaths: [], atoms: [] })
 * empty.atoms.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangeSet extends S.Opaque<ChangeSet, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.NonEmptyString,
    head: S.NonEmptyString,
    changedPaths: S.Array(S.String),
    atoms: S.Array(ChangeAtom),
  }).pipe(
    $I.annoteSchema("ChangeSet", {
      description: "The classified diff of one head against its merge base: changed paths and atoms.",
    })
  )
) {}

/**
 * How an atom in one package reaches a lane's verdict on other packages
 * (exploration ruling "propagation grain").
 *
 * **Example** (Guard a propagation class)
 *
 * ```ts import.meta.vitest name="Guard a propagation class"
 * import { FootprintPropagation } from "@beep/repo-cli/commands/Ci"
 *
 * FootprintPropagation.is["reverse-deps"]("reverse-deps") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FootprintPropagation = LiteralKit(["none", "reverse-deps", "covered-pkgs"]).pipe(
  $I.annoteSchema("FootprintPropagation", {
    description:
      "none: the owning package only; reverse-deps: transitive dependents; covered-pkgs: packages whose coverage baseline the change can move.",
  })
);

/**
 * Type of {@link FootprintPropagation}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type FootprintPropagation = typeof FootprintPropagation.Type;

/**
 * The footprint of one lane: every atom kind that can change its verdict, how
 * the change propagates over the package graph, whether the lane writes the
 * tree, and the fixtures that prove each claimed absence.
 *
 * **Details**
 *
 * `kinds` must contain `unknown` (soundness: the catch-all reaches every lane)
 * and is checked at decode. A lane whose `kinds` is exactly the whole domain
 * is unrefined and selects on every change. `external` marks a lane whose
 * verdict reads inputs outside the head (an advisory feed, the clock, the
 * network); the route selects an external lane for every change, whatever
 * its atoms, because its verdict can flip with no change at all.
 *
 * **Example** (The unrefined footprint of a lane)
 *
 * ```ts import.meta.vitest name="The unrefined footprint of a lane"
 * import { CHANGE_ATOM_KIND_VALUES, CheckFootprint } from "@beep/repo-cli/commands/Ci"
 *
 * const lint = CheckFootprint.make({
 *   lane: "lint",
 *   kinds: CHANGE_ATOM_KIND_VALUES,
 *   propagation: "none",
 *   transformer: false,
 *   external: false,
 *   fixtures: [],
 *   basis: "unrefined",
 * })
 * lint.kinds.length === CHANGE_ATOM_KIND_VALUES.length // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckFootprint extends S.Opaque<CheckFootprint, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: CiLaneId,
    kinds: S.Array(ChangeAtomKind).check(
      S.makeFilter(
        (kinds) => A.contains(kinds, "unknown"),
        $I.annote("FootprintKinds", {
          title: "Footprint kinds",
          description: "The atom kinds that can change the lane's verdict; always includes unknown.",
          message: "A footprint must include the unknown kind.",
        })
      )
    ),
    propagation: FootprintPropagation,
    transformer: S.Boolean,
    external: S.Boolean,
    fixtures: S.Array(S.NonEmptyString),
    basis: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CheckFootprint", {
      description:
        "Atom kinds that can change one lane's verdict, its propagation class, transformer and external-input flags, and fixture refs.",
    })
  )
) {}

/**
 * One selected lane of a route plan and the atom kinds that selected it.
 *
 * **Example** (A lane selected by one atom kind)
 *
 * ```ts import.meta.vitest name="A lane selected by one atom kind"
 * import { RouteSelection } from "@beep/repo-cli/commands/Ci"
 *
 * const row = RouteSelection.make({ lane: "lint", selectedBy: ["cfg:biome"] })
 * row.lane // => "lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteSelection extends S.Opaque<RouteSelection, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: CiLaneId,
    selectedBy: S.Array(ChangeAtomKind),
  }).pipe(
    $I.annoteSchema("RouteSelection", {
      description: "A lane the route selects, with the atom kinds that selected it.",
    })
  )
) {}

/**
 * The route for one change: the atoms, the affected packages, the selected
 * lanes in wave order, the skipped lanes, and the digest of the footprint
 * record the plan was computed under.
 *
 * **Example** (A plan that selects nothing)
 *
 * ```ts import.meta.vitest name="A plan that selects nothing"
 * import { RoutePlan } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = RoutePlan.make({
 *   base: "aaaa",
 *   head: "bbbb",
 *   atoms: [],
 *   affectedPackages: [],
 *   selected: [],
 *   skipped: [],
 *   footprintDigest: "0000",
 * })
 * plan.selected.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RoutePlan extends S.Opaque<RoutePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.NonEmptyString,
    head: S.NonEmptyString,
    atoms: S.Array(ChangeAtom),
    affectedPackages: S.Array(S.String),
    selected: S.Array(RouteSelection),
    skipped: S.Array(CiLaneId),
    footprintDigest: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RoutePlan", {
      description: "The selected lanes for one change in wave order, the skipped lanes, and the footprint digest.",
    })
  )
) {}

/**
 * One hosted job of a captured run.
 *
 * **Example** (A finished hosted job)
 *
 * ```ts import.meta.vitest name="A finished hosted job"
 * import { HostedJob } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = HostedJob.make({ name: "Lint", conclusion: O.some("success") })
 * O.isNone(job.startedAt) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HostedJob extends S.Opaque<HostedJob, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    conclusion: OptionalText,
    startedAt: OptionalText,
    completedAt: OptionalText,
  }).pipe(
    $I.annoteSchema("HostedJob", {
      description: "One hosted job: its check name, conclusion and timestamps.",
    })
  )
) {}

/**
 * One captured hosted workflow run with its jobs, keyed by head sha.
 *
 * **Example** (A pull-request run with no jobs)
 *
 * ```ts import.meta.vitest name="A pull-request run with no jobs"
 * import { HostedRun } from "@beep/repo-cli/commands/Ci"
 *
 * const run = HostedRun.make({
 *   runId: 1,
 *   workflow: "Check",
 *   event: "pull_request",
 *   headBranch: "feat/x",
 *   headSha: "abcd",
 *   createdAt: "2026-10-28T00:00:00Z",
 *   attempt: 1,
 *   jobs: [],
 * })
 * run.jobs.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HostedRun extends S.Opaque<HostedRun, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: S.Int,
    workflow: S.NonEmptyString,
    event: S.NonEmptyString,
    headBranch: S.String,
    headSha: S.NonEmptyString,
    createdAt: S.NonEmptyString,
    conclusion: OptionalText,
    attempt: S.Int,
    jobs: S.Array(HostedJob),
  }).pipe(
    $I.annoteSchema("HostedRun", {
      description: "One captured hosted workflow run with its jobs, keyed by head sha.",
    })
  )
) {}

/**
 * The receipt pinning a captured corpus: window, counts and the sha256 of the
 * corpus file.
 *
 * **Example** (An empty corpus receipt)
 *
 * ```ts import.meta.vitest name="An empty corpus receipt"
 * import { RouteCorpusReceipt } from "@beep/repo-cli/commands/Ci"
 *
 * const receipt = RouteCorpusReceipt.make({
 *   schemaVersion: "route-corpus/v1",
 *   capturedAt: "2026-10-31T00:00:00Z",
 *   since: "2026-09-01",
 *   until: "2026-10-30",
 *   workflows: ["Check", "Heavy"],
 *   runs: 0,
 *   heads: 0,
 *   path: "goals/verification-route/research/corpus/hosted-runs.ndjson.gz",
 *   sha256: "00",
 * })
 * receipt.runs // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteCorpusReceipt extends S.Opaque<RouteCorpusReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("route-corpus/v1"),
    capturedAt: S.NonEmptyString,
    since: S.NonEmptyString,
    until: S.NonEmptyString,
    workflows: S.Array(S.NonEmptyString),
    runs: S.Int,
    heads: S.Int,
    path: S.NonEmptyString,
    sha256: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RouteCorpusReceipt", {
      description: "Digest-pinned receipt for a captured hosted-run corpus.",
    })
  )
) {}

/**
 * Where a lane's cost estimate comes from: the A1 gate-order seed row for its
 * `quality:*` twin, or nothing.
 *
 * **Example** (Guard a cost basis)
 *
 * ```ts import.meta.vitest name="Guard a cost basis"
 * import { RouteCostBasis } from "@beep/repo-cli/commands/Ci"
 *
 * RouteCostBasis.is["gate-order-seed"]("gate-order-seed") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RouteCostBasis = LiteralKit(["gate-order-seed", "hosted-median", "none"]).pipe(
  $I.annoteSchema("RouteCostBasis", {
    description: "gate-order-seed: the A1 seed row; hosted-median: the corpus's own job durations; none: no estimate.",
  })
);

/**
 * Type of {@link RouteCostBasis}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type RouteCostBasis = typeof RouteCostBasis.Type;

/**
 * The cost estimate the census uses for one lane and where it comes from.
 *
 * **Example** (A lane with no cost estimate)
 *
 * ```ts import.meta.vitest name="A lane with no cost estimate"
 * import { RouteLaneCost } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const cost = RouteLaneCost.make({ lane: "lint", basis: "none" })
 * O.isNone(cost.p50Ms) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteLaneCost extends S.Opaque<RouteLaneCost, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: CiLaneId,
    basis: RouteCostBasis,
    p50Ms: S.Int.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    source: OptionalText,
  }).pipe(
    $I.annoteSchema("RouteLaneCost", {
      description: "A lane's cost estimate, its basis and its source pointer.",
    })
  )
) {}

/**
 * One census row: for an atom kind and a lane, the hosted machine time spent
 * on heads whose atoms were only that kind (pure) and on heads containing it
 * (mixed).
 *
 * **Details**
 *
 * A pure row is the sound lower bound of what refining `kind` out of the
 * lane's footprint would have skipped; a mixed row is the upper bound.
 * Purity is judged over the head's tree kinds (its kinds without `commits`):
 * a tree kind is pure when it is the head's only tree kind, and `commits` is
 * pure only on a head with no tree kind; every other occurrence is mixed.
 *
 * **Example** (One pure head on one lane)
 *
 * ```ts import.meta.vitest name="One pure head on one lane"
 * import { RouteCensusRow } from "@beep/repo-cli/commands/Ci"
 *
 * const row = RouteCensusRow.make({
 *   kind: "packet",
 *   lane: "test-unit",
 *   pureHeads: 1,
 *   pureMs: 60000,
 *   mixedHeads: 0,
 *   mixedMs: 0,
 * })
 * row.pureMs // => 60000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteCensusRow extends S.Opaque<RouteCensusRow, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: ChangeAtomKind,
    lane: CiLaneId,
    pureHeads: S.Int,
    pureMs: S.Int,
    mixedHeads: S.Int,
    mixedMs: S.Int,
  }).pipe(
    $I.annoteSchema("RouteCensusRow", {
      description: "Hosted machine time per (atom kind, lane) over pure and mixed heads.",
    })
  )
) {}

/**
 * The loss census over a corpus under one footprint record.
 *
 * **Details**
 *
 * `unresolvedHeads` counts heads whose commit stayed missing after fetching; each counts as one `unknown` atom.
 *
 * **Example** (An empty census)
 *
 * ```ts import.meta.vitest name="An empty census"
 * import { RouteCensus } from "@beep/repo-cli/commands/Ci"
 *
 * const census = RouteCensus.make({
 *   schemaVersion: "route-census/v1",
 *   corpusSha256: "0000",
 *   footprintDigest: "0000",
 *   heads: 0,
 *   classifiedHeads: 0,
 *   unknownAtomShare: 0,
 *   unresolvedHeads: 0,
 *   rows: [],
 *   costs: [],
 * })
 * census.rows.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteCensus extends S.Opaque<RouteCensus, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("route-census/v1"),
    corpusSha256: S.NonEmptyString,
    footprintDigest: S.NonEmptyString,
    heads: S.Int,
    classifiedHeads: S.Int,
    unknownAtomShare: S.Finite,
    unresolvedHeads: S.Int,
    rows: S.Array(RouteCensusRow),
    costs: S.Array(RouteLaneCost),
  }).pipe(
    $I.annoteSchema("RouteCensus", {
      description:
        "Machine time the route would not select, by atom kind and lane, with the unknown share and cost sources.",
    })
  )
) {}

/**
 * The replay of one hosted head under the route: what was skipped and whether
 * a skipped lane went red while green on the base.
 *
 * **Example** (A head with nothing skipped)
 *
 * ```ts import.meta.vitest name="A head with nothing skipped"
 * import { RouteReplayHead } from "@beep/repo-cli/commands/Ci"
 *
 * const head = RouteReplayHead.make({
 *   headSha: "bbbb",
 *   mergeBase: "aaaa",
 *   selected: ["lint"],
 *   skipped: [],
 *   skippedReds: [],
 *   baseUnknown: false,
 * })
 * head.skippedReds.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteReplayHead extends S.Opaque<RouteReplayHead, { readonly brand: unique symbol }>()(
  S.Struct({
    headSha: S.NonEmptyString,
    mergeBase: S.NonEmptyString,
    selected: S.Array(CiLaneId),
    skipped: S.Array(CiLaneId),
    skippedReds: S.Array(CiLaneId),
    baseUnknown: S.Boolean,
  }).pipe(
    $I.annoteSchema("RouteReplayHead", {
      description: "One head's replay: selected and skipped lanes, skipped lanes that went red, base-unknown flag.",
    })
  )
) {}

/**
 * The replay report: recall over the corpus under one footprint record.
 *
 * **Details**
 *
 * `recall` is 1 minus the share of skipped lane runs that went red while the
 * lane was green on main at or before the merge base; an unknown base counts
 * against the route (fail-closed) and is reported in `baseUnknownHeads`.
 * `unresolvedHeads` counts heads whose commit stayed missing after fetching; each selects every lane and is base-unknown.
 *
 * **Example** (An empty replay has full recall)
 *
 * ```ts import.meta.vitest name="An empty replay has full recall"
 * import { RouteReplay } from "@beep/repo-cli/commands/Ci"
 *
 * const replay = RouteReplay.make({
 *   schemaVersion: "route-replay/v1",
 *   corpusSha256: "00",
 *   footprintDigest: "00",
 *   heads: 0,
 *   skippedLaneRuns: 0,
 *   skippedReds: 0,
 *   baseUnknownHeads: 0,
 *   unresolvedHeads: 0,
 *   recall: 1,
 *   perHead: [],
 * })
 * replay.recall // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteReplay extends S.Opaque<RouteReplay, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("route-replay/v1"),
    corpusSha256: S.NonEmptyString,
    footprintDigest: S.NonEmptyString,
    heads: S.Int,
    skippedLaneRuns: S.Int,
    skippedReds: S.Int,
    baseUnknownHeads: S.Int,
    unresolvedHeads: S.Int,
    recall: S.Finite,
    perHead: S.Array(RouteReplayHead),
  }).pipe(
    $I.annoteSchema("RouteReplay", {
      description: "Recall of the route over the corpus with base-green attribution.",
    })
  )
) {}

/**
 * Why a route operation failed.
 *
 * **Example** (Guard an error reason)
 *
 * ```ts import.meta.vitest name="Guard an error reason"
 * import { RouteErrorReason } from "@beep/repo-cli/commands/Ci"
 *
 * RouteErrorReason.is["corpus-pin"]("corpus-pin") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RouteErrorReason = LiteralKit([
  "git",
  "classify",
  "footprint",
  "corpus-fetch",
  "corpus-pin",
  "workspace",
]).pipe(
  $I.annoteSchema("RouteErrorReason", {
    description: "The route operation that failed.",
  })
);

/**
 * Type of {@link RouteErrorReason}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type RouteErrorReason = typeof RouteErrorReason.Type;

/**
 * Typed failure of the verification route.
 *
 * **Example** (Construct a route error)
 *
 * ```ts import.meta.vitest name="Construct a route error"
 * import { RouteError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = RouteError.new("git", "git diff failed")
 * error.reason // => "git"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RouteError extends S.TaggedError<RouteError, { readonly brand: unique symbol }>($I`RouteError`)(
  "RouteError",
  {
    reason: RouteErrorReason,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<RouteError>("RouteError", {
    description: "Failure raised by the verification route (git, classify, footprint, corpus or workspace).",
  })
) {
  static readonly new: {
    (reason: RouteErrorReason, message: string): RouteError;
    (reason: RouteErrorReason, message: string, cause: unknown): RouteError;
  } = (reason: RouteErrorReason, message: string, cause?: unknown): RouteError =>
    cause === undefined ? RouteError.make({ reason, message }) : RouteError.make({ reason, message, cause });

  static readonly mapError: (reason: RouteErrorReason, message: string) => (cause: unknown) => RouteError =
    (reason, message) => (cause) =>
      RouteError.new(reason, message, cause);
}
