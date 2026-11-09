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
 * - `held`: a conflict needs a resolver; both texts are retained, so nothing
 *   is lost silently, and at least one finding explains why.
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
    nodeId: NodeId.annotateKey({ description: "Node waiting on a resolver." }),
    ours: S.String.annotateKey({ description: "Text the log holds for the node." }),
    theirs: S.String.annotateKey({ description: "Text the agent submitted." }),
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
 * A held write on the operator review list, with both texts retained.
 *
 * **Example** (Read the fields of a held conflict)
 *
 * ```ts
 * import { HeldConflict } from "@beep/agent-memory-store"
 *
 * console.log(HeldConflict.fields.since)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeldConflict extends S.Opaque<HeldConflict, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node waiting on a resolver." }),
    ours: S.String.annotateKey({ description: "Text the log holds for the node." }),
    theirs: S.String.annotateKey({ description: "Text the agent submitted." }),
    since: S.DateTimeUtcFromString.annotateKey({ description: "When the write was held." }),
    violations: S.NonEmptyArray(MemoryGateViolation).annotateKey({ description: "Findings that held the write." }),
  }).pipe(
    $I.annoteSchema("HeldConflict", {
      description: "A held write on the operator review list, with both texts retained.",
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
 * `ours` keeps the logged text, `theirs` takes the agent's text, and `merged`
 * supplies a new text written by the resolver.
 *
 * **Example** (Resolve with a merged text)
 *
 * ```ts
 * import { ConflictResolution } from "@beep/agent-memory-store"
 *
 * const resolution = ConflictResolution.cases.merged.make({ text: "Both facts, reconciled." })
 * console.log(resolution.choice)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictResolution = ConflictChoice.toTaggedUnion("choice")({
  ours: {},
  theirs: {},
  merged: {
    text: S.NonEmptyString.annotateKey({ description: "Resolver-written replacement text." }),
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
