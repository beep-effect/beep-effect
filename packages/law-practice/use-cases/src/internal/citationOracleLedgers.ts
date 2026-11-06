/**
 * Source, canonical-case and regex ledgers for citation parity accounting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleLedgers");
const License = S.Struct({
  id: S.tag("BSD-2-Clause"),
  material: S.tag("source-adaptation-and-test-observations"),
  notice: S.tag("THIRD_PARTY_NOTICES.md"),
  sha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
});
const Common = {
  generatorVersion: S.tag("citation-ledger-projection/v1"),
  generatorSha256: Sha256Hex,
  source: S.Struct({
    repository: S.tag("https://github.com/freelawproject/eyecite"),
    commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    license: License,
  }),
  evidence: S.Struct({
    discovery: S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }),
    assertions: S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }),
    operations: S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }),
  }),
};
const SourceFields = {
  id: S.NonEmptyString,
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.Natural,
  symbol: S.NonEmptyString,
  sourceSha256: Sha256Hex,
};
const RegexForm = LiteralKit([
  "builder",
  "declaration",
  "escape",
  "module-call",
  "method-call",
  "extractor-constructor",
]);
const SourceRow = S.Union([
  S.Struct({ ...SourceFields, kind: S.tag("caseDeclaration") }),
  S.Struct({
    ...SourceFields,
    kind: LiteralKit(["publicOperation", "modelFamily", "helperFamily"]),
    capabilityId: S.NonEmptyString,
  }),
  S.Struct({
    ...SourceFields,
    kind: S.tag("regexFamily"),
    form: RegexForm,
    expression: S.NonEmptyString,
    patternExpression: S.optionalKey(S.NonEmptyString),
  }),
  S.Struct({ id: S.NonEmptyString, kind: S.tag("fixture"), path: S.NonEmptyString, sourceSha256: Sha256Hex }),
]);
const Inventory = S.Struct({
  ...Common,
  schemaVersion: S.tag("citation-source-inventory/v1"),
  rows: S.Array(SourceRow),
  testMethods: S.Array(S.Struct({ ...SourceFields, kind: S.tag("testMethod") })),
  parameterSources: S.JsonObject,
  declarationExpansions: S.Array(S.Struct({ declarationId: S.NonEmptyString, eventIds: S.Array(S.NonEmptyString) })),
});
const Workflow = LiteralKit(["audit", "blocked", "ready", "complete"]);
const Proof = S.NullOr(
  S.Struct({ command: S.NonEmptyString, result: S.tag("passed"), evidencePath: S.NonEmptyString })
);
const CanonicalFields = {
  kind: S.tag("canonical"),
  disposition: LiteralKit(["required", "subsumed"]),
  workflowState: Workflow,
  proof: Proof,
};
const Cases = S.Struct({
  ...Common,
  schemaVersion: S.tag("citation-canonical-cases/v1"),
  capabilities: S.Array(
    S.Struct({
      ...CanonicalFields,
      id: S.NonEmptyString,
      sourceRowId: S.NonEmptyString,
      familyId: S.NonEmptyString,
      rationale: S.NonEmptyString,
    })
  ),
  cases: S.Array(
    S.Struct({
      ...CanonicalFields,
      id: S.NonEmptyString,
      declarationId: S.NonEmptyString,
      test: S.NonEmptyString,
      ordinal: S.Natural,
      assertion: S.NonEmptyString,
      observation: S.Struct({ file: S.tag("assertion-cases.json"), id: S.NonEmptyString, normalizedSha256: Sha256Hex }),
      inputProjection: S.tag("payload.context.values; payload.operands; payload.keywordArguments"),
      expectedProjection: S.tag("payload.relation; payload.passed"),
      iterationIds: S.Array(S.NonEmptyString),
      literalItems: S.Array(S.Struct({ parameterId: S.NonEmptyString, itemOrdinal: S.Natural })),
      targetTest: S.NullOr(S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString })),
    })
  ),
  fixtures: S.Array(
    S.Struct({
      id: S.NonEmptyString,
      kind: S.tag("fixture"),
      path: S.NonEmptyString,
      sourceSha256: Sha256Hex,
      license: License,
      repository: S.NonEmptyString,
      commit: S.NonEmptyString,
      bytes: S.Natural,
    })
  ),
  operationObservations: S.Array(
    S.Struct({
      id: S.NonEmptyString,
      sourceSiteId: S.NonEmptyString,
      operation: S.NonEmptyString,
      test: S.NonEmptyString,
      normalizedSha256: Sha256Hex,
    })
  ),
});
const Regexes = S.Struct({
  ...Common,
  schemaVersion: S.tag("citation-regex-inventory/v1"),
  scope: S.tag("Source families and expanded tokenizer instances; no JavaScript regex safety proof yet."),
  families: S.Array(S.Struct({ id: S.NonEmptyString, form: RegexForm, workflowState: Workflow, proof: Proof })),
  extractorInstances: S.Array(
    S.Struct({
      id: S.NonEmptyString,
      artifactSha256: Sha256Hex,
      index: S.Natural,
      patternSha256: Sha256Hex,
      flags: S.Natural,
      constructor: S.NonEmptyString,
      workflowState: Workflow,
      proof: Proof,
    })
  ),
});

/**
 * Structured oracle ledgers that retain unfinished states honestly.
 *
 * **Details**
 *
 * Decoding validates representation. The portable checker separately reconciles
 * source/runtime projections; completion requires terminal rows and target proof.
 *
 * **Example** (Reject an unversioned ledger bundle)
 *
 * ```ts
 * import { CitationOracleLedgers } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationOracleLedgers)({})) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationOracleLedgers extends S.Opaque<CitationOracleLedgers, { readonly brand: unique symbol }>()(
  S.Struct({ inventory: Inventory, canonical: Cases, regex: Regexes }).pipe(
    $I.annoteSchema("CitationOracleLedgers", {
      description:
        "Source ownership, assertion cases and expanded regex evidence; target proof remains independently required.",
    })
  )
) {}
