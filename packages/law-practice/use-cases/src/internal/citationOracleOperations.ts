/**
 * Test-only normalized public-operation oracle records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleOperations");
const Operation = LiteralKit(["clean_text", "get_citations", "resolve_citations", "annotate_citations"]).pipe(
  $I.annoteSchema("Operation", { description: "The four public operations of the pinned official oracle." })
);
const PythonRange = S.Tuple([S.Natural, S.Natural]).pipe(
  $I.annoteSchema("PythonRange", {
    description: "A half-open range whose unit and coordinate space are supplied by its owner.",
  })
);
const CallableDescriptor = S.Struct({
  callable: S.NonEmptyString,
  path: S.optionalKey(S.NonEmptyString),
  line: S.optionalKey(S.Natural),
  sourceSha256: S.optionalKey(Sha256Hex),
}).pipe(
  $I.annoteSchema("CallableDescriptor", {
    description: "Source-bound callable identity for oracle accounting; never an executable request callback.",
  })
);
const CleanerSteps = S.Array(S.Union([S.String, CallableDescriptor])).pipe(
  $I.annoteSchema("CleanerSteps", { description: "Ordered names or source-bound identities of oracle cleaning steps." })
);
const CitationKind = LiteralKit([
  "FullCaseCitation",
  "ShortCaseCitation",
  "FullLawCitation",
  "FullJournalCitation",
  "SupraCitation",
  "IdCitation",
  "ReferenceCitation",
  "UnknownCitation",
]).pipe(
  $I.annoteSchema("CitationKind", {
    description: "Canonical citation classes normalized as evidence tags, not donor inheritance.",
  })
);
const OracleCitation = S.Struct({
  citationType: CitationKind,
  fields: S.JsonObject,
  matchedText: S.String,
  correctedCitation: S.String,
  correctedFullCitation: S.String,
  span: PythonRange,
  fullSpan: PythonRange,
  spanWithPincite: PythonRange,
}).pipe(
  $I.annoteSchema("OracleCitation", {
    description:
      "Complete schema-decoded donor fields plus observable citation methods; document cycles are represented by stage data.",
  })
);
const CoordinateEvidence = S.Struct({
  python: PythonRange,
  utf16: PythonRange,
  text: S.String,
  coordinateSpace: S.tag("plain-text"),
}).pipe(
  $I.annoteSchema("CoordinateEvidence", {
    description: "Exact Python/UTF-16 slice evidence in the observed plain text; never a verified raw-source anchor.",
  })
);
const CitationSpans = S.Struct({
  span: CoordinateEvidence,
  fullSpan: CoordinateEvidence,
  spanWithPincite: CoordinateEvidence,
}).pipe(
  $I.annoteSchema("CitationSpans", {
    description: "The three independently observable ranges of one extracted citation.",
  })
);
const DocumentStage = S.Struct({
  sourceText: S.String,
  plainText: S.String,
  markupText: S.NullOr(S.String),
  words: S.Array(S.Json),
  citationTokens: S.Array(S.Json),
  emphasisTags: S.Array(S.Json),
}).pipe(
  $I.annoteSchema("DocumentStage", {
    description:
      "Post-clean/tokenize document captured before citation filtering, with source and plain text kept distinct.",
  })
);
const Failure = S.Struct({ kind: S.tag("failure"), pythonType: S.NonEmptyString, message: S.String }).pipe(
  $I.annoteSchema("Failure", {
    description: "An expected upstream failure captured without translating it into a target boundary error.",
  })
);
const TextOutcome = S.Union([S.Struct({ kind: S.tag("success"), value: S.String }), Failure]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TextOutcome", { description: "Exact text output or expected upstream failure." })
);
const CitationOutcome = S.Union([S.Struct({ kind: S.tag("success"), value: S.Array(OracleCitation) }), Failure]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("CitationOutcome", {
    description: "Ordered canonical citation outputs or expected upstream failure.",
  })
);
const ResolutionOutcome = S.Union([S.Struct({ kind: S.tag("success"), value: S.JsonObject }), Failure]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ResolutionOutcome", {
    description: "Normalized resource/citation mappings or expected upstream failure.",
  })
);
const CommonCase = {
  id: S.NonEmptyString,
  test: S.NonEmptyString,
  sourceSiteId: S.NonEmptyString,
  ordinal: S.Natural,
  normalizedSha256: Sha256Hex,
};
const EmptyStages = S.Struct({}).pipe(
  $I.annoteSchema("EmptyStages", { description: "No additional instrumented intermediate stage for this operation." })
);
// Information law: preserve original JSON bytes plus their derived typed value.
// Decode is partial for malformed/unsupported data; encode is partial for a
// forged raw/value pair. Coherent decoded values encode to the exact raw bytes.
const capturedJson = <Value, Encoded>(schema: S.Codec<Value, Encoded>) => {
  const json = S.fromJsonString(schema);
  const equivalent = S.toEquivalence(S.toType(schema));
  const invalid = () => new SchemaIssue.InvalidValue({ message: "Captured JSON bytes and typed value disagree." });
  return S.String.pipe(
    S.decodeTo(
      S.Struct({ raw: S.String, value: S.toType(schema) }),
      SchemaTransformation.transformEffect({
        decode: (raw) =>
          S.decodeEffect(json)(raw).pipe(
            Effect.map((value) => ({ raw, value })),
            Effect.mapError(invalid)
          ),
        encode: ({ raw, value }) =>
          S.decodeEffect(json)(raw).pipe(
            Effect.flatMap((original) => (equivalent(original, value) ? Effect.succeed(raw) : Effect.fail(invalid()))),
            Effect.mapError(invalid)
          ),
      })
    )
  );
};
const OperationCase = Operation.toTaggedUnion("operation")({
  clean_text: {
    ...CommonCase,
    payload: capturedJson(
      S.Struct({
        input: S.Struct({ text: S.String, steps: CleanerSteps }),
        stages: EmptyStages,
        outcome: TextOutcome,
      })
    ),
  },
  get_citations: {
    ...CommonCase,
    payload: capturedJson(
      S.Struct({
        input: S.Struct({
          plain_text: S.String,
          markup_text: S.String,
          remove_ambiguous: S.Boolean,
          clean_steps: S.NullOr(CleanerSteps),
          tokenizer: S.Struct({ tokenizer: S.NonEmptyString, extractorsSha256: Sha256Hex }),
        }),
        stages: S.Struct({
          document: DocumentStage,
          citationSpans: S.Array(CitationSpans),
          filtering: S.Array(
            S.Struct({
              kind: S.Literals(["filter", "disambiguate"]),
              candidates: S.Array(OracleCitation),
              retained: S.Array(S.Natural),
            })
          ),
          warnings: S.Array(S.Struct({ logger: S.NonEmptyString, messageTemplate: S.String, arguments: S.Json })),
        }),
        outcome: CitationOutcome,
      })
    ),
  },
  resolve_citations: {
    ...CommonCase,
    payload: capturedJson(
      S.Struct({
        input: S.Struct({
          citations: S.Array(OracleCitation),
          resolve_full_citation: CallableDescriptor,
          resolve_shortcase_citation: CallableDescriptor,
          resolve_supra_citation: CallableDescriptor,
          resolve_reference_citation: CallableDescriptor,
          resolve_id_citation: CallableDescriptor,
        }),
        stages: S.Struct({ resolutionGroups: S.Array(S.Struct({ resource: S.Json, members: S.Array(S.Natural) })) }),
        outcome: ResolutionOutcome,
      })
    ),
  },
  annotate_citations: {
    ...CommonCase,
    payload: capturedJson(
      S.Struct({
        input: S.Struct({
          plain_text: S.String,
          annotations: S.Array(S.Tuple([PythonRange, S.Json, S.Json])),
          source_text: S.String,
          unbalanced_tags: S.String,
          use_dmp: S.Boolean,
          annotator: S.NullOr(CallableDescriptor),
          offset_updater: S.NullOr(S.JsonObject),
        }),
        stages: EmptyStages,
        outcome: TextOutcome,
      })
    ),
  },
}).pipe(
  $I.annoteSchema("OperationCase", {
    description:
      "A closed operation-specific observation with one canonical JSON payload and typed decoded input/stage/output boundaries.",
  })
);
const Artifact = S.Union([
  S.Struct({ kind: S.tag("tokenizer-extractors"), payload: S.JsonObject.pipe(S.Array, capturedJson) }),
  S.Struct({ kind: S.tag("model-value"), payload: S.JsonObject.pipe(capturedJson) }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Artifact", {
    description:
      "Shared tokenizer configuration or immutable reporter/edition data, identified by the SHA-256 of its exact encoded payload.",
  })
);

const OperationSite = S.Struct({
  id: S.NonEmptyString,
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.Natural,
  operation: Operation,
  sourceSha256: Sha256Hex,
}).pipe(
  $I.annoteSchema("OperationSite", {
    description: "One independently inventoried AST call site for a public operation.",
  })
);
const Operations = S.Struct({
  schemaVersion: S.tag("citation-oracle-operations/v1"),
  scope: S.tag("public-operation-observations; model/helper assertion proof remains separate"),
  commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  clockDate: S.tag("2026-10-28"),
  hashSeed: S.tag("0"),
  normalizationVersion: S.tag("public-operation-normalization/v1"),
  python: S.NonEmptyString,
  testsRun: S.tag(52),
  license: S.tag("BSD-2-Clause"),
  licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
  lockSha256: S.tag("864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"),
  exporterSha256: Sha256Hex,
  dependencies: S.Record(S.NonEmptyString, S.NonEmptyString),
  sourceSites: S.Array(OperationSite),
  cases: S.Array(OperationCase),
  artifacts: S.Record(Sha256Hex, Artifact),
});
const OperationAccounting = S.makeFilter(
  (report: typeof Operations.Type) => {
    const siteIds = A.map(report.sourceSites, (site) => site.id);
    const caseIds = A.map(report.cases, (row) => row.id);
    return (
      A.length(A.dedupe(siteIds)) === A.length(siteIds) &&
      A.length(A.dedupe(caseIds)) === A.length(caseIds) &&
      A.every(report.sourceSites, (site) => A.some(report.cases, (row) => row.sourceSiteId === site.id)) &&
      A.every(
        report.cases,
        (row) =>
          row.ordinal > 0 &&
          row.id === `${row.test}::${row.sourceSiteId}::${row.ordinal}` &&
          A.some(report.sourceSites, (site) => site.id === row.sourceSiteId && site.operation === row.operation)
      )
    );
  },
  $I.annote("OperationAccounting", {
    title: "Public Operation Observation Accounting",
    description:
      "Every static operation site is observed, and every unique runtime case references its matching operation site.",
    message: "Operation evidence has duplicate, missing, unknown or mismatched source/runtime observations.",
  })
);

/**
 * Pinned public-operation input/stage/output observations for parity fixtures.
 *
 * **Details**
 *
 * This corpus covers observed public calls. Independent model/helper assertion
 * cases, static regex families and target implementation proofs remain required.
 * Plain-text coordinates are explicitly distinct from raw-source verification.
 *
 * **Example** (Reject unversioned operation evidence)
 *
 * ```ts
 * import { CitationOracleOperations } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CitationOracleOperations)({})) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationOracleOperations extends S.Opaque<CitationOracleOperations, { readonly brand: unique symbol }>()(
  Operations.check(OperationAccounting).pipe(
    $I.annoteSchema("CitationOracleOperations", {
      description:
        "Versioned public-operation observations with independent source-site accounting and explicit coordinate spaces.",
    })
  )
) {}
