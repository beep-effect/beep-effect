/**
 * Admission outcomes and typed findings for store-side admission.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimGateResult, ClaimGateViolation } from "@beep/epistemics/ClaimGate";
import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { NearDuplicateFlag } from "./Dedupe.models.ts";
import { ContentHash, NodeId, RevisionId } from "./NodeIdentity.models.ts";
import { LineageId } from "./Observation.events.ts";
import { InsertPlacement, NodeOperation } from "./Operation.models.ts";

const $I = $AgentMemoryStoreId.create("Admission.models");

/**
 * Severity vocabulary shared with the claim gate, re-exported for callers that
 * build or read {@link MemoryGateViolation} values.
 *
 * @category re-exports
 * @since 0.0.0
 */
export { ClaimGateSeverity, ClaimGateViolation } from "@beep/epistemics/ClaimGate";

/**
 * Store-specific violation codes layered on the claim gate findings.
 *
 * **Details**
 *
 * Decision `findings-reuse-epistemics-gate`: one finding vocabulary serves
 * claim gates and memory admission; these codes say which store rule fired.
 * `insertAfterMissingNode` holds an insert whose predecessor never reached the
 * log (it was held, deferred or rejected in the same batch), which is a
 * different cause from `insertUnderDeletedAnchor` and stays out of the AC-3
 * structural floor. `nodeIdAlreadyExists` rejects an insert whose minted id
 * the log already holds, as on a batch retried after an uncertain commit.
 *
 * **Example** (Check a violation code)
 *
 * ```ts
 * import { MemoryViolationCode } from "@beep/agent-memory-store"
 *
 * console.log(MemoryViolationCode.is.heldConflict("heldConflict"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryViolationCode = LiteralKit([
  "heldConflict",
  "backwardStatusMove",
  "missingCandidateEdge",
  "identityLookupFailed",
  "unimportedFolder",
  "deleteVersusEdit",
  "insertUnderDeletedAnchor",
  "insertAfterMissingNode",
  "nodeIdAlreadyExists",
  "staleExpectedRevision",
]).pipe(
  $I.annoteSchema("MemoryViolationCode", {
    description: "Store-specific violation codes layered on the claim gate findings.",
  })
);

/**
 * Runtime type for {@link MemoryViolationCode}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MemoryViolationCode = typeof MemoryViolationCode.Type;

/**
 * One typed admission or retrieval finding: a store code plus the claim gate
 * violation that carries the focus node, path, message and severity.
 *
 * **Example** (Report a stale expected revision)
 *
 * ```ts
 * import { ClaimGateViolation, MemoryGateViolation } from "@beep/agent-memory-store"
 *
 * const violation = MemoryGateViolation.make({
 *   code: "staleExpectedRevision",
 *   violation: ClaimGateViolation.make({
 *     focusNode: "018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f",
 *     path: "expectedRevision",
 *     message: "The node moved on since the export.",
 *     severity: "violation",
 *   }),
 * })
 * console.log(violation.code)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryGateViolation extends S.Opaque<MemoryGateViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    code: MemoryViolationCode.annotateKey({ description: "Store rule that produced the finding." }),
    violation: ClaimGateViolation.annotateKey({ description: "Claim gate violation carrying the finding detail." }),
  }).pipe(
    $I.annoteSchema("MemoryGateViolation", {
      description: "One typed admission or retrieval finding.",
    })
  )
) {}

/**
 * Store-minted identifier of one held write.
 *
 * **Details**
 *
 * Decision `held-writes-are-log-events`: a hold is keyed on its own id, not
 * on the node, so two writes held on one node stay two holds.
 *
 * **Example** (Brand a hold id)
 *
 * ```ts
 * import { HoldId } from "@beep/agent-memory-store"
 *
 * const holdId = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e90")
 * console.log(holdId)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HoldId = S.String.check(S.isUUID()).pipe(
  S.brand("HoldId"),
  $I.annoteSchema("HoldId", {
    description: "Store-minted UUID identifier of one held write.",
  })
);

/**
 * Runtime type for {@link HoldId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HoldId = typeof HoldId.Type;

const AdmissionOutcomeKind = LiteralKit(["landed", "deferred", "held", "rejected"]).pipe(
  $I.annoteSchema("AdmissionOutcomeKind", {
    description: "Internal literal vocabulary used to build AdmissionOutcome.",
  })
);

/**
 * Result of admitting one node operation, discriminated on `outcome`.
 *
 * **Details**
 *
 * - `landed`: the write is in the log at `revisionId`. `flags` lists the
 *   advisory near-duplicate findings raised for it (decision
 *   `dedupe-exact-defer-near-flag`); a flag never blocks, merges or drops a
 *   write and is read by consolidation only. Defaults to no flags.
 * - `deferred`: the text hashed to an existing node, so the write defers to it
 *   (exact-hash dedupe to tier 0; nothing is dropped).
 * - `held`: a conflict needs a resolver. The hold is a `WriteHeld` event in
 *   the log under `holdId`, so nothing is lost silently, and at least one
 *   finding explains why. `ours` is absent when the log holds no live text
 *   (the node was retired, or a held insert's node does not exist yet);
 *   `theirs` is absent when the agent submitted a delete.
 * - `rejected`: the operation broke a rule, such as a backward status move.
 *
 * The claim gate verdict is two-way (`admitted | rejected`), so this
 * four-way union is a superset of it, not an extension: it reuses the
 * claim gate's violation and severity vocabulary inside
 * {@link MemoryGateViolation}, and {@link toClaimGateResult} projects any
 * outcome onto `ClaimGateResult`.
 *
 * **Example** (Decode a landed outcome)
 *
 * ```ts
 * import { AdmissionOutcome } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(AdmissionOutcome)({
 *   outcome: "landed",
 *   nodeId: "018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f",
 *   revisionId: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 * }).pipe(Effect.map((outcome) => outcome.outcome))
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionOutcome = AdmissionOutcomeKind.toTaggedUnion("outcome")({
  landed: {
    nodeId: NodeId.annotateKey({ description: "Node the write landed on." }),
    revisionId: RevisionId.annotateKey({ description: "Revision the write produced." }),
    flags: S.Array(NearDuplicateFlag)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultKey(Effect.succeed([])))
      .annotateKey({ description: "Advisory near-duplicate findings for the write; defaults to none." }),
  },
  deferred: {
    nodeId: NodeId.annotateKey({ description: "Existing node the write deferred to." }),
    contentHash: ContentHash.annotateKey({ description: "Hash shared by the write and the existing node." }),
  },
  held: {
    holdId: HoldId.annotateKey({ description: "Hold the write waits under." }),
    nodeId: NodeId.annotateKey({ description: "Node the held operation names." }),
    ours: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "Live text the log holds for the node; absent when it holds none.",
    }),
    theirs: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "Text the agent submitted; absent for a delete.",
    }),
    violations: S.NonEmptyArray(MemoryGateViolation).annotateKey({ description: "Findings that held the write." }),
  },
  rejected: {
    violations: S.NonEmptyArray(MemoryGateViolation).annotateKey({
      description: "Findings that rejected the write.",
    }),
  },
}).pipe(
  $I.annoteSchema("AdmissionOutcome", {
    description: "Result of admitting one node operation, discriminated on outcome.",
  })
);

/**
 * Runtime type for {@link AdmissionOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AdmissionOutcome = typeof AdmissionOutcome.Type;

const admitted = ClaimGateResult.cases.admitted.make({});

const rejectedWith = (outcome: { readonly violations: A.NonEmptyReadonlyArray<MemoryGateViolation> }) =>
  ClaimGateResult.cases.rejected.make({ violations: A.map(outcome.violations, (finding) => finding.violation) });

/**
 * Projects an admission outcome onto the claim gate's two-way verdict.
 *
 * **Details**
 *
 * Decision `findings-reuse-epistemics-gate`: `landed` and `deferred` are
 * `admitted`; `held` and `rejected` are `rejected` with the claim gate
 * violations their findings carry. The store code of each finding is not part
 * of the verdict; read it from the outcome.
 *
 * **Example** (Project a landed outcome)
 *
 * ```ts
 * import { AdmissionOutcome, NodeId, RevisionId, toClaimGateResult } from "@beep/agent-memory-store"
 *
 * const outcome = AdmissionOutcome.cases.landed.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   revisionId: RevisionId.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 * })
 * console.log(toClaimGateResult(outcome).verdict) // "admitted"
 * ```
 *
 * @param outcome - The admission outcome to project.
 * @returns The claim gate verdict for the outcome.
 * @category utilities
 * @since 0.0.0
 */
