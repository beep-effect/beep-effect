/**
 * Thread view: the persisted timeline plus the in-flight streaming turn.
 *
 * Reads the selected thread's timeline read-model from
 * {@link threadTimelineAtoms} and renders each {@link TimelineTurn}: message
 * items through {@link MessageView}, tool-call items as a placeholder chip, and
 * a cost-rollup line derived from `costMicros`. User turns carry an Edit control
 * that seeds {@link editTargetAtom}; edited turns (those with sibling branches)
 * expose a degenerate version-selector affordance.
 *
 * The in-flight {@link streamingTurnAtom} renders optimistically: a "Thinking…"
 * indicator until the first block arrives, then {@link StreamingBlocks}, with a
 * Stop control that cancels the turn fiber via an `Atom.Interrupt` write. During
 * an edit turn the rewritten-away tail is hidden optimistically. The turn fiber
 * is kept subscribed with `useAtomMount(runTurnAtom)`, and scroll-to-bottom is
 * driven by `useAtomSubscribe` rather than effects.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import {
  editTargetAtom,
  runTurnAtom,
  streamingTurnAtom,
  threadTimelineAtoms,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { Button } from "@beep/ui/components/button";
import { A, O, thunkNull } from "@beep/utils";
import { Thread as ThreadProjections } from "@beep/workspace-use-cases/public";
import { useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useRef } from "react";
import { MessageView } from "./MessageView.tsx";
import { StreamingBlocks } from "./StreamingBlocks.tsx";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { Thread as ThreadUseCases } from "@beep/workspace-use-cases/public";
import type { JSX } from "react";

type ThreadId = WorkspaceIdentity.ThreadId;
type TimelineTurn = ThreadUseCases.TimelineTurn;
type TimelineItem = ThreadUseCases.TimelineItem;

// How far from the bottom still counts as "following along". A couple of lines of
// slack keeps sub-pixel scroll rounding and the tail padding from reading as
// "the reader scrolled away".
const PINNED_SLACK_PX = 64;

const ToolCallChip = ({ name }: { readonly name: string }): JSX.Element => (
  <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
    tool: {name}
  </span>
);

const TimelineItemRow = ({ item }: { readonly item: TimelineItem }): JSX.Element =>
  item.kind === "message" ? <MessageView content={item.content} /> : <ToolCallChip name={item.name} />;

const turnRole = (turn: TimelineTurn): string => {
  const first = A.findFirst(turn.items, (item) => item.kind === "message");
  return O.match(first, {
    onNone: () => "assistant",
    onSome: (item) => (item.kind === "message" ? item.role : "assistant"),
  });
};

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
  const setEditTarget = useAtomSet(editTargetAtom);
  const role = turnRole(turn);
  const userMessage = A.findFirst(turn.items, (item) => item.kind === "message" && item.role === "user");

  return (
    <div className={`mb-4 flex flex-col ${role === "user" ? "items-end" : "items-start"}`} data-testid={`turn-${role}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${role === "user" ? "bg-primary/10" : "bg-muted/50"}`}>
        {A.map(turn.items, (item, i) => (
          <TimelineItemRow key={i} item={item} />
        ))}
        <CostRollup costMicros={turn.costMicros} />
        <div className="mt-1 flex items-center gap-2">
          {O.match(userMessage, {
            onNone: thunkNull,
            onSome: (item) =>
              item.kind === "message" ? (
                <Button
                  variant="ghost"
                  size="xs"
                  title="Edit — rewrites the thread from here"
                  onClick={() => setEditTarget(O.some({ threadId, turnId: turn.turnId, content: item.content }))}
                  data-testid="turn-edit"
                >
                  Edit
                </Button>
              ) : null,
          })}
          {/* version selector affordance — only when this turn has sibling
              branches (an earlier edit forked the thread). v1 renders nothing
              for single-branch turns. */}
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

