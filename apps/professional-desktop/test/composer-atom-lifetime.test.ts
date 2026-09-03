import { draftAtoms } from "@beep/agents-client/Chat.atoms";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as Md from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect } from "vitest";
import { composerSerializedChangeHandlerAtoms } from "@/chat/ui/Composer.atoms";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

const threadId = WorkspaceIdentity.ThreadId.make(404);
const draft = Md.Document.make({
  children: [Md.P.make({ children: [Md.Text.make({ value: "mounted runtime action" })] })],
});

const waitForDraft = (registry: AtomRegistry.AtomRegistry): Effect.Effect<void, string> =>
  Effect.suspend(() =>
    O.exists(registry.get(draftAtoms(threadId)), Equal.equals(draft))
      ? Effect.void
      : Effect.fail("composer draft runtime action has not completed")
  ).pipe(
    Effect.retry(
      Schedule.spaced(Duration.millis(10)).pipe(Schedule.upTo({ duration: Duration.seconds(3), times: 300 }))
    )
  );

describe("composer delegated runtime action lifetime", () => {
  it.live(
    "keeps the delegated draft action mounted while its runtime layer builds",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make({
        defaultIdleTTL: 0,
        timeoutResolution: 1,
        initialValues: [[professionalBrowserRuntime.layer, Layer.effectDiscard(Effect.sleep(25))]],
      });
      const handlerAtom = composerSerializedChangeHandlerAtoms(threadId)(draft);
      registry.mount(draftAtoms(threadId));
      registry.mount(handlerAtom);
      const serializedState = yield* documentToEditorState(draft);

      registry.get(handlerAtom)(serializedState);
      yield* waitForDraft(registry);

      expect(O.exists(registry.get(draftAtoms(threadId)), Equal.equals(draft))).toBe(true);
      registry.dispose();
    })
  );
});
