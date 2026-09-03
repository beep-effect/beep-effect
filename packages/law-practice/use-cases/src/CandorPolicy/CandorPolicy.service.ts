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
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CandorDispositionLifecycle, PatentReference } from "@beep/law-practice-domain";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { Effect, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CandorPolicy, CandorPolicyShape, CandorRecordReader } from "./CandorPolicy.ports.ts";
import { CandorGateVerdict, UncoveredEvent } from "./CandorPolicy.values.ts";
import type { CandorDisposition, PatentCitationEvent } from "@beep/law-practice-domain";
import type { CandorFilingScope, UncoveredReason } from "./CandorPolicy.values.ts";

const $I = $LawPracticeUseCasesId.create("CandorPolicy/CandorPolicy.service");

const IdentifiedPatentReference = PatentReference.pipe(
  S.check(
    S.makeFilter((reference) => O.isSome(reference.number), {
      identifier: $I`IdentifiedPatentReferenceCheck`,
      title: "Identified patent reference",
      description: "A patent reference carrying the publication number that identifies its document.",
      message: "Expected a patent reference with a publication number",
    })
  ),
  $I.annoteSchema("IdentifiedPatentReference", {
    description: "Patent reference with a present publication number suitable for identity comparisons.",
  })
);
const isIdentifiedPatentReference = S.is(IdentifiedPatentReference);
const samePatentReference = S.toEquivalence(PatentReference);
const CitationLineageKey = S.Struct({ reference: PatentReference, sourceRef: S.String });
const encodeCitationLineageKey = S.encodeSync(S.fromJsonString(CitationLineageKey));
const sameIdentifiedPatentReference = (head: PatentReference, candidate: PatentReference): boolean =>
  isIdentifiedPatentReference(head) && samePatentReference(head, candidate);

/**
 * Every disposition id that some other recorded disposition retires.
 *
 * This is deliberately computed over the WHOLE recorded set, never over a
 * subset already filtered to one event. A superseding record is free to carry a
 * different `disposes` binding than the record it retires, so filtering first
 * would drop the retiring row before its `supersedes` reference was ever read
 * and leave a retired judgment looking effective — a fail-open hole in a gate
 * whose entire purpose is to fail closed.
 */
const retiredDispositionIds = (dispositions: ReadonlyArray<CandorDisposition>): HashSet.HashSet<number> =>
  HashSet.fromIterable(A.getSomes(A.map(dispositions, (disposition) => disposition.supersedes)));

/**
 * A disposition is effective only if it declares itself live and nothing later
 * retires it. Both halves matter: a `superseded` or `withdrawn` record removes
 * its own coverage, and an appended superseding record removes the coverage of
 * the record it names.
 */
const effectiveDispositions = (
  candidates: ReadonlyArray<CandorDisposition>,
  retired: HashSet.HashSet<number>
): ReadonlyArray<CandorDisposition> =>
  A.filter(
    candidates,
    (disposition) =>
      CandorDispositionLifecycle.is.active(disposition.lifecycle) && !HashSet.has(retired, disposition.id)
  );

/**
 * Derive which events of one source group have been superseded.
 *
 * **Details**
 *
 * A supersession link is honoured only when the named event is present, its
 * observation carries the named digest, and both events have equal parsed
 * patent references whose head carries a publication number. Empty references,
 * dangling links, and mismatches do not move the head, leaving lineage
 * ambiguous rather than releasing an obligation.
 */
const supersededEventIds = (group: ReadonlyArray<PatentCitationEvent>) =>
  HashSet.fromIterable(
    A.getSomes(
      A.map(group, (event) =>
        O.flatMap(event.supersedes, (ref) =>
          O.map(
            A.findFirst(
              group,
              (candidate) =>
                candidate.id === ref.eventId &&
                candidate.grounding.source.textDigest === ref.textDigest &&
                sameIdentifiedPatentReference(event.reference, candidate.reference)
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
    .pipe(Effect.asSome, Effect.orElseSucceed(O.none));

  return yield* O.match(resolved, {
    onNone: () => Effect.succeedSome<UncoveredReason>("source-unresolved"),
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
  // Retirement is derived before the binding filter, so a superseding record
  // that names a different observation still retires what it points at.
  const retired = retiredDispositionIds(dispositions);
  const bound = A.filter(
    dispositions,
    (disposition) =>
      disposition.disposes.eventId === head.id && disposition.disposes.textDigest === head.grounding.source.textDigest
  );
  if (A.isReadonlyArrayNonEmpty(bound) === false) {
    return O.some("no-disposition");
  }

  const standing = effectiveDispositions(bound, retired);
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
 * Evaluate one source group, returning every recorded event it leaves
 * uncovered.
 *
 * Currency is derived from declared supersession alone. A group with exactly
 * one head is answered by that head's coverage, and every recorded event in
 * the group shares that answer — which is why superseding an observation
 * never releases the gate and disposing the newer observation releases the
 * whole group at once. A group without exactly one head is ambiguous, and
 * ambiguity blocks.
 *
 * Discovery provenance records how the event entered the system; it no longer
 * decides whether the event participates. An examiner-observed event therefore
 * initiates gating in its own right and remains clearable only by a human
 * disposition bound to the current observation.
 */
const evaluateGroup = Effect.fn("CandorPolicy.evaluateGroup")(function* (
  group: ReadonlyArray<PatentCitationEvent>,
  dispositions: ReadonlyArray<CandorDisposition>
): Effect.fn.Return<ReadonlyArray<UncoveredEvent>, never, SourceTextResolver | import("effect/Crypto").Crypto> {
  const superseded = supersededEventIds(group);
  const heads = A.filter(group, (event) => !HashSet.has(superseded, event.id));

  const uncoveredWith = (reason: UncoveredReason) =>
    A.map(group, (event) => UncoveredEvent.make({ eventId: event.id, reason }));

  if (A.length(heads) !== 1) {
    return uncoveredWith("ambiguous-lineage");
  }

  const reason = yield* O.match(A.get(heads, 0), {
    onNone: () => Effect.succeedSome<UncoveredReason>("ambiguous-lineage"),
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
 * by `sourceRef` and the parsed patent reference. Currency is a question about
 * successive observations of one cited document, not every citation that an
 * examiner happened to record in the same prosecution document.
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
    evaluate: Effect.fn("CandorPolicy.evaluate")(function* (scope: CandorFilingScope) {
      const reader = yield* CandorRecordReader;
      const snapshot = yield* reader.snapshotForFiling(scope);

      const events = A.dedupeWith(snapshot.events, (left, right) => left.id === right.id);
      const groups = A.groupBy(events, (event) =>
        encodeCitationLineageKey({
          reference: event.reference,
          sourceRef: event.grounding.source.sourceRef,
        })
      );

      const uncovered = yield* Effect.forEach(R.values(groups), (group) => evaluateGroup(group, snapshot.dispositions));

      return CandorGateVerdict.make({
        scope,
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
