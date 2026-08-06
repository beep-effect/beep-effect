/**
 * Derived, fail-closed candor gate implementation whose predicate is
 * recomputed on every call from recorded events and recorded
 * attorney judgments. Nothing here stores, caches, or infers a "duty satisfied"
 * state, and nothing here computes a legal judgment: every branch either finds
 * a recorded human decision bound to an exact observation version, or declines
 * to treat the event as covered and says why.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CandorDispositionLifecycle } from "@beep/law-practice-domain";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { Effect, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { CandorPolicy, CandorPolicyShape, CandorRecordReader } from "./CandorPolicy.ports.ts";
import { CandorGateVerdict, UncoveredEvent } from "./CandorPolicy.values.ts";
import type { CandorDisposition, CitingApplicationIdentity, PatentCitationEvent } from "@beep/law-practice-domain";
import type { UncoveredReason } from "./CandorPolicy.values.ts";

/**
 * Whether one event's discovery provenance puts it in the gate's quantified
 * set. Examiner-observed occurrences are recorded and never gate.
 */
const isAiDiscovered = (event: PatentCitationEvent): boolean => event.discovery.kind === "AiDiscovered";

/**
 * A disposition is effective only if it declares itself live and nothing later
 * retires it. Both halves matter: a `superseded` or `withdrawn` record removes
 * its own coverage, and an appended superseding record removes the coverage of
 * the record it names.
 */
const effectiveDispositions = (dispositions: ReadonlyArray<CandorDisposition>): ReadonlyArray<CandorDisposition> => {
  const retired = HashSet.fromIterable(A.getSomes(A.map(dispositions, (disposition) => disposition.supersedes)));
  return A.filter(
    dispositions,
    (disposition) =>
      CandorDispositionLifecycle.is.active(disposition.lifecycle) && !HashSet.has(retired, disposition.id)
  );
};

/**
 * Derive which events of one source group have been superseded.
 *
 * A supersession link is honoured only when the named event is present in the
 * group and its recorded observation carries exactly the named digest. A
 * dangling or mismatched link is neither repaired nor ignored — it simply does
 * not move the head, which is what leaves forked lineage ambiguous.
 */
const supersededEventIds = (group: ReadonlyArray<PatentCitationEvent>) =>
  HashSet.fromIterable(
    A.getSomes(
      A.map(group, (event) =>
        O.flatMap(event.supersedes, (ref) =>
          O.map(
            A.findFirst(
              group,
              (candidate) => candidate.id === ref.eventId && candidate.grounding.source.textDigest === ref.textDigest
            ),
            (target) => target.id
          )
        )
      )
    )
  );

/**
 * Why the current observation of one source is not covered, or `O.none()` when
 * it is. Every failure path returns a reason rather than raising, because a
 * source that will not resolve or an anchor that will not re-verify must block
 * promotion rather than skip the check.
 */
const coverageReason = Effect.fn("CandorPolicy.coverageReason")(function* (
  head: PatentCitationEvent,
  dispositions: ReadonlyArray<CandorDisposition>
): Effect.fn.Return<O.Option<UncoveredReason>, never, SourceTextResolver | import("effect/Crypto").Crypto> {
  if (O.isSome(head.quarantine)) {
    return O.some("quarantined");
  }
  if (O.isSome(head.possibleDuplicateOf)) {
    return O.some("possible-duplicate");
  }

  const resolver = yield* SourceTextResolver;
  const resolved = yield* resolver
    .resolve(ResolveSourceTextRequest.make({ identity: head.grounding.source }))
    .pipe(Effect.map(O.some), Effect.orElseSucceed(O.none));

  return yield* O.match(resolved, {
    onNone: () => Effect.succeed(O.some<UncoveredReason>("source-unresolved")),
    onSome: (source) =>
      verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: head.grounding.anchor,
          expectedSource: head.grounding.source,
          source: source.identity,
          sourceText: source.text,
        })
      ).pipe(
        Effect.map(() => dispositionReason(head, dispositions)),
        Effect.orElseSucceed(() => O.some<UncoveredReason>("anchor-unverified"))
      ),
  });
});

/**
 * Why no recorded judgment covers this exact observation, or `O.none()` when
 * one does. The order of the checks is the order in which a reader would want
 * the answer: is there a judgment at all, does it still stand, did a human make
 * it, and did that human record a Rule 56 decision.
 */
