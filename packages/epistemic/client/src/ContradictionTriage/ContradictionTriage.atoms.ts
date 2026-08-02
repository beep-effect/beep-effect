/**
 * Atom-first client state for the contradiction-triage workspace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ContradictionCandidatePageLimit,
  ContradictionListPayload,
  ContradictionRpcs,
  EvidenceSourcePagePayload,
  GetContradictionCandidate,
} from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Int";
import { DateTime, Effect, pipe } from "effect";
import * as O from "effect/Option";
import { AsyncResult, Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { epistemicProtocolLayerAtom } from "../Protocol.ts";
import type {
  ContradictionCandidateDetailView,
  ContradictionCandidatePage,
  ContradictionDispositionFilter,
  EvidenceSourcePage,
  EvidenceSourcePageSelector,
  ReviewContradictionCandidate,
} from "@beep/epistemic-use-cases/public";

const CONTRADICTION_QUEUE_KEY = "epistemic:contradiction-queue" as const;

/**
 * Maximum number of contradiction candidates requested per queue page.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_QUEUE_LIMIT } from "@beep/epistemic-client"
 * import * as A from "effect/Array"
 *
 * const visibleCandidateIds = A.take(A.range(1, 75), CONTRADICTION_QUEUE_LIMIT)
 * console.log(visibleCandidateIds.length) // 50
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QUEUE_LIMIT = ContradictionCandidatePageLimit.make(50);

/**
 * RPC client for the authenticated contradiction-triage surface.
 *
 * @example
 * ```ts
 * import { ContradictionClient } from "@beep/epistemic-client"
 *
 * console.log(typeof ContradictionClient.runtime.fn === "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ContradictionClient extends AtomRpc.Service<ContradictionClient>()("ContradictionClient", {
  group: ContradictionRpcs,
  protocol: (get) => get(epistemicProtocolLayerAtom),
}) {}

const detailKey = (candidateId: GetContradictionCandidate["candidateId"]): string =>
  `epistemic:contradiction-detail:${candidateId}`;

const sourceKey = (
  candidateId: EvidenceSourcePagePayload["candidateId"],
  evidenceId: EvidenceSourcePagePayload["evidenceId"]
): string => `epistemic:contradiction-source:${candidateId}:${evidenceId}`;

/**
 * Disposition filter selected for the contradiction queue.
 *
 * @example
 * ```ts
 * import { contradictionDispositionFilterAtom } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * console.log(AtomRegistry.make().get(contradictionDispositionFilterAtom))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionDispositionFilterAtom: Atom.Writable<
  ContradictionDispositionFilter,
  ContradictionDispositionFilter
> = Atom.make<ContradictionDispositionFilter>("open").pipe(Atom.keepAlive);

const initialTemporalViewAtom = ContradictionClient.runtime.atom(DateTime.now).pipe(Atom.keepAlive);

const makeTemporalAxisAtom = () => {
  const overrideAtom = Atom.make<O.Option<DateTime.Utc>>(O.none()).pipe(Atom.keepAlive);
  return Atom.writable(
    (get) =>
      pipe(
        get(overrideAtom),
        O.map(AsyncResult.success),
        O.getOrElse(() => get(initialTemporalViewAtom))
      ),
    (ctx, instant: DateTime.Utc) => ctx.set(overrideAtom, O.some(instant))
  ).pipe(Atom.keepAlive);
};

/**
 * Valid-time instant selected for contradiction applicability.
 *
 * @example
 * ```ts
 * import { contradictionValidAtAtom } from "@beep/epistemic-client"
 * import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity"
 *
 * const validAt = AtomRegistry.make().get(contradictionValidAtAtom)
 * console.log(AsyncResult.isAsyncResult(validAt)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionValidAtAtom = makeTemporalAxisAtom();

/**
 * Transaction-time instant selected for contradiction visibility.
 *
 * @example
 * ```ts
 * import { contradictionKnownAtAtom } from "@beep/epistemic-client"
 * import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity"
 *
 * const knownAt = AtomRegistry.make().get(contradictionKnownAtAtom)
 * console.log(AsyncResult.isAsyncResult(knownAt)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionKnownAtAtom = makeTemporalAxisAtom();

/**
 * Zero-based offset of the currently visible contradiction queue page.
 *
 * @example
 * ```ts
 * import { contradictionQueueOffsetAtom } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * console.log(AtomRegistry.make().get(contradictionQueueOffsetAtom)) // 0
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionQueueOffsetAtom: Atom.Writable<NonNegativeInt, NonNegativeInt> = Atom.make(
  NonNegativeInt.make(0)
).pipe(Atom.keepAlive);

const queueQueryAtoms = Atom.family((disposition: ContradictionDispositionFilter) =>
  Atom.family((validAt: DateTime.Utc) =>
    Atom.family((knownAt: DateTime.Utc) =>
      Atom.family((offset: NonNegativeInt) =>
        ContradictionClient.query(
          "ListContradictionCandidates",
          ContradictionListPayload.make({
            disposition,
            knownAt,
            limit: CONTRADICTION_QUEUE_LIMIT,
            offset,
            validAt,
          }),
          { reactivityKeys: [CONTRADICTION_QUEUE_KEY] }
        )
      )
    )
  )
);

const noContradictionQueuePrevious = O.none<AsyncResult.AsyncResult<ContradictionCandidatePage>>();

/**
 * Reactive contradiction queue for the selected temporal view and disposition.
 *
 * @example
 * ```tsx
 * import { contradictionQueueAtom } from "@beep/epistemic-client"
 * import { useAtomValue } from "@effect/atom-react"
 *
 * export function QueueState() {
 *   const queue = useAtomValue(contradictionQueueAtom)
 *   return <output>{queue._tag}</output>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionQueueAtom = Atom.readable((get) =>
  pipe(
    AsyncResult.all({
      knownAt: get(contradictionKnownAtAtom),
      validAt: get(contradictionValidAtAtom),
    }),
    AsyncResult.match({
      onFailure: (result) => AsyncResult.replacePrevious(result, noContradictionQueuePrevious),
      onInitial: (result) => AsyncResult.replacePrevious(result, noContradictionQueuePrevious),
      onSuccess: ({ value: { knownAt, validAt } }) =>
        get(
          queueQueryAtoms(get(contradictionDispositionFilterAtom))(validAt)(knownAt)(get(contradictionQueueOffsetAtom))
        ),
    })
  )
);

/**
 * Currently selected contradiction candidate, or none before a queue choice.
 *
 * @example
 * ```ts
 * import { selectedContradictionCandidateIdAtom } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(AtomRegistry.make().get(selectedContradictionCandidateIdAtom)))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectedContradictionCandidateIdAtom: Atom.Writable<
  O.Option<GetContradictionCandidate["candidateId"]>,
  O.Option<GetContradictionCandidate["candidateId"]>
> = Atom.make<O.Option<GetContradictionCandidate["candidateId"]>>(O.none()).pipe(Atom.keepAlive);

/**
 * Candidate associated with the current review mutation result.
 *
 * This lets the connected UI ignore a completed or failed mutation after the
 * operator selects a different queue row.
 *
 * @example
 * ```ts
 * import { contradictionReviewCandidateIdAtom } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(AtomRegistry.make().get(contradictionReviewCandidateIdAtom)))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionReviewCandidateIdAtom: Atom.Writable<
  O.Option<GetContradictionCandidate["candidateId"]>,
  O.Option<GetContradictionCandidate["candidateId"]>
> = Atom.make<O.Option<GetContradictionCandidate["candidateId"]>>(O.none()).pipe(Atom.keepAlive);

const candidateDetailAtoms = Atom.family((candidateId: GetContradictionCandidate["candidateId"]) =>
  Atom.family((validAt: DateTime.Utc) =>
    Atom.family((knownAt: DateTime.Utc) =>
      ContradictionClient.query(
        "GetContradictionCandidate",
        GetContradictionCandidate.make({ candidateId, knownAt, validAt }),
        {
          reactivityKeys: [detailKey(candidateId)],
        }
      )
    )
  )
);

const noCandidateDetail = AsyncResult.initial<ContradictionCandidateDetailView>();

/**
 * Expanded selected candidate, including both beliefs without ranking and
 * their evidence.
 *
 * The atom is explicitly `Initial` while no queue row is selected.
 *
 * @example
 * ```tsx
 * import { selectedContradictionCandidateAtom } from "@beep/epistemic-client"
 * import { useAtomValue } from "@effect/atom-react"
 *
 * export function CandidateState() {
 *   const candidate = useAtomValue(selectedContradictionCandidateAtom)
 *   return <output>{candidate._tag}</output>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectedContradictionCandidateAtom = Atom.readable((get) =>
  O.match(get(selectedContradictionCandidateIdAtom), {
    onNone: () => noCandidateDetail,
    onSome: (candidateId) =>
      AsyncResult.flatMap(
        AsyncResult.all({
          knownAt: get(contradictionKnownAtAtom),
          validAt: get(contradictionValidAtAtom),
        }),
        ({ knownAt, validAt }) => get(candidateDetailAtoms(candidateId)(validAt)(knownAt))
      ),
  })
);

/**
 * Current candidate-authorized source-page request.
 *
 * @example
 * ```ts
 * import { selectedContradictionEvidenceSourceAtom } from "@beep/epistemic-client"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(AtomRegistry.make().get(selectedContradictionEvidenceSourceAtom)))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectedContradictionEvidenceSourceAtom: Atom.Writable<
  O.Option<EvidenceSourcePagePayload>,
  O.Option<EvidenceSourcePagePayload>
> = Atom.make<O.Option<EvidenceSourcePagePayload>>(O.none()).pipe(Atom.keepAlive);

const evidenceSourcePageAtoms = Atom.family((candidateId: EvidenceSourcePagePayload["candidateId"]) =>
  Atom.family((evidenceId: EvidenceSourcePagePayload["evidenceId"]) =>
    Atom.family((selector: EvidenceSourcePageSelector) =>
      Atom.family((validAt: DateTime.Utc) =>
        Atom.family((knownAt: DateTime.Utc) =>
          ContradictionClient.query(
            "GetEvidenceSourcePage",
            EvidenceSourcePagePayload.make({ candidateId, evidenceId, knownAt, selector, validAt }),
            { reactivityKeys: [sourceKey(candidateId, evidenceId)] }
          )
        )
      )
    )
  )
);

const noEvidenceSourcePage = AsyncResult.initial<EvidenceSourcePage>();

/**
 * Verified canonical source page selected from candidate-bound evidence.
 *
 * The atom is explicitly `Initial` until verified evidence is selected.
 *
 * @example
 * ```tsx
 * import { contradictionEvidenceSourcePageAtom } from "@beep/epistemic-client"
 * import { useAtomValue } from "@effect/atom-react"
 *
 * export function SourcePageState() {
 *   const sourcePage = useAtomValue(contradictionEvidenceSourcePageAtom)
 *   return <output>{sourcePage._tag}</output>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const contradictionEvidenceSourcePageAtom = Atom.readable((get) =>
  O.match(get(selectedContradictionEvidenceSourceAtom), {
    onNone: () => noEvidenceSourcePage,
    onSome: (request) =>
      get(
        evidenceSourcePageAtoms(request.candidateId)(request.evidenceId)(request.selector)(request.validAt)(
          request.knownAt
        )
      ),
  })
);

/**
 * Select one queue candidate and clear any source selection from the previous
 * candidate.
 *
 * @example
 * ```tsx
 * import { selectContradictionCandidateAtom } from "@beep/epistemic-client"
 * import type { GetContradictionCandidate } from "@beep/epistemic-use-cases/public"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * export function CompareCandidate({ candidateId }: { candidateId: GetContradictionCandidate["candidateId"] }) {
 *   const selectCandidate = useAtomSet(selectContradictionCandidateAtom)
 *   return <button onClick={() => selectCandidate(candidateId)}>Compare</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectContradictionCandidateAtom = ContradictionClient.runtime.fn<
  GetContradictionCandidate["candidateId"]
>()(
  Effect.fn("ContradictionTriage.selectCandidate")(function* (candidateId, ctx) {
    ctx.set(selectedContradictionCandidateIdAtom, O.some(candidateId));
    ctx.set(selectedContradictionEvidenceSourceAtom, O.none());
    ctx.set(contradictionReviewCandidateIdAtom, O.none());
  })
);

/**
 * Select a verified evidence source and its initial anchor-containing page.
 *
 * @example
 * ```tsx
 * import { selectContradictionEvidenceSourceAtom } from "@beep/epistemic-client"
 * import { useAtomSet } from "@effect/atom-react"
 * import type { EvidenceSourcePagePayload } from "@beep/epistemic-use-cases/public"
 *
 * export function InspectSource({ request }: { request: EvidenceSourcePagePayload }) {
 *   const selectSource = useAtomSet(selectContradictionEvidenceSourceAtom)
 *   return <button onClick={() => selectSource(request)}>Open source</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectContradictionEvidenceSourceAtom = ContradictionClient.runtime.fn<EvidenceSourcePagePayload>()(
  Effect.fn("ContradictionTriage.selectEvidenceSource")(function* (request, ctx) {
    ctx.set(selectedContradictionEvidenceSourceAtom, O.some(request));
  })
);

/**
 * Reset both bitemporal query axes to the same current instant and return to
 * the first queue page.
 *
 * @example
 * ```tsx
 * import { resetContradictionTemporalViewAtom } from "@beep/epistemic-client"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * export function ResetTemporalView() {
 *   const reset = useAtomSet(resetContradictionTemporalViewAtom)
 *   return <button onClick={() => reset()}>Reset to now</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const resetContradictionTemporalViewAtom = ContradictionClient.runtime.fn<void>()(
  Effect.fn("ContradictionTriage.resetTemporalView")(function* (_, ctx) {
    const now = yield* DateTime.now;
    ctx.set(contradictionValidAtAtom, now);
    ctx.set(contradictionKnownAtAtom, now);
    ctx.set(contradictionQueueOffsetAtom, NonNegativeInt.make(0));
    ctx.set(selectedContradictionEvidenceSourceAtom, O.none());
    ctx.set(contradictionReviewCandidateIdAtom, O.none());
  })
);

/**
 * Force the currently visible contradiction queue and selected detail to
 * refresh from persisted state.
 *
 * @example
 * ```tsx
 * import { refreshContradictionTriageAtom } from "@beep/epistemic-client"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * export function RefreshQueue() {
 *   const refresh = useAtomSet(refreshContradictionTriageAtom)
 *   return <button onClick={() => refresh()}>Refresh queue</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const refreshContradictionTriageAtom = ContradictionClient.runtime.fn<void>()(
  Effect.fn("ContradictionTriage.refresh")(function* (_, ctx) {
    const reactivity = yield* Reactivity.Reactivity;
    const candidateKeys = O.match(ctx(selectedContradictionCandidateIdAtom), {
      onNone: () => [CONTRADICTION_QUEUE_KEY],
      onSome: (candidateId) => [CONTRADICTION_QUEUE_KEY, detailKey(candidateId)],
    });
    yield* reactivity.invalidate(candidateKeys);
  })
);

/**
 * Retry the currently selected candidate-authorized source page.
 *
 * @example
 * ```tsx
 * import { refreshContradictionEvidenceSourceAtom } from "@beep/epistemic-client"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * export function RetrySource() {
 *   const retry = useAtomSet(refreshContradictionEvidenceSourceAtom)
 *   return <button onClick={() => retry()}>Retry source</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const refreshContradictionEvidenceSourceAtom = ContradictionClient.runtime.fn<void>()(
  Effect.fn("ContradictionTriage.refreshEvidenceSource")(function* (_, ctx) {
    const reactivity = yield* Reactivity.Reactivity;
    yield* O.match(ctx(selectedContradictionEvidenceSourceAtom), {
      onNone: () => Effect.void,
      onSome: ({ candidateId, evidenceId }) => reactivity.invalidate([sourceKey(candidateId, evidenceId)]),
    });
  })
);

/**
 * Apply one human contradiction decision and invalidate all affected reads.
 *
 * The runtime atom exposes `AsyncResult` pending, success, and failure states
 * directly to the UI. The payload is the narrow public command: actor,
 * organization, source, time, fact, validity, and losing side are absent.
 *
 * @example
 * ```tsx
 * import { reviewContradictionCandidateAtom } from "@beep/epistemic-client"
 * import { useAtomSet } from "@effect/atom-react"
 * import type { ReviewContradictionCandidate } from "@beep/epistemic-use-cases/public"
 *
 * export function SubmitReview({ command }: { command: ReviewContradictionCandidate }) {
 *   const review = useAtomSet(reviewContradictionCandidateAtom)
 *   return <button onClick={() => review(command)}>Submit review</button>
 * }
 * ```
 *
 * @effects Calls the review RPC and refreshes the queue and selected detail.
 * @category atoms
 * @since 0.0.0
 */
export const reviewContradictionCandidateAtom = ContradictionClient.runtime.fn<ReviewContradictionCandidate>()(
  Effect.fn("ContradictionTriage.reviewCandidate")(function* (command, ctx) {
    const client = yield* ContradictionClient;
    ctx.set(contradictionReviewCandidateIdAtom, O.some(command.candidateId));
    return yield* Reactivity.mutation(
      client("ReviewContradictionCandidate", command).pipe(
        Effect.tap((disposition) =>
          Effect.sync(() => {
            const knownAt = pipe(
              AsyncResult.value(ctx(contradictionKnownAtAtom)),
              O.map((current) => DateTime.max(current, disposition.resolvedAt)),
              O.getOrElse(() => disposition.resolvedAt)
            );
            ctx.set(contradictionKnownAtAtom, knownAt);
            ctx.set(contradictionQueueOffsetAtom, NonNegativeInt.make(0));
            ctx.set(selectedContradictionEvidenceSourceAtom, O.none());
          })
        )
      ),
      [CONTRADICTION_QUEUE_KEY, detailKey(command.candidateId)]
    );
  }),
  { concurrent: false }
);
