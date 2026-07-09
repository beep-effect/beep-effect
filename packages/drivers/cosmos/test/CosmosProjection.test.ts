import {
  CosmosCapabilityProbe,
  generateSyntheticOntologyProjection,
  SyntheticOntologyGraphOptions,
  selectCosmosBackend,
} from "@beep/cosmos";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("cosmos driver projection and capability detection", () => {
  it.effect("selects cosmos only when WebGL2 is available", () =>
    Effect.sync(() => {
      expect(selectCosmosBackend(CosmosCapabilityProbe.make({ webGl2: true, reason: "ok" })).backend).toBe("cosmos");
      expect(selectCosmosBackend(CosmosCapabilityProbe.make({ webGl2: false, reason: "missing" })).backend).toBe(
        "sigma"
      );
    })
  );

  it.effect("generates deterministic typed-array graph projections", () =>
    Effect.sync(() => {
      const first = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 100, edgeCount: 250, seed: 42 })
      );
      const second = generateSyntheticOntologyProjection(
        SyntheticOntologyGraphOptions.make({ nodeCount: 100, edgeCount: 250, seed: 42 })
      );

      expect(first.nodeIds).toBeInstanceOf(Uint32Array);
      expect(first.pointPositions).toBeInstanceOf(Float32Array);
      expect(first.links).toBeInstanceOf(Float32Array);
      expect(first.nodeIds).toHaveLength(100);
      expect(first.pointPositions).toHaveLength(200);
      expect(first.links).toHaveLength(500);
      expect(first.links[0]).toBe(second.links[0]);
      expect(first.links[1]).toBe(second.links[1]);
    })
  );
});
