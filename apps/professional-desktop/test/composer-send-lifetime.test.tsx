import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import { RegistryContext, RegistryProvider, scheduleTask } from "@effect/atom-react";
import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

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
      const idleProbe = Atom.make(0);
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ scheduleTask, defaultIdleTTL: IDLE_TTL_MS })),
        (registry) => Effect.sync(() => registry.dispose())
      );
      registry.set(idleProbe, 1);
      expect(registry.get(idleProbe)).toBe(1);
      const onSend = vi.fn(() => true);
      const { container, unmount } = render(
        <RegistryContext.Provider value={registry}>
          <ChatComposer initialState={initialState} mountConfig={{ onSend }} />
        </RegistryContext.Provider>
      );
      const screen = within(container);

      const draftInEditor = yield* Effect.promise(() => screen.findByText("hello"));
      expect(draftInEditor, "an empty composer is a no-op and would pass this test vacuously").toBeInTheDocument();
      yield* sweep;
      expect(
        registry.get(idleProbe),
        "a tiny idle TTL sweeps an unlistened state atom back to its default, as the app's 30s TTL does"
      ).toBe(0);
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(
        onSend,
        "onSend is read only at send time; a swept handler atom is never re-seeded by useAtomInitialValues"
      ).toHaveBeenCalledTimes(1);
      unmount();
    })
  );

  it.effect(
    "reports an unbound composer instead of silently discarding the send",
    Effect.fnUntraced(function* () {
      const { container, unmount } = render(
        <RegistryProvider defaultIdleTTL={IDLE_TTL_MS}>
          <ChatComposer initialState={initialState} />
        </RegistryProvider>
      );
      const screen = within(container);

      yield* Effect.promise(() => screen.findByText("hello"));
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      const promise1 = yield* Effect.promise(() => screen.findByText(/not connected to a conversation/i));
      expect(promise1, "a missing send handler must say so rather than look broken").toBeInTheDocument();
      unmount();
    })
  );
});