const dispositionReason = (
  head: PatentCitationEvent,
  dispositions: ReadonlyArray<CandorDisposition>
): O.Option<UncoveredReason> => {
  const bound = A.filter(
    dispositions,
    (disposition) =>
      disposition.disposes.eventId === head.id && disposition.disposes.textDigest === head.grounding.source.textDigest
  );
  if (A.isReadonlyArrayNonEmpty(bound) === false) {
    return O.some("no-disposition");
  }

  const standing = effectiveDispositions(bound);
  if (A.isReadonlyArrayNonEmpty(standing) === false) {
    return O.some("disposition-not-effective");
  }

  const authored = A.filter(standing, (disposition) => disposition.createdByPrincipal.kind === "User");
  if (A.isReadonlyArrayNonEmpty(authored) === false) {
    return O.some("disposition-author-not-user");
  }

  const judged = A.filter(authored, (disposition) => O.isSome(disposition.rule56Judgment));
  return A.isReadonlyArrayNonEmpty(judged) ? O.none() : O.some("no-rule56-judgment");
};

/**
 * Evaluate one source group, returning the uncovered AI-discovered events it
 * contributes.
 *
 * Currency is derived from declared supersession alone. A group with exactly
 * one head is answered by that head's coverage, and every AI-discovered event
 * in the group shares that answer — which is why superseding an observation
 * never releases the gate and disposing the newer observation releases the
 * whole group at once. A group without exactly one head is ambiguous, and
 * ambiguity blocks.
 */
const evaluateGroup = Effect.fn("CandorPolicy.evaluateGroup")(function* (
  group: ReadonlyArray<PatentCitationEvent>,
  dispositions: ReadonlyArray<CandorDisposition>
): Effect.fn.Return<ReadonlyArray<UncoveredEvent>, never, SourceTextResolver | import("effect/Crypto").Crypto> {
  const aiEvents = A.filter(group, isAiDiscovered);
  if (A.isReadonlyArrayNonEmpty(aiEvents) === false) {
    return A.empty<UncoveredEvent>();
  }

  const superseded = supersededEventIds(group);
  const heads = A.filter(group, (event) => !HashSet.has(superseded, event.id));

  const uncoveredWith = (reason: UncoveredReason) =>
    A.map(aiEvents, (event) => UncoveredEvent.make({ eventId: event.id, reason }));

  if (A.length(heads) !== 1) {
    return uncoveredWith("ambiguous-lineage");
  }

  const reason = yield* O.match(A.get(heads, 0), {
    onNone: () => Effect.succeed(O.some<UncoveredReason>("ambiguous-lineage")),
    onSome: (head) => coverageReason(head, dispositions),
  });

  return O.match(reason, {
    onNone: A.empty<UncoveredEvent>,
    onSome: uncoveredWith,
  });
});

/**
 * Build the gate implementation.
 *
 * **When to use**
 *
 * Use when composing a runtime that needs the candor gate. Most callers should
 * take {@link CandorPolicyLive} instead; this constructor exists so a caller
 * can wrap the shape without re-implementing the predicate.
 *
 * **Details**
 *
 * Events are deduplicated by id before anything else, so redelivering a record
 * that was already recorded cannot move a head or change a verdict. Grouping is
 * by `sourceRef`, the version-independent logical-source key, because currency
 * is a question about one source's observations.
 *
 * **Example** (Evaluate through the constructed shape)
 *
 * ```ts
 * import { makeCandorPolicy } from "@beep/law-practice-use-cases/CandorPolicy"
 *
 * console.log(typeof makeCandorPolicy().evaluate) // "function"
 * ```
 *
 * @returns The candor gate service shape.
 * @category constructors
 * @since 0.0.0
 */
export const makeCandorPolicy = (): CandorPolicyShape =>
  CandorPolicyShape.make({
    evaluate: Effect.fn("CandorPolicy.evaluate")(function* (citingApplication: CitingApplicationIdentity) {
      const reader = yield* CandorRecordReader;
      const recorded = yield* reader.eventsForFiling(citingApplication);
      const dispositions = yield* reader.dispositionsForFiling(citingApplication);

      const events = A.dedupeWith(recorded, (left, right) => left.id === right.id);
      const groups = A.groupBy(events, (event) => event.grounding.source.sourceRef);

      const uncovered = yield* Effect.forEach(R.values(groups), (group) => evaluateGroup(group, dispositions));

      return CandorGateVerdict.make({
        citingApplication,
        uncovered: A.flatten(uncovered),
      });
    }),
  });

/**
 * Layer providing the derived candor gate.
 *
 * **Details**
 *
 * The layer itself has no dependencies. The record seam, the source-text
 * resolver, and `Crypto.Crypto` all travel in the requirement channel of
 * `evaluate`, so the caller decides where recorded material and source custody
 * come from and this slice never owns a live layer for either.
 *
 * **Example** (Provide the gate)
 *
 * ```ts
 * import { CandorPolicyLive } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CandorPolicyLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorPolicyLive: Layer.Layer<CandorPolicy> = Layer.succeed(CandorPolicy, makeCandorPolicy());
