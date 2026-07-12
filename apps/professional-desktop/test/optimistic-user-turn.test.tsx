import { StreamingTurn, streamingTurnAtom } from "@beep/agents-client/Chat.atoms";
import * as MdModel from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Thread } from "@/chat/ui/Thread";
import "@testing-library/jest-dom/vitest";
import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { afterEach, beforeAll, describe, expect } from "vitest";
import type { JSX } from "react";

const threadId = S.decodeUnknownSync(WorkspaceIdentity.ThreadId)(1);

const userMessage = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "what did I just ask?" })] })],
});

// Seeds a turn that is mid-stream: the user's message is in flight, no answer yet.
function StreamingThread(): JSX.Element {
  const setStreaming = useAtomSet(streamingTurnAtom);
  return (
    <>
      <button
        type="button"
        data-testid="begin"
        onClick={() =>
          setStreaming(
            O.some(
              StreamingTurn.make({
                threadId,
                userContent: userMessage,
                truncateFrom: O.none(),
                blocks: [],
              })
            )
          )
        }
      >
        begin
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
  afterEach(cleanup);

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
});
