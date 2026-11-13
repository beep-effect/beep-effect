/**
 * Schema-first models for residue reap's `drainable` class: the per-checkout
 * drain checks, the assessment they add up to, the fleet facts the checks
 * read, wave disk totals, and the drain journal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { FleetCheckoutKind, FleetProbeReading } from "../Worktree.schemas.ts";
import { FleetRegistryRow, FleetSeatRole } from "./FleetRegistry.schemas.ts";
import { ConfiguredFleetRoots } from "./FleetRoots.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/internal/ResidueReapDrain.schemas");

/**
 * One condition of the drain predicate.
 *
 * **Details**
 *
 * `seat-role` admits only `legacy` and `adopted` checkouts; authored seats
 * never drain. `invoking-checkout` refuses the checkout running the reap,
 * `timer-host` any checkout that is a systemd user unit's working directory,
 * and `proof-unit` any checkout an active `beep-proof-*` unit names.
 * `owned-worktrees` and `object-borrowers` apply to clones: a clone drains
 * only after every worktree registered to it is gone, and never while another
 * clone borrows its objects through `objects/info/alternates`. `grace-window`
 * is the unbroken drainable run the registry recorded.
 *
 * **Example** (Recognize a drain check)
 *
 * ```ts
 * import { ResidueDrainCheck } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(ResidueDrainCheck.is["owned-worktrees"]("owned-worktrees")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueDrainCheck = LiteralKit([
  "seat-role",
  "retention-exempt",
  "invoking-checkout",
  "timer-host",
  "proof-unit",
  "open-pr",
  "session-ledger",
  "liveness",
  "owned-worktrees",
  "object-borrowers",
  "local-only-work",
  "clean-tree",
  "grace-window",
]).pipe(
  $I.annoteSchema("ResidueDrainCheck", {
    description: "One condition of the drain predicate residue reap evaluates per fleet checkout.",
  })
);

/**
 * One condition of the drain predicate.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueDrainCheck = typeof ResidueDrainCheck.Type;

/**
 * How one drain check came out.
 *
 * **Details**
 *
 * `probe-failed` is a refusal, never a pass: a fact the reap could not read
 * blocks the drain exactly as a negative fact does. `bundle-required` passes
 * only once the checkout's local-only work is preserved in a verified bundle.
 * `not-evaluated` marks an expensive check skipped because an earlier check
 * already refused the checkout.
 *
 * **Example** (Recognize an unreadable fact)
 *
 * ```ts
 * import { ResidueDrainOutcome } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(ResidueDrainOutcome.is["probe-failed"]("probe-failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueDrainOutcome = LiteralKit([
  "pass",
  "fail",
  "probe-failed",
  "bundle-required",
  "not-evaluated",
]).pipe(
  $I.annoteSchema("ResidueDrainOutcome", {
    description: "Outcome of one drain check; probe-failed refuses like fail, bundle-required needs a verified bundle.",
  })
);

/**
 * How one drain check came out.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueDrainOutcome = typeof ResidueDrainOutcome.Type;

/**
 * One evaluated drain check and the fact behind it.
 *
 * **Example** (A refused check)
 *
 * ```ts
 * import { ResidueDrainCheckResult } from "@beep/repo-cli/test/Worktree"
 *
 * const result = ResidueDrainCheckResult.make({
 *   check: "open-pr",
 *   outcome: "fail",
 *   detail: "branch feat/lane has an open pull request",
 * })
 * console.log(result.outcome) // "fail"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainCheckResult extends S.Opaque<ResidueDrainCheckResult, { readonly brand: unique symbol }>()(
  S.Struct({
    check: ResidueDrainCheck,
    outcome: ResidueDrainOutcome,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("ResidueDrainCheckResult", {
      description: "One evaluated drain check, its outcome, and the fact it read.",
    })
  )
) {}

/**
 * Every drain check for one fleet checkout and what they add up to.
 *
 * **Details**
 *
 * `drainable` holds when every check except `grace-window` passed or needs a
 * bundle. `eligible` adds the grace window: the checkout met the predicate at
 * every observation since `drainingSince`, at the same HEAD, for at least
 * `graceDays`. `owningClone` is the clone whose `.git` holds a linked
 * worktree's state (`null` for a clone). `bundle` names the verified bundle an
 * applied drain wrote before removal.
 *
 * **Example** (A lane inside its grace window)
 *
 * ```ts
 * import { ResidueDrainAssessment } from "@beep/repo-cli/test/Worktree"
 *
 * const assessment = ResidueDrainAssessment.make({
 *   checkout: "/p/beep-effect-worktrees/lane",
 *   kind: "linked-worktree",
 *   seatRole: "adopted",
 *   owningClone: "/p/beep-effect",
 *   branch: "feat/lane",
 *   head: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
 *   drainingSince: "2026-11-13T00:00:00.000Z",
 *   graceDays: 7,
 *   checks: [],
 *   drainable: true,
 *   eligible: false,
 *   bundle: null,
 * })
 * console.log(assessment.eligible) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainAssessment extends S.Opaque<ResidueDrainAssessment, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    kind: FleetCheckoutKind,
    seatRole: FleetSeatRole,
    owningClone: S.NullOr(S.String),
    branch: S.NullOr(S.String),
    head: S.NullOr(S.String),
    drainingSince: S.NullOr(S.String),
    graceDays: S.Finite,
    checks: S.Array(ResidueDrainCheckResult),
    drainable: S.Boolean,
    eligible: S.Boolean,
    bundle: S.NullOr(S.String),
  }).pipe(
    $I.annoteSchema("ResidueDrainAssessment", {
      description: "Per-checkout drain checks, whether the predicate holds now, and whether its grace window elapsed.",
    })
  )
) {}

/**
 * Fleet-wide facts one drain pass reads once and every checkout's checks share.
 *
 * **Details**
 *
 * Each `null` list means its probe could not answer; every check that reads
 * it then reports `probe-failed`. `registry` is the persisted fleet registry
 * and `roots` the discovery roots that decide the adoption role of a checkout
 * the registry does not list yet.
 *
 * **Example** (Facts from a host where GitHub was unreachable)
 *
 * ```ts
 * import { ConfiguredFleetRoots, FleetRootEntry, ResidueDrainFleetFacts } from "@beep/repo-cli/test/Worktree"
 *
 * const facts = ResidueDrainFleetFacts.make({
 *   roots: ConfiguredFleetRoots.make({ source: "derived", roots: [FleetRootEntry.make({ path: "/p" })] }),
 *   registry: [],
 *   openPullRequestHeads: null,
 *   proofUnitCheckouts: [],
 *   timerDirectories: [],
 *   openSessionCheckouts: [],
 *   stateDirectory: "/home/me/.local/state/beep/fleet/github.com__o__r",
 * })
 * console.log(facts.openPullRequestHeads) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainFleetFacts extends S.Opaque<ResidueDrainFleetFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    roots: ConfiguredFleetRoots,
    registry: S.Array(FleetRegistryRow),
    openPullRequestHeads: S.String.pipe(S.Array, S.NullOr),
    proofUnitCheckouts: S.String.pipe(S.Array, S.NullOr),
    timerDirectories: S.String.pipe(S.Array, S.NullOr),
    openSessionCheckouts: S.String.pipe(S.Array, S.NullOr),
    stateDirectory: S.String,
  }).pipe(
    $I.annoteSchema("ResidueDrainFleetFacts", {
      description:
        "Registry, roots, open pull request heads, proof units, timer hosts and open session rows read once per drain pass.",
    })
  )
) {}

/**
 * The liveness readings a drain needs beyond the reap's own process probe.
 *
 * **Details**
 *
 * The drain classifies liveness with the fleet mirror's classifier, feeding
 * it these readings and the residue reap's process-cwd probe, so a checkout
 * is confirmed not-live only when every negative-capable probe measured a
 * negative.
 *
 * **Example** (A quiet checkout)
 *
 * ```ts
 * import { ResidueDrainLivenessReadings } from "@beep/repo-cli/test/Worktree"
 *
 * const readings = ResidueDrainLivenessReadings.make({
 *   transcript: { _tag: "absent" },
 *   worktreeMtime: { _tag: "measured", ageSeconds: 864000 },
 *   sessionMatches: 0,
 * })
 * console.log(readings.sessionMatches) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainLivenessReadings extends S.Opaque<
  ResidueDrainLivenessReadings,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    transcript: FleetProbeReading,
    worktreeMtime: FleetProbeReading,
    sessionMatches: S.Finite,
  }).pipe(
    $I.annoteSchema("ResidueDrainLivenessReadings", {
      description: "Transcript, tree-mtime and session-registry readings a drain classifies liveness from.",
    })
  )
) {}

/**
 * Disk held by the registered legacy clones at one point of a drain wave.
 *
 * **Details**
 *
 * `bytes` sums the apparent size of every legacy clone `du` could measure;
 * `unmeasured` names the ones it could not, so a partial total is never
 * mistaken for a complete one.
 *
 * **Example** (Two measured clones)
 *
 * ```ts
 * import { ResidueDrainDisk } from "@beep/repo-cli/test/Worktree"
 *
 * const disk = ResidueDrainDisk.make({ legacyClones: 2, bytes: 4096, unmeasured: [] })
 * console.log(disk.legacyClones) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainDisk extends S.Opaque<ResidueDrainDisk, { readonly brand: unique symbol }>()(
  S.Struct({
    legacyClones: S.Int,
    bytes: S.Finite,
    unmeasured: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ResidueDrainDisk", {
      description: "Apparent bytes across registered legacy clones, with the clones du could not measure.",
    })
  )
) {}

/**
 * What an applied drain did with one eligible checkout.
 *
 * **Example** (Recognize a removal)
 *
 * ```ts
 * import { ResidueDrainJournalOutcome } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(ResidueDrainJournalOutcome.is.removed("removed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueDrainJournalOutcome = LiteralKit(["removed", "refused"]).pipe(
  $I.annoteSchema("ResidueDrainJournalOutcome", {
    description: "Whether an applied drain removed an eligible checkout or refused it at apply time.",
  })
);

/**
 * What an applied drain did with one eligible checkout.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueDrainJournalOutcome = typeof ResidueDrainJournalOutcome.Type;

/**
 * One line of the append-only drain journal.
 *
 * **Details**
 *
 * Written beside the fleet registry as `drain-journal.jsonl` for every
 * checkout an applied drain removed or refused at apply time. `checks` is the
 * apply-time assessment: the open PR, proof unit, confirmed liveness, clean
 * tree, local-only work and owned-worktree checks that authorized it.
 *
 * **Example** (A refused removal)
 *
 * ```ts
 * import { ResidueDrainJournalEntry } from "@beep/repo-cli/test/Worktree"
 *
 * const entry = ResidueDrainJournalEntry.make({
 *   runId: "5f0c0a8e-2c1d-4c1e-9a8f-2b7d1c4e5a60",
 *   recordedAt: "2026-11-20T00:00:00.000Z",
 *   checkout: "/p/beep-effect-worktrees/lane",
 *   kind: "linked-worktree",
 *   outcome: "refused",
 *   reason: "drain-blocked",
 *   checks: [],
 *   bundle: null,
 *   bytes: null,
 * })
 * console.log(entry.schemaVersion) // "residue-drain-journal/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueDrainJournalEntry extends S.Opaque<ResidueDrainJournalEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("residue-drain-journal/v1"),
    runId: S.String,
    recordedAt: S.String,
    checkout: S.String,
    kind: FleetCheckoutKind,
    outcome: ResidueDrainJournalOutcome,
    reason: S.NullOr(S.String),
    checks: S.Array(ResidueDrainCheckResult),
    bundle: S.NullOr(S.String),
    bytes: S.NullOr(S.Finite),
  }).pipe(
    $I.annoteSchema("ResidueDrainJournalEntry", {
      description:
        "One applied drain decision: the checkout, the outcome, the checks behind it and any bundle written.",
    })
  )
) {}
