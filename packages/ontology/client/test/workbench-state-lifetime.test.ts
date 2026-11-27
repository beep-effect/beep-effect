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
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

const TINY_IDLE_TTL_MS = 40;

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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: TINY_IDLE_TTL_MS })),
        (registry) => Effect.sync(() => registry.dispose())
      );

      const removable = Atom.make(0);
      const releaseRemovable = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(removable)),
        (release) => Effect.sync(release)
      );
      registry.set(removable, 1);
      expect(registry.get(removable)).toBe(1);
      releaseRemovable();

      const unmount = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologySessionAtom)),
        (release) => Effect.sync(release)
      );
      registry.set(ontologySessionAtom, O.some(openSession));
      registry.set(ontologyPathAtom, O.some(openPath));
      registry.set(ontologySourceAtom, "@prefix ex: <https://example.test/> .");
      registry.set(ontologyRedoStackAtom, []);
      registry.set(ontologySavedChangeLogSignatureAtom, "saved-signature");

      unmount();

      yield* Effect.sleep(Duration.millis(TINY_IDLE_TTL_MS * 5));

      expect(registry.get(removable), "the same registry evicts ordinary state during this wait").toBe(0);

      assertSome(registry.get(ontologySessionAtom), openSession);
      assertSome(registry.get(ontologyPathAtom), openPath);
      expect(registry.get(ontologySourceAtom), "coming back shows the same document, not an empty workbench").toBe(
        "@prefix ex: <https://example.test/> ."
      );
      expect(registry.get(ontologySavedChangeLogSignatureAtom)).toBe("saved-signature");
    })
  );
});
