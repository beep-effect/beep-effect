import {
  ChatClient,
  draftAtoms,
  draftRevisionAtoms,
  runTurnAtom,
  SendTurnRequest,
  streamingTurnAtom,
  turnErrorAtom,
} from "@beep/agents-client/Chat.atoms";
import { decodeSafeDocumentUnsafe } from "@beep/md";
import { Document, P, Text } from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline } from "@beep/workspace-use-cases/aggregates/Thread";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Stream } from "effect";
import * as O from "effect/Option";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";

const threadId = WorkspaceIdentity.ThreadId.make(1);
const content = decodeSafeDocumentUnsafe(
  Document.make({ children: [P.make({ children: [Text.make({ value: "Keep this prompt" })] })] })
);
const emptyTimeline = ThreadTimeline.make({ threadId, turns: [] });

const registryWithClient = (client: ChatClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [[ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, client), Reactivity.layer)]],
  });

describe("assistant turn defects", { concurrent: false }, () => {
  it.effect(
    "clears the died turn and restores the prompt only when its receipt is provably not persisted",
    Effect.fnUntraced(function* () {
      const verifyDefectedTurn = Effect.fn("verifyDefectedTurn")(function* (status: "persisted" | "not_persisted") {
        let statusReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") return Effect.succeed(emptyTimeline);
          if (tag === "GetTurnRequestStatus") {
            return Effect.sync(() => {
              statusReads += 1;
              return status;
            });
          }
          if (tag === "SendMessage") return Stream.die("stream transport crashed");
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = registryWithClient(client);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountDraftRevision = registry.mount(draftRevisionAtom);
        const unmountStreaming = registry.mount(streamingTurnAtom);
        const unmountError = registry.mount(turnErrorAtom);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(draftRevisionAtom)).toBe(0);

        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        const exit = yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);

        // the defect must surface as a failed run, not a silent success
        expect(Exit.isFailure(exit)).toBe(true);
        // an exact terminal receipt ends the bounded poll on its first attempt
        expect(statusReads).toBe(1);
        expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
        expect(O.map(registry.get(turnErrorAtom), (error) => error.message)).toStrictEqual(
          O.some("The reply failed unexpectedly before completing.")
        );
        expect(registry.get(draftAtom)).toStrictEqual(status === "not_persisted" ? O.some(content) : O.none());
        expect(registry.get(draftRevisionAtom)).toBe(status === "not_persisted" ? 1 : 0);

        unmountError();
        unmountStreaming();
        unmountDraftRevision();
        unmountDraft();
        unmountTurn();
        registry.dispose();
      });

      // the not_persisted case writes the restored draft into localStorage, so
      // the durable case must run first to see an empty draft baseline
      yield* verifyDefectedTurn("persisted");
      yield* verifyDefectedTurn("not_persisted");
    })
  );
});
