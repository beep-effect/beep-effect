/**
 * Claim gate outcome resolution.
 *
 * The lifecycle transition treats a rejected verdict as a no-op: it hands the
 * claim back unchanged and the rejection survives only in whatever log line
 * produced it. That is the gap this use-case closes, WITHOUT touching the shared
 * transition — an admitted verdict is delegated to
 * `ClaimTransition.advance` exactly as before, and a rejected verdict is written
 * down as a durable {@link ClaimDisposition} so a refused claim reads as
 * deliberately refused rather than merely un-advanced.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainCandidateClaim from "@beep/epistemic-domain/entities/CandidateClaim";
import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { ClaimDispositionStatus, ClaimGateResult } from "@beep/epistemic-domain/values";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { Context, DateTime, Effect, flow } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { appendClaimDisposition, ClaimDispositionAppend } from "./ClaimDisposition.commands.ts";
import type { ClaimGateViolation, ClaimInvalidTransition } from "@beep/epistemic-domain/values";
import type { ClaimTransitionShape } from "../ClaimLifecycle/ClaimLifecycle.service.ts";
import type {
  ClaimDispositionRepositoryShape,
  ClaimDispositionRepositoryUnavailable,
} from "./ClaimDisposition.ports.ts";

const $I = $EpistemicUseCasesId.create("ClaimDisposition/ClaimDisposition.service");

const unexplainedRejection = "Claim gate rejected the claim without an explanatory violation.";

/**
 * Derive the disposition's headline reason from the violations that blocked
 * admission: the first violation carrying a message, or a fixed sentence when
 * the verdict carried none.
 *
 * The reason is a headline, not the record — every violation is stored verbatim
 * in the same row, so taking the first message loses nothing a reader cannot
 * recover, while a joined summary would grow without bound and still be a lossy
 * rendering of the array beside it.
 */
const rejectionReason: (violations: ReadonlyArray<ClaimGateViolation>) => string = flow(
  A.findFirst((violation: ClaimGateViolation) => Str.isNonEmpty(violation.message)),
  O.match({
    onNone: () => unexplainedRejection,
    onSome: (violation) => violation.message,
  })
);

