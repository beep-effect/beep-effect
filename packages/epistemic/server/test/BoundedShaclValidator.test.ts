import { CandidateClaim, ClaimGateResult, Evidence } from "@beep/epistemic-domain";
import { BoundedShaclValidationServiceLive } from "@beep/epistemic-server/ShaclValidation";
import * as ClaimGateUC from "@beep/epistemic-use-cases/ClaimGate";
import * as ClaimLifecycleUC from "@beep/epistemic-use-cases/ClaimLifecycle";
import { Dataset, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const candidate = S.decodeUnknownSync(CandidateClaim)({
  ...baseEntityFixtureInput("EpistemicCandidateClaim", 1),
  fixtureKey: "claim.patentability",
  lifecycle: "candidate",
  snapshot: {},
});

const evidence: Evidence = S.decodeUnknownSync(Evidence)({
  ...baseEntityFixtureInput("EpistemicEvidence", 10),
  artifactFixtureKey: "artifact.office-action",
  spanFixtureKey: "span.claim-1",
  span: { startChar: 0, endChar: 14, quote: "a claimed fact", confidence: 0.92 },
});

const dataset = makeDataset([
  makeQuad(
    makeNamedNode("https://example.com/people/alice"),
    makeNamedNode("https://schema.org/name"),
    makeLiteral("Alice", XSD_STRING.value)
  ),
  makeQuad(makeNamedNode("https://example.com/people/alice"), RDF_TYPE, makeNamedNode("https://schema.org/Person")),
]);

describe("@beep/epistemic-server bounded SHACL validator", () => {
  // Boots only the bounded SHACL layer — no other slice, no runtime.
  it.layer(BoundedShaclValidationServiceLive)("claim gate over the bounded SHACL validator", (it) => {
    it.effect(
      "admits a well-formed claim and advances candidate -> shape_valid",
      Effect.fnUntraced(function* () {
        const shacl = yield* ShaclValidationService;
        const gate = ClaimGateUC.makeClaimGate(shacl);

        const verdict = yield* gate.evaluate(candidate, [evidence]);
        expect(verdict.verdict).toBe("admitted");

        const advanced = yield* ClaimLifecycleUC.makeClaimTransition().advance(candidate, verdict);
        expect(advanced.lifecycle).toBe("shape_valid");
        expect(advanced.fixtureKey).toBe(candidate.fixtureKey);
      })
    );

    it.effect(
      "rejects a claim with no evidence span and does not advance",
      Effect.fnUntraced(function* () {
        const shacl = yield* ShaclValidationService;
        const gate = ClaimGateUC.makeClaimGate(shacl);

        const verdict = yield* gate.evaluate(candidate, []);
        expect(verdict.verdict).toBe("rejected");
        if (ClaimGateResult.guards.rejected(verdict)) {
          expect(verdict.violations.length).toBeGreaterThan(0);
          expect(verdict.violations[0].severity).toBe("violation");
        }

        const blocked = yield* ClaimLifecycleUC.makeClaimTransition().advance(candidate, verdict);
        expect(blocked.lifecycle).toBe("candidate");
      })
    );

    it.effect(
      "validates bounded SHACL-inspired shapes and truncates when max results is reached",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const result = yield* service.validate(
          yield* S.decodeEffect(ShaclValidationRequest)({
            dataset: yield* S.encodeEffect(Dataset)(dataset),
            maxResults: 1,
            shapes: [
              {
                properties: [
                  {
                    minCount: 1,
                    path: makeNamedNode("https://schema.org/knows"),
                  },
                  {
                    datatype: makeNamedNode(XSD_STRING.value),
                    path: makeNamedNode("https://schema.org/name"),
                  },
                ],
                targetClass: makeNamedNode("https://schema.org/Person"),
              },
            ],
          })
        );

        expect(result.conforms).toBe(false);
        expect(result.truncated).toBe(true);
        expect(result.violations).toHaveLength(1);
      })
    );
  });
});