// a turn has sibling branches when another turn shares its parent — the marker
// that an edit forked this point in the thread.
const turnHasSiblings = (allTurns: ReadonlyArray<TimelineTurn>, turn: TimelineTurn): boolean =>
  O.match(turn.parentTurnId, {
    onNone: () => false,
    onSome: (parentId) => A.filter(allTurns, (t) => O.exists(t.parentTurnId, (p) => p === parentId)).length > 1,
  });

/**
 * Renders the selected thread's timeline and in-flight streaming turn.
 *
 * @example
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
  const timelineAtom = threadTimelineAtoms(threadId);
  const timeline = useAtomValue(timelineAtom);
  const streaming = useAtomValue(streamingTurnAtom);
  const turnActive = useAtomValue(turnActiveAtom);
  const runTurn = useAtomSet(runTurnAtom);
  // the turn fiber must stay subscribed for the lifetime of the thread view,
  // otherwise the registry releases the fn atom and interrupts the stream.
  useAtomMount(runTurnAtom);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow the stream only while the reader is already at the bottom. Scrolling
  // unconditionally dragged anyone who had scrolled up to re-read an earlier
  // answer back down again on every single streamed block.
  const scrollToBottom = (): void => {
    const viewport = scrollRef.current;
    if (viewport !== null && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > PINNED_SLACK_PX) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useAtomSubscribe(timelineAtom, scrollToBottom);
  useAtomSubscribe(streamingTurnAtom, scrollToBottom);

  // a turn keeps streaming in its own thread when the user navigates away.
  const streamingHere = O.filter(streaming, (turn) => turn.threadId === threadId);

  // The conversation as it now stands: an edited turn and the exchange it
  // produced are gone for good, not merely hidden while the replacement streams.
  // (The transcript used to fall back to every turn once streaming finished, so
  // the tail the rewrite banner promised to discard came straight back.)
  const allTurns = AsyncResult.isSuccess(timeline) ? ThreadProjections.activeBranchTurns(timeline.value.turns) : [];
  // While the replacement streams, its predecessor is already on its way out.
  const turns = O.flatMap(streamingHere, (turn) => turn.truncateFrom).pipe(
    O.flatMap((truncateFrom) => A.findFirstIndex(allTurns, (turn) => turn.turnId === truncateFrom)),
    O.map((index) => A.take(allTurns, index)),
    O.getOrElse(() => allTurns)
  );

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" data-testid="thread">
      {AsyncResult.isInitial(timeline) && timeline.waiting ? (
        <div className="text-sm text-muted-foreground" data-testid="thread-loading">
          Loading thread…
        </div>
      ) : null}
      {AsyncResult.isFailure(timeline) ? (
        <div className="text-sm text-destructive" data-testid="thread-error">
          Failed to load the thread — is the sidecar running?
        </div>
      ) : null}
      {A.isReadonlyArrayEmpty(turns) && AsyncResult.isSuccess(timeline) && O.isNone(streamingHere) ? (
        <div className="flex h-full flex-col items-center justify-center text-center" data-testid="thread-empty">
          <h2 className="text-lg font-semibold">Start the conversation</h2>
          <p className="text-sm text-muted-foreground">Ask anything. Responses stream in as structured rich text.</p>
        </div>
      ) : null}

      {A.map(turns, (turn) => (
        <TurnRow key={turn.turnId} threadId={threadId} turn={turn} hasSiblings={turnHasSiblings(allTurns, turn)} />
      ))}

      {O.match(streamingHere, {
        onNone: thunkNull,
        onSome: (turn) => (
          <>
            {/* The message you just sent, shown while the reply streams. The streaming
                turn has always CARRIED this ("optimistic rendering of the just-sent user
                message") and the transcript threw it away — so between pressing Enter
                and the answer landing, your own words were nowhere on screen, and an
                edit-regenerate hid the turn it was replacing without showing what it was
                replacing it with. */}
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
                {turnActive ? (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="xs"
                      title="Stop generating"
                      onClick={() => runTurn(Atom.Interrupt)}
                      data-testid="turn-stop"
                    >
                      Stop
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ),
      })}
      <div ref={bottomRef} />
    </div>
  );
}
