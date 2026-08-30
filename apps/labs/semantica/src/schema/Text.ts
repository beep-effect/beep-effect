import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import { $SemanticaId } from "@beep/identity/packages";
import { SourceTextDigest, SourceTextExtractor, TextAnchor, TextAnchorVerificationReceipt } from "@beep/provenance";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { identity, Result, Tuple } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DegradedKind } from "@/schema/Degraded";
import { sha256CanonicalSync } from "@/schema/Digest";
import { ChunkId, DocumentId } from "@/schema/Ids";

const $I = $SemanticaId.create("schema/Text");

class ParsedOutcome extends S.Class<ParsedOutcome>($I`ParsedOutcome`)(
  {
    outcome: S.tag("Parsed"),
    document: DocumentId,
    text: S.String,
    extractor: SourceTextExtractor,
  },
  $I.annote("ParsedOutcome", {
    description: "Successful raw-text parse with its pinned extractor identity.",
  })
) {}

class DegradedParseOutcome extends S.Class<DegradedParseOutcome>($I`DegradedParseOutcome`)(
  {
    outcome: S.tag("Degraded"),
    document: DocumentId,
    kind: DegradedKind,
    detail: S.NonEmptyString,
  },
  $I.annote("DegradedParseOutcome", {
    description: "Typed parser degradation retained as a value.",
  })
) {}

const ParseOutcomeKind = LiteralKit(["Parsed", "Degraded"]);

