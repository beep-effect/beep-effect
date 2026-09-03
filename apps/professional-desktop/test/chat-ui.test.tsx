/**
 * jsdom render tests for the desktop chat UI.
 *
 * These exercise the render side only: the chat atoms require a live rpc
 * sidecar to resolve, so the timeline/thread-list queries stay in their pending
 * (loading) state here. The tests assert the shell, the streaming-block
 * renderer, and the persisted-message viewer render without throwing — live
 * send/edit/stream behavior is covered by the in-memory chat-contract test and,
 * end-to-end, requires the sidecar.
 */
import "@testing-library/jest-dom/vitest";
import { ChatClient, runTurnAtom, SendTurnRequest, turnErrorAtom } from "@beep/agents-client/Chat.atoms";
import { ChatActionError } from "@beep/agents-use-cases/public";
import * as Md from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { toast } from "@beep/ui/components/sonner";
import { RegistryProvider, useAtomInitialValues, useAtomSet, useAtomSubscribe } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Reactivity } from "effect/unstable/reactivity";
import { afterEach, describe, expect, vi } from "vitest";
import { userDocument } from "@/chat/ChatFixtures";
import { ChatApp } from "@/chat/ui/ChatApp";
import { ChatTurnErrorToasts } from "@/chat/ui/ChatTurnErrorToasts";
import { MessageView } from "@/chat/ui/MessageView";
import { blockRenderKey, boundedKey, StreamingBlocks, stableOccurrenceKeys } from "@/chat/ui/StreamingBlocks";
import type { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";

const decodeThreadId = S.decodeUnknownSync(WorkspaceIdentity.ThreadId);

const failingChatClient = ChatClient.of(((tag: string) =>
  tag === "SendMessage"
    ? Stream.fail(ChatActionError.new("RPC stream failed safely"))
    : Effect.die(new Error(`unexpected chat RPC in runTurnAtom test: ${tag}`))) as unknown as ChatClient["Service"]);

const FailingChatClientLayer = Layer.mergeAll(Layer.succeed(ChatClient, failingChatClient), Reactivity.layer);

vi.mock("@beep/ui/components/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function PushTurnError({ message }: { readonly message: string }) {
  useAtomInitialValues([[turnErrorAtom, ChatActionError.new(message).pipe(O.some)]]);

  return null;
}

function CaptureTurnError({ onValue }: { readonly onValue: (error: O.Option<ChatActionError>) => void }) {
  useAtomSubscribe(turnErrorAtom, onValue, { immediate: true });

  return null;
}

function RunFailingTurn({ threadId }: { readonly threadId: WorkspaceIdentity.ThreadId }) {
  const runTurn = useAtomSet(runTurnAtom);

  return (
    <button
      type="button"
      data-testid="run-failing-turn"
      onClick={() => runTurn(SendTurnRequest.make({ threadId, content: userDocument("Trigger failure") }))}
    >
      Run failing turn
    </button>
  );
}

describe("StreamingBlocks", () => {
  it("renders the assistant block vocabulary to the expected tags", () => {
    const blocks: ReadonlyArray<AssistantBlock> = [
      { type: "heading", level: "h2", children: [{ type: "text", text: "Title" }] },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "bold", bold: true },
          { type: "text", text: " and " },
          { type: "text", text: "italic", italic: true },
          { type: "link", url: "https://example.com", text: "link" },
        ],
      },
      { type: "quote", children: [{ type: "text", text: "a quote" }] },
      { type: "list", listType: "bullet", items: [{ children: [{ type: "text", text: "one" }] }] },
      { type: "list", listType: "number", items: [{ children: [{ type: "text", text: "two" }] }] },
      { type: "code", code: "console.log('beep')" },
      { type: "code", language: "mermaid", code: "graph TD\n  A --> B" },
      {
        type: "table",
        headerRow: true,
        rows: [
          { cells: [{ children: [{ type: "text", text: "Name" }] }, { children: [{ type: "text", text: "Value" }] }] },
          { cells: [{ children: [{ type: "text", text: "Language" }] }, { children: [{ type: "text", text: "TS" }] }] },
        ],
      },
      { type: "youtube", videoId: "M7lc1UVf-VE" },
    ];

    const { container } = render(<StreamingBlocks blocks={blocks} />);

    expect(container.querySelector("h2")).toHaveTextContent("Title");
    expect(container.querySelector("p")).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(container.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(container.querySelector("blockquote")).toHaveTextContent("a quote");
    expect(container.querySelector("ul")).toHaveTextContent("one");
    expect(container.querySelector("ol")).toHaveTextContent("two");
    expect(container.querySelector("pre code")).toHaveTextContent("console.log('beep')");
    expect(container.querySelector("[data-testid='mermaid-diagram']")).toHaveTextContent("Rendering diagram");
    expect(container.querySelector("table")).toHaveTextContent("Language");
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"
    );
  });

  it("renders nothing problematic for an empty block array", () => {
    const { container } = render(<StreamingBlocks blocks={[]} />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("bounds the key derived from megabyte-scale untrusted content (CSF-004)", () => {
    const huge = "x".repeat(2_000_000);
    // boundedKey hashes only a capped prefix + appends length, so the key never
    // grows with content size and the full body is never hashed each render.
    expect(boundedKey(huge).length).toBeLessThan(64);
    // a multi-MB code block derives a bounded render key without materializing
    // the whole body into the key string.
    const codeRenderKey = blockRenderKey({ type: "code", code: huge });
    expect(codeRenderKey.length).toBeLessThan(8192);
    expect(boundedKey(codeRenderKey).length).toBeLessThan(64);
  });

  it("bounds a paragraph's key without first materializing the paragraph", () => {
    // The code block was bounded; the prose was not. `boundedKey` hashes a capped
    // prefix — but the string it was handed had already been built in full, because
    // the inline key concatenated every text node's whole body first. The guard
    // against a megabyte paragraph allocated the megabyte in order to bound it.
    const huge = "x".repeat(2_000_000);

    const paragraphKey = blockRenderKey({ type: "paragraph", children: [{ type: "text", text: huge }] });

    expect(paragraphKey.length).toBeLessThan(8192);
    expect(boundedKey(paragraphKey).length).toBeLessThan(64);
  });

  it("keeps two huge paragraphs distinct when they share an opening", () => {
    // A truncated sample alone would collide. The count and the true length -- both
    // computed without concatenating anything -- are what keep them apart.
    const shared = "z".repeat(1_000);
    const first = blockRenderKey({ type: "paragraph", children: [{ type: "text", text: shared }] });
    const second = blockRenderKey({ type: "paragraph", children: [{ type: "text", text: `${shared}tail` }] });

    expect(first).not.toBe(second);
  });

  it("disambiguates duplicate content with stable #n occurrence suffixes (CSF-004)", () => {
    const keys = stableOccurrenceKeys(["a", "a", "b", "a"], (s) => s);
    expect(keys[0]).not.toContain("#");
    expect(keys[1]).toBe(`${keys[0]}#1`);
    expect(keys[3]).toBe(`${keys[0]}#2`);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("keeps distinct large contents distinct via the appended length (no prefix collision)", () => {
    const shared = "y".repeat(5000);
    expect(boundedKey(shared)).not.toBe(boundedKey(`${shared}-tail`));
  });
});

describe("MessageView", () => {
  it("renders a persisted Md.Document's text", () => {
    const document = Md.Document.make({
      children: [Md.P.make({ children: [Md.Text.make({ value: "hello from a persisted message" })] })],
    });

    const { getByText, unmount } = render(<MessageView content={document} />);

    expect(getByText("hello from a persisted message")).toBeInTheDocument();
    unmount();
  });
});

describe("ChatApp", () => {
  it("renders the chat shell in its empty/loading state without a live server", () => {
    const { getByTestId, unmount } = render(<ChatApp />);

    // shell chrome: sidebar (with the New thread control) and the app frame.
    expect(getByTestId("chat-app")).toBeInTheDocument();
    expect(getByTestId("sidebar")).toBeInTheDocument();
    expect(getByTestId("sidebar-new")).toBeInTheDocument();
    // with no live server and no selection, no thread is active yet.
    expect(getByTestId("chat-no-thread")).toBeInTheDocument();
    unmount();
  });
});

describe("ChatTurnErrorToasts", () => {
  it.effect(
    "toasts a client-safe turn error message and clears the atom",
    Effect.fnUntraced(function* () {
      let latestTurnError: O.Option<ChatActionError> = O.none();

      render(
        <RegistryProvider>
          <CaptureTurnError onValue={(error) => (latestTurnError = error)} />
          <ChatTurnErrorToasts />
          <PushTurnError message="Assistant stream failed safely" />
        </RegistryProvider>
      );

      yield* Effect.promise(() =>
        waitFor(() => expect(toast.error).toHaveBeenCalledWith("Assistant stream failed safely"))
      );
      yield* Effect.promise(() => waitFor(() => expect(O.isNone(latestTurnError)).toBe(true)));
    })
  );

  it.effect(
    "toasts a failed runTurnAtom RPC stream and clears the atom",
    Effect.fnUntraced(function* () {
      let latestTurnError: O.Option<ChatActionError> = O.none();

      const { getByTestId } = render(
        <RegistryProvider initialValues={[[ChatClient.runtime.layer, FailingChatClientLayer]]}>
          <CaptureTurnError onValue={(error) => (latestTurnError = error)} />
          <ChatTurnErrorToasts />
          <RunFailingTurn threadId={decodeThreadId(1)} />
        </RegistryProvider>
      );
      fireEvent.click(getByTestId("run-failing-turn"));

      yield* Effect.promise(() => waitFor(() => expect(toast.error).toHaveBeenCalledWith("RPC stream failed safely")));
      yield* Effect.promise(() => waitFor(() => expect(O.isNone(latestTurnError)).toBe(true)));
    })
  );
});
