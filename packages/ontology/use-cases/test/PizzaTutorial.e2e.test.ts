import {
  applyChangeOperationsWithDelta,
  CreateSessionInput,
  createSession,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  pizzaTutorialChangeOperations,
  searchOntologyResources,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";

const sessionId = S.decodeSync(SessionId)("pizza-tutorial-session");

describe("Pizza tutorial authoring flow", () => {
  it.effect(
    "generates typed change operations and projects explorer/search state",
    Effect.fnUntraced(function* () {
      const operations = pizzaTutorialChangeOperations();
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([]),
        })
      );
      const applied = applyChangeOperationsWithDelta(session, operations);
      const snapshot = buildOntologySnapshot(applied.session);
      const tboxMatches = searchOntologyResources(snapshot, { mode: "tbox", query: "Pizza" });
      const aboxMatches = searchOntologyResources(snapshot, { mode: "abox", query: "Margherita" });

      expect(applied.delta.added).toHaveLength(operations.length);
      expect(snapshot.metrics.tboxCount).toBeGreaterThan(0);
      expect(snapshot.metrics.aboxCount).toBeGreaterThan(0);
      expect(
        pipe(
          tboxMatches,
          A.some((resource) => resource.label === "Pizza")
        )
      ).toBe(true);
      expect(
        pipe(
          aboxMatches,
          A.some((resource) => resource.label === "Margherita")
        )
      ).toBe(true);
      yield* Effect.void;
    })
  );
});
