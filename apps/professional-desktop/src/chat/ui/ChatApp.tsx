/**
 * Desktop chat surface: composes the {@link Sidebar}, {@link Thread}, and
 * {@link Composer} into the chat layout.
 *
 * The desktop is single-workspace for now, so a v1 default workspace id
 * ({@link DEFAULT_PROFESSIONAL_WORKSPACE_ID}) feeds {@link threadsAtoms} and
 * {@link createThreadAtom}. The active thread is the user's explicit
 * {@link selectedThreadAtom} selection, falling back to the most recent thread
 * in the list — mirroring the POC's "follow the list" behavior.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { CreateThreadAtomInput } from "@beep/agents-client";
import { createThreadAtom, selectedThreadAtom, threadsAtoms } from "@beep/agents-client/Chat.atoms";
import { Button } from "@beep/ui/components/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@beep/ui/components/resizable";
import * as A from "@beep/utils/Array";
import * as DateTime from "@beep/utils/DateTime";
import * as O from "@beep/utils/Option";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import { Composer } from "./Composer.tsx";
import {
  persistSidebarLayoutAtom,
  SIDEBAR_MAX_PERCENT,
  SIDEBAR_MIN_PERCENT,
  SIDEBAR_PANE_ID,
  SidebarLayoutChanged,
  sidebarPercentAtom,
  sidebarSize,
} from "./layout.atoms.ts";
import { Sidebar } from "./Sidebar.tsx";
import { Thread } from "./Thread.tsx";
import { YouTubeWatchOpener } from "./YouTubeWatchOpener.tsx";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { JSX } from "react";

const byUpdatedDesc = Order.mapInput(
  Order.Number,
  (thread: { readonly updatedAt: DateTime.DateTime }) => -DateTime.toEpochMillis(thread.updatedAt)
);

const autoNewThreadBinding = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  professionalBrowserRuntime.atom((get) =>
    get.stream(threadsAtoms(workspaceId)).pipe(
      Stream.filter(AsyncResult.isSuccess),
      Stream.map((threads) => threads.value),
      Stream.filter(A.isReadonlyArrayEmpty),
      Stream.filter(() => O.isNone(get.once(selectedThreadAtom))),
      Stream.take(1),
      Stream.runForEach(() =>
        Effect.sync(() => get.set(createThreadAtom, CreateThreadAtomInput.make({ workspaceId, title: "New thread" })))
      )
    )
  )
);

/**
 * The composed desktop chat application.
 *
 * **Example** (Log ChatApp component name)
 *
 * ```tsx
 * import { ChatApp } from "@/chat/ui/ChatApp"
 *
 * console.log(ChatApp.name) // "ChatApp"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
// decision: workbench-shell-owns-viewport-and-theme
export function ChatApp(): JSX.Element {
  const selected = useAtomValue(selectedThreadAtom);
  const threads = useAtomValue(threadsAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const createThread = useAtomSet(createThreadAtom);
  useAtomMount(autoNewThreadBinding(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const storedPercent = useAtomValue(sidebarPercentAtom);
  const persistSidebarLayout = useAtomSet(persistSidebarLayoutAtom);

  const active = O.orElse(selected, () =>
    AsyncResult.isSuccess(threads)
      ? O.map(A.head(A.sort(threads.value, byUpdatedDesc)), (thread) => thread.id)
      : O.none()
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground"
      data-testid="chat-app"
    >
      <YouTubeWatchOpener />
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1"
        data-testid="chat-panes"
        onLayoutChanged={(layout, meta) =>
          persistSidebarLayout(SidebarLayoutChanged.make({ layout, isUserInteraction: meta.isUserInteraction }))
        }
      >
        <ResizablePanel
          id={SIDEBAR_PANE_ID}
          defaultSize={sidebarSize(storedPercent)}
          minSize={sidebarSize(SIDEBAR_MIN_PERCENT)}
          maxSize={sidebarSize(SIDEBAR_MAX_PERCENT)}
          className="min-w-0"
        >
          <Sidebar workspaceId={DEFAULT_PROFESSIONAL_WORKSPACE_ID} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="main-pane" minSize="40%" className="min-w-0">
          <main className="flex h-full min-h-0 flex-col bg-background">
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
                    <div>
                      <h2 className="text-lg font-semibold">Starting your first thread…</h2>
                      <p className="text-sm text-muted-foreground">The composer opens as soon as it's ready.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4"
                        data-testid="chat-no-thread-create"
                        onClick={() =>
                          createThread(
                            CreateThreadAtomInput.make({
                              workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
                              title: "New thread",
                            })
                          )
                        }
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
