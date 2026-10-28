/**
 * Focused synthetic oracle probes; remaining supplemental coverage is explicit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationOracleJson } from "./citationOracleJson.ts";
import { CitationSupplementalTextCase } from "./citationSupplementalText.ts";

const $I = $LawPracticeUseCasesId.create("internal/citationSupplementalExtraction");
const Range = S.Tuple([S.Natural, S.Natural]).pipe(
  $I.annoteSchema("Range", { description: "Half-open range in its explicitly named coordinate unit." })
);
const Span = S.Struct({ python: Range, utf16: Range, text: S.String }).pipe(
  $I.annoteSchema("Span", { description: "Exact slices of the probe input, without raw-source verification claims." })
);
const Citation = S.Struct({
  kind: LiteralKit(["FullCaseCitation", "FullLawCitation", "IdCitation"]),
  groups: S.Record(S.String, S.String),
  correctedReporter: S.NullOr(S.String),
  correctedCitation: S.String,
  correctedFullCitation: S.String,
  spans: S.Struct({ span: Span, fullSpan: Span, spanWithPincite: Span }),
}).pipe(
  $I.annoteSchema("Citation", {
    description: "Focused observable extraction projection; full model proof remains separate.",
  })
);
const Observation = S.Struct({
  text: S.String,
  citations: S.Array(Citation),
  authorityGroups: S.Natural.pipe(S.Array, S.Array),
  equality: S.Boolean.pipe(S.Array, S.Array),
}).pipe(
  $I.annoteSchema("Observation", {
    description: "Citation coordinates, pairwise equality and document-local resolution membership.",
  })
);

/**
 * Portable supplemental observations and unfinished target obligations.
 *
 * **Example** (Select the codec)
 *
 * ```ts
 * import { CitationSupplementalExtraction } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(CitationSupplementalExtraction)
 * void decode
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationSupplementalExtraction extends S.Opaque<
  CitationSupplementalExtraction,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-supplemental-extraction/v3"),
    scope: S.tag(
      "Focused extraction/resolution/cleaning/annotation projections; not exhaustive supplemental or target parity proof."
    ),
    commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    license: S.tag("BSD-2-Clause"),
    licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
    lockSha256: S.tag("864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"),
    python: S.tag("3.11.15"),
    hashSeed: S.tag("0"),
    clockDate: S.tag("2026-10-28"),
    dependencies: S.Record(S.String, S.NonEmptyString),
    exporterSha256: Sha256Hex,
    planSha256: Sha256Hex,
    textPlanSha256: Sha256Hex,
    observerSha256: Sha256Hex,
    textCases: S.Array(CitationSupplementalTextCase),
    sourceHashes: S.Record(S.String, Sha256Hex),
    cases: S.Array(
      S.Struct({
        id: S.NonEmptyString,
        normalizedSha256: Sha256Hex,
        payload: CitationOracleJson(Observation),
        workflowState: LiteralKit(["audit", "ready", "complete"]),
        targetProof: S.NullOr(S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString, evidenceSha256: Sha256Hex })),
      })
    ),
    remainingCoverage: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CitationSupplementalExtraction", {
      description:
        "Pinned focused probes with coherent exact-byte payloads, provenance and explicit open coverage; never target parity by itself.",
    })
  )
) {}
