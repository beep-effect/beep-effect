/**
 * Hold ledger models: a hold is a falsifiable claim that a temporary repo
 * decision (a held dependency, an exact pin, an override, a patch, an OSV
 * exception) is still needed, with the probe that would disprove it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimReview, ValidTime } from "@beep/epistemics/Claim";
import { ClaimId, makeClaimCore, makeClaimRecords } from "@beep/epistemics/ClaimCore.schema";
import { ClaimReference, claimReferenceKey, makeClaimImport } from "@beep/epistemics/ClaimImport.schema";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Holds/Holds.schemas");

/**
 * Stable kebab-case identifier of a hold; anchors in config files cite it.
 *
 * **Example** (Decode a hold id)
 *
 * ```ts
 * import { HoldId } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HoldId)("jsdom-vitest-eventtarget")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldId = S.String.check(S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).pipe(
  S.brand("HoldId"),
  $I.annoteSchema("HoldId", { description: "Kebab-case hold identifier cited by config anchors." })
);

/**
 * Decoded type of {@link HoldId}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldId = typeof HoldId.Type;

/**
 * Where a dependency-shaped hold is enforced (wave 1 of the hold ledger).
 *
 * **Example** (Narrow a hold kind)
 *
 * ```ts
 * import { HoldKind } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(HoldKind.is["syncpack-held"]("syncpack-held")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldKind = LiteralKit([
  "syncpack-held",
  "exact-pin",
  "override",
  "patch",
  "osv-exception",
  "version-group",
]).pipe($I.annoteSchema("HoldKind", { description: "The config surface that enforces a dependency-shaped hold." }));

/**
 * Decoded type of {@link HoldKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldKind = typeof HoldKind.Type;

/**
 * One config site that enforces a hold, typed by the file and section it lives in.
 *
 * **Details**
 *
 * `SyncpackHeld` names a pattern in the syncpack held list. That list is a
 * projection of the ledger (`hold-ledger/syncpack-held.generated.json`), so the
 * anchor feeds the projection rather than pointing at a hand-edited entry.
 *
 * **Example** (Anchor a hold to a root catalog entry)
 *
 * ```ts
 * import { HoldAnchor } from "@beep/repo-cli/commands/Holds"
 *
 * const anchor = HoldAnchor.cases.CatalogEntry.make({ packageName: "statelyai" })
 * console.log(anchor._tag) // "CatalogEntry"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldAnchor = S.TaggedUnion({
  CatalogEntry: { packageName: S.NonEmptyString },
  ManifestDependency: { manifest: S.NonEmptyString, packageName: S.NonEmptyString },
  SyncpackHeld: { dependency: S.NonEmptyString },
  SyncpackVersionGroup: { label: S.NonEmptyString },
  RootOverride: { packageName: S.NonEmptyString },
  PatchedDependency: { key: S.NonEmptyString },
  OsvPackageOverride: { packageName: S.NonEmptyString },
  OsvIgnoredVuln: { id: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("HoldAnchor", {
    description:
      "A typed config site that enforces a hold: catalog, manifest, syncpack, override, patch, OSV package override or OSV advisory ignore.",
  })
);

/**
 * Decoded type of {@link HoldAnchor}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldAnchor = typeof HoldAnchor.Type;

/**
 * What a hold governs: the packages held together and every anchor enforcing it.
 *
 * **Example** (A single-package subject)
 *
 * ```ts
 * import { HoldAnchor, HoldSubject } from "@beep/repo-cli/commands/Holds"
 *
 * const subject = HoldSubject.make({
 *   packages: ["statelyai"],
 *   anchors: [HoldAnchor.cases.CatalogEntry.make({ packageName: "statelyai" })],
 * })
 * console.log(subject.packages[0]) // "statelyai"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HoldSubject extends S.Opaque<HoldSubject, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.NonEmptyArray(S.NonEmptyString),
    anchors: S.NonEmptyArray(HoldAnchor),
  }).pipe(
    $I.annoteSchema("HoldSubject", {
      description: "Packages held as one group (lockstep families share a hold) and their config anchors.",
    })
  )
) {}

/**
 * The runtime a scripted probe must run under; a probe on the wrong runtime proves nothing.
 *
 * **Example** (Narrow a probe runtime)
 *
 * ```ts
 * import { ProbeRuntime } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(ProbeRuntime.is["vitest-bun"]("vitest-bun")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRuntime = LiteralKit(["bun", "node", "vitest-bun", "vitest-node"]).pipe(
  $I.annoteSchema("ProbeRuntime", { description: "Pinned runtime a scripted probe executes under." })
);

/**
 * Decoded type of {@link ProbeRuntime}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRuntime = typeof ProbeRuntime.Type;

/**
 * How a hold could be disproved.
 *
 * **Details**
 *
 * `Scripted` runs a command twice in a scratch install: once with the known-bad
 * control version, which must still reproduce `failureSignature`, and once with
 * the candidate version. `Judgement` holds cannot be scripted; a judge run over
 * the diff since the last version is their probe.
 *
 * **Example** (A scripted falsifier)
 *
 * ```ts
 * import { HoldFalsifier } from "@beep/repo-cli/commands/Holds"
 *
 * const scripted = HoldFalsifier.cases.Scripted.make({
 *   runtime: "vitest-bun",
 *   command: ["bunx", "vitest", "run", "--bun", "probe.test.ts"],
 *   controlVersion: "30.1.0",
 *   candidate: "latest",
 *   failureSignature: "not a valid instance of EventTarget",
 * })
 * console.log(scripted._tag) // "Scripted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldFalsifier = S.TaggedUnion({
  Scripted: {
    runtime: ProbeRuntime,
    command: S.NonEmptyArray(S.NonEmptyString),
    controlVersion: S.NonEmptyString,
    candidate: S.NonEmptyString,
    failureSignature: S.NonEmptyString,
  },
  Judgement: {
    question: S.NonEmptyString,
    rubric: S.NonEmptyString,
  },
}).pipe($I.annoteSchema("HoldFalsifier", { description: "The probe that would disprove a hold." }));

/**
 * Decoded type of {@link HoldFalsifier}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldFalsifier = typeof HoldFalsifier.Type;

/**
 * An upstream signal that makes a hold worth re-checking before its deadline.
 *
 * **Example** (Watch an npm dist-tag)
 *
 * ```ts
 * import { HoldWatchTarget } from "@beep/repo-cli/commands/Holds"
 *
 * const target = HoldWatchTarget.cases.NpmVersion.make({ packageName: "statelyai", distTag: "latest" })
 * console.log(target._tag) // "NpmVersion"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldWatchTarget = S.TaggedUnion({
  NpmVersion: { packageName: S.NonEmptyString, distTag: S.NonEmptyString },
  GithubIssueClosed: { repository: S.NonEmptyString, number: S.Int.check(S.isGreaterThan(0)) },
  GithubRelease: { repository: S.NonEmptyString },
}).pipe($I.annoteSchema("HoldWatchTarget", { description: "Upstream signal that wakes a hold re-check." }));

/**
 * Decoded type of {@link HoldWatchTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldWatchTarget = typeof HoldWatchTarget.Type;

/**
 * What a lane does when the hold's probe flips or its lifetime runs out.
 *
 * **Example** (Unpin when the hold ends)
 *
 * ```ts
 * import { HoldExitAction } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(HoldExitAction.cases.Unpin.make({})._tag) // "Unpin"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldExitAction = S.TaggedUnion({
  Unpin: {},
  Rewrite: { path: S.NonEmptyString },
  EscalateToGoal: { slug: S.NonEmptyString },
}).pipe($I.annoteSchema("HoldExitAction", { description: "The change made when a hold ends." }));

/**
 * Decoded type of {@link HoldExitAction}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldExitAction = typeof HoldExitAction.Type;

/**
 * The proposition a hold claim asserts.
 *
 * **Example** (Reject an incomplete proposition)
 *
 * ```ts
 * import { HoldProposition } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HoldProposition)({ _tag: "Hold" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldProposition = S.TaggedStruct("Hold", {
  holdId: HoldId,
  kind: HoldKind,
  subject: HoldSubject,
  assertion: S.NonEmptyString,
  falsifier: HoldFalsifier,
  watch: S.Array(HoldWatchTarget),
  exitAction: HoldExitAction,
}).pipe(
  $I.annoteSchema("HoldProposition", {
    description: "A temporary repo decision, why it exists, and the probe that would disprove it.",
  })
);

/**
 * Decoded type of {@link HoldProposition}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldProposition = typeof HoldProposition.Type;

/**
 * Identifier of one recorded probe run, cited by a version's `supportedBy`.
 *
 * **Example** (Check a probe run id)
 *
 * ```ts
 * import { ProbeRunId } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProbeRunId)("statelyai-model-testing-404@1793446502723")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRunId = S.NonEmptyString.pipe(
  S.brand("ProbeRunId"),
  $I.annoteSchema("ProbeRunId", { description: "Identifier of one recorded probe run." })
);

/**
 * Decoded type of {@link ProbeRunId}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRunId = typeof ProbeRunId.Type;

/**
 * Identifier of the activity that produced a version (an admit, a renewal, a sweep).
 *
 * **Example** (Check an activity id)
 *
 * ```ts
 * import { HoldActivityId } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HoldActivityId)("admit-2026-10-31")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldActivityId = S.NonEmptyString.pipe(
  S.brand("HoldActivityId"),
  $I.annoteSchema("HoldActivityId", { description: "Identifier of the activity that produced a hold version." })
);

/**
 * Identifier of the agent or person responsible for a version.
 *
 * **Example** (Check a principal id)
 *
 * ```ts
 * import { HoldPrincipalId } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HoldPrincipalId)("claude-opus-5-5")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldPrincipalId = S.NonEmptyString.pipe(
  S.brand("HoldPrincipalId"),
  $I.annoteSchema("HoldPrincipalId", { description: "Agent or person responsible for a hold version." })
);

/**
 * Keep a hold's logical subject stable across changes to its lease, wording or evidence.
 * **Example** (Use the owner key)
 * ```ts
 * import { holdLogicalKey } from "@beep/repo-cli/commands/Holds"
 * console.log(typeof holdLogicalKey)
 * ```
 * @param proposition - The hold proposition to key.
 * @returns The logical key shared by every claim about the same hold id.
 * @category utilities
 * @since 0.0.0
 */
