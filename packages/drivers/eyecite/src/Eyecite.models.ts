/**
 * Bounded technical recognition DTOs. These are untrusted parser observations,
 * never semantic citations, source proofs, authority IDs or confidence claims.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EyeciteId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EyeciteId.create("Eyecite.models");
const SourceText = S.fromJsonString(S.String.check(S.isMaxLength(1_048_576))).pipe(
  $I.annoteSchema("SourceText", {
    description: "Exact UTF-16 string escaped by the provided JSON codec before binary transport.",
  })
);
/** Untrusted original-source offsets, with no verification capability.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteRawRange } from "@beep/eyecite"
 * const range = EyeciteRawRange.make({ start: 0, end: 3 })
 * console.log(range.end) // 3
 * ```
 * @category models
 * @since 0.0.0
 */
export class EyeciteRawRange extends S.Opaque<EyeciteRawRange, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.Natural.check(S.isLessThanOrEqualTo(1_048_576)),
    end: S.Natural.check(S.isLessThanOrEqualTo(1_048_576)),
  }).pipe(
    $I.annoteSchema("EyeciteRawRange", {
      description: "Parser-supplied original UTF-16 offsets; the receiving source owner must verify them.",
    })
  )
) {}
/** Source component names retained from the technical parser.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteComponentName } from "@beep/eyecite"
 * console.log(EyeciteComponentName.is.plaintiff("plaintiff")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const EyeciteComponentName = LiteralKit([
  "pincite",
  "subsection",
  "plaintiff",
  "defendant",
  "caseName",
  "year",
  "volume",
  "reporter",
  "page",
  "title",
  "code",
  "section",
]).pipe(
  $I.annoteSchema("EyeciteComponentName", {
    description: "Finite raw component names needed by the verified-source adapter.",
  })
);
/**
 * Runtime type derived from the corresponding recognition schema.
 * @category models
 * @since 0.0.0
 */
export type EyeciteComponentName = typeof EyeciteComponentName.Type;
/** Raw component range, requiring independent receiving-side verification.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteComponent } from "@beep/eyecite"
 * console.log(EyeciteComponent.fields.name !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class EyeciteComponent extends S.Opaque<EyeciteComponent, { readonly brand: unique symbol }>()(
  S.Struct({ name: EyeciteComponentName, range: EyeciteRawRange }).pipe(
    $I.annoteSchema("EyeciteComponent", {
      description: "Named untrusted component offsets without source text or proof authority.",
    })
  )
) {}
const common = { range: EyeciteRawRange, components: S.Array(EyeciteComponent).check(S.isMaxLength(12)) };
const optionalText = S.NullOr(SourceText);
const Case = S.Struct({
  type: S.tag("case"),
  ...common,
  volume: SourceText,
  reporter: SourceText,
  page: optionalText,
  plaintiff: optionalText,
  defendant: optionalText,
  caseName: optionalText,
  year: optionalText,
}).pipe(
  $I.annoteSchema("Case", {
    description: "Selected raw case fields; no donor IDs, confidence, edition graph or resolution.",
  })
);
const Short = S.Struct({ type: S.tag("shortFormCase"), ...common, volume: SourceText, reporter: SourceText }).pipe(
  $I.annoteSchema("Short", { description: "Raw short-form publication fields and component ranges." })
);
const Id = S.Struct({ type: S.tag("id"), ...common }).pipe(
  $I.annoteSchema("Id", { description: "Raw Id. occurrence without inherited authority or heuristic metadata." })
);
const Supra = S.Struct({ type: S.tag("supra"), ...common, partyName: optionalText }).pipe(
  $I.annoteSchema("Supra", { description: "Raw supra party spelling and ranges, not a verified antecedent." })
);
const Statute = S.Struct({ type: S.tag("statute"), ...common, title: S.tag(35), section: SourceText }).pipe(
  $I.annoteSchema("Statute", {
    description: "Raw explicit title 35 statute locator, without legal authority identity.",
  })
);
const Regulation = S.Struct({ type: S.tag("regulation"), ...common, title: S.tag(37), section: SourceText }).pipe(
  $I.annoteSchema("Regulation", {
    description: "Raw explicit title 37 regulation locator, without legal authority identity.",
  })
);
/** Finite technical parser observations. Receiving product code owns semantics.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteRecognition } from "@beep/eyecite"
 * console.log(EyeciteRecognition.members.length) // 6
 * ```
 * @category models
 * @since 0.0.0
 */
export const EyeciteRecognition = S.Union([Case, Short, Id, Supra, Statute, Regulation]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EyeciteRecognition", {
    description: "Closed raw recognizer result variants; never a public semantic citation hierarchy.",
  })
);
/**
 * Runtime type derived from the corresponding recognition schema.
 * @category models
 * @since 0.0.0
 */
export type EyeciteRecognition = typeof EyeciteRecognition.Type;
/** Captured source and candidate ceilings for one isolated recognition request.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteRecognizeInput } from "@beep/eyecite"
 * console.log(EyeciteRecognizeInput.fields.source !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class EyeciteRecognizeInput extends S.Opaque<EyeciteRecognizeInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: SourceText,
    sourceUtf16: S.Natural.check(S.isLessThanOrEqualTo(1_048_576)),
    candidates: S.Natural.check(S.isLessThanOrEqualTo(100_000)),
  }).pipe(
    $I.annoteSchema("EyeciteRecognizeInput", {
      description: "Bounded request; the synchronous recognizer must execute only in an owned child.",
    })
  )
) {}
/** Small bounded raw response, explicitly distinguishing omitted forms.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteRecognizeOutput } from "@beep/eyecite"
 * console.log(EyeciteRecognizeOutput.fields.tokens !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class EyeciteRecognizeOutput extends S.Opaque<EyeciteRecognizeOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    tokens: S.Array(EyeciteRecognition).check(S.isMaxLength(100_000)),
    outsideProfile: S.Natural.check(S.isLessThanOrEqualTo(100_000)),
    excludedRanges: S.Array(EyeciteRawRange).check(S.isMaxLength(100_000)),
  })
    .check(
      S.makeFilter(
        ({ tokens, outsideProfile, excludedRanges }) =>
          outsideProfile === excludedRanges.length && tokens.length + outsideProfile <= 100_000,
        $I.annote("ObservationCounts", {
          description: "Every excluded observation retains its range within the absolute candidate ceiling.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("EyeciteRecognizeOutput", {
        description: "Validated raw token projection; an empty profile result is not whole-document citation absence.",
      })
    )
) {}
/** Source-free driver failure, without parser messages, paths or nested causes.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteFailure } from "@beep/eyecite"
 * console.log(EyeciteFailure.make({ reason: "source-limit" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class EyeciteFailure extends S.TaggedError<EyeciteFailure, { readonly brand: unique symbol }>(
  $I`EyeciteFailure`
)(
  "EyeciteFailure",
  { reason: LiteralKit(["invalid-input", "source-limit", "candidate-limit", "parser-failed", "invalid-result"]) },
  $I.annoteError<EyeciteFailure>("EyeciteFailure", {
    description: "Closed recognition failure without caller data or nested parser errors.",
  })
) {}
