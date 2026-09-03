import {
  ChatClient,
  draftAtoms,
  draftRevisionAtoms,
  runTurnAtom,
  SendTurnRequest,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as Md from "@beep/md/Md.model";
import { SafeDocument } from "@beep/md/Md.safe";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline } from "@beep/workspace-use-cases/aggregates/Thread";
import { it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Atom, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import { describe, expect } from "vitest";
import { composerSurfaceAtoms, dispatchTurnWithConfirm } from "@/chat/ui/Composer.atoms";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

const threadId = WorkspaceIdentity.ThreadId.make(826);
const content: SafeDocument = Result.getOrThrow(
  S.decodeUnknownResult(SafeDocument)(
    Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value: "SMOKE826" })] })] })
  )
);

// The confirm window is real time (a detached fiber outside any registry), so
// the tests shrink it and wait it out with a real sleep.
const confirmTimeout = Duration.millis(50);
const settle = Effect.sleep(Duration.millis(200));
const emptyTimeline = ThreadTimeline.make({ threadId, turns: [] });

const deadClient = ChatClient.of(((tag: string) =>
  Effect.die(`unexpected chat RPC: ${tag}`)) as unknown as ChatClient["Service"]);

// Mount the persistent atoms up front: unmounted nodes are transient in a
// bare registry (a later `get` re-creates them at their defaults), and the
// production tree keeps all three mounted anyway.
const makeRegistry = (): AtomRegistry.AtomRegistry => {
  const registry = AtomRegistry.make({
    initialValues: [
      [ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, deadClient), Reactivity.layer)],
    ],
  });
  registry.mount(draftAtoms(threadId));
  registry.mount(draftRevisionAtoms(threadId));
  registry.mount(runTurnAtom);
  return registry;
};

const waitForTurnStart = (registry: AtomRegistry.AtomRegistry): Effect.Effect<void, string> =>
  Effect.suspend(() =>
    registry.get(turnActiveAtom) ? Effect.void : Effect.fail("composer turn has not started")
  ).pipe(
    Effect.retry(
      Schedule.spaced(Duration.millis(10)).pipe(Schedule.upTo({ duration: Duration.seconds(3), times: 300 }))
    )
  );

describe("dispatchTurnWithConfirm", () => {
  it.live(
    "restores the draft when the dispatch is swallowed",
    Effect.fnUntraced(function* () {
      // A submit whose write is silently dropped — the zombie-node failure
      // mode the QA 2026-08-26 P0 found: the closure runs, nothing happens.
      const swallowedSubmit = Atom.writable(
        () => 0,
        (_ctx, _value: SafeDocument) => void 0
      );
      const registry = makeRegistry();
      const revisionBefore = registry.get(draftRevisionAtoms(threadId));

      dispatchTurnWithConfirm(registry, threadId, content, swallowedSubmit, confirmTimeout);
      yield* settle;

      expect(O.isSome(registry.get(draftAtoms(threadId)))).toBe(true);
      expect(registry.get(draftRevisionAtoms(threadId))).toBe(revisionBefore + 1);
      registry.dispose();
    })
  );

  it.live(
    "never restores over a synchronous turn start (subscription races the dispatch)",
    Effect.fnUntraced(function* () {
      // A submit whose write starts the turn synchronously inside the set —
      // the fastest possible acceptance. The confirm must arm its turn
      // subscription BEFORE dispatching or this transition is missed and the
      // draft is falsely restored after the timeout.
      const synchronousSubmit = Atom.writable(
        () => 0,
        (ctx, value: SafeDocument) => {
          ctx.set(runTurnAtom, SendTurnRequest.make({ threadId, content: value }));
        }
      );
      const registry = makeRegistry();
      const revisionBefore = registry.get(draftRevisionAtoms(threadId));

      dispatchTurnWithConfirm(registry, threadId, content, synchronousSubmit, confirmTimeout);
      yield* settle;

      expect(O.isNone(registry.get(draftAtoms(threadId)))).toBe(true);
      expect(registry.get(draftRevisionAtoms(threadId))).toBe(revisionBefore);
      registry.dispose();
    })
  );

  it.live(
    "dispatches from the composer closure after its handler atom is disposed",
    Effect.fnUntraced(function* () {
      const streamingClient = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.succeed(emptyTimeline);
        if (tag === "GetTurnRequestStatus") return Effect.succeed("persisted");
        if (tag === "SendMessage") return Stream.never;
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = AtomRegistry.make({
        defaultIdleTTL: 0,
        timeoutResolution: 1,
        initialValues: [
          [professionalBrowserRuntime.layer, Layer.empty],
          [ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, streamingClient), Reactivity.layer)],
        ],
      });
      const surfaceAtom = composerSurfaceAtoms(threadId)(content);
      registry.mount(draftAtoms(threadId));
      registry.mount(draftRevisionAtoms(threadId));
      registry.mount(runTurnAtom);
      registry.mount(turnActiveAtom);
      const unmountSurface = registry.mount(surfaceAtom);
      const send = registry.get(surfaceAtom).onSend;
      const serialized = yield* documentToEditorState(content);

      unmountSurface();
      yield* Effect.sleep(Duration.millis(25));
      expect(send(serialized)).toBe(true);
      yield* waitForTurnStart(registry);

      expect(registry.get(turnActiveAtom)).toBe(true);
      expect(O.isNone(registry.get(draftAtoms(threadId)))).toBe(true);
      registry.dispose();
    })
  );
});
