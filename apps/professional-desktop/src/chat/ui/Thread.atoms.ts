/**
 * Runtime-owned DOM coordination for the thread transcript.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  editTargetAtom,
  streamingTurnAtom,
  threadTimelineAtoms,
  unreconciledTurnAtoms,
} from "@beep/agents-client/Chat.atoms";
import * as A from "@beep/utils/Array";
import * as Eq from "@beep/utils/Equal";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { thunkEffectVoid } from "@beep/utils/thunk";
import { Thread as ThreadProjections } from "@beep/workspace-use-cases/public";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { EditTarget, StreamingTurn } from "@beep/agents-client/Chat.atoms";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { Thread as ThreadUseCases } from "@beep/workspace-use-cases/public";

const PINNED_SLACK_PX = 64;

const threadViewportAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make<O.Option<HTMLDivElement>>(O.none())
);

const threadBottomAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make<O.Option<HTMLDivElement>>(O.none())
);

/**
 * Runtime action that starts editing one user turn.
 *
 * **Example** (Check typeof is object)
 *
 * ```ts
 * import { editThreadTurnAtom } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof editThreadTurnAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const editThreadTurnAtom = professionalBrowserRuntime.fn<EditTarget>()(
  Effect.fnUntraced(function* (target, ctx) {
    ctx.set(editTargetAtom, O.some(target));
  })
);

/**
 * Runtime action family that owns the transcript viewport DOM reference.
 *
 * **Example** (Check typeof is function)
 *
 * ```ts
 * import { setThreadViewportAtoms } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof setThreadViewportAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setThreadViewportAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<HTMLDivElement | null>()(
    Effect.fnUntraced(function* (element, ctx) {
      ctx.set(threadViewportAtoms(threadId), O.fromNullishOr(element));
    })
  )
);

/**
 * Runtime action family that owns the transcript bottom-sentinel DOM reference.
 *
 * **Example** (Check typeof is function)
 *
 * ```ts
 * import { setThreadBottomAtoms } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof setThreadBottomAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setThreadBottomAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<HTMLDivElement | null>()(
    Effect.fnUntraced(function* (element, ctx) {
      ctx.set(threadBottomAtoms(threadId), O.fromNullishOr(element));
    })
  )
);

/**
 * Runtime action family that follows transcript updates while the reader
 * remains pinned near the bottom.
 *
 * **Example** (Check typeof is function)
 *
 * ```ts
 * import { scrollThreadAtoms } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof scrollThreadAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const scrollThreadAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<unknown>()(
    Effect.fnUntraced(function* (_, ctx) {
      const viewport = ctx(threadViewportAtoms(threadId));
      const readerMovedAway = O.exists(
        viewport,
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight > PINNED_SLACK_PX
      );
      if (readerMovedAway) return;
      yield* O.match(ctx(threadBottomAtoms(threadId)), {
        onNone: thunkEffectVoid,
        onSome: (element) =>
          Effect.sync(() => {
            // Streaming blocks can arrive faster than a smooth animation. If the
            // viewport trails the growing DOM, the next update mistakes that lag
            // for a reader who intentionally scrolled away and stops following.
            // An atomic programmatic scroll keeps the pinned invariant truthful;
            // the slack guard above still preserves genuine reader position.
            const scrollToBottom = () => element.scrollIntoView({ behavior: "auto", block: "end" });
            if (P.isFunction(globalThis.requestAnimationFrame)) {
              globalThis.requestAnimationFrame(scrollToBottom);
            } else {
              scrollToBottom();
            }
          }),
      });
    })
  )
);

/**
 * Runtime action family that reconciles optimistic turns after an
 * authoritative timeline refresh and follows the resulting transcript.
 *
 * **Example** (Check typeof is function)
 *
 * ```ts
 * import { reconcileThreadTimelineAtoms } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof reconcileThreadTimelineAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const reconcileThreadTimelineAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<AsyncResult.AsyncResult<ThreadUseCases.ThreadTimeline, unknown>>()(
    Effect.fn("professional_desktop.chat.reconcile_thread_timeline")(function* (timeline, ctx) {
      const unreconciledAtom = unreconciledTurnAtoms(threadId);
      const unreconciled = ctx(unreconciledAtom);
      if (
        AsyncResult.isSuccess(timeline) &&
        A.some(unreconciled, P.Struct({ reconciliation: Eq.equals("timeline") }))
      ) {
        ctx.set(unreconciledAtom, A.filter(unreconciled, P.Struct({ reconciliation: Eq.equals("receipt") })));
      }
      ctx.set(scrollThreadAtoms(threadId), timeline);
    })
  )
);

// Only an existing, earlier parent describes an edit edge. Self, forward,
// equal-index, and missing parents are corrupt and mirror activeBranchTurns by
// leaving the linear conversation untouched.
const resolvableParentTurnId: {
  (
    allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>,
    turn: ThreadUseCases.TimelineTurn
  ): O.Option<WorkspaceIdentity.TurnId>;
  (
    turn: ThreadUseCases.TimelineTurn
  ): (allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>) => O.Option<WorkspaceIdentity.TurnId>;
} = dual(
  2,
  (
    allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>,
    turn: ThreadUseCases.TimelineTurn
  ): O.Option<WorkspaceIdentity.TurnId> =>
    turn.parentTurnId.pipe(
      O.filter(P.not(Eq.equals(turn.turnId))),
      O.filter((parentTurnId) =>
        A.some(
          allTurns,
          P.Struct({
            turnId: Eq.equals(parentTurnId),
            turnIndex: N.isLessThan(turn.turnIndex),
          })
        )
      )
    )
);

// A resolvable parent covers both replacements and same-parent siblings.
// Looking for a turn that validly points here also marks the turn it replaced.
const turnHasSiblings: {
  (allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>, turn: ThreadUseCases.TimelineTurn): boolean;
  (turn: ThreadUseCases.TimelineTurn): (allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>) => boolean;
} = dual(
  2,
  (allTurns: ReadonlyArray<ThreadUseCases.TimelineTurn>, turn: ThreadUseCases.TimelineTurn): boolean =>
    O.isSome(resolvableParentTurnId(allTurns, turn)) ||
    A.some(allTurns, (candidate) => O.contains(resolvableParentTurnId(allTurns, candidate), turn.turnId))
);

// The sibling scan is quadratic in the timeline and depends on nothing else,
// so it owns its own atom: streaming writes land once per block and must not
// drag the whole walk along behind them.
const threadSiblingTurnIdsAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make((get): HashSet.HashSet<WorkspaceIdentity.TurnId> => {
    const timelineTurns = O.match(AsyncResult.value(get(threadTimelineAtoms(threadId))), {
      onNone: A.empty<ThreadUseCases.TimelineTurn>,
      onSome: (value) => value.turns,
    });
    return HashSet.fromIterable(
      A.map(
        A.filter(timelineTurns, (turn) => turnHasSiblings(timelineTurns, turn)),
        (turn) => turn.turnId
      )
    );
  })
);

/**
 * The thread transcript exactly as it must render now: active-branch turns
 * after edit truncation, the optimistic turns still awaiting evidence, the
 * turn streaming into this thread, precomputed sibling markers, and the
 * timeline load flags.
 *
 * @category models
 * @since 0.0.0
 */