/**
 * Everything the resolver needs to turn a gate verdict into an outcome.
 *
 * **Details**
 *
 * The disposition inherits the claim's `orgId` rather than accepting one: a
 * disposition belongs to the organization that owns the claim it resolves, and
 * that is not a caller's choice to make. `dispositionId` and `dispositionPublicId`
 * are the identity the caller reserves for the row; the database assigns the
 * SERIAL primary key on insert.
 *
 * **Example** (Decode gate outcome input)
 *
 * ```ts
 * import { ClaimGateOutcomeInput } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(ClaimGateOutcomeInput)({
 *   claim: {
 *     createdAt: 1,
 *     createdByPrincipal: { kind: "System", component: "Runtime" },
 *     entityType: "EpistemicCandidateClaim",
 *     fixtureKey: "claim.patentability",
 *     id: 1,
 *     lifecycle: "candidate",
 *     orgId: 1,
 *     publicId: "epistemic_candidate_claim_a1",
 *     rowVersion: 1,
 *     schemaVersion: "0.0.0",
 *     snapshot: {},
 *     source: "Agent",
 *     updatedAt: 1,
 *     updatedByPrincipal: { kind: "System", component: "Runtime" }
 *   },
 *   dispositionId: 1,
 *   dispositionPublicId: "epistemic_claim_disposition_a1",
 *   gateResult: { verdict: "admitted" },
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   schemaVersion: "0.0.0",
 *   source: "Agent"
 * })
 *
 * console.log(input.gateResult.verdict)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClaimGateOutcomeInput extends S.Class<ClaimGateOutcomeInput>($I`ClaimGateOutcomeInput`)(
  {
    claim: DomainCandidateClaim.CandidateClaim.annotateKey({
      description: "Candidate claim the gate verdict was produced for.",
    }),
    dispositionId: Epistemic.ClaimDispositionId.annotateKey({
      description: "Identity reserved for the disposition row; reassigned by the database on insert.",
    }),
    dispositionPublicId: ClaimDisposition.fields.publicId.annotateKey({
      description: "Stable external handle reserved for the disposition row.",
    }),
    gateResult: ClaimGateResult.annotateKey({
      description: "Typed admitted/rejected verdict returned by the claim gate.",
    }),
    resolvedBy: Principal.annotateKey({
      description: "Principal that resolved the claim.",
    }),
    schemaVersion: SemanticVersion.annotateKey({
      description: "Schema version stamped on a recorded disposition.",
    }),
    source: SourceKind.annotateKey({
      description: "Origin kind stamped on a recorded disposition.",
    }),
  },
  $I.annote("ClaimGateOutcomeInput", {
    description: "Input resolving one claim gate verdict into a lifecycle advance or a durable disposition.",
  })
) {}

/**
 * The result of resolving a gate verdict: the claim as it now stands, and the
 * disposition that was recorded if one was. An admitted verdict advances the
 * claim and records nothing; a rejected verdict records a disposition and leaves
 * the claim exactly as it was.
 *
 * **Example** (Make outcome without disposition)
 *
 * ```ts
 * import { ClaimGateOutcome } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { CandidateClaim } from "@beep/epistemic-domain"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const claim = S.decodeUnknownSync(CandidateClaim)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim.patentability",
 *   id: 1,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   publicId: "epistemic_candidate_claim_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: {},
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 * const outcome = ClaimGateOutcome.make({ claim, disposition: O.none() })
 *
 * console.log(O.isNone(outcome.disposition))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimGateOutcome extends S.Class<ClaimGateOutcome>($I`ClaimGateOutcome`)(
  {
    claim: DomainCandidateClaim.CandidateClaim.annotateKey({
      description: "Claim as it stands after the verdict was resolved.",
    }),
    disposition: ClaimDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Disposition recorded for a rejected verdict; absent when the claim advanced.",
    }),
  },
  $I.annote("ClaimGateOutcome", {
    description: "Outcome of resolving one claim gate verdict.",
  })
) {}

/**
 * Service shape for claim gate outcome resolution.
 *
 * **Example** (Define resolver shape)
 *
 * ```ts
 * import { ClaimGateOutcome } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import type { ClaimGateOutcomeResolverShape } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const shape: ClaimGateOutcomeResolverShape = {
 *   resolve: (input) => Effect.succeed(ClaimGateOutcome.make({ claim: input.claim, disposition: O.none() }))
 * }
 *
 * console.log(typeof shape.resolve)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ClaimGateOutcomeResolverShape {
  readonly resolve: (
    input: ClaimGateOutcomeInput
  ) => Effect.Effect<ClaimGateOutcome, ClaimDispositionRepositoryUnavailable | ClaimInvalidTransition>;
}

/**
 * Claim gate outcome resolver service tag.
 *
 * **Example** (Provide resolver service)
 *
 * ```ts
 * import { ClaimGateOutcome, ClaimGateOutcomeResolver } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* ClaimGateOutcomeResolver
 *   return typeof resolver.resolve === "function"
 * }).pipe(
 *   Effect.provideService(
 *     ClaimGateOutcomeResolver,
 *     ClaimGateOutcomeResolver.of({
 *       resolve: (input) =>
 *         Effect.succeed(ClaimGateOutcome.make({ claim: input.claim, disposition: O.none() }))
 *     })
 *   )
 * )
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimGateOutcomeResolver extends Context.Service<
  ClaimGateOutcomeResolver,
  ClaimGateOutcomeResolverShape
>()($I`ClaimGateOutcomeResolver`) {}

const buildRejection = (
  input: ClaimGateOutcomeInput,
  violations: ReadonlyArray<ClaimGateViolation>,
  resolvedAt: DateTime.Utc
): ClaimDisposition =>
  appendClaimDisposition(
    ClaimDispositionAppend.make({
      claimId: input.claim.id,
      createdAt: resolvedAt,
      createdByPrincipal: input.resolvedBy,
      id: input.dispositionId,
      orgId: input.claim.orgId,
      publicId: input.dispositionPublicId,
      reason: rejectionReason(violations),
      resolvedAt,
      resolvedBy: input.resolvedBy,
      rowVersion: PosInt.make(1),
      schemaVersion: input.schemaVersion,
      source: input.source,
      status: ClaimDispositionStatus.Enum.rejected,
      updatedAt: resolvedAt,
      updatedByPrincipal: input.resolvedBy,
      violations,
    })
  );

/**
 * Build the claim gate outcome resolver from resolved dependencies. Pure factory
 * over the disposition repository and the shared lifecycle transition — the
 * transition is consumed exactly as published, never re-implemented.
 *
 * **Example** (Build and resolve admitted)
 *
 * ```ts
 * import { ClaimGateOutcomeInput, makeClaimGateOutcomeResolver } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const resolver = makeClaimGateOutcomeResolver(
 *   {
 *     listByClaim: () => Effect.succeed([]),
 *     record: (disposition) => Effect.succeed(disposition)
 *   },
 *   makeClaimTransition()
 * )
 * const input = S.decodeUnknownSync(ClaimGateOutcomeInput)({
 *   claim: {
 *     createdAt: 1,
 *     createdByPrincipal: { kind: "System", component: "Runtime" },
 *     entityType: "EpistemicCandidateClaim",
 *     fixtureKey: "claim.patentability",
 *     id: 1,
 *     lifecycle: "candidate",
 *     orgId: 1,
 *     publicId: "epistemic_candidate_claim_a1",
 *     rowVersion: 1,
 *     schemaVersion: "0.0.0",
 *     snapshot: {},
 *     source: "Agent",
 *     updatedAt: 1,
 *     updatedByPrincipal: { kind: "System", component: "Runtime" }
 *   },
 *   dispositionId: 1,
 *   dispositionPublicId: "epistemic_claim_disposition_a1",
 *   gateResult: { verdict: "admitted" },
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   schemaVersion: "0.0.0",
 *   source: "Agent"
 * })
 *
 * console.log(Effect.runSync(resolver.resolve(input)).claim.lifecycle)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimGateOutcomeResolver = (
  dispositions: ClaimDispositionRepositoryShape,
  transition: ClaimTransitionShape
): ClaimGateOutcomeResolverShape => ({
  resolve: (input) =>
    ClaimGateResult.match(input.gateResult, {
      admitted: () =>
        Effect.map(transition.advance(input.claim, input.gateResult), (claim) =>
          ClaimGateOutcome.make({ claim, disposition: O.none() })
        ),
      rejected: (rejection) =>
        DateTime.now.pipe(
          Effect.flatMap((resolvedAt) => dispositions.record(buildRejection(input, rejection.violations, resolvedAt))),
          Effect.map((disposition) => ClaimGateOutcome.make({ claim: input.claim, disposition: O.some(disposition) }))
        ),
    }).pipe(Effect.withSpan("epistemic.claim_disposition.resolve_gate_outcome")),
});
