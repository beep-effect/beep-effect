import { ArchitectureLabProofResult, runArchitectureLabProof } from "@beep/architecture-lab-proof";
import { ArchitectureLabServerLive } from "@beep/architecture-lab-server/layer";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("architecture lab proof app", () => {
  it.effect("runs through the composed app layer", () =>
    runArchitectureLabProof.pipe(
      provideScopedLayer(ArchitectureLabServerLive),
      Effect.map((result) => {
        expect(result.created.status).toBe("open");
        expect(result.summary.visibleActions).toContain("assign");
        expect(S.encodeSync(ArchitectureLabProofResult)(result)).toEqual({
          created: {
            id: "architecture-lab-proof-1",
            title: "Prove canonical slice topology",
            status: "open",
            priority: "normal",
          },
          summary: {
            id: "architecture-lab-proof-1",
            title: "Prove canonical slice topology",
            status: "open",
            statusLabel: "OPEN",
            visibleActions: ["assign", "complete", "archive"],
          },
        });
      })
    )
  );

  it("round-trips the proof result schema with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(S.toArbitrary(ArchitectureLabProofResult), (value) => {
        expect(
          Equal.equals(
            S.decodeUnknownSync(ArchitectureLabProofResult)(S.encodeSync(ArchitectureLabProofResult)(value)),
            value
          )
        ).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});