export const holdLogicalKey = (proposition: HoldProposition): string => `hold:${proposition.holdId}`;

const claimVocabulary = makeClaimCore({
  $I,
  proposition: HoldProposition,
  ids: {
    logicalKey: holdLogicalKey,
    scope: S.NonEmptyString,
    principal: HoldPrincipalId,
    action: S.NonEmptyString,
    revision: S.NonEmptyString,
  },
});
const reviewVocabulary = makeClaimReview({
  $I,
  ids: { assertion: ProbeRunId, activity: HoldActivityId, principal: HoldPrincipalId },
});
const holdClaimRecordVersion = "hold-claim-record/v2";

/**
 * Native creation facts of one hold; a renewal is a new core with a new ClaimId.
 *
 * **Example** (Inspect the core codec)
 *
 * ```ts
 * import { HoldClaimCore } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldClaimCore.fields.logicalKey !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldClaimCore extends S.Opaque<HoldClaimCore, { readonly brand: unique symbol }>()(
  claimVocabulary.ClaimCore
) {}

/**
 * The explicit agent that asserted a native hold.
 *
 * **Example** (Name the asserting person)
 *
 * ```ts
 * import { HoldAgentRef, HoldPrincipalId } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldAgentRef.cases.Person.make({ principal: HoldPrincipalId.make("maintainer") })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HoldAgentRef = claimVocabulary.AgentRef;

const records = makeClaimRecords({ $I, core: HoldClaimCore });

/**
 * A native hold keyed by the content address of its core.
 *
 * **Example** (Inspect the keyed record)
 *
 * ```ts
 * import { HoldCoreRecord } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldCoreRecord.fields.claim !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldCoreRecord extends S.Opaque<HoldCoreRecord, { readonly brand: unique symbol }>()(
  records.ClaimRecord
) {}

/**
 * Review payload of a hold, held outside its immutable core.
 *
 * **Example** (Build a proposed review)
 *
 * ```ts
 * import { HoldReviewState } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldReviewState.cases.Proposed.make({})._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HoldReviewState = reviewVocabulary.ReviewState;
/**
 * Decoded hold review payload.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldReviewState = typeof HoldReviewState.Type;

/**
 * Five independent observations about a hold's evidence; no combined score.
 *
 * **Example** (Inspect the validator signal)
 *
 * ```ts
 * import { HoldEvidenceSignals } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldEvidenceSignals.fields.validator !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldEvidenceSignals extends S.Opaque<HoldEvidenceSignals, { readonly brand: unique symbol }>()(
  reviewVocabulary.EvidenceSignals
) {}

/**
 * A v2 event that appends one minted native hold core with its generating activity.
 *
 * **Example** (Inspect the event version)
 *
 * ```ts
 * import { HoldCoreEvent } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldCoreEvent.fields.version !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldCoreEvent extends S.Opaque<HoldCoreEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(holdClaimRecordVersion),
    event: S.tag("Core"),
    record: HoldCoreRecord,
    activity: ActivityStart,
    generatedAt: S.DateTimeUtcFromMillis,
  }).pipe($I.annoteSchema("HoldCoreEvent", { description: "A native hold core and the end of its activity." }))
) {}

const HoldEvidenceEvent = S.Struct({
  version: S.tag(holdClaimRecordVersion),
  event: S.tag("Evidence"),
  claim: ClaimReference,
  supportedBy: S.Array(ProbeRunId),
  challengedBy: S.Array(ProbeRunId),
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("HoldEvidenceEvent", {
    description: "A separate hold evidence record listing supporting and challenging refs for one claim.",
  })
);

const HoldReviewEvent = S.Struct({
  version: S.tag(holdClaimRecordVersion),
  event: S.tag("Review"),
  claim: ClaimReference,
  review: HoldReviewState,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("HoldReviewEvent", {
    description: "A separate hold review record for one claim.",
  })
);

const HoldSignalsEvent = S.Struct({
  version: S.tag(holdClaimRecordVersion),
  event: S.tag("Signals"),
  claim: ClaimReference,
  signals: HoldEvidenceSignals,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("HoldSignalsEvent", {
    description: "A separate hold evidence-signals record for one claim.",
  })
);

const HoldSuccessionEvent = S.Struct({
  version: S.tag(holdClaimRecordVersion),
  event: S.tag("Succession"),
  claim: ClaimId,
  predecessor: ClaimReference,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("HoldSuccessionEvent", {
    description: "A hold succession record linking a native core to the claim it replaces.",
  })
);

/**
 * Separate v2 hold records attached to an explicitly namespaced claim.
 *
 * **Details**
 * A retirement is a review record, not a new core. A succession links a native renewal to the
 * imported hold it replaces, because a core's own predecessor field accepts only a ClaimId.
 *
 * **Example** (Retire an imported hold)
 *
 * ```ts
 * import { HoldClaimEvent } from "@beep/repo-cli/commands/Holds"
 * import { ClaimReference } from "@beep/epistemics/ClaimImport.schema"
 * import * as DateTime from "effect/DateTime"
 * const at = DateTime.makeUnsafe(1)
 * const event = HoldClaimEvent.cases.Review.make({
 *   claim: ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "synthetic-hold@1" }),
 *   review: { _tag: "Retracted", reason: "Anchor gone.", at },
 *   at
 * })
 * console.log(event.event)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HoldClaimEvent = S.Union([
  HoldCoreEvent,
  HoldEvidenceEvent,
  HoldReviewEvent,
  HoldSignalsEvent,
  HoldSuccessionEvent,
]).pipe(
  S.toTaggedUnion("event"),
  $I.annoteSchema("HoldClaimEvent", { description: "One hold-claim-record/v2 line; old envelopes are never written." })
);
/**
 * Decoded hold-claim-record/v2 event.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldClaimEvent = typeof HoldClaimEvent.Type;

/**
 * Historical facts read from a frozen v1 hold row; never a native core or an admission.
 *
 * **Example** (Inspect the retained old identifier)
 *
 * ```ts
 * import { HoldLegacyImported } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldLegacyImported.fields.oldId !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldLegacyImported extends S.Opaque<HoldLegacyImported, { readonly brand: unique symbol }>()(
  makeClaimImport({
    $I,
    ledger: "holds",
    proposition: HoldProposition,
    review: HoldReviewState,
    signals: HoldEvidenceSignals,
  })
) {}

const HoldClaimSource = S.Union([HoldLegacyImported, HoldCoreEvent]).pipe(
  S.toTaggedUnion("version"),
  $I.annoteSchema("HoldClaimSource", { description: "Imported history or a verified native hold core event." })
);

/**
 * Read-time join of one stored hold with its separate evidence, review and signal records.
 *
 * **Details**
 * The join is a projection for listing, linting and probing; it is never written back.
 *
 * **Example** (Inspect the join's reference)
 *
 * ```ts
 * import { HoldClaim } from "@beep/repo-cli/commands/Holds"
 * console.log(HoldClaim.fields.reference !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HoldClaim extends S.Opaque<HoldClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    source: HoldClaimSource,
    reference: ClaimReference,
    predecessor: S.OptionFromOptionalKey(ClaimReference),
    logicalKey: S.NonEmptyString,
    evidence: S.Struct({ supportedBy: S.Array(S.String), challengedBy: S.Array(S.String) }),
    review: HoldReviewState,
    signals: S.OptionFromOptionalKey(HoldEvidenceSignals),
    knowledge: ClaimKnowledgeInterval,
    valid: ValidTime,
  }).pipe(
    $I.annoteSchema("HoldClaim", { description: "Imported history or a native core joined with its separate records." })
  )
) {}

/**
 * Namespace-aware index key; equal-looking old and native identifiers never merge.
 *
 * **Example** (Key a hold)
 *
 * ```ts
 * import { holdClaimKey } from "@beep/repo-cli/commands/Holds"
 * console.log(typeof holdClaimKey)
 * ```
 *
 * @param claim - A stored or imported hold claim.
 * @returns The namespaced reference key of the claim.
 * @category utilities
 * @since 0.0.0
 */
