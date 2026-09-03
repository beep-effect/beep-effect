import {
  ChatClient,
  runTurnAtom,
  StreamingTurn,
  streamingTurnAtom,
  threadTimelineAtoms,
  unreconciledTurnAtoms,
} from "@beep/agents-client/Chat.atoms";
import { ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent";
import { ChatActionError } from "@beep/agents-use-cases/public";
import * as MdModel from "@beep/md/Md.model";
import { NonNegativeInt } from "@beep/schema/Number";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline, TimelineMessageItem, TimelineTurn } from "@beep/workspace-use-cases/aggregates/Thread";
import { Composer } from "@/chat/ui/Composer";
import { Thread } from "@/chat/ui/Thread";
import "@testing-library/jest-dom/vitest";
import { RegistryProvider, useAtomRefresh, useAtomSet } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AsyncResult, Reactivity } from "effect/unstable/reactivity";
import { afterEach, beforeAll, describe, expect, vi } from "vitest";
import type { JSX } from "react";

const threadId = S.decodeSync(WorkspaceIdentity.ThreadId)(1);

const userMessage = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "what did I just ask?" })] })],
});
const completedBlock = ParagraphBlock.make({
  children: [TextInline.make({ text: "the reply is still visible" })],
});
const supersededContent = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "superseded durable tail" })] })],
});
const supersededMiddle = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "earlier superseded interval" })] })],
});
const replacementContent = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "replacement branch" })] })],
});
const replacementReply = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "replacement reply" })] })],
});
const editedTurnId = WorkspaceIdentity.TurnId.make(11);
const laterTurnId = WorkspaceIdentity.TurnId.make(12);
const editTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(10),
      turnIndex: NonNegativeInt.make(0),
      items: [TimelineMessageItem.make({ role: "user", content: userMessage })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: editedTurnId,
      turnIndex: NonNegativeInt.make(1),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededMiddle })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: laterTurnId,
      turnIndex: NonNegativeInt.make(2),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
  ],
});
const retryTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(20),
      turnIndex: NonNegativeInt.make(0),
      items: [TimelineMessageItem.make({ role: "user", content: userMessage })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(21),
      turnIndex: NonNegativeInt.make(1),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
  ],
});
const branchedTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(30),
      turnIndex: NonNegativeInt.make(0),
      items: [TimelineMessageItem.make({ role: "user", content: userMessage })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(31),
      turnIndex: NonNegativeInt.make(1),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(32),
      turnIndex: NonNegativeInt.make(2),
      parentTurnId: O.some(WorkspaceIdentity.TurnId.make(30)),
      items: [TimelineMessageItem.make({ role: "user", content: replacementContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(33),
      turnIndex: NonNegativeInt.make(3),
      items: [TimelineMessageItem.make({ role: "assistant", content: replacementReply })],
      costMicros: 0,
    }),
  ],
});
const corruptBranchTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(40),
      turnIndex: NonNegativeInt.make(0),
      parentTurnId: O.some(WorkspaceIdentity.TurnId.make(40)),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(41),
      turnIndex: NonNegativeInt.make(1),
      parentTurnId: O.some(WorkspaceIdentity.TurnId.make(99)),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(42),
      turnIndex: NonNegativeInt.make(2),
      parentTurnId: O.some(WorkspaceIdentity.TurnId.make(43)),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(43),
      turnIndex: NonNegativeInt.make(3),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(44),
      turnIndex: NonNegativeInt.make(4),
      parentTurnId: O.some(WorkspaceIdentity.TurnId.make(45)),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(45),
      turnIndex: NonNegativeInt.make(4),
      items: [TimelineMessageItem.make({ role: "assistant", content: supersededContent })],
      costMicros: 0,
    }),
  ],
});
const activeStreamingTurn = StreamingTurn.make({
  threadId,
  userContent: userMessage,
  truncateFrom: O.none(),
  blocks: [],
});

// Seeds a turn that is mid-stream: the user's message is in flight, no answer yet.
function StreamingThread(): JSX.Element {
  const setStreaming = useAtomSet(streamingTurnAtom);
  return (
    <>
      <button type="button" data-testid="begin" onClick={() => setStreaming(O.some(activeStreamingTurn))}>
        begin
      </button>
      <Thread threadId={threadId} />
    </>
  );
}