// crispen: kept as an interface — every field is already schema-validated
// upstream and this view is rederived on each streaming block, so an S.Class
// .make here would revalidate a hot path for no new invariant.
interface ThreadTranscriptView {
  readonly empty: boolean;
  readonly failed: boolean;
  readonly loading: boolean;
  readonly siblingTurnIds: HashSet.HashSet<WorkspaceIdentity.TurnId>;
  readonly streaming: O.Option<StreamingTurn>;
  readonly turns: ReadonlyArray<ThreadUseCases.TimelineTurn>;
  readonly unreconciled: ReadonlyArray<StreamingTurn>;
}

/**
 * Per-thread transcript read model: folds the timeline, optimistic turns, and
 * the streaming turn into one {@link ThreadTranscriptView}, including the
 * branch-truncation rule — an edited turn and the exchange it produced are
 * gone for good, not merely hidden while the replacement streams.
 *
 * **Example** (Inspect the atom family)
 *
 * ```ts
 * import { visibleThreadTurnsAtoms } from "@/chat/ui/Thread.atoms"
 *
 * console.log(typeof visibleThreadTurnsAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const visibleThreadTurnsAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make((get): ThreadTranscriptView => {
    const timeline = get(threadTimelineAtoms(threadId));
    const unreconciled = get(unreconciledTurnAtoms(threadId));
    // a turn keeps streaming in its own thread when the user navigates away.
    const streaming = O.filter(get(streamingTurnAtom), P.Struct({ threadId: Eq.equals(threadId) }));
    // A success is authoritative for timeline fallbacks, but it cannot identify
    // an exact request whose receipt RPC stayed unavailable. Keep those prompts
    // visible and non-sendable until exact persistence evidence resolves.
    const displayedUnreconciled = AsyncResult.isSuccess(timeline)
      ? A.filter(unreconciled, P.Struct({ reconciliation: Eq.equals("receipt") }))
      : unreconciled;
    const timelineTurns = O.match(AsyncResult.value(timeline), {
      onNone: A.empty<ThreadUseCases.TimelineTurn>,
      onSome: (value) => value.turns,
    });
    const allTurns = ThreadProjections.activeBranchTurns(timelineTurns);
    // While the replacement streams, its predecessor is already on its way out.
    const localTurns = A.appendAll(displayedUnreconciled, O.toArray(streaming));
    const truncateIndex = A.reduce(localTurns, O.none<number>(), (earliest, localTurn) =>
      O.match(
        O.flatMap(localTurn.truncateFrom, (truncateFrom) =>
          A.findFirstIndex(allTurns, P.Struct({ turnId: Eq.equals(truncateFrom) }))
        ),
        {
          onNone: () => earliest,
          onSome: (index) =>
            O.some(
              earliest.pipe(
                O.map(N.min(index)),
                O.getOrElse(() => index)
              )
            ),
        }
      )
    );
    const turns = truncateIndex.pipe(
      O.map((index) => A.take(allTurns, index)),
      O.getOrElse(() => allTurns)
    );
    const siblingTurnIds = get(threadSiblingTurnIdsAtoms(threadId));
    return {
      turns,
      unreconciled: displayedUnreconciled,
      streaming,
      siblingTurnIds,
      failed: AsyncResult.isFailure(timeline),
      loading: AsyncResult.isInitial(timeline) && timeline.waiting,
      empty:
        A.isReadonlyArrayEmpty(turns) &&
        A.isReadonlyArrayEmpty(displayedUnreconciled) &&
        AsyncResult.isSuccess(timeline) &&
        O.isNone(streaming),
    };
  })
);
