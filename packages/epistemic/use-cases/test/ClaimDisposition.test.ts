import { ClaimDispositionStatus } from "@beep/epistemic-domain";
import {
  ClaimDispositionRepository,
  ClaimGateOutcomeInput,
  makeClaimGateOutcomeResolver,
} from "@beep/epistemic-use-cases/ClaimDisposition";
import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ClaimDisposition } from "@beep/epistemic-domain";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const inMemoryClaimDispositions: Layer.Layer<ClaimDispositionRepository> = Layer.unwrap(
  Effect.map(Ref.make<ReadonlyArray<ClaimDisposition>>([]), (ref) =>
    Layer.succeed(
      ClaimDispositionRepository,
      ClaimDispositionRepository.of({
        listByClaim: Effect.fnUntraced(function* (claimId: Epistemic.CandidateClaimId) {
          const recorded = yield* Ref.get(ref);
          return A.filter(recorded, (disposition) => disposition.claimId === claimId);
        }),
        record: Effect.fnUntraced(function* (disposition: ClaimDisposition) {
          yield* Ref.update(ref, A.append(disposition));
          return disposition;
        }),
      })
    )
  )
);

const claimInput = (id: number, fixtureKey: string) => ({
  ...baseEntityFixtureInput("EpistemicCandidateClaim", id),
  fixtureKey,
  lifecycle: "candidate",
  snapshot: {},
});

const violation = {
  focusNode: "https://beep.dev/epistemic/claim/patentability",
  message: "Expected at least 1 value(s) for evidence.",
  path: "https://beep.dev/epistemic/hasEvidenceQuote",
  severity: "violation",
};

const decodeOutcomeInput = S.decodeUnknownSync(ClaimGateOutcomeInput);

const rejectedInput = decodeOutcomeInput({
  claim: claimInput(1, "claim.patentability"),
  dispositionId: 1,
  dispositionPublicId: "epistemic_claim_disposition_a1",
  gateResult: { verdict: "rejected", violations: [violation] },
  resolvedBy: { kind: "System", component: "Runtime" },
  schemaVersion: "0.0.0",
  source: "Agent",
});

const admittedInput = decodeOutcomeInput({
  claim: claimInput(2, "claim.novelty"),
  dispositionId: 2,
  dispositionPublicId: "epistemic_claim_disposition_a2",
  gateResult: { verdict: "admitted" },
  resolvedBy: { kind: "System", component: "Runtime" },
  schemaVersion: "0.0.0",
  source: "Agent",
});

describe("@beep/epistemic-use-cases claim disposition", () => {
  // The stub repository is the only dependency the resolver does not build itself.
  it.layer(inMemoryClaimDispositions)("resolving a claim gate verdict", (it) => {
    it.effect(
      "records a durable rejection carrying the violations and returns the claim unchanged",
      Effect.fnUntraced(function* () {
        const dispositions = yield* ClaimDispositionRepository;
        const resolver = makeClaimGateOutcomeResolver(dispositions, makeClaimTransition());

        const outcome = yield* resolver.resolve(rejectedInput);

        // The shared lifecycle transition is untouched: a rejected claim stays a candidate.
        expect(outcome.claim.lifecycle).toBe("candidate");
        expect(outcome.claim.fixtureKey).toBe(rejectedInput.claim.fixtureKey);

        expect(O.isSome(outcome.disposition)).toBe(true);

        const persisted = yield* dispositions.listByClaim(rejectedInput.claim.id);
        expect(persisted.length).toBe(1);
        expect(persisted[0].status).toBe(ClaimDispositionStatus.Enum.rejected);
        expect(persisted[0].reason).toBe(violation.message);
        expect(persisted[0].violations.length).toBe(1);
        expect(persisted[0].violations[0].path).toBe(violation.path);
        expect(persisted[0].resolvedBy).toStrictEqual(rejectedInput.resolvedBy);
      })
    );

    it.effect(
      "advances an admitted claim to shape_valid and persists nothing",
      Effect.fnUntraced(function* () {
        const dispositions = yield* ClaimDispositionRepository;
        const resolver = makeClaimGateOutcomeResolver(dispositions, makeClaimTransition());

        const outcome = yield* resolver.resolve(admittedInput);

        expect(outcome.claim.lifecycle).toBe("shape_valid");
        expect(O.isNone(outcome.disposition)).toBe(true);

        const persisted = yield* dispositions.listByClaim(admittedInput.claim.id);
        expect(persisted.length).toBe(0);
      })
    );
  });
});
