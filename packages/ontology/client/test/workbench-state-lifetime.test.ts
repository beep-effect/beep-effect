import {
  ontologyPathAtom,
  ontologyRedoStackAtom,
  ontologySavedChangeLogSignatureAtom,
  ontologySessionAtom,
  ontologySourceAtom,
} from "@beep/ontology-client/aggregates/Session";
import { createSession, CreateSessionInput, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AtomRegistry } from "effect/unstable/reactivity";

// The desktop registry disposes any atom with no listeners and no dependents once
// its idle TTL elapses. A tiny TTL reproduces in milliseconds what took the real
// app thirty seconds.
const IDLE_TTL_MS = 40;

const openSession = createSession(
  CreateSessionInput.make({
    id: S.decodeUnknownSync(SessionId)("session-1"),
    baseDataset: makeDataset([]),
  })
);

const openPath = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl");

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
      const registry = AtomRegistry.make({ defaultIdleTTL: IDLE_TTL_MS });

      // The workbench is on screen: something subscribes.
      const unmount = registry.mount(ontologySessionAtom);
      registry.set(ontologySessionAtom, O.some(openSession));
      registry.set(ontologyPathAtom, O.some(openPath));
      registry.set(ontologySourceAtom, "@prefix ex: <https://example.test/> .");
      registry.set(ontologyRedoStackAtom, []);
      registry.set(ontologySavedChangeLogSignatureAtom, "saved-signature");

      // The user switches to Chat: the workbench unmounts and every subscriber goes.
      unmount();

      // ...and stays away longer than the registry's idle TTL.
      yield* Effect.sleep(Duration.millis(IDLE_TTL_MS * 5));

      // Coming back must show the same document, not an empty workbench.
      expect(registry.get(ontologySessionAtom)).toStrictEqual(O.some(openSession));
      expect(registry.get(ontologyPathAtom)).toStrictEqual(O.some(openPath));
      expect(registry.get(ontologySourceAtom)).toBe("@prefix ex: <https://example.test/> .");
      expect(registry.get(ontologySavedChangeLogSignatureAtom)).toBe("saved-signature");
    })
  );
});