export const toClaimGateResult: (outcome: AdmissionOutcome) => ClaimGateResult = AdmissionOutcome.match({
  landed: () => admitted,
  deferred: () => admitted,
  held: rejectedWith,
  rejected: rejectedWith,
});

/**
 * A held write on the operator review list.
 *
 * **Details**
 *
 * This is the read model of one unresolved `WriteHeld` event. `operation` is
 * the write exactly as submitted, `headRevision` is the revision the log held
 * for the node when the write was held, and `since` is the journal time of the
 * hold. `ours` and `theirs` follow the rules of the `held` admission outcome.
 *
 * **Example** (Read the fields of a held conflict)
 *
 * ```ts
 * import { HeldConflict } from "@beep/agent-memory-store"
 *
 * console.log(HeldConflict.fields.holdId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeldConflict extends S.Opaque<HeldConflict, { readonly brand: unique symbol }>()(
  S.Struct({
    holdId: HoldId.annotateKey({ description: "Hold the write waits under." }),
    operation: NodeOperation.annotateKey({ description: "The write exactly as the agent submitted it." }),
    author: LineageId.annotateKey({ description: "Lineage that submitted the held write." }),
    nodeId: NodeId.annotateKey({ description: "Node the held operation names." }),
    headRevision: S.OptionFromOptionalKey(RevisionId).annotateKey({
      description: "Revision the log held for the node when the write was held.",
    }),
    ours: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "Live text the log holds for the node; absent when it holds none.",
    }),
    theirs: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "Text the agent submitted; absent for a delete.",
    }),
    since: S.DateTimeUtcFromString.annotateKey({ description: "When the write was held." }),
    violations: S.NonEmptyArray(MemoryGateViolation).annotateKey({ description: "Findings that held the write." }),
  }).pipe(
    $I.annoteSchema("HeldConflict", {
      description: "A held write on the operator review list.",
    })
  )
) {}

const ConflictChoice = LiteralKit(["ours", "theirs", "merged"]).pipe(
  $I.annoteSchema("ConflictChoice", {
    description: "Internal literal vocabulary used to build ConflictResolution.",
  })
);

/**
 * Operator decision for a held conflict, discriminated on `choice`.
 *
 * **Details**
 *
 * `ours` keeps what the log holds and writes no revision; it is also how a
 * hold is closed once the node has moved on without it. `theirs` applies the
 * held operation's change, and `merged` a text written by the resolver; both
 * write a revision on top of the node's heads at resolve time, never on the
 * stale revision the operation named. Each resolution is recorded as a
 * `HoldResolved` event.
 *
 * A held insert has no heads: `theirs` and `merged` create the node. When its
 * predecessor never reached the log, the resolver names where it goes with
 * `placement`; without one the insert keeps the placement it was submitted
 * with, and is held again if that predecessor is still missing. `placement`
 * is ignored for every other operation.
 *
 * **Example** (Resolve with a merged text)
 *
 * ```ts
 * import { ConflictResolution } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 *
 * const resolution = ConflictResolution.cases.merged.make({
 *   text: "Both facts, reconciled.",
 *   placement: O.none(),
 * })
 * console.log(resolution.choice)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictResolution = ConflictChoice.toTaggedUnion("choice")({
  ours: {},
  theirs: {
    placement: S.OptionFromOptionalKey(InsertPlacement).annotateKey({
      description: "New place for a held insert; absent keeps the submitted placement.",
    }),
  },
  merged: {
    text: S.NonEmptyString.annotateKey({ description: "Resolver-written replacement text." }),
    placement: S.OptionFromOptionalKey(InsertPlacement).annotateKey({
      description: "New place for a held insert; absent keeps the submitted placement.",
    }),
  },
}).pipe(
  $I.annoteSchema("ConflictResolution", {
    description: "Operator decision for a held conflict, discriminated on choice.",
  })
);

/**
 * Runtime type for {@link ConflictResolution}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictResolution = typeof ConflictResolution.Type;
