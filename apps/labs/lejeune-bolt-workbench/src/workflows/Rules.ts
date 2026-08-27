/**
 * The complete three-rule advisory slice for the fixed LeJeune demo story.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GroundedExtraction } from "@beep/langextract/Extraction";
import { locateGroundedExtractions } from "@beep/langextract/VerifiedSpan";
import { PosixPath } from "@beep/schema";
import { HttpsUrl } from "@beep/schema/URL";
import { Effect, identity, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { RuleResult, RuleSource } from "@/domain/Bundle";
import { EntityId } from "@/domain/Ontology";
import { FixtureError } from "@/fixtures/Sources";
import type { NormalizedFixture } from "@/domain/Bundle";
import type { Component } from "@/domain/Ontology";

const MATCHED_ASSEMBLY_EVIDENCE =
  "Galvanized bolts and tension-control bolts are manufactured matched bolt-and-nut assembly cases.";
const DTI_STRENGTH_EVIDENCE = "ASTM F959 DTIs are designated Type 325 or Type 490 to match bolt strength.";
const A490_HDG_EVIDENCE = "A490 bolts must not be hot-dip galvanized or electroplated.";
const A490_STANDARD_ID = EntityId.make("astm-a490-type-1");
const MATCHED_ASSEMBLY_STANDARD_ID = EntityId.make("astm-f1852-type-1");
const MATCHED_ASSEMBLY_NUT_STANDARD_ID = EntityId.make("astm-a563-dh");
const MATCHED_ASSEMBLY_WASHER_STANDARD_ID = EntityId.make("astm-f436-type-1");
const MATCHED_ASSEMBLY_FINISH_ID = EntityId.make("mechanical-galvanized-b695-class-55");
const RULE_RESEARCH_PATH = PosixPath.make(
  "explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md"
);

interface RuleSourceInput {
  readonly evidence: string;
  readonly id: string;
  readonly revision: string;
  readonly title: string;
  readonly url: string;
}

const makeRuleSource = Effect.fnUntraced(function* (input: RuleSourceInput) {
  const candidate = GroundedExtraction.cases.unaligned.make({ label: "rule-evidence", text: input.evidence });
  const anchors = yield* locateGroundedExtractions([candidate], input.evidence);
  const evidenceAnchor = yield* O.match(A.head(anchors), {
    onNone: () =>
      FixtureError.make({ stage: "rule-source", message: `No exact evidence anchor was produced for ${input.id}.` }),
    onSome: Effect.succeed,
  });
  return RuleSource.make({
    accessedOn: "2026-08-25",
    evidence: input.evidence,
    evidenceAnchor,
    id: EntityId.make(input.id),
    researchPath: RULE_RESEARCH_PATH,
    revision: input.revision,
    title: input.title,
    url: HttpsUrl.make(input.url),
  });
});

const componentByKind = (fixture: NormalizedFixture, kind: "bolt" | "nut" | "washer") =>
  A.findFirst(fixture.components, (component) => Str.Equivalence(component.kind, kind));

const componentMatchesAssemblyContract = (
  component: O.Option<Component>,
  standardId: EntityId,
  strengthClass: "325" | "325-compatible"
): boolean =>
  O.exists(component, (candidate) =>
    A.every(
      [Str.Equivalence(candidate.standardId, standardId), Str.Equivalence(candidate.strengthClass, strengthClass)],
      identity
    )
  );

const hasMatchedAssemblySourceFact = (fixture: NormalizedFixture): boolean =>
  A.some(fixture.extractedFields, (field) =>
    A.every(
      [
        Str.Equivalence(field.name, "product"),
        Str.Equivalence(field.sourceDocumentId, "rfq-a-xlsx-takeoff"),
        Str.Equivalence(field.value, "TC assembly"),
      ],
      identity
    )
  );

const hasCompatibleMatchedAssembly = (fixture: NormalizedFixture): boolean =>
  A.every(
    [
      hasMatchedAssemblySourceFact(fixture),
      Str.Equivalence(fixture.productVariant.standardId, MATCHED_ASSEMBLY_STANDARD_ID),
      Str.Equivalence(fixture.productVariant.finishId, MATCHED_ASSEMBLY_FINISH_ID),
      componentMatchesAssemblyContract(componentByKind(fixture, "bolt"), MATCHED_ASSEMBLY_STANDARD_ID, "325"),
      componentMatchesAssemblyContract(
        componentByKind(fixture, "nut"),
        MATCHED_ASSEMBLY_NUT_STANDARD_ID,
        "325-compatible"
      ),
      componentMatchesAssemblyContract(
        componentByKind(fixture, "washer"),
        MATCHED_ASSEMBLY_WASHER_STANDARD_ID,
        "325-compatible"
      ),
    ],
    identity
  );

const matchedAssemblyResult = (fixture: NormalizedFixture, source: RuleSource): RuleResult => {
  const complete = hasCompatibleMatchedAssembly(fixture);
  return pipe(
    complete,
    Bool.match({
      onFalse: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-matched-assembly-mismatch`),
          disposition: "mismatch",
          matchedFacts: [
            fixture.productVariant.label,
            "Exact TC-assembly provenance or the compatible bolt, nut, and washer contract is incomplete.",
          ],
          requiresHuman: true,
          ruleId: "matched-assembly",
          source,
          stopReason: "Stop for an RFI; do not complete a matched assembly from inferred components.",
        }),
      onTrue: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-matched-assembly-positive`),
          disposition: "pass",
          matchedFacts: [
            fixture.productVariant.label,
            "Exact TC-assembly provenance and the canonical 325-compatible bolt, nut, and washer are present.",
          ],
          requiresHuman: false,
          ruleId: "matched-assembly",
          source,
          stopReason: "No stop: the fixed matched-assembly fact pattern is complete.",
        }),
    })
  );
};

const dtiStrengthResult = (fixture: NormalizedFixture, source: RuleSource): RuleResult => {
  const bolt = A.findFirst(fixture.components, (component) => Str.Equivalence(component.kind, "bolt"));
  const dti = A.findFirst(fixture.components, (component) => Str.Equivalence(component.kind, "dti"));
  const strengthsMatch = O.zipWith(bolt, dti, (boltComponent, dtiComponent) =>
    Str.Equivalence(boltComponent.strengthClass, dtiComponent.strengthClass)
  ).pipe(O.getOrElse(() => false));
  return pipe(
    strengthsMatch,
    Bool.match({
      onFalse: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-dti-strength-mismatch`),
          disposition: "mismatch",
          matchedFacts: [
            `Bolt strength: ${O.map(bolt, (component) => component.strengthClass).pipe(O.getOrElse(() => "missing"))}`,
            `DTI strength: ${O.map(dti, (component) => component.strengthClass).pipe(O.getOrElse(() => "missing"))}`,
          ],
          requiresHuman: true,
          ruleId: "dti-strength-match",
          source,
          stopReason: "Stop for correction or RFI; do not quote a DTI from the wrong strength family.",
        }),
      onTrue: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-dti-strength-positive`),
          disposition: "pass",
          matchedFacts: [
            `Bolt strength: ${O.map(bolt, (component) => component.strengthClass).pipe(O.getOrElse(() => "missing"))}`,
            `DTI strength: ${O.map(dti, (component) => component.strengthClass).pipe(O.getOrElse(() => "missing"))}`,
          ],
          requiresHuman: false,
          ruleId: "dti-strength-match",
          source,
          stopReason: "No stop: bolt and DTI strength families match in the fixed fixture.",
        }),
    })
  );
};

const a490HdgResult = (fixture: NormalizedFixture, source: RuleSource): RuleResult => {
  const isA490 = Str.Equivalence(fixture.productVariant.standardId, A490_STANDARD_ID);
  const isHdg = Str.Equivalence(fixture.productVariant.finishId, "hot-dip-galvanized");
  return pipe(
    Bool.and(isA490, isHdg),
    Bool.match({
      onFalse: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-a490-hdg-positive`),
          disposition: "pass",
          matchedFacts: [`Product: ${fixture.productVariant.label}`, `Finish id: ${fixture.productVariant.finishId}`],
          requiresHuman: false,
          ruleId: "a490-hdg-refusal",
          source,
          stopReason: "No stop: the forbidden A490 plus HDG combination is absent.",
        }),
      onTrue: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-a490-hdg-refusal`),
          disposition: "refuse",
          matchedFacts: [`Product: ${fixture.productVariant.label}`, `Finish id: ${fixture.productVariant.finishId}`],
          requiresHuman: true,
          ruleId: "a490-hdg-refusal",
          source,
          stopReason: "Refuse the silent substitution and stop for a qualified coating/specification decision.",
        }),
    })
  );
};

/**
 * Evaluate all three cited rules against both normalized fixtures.
 *
 * **Details**
 *
 * The fixed pair deliberately yields one pass and one mismatch or refusal for every rule.
 * All non-pass outcomes stop for an RFI or qualified human decision.
 *
 * **Example** (Inspect the evaluator)
 *
 * ```ts
 * import { evaluateRules } from "@/workflows/Rules"
 *
 * console.log(typeof evaluateRules === "function") // true
 * ```
 *
 * @category rules
 * @since 0.0.0
 */
