/**
 * Desktop chat surface: composes the {@link Sidebar}, {@link Thread}, and
 * {@link Composer} into the chat layout.
 *
 * The desktop is single-workspace for now, so a v1 default workspace id
 * ({@link DEFAULT_WORKSPACE_ID}) feeds {@link threadsAtoms} and
 * {@link createThreadAtom}. The active thread is the user's explicit
 * {@link selectedThreadAtom} selection, falling back to the most recent thread
 * in the list — mirroring the POC's "follow the list" behavior.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { createThreadAtom, selectedThreadAtom, threadsAtoms } from "@beep/agents-client/Chat.atoms";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Button } from "@beep/ui/components/button";
import { OrbBackground } from "@beep/ui/components/orb-background";
import { A, DateTime, O } from "@beep/utils";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Order } from "effect";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Composer } from "./Composer.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { Thread } from "./Thread.tsx";
import type { JSX } from "react";

/**
 * The v1 default workspace the desktop chat operates in.
 *
 * The desktop chat surface is single-workspace for this increment; threads are
 * created and listed against this id. A workspace switcher arrives once the
 * desktop owns multiple workspaces.
 */
const DEFAULT_WORKSPACE_ID: WorkspaceIdentity.WorkspaceId = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1);

const byUpdatedDesc = Order.mapInput(
  Order.Number,
  (thread: { readonly updatedAt: DateTime.DateTime }) => -DateTime.toEpochMillis(thread.updatedAt)
);

// When the workspace loads with no threads, auto-enter the "+ New thread" state
// (create + focus one) so the user lands in the composer instead of an empty
// "no thread selected" screen — non-empty workspaces fall back to the most
// recent thread (below). Fires once per mount; a non-empty list (including the
// freshly created thread) or an existing selection keeps it from re-firing.
const autoNewThreadBinding = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make((get) => {
    let created = false;
    const ensureThread = (): void => {
      if (created) return;
      const threads = get.once(threadsAtoms(workspaceId));
      if (!AsyncResult.isSuccess(threads) || threads.value.length > 0) return;
      if (O.isSome(get.once(selectedThreadAtom))) return;
      created = true;
      get.set(createThreadAtom, { workspaceId, title: "New thread" });
    };
    ensureThread();
    get.subscribe(threadsAtoms(workspaceId), ensureThread);
    return undefined;
  })
);

/**
 * The composed desktop chat application.
 *
 * @example
 * ```tsx
 * import { ChatApp } from "@/chat/ui/ChatApp"
 *
 * console.log(ChatApp.name) // "ChatApp"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ChatApp(): JSX.Element {
  const selected = useAtomValue(selectedThreadAtom);
  const threads = useAtomValue(threadsAtoms(DEFAULT_WORKSPACE_ID));
  const createThread = useAtomSet(createThreadAtom);
  // auto-create a thread when the workspace is empty (see binding above).
  useAtomMount(autoNewThreadBinding(DEFAULT_WORKSPACE_ID));

  // active thread: the explicit selection, else the most recent thread.
  const active = O.orElse(selected, () =>
    AsyncResult.isSuccess(threads)
      ? O.map(A.head(A.sort(threads.value, byUpdatedDesc)), (thread) => thread.id)
      : O.none()
  );

  return (
    // `h-full`, not `h-screen`: the chat surface mounts BELOW the app's nav bar,
    // inside a parent that already holds the remaining height. Asking for the whole
    // viewport made it overflow by exactly the nav's height, so the WINDOW scrolled
    // on top of the transcript's own scrollbar — two scrollbars for one list. The
    // shell owns the viewport; a surface fills what it is given, and only the panes
    // inside it scroll.
    <div
      className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground"
      data-testid="chat-app"
    >
      <OrbBackground tone="green" intensity="subtle" />
      {/* No second title bar. The app's nav already says where you are, and this
          header only repeated it — costing a strip of vertical height on the one
          surface that needs it most, and hiding the theme control where the other
          three surfaces could not reach it. Both now live in the shell's nav. */}
      <div className="flex min-h-0 flex-1">
        <Sidebar workspaceId={DEFAULT_WORKSPACE_ID} />
        {/* bg-background/60 damps the shared orb glow so the content area reads
            quieter than the header and sidebar (Taskade-style ambience). */}
        <main className="flex min-h-0 flex-1 flex-col bg-background/60">
          {O.match(active, {
            onNone: () => (
              <div className="flex flex-1 items-center justify-center text-center" data-testid="chat-no-thread">
                {AsyncResult.isFailure(threads) ? (
                  <div>
                    <h2 className="text-lg font-semibold">Chat is unavailable</h2>
                    <p className="text-sm text-muted-foreground">
                      The desktop sidecar could not be reached, so threads cannot be loaded or created.
                    </p>
                  </div>
                ) : (
                  // An empty workspace auto-creates its first thread (see
                  // autoNewThreadBinding), so this state is normally transient;
                  // the button is the manual fallback if that create failed.
                  <div>
                    <h2 className="text-lg font-semibold">Starting your first thread…</h2>
                    <p className="text-sm text-muted-foreground">The composer opens as soon as it's ready.</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      data-testid="chat-no-thread-create"
                      onClick={() => createThread({ workspaceId: DEFAULT_WORKSPACE_ID, title: "New thread" })}
                    >
                      + New thread
                    </Button>
                  </div>
                )}
              </div>
            ),
            onSome: (threadId) => (
              <>
                <Thread key={threadId} threadId={threadId} />
                <Composer threadId={threadId} />
              </>
            ),
          })}
        </main>
      </div>
    </div>
  );
}
