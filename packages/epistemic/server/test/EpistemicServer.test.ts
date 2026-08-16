import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { EpistemicServerLive } from "@beep/epistemic-server/layer";
import { ClaimGate } from "@beep/epistemic-use-cases/ClaimGate";
import { ClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const candidate = S.decodeUnknownSync(CandidateClaim)({
  ...productEntityFixtureInput("EpistemicCandidateClaim", 1),
  fixtureKey: "claim.patentability",
  lifecycle: "candidate",
  snapshot: {},
});

const evidence = S.decodeUnknownSync(Evidence)({
  ...productEntityFixtureInput("EpistemicEvidence", 2),
  artifactFixtureKey: "artifact.office-action",
  spanFixtureKey: "span.claim-1",
  span: { startChar: 0, endChar: 14, quote: "a claimed fact", confidence: 0.9 },
});

describe("@beep/epistemic-server", () => {
  // Boots only the composed epistemic server layer (gate + transition over SHACL).
  it.layer(EpistemicServerLive)("EpistemicServerLive", (it) => {
    it.effect(
      "boots and admits + advances a claim end-to-end",
      Effect.fnUntraced(function* () {
        const gate = yield* ClaimGate;
        const transition = yield* ClaimTransition;

        const verdict = yield* gate.evaluate(candidate, [evidence]);
        const advanced = yield* transition.advance(candidate, verdict);

        expect(verdict.verdict).toBe("admitted");
        expect(advanced.lifecycle).toBe("shape_valid");
      })
    );
  });
});
