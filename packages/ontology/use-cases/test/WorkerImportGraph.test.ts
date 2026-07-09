import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("@beep/ontology-use-cases worker import graph", () => {
  it.effect(
    "imports the visualizer worker entrypoint without DOM globals",
    Effect.fnUntraced(function* () {
      expect("document" in globalThis).toBe(false);
      expect("window" in globalThis).toBe(false);

      const worker = yield* Effect.promise(() => import("@beep/ontology-use-cases/aggregates/Session/worker"));

      expect(worker.WorkerCommand).toBeDefined();
      expect(worker.WorkerResult).toBeDefined();
      expect(worker.OntologySnapshot).toBeDefined();
      expect(worker.buildOntologyGraphProjection).toBeDefined();
      expect(worker.applyOntologyGraphProjectionDelta).toBeDefined();
    })
  );
});
