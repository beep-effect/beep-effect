import { ArchitectureLabProofResult, runArchitectureLabProof } from "@beep/architecture-lab-proof";
import { ArchitectureLabServerLive } from "@beep/architecture-lab-server/layer";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeArchitectureLabProofResult = S.decodeEffect(ArchitectureLabProofResult);
const encodeArchitectureLabProofResult = S.encodeEffect(ArchitectureLabProofResult);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("architecture lab proof app", () => {
  it.effect("runs through the composed app layer", () =>
    Effect.gen(function* () {
      const result = yield* runArchitectureLabProof.pipe(provideScopedLayer(ArchitectureLabServerLive));
      expect(result.created.status).toBe("open");
      expect(result.summary.visibleActions).toContain("assign");
      expect(yield* encodeArchitectureLabProofResult(result)).toEqual({
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
  );

  it.effect("round-trips the proof result schema with schema-derived arbitraries", () =>
    Effect.gen(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.schema(ArchitectureLabProofResult),
        (value) =>
          Effect.gen(function* () {
            const encoded = yield* encodeArchitectureLabProofResult(value);
            const decoded = yield* decodeArchitectureLabProofResult(encoded);
            expect(Equal.equals(decoded, value)).toBe(true);

            return true;
          }),
        fcRuns(20)
      );
      expect(result._tag).toBe("Passed");
    })
  );
});