export const holdClaimKey = (claim: HoldClaim): string => claimReferenceKey(claim.reference);

/**
 * Rendered hold name: the old version id of an imported hold, the ClaimId of a native one.
 *
 * **Example** (Render an imported reference)
 *
 * ```ts
 * import { holdReferenceLabel } from "@beep/repo-cli/commands/Holds"
 * import { ClaimReference } from "@beep/epistemics/ClaimImport.schema"
 * console.log(holdReferenceLabel(ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "x@1" })))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const holdReferenceLabel: (reference: ClaimReference) => string = ClaimReference.match({
  Imported: ({ oldId }) => oldId,
  Native: ({ claim }) => claim,
});

/**
 * Rendered name of a joined hold.
 *
 * **Example** (Render a joined hold)
 *
 * ```ts
 * import { holdClaimLabel } from "@beep/repo-cli/commands/Holds"
 * console.log(typeof holdClaimLabel)
 * ```
 *
 * @param claim - A stored or imported hold claim.
 * @returns A short human-readable label for the claim reference.
 * @category projections
 * @since 0.0.0
 */
export const holdClaimLabel = (claim: HoldClaim): string => holdReferenceLabel(claim.reference);

/**
 * The hold proposition, read from imported history or a native core.
 *
 * **Example** (Read the proposition)
 *
 * ```ts
 * import { holdProposition } from "@beep/repo-cli/commands/Holds"
 * console.log(typeof holdProposition)
 * ```
 *
 * @param claim - A stored or imported hold claim.
 * @returns The hold proposition the claim asserts.
 * @category projections
 * @since 0.0.0
 */
