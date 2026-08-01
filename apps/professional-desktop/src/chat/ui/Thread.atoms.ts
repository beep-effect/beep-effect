/**
 * Runtime-owned DOM coordination for the thread transcript.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { editTargetAtom, unreconciledTurnAtoms } from "@beep/agents-client/Chat.atoms";
import { A, O, P } from "@beep/utils";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { EditTarget } from "@beep/agents-client/Chat.atoms";
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
 * @example
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
 * @example
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
 * @example
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
 * @example
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
        onNone: () => Effect.void,
        onSome: (element) =>
          Effect.sync(() => {
            const scrollToBottom = () => element.scrollIntoView({ behavior: "smooth", block: "end" });
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
 * @example
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
      if (AsyncResult.isSuccess(timeline) && A.some(unreconciled, (turn) => turn.reconciliation === "timeline")) {
        ctx.set(
          unreconciledAtom,
          A.filter(unreconciled, (turn) => turn.reconciliation === "receipt")
        );
      }
      ctx.set(scrollThreadAtoms(threadId), timeline);
    })
  )
);
