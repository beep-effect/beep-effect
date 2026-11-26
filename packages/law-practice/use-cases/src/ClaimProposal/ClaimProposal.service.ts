/**
 * Claim proposal over the proposal store port, the matter wall and the
 * authorized source-text resolver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GenerationFact } from "@beep/epistemics/Admission";
import { ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { extractionDocumentCodec } from "@beep/langextract/Handoff";
import {
  LawClaimArrows,
  LawClaimCore,
  LawProposedClaimRecord,
  logicalKey,
} from "@beep/law-practice-domain/values/LawClaim";
import { ActivityFacts, ActivityFloor, CurrentActivity, withActivity } from "@beep/nlp-processing/Activity";
import { mintCaptureId } from "@beep/text/Capture";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { LawClaimProposals, ProposedClaimEntry, ProposedClaimLookup } from "../ClaimStore/index.ts";
import { LawPrincipal, MatterAccess, MatterAuthority } from "../MatterWall/index.ts";
import { ClaimProposalRefused } from "./ClaimProposal.errors.ts";
import { ClaimProposal } from "./ClaimProposal.ports.ts";
import type { AnnotationId } from "@beep/annotation/AnnotationId";
import type { ExtractionDocument } from "@beep/annotation/Kinds";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { ScopeRef } from "@beep/law-practice-domain/values/LawClaim";
import type { ContentHash } from "@beep/schema/ContentHash";
import type * as Shared from "@beep/shared-domain/identity/Shared";
import type { OccurrenceId } from "@beep/text/Occurrence";
import type { VerifiedTextAnchor } from "@beep/text/VerifiedTextAnchor";
import type { MatterAuthorityShape } from "../MatterWall/index.ts";
import type { ClaimProposalRequest } from "./ClaimProposal.values.ts";

const proposalPin = ActivityPin.cases.Engine.make({ engine: "law-practice-claim-proposal", edition: "1" });
const ProposeClaimTerm = TermIri.make(iri("operation:ProposeClaim"));

/**
 * Asks the matter wall for `claim-proposal` on one capture scope and refuses
 * a denied scope.
 *
 * **Details**
 *
 * The matter outcome is recorded on the caller's current span as
 * `beep.law_practice.matter_outcome`. A `Denied` access fails with the
 * `DeniedScope` refusal; a `Granted` access is returned unchanged. Both the
 * claim proposal path and the office-action review gate on it.
 *
 * **Example** (Reference the proposal gate)
 *
 * ```ts
 * import { authorizeClaimProposal } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * console.log(typeof authorizeClaimProposal) // "function"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const authorizeClaimProposal = Effect.fnUntraced(function* (
  authority: MatterAuthorityShape,
  principal: Shared.UserId,
  scope: ScopeRef
) {
  const access = yield* authority.authorize({ principal, scope, access: "claim-proposal" });
  yield* Effect.annotateCurrentSpan({ "beep.law_practice.matter_outcome": access._tag });
  if (MatterAccess.guards.Denied(access)) return yield* Effect.fail(ClaimProposalRefused.cases.DeniedScope.make({}));
  return access;
});

const invalidDocument = (): ClaimProposalRefused => ClaimProposalRefused.cases.InvalidDocument.make({});

const unverifiedSupport = (): ClaimProposalRefused =>
  ClaimProposalRefused.cases.SupportUnverified.make({ reason: "invalid-creation-support" });

interface Supported {
  readonly candidates: HashSet.HashSet<AnnotationId>;
  readonly document: ExtractionDocument;
  readonly request: ClaimProposalRequest;
  readonly support: HashSet.HashSet<OccurrenceId>;
  readonly verified: ReadonlyArray<VerifiedTextAnchor>;
}

interface Proposed {
  readonly generation: GenerationFact;
  readonly record: LawProposedClaimRecord;
}

const supportOf = (
  document: ExtractionDocument,
  candidates: HashSet.HashSet<AnnotationId>
): O.Option<HashSet.HashSet<OccurrenceId>> =>
  O.map(
    O.all(
      candidates.pipe(
        A.fromIterable,
        A.map((candidate) => HashMap.get(document.annotations, candidate))
      )
    ),
    A.reduce(HashSet.empty<OccurrenceId>(), (support, annotation) => HashSet.union(support, annotation.targets))
  );

const proposeClaim = withActivity<Supported, Proposed, PreimageMintError, Digest.Digest>({
  facts: Effect.fnUntraced(function* (supported: Supported) {
    const capture = yield* mintCaptureId(supported.document.text);
    return ActivityFacts.make({
      pin: proposalPin,
      promptDigest: O.none(),
      used: HashSet.make<ReadonlyArray<ContentHash>>(capture, ...supported.candidates, ...supported.support),
    });
  }),
  generated: (proposed) => [proposed.record.claim],
})<never, Digest.Digest | CurrentActivity>({
  name: ProposeClaimTerm,
  run: Effect.fn("ClaimProposal.proposeClaim")(function* (supported: Supported) {
    const activity = yield* CurrentActivity;
    const at = yield* activity.stamp;
    const core = LawClaimCore.make({
      proposition: supported.request.proposition,
      logicalKey: logicalKey(supported.request.proposition),
      supportAtCreation: supported.support,
      derivedFrom: HashSet.empty(),
      supersedes: O.none(),
      generatedBy: activity.id,
      assertedBy: { _tag: "SoftwareAgent", name: "ClaimProposal", pin: proposalPin },
      valid: { _tag: "Unknown" },
      knowledgeStart: at,
      scope: supported.document.text.scopeRef,
    });
    const generation = GenerationFact.make({ activity: activity.id, at });
    const promoted = yield* LawClaimArrows.promote({
      core,
      document: supported.document,
      candidates: supported.candidates,
      verified: supported.verified,
      generation,
    }).pipe(Effect.orDie);
    return { record: LawProposedClaimRecord.make(promoted), generation };
  }),
});

/**
 * Claim proposal: the checked document decode, the matter wall, support
 * re-verified against current text, then one proposal per scope partition.
 *
 * **Details**
 *
 * `propose` decodes the document through the annotation package's checked
 * decode, asks the matter wall for `claim-proposal` on the document's capture
 * scope and re-verifies every supporting anchor against the text the
 * authorized resolver returns. Inside the scope's partition it first looks the
 * proposal up by scope, logical key and creation support: a stored proposal is
 * returned with no new activity, mint or append. Otherwise the `ProposeClaim`
 * activity starts no earlier than the partition's last knowledge start,
 * promotes the candidates and appends the record with its generation fact and
 * activity record. Every refusal `promote` could raise is checked before it
 * runs, so a promote refusal, a store failure and a mint failure are defects.
 * The layer requires no admission port, so the proposal path cannot admit.
 *
 * **Example** (Reference the proposal layer)
 *
 * ```ts
 * import { ClaimProposalLayer } from "@beep/law-practice-use-cases/ClaimProposal"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ClaimProposalLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimProposalLayer: Layer.Layer<
  ClaimProposal,
  never,
  LawClaimProposals | MatterAuthority | LawPrincipal | SourceTextResolver | Digest.Digest
> = Layer.effect(
  ClaimProposal,
  Effect.gen(function* () {
    const { principal } = yield* LawPrincipal;
    const authority = yield* MatterAuthority;
    const proposals = yield* LawClaimProposals;
    const resolver = yield* SourceTextResolver;
    const digest = yield* Digest.Digest;
    const propose = Effect.fn("ClaimProposal.propose")(
      function* (request: ClaimProposalRequest) {
        const document = yield* extractionDocumentCodec
          .encode(request.document)
          .pipe(Effect.flatMap(extractionDocumentCodec.decode), Effect.mapError(invalidDocument));
        const scope = document.text.scopeRef;
        yield* authorizeClaimProposal(authority, principal, scope);
        const support = yield* Effect.fromOption(supportOf(document, request.candidates)).pipe(
          Effect.mapError(unverifiedSupport)
        );
        const current = yield* resolver
          .resolve(ResolveSourceTextRequest.make({ identity: document.text }))
          .pipe(Effect.mapError(unverifiedSupport));
        const verified = yield* Effect.forEach(
          A.fromIterable(support),
          (occurrence) => {
            const { receipt } = HashMap.getUnsafe(document.anchors, occurrence);
            return verifyTextAnchor(
              VerifyTextAnchorInput.make({
                expectedSource: receipt.source,
                source: current.identity,
                sourceText: current.text,
                anchor: receipt.anchor,
              })
            ).pipe(Effect.mapError(unverifiedSupport));
          },
          { concurrency: 1 }
        );
        const lookup = ProposedClaimLookup.make({
          scope,
          logicalKey: logicalKey(request.proposition),
          supportAtCreation: support,
        });
        const supported: Supported = { candidates: request.candidates, document, request, support, verified };
        return yield* proposals
          .withPartition(scope, (last) =>
            Effect.flatMap(
              proposals.findProposed(lookup),
              O.match({
                onSome: Effect.succeed,
                onNone: () =>
                  proposeClaim.run(supported).pipe(
                    Effect.provideService(ActivityFloor, last),
                    Effect.orDie,
                    Effect.tap((logged) =>
                      proposals.appendProposed(
                        ProposedClaimEntry.make({
                          record: logged.value.record,
                          generation: logged.value.generation,
                          activities: logged.activities,
                          captures: HashSet.make(supported.document.text),
                        })
                      )
                    ),
                    Effect.map((logged) => logged.value.record)
                  ),
              })
            )
          )
          .pipe(Effect.catchTag("LawClaimStoreError", Effect.die));
      },
      Effect.provideService(Digest.Digest, digest)
    );
    return ClaimProposal.of({ propose });
  })
);
