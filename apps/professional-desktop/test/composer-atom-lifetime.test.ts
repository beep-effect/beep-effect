import { draftAtoms } from "@beep/agents-client/Chat.atoms";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as Md from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/reactivity";
import * as Stream from "effect/Stream";
import { composerSerializedChangeHandlerAtoms } from "@/chat/ui/Composer.atoms";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

const threadId = WorkspaceIdentity.ThreadId.make(404);
const draft = Md.Document.make({
  children: [Md.P.make({ children: [Md.Text.make({ value: "mounted runtime action" })] })],
});

const waitForDraft = (registry: AtomRegistry.AtomRegistry): Effect.Effect<void, string> =>
  AtomRegistry.toStream(registry, draftAtoms(threadId)).pipe(
    Stream.filter(O.exists(Equal.equals(draft))),
    Stream.take(1),
    Stream.runDrain,
    Effect.timeoutOrElse({
      duration: Duration.seconds(3),
      orElse: () => Effect.fail("composer draft runtime action has not completed"),
    })
  );

describe("composer delegated runtime action lifetime", () => {
  it.live(
    "keeps the delegated draft action mounted while its runtime layer builds",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() =>
          AtomRegistry.make({
            defaultIdleTTL: 0,
            timeoutResolution: 1,
            initialValues: [[professionalBrowserRuntime.layer, Layer.effectDiscard(Effect.sleep(25))]],
          })
        ),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const handlerAtom = composerSerializedChangeHandlerAtoms(threadId)(draft);
      registry.mount(draftAtoms(threadId));
      registry.mount(handlerAtom);
      const serializedState = yield* documentToEditorState(draft);

      registry.get(handlerAtom)(serializedState);
      yield* waitForDraft(registry);

      expect(O.exists(registry.get(draftAtoms(threadId)), Equal.equals(draft))).toBe(true);
    })
  );
});
