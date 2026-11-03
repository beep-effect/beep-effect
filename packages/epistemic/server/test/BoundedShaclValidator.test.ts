import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import {
  BoundedShaclValidationServiceFromFactory,
  BoundedShaclViolationFactory,
  BoundedShaclViolationFactoryLive,
} from "@beep/epistemic-server/ShaclValidation";
import * as ClaimGateUC from "@beep/epistemic-use-cases/ClaimGate";
import * as ClaimLifecycleUC from "@beep/epistemic-use-cases/ClaimLifecycle";
import { ClaimGateResult } from "@beep/epistemics/ClaimGate";
import { Dataset, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// Counts violation constructions through the validator's factory seam, so the
// capped-request case can prove generation stops instead of truncating late.
const violationsMade = MutableRef.make(0);
const CountingViolationFactory = Layer.effect(BoundedShaclViolationFactory)(
  Effect.map(BoundedShaclViolationFactory, (live) =>
    BoundedShaclViolationFactory.of({
      makeViolation: (...args) => {
        MutableRef.increment(violationsMade);
        return live.makeViolation(...args);
      },
    })
  )
).pipe(Layer.provide(BoundedShaclViolationFactoryLive));
const CountingShaclValidation = BoundedShaclValidationServiceFromFactory.pipe(Layer.provide(CountingViolationFactory));

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
  // Boots only the bounded SHACL layer over a counting violation factory — no
  // other slice, no runtime.
  it.layer(CountingShaclValidation, { timeout: "10 seconds" })("claim gate over the bounded SHACL validator", (it) => {
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
        const decodedShaclValidationRequest = yield* decodeShaclValidationRequest({
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
        });
        const result = yield* service.validate(decodedShaclValidationRequest);

        pipe(result.conforms, assertFalse);
        pipe(result.truncated, assertTrue);
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
        MutableRef.set(violationsMade, 0);
        const limited = yield* service.validate(request);
        expect(limited.violations).toHaveLength(1);
        pipe(limited.truncated, assertTrue);
        expect(MutableRef.get(violationsMade)).toBe(1);
        MutableRef.set(violationsMade, 0);
        const unlimited = yield* service.validate(ShaclValidationRequest.make({ ...request, maxResults: O.none() }));
        expect(unlimited.violations).toHaveLength(3);
        pipe(unlimited.truncated, assertFalse);
        expect(MutableRef.get(violationsMade)).toBe(3);
      })
    );

    it.effect(
      "preserves actual conformance with a zero result limit",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const encodedDataset = yield* encodeDataset(dataset);
        const decodedShaclValidationRequest1 = yield* decodeShaclValidationRequest({
          dataset: encodedDataset,
          maxResults: 0,
          shapes: [{ properties: [{ minCount: 1, path: makeNamedNode("https://schema.org/name") }] }],
        });
        const conforming = yield* service.validate(decodedShaclValidationRequest1);
        pipe(conforming.conforms, assertTrue);
        pipe(conforming.truncated, assertFalse);
        expect(conforming.violations).toEqual([]);

        const decodedShaclValidationRequest2 = yield* decodeShaclValidationRequest({
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
        });
        const nonconforming = yield* service.validate(decodedShaclValidationRequest2);
        pipe(nonconforming.conforms, assertFalse);
        pipe(nonconforming.truncated, assertTrue);
        expect(nonconforming.violations).toEqual([]);
      })
    );

    it.effect(
      "filters non-target classes and reports a missing required value",
      Effect.fnUntraced(function* () {
        const service = yield* ShaclValidationService;
        const encodedDataset = yield* encodeDataset(dataset);
        const decodedShaclValidationRequest3 = yield* decodeShaclValidationRequest({
          dataset: encodedDataset,
          shapes: [
            {
              properties: [{ minCount: 1, path: makeNamedNode("https://schema.org/knows") }],
              targetClass: makeNamedNode("https://schema.org/Organization"),
            },
          ],
        });
        const nonTargetResult = yield* service.validate(decodedShaclValidationRequest3);
        const decodedShaclValidationRequest4 = yield* decodeShaclValidationRequest({
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
        });
        const requiredValueResult = yield* service.validate(decodedShaclValidationRequest4);

        pipe(nonTargetResult.conforms, assertTrue);
        expect(nonTargetResult.violations).toEqual([]);
        pipe(requiredValueResult.conforms, assertFalse);
        expect(requiredValueResult.violations[0]?.message).toContain("Expected value");
      })
    );
  });
});
