import { CandidateClaim, ClaimGateResult, Evidence } from "@beep/epistemic-domain";
import { BoundedShaclValidationServiceLive } from "@beep/epistemic-server/ShaclValidation";
import * as ClaimGateUC from "@beep/epistemic-use-cases/ClaimGate";
import * as ClaimLifecycleUC from "@beep/epistemic-use-cases/ClaimLifecycle";
import { Dataset, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { vi } from "vitest";

// Every schema's `make` is a lazily cached, non-configurable own property, so
// `vi.spyOn(ShaclValidationViolation, "make")` cannot install once any test has
// built a violation. Count constructions through the layer's own import instead:
// the wrapper inherits the schema and shadows only `make`.
const violationMake = vi.hoisted(() => vi.fn<(input: never) => unknown>());
vi.mock("@beep/semantic-web/services/shacl-validation", (importOriginal) =>
  importOriginal<typeof import("@beep/semantic-web/services/shacl-validation")>().then((original) => {
    violationMake.mockImplementation(original.ShaclValidationViolation.make);
    return {
      ...original,
      ShaclValidationViolation: Object.defineProperty(Object.create(original.ShaclValidationViolation), "make", {
        enumerable: true,
        value: violationMake,
      }),
    };
  })
);

const decodeShaclValidationRequest = S.decodeEffect(ShaclValidationRequest);
const encodeDataset = S.encodeEffect(Dataset);
const decodeCandidate = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);

const candidateInput = {
  ...productEntityFixtureInput("EpistemicCandidateClaim", 1),
  fixtureKey: "claim.patentability",
  lifecycle: "candidate",
  snapshot: {},
};

const evidenceInput = {
  ...productEntityFixtureInput("EpistemicEvidence", 10),
  artifactFixtureKey: "artifact.office-action",
  spanFixtureKey: "span.claim-1",
  span: { startChar: 0, endChar: 14, quote: "a claimed fact", confidence: 0.92 },
};

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
        const claim = yield* decodeCandidate(candidateInput);
        const proof = yield* decodeEvidence(evidenceInput);

        const verdict = yield* gate.evaluate(claim, [proof]);
        expect(verdict.verdict).toBe("admitted");

        const advanced = yield* ClaimLifecycleUC.makeClaimTransition().advance(claim, verdict);
        expect(advanced.lifecycle).toBe("shape_valid");
        expect(advanced.fixtureKey).toBe(claim.fixtureKey);
      })
    );

    it.effect(
      "rejects a claim with no evidence span and does not advance",
      Effect.fnUntraced(function* () {
        const shacl = yield* ShaclValidationService;
        const gate = ClaimGateUC.makeClaimGate(shacl);
        const claim = yield* decodeCandidate(candidateInput);

        const verdict = yield* gate.evaluate(claim, []);
        expect(verdict.verdict).toBe("rejected");
        if (ClaimGateResult.guards.rejected(verdict)) {
          expect(verdict.violations.length).toBeGreaterThan(0);
          expect(verdict.violations[0]?.severity).toBe("violation");
        }

        const blocked = yield* ClaimLifecycleUC.makeClaimTransition().advance(claim, verdict);
        expect(blocked.lifecycle).toBe("candidate");
      })
    );

    it.effect(
      "validates bounded SHACL-inspired shapes and truncates when max results is reached",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const result = yield* service.validate(
          yield* decodeShaclValidationRequest({
            dataset: yield* encodeDataset(dataset),
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

    it.effect(
      "stops generating violations before later properties and shapes when capped",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const request = yield* decodeShaclValidationRequest({
          dataset: yield* encodeDataset(dataset),
          maxResults: 1,
          shapes: [
            {
              properties: [
                { minCount: 1, path: makeNamedNode("https://schema.org/knows") },
                { minCount: 1, path: makeNamedNode("https://schema.org/email") },
              ],
            },
            { properties: [{ minCount: 1, path: makeNamedNode("https://schema.org/url") }] },
          ],
        });
        violationMake.mockClear();
        const limited = yield* service.validate(request);
        expect(limited.violations).toHaveLength(1);
        expect(limited.truncated).toBe(true);
        expect(violationMake).toHaveBeenCalledTimes(1);
        violationMake.mockClear();
        const unlimited = yield* service.validate(ShaclValidationRequest.make({ ...request, maxResults: O.none() }));
        expect(unlimited.violations).toHaveLength(3);
        expect(unlimited.truncated).toBe(false);
        expect(violationMake).toHaveBeenCalledTimes(3);
      })
    );

    it.effect(
      "preserves actual conformance with a zero result limit",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const encodedDataset = yield* encodeDataset(dataset);
        const conforming = yield* service.validate(
          yield* decodeShaclValidationRequest({
            dataset: encodedDataset,
            maxResults: 0,
            shapes: [{ properties: [{ minCount: 1, path: makeNamedNode("https://schema.org/name") }] }],
          })
        );
        expect(conforming.conforms).toBe(true);
        expect(conforming.truncated).toBe(false);
        expect(conforming.violations).toEqual([]);

        const nonconforming = yield* service.validate(
          yield* decodeShaclValidationRequest({
            dataset: encodedDataset,
            maxResults: 0,
            shapes: [
              {
                properties: [
                  { minCount: 1, path: makeNamedNode("https://schema.org/name") },
                  { minCount: 1, path: makeNamedNode("https://schema.org/knows") },
                ],
              },
            ],
          })
        );
        expect(nonconforming.conforms).toBe(false);
        expect(nonconforming.truncated).toBe(true);
        expect(nonconforming.violations).toEqual([]);
      })
    );

    it.effect(
      "filters non-target classes and reports a missing required value",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const encodedDataset = yield* encodeDataset(dataset);
        const nonTargetResult = yield* service.validate(
          yield* decodeShaclValidationRequest({
            dataset: encodedDataset,
            shapes: [
              {
                properties: [{ minCount: 1, path: makeNamedNode("https://schema.org/knows") }],
                targetClass: makeNamedNode("https://schema.org/Organization"),
              },
            ],
          })
        );
        const requiredValueResult = yield* service.validate(
          yield* decodeShaclValidationRequest({
            dataset: encodedDataset,
            shapes: [
              {
                properties: [
                  {
                    hasValue: {
                      datatype: makeNamedNode(XSD_STRING.value),
                      termType: "Literal",
                      value: "Bob",
                    },
                    minCount: 1,
                    path: makeNamedNode("https://schema.org/name"),
                  },
                ],
                targetClass: makeNamedNode("https://schema.org/Person"),
              },
            ],
          })
        );

        expect(nonTargetResult.conforms).toBe(true);
        expect(nonTargetResult.violations).toEqual([]);
        expect(requiredValueResult.conforms).toBe(false);
        expect(requiredValueResult.violations[0]?.message).toContain("Expected value");
      })
    );
  });
});
