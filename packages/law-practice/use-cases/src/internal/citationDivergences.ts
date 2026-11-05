/**
 * Representation-only comparison laws and unresolved citation fidelity questions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/citationDivergences");
const FileReference = S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }).pipe(
  $I.annoteSchema("FileReference", {
    description: "Repository-contained source/evidence path with exact UTF-8 file digest.",
  })
);
const TestReference = S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString, sha256: Sha256Hex }).pipe(
  $I.annoteSchema("TestReference", { description: "Named focused test bound to its repository source bytes." })
);
const Proof = S.Struct({ test: TestReference, receipt: FileReference, result: S.tag("passed") }).pipe(
  $I.annoteSchema("Proof", {
    description: "Source-bound focused test and receipt references; never an executable fixture command.",
  })
);
const PlannedTest = S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString }).pipe(
  $I.annoteSchema("PlannedTest", {
    description: "Required focused regression identity; a plan does not prove that the test exists or passed.",
  })
);
const RuleFields = {
  kind: S.tag("representation-law"),
  targetTest: PlannedTest,
  id: S.NonEmptyString,
  statement: S.NonEmptyString,
  references: S.NonEmptyArray(FileReference),
};
const Rule = LiteralKit(["audit", "complete"])
  .toTaggedUnion("workflowState")({
    audit: { ...RuleFields, proof: S.Null },
    complete: { ...RuleFields, proof: Proof },
  })
  .pipe(
    $I.annoteSchema("Rule", {
      description: "One source-bound representation law with explicit incomplete or completed proof.",
    })
  );
const QuestionFields = {
  kind: S.tag("fidelity-question"),
  targetTest: PlannedTest,
  id: S.NonEmptyString,
  observations: S.NonEmptyArray(
    S.Struct({
      file: S.tag("supplemental-extraction.json"),
      collection: S.tag("textCases"),
      id: S.NonEmptyString,
      normalizedSha256: Sha256Hex,
    })
  ),
};
const Question = LiteralKit(["audit", "complete"])
  .toTaggedUnion("workflowState")({
    audit: { ...QuestionFields, blocker: S.NonEmptyString },
    complete: {
      ...QuestionFields,
      resolution: LiteralKit(["separate-operation-contracts", "preserve-observable-behavior"]),
      rationale: S.NonEmptyString,
      proof: Proof,
    },
  })
  .pipe(
    $I.annoteSchema("Question", {
      description: "One unresolved or evidenced fidelity question; semantic waiver is not a resolution.",
    })
  );

/**
 * Source-bound focused test receipt consumed by the divergence accounting gate.
 *
 * **Example** (Select the receipt codec)
 *
 * ```ts
 * import { CitationDivergenceProofReceipt } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(CitationDivergenceProofReceipt)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationDivergenceProofReceipt extends S.Opaque<
  CitationDivergenceProofReceipt,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-divergence-focused-proof/v1"),
    producer: S.Struct({
      path: S.tag("goals/citation-extraction-engine/ops/run-divergence-proof.ts"),
      sha256: Sha256Hex,
    }),
    planSha256: Sha256Hex,
    subjectId: S.NonEmptyString,
    runner: S.tag("vitest"),
    runnerVersion: S.NonEmptyString,
    test: TestReference,
    evidence: S.NonEmptyArray(FileReference),
    result: S.tag("passed"),
    exitCode: S.tag(0),
  }).pipe(
    $I.annoteSchema("CitationDivergenceProofReceipt", {
      description:
        "Focused execution reference integrity; full target comparison and repository gates remain independently required.",
    })
  )
) {}

/**
 * Portable divergence accounting with no semantic waiver escape hatch.
 *
 * **Example** (Select the test-only codec)
 *
 * ```ts
 * import { CitationDivergences } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(CitationDivergences)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationDivergences extends S.Opaque<CitationDivergences, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("citation-divergences/v1"),
    scope: S.tag("Representation laws and open fidelity questions; no semantic parity waiver."),
    commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    license: S.tag("BSD-2-Clause"),
    licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
    planSha256: Sha256Hex,
    exporterSha256: Sha256Hex,
    supplementalSha256: Sha256Hex,
    normalizations: S.NonEmptyArray(Rule),
    questions: S.NonEmptyArray(Question),
    semanticWaivers: S.Tuple([]),
  }).pipe(
    $I.annoteSchema("CitationDivergences", {
      description:
        "Exact source/case-bound representation laws and fidelity review obligations; incomplete proof cannot become canonical parity.",
    })
  )
) {}