/**
 * Successful or explicitly degraded parser result.
 *
 * **Example** (Build a degraded parse result)
 *
 * ```ts
 * import { ParseOutcome } from "@/schema/Text"
 * import { DocumentId } from "@/schema/Ids"
 *
 * const result = ParseOutcome.cases.Degraded.make({
 *   outcome: "Degraded",
 *   document: DocumentId.make("0".repeat(64)),
 *   kind: "invalid-utf8",
 *   detail: "Input was not valid UTF-8."
 * })
 * console.log(result.kind) // "invalid-utf8"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ParseOutcome = ParseOutcomeKind.mapMembers(Tuple.evolve([() => ParsedOutcome, () => DegradedParseOutcome]))
  .annotate(
    $I.annote("ParseOutcome", {
      description: "Parser outcome preserving either raw text or a typed degraded state.",
    })
  )
  .pipe(S.toTaggedUnion("outcome"));

/**
 * Decoded parser outcome.
 *
 * **Example** (Annotate a parser outcome)
 *
 * ```ts
 * import { ParseOutcome } from "@/schema/Text"
 * import { DocumentId } from "@/schema/Ids"
 * import type { ParseOutcome as ParseOutcomeValue } from "@/schema/Text"
 *
 * const outcome: ParseOutcomeValue = ParseOutcome.cases.Degraded.make({
 *   outcome: "Degraded",
 *   document: DocumentId.make("0".repeat(64)),
 *   kind: "truncated",
 *   detail: "Input ended early."
 * })
 * console.log(outcome.outcome) // "Degraded"
 * ```
 *
 * @see {@link ParseOutcome} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type ParseOutcome = typeof ParseOutcome.Type;

/**
 * Canonical text reusing the file-processing resolved-source model.
 *
 * **Example** (Annotate canonical text)
 *
 * ```ts
 * import type { CanonicalText } from "@/schema/Text"
 *
 * const inspect = (canonical: CanonicalText) => canonical.text
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @see {@link ResolvedSourceText} for the shared schema.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalText = ResolvedSourceText;

/**
 * Schema-derived guard for canonical resolved source text.
 *
 * **Example** (Reject an incomplete value)
 *
 * ```ts
 * import { isCanonicalText } from "@/schema/Text"
 *
 * console.log(isCanonicalText({ text: "missing identity" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCanonicalText = S.is(ResolvedSourceText);

/**
 * Structural units produced by the deterministic C0 chunker.
 *
 * **Example** (Check a sentence chunk)
 *
 * ```ts
 * import { ChunkKind } from "@/schema/Text"
 *
 * console.log(ChunkKind.is.sentence("sentence")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChunkKind = LiteralKit(["heading", "paragraph", "sentence"]).pipe(
  $I.annoteSchema("ChunkKind", {
    description: "Heading, paragraph, and sentence units emitted by the C0 chunker.",
  })
);

/**
 * Decoded chunk kind.
 *
 * **Example** (Annotate a chunk kind)
 *
 * ```ts
 * import type { ChunkKind } from "@/schema/Text"
 *
 * const kind: ChunkKind = "sentence"
 * console.log(kind) // "sentence"
 * ```
 *
 * @see {@link ChunkKind} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type ChunkKind = typeof ChunkKind.Type;

const ChunkFields = S.Struct({
  id: ChunkId,
  document: DocumentId,
  kind: ChunkKind,
  ordinal: NonNegativeInt,
  anchor: TextAnchor,
  receipt: TextAnchorVerificationReceipt,
});

const ChunkIdPreimage = S.Struct({
  document: DocumentId,
  textDigest: SourceTextDigest,
  startChar: NonNegativeInt,
  endChar: NonNegativeInt,
}).pipe(SchemaUtils.withResultCodecStatics);

type ChunkIdSource = Pick<typeof ChunkFields.Type, "anchor" | "document" | "receipt">;

/**
 * Schema-encodes the canonical content preimage for a chunk id.
 *
 * **Example** (Inspect the preimage builder)
 *
 * ```ts
 * import { chunkIdPreimage } from "@/schema/Text"
 *
 * console.log(typeof chunkIdPreimage) // "function"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const chunkIdPreimage = (chunk: ChunkIdSource): Result.Result<typeof ChunkIdPreimage.Encoded, S.SchemaError> =>
  ChunkIdPreimage.encodeResult({
    document: chunk.document,
    textDigest: chunk.receipt.source.textDigest,
    startChar: chunk.anchor.startChar,
    endChar: chunk.anchor.endChar,
  });

/**
 * Builds the content-addressed id for a canonical-text chunk.
 *
 * **Example** (Inspect the chunk id builder)
 *
 * ```ts
 * import { makeChunkId } from "@/schema/Text"
 *
 * console.log(typeof makeChunkId) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeChunkId = (chunk: ChunkIdSource): Result.Result<ChunkId, S.SchemaError> =>
  Result.map(chunkIdPreimage(chunk), (preimage) => ChunkId.make(sha256CanonicalSync(preimage)));

const ChunkReceiptCheck = S.makeFilter(
  (chunk: typeof ChunkFields.Type) => S.toEquivalence(TextAnchor)(chunk.anchor, chunk.receipt.anchor),
  {
    identifier: $I`ChunkReceiptCheck`,
    title: "Chunk anchor receipt",
    description: "Requires the persisted verification receipt to contain the chunk's exact anchor.",
    message: "Chunk receipt.anchor must equal anchor.",
  }
);

const ChunkReceiptSourceCheck = S.makeFilter(
  (chunk: typeof ChunkFields.Type) => Str.Equivalence(chunk.receipt.source.sourceRef, chunk.document),
  {
    identifier: $I`ChunkReceiptSourceCheck`,
    title: "Chunk receipt source document",
    description: "Requires the receipt source identity to name the chunk's document.",
    message: "Chunk receipt.source.sourceRef must equal document.",
  }
);

const ChunkIdentityCheck = S.makeFilter(
  (chunk: typeof ChunkFields.Type) =>
    makeChunkId(chunk).pipe(
      Result.match({
        onFailure: () => false,
        onSuccess: (id) => Str.Equivalence(id, chunk.id),
      })
    ),
  {
    identifier: $I`ChunkIdentityCheck`,
    title: "Chunk content identity",
    description: "Requires id to hash the canonical encoded document, text digest, and anchor offsets.",
    message: "Chunk id must match the canonical chunk preimage digest.",
  }
);

const ChunkChecks = S.makeFilterGroup([ChunkReceiptCheck, ChunkReceiptSourceCheck, ChunkIdentityCheck], {
  identifier: $I`ChunkChecks`,
  title: "Chunk",
  description: "Checks the anchor receipt, source-document binding, and canonical content identity of a chunk.",
  message: "Chunk must have a matching receipt, source document, and content id.",
});

/**
 * Document-scoped canonical-text chunk with a verified anchor receipt.
 *
 * **Example** (Inspect the anchor field)
 *
 * ```ts
 * import { Chunk } from "@/schema/Text"
 *
 * console.log(Chunk.fields.anchor !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Chunk extends S.Class<Chunk>($I`Chunk`)(
  ChunkFields.mapFields(identity).check(ChunkChecks),
  $I.annote("Chunk", {
    description: "Document-scoped chunk whose exact text anchor has a persisted verification receipt.",
  })
) {}
