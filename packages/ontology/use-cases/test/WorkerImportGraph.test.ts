import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";

describe("@beep/ontology-use-cases worker import graph", () => {
  it.effect(
    "imports the visualizer worker entrypoint without DOM globals",
    Effect.fnUntraced(function* () {
      pipe("document" in globalThis, assertFalse);
      pipe("window" in globalThis, assertFalse);

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
      pipe("document" in globalThis, assertFalse);
      pipe("window" in globalThis, assertFalse);

      const tools = yield* Effect.promise(() => import("@beep/ontology-use-cases/tools"));

      expect(tools.OntologyToolkit).toBeDefined();
      expect(tools.OntologyToolService).toBeDefined();
      expect(Object.keys(tools.OntologyToolkit.tools)).toHaveLength(9);
    })
  );
});
