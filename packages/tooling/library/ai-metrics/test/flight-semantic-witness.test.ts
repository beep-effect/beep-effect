import {
  FlightSemanticWitness,
  FlightSemanticWitnessInput,
  makeFlightSemanticWitness,
  writeFlightSemanticWitness,
} from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

const invocationId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const objectiveRef = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const witness = makeFlightSemanticWitness(
  FlightSemanticWitnessInput.make({
    invocationId,
    objectiveRef,
    sourceKind: "codex",
    lifecycleState: "terminal",
    activePhase: "verification",
    selfReportedTerminalOutcome: "completed",
  })
);

layer(NodeServices.layer)("flight semantic witness", (it) => {
  it("keeps mechanical and user-facing content outside the persistent witness", () => {
    expect(witness.invocationId).toBe(invocationId);
    expect(witness.semantic.objective.status).toBe("known");
    expect(witness.semantic.semanticTurns).toHaveLength(1);
    expect(witness.semantic.evidenceTier).toBe("derived");
    expect("startedAt" in witness.semantic).toBe(false);
    expect("toolCallCount" in witness.semantic).toBe(false);
    expect("message" in witness).toBe(false);
  });

  it.effect("atomically and idempotently persists only the content-free witness", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const stateRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-flight-semantic-witness-" });
        const evidenceRoot = path.join(stateRoot, "agent-evidence");

        const first = yield* writeFlightSemanticWitness(evidenceRoot, witness);
        const second = yield* writeFlightSemanticWitness(evidenceRoot, witness);
        const persistedText = yield* fs.readFileString(path.join(evidenceRoot, first.relativePath));
        const persisted = yield* FlightSemanticWitness.decodeJsonEffect(persistedText);

        expect(second).toEqual(first);
        expect(persisted).toEqual(witness);
        expect(persistedText).not.toContain("task prompt");
        expect(persistedText).not.toContain("user-facing response");
      })
    )
  );

  it.effect("refuses a relative evidence root", () =>
    Effect.gen(function* () {
      const error = yield* writeFlightSemanticWitness("relative/agent-evidence", witness).pipe(Effect.flip);

      expect(error._tag).toBe("FlightSemanticWitnessStoreError");
      expect(error.operation).toBe("prepare-root");
    })
  );
});
