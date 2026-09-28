import { selectedThreadAtom } from "@beep/agents-client/Chat.atoms";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { Atom, AtomRegistry } from "effect/reactivity";

// The desktop registry disposes any atom with no listeners and no dependents once
// its idle TTL elapses. A tiny TTL reproduces in milliseconds what took the real
// app thirty seconds.
const IDLE_TTL_MS = 40;

const olderThread = WorkspaceIdentity.ThreadId.make(7);

describe("selected thread lifetime", () => {
  it.live(
    "keeps the user's thread selection while the chat surface is unmounted",
    Effect.fnUntraced(function* () {
      // Every subscriber of the selection lives inside the chat surface, which the
      // app unmounts when the user switches to Ontology, Vault sync, or Home. The
      // selection dropped to zero listeners and the sweep reset it to `O.none()` --
      // which the chat surface reads as "follow the list", so the user came back to
      // the most-recently-updated thread instead of the one they had open, and
      // whatever they typed next went to the wrong conversation.
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS })),
        (registry) => Effect.sync(() => registry.dispose())
      );

      const removable = Atom.make(false);
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* AtomRegistry.mount(registry, selectedThreadAtom);
          yield* AtomRegistry.mount(registry, removable);
          registry.set(removable, true);
          assertTrue(registry.get(removable));
          registry.set(selectedThreadAtom, O.some(olderThread));
        })
      );

      // The user switches surface; the chat subtree unmounts...
      // ...and browses elsewhere for longer than the idle TTL.
      yield* Effect.sleep(Duration.millis(IDLE_TTL_MS * 5));

      // The same registry must have swept an ordinary atom during this interval.
      assertFalse(registry.get(removable));
      assertSome(registry.get(selectedThreadAtom), olderThread);
    })
  );
});