export const evaluateRules = Effect.fn("lejeune.rules.evaluate")(function* (
  fixtures: readonly [NormalizedFixture, NormalizedFixture]
) {
  const [matchedSource, dtiSource, coatingSource] = yield* Effect.all(
    [
      makeRuleSource({
        evidence: MATCHED_ASSEMBLY_EVIDENCE,
        id: "aisc-matched-assembly",
        revision: "AISC Engineering FAQ 6.2; RCSC Specification 2020",
        title: "AISC Engineering FAQs: 6. Bolting",
        url: "https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/",
      }),
      makeRuleSource({
        evidence: DTI_STRENGTH_EVIDENCE,
        id: "portland-bolt-astm-f959",
        revision: "ASTM F959 technical summary accessed 2026-08-25",
        title: "Portland Bolt ASTM F959",
        url: "https://www.portlandbolt.com/technical/specifications/astm-f959/",
      }),
      makeRuleSource({
        evidence: A490_HDG_EVIDENCE,
        id: "fastenal-a490-coating",
        revision: "Fastenal Structural Bolts blueprint accessed 2026-08-25",
        title: "Fastenal Blueprint: Structural Bolts",
        url: "https://blueprint.fastenal.com/structural-bolts.html",
      }),
    ],
    { concurrency: 3 }
  );
  const [rfqA, rfqB] = fixtures;
  return [
    matchedAssemblyResult(rfqA, matchedSource),
    matchedAssemblyResult(rfqB, matchedSource),
    dtiStrengthResult(rfqA, dtiSource),
    dtiStrengthResult(rfqB, dtiSource),
    a490HdgResult(rfqA, coatingSource),
    a490HdgResult(rfqB, coatingSource),
  ] as const;
});
