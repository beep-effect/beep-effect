/**
 * Thread sidebar: the workspace thread list, a "New thread" control, and thread
 * selection.
 *
 * Reads {@link threadsAtoms} for the workspace (sorted most-recent-first by
 * `updatedAt`), drives selection through {@link selectedThreadAtom}, and creates
 * threads through {@link createThreadAtom} (which focuses the new thread). The
 * create fiber is kept subscribed with `useAtomMount` so the registry does not
 * interrupt it (POC lesson).
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { createThreadAtom, editTargetAtom, selectedThreadAtom, threadsAtoms } from "@beep/agents-client/Chat.atoms";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { Button } from "@beep/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@beep/ui/components/empty";
import { toast } from "@beep/ui/components/sonner";
import * as A from "@beep/utils/Array";
import * as DateTime from "@beep/utils/DateTime";
import * as O from "@beep/utils/Option";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Stream from "effect/Stream";
import { AsyncResult } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { Thread } from "@beep/workspace-domain";
import type { JSX } from "react";

type WorkspaceId = WorkspaceIdentity.WorkspaceId;

// most-recent activity first: negate the epoch millis so a number ascending
// order sorts newest threads to the top.
const byUpdatedDesc = Order.mapInput(Order.Number, (thread: Thread) => -DateTime.toEpochMillis(thread.updatedAt));

const selectThreadAtom = professionalBrowserRuntime.fn<WorkspaceIdentity.ThreadId>()(
  Effect.fnUntraced(function* (threadId, ctx) {
    ctx.set(selectedThreadAtom, O.some(threadId));
    ctx.set(editTargetAtom, O.none());
  })
);

const createThreadFailureToastBindingAtom = professionalBrowserRuntime.atom((get) =>
  get.stream(createThreadAtom).pipe(
    Stream.runForEach((result) =>
      AsyncResult.isFailure(result)
        ? logRedactedCause(
            result.cause,
            LogRedactedCauseOptions.make({
              message: "professional desktop thread creation failed",
              level: "Warn",
              attributes: { subsystem: "chat_sidebar" },
            })
          ).pipe(
            Effect.andThen(
              Effect.sync(() =>
                toast.error("Couldn't create a thread — the desktop sidecar is unreachable or rejected the request.")
              )
            )
          )
        : Effect.void
    )
  )
);

/**
 * Renders the workspace thread list with creation and selection controls.
 *
 * **Example** (Log Sidebar component name)
 *
 * ```tsx
 * import { Sidebar } from "@/chat/ui/Sidebar"
 *
 * console.log(Sidebar.name) // "Sidebar"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Sidebar({ workspaceId }: { readonly workspaceId: WorkspaceId }): JSX.Element {
  const threads = useAtomValue(threadsAtoms(workspaceId));
  const selected = useAtomValue(selectedThreadAtom);
  const select = useAtomSet(selectThreadAtom);
  const createThread = useAtomSet(createThreadAtom);
  useAtomMount(createThreadFailureToastBindingAtom);

  const sorted = AsyncResult.isSuccess(threads) ? A.sort(threads.value, byUpdatedDesc) : [];
  const loadFailed = AsyncResult.isFailure(threads);
  // Once the load settles with nothing to show, present a calm empty state;
  // a failed load names the problem instead of masquerading as "no threads".
  // `Initial` (still loading) renders nothing.
  const isEmpty = !AsyncResult.isInitial(threads) && !loadFailed && sorted.length === 0;

  return (
    // The width belongs to the resizable panel this sits in, not to the sidebar. It
    // used to pin itself to `w-64`, which a drag could not have moved.
    <aside
      className="flex h-full w-full min-w-0 flex-col border-r bg-background/30 backdrop-blur"
      data-testid="sidebar"
    >
      <div className="border-b p-3">
        <Button
          type="button"
          className="w-full"
          variant="outline"
          onClick={() => createThread({ workspaceId, title: "New thread" })}
          data-testid="sidebar-new"
        >
          + New thread
        </Button>
      </div>
      {/* `overflow-y-auto` alone computes the *other* axis to `auto` as well, so a title
          that overflowed handed the sidebar a horizontal scrollbar. Nothing in a thread
          list is ever meant to be reachable sideways. */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2" data-testid="sidebar-list">
        {loadFailed ? (
          <Empty className="h-full border-none" data-testid="sidebar-load-failed">
            <EmptyHeader>
              <EmptyTitle>Threads unavailable</EmptyTitle>
              <EmptyDescription>
                The thread list could not be loaded. Check that the desktop sidecar is running, then reload.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {isEmpty ? (
          <Empty className="h-full border-none" data-testid="sidebar-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </EmptyMedia>
              <EmptyTitle>No threads yet</EmptyTitle>
              <EmptyDescription>Start a conversation with “+ New thread”.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {A.map(sorted, (thread) => {
          const isActive = O.exists(selected, (id) => id === thread.id);
          return (
            <button
              key={thread.id}
              type="button"
              className={`flex w-full min-w-0 flex-col items-start rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                isActive ? "bg-muted" : ""
              }`}
              onClick={() => select(thread.id)}
              data-testid="sidebar-item"
            >
              {/* `w-full` is what makes `truncate` mean anything. The button lays its
                  children out with `items-start`, so without it the title sizes itself
                  to its own text — a thread whose title is the first line of a long
                  prompt simply ran off the side, ellipsis rule and all. */}
              <span className="w-full truncate font-medium">{thread.title}</span>
              <span className="text-xs text-muted-foreground">
                {DateTime.formatLocal(thread.updatedAt, { month: "short", day: "numeric" })}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
