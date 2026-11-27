import { selectedThreadAtom } from "@beep/agents-client/Chat.atoms";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

const IDLE_TTL_MS = 40;

const olderThread = WorkspaceIdentity.ThreadId.make(7);

describe("selected thread lifetime", () => {
  it.live(
    "keeps the selected conversation after chat unmount and idle sweep",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS })),
        (registry) => Effect.sync(() => registry.dispose())
      );

      const sweptControlAtom = Atom.make(false);
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* AtomRegistry.mount(registry, selectedThreadAtom);
          yield* AtomRegistry.mount(registry, sweptControlAtom);
          registry.set(sweptControlAtom, true);
          assertTrue(registry.get(sweptControlAtom));
          registry.set(selectedThreadAtom, O.some(olderThread));
        })
      );

      yield* Effect.sleep(Duration.millis(IDLE_TTL_MS * 5));

      assertFalse(registry.get(sweptControlAtom));
      assertSome(registry.get(selectedThreadAtom), olderThread);
    })
  );
});
