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
import { Button } from "@beep/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@beep/ui/components/empty";
import { toast } from "@beep/ui/components/sonner";
import { A, DateTime, O } from "@beep/utils";
import { useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { Order } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { Thread } from "@beep/workspace-domain";
import type { JSX } from "react";

type WorkspaceId = WorkspaceIdentity.WorkspaceId;

// most-recent activity first: negate the epoch millis so a number ascending
// order sorts newest threads to the top.
const byUpdatedDesc = Order.mapInput(Order.Number, (thread: Thread) => -DateTime.toEpochMillis(thread.updatedAt));

/**
 * Renders the workspace thread list with creation and selection controls.
 *
 * @example
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
  const select = useAtomSet(selectedThreadAtom);
  const setEditTarget = useAtomSet(editTargetAtom);
  const createThread = useAtomSet(createThreadAtom);
  // keep the create fiber subscribed — unobserved fn atoms get interrupted.
  useAtomMount(createThreadAtom);

  // A failed create must not die silently: without this the "+ New thread"
  // button reads as dead when the sidecar is down or rejects the session.
  useAtomSubscribe(createThreadAtom, (result) => {
    if (AsyncResult.isFailure(result)) {
      toast.error("Couldn't create a thread — the desktop sidecar is unreachable or rejected the request.");
    }
  });

  const sorted = AsyncResult.isSuccess(threads) ? A.sort(threads.value, byUpdatedDesc) : [];
  const loadFailed = AsyncResult.isFailure(threads);
  // Once the load settles with nothing to show, present a calm empty state;
  // a failed load names the problem instead of masquerading as "no threads".
  // `Initial` (still loading) renders nothing.
  const isEmpty = !AsyncResult.isInitial(threads) && !loadFailed && sorted.length === 0;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background/30 backdrop-blur" data-testid="sidebar">
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
      <nav className="flex-1 overflow-y-auto p-2" data-testid="sidebar-list">
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
              className={`flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                isActive ? "bg-muted" : ""
              }`}
              onClick={() => {
                select(O.some(thread.id));
                // an in-progress edit belongs to the thread it started in.
                setEditTarget(O.none());
              }}
              data-testid="sidebar-item"
            >
              <span className="truncate font-medium">{thread.title}</span>
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