function CompletedFallbackThread(): JSX.Element {
  const setUnreconciled = useAtomSet(unreconciledTurnAtoms(threadId));
  const refreshTimeline = useAtomRefresh(threadTimelineAtoms(threadId));
  return (
    <>
      <button
        type="button"
        data-testid="retain"
        onClick={() =>
          setUnreconciled([
            StreamingTurn.make({
              threadId,
              userContent: userMessage,
              truncateFrom: O.none(),
              blocks: [completedBlock],
            }),
          ])
        }
      >
        retain
      </button>
      <button
        type="button"
        data-testid="retain-receipt"
        onClick={() =>
          setUnreconciled([
            StreamingTurn.make({
              threadId,
              userContent: userMessage,
              truncateFrom: O.none(),
              reconciliation: "receipt",
              blocks: [completedBlock],
            }),
          ])
        }
      >
        retain receipt
      </button>
      <button type="button" data-testid="retry-timeline" onClick={refreshTimeline}>
        retry timeline
      </button>
      <Thread threadId={threadId} />
    </>
  );
}

function EditFallbackThread(): JSX.Element {
  const setUnreconciled = useAtomSet(unreconciledTurnAtoms(threadId));
  return (
    <>
      <button
        type="button"
        data-testid="retain-edit"
        onClick={() =>
          setUnreconciled([
            StreamingTurn.make({
              threadId,
              userContent: userMessage,
              truncateFrom: O.some(laterTurnId),
              blocks: [completedBlock],
            }),
            StreamingTurn.make({
              threadId,
              userContent: userMessage,
              truncateFrom: O.some(editedTurnId),
              blocks: [completedBlock],
            }),
          ])
        }
      >
        retain edit
      </button>
      <Thread threadId={threadId} />
    </>
  );
}

