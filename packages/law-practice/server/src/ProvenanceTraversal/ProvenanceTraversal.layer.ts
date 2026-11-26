/**
 * Provenance traversal over the law claim store under the matter wall.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LawClaimAdmissions, LawClaimProposals } from "@beep/law-practice-use-cases/ClaimStore";
import { LawPrincipal, MatterAccess, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import {
  ClaimProvenance,
  ProvenanceResult,
  ProvenanceTraversal,
} from "@beep/law-practice-use-cases/ProvenanceTraversal";
import { mintCaptureId } from "@beep/text/Capture";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { ClaimId } from "@beep/epistemics/ClaimCore";
import type { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import type { CaptureId } from "@beep/text/Capture";
import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity";

/**
 * Span attribute naming the traversal's answer, `Found` or `Missing`.
 *
 * **Example** (Name the traversal outcome span attribute)
 *
 * ```ts
 * import { ProvenanceOutcomeAttribute } from "@beep/law-practice-server/ProvenanceTraversal"
 *
 * console.log(ProvenanceOutcomeAttribute) // "beep.law_practice.provenance_outcome"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProvenanceOutcomeAttribute = "beep.law_practice.provenance_outcome";

/**
 * Span attribute counting the activity records a traversal omitted.
 *
 * **Example** (Name the omitted activity count span attribute)
 *
 * ```ts
 * import { ProvenanceOmittedActivitiesAttribute } from "@beep/law-practice-server/ProvenanceTraversal"
 *
 * console.log(ProvenanceOmittedActivitiesAttribute) // "beep.law_practice.provenance_omitted_activities"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProvenanceOmittedActivitiesAttribute = "beep.law_practice.provenance_omitted_activities";

const missing = (): ProvenanceResult => ProvenanceResult.cases.Missing.make({});

const usesOnly = (granted: HashMap.HashMap<CaptureId, boolean>) => (record: ActivityRecord) =>
  HashMap.every(granted, (isGranted, capture) => isGranted || !HashSet.has(record.start.used, capture));

/**
 * Provenance traversal over the claim store ports and the matter wall.
 *
 * **Details**
 *
 * `fromClaim` reads the stored proposal and authorizes `provenance-traversal`
 * on its scope; an absent or denied claim answers `Missing`. Each capture
 * identity stored with the proposal is minted to its capture id and
 * authorized on its own scope. An activity record that used a denied capture
 * is omitted, and the provenance keeps the granted captures the kept records
 * used, with the claim's admissions. A store or mint failure is a defect.
 *
 * **Example** (Reference the traversal layer)
 *
 * ```ts
 * import { ProvenanceTraversalLive } from "@beep/law-practice-server/ProvenanceTraversal"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ProvenanceTraversalLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProvenanceTraversalLive: Layer.Layer<
  ProvenanceTraversal,
  never,
  LawClaimProposals | LawClaimAdmissions | MatterAuthority | LawPrincipal | Digest.Digest
> = Layer.effect(
  ProvenanceTraversal,
  Effect.gen(function* () {
    const { principal } = yield* LawPrincipal;
    const authority = yield* MatterAuthority;
    const proposals = yield* LawClaimProposals;
    const admissions = yield* LawClaimAdmissions;
    const digest = yield* Digest.Digest;
    const traversable = (identity: SourceTextIdentity) =>
      Effect.map(
        authority.authorize({ principal, scope: identity.scopeRef, access: "provenance-traversal" }),
        MatterAccess.guards.Granted
      );
    const capturesOf = Effect.fnUntraced(function* (claim: ClaimId) {
      const identities = yield* proposals.captures(claim);
      return yield* Effect.forEach(
        identities,
        (identity) =>
          Effect.all([mintCaptureId(identity), traversable(identity)], { concurrency: 1 }).pipe(
            Effect.provideService(Digest.Digest, digest)
          ),
        { concurrency: 1 }
      );
    });
    const traverse = Effect.fnUntraced(function* (claim: ClaimId) {
      const stored = yield* proposals.get(claim);
      if (O.isNone(stored)) return missing();
      const access = yield* authority.authorize({
        principal,
        scope: stored.value.core.scope,
        access: "provenance-traversal",
      });
      if (MatterAccess.guards.Denied(access)) return missing();
      const captured = yield* capturesOf(claim);
      const granted = HashMap.fromIterable(captured);
      const records = yield* proposals.activities(claim);
      const kept = HashSet.filter(records, usesOnly(granted));
      const captures = pipe(
        HashMap.toEntries(granted),
        A.filter(
          ([capture, isGranted]) => isGranted && HashSet.some(kept, (record) => HashSet.has(record.start.used, capture))
        ),
        A.map(([capture]) => capture),
        HashSet.fromIterable
      );
      const admitted = yield* admissions.admissions(claim);
      yield* Effect.annotateCurrentSpan(
        ProvenanceOmittedActivitiesAttribute,
        HashSet.size(records) - HashSet.size(kept)
      );
      return ProvenanceResult.cases.Found.make({
        provenance: ClaimProvenance.make({ claim, activities: kept, captures, admissions: admitted }),
      });
    });
    const fromClaim = Effect.fn("ProvenanceTraversal.fromClaim")(function* (claim: ClaimId) {
      const result = yield* traverse(claim).pipe(Effect.orDie);
      yield* Effect.annotateCurrentSpan(ProvenanceOutcomeAttribute, result._tag);
      return result;
    });
    return ProvenanceTraversal.of({ fromClaim });
  })
);
