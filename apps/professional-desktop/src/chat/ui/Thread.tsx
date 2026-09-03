/**
 * Thread view: the persisted timeline plus the in-flight streaming turn.
 *
 * Reads the selected thread's timeline read-model from
 * {@link threadTimelineAtoms} and renders each {@link TimelineTurn}: message
 * items through {@link MessageView}, tool-call items as a placeholder chip, and
 * a cost-rollup line derived from `costMicros`. User turns carry an Edit control
 * that seeds {@link editTargetAtom}; turns participating in an edit branch point
 * expose a degenerate version-selector affordance.
 *
 * The in-flight {@link streamingTurnAtom} renders optimistically: a "Thinking…"
 * indicator until the first block arrives, then {@link StreamingBlocks}. The
 * composer owns the canonical Stop control. During an edit turn the
 * rewritten-away tail is hidden optimistically. The turn fiber is kept
 * subscribed with `useAtomMount(runTurnAtom)`. Transcript DOM refs,
 * reconciliation, and scroll effects are owned by runtime atom actions.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import {
  runTurnAtom,
  streamingTurnAtom,
  threadTimelineAtoms,
  turnActiveAtom,
  unreconciledTurnAtoms,
} from "@beep/agents-client/Chat.atoms";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunkNull } from "@beep/utils/thunk";
import { MessageRole } from "@beep/workspace-domain/entities/Message";
import { Thread as ThreadProjections } from "@beep/workspace-use-cases/public";
import { useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import * as HashSet from "effect/HashSet";
import { MessageView } from "./MessageView.tsx";
import { StreamingBlocks } from "./StreamingBlocks.tsx";
import {
  editThreadTurnAtom,
  reconcileThreadTimelineAtoms,
  scrollThreadAtoms,
  setThreadBottomAtoms,
  setThreadViewportAtoms,
  visibleThreadTurnsAtoms,
} from "./Thread.atoms.ts";
import type { StreamingTurn } from "@beep/agents-client/Chat.atoms";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { Thread as ThreadUseCases } from "@beep/workspace-use-cases/public";
import type { JSX } from "react";

type ThreadId = WorkspaceIdentity.ThreadId;
type TimelineTurn = ThreadUseCases.TimelineTurn;
type TimelineItem = ThreadUseCases.TimelineItem;

const ToolCallChip = ({ name }: { readonly name: string }): JSX.Element => (
  <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
    tool: {name}
  </span>
);

const TimelineItemRow = ({ item }: { readonly item: TimelineItem }): JSX.Element =>
  ThreadProjections.TimelineItem.match(item, {
    message: (message) => <MessageView content={message.content} />,
    tool_call: (toolCall) => <ToolCallChip name={toolCall.name} />,
  });

const turnRole = (turn: TimelineTurn): MessageRole =>
  O.match(A.findFirst(turn.items, ThreadProjections.TimelineItem.guards.message), {
    onNone: () => MessageRole.Enum.assistant,
    onSome: (item) => item.role,
  });

const CostRollup = ({ costMicros }: { readonly costMicros: number }): JSX.Element | null =>
  costMicros > 0 ? (
    <div className="mt-1 text-[0.7rem] text-muted-foreground">${(costMicros / 1_000_000).toFixed(4)}</div>
  ) : null;

const TurnRow = ({
  threadId,
  turn,
  hasSiblings,
}: {
  readonly threadId: ThreadId;
  readonly turn: TimelineTurn;
  readonly hasSiblings: boolean;
}): JSX.Element => {
  const editTurn = useAtomSet(editThreadTurnAtom);
  const role = turnRole(turn);
  const userMessage = A.findFirst(
    turn.items,
    (item): item is ThreadUseCases.TimelineMessageItem =>
      ThreadProjections.TimelineItem.guards.message(item) && MessageRole.is.user(item.role)
  );

  return (
    <div
      className={`mb-4 flex flex-col ${MessageRole.is.user(role) ? "items-end" : "items-start"}`}
      data-testid={`turn-${role}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${MessageRole.is.user(role) ? "bg-primary/10" : "bg-muted/50"}`}
      >
        {A.map(turn.items, (item, i) => (
          <TimelineItemRow key={i} item={item} />
        ))}
        <CostRollup costMicros={turn.costMicros} />
        <div className="mt-1 flex items-center gap-2">
          {O.match(userMessage, {
            onNone: thunkNull,
            onSome: (item) => (
              <Button
                variant="ghost"
                size="xs"
                title="Edit — rewrites the thread from here"
                onClick={() =>
                  editTurn({
                    threadId,
                    turnId: turn.turnId,
                    content: item.content,
                  })
                }
                data-testid="turn-edit"
              >
                Edit
              </Button>
            ),
          })}
          {/* version selector affordance — only when this turn participates in
              a branch point created by an edit. */}
          {hasSiblings ? (
            <span className="text-xs text-muted-foreground" data-testid="turn-versions">
              versions
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const ThreadLoadState = ({ failed, loading }: { readonly failed: boolean; readonly loading: boolean }): JSX.Element => (
  <>
    {loading ? (
      <div className="text-sm text-muted-foreground" data-testid="thread-loading">
        Loading thread…
      </div>
    ) : null}
    {failed ? (
      <div className="text-sm text-destructive" data-testid="thread-error">
        Failed to load the thread — is the sidecar running?
      </div>
    ) : null}
  </>
);

const EmptyThread = ({ visible }: { readonly visible: boolean }): JSX.Element | null =>
  visible ? (
    <div className="flex h-full flex-col items-center justify-center text-center" data-testid="thread-empty">
      <h2 className="text-lg font-semibold">Start the conversation</h2>
      <p className="text-sm text-muted-foreground">Ask anything. Responses stream in as structured rich text.</p>
    </div>
  ) : null;

const UnreconciledTurns = ({ turns }: { readonly turns: ReadonlyArray<StreamingTurn> }): JSX.Element => (
  <>
    {A.map(turns, (turn, index) => (
      <div key={`unreconciled-${index}`}>
        <div className="mb-4 flex flex-col items-end" data-testid="turn-unreconciled-user">
          <div className="max-w-[80%] rounded-lg bg-primary/10 px-3 py-2">
            <MessageView content={turn.userContent} />
          </div>
        </div>
        <div className="mb-4 flex flex-col items-start" data-testid="turn-unreconciled">
          <div className="max-w-[80%] rounded-lg bg-muted/50 px-3 py-2">
            {A.isReadonlyArrayEmpty(turn.blocks) ? (
              <div className="text-sm text-muted-foreground">Reply completed; waiting for the thread to refresh…</div>
            ) : (
              <StreamingBlocks blocks={turn.blocks} />
            )}
          </div>
        </div>
      </div>
    ))}
  </>
);

const StreamingTurnView = ({
  streaming,
  turnActive,
}: {
  readonly streaming: O.Option<StreamingTurn>;
  readonly turnActive: boolean;
}): JSX.Element | null =>
  O.match(streaming, {
    onNone: thunkNull,
    onSome: (turn) => (
      <>
        {/* The message you just sent, shown while the reply streams. */}
        <div className="mb-4 flex flex-col items-end" data-testid="turn-streaming-user">
          <div className="max-w-[80%] rounded-lg bg-primary/10 px-3 py-2">
            <MessageView content={turn.userContent} />
          </div>
        </div>
        <div className="mb-4 flex flex-col items-start" data-testid="turn-streaming">
          <div className="max-w-[80%] rounded-lg bg-muted/50 px-3 py-2">
            {A.isReadonlyArrayEmpty(turn.blocks) ? (
              <div className="text-sm text-muted-foreground" data-testid="thinking">
                {turnActive ? "Thinking…" : "Reply completed; waiting for the thread to refresh…"}
              </div>
            ) : (
              <StreamingBlocks blocks={turn.blocks} />
            )}
          </div>
        </div>
      </>
    ),
  });

/**
 * Renders the selected thread's timeline and in-flight streaming turn.
 *
 * **Example** (Log component name)
 *
 * ```tsx
 * import { Thread } from "@/chat/ui/Thread"
 *
 * console.log(Thread.name) // "Thread"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Thread({ threadId }: { readonly threadId: ThreadId }): JSX.Element {
  const view = useAtomValue(visibleThreadTurnsAtoms(threadId));
  const turnActive = useAtomValue(turnActiveAtom);
  const reconcileTimeline = useAtomSet(reconcileThreadTimelineAtoms(threadId));
  const scrollThread = useAtomSet(scrollThreadAtoms(threadId));
  const setBottom = useAtomSet(setThreadBottomAtoms(threadId));
  const setViewport = useAtomSet(setThreadViewportAtoms(threadId));
  // the turn fiber must stay subscribed for the lifetime of the thread view,
  // otherwise the registry releases the fn atom and interrupts the stream.
  useAtomMount(runTurnAtom);
  useAtomSubscribe(threadTimelineAtoms(threadId), reconcileTimeline, { immediate: true });
  useAtomSubscribe(streamingTurnAtom, scrollThread);
  useAtomSubscribe(unreconciledTurnAtoms(threadId), scrollThread);

  return (
    <div ref={setViewport} className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="thread">
      <ThreadLoadState failed={view.failed} loading={view.loading} />
      <EmptyThread visible={view.empty} />

      {A.map(view.turns, (turn) => (
        <TurnRow
          key={turn.turnId}
          threadId={threadId}
          turn={turn}
          hasSiblings={HashSet.has(view.siblingTurnIds, turn.turnId)}
        />
      ))}

      <UnreconciledTurns turns={view.unreconciled} />
      <StreamingTurnView streaming={view.streaming} turnActive={turnActive} />
      <div ref={setBottom} />
    </div>
  );
}
