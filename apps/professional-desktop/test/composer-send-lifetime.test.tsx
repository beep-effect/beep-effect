import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import { RegistryProvider } from "@effect/atom-react";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, vi } from "vitest";

// The desktop registry sweeps atoms with an idle TTL (`ProfessionalAtomProvider`
// sets 30s). Any node with no listeners and no dependents is disposed once its
// TTL elapses, and a swept *state* atom comes back as its default — silently
// discarding whatever was written into it. A tiny TTL reproduces in milliseconds
// what took the real app thirty seconds.
const IDLE_TTL_MS = 40;

const draft = MdModel.Document.make({
  children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "hello" })] })],
});

const initialState = documentToEditorState(draft).pipe(Effect.runSync);

const sweep = Effect.promise(() => Bun.sleep(IDLE_TTL_MS * 5));

describe("chat composer send lifetime", { concurrent: false }, () => {
  afterEach(cleanup);

  it.effect(
    "still sends after the registry's idle TTL has elapsed",
    Effect.fnUntraced(function* () {
      // `onSend` is seeded into a per-editor atom once at mount and is only ever
      // read at send time, so nothing subscribed to it and the registry collected
      // it 30 seconds later. It came back as the default unbound handler — and
      // because `useAtomInitialValues` seeds an atom only once per registry, it was
      // never re-seeded. The composer stopped sending, permanently and silently,
      // with the user's draft still sitting in it. Enter and the Send button both
      // did nothing; there was no error, no toast, and no log to find.
      const onSend = vi.fn(() => true);
      const { container, unmount } = render(
        <RegistryProvider defaultIdleTTL={IDLE_TTL_MS}>
          <ChatComposer initialState={initialState} mountConfig={{ onSend }} />
        </RegistryProvider>
      );
      const screen = within(container);

      // The draft must actually be in the editor before Send means anything — an
      // empty composer is a legitimate no-op and would pass this test vacuously.
      yield* Effect.promise(() => screen.findByText("hello"));
      yield* sweep;
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(onSend).toHaveBeenCalledTimes(1);
      unmount();
    })
  );

  it.effect(
    "reports an unbound composer instead of silently discarding the send",
    Effect.fnUntraced(function* () {
      // Defense in depth for the whole class: if the send handler is ever missing
      // again, the composer must say so rather than look broken.
      const { container, unmount } = render(
        <RegistryProvider defaultIdleTTL={IDLE_TTL_MS}>
          <ChatComposer initialState={initialState} />
        </RegistryProvider>
      );
      const screen = within(container);

      yield* Effect.promise(() => screen.findByText("hello"));
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(yield* Effect.promise(() => screen.findByText(/not connected to a conversation/i))).toBeInTheDocument();
      unmount();
    })
  );
});
