import {
  ontologyPathAtom,
  ontologyRedoStackAtom,
  ontologySavedChangeLogSignatureAtom,
  ontologySessionAtom,
  ontologySourceAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { Atom, AtomRegistry } from "effect/reactivity";

// The desktop registry disposes any atom with no listeners and no dependents once
// its idle TTL elapses. A tiny TTL reproduces in milliseconds what took the real
// app thirty seconds.
const IDLE_TTL_MS = 40;

const openSession = createSession(
  CreateSessionInput.make({
    id: SessionId.make("session-1"),
    baseDataset: makeDataset([]),
  })
);

const openPath = OntologyFilePath.make("fixtures/demo.ttl");

describe("ontology workbench state lifetime", () => {
  it.live(
    "keeps the open document when the workbench is unmounted for longer than the idle TTL",
    Effect.fnUntraced(function* () {
      // Every subscriber of these atoms lives inside OntologyWorkbench, and the app
      // unmounts it whenever the user switches surface. That dropped them to zero
      // listeners, and the sweep reset them to their defaults: the open document,
      // every unsaved change in its change log, the dirty-tracking signature and the
      // redo stack were destroyed in silence, and the workbench came back claiming
      // no file was open. Nothing warned the user; nothing could be undone.
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS })),
        (registry) => Effect.sync(() => registry.dispose())
      );

      // Prove the same registry actually evicts ordinary state during this wait.
      const removable = Atom.make(0);
      const releaseRemovable = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(removable)),
        (release) => Effect.sync(release)
      );
      registry.set(removable, 1);
      expect(registry.get(removable)).toBe(1);
      releaseRemovable();

      // The workbench is on screen: something subscribes.
      const unmount = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologySessionAtom)),
        (release) => Effect.sync(release)
      );
      registry.set(ontologySessionAtom, O.some(openSession));
      registry.set(ontologyPathAtom, O.some(openPath));
      registry.set(ontologySourceAtom, "@prefix ex: <https://example.test/> .");
      registry.set(ontologyRedoStackAtom, []);
      registry.set(ontologySavedChangeLogSignatureAtom, "saved-signature");

      // The user switches to Chat: the workbench unmounts and every subscriber goes.
      unmount();

      // ...and stays away longer than the registry's idle TTL.
      yield* Effect.sleep(Duration.millis(IDLE_TTL_MS * 5));

      expect(registry.get(removable)).toBe(0);

      // Coming back must show the same document, not an empty workbench.
      assertSome(registry.get(ontologySessionAtom), openSession);
      assertSome(registry.get(ontologyPathAtom), openPath);
      expect(registry.get(ontologySourceAtom)).toBe("@prefix ex: <https://example.test/> .");
      expect(registry.get(ontologySavedChangeLogSignatureAtom)).toBe("saved-signature");
    })
  );
});
