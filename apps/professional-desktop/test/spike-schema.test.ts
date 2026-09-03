import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { CosmosSpikeProbeContract, CosmosSpikeSize, CosmosSpikeStatus } from "@/spikes/CosmosSpike";
import { SyntheticProjectionCount, SyntheticProjectionNodeCount } from "@/spikes/CosmosSpike.rpc";
import { Graph3DSpikeStatus } from "@/spikes/Graph3DSpike";

const isSyntheticProjectionCount = S.is(SyntheticProjectionCount);
const isSyntheticProjectionNodeCount = S.is(SyntheticProjectionNodeCount);
const decodeCosmosSpikeProbeContract = S.decodeUnknownEffect(CosmosSpikeProbeContract);
const decodeCosmosSpikeSize = S.decodeUnknownEffect(CosmosSpikeSize);

describe("spike state schemas", () => {
  it("provides exhaustive constructors, guards, and matching for both renderer state machines", () => {
    const graphFailure = Graph3DSpikeStatus.cases.failed.make({ message: "graph failed" });
    expect(Graph3DSpikeStatus.guards.failed(graphFailure)).toBe(true);
    expect(
      Graph3DSpikeStatus.match(graphFailure, {
        rendering: () => "rendering",
        ready: () => "ready",
        failed: ({ message }) => message,
      })
    ).toBe("graph failed");

    const cosmosRendering = CosmosSpikeStatus.cases.rendering.make();
    expect(CosmosSpikeStatus.guards.rendering(cosmosRendering)).toBe(true);
    expect(
      CosmosSpikeStatus.match(cosmosRendering, {
        rendering: () => "rendering",
        ready: () => "ready",
        failed: () => "failed",
      })
    ).toBe("rendering");
  });

  it.effect(
    "rejects negative, fractional, and zero-required Cosmos counts at the schema boundary",
    Effect.fnUntraced(function* () {
      const valid = yield* decodeCosmosSpikeSize({
        edgeCount: 0,
        elementCount: 1,
        label: "1k",
        nodeCount: 1,
      });
      expect(valid.edgeCount).toBe(0);

      const invalidSizes = [
        { edgeCount: -1, elementCount: 1, label: "1k", nodeCount: 1 },
        { edgeCount: 0.5, elementCount: 1, label: "1k", nodeCount: 1 },
        { edgeCount: 0, elementCount: 0, label: "1k", nodeCount: 1 },
        { edgeCount: 0, elementCount: 1, label: "1k", nodeCount: 0 },
      ];
      const invalidSizeExits = yield* Effect.forEach(invalidSizes, (input) =>
        Effect.exit(decodeCosmosSpikeSize(input))
      );
      expect(A.every(invalidSizeExits, Exit.isFailure)).toBe(true);

      const validProbe = {
        backend: "sigma",
        elementCount: 2,
        foldLevel: "L3",
        fps: () => 60,
        projectedEdgeCount: 1,
        projectedNodeCount: 1,
      };
      yield* decodeCosmosSpikeProbeContract(validProbe);
      const invalidProbe = yield* Effect.exit(decodeCosmosSpikeProbeContract({ ...validProbe, projectedNodeCount: 0 }));
      expect(Exit.isFailure(invalidProbe)).toBe(true);
    })
  );

  it("derives only valid Cosmos spike counts from the production schema", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(CosmosSpikeSize)(fc),
        (size) =>
          isSyntheticProjectionCount(size.edgeCount) &&
          isSyntheticProjectionNodeCount(size.elementCount) &&
          isSyntheticProjectionNodeCount(size.nodeCount)
      ),
      fcRuns(25)
    );
  });
});