export const holdProposition = (claim: HoldClaim): HoldProposition =>
  HoldClaimSource.match(claim.source, {
    "legacy-claim-import/v1": (imported) => imported.proposition,
    [holdClaimRecordVersion]: (event) => event.record.core.proposition,
  });

/**
 * Result of running the probe command against one version.
 *
 * **Details**
 *
 * `Reproduced` means the failure signature appeared, `Passed` means the command
 * exited 0 without it, and `Inconclusive` covers every other outcome (a
 * non-zero exit without the signature, a timeout, an install failure). An
 * inconclusive run never counts as a pass.
 *
 * **Example** (A passing run)
 *
 * ```ts
 * import { ProbeOutcome } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(ProbeOutcome.cases.Passed.make({})._tag) // "Passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeOutcome = S.TaggedUnion({
  Reproduced: {},
  Passed: {},
  Inconclusive: { detail: S.NonEmptyString },
}).pipe($I.annoteSchema("ProbeOutcome", { description: "Result of one probe command run." }));

/**
 * Decoded type of {@link ProbeOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeOutcome = typeof ProbeOutcome.Type;

/**
 * Verdict of a single probe run, before confirmation across runs.
 *
 * **Example** (Narrow a run verdict)
 *
 * ```ts
 * import { ProbeRunVerdict } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(ProbeRunVerdict.is["probe-broken"]("probe-broken")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRunVerdict = LiteralKit(["still-holds", "candidate-passed", "probe-broken", "inconclusive"]).pipe(
  $I.annoteSchema("ProbeRunVerdict", { description: "What one control-plus-candidate probe run shows." })
);

/**
 * Decoded type of {@link ProbeRunVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRunVerdict = typeof ProbeRunVerdict.Type;

/**
 * One recorded probe run: the control and candidate outcomes and the verdict
 * they yield. Probe runs are the assertions a hold version is `supportedBy`.
 *
 * **Example** (Reject an empty run)
 *
 * ```ts
 * import { ProbeRun } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProbeRun)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProbeRun extends S.Opaque<ProbeRun, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("hold-probe-run/v2"),
    id: ProbeRunId,
    holdId: HoldId,
    claim: ClaimReference,
    ranAt: S.DateTimeUtcFromMillis,
    commitSha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/)),
    runtime: ProbeRuntime,
    controlVersion: S.NonEmptyString,
    control: ProbeOutcome,
    candidateVersion: S.NonEmptyString,
    candidate: ProbeOutcome,
    verdict: ProbeRunVerdict,
  }).pipe(
    $I.annoteSchema("ProbeRun", {
      description: "One control-plus-candidate probe run recorded as evidence for a hold.",
    })
  )
) {}

/**
 * Verdict across a hold's recent runs: whether it is safe to act.
 *
 * **Details**
 *
 * `Flipped` needs the two most recent runs to both be `candidate-passed`. A
 * single passing run is `Unconfirmed`. Any `probe-broken` among the most recent
 * run escalates as `ProbeBroken` and never unpins.
 *
 * **Example** (Narrow a confirmed verdict)
 *
 * ```ts
 * import { HoldVerdict } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(HoldVerdict.is.Flipped("Flipped")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldVerdict = LiteralKit(["StillHolds", "Unconfirmed", "Flipped", "ProbeBroken", "Inconclusive"]).pipe(
  $I.annoteSchema("HoldVerdict", { description: "Whether a hold's probe history is safe to act on." })
);

/**
 * Decoded type of {@link HoldVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldVerdict = typeof HoldVerdict.Type;

/**
 * The hold-shaped config sites found in one checkout.
 *
 * **Details**
 *
 * `required` lists the sites that must each be covered by a live hold record
 * (root overrides, patched dependencies and OSV package overrides). `present`
 * lists every site a record may anchor to, `required` included. `heldList` is
 * the syncpack held list currently on disk.
 *
 * **Example** (An empty checkout)
 *
 * ```ts
 * import { HoldSiteSnapshot } from "@beep/repo-cli/commands/Holds"
 *
 * const snapshot = HoldSiteSnapshot.make({ required: [], present: [], heldList: [] })
 * console.log(snapshot.heldList.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HoldSiteSnapshot extends S.Opaque<HoldSiteSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    required: S.Array(HoldAnchor),
    present: S.Array(HoldAnchor),
    heldList: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("HoldSiteSnapshot", {
      description: "Hold-shaped config sites found in one checkout and the syncpack held list on disk.",
    })
  )
) {}

/**
 * One way the ledger and the checkout's config disagree.
 *
 * **Example** (A hold-shaped override with no record)
 *
 * ```ts
 * import { HoldAnchor, HoldLintFinding } from "@beep/repo-cli/commands/Holds"
 *
 * const finding = HoldLintFinding.cases.Unrecorded.make({
 *   anchor: HoldAnchor.cases.RootOverride.make({ packageName: "glob" }),
 * })
 * console.log(finding._tag) // "Unrecorded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldLintFinding = S.TaggedUnion({
  Unrecorded: { anchor: HoldAnchor },
  Orphaned: { holdId: HoldId, anchor: HoldAnchor },
  HeldListStale: { expected: S.Array(S.String), actual: S.Array(S.String) },
}).pipe(
  $I.annoteSchema("HoldLintFinding", {
    description: "A hold-shaped site without a live record, a record whose anchor is gone, or a stale held list.",
  })
);

/**
 * Decoded type of {@link HoldLintFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldLintFinding = typeof HoldLintFinding.Type;
