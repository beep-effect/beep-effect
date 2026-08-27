/**
 * The complete three-rule advisory slice for the fixed LeJeune demo story.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GroundedExtraction } from "@beep/langextract/Extraction";
import { locateGroundedExtractions } from "@beep/langextract/VerifiedSpan";
import { Effect, identity, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { CanonicalRuleSourceContracts, RuleResult, RuleSource } from "@/domain/Bundle";
import { EntityId } from "@/domain/Ontology";
import { FixtureError } from "@/fixtures/Sources";
import type { NormalizedFixture } from "@/domain/Bundle";
import type { Component } from "@/domain/Ontology";

const A490_STANDARD_ID = EntityId.make("astm-a490-type-1");
const DTI_325_STANDARD_ID = EntityId.make("astm-f959-type-325");
const MATCHED_ASSEMBLY_STANDARD_ID = EntityId.make("astm-f1852-type-1");
const MATCHED_ASSEMBLY_NUT_STANDARD_ID = EntityId.make("astm-a563-dh");
const MATCHED_ASSEMBLY_WASHER_STANDARD_ID = EntityId.make("astm-f436-type-1");
const MATCHED_ASSEMBLY_FINISH_ID = EntityId.make("mechanical-galvanized-b695-class-55");
const makeRuleSource = Effect.fnUntraced(function* (input: (typeof CanonicalRuleSourceContracts)[number]) {
  const candidate = GroundedExtraction.cases.unaligned.make({ label: "rule-evidence", text: input.evidence });
  const anchors = yield* locateGroundedExtractions([candidate], input.evidence);
  const evidenceAnchor = yield* O.match(A.head(anchors), {
    onNone: () =>
      FixtureError.make({ stage: "rule-source", message: `No exact evidence anchor was produced for ${input.id}.` }),
    onSome: Effect.succeed,
  });
  return RuleSource.make({
    accessedOn: input.accessedOn,
    evidence: input.evidence,
    evidenceAnchor,
    id: input.id,
    researchPath: input.researchPath,
    revision: input.revision,
    title: input.title,
    url: input.url,
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
    A.every(
      [
        Str.Equivalence(boltComponent.strengthClass, dtiComponent.strengthClass),
        Str.Equivalence(dtiComponent.standardId, DTI_325_STANDARD_ID),
        Str.Equivalence(dtiComponent.strengthClass, "325"),
      ],
      identity
    )
  ).pipe(O.getOrElse(() => false));
  return pipe(
    strengthsMatch,
    Bool.match({
      onFalse: () =>
        RuleResult.make({
          caseId: EntityId.make(`${fixture.rfq.id}-dti-strength-mismatch`),
          disposition: "mismatch",
          matchedFacts: [
            `Bolt standard/strength: ${O.map(bolt, (component) => `${component.standardId}/${component.strengthClass}`).pipe(O.getOrElse(() => "missing"))}`,
            `DTI standard/strength: ${O.map(dti, (component) => `${component.standardId}/${component.strengthClass}`).pipe(O.getOrElse(() => "missing"))}`,
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
            `Bolt standard/strength: ${O.map(bolt, (component) => `${component.standardId}/${component.strengthClass}`).pipe(O.getOrElse(() => "missing"))}`,
            `DTI standard/strength: ${O.map(dti, (component) => `${component.standardId}/${component.strengthClass}`).pipe(O.getOrElse(() => "missing"))}`,
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
  const [matchedAssemblySourceContract, dtiSourceContract, coatingSourceContract] = CanonicalRuleSourceContracts;
  const [matchedSource, dtiSource, coatingSource] = yield* Effect.all(
    [
      makeRuleSource(matchedAssemblySourceContract),
      makeRuleSource(dtiSourceContract),
      makeRuleSource(coatingSourceContract),
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
