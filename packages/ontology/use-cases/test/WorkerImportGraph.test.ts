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

  it.effect(
    "imports the ontology toolkit entrypoint without DOM globals",
    Effect.fnUntraced(function* () {
      expect("document" in globalThis).toBe(false);
      expect("window" in globalThis).toBe(false);

      const tools = yield* Effect.promise(() => import("@beep/ontology-use-cases/tools"));

      expect(tools.OntologyToolkit).toBeDefined();
      expect(tools.OntologyToolService).toBeDefined();
      expect(Object.keys(tools.OntologyToolkit.tools)).toHaveLength(9);
    })
  );
});