describe("the message you just sent", { concurrent: false }, () => {
  // jsdom has no layout, so the transcript's autoscroll has nothing to scroll.
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.effect(
    "scrolls an initially successful timeline after its turns commit",
    Effect.fnUntraced(function* () {
      let scheduledFrame = O.none<FrameRequestCallback>();
      const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = O.some(callback);
        return 1;
      });
      const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
      vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

      render(
        <RegistryProvider initialValues={[[threadTimelineAtoms(threadId), AsyncResult.success(editTimeline)]]}>
          <Thread threadId={threadId} />
        </RegistryProvider>
      );

      yield* Effect.promise(() => waitFor(() => expect(requestAnimationFrame).toHaveBeenCalledOnce()));
      expect(scrollIntoView).not.toHaveBeenCalled();

      O.getOrThrow(scheduledFrame)(0);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
    })
  );

  it.effect(
    "is on screen while the reply streams",
    Effect.fnUntraced(function* () {
      // The streaming turn has always carried this — "optimistic rendering of the
      // just-sent user message" — and the transcript threw it away. Between pressing
      // Enter and the answer landing, your own words were nowhere on screen; and an
      // edit-regenerate hid the turn it was replacing without ever showing what it was
      // replacing it with.
      const { container } = render(
        <RegistryProvider>
          <StreamingThread />
        </RegistryProvider>
      );
      const screen = within(container);

      screen.getByTestId("begin").click();

      const sent = yield* Effect.promise(() => waitFor(() => screen.getByTestId("turn-streaming-user")));

      expect(sent).toHaveTextContent("what did I just ask?");
    })
  );

  it.effect(
    "renders exactly one canonical Stop control while the reply streams",
    Effect.fnUntraced(function* () {
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [streamingTurnAtom, O.some(activeStreamingTurn)],
            [runTurnAtom, AsyncResult.initial(true)],
          ]}
        >
          <Thread threadId={threadId} />
          <Composer threadId={threadId} />
        </RegistryProvider>
      );
      const screen = within(container);

      const stop = yield* Effect.promise(() => screen.findByTestId("turn-stop"));

      expect(stop).toHaveAccessibleName("Stop generating");
      expect(screen.getAllByTestId("turn-stop")).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Stop generating" })).toHaveLength(1);
    })
  );

  it.effect(
    "renders the version selector on a single edit replacement while hiding the superseded branch",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const { container } = render(
        <RegistryProvider initialValues={[[timelineAtom, AsyncResult.success(branchedTimeline)]]}>
          <Thread threadId={threadId} />
        </RegistryProvider>
      );
      const screen = within(container);

      yield* Effect.promise(() => screen.findByTestId("turn-versions"));

      const activeUserTurn = screen.getByTestId("turn-user");
      const activeAssistantTurn = screen.getByTestId("turn-assistant");
      expect(activeUserTurn).toHaveTextContent("replacement branch");
      expect(within(activeUserTurn).getByTestId("turn-versions")).toBeInTheDocument();
      expect(activeAssistantTurn).toHaveTextContent("replacement reply");
      expect(within(activeAssistantTurn).queryByTestId("turn-versions")).not.toBeInTheDocument();
      expect(screen.queryByText("what did I just ask?")).not.toBeInTheDocument();
      expect(screen.queryByText("superseded durable tail")).not.toBeInTheDocument();
    })
  );

  it.effect(
    "does not render version selectors for corrupt parent links",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const { container } = render(
        <RegistryProvider initialValues={[[timelineAtom, AsyncResult.success(corruptBranchTimeline)]]}>
          <Thread threadId={threadId} />
        </RegistryProvider>
      );
      const screen = within(container);

      expect(yield* Effect.promise(() => screen.findAllByTestId("turn-assistant"))).toHaveLength(6);
      expect(screen.queryAllByTestId("turn-versions")).toHaveLength(0);
    })
  );

  it.effect(
    "retires a retained fallback when a later fresh timeline succeeds",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.succeed(retryTimeline);
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [timelineAtom, AsyncResult.fail(ChatActionError.new("timeline refresh unavailable"))],
            [ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, client), Reactivity.layer)],
          ]}
        >
          <CompletedFallbackThread />
        </RegistryProvider>
      );
      const screen = within(container);
      screen.getByTestId("retain").click();
      expect(yield* Effect.promise(() => screen.findByTestId("turn-unreconciled"))).toBeInTheDocument();

      screen.getByTestId("retry-timeline").click();
      expect(yield* Effect.promise(() => screen.findByText("superseded durable tail"))).toBeInTheDocument();
      expect(screen.queryByTestId("turn-unreconciled")).not.toBeInTheDocument();
    })
  );

  it.effect(
    "keeps a receipt-uncertain prompt visible across successful timeline refreshes",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.succeed(retryTimeline);
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [timelineAtom, AsyncResult.success(retryTimeline)],
            [ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, client), Reactivity.layer)],
          ]}
        >
          <CompletedFallbackThread />
        </RegistryProvider>
      );
      const screen = within(container);

      screen.getByTestId("retain-receipt").click();
      expect(yield* Effect.promise(() => screen.findByTestId("turn-unreconciled"))).toBeInTheDocument();

      screen.getByTestId("retry-timeline").click();
      expect(yield* Effect.promise(() => screen.findByText("superseded durable tail"))).toBeInTheDocument();
      expect(screen.getByTestId("turn-unreconciled")).toBeInTheDocument();
      expect(screen.getByTestId("turn-unreconciled-user")).toHaveTextContent("what did I just ask?");
    })
  );

  it.effect(
    "keeps a completed reply visible after refresh failure without leaving Stop active",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const { container } = render(
        <RegistryProvider
          initialValues={[[timelineAtom, AsyncResult.fail(ChatActionError.new("timeline refresh unavailable"))]]}
        >
          <CompletedFallbackThread />
        </RegistryProvider>
      );
      const screen = within(container);

      screen.getByTestId("retain").click();

      expect(yield* Effect.promise(() => screen.findByText("the reply is still visible"))).toBeInTheDocument();
      expect(screen.queryByTestId("turn-stop")).not.toBeInTheDocument();
      expect(screen.getByTestId("thread-error")).toBeInTheDocument();
    })
  );

  it.effect(
    "keeps the superseded timeline tail hidden while an edited fallback awaits reconciliation",
    Effect.fnUntraced(function* () {
      const timelineAtom = threadTimelineAtoms(threadId);
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [
              timelineAtom,
              AsyncResult.failWithPrevious(ChatActionError.new("timeline refresh unavailable"), {
                previous: O.some(AsyncResult.success(editTimeline)),
              }),
            ],
          ]}
        >
          <EditFallbackThread />
        </RegistryProvider>
      );
      const screen = within(container);
      expect(screen.getByText("superseded durable tail")).toBeInTheDocument();
      expect(screen.getByText("earlier superseded interval")).toBeInTheDocument();

      screen.getByTestId("retain-edit").click();
      expect(yield* Effect.promise(() => screen.findAllByText("the reply is still visible"))).toHaveLength(2);
      expect(screen.queryByText("superseded durable tail")).not.toBeInTheDocument();
      expect(screen.queryByText("earlier superseded interval")).not.toBeInTheDocument();
    })
  );
});
