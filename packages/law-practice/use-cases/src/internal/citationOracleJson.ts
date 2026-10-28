/**
 * Byte-preserving JSON views for integrity-bound oracle fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleJson");

/**
 * Preserve an oracle payload's exact bytes alongside its derived typed value.
 *
 * **Details**
 *
 * The information law is reversible for coherent decoded values. Decode is
 * partial for invalid JSON/data; encode is partial for forged raw/value pairs.
 * Encoding a coherent decoded value preserves the original bytes and hash.
 *
 * **Example** (Decode a view without discarding the source bytes)
 *
 * ```ts
 * import { CitationOracleJson } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const codec = CitationOracleJson(S.Struct({ value: S.String }))
 * const decoded = S.decodeEffect(codec)('{ "value": "x" }')
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const CitationOracleJson = <Value, Encoded>(schema: S.Codec<Value, Encoded>) => {
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
    ),
    $I.annoteSchema("CitationOracleJson", {
      description: "Original JSON bytes and a coherent derived view; exact-byte encode or typed schema failure.",
    })
  );
};

/**
 * Content-addressed shared tokenizer configuration or immutable vocabulary data.
 *
 * **Example** (Reject an unclassified shared artifact)
 *
 * ```ts
 * import { CitationOracleArtifact } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CitationOracleArtifact)({ kind: "unknown" })) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const CitationOracleArtifact = S.Union([
  S.Struct({ kind: S.tag("tokenizer-extractors"), payload: S.JsonObject.pipe(S.Array, CitationOracleJson) }),
  S.Struct({ kind: S.tag("model-value"), payload: S.JsonObject.pipe(CitationOracleJson) }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("CitationOracleArtifact", {
    description:
      "Shared tokenizer configuration or immutable reporter/edition data, identified by the SHA-256 of its exact encoded payload.",
  })
);

/**
 * Decoded shared oracle artifact with its original payload bytes.
 *
 * @category testing
 * @since 0.0.0
 */
export type CitationOracleArtifact = typeof CitationOracleArtifact.Type;
