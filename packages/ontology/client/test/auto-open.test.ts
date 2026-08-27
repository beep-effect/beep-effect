import {
  OntologyClient,
  ontologyDocumentErrorAtom,
  ontologyPathAtom,
  ontologySessionAtom,
  ontologySessionIdForPath,
  ontologyWorkbenchAutoOpenAtom,
  ontologyWorkbenchSeedPath,
  openOntologyDocumentAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  OntologyActionError,
  OntologyFilePath,
  OpenOntologyDocumentResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import type { OpenOntologyDocumentInput } from "@beep/ontology-client/aggregates/Session";

const materialsPath = S.decodeSync(OntologyFilePath)("tmp/ontology-workbench/materials.ttl");

const seedSession = createSession(
  CreateSessionInput.make({
    id: ontologySessionIdForPath(ontologyWorkbenchSeedPath),
    baseDataset: makeDataset([]),
  })
);

const registryWithClient = (client: OntologyClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
    ],
  });

const countingOpenClient = (counter: { invocations: number }) =>
  OntologyClient.of(((tag: string, payload: unknown) => {
    if (tag === "OpenOntologyDocument") {
      counter.invocations += 1;
      const input = payload as OpenOntologyDocumentInput;
      expect(input.path).toBe(ontologyWorkbenchSeedPath);
      expect(input.sessionId).toBe(ontologySessionIdForPath(ontologyWorkbenchSeedPath));
      return Effect.succeed(
        OpenOntologyDocumentResult.make({
          session: seedSession,
          path: input.path,
          source: "",
          snapshot: buildOntologySnapshot(seedSession),
        })
      );
    }

    return Effect.die(`unexpected ontology RPC: ${tag}`);
  }) as unknown as OntologyClient["Service"]);

describe("ontologyWorkbenchAutoOpenAtom", () => {
  it.effect(
    "opens the seeded tutorial when the app session starts with no document",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = registryWithClient(countingOpenClient(counter));

      registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);

      expect(counter.invocations).toBe(1);
      expect(O.getOrNull(registry.get(ontologyPathAtom))).toBe(ontologyWorkbenchSeedPath);
      expect(O.isSome(registry.get(ontologySessionAtom))).toBe(true);
      expect(O.isNone(registry.get(ontologyDocumentErrorAtom))).toBe(true);
      registry.dispose();
    })
  );

  it.effect(
    "leaves an already-open document alone",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = registryWithClient(countingOpenClient(counter));
      const openSession = createSession(
        CreateSessionInput.make({
          id: ontologySessionIdForPath(materialsPath),
          baseDataset: makeDataset([]),
        })
      );
      registry.set(ontologySessionAtom, O.some(openSession));
      registry.set(ontologyPathAtom, O.some(materialsPath));

      registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);

      expect(counter.invocations).toBe(0);
      expect(AsyncResult.isInitial(registry.get(openOntologyDocumentAtom))).toBe(true);
      expect(O.getOrNull(registry.get(ontologyPathAtom))).toBe(materialsPath);
      registry.dispose();
      yield* Effect.void;
    })
  );

  it.effect(
    "attempts once per app session and never re-opens after the document goes away",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = registryWithClient(countingOpenClient(counter));

      const unmount = registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);
      expect(counter.invocations).toBe(1);

      // The user putting the workbench back to "nothing open" must stick:
      // a panel remount may not open the tutorial again behind their back.
      unmount();
      registry.set(ontologySessionAtom, O.none());
      registry.set(ontologyPathAtom, O.none());
      registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);

      expect(counter.invocations).toBe(1);
      expect(O.isNone(registry.get(ontologySessionAtom))).toBe(true);
      expect(O.isNone(registry.get(ontologyPathAtom))).toBe(true);
      registry.dispose();
    })
  );

  it.effect(
    "keeps a failed first-run open quiet and does not retry",
    Effect.fnUntraced(function* () {
      let invocations = 0;
      const client = OntologyClient.of(((tag: string) => {
        if (tag === "OpenOntologyDocument") {
          invocations += 1;
          return Effect.fail(OntologyActionError.new("The tutorial document could not be opened."));
        }

        return Effect.die(`unexpected ontology RPC: ${tag}`);
      }) as unknown as OntologyClient["Service"]);
      const registry = registryWithClient(client);

      const unmount = registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      // The open action absorbs its own failure, so its result still settles.
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);

      expect(invocations).toBe(1);
      expect(O.isNone(registry.get(ontologySessionAtom))).toBe(true);
      expect(O.isNone(registry.get(ontologyPathAtom))).toBe(true);
      expect(O.getOrNull(registry.get(ontologyDocumentErrorAtom))).toBe("The tutorial document could not be opened.");

      unmount();
      registry.mount(ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      expect(invocations).toBe(1);
      registry.dispose();
    })
  );
});
