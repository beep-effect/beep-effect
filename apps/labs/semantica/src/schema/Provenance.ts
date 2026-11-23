import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { SourceTextExtractor } from "@beep/text";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { DegradedKind } from "@/schema/Degraded";
import { contentDigestSync } from "@/schema/Digest";
import { BatchId, ChunkId, ClaimId, DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/Provenance");

const ParseEventOutcome = LiteralKit(["parsed", ...DegradedKind.literals]);

class IngestedEventBody extends S.Opaque<IngestedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Ingested"),
    document: DocumentId,
  }).pipe(
    $I.annoteSchema("IngestedEventBody", {
      description: "Records ingestion of one exact source document.",
    })
  )
) {}

class ParsedEventBody extends S.Opaque<ParsedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Parsed"),
    document: DocumentId,
    outcome: ParseEventOutcome,
    extractor: SourceTextExtractor,
  }).pipe(
    $I.annoteSchema("ParsedEventBody", {
      description: "Records the typed parser outcome and pinned extractor for a document.",
    })
  )
) {}

class ChunkedEventBody extends S.Opaque<ChunkedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Chunked"),
    document: DocumentId,
    chunks: S.Array(ChunkId),
  }).pipe(
    $I.annoteSchema("ChunkedEventBody", {
      description: "Records the ordered content-addressed chunks emitted for a document.",
    })
  )
) {}

class ExtractedEventBody extends S.Opaque<ExtractedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Extracted"),
    batch: BatchId,
    model: ModelIdentity,
  }).pipe(
    $I.annoteSchema("ExtractedEventBody", {
      description: "Records one extraction batch and the pinned model that produced it.",
    })
  )
) {}

class AssertedEventBody extends S.Opaque<AssertedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Asserted"),
    claims: S.Array(ClaimId),
  }).pipe(
    $I.annoteSchema("AssertedEventBody", {
      description: "Records evidence claims asserted into the append-only ledger.",
    })
  )
) {}

class InvalidatedEventBody extends S.Opaque<InvalidatedEventBody, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Invalidated"),
    claim: ClaimId,
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("InvalidatedEventBody", {
      description: "Records a reasoned tombstone for an evidence claim without deleting it.",
    })
  )
) {}

const EventKind = LiteralKit(["Ingested", "Parsed", "Chunked", "Extracted", "Asserted", "Invalidated"]);

/**
 * Timestamp-free body of one append-only provenance event.
 *
 * **Example** (Create an ingest event body)
 *
 * ```ts
 * import { EventBody } from "@/schema/Provenance"
 * import { DocumentId } from "@/schema/Ids"
 *
 * const body = EventBody.cases.Ingested.make({
 *   kind: "Ingested",
 *   document: DocumentId.make("0".repeat(64))
 * })
 * console.log(body.kind) // "Ingested"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EventBody = EventKind.mapMembers(
  Tuple.evolve([
    () => IngestedEventBody,
    () => ParsedEventBody,
    () => ChunkedEventBody,
    () => ExtractedEventBody,
    () => AssertedEventBody,
    () => InvalidatedEventBody,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("EventBody", {
    description: "Exhaustive timestamp-free C0 provenance event bodies.",
  })
);

/**
 * Decoded provenance event body.
 *
 * **Example** (Inspect an event body type)
 *
 * ```ts
 * import type { EventBody } from "@/schema/Provenance"
 *
 * const inspect = (body: EventBody) => body.kind
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @see {@link EventBody} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type EventBody = typeof EventBody.Type;

const ProvenanceEventPreimage = S.Struct({
  prev: S.OptionFromNullOr(ProvenanceEventId),
  body: EventBody,
});

const ProvenanceEventFields = S.Struct({
  id: ProvenanceEventId,
  prev: S.OptionFromNullOr(ProvenanceEventId),
  body: EventBody,
});

type ProvenanceEventIdSource = typeof ProvenanceEventPreimage.Type;

/**
 * Builds the content-addressed id for one timestamp-free provenance event.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { makeProvenanceEventId } from "@/schema/Provenance"
 *
 * console.log(typeof makeProvenanceEventId) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeProvenanceEventId = (
  event: ProvenanceEventIdSource
): Result.Result<ProvenanceEventId, S.SchemaError> =>
  Result.map(contentDigestSync(ProvenanceEventPreimage)(event), ProvenanceEventId.make);

const ProvenanceEventIdCheck = S.makeFilter(
  (event: typeof ProvenanceEventFields.Type) =>
    contentDigestSync(ProvenanceEventPreimage)({
      prev: event.prev,
      body: event.body,
    }).pipe(
      Result.match({
        onFailure: () => false,
        onSuccess: (digest) => Str.Equivalence(digest, event.id),
      })
    ),
  $I.annote("ProvenanceEventIdCheck", {
    title: "Provenance event identity",
    description: "Requires id to hash canonical JSON of only prev and body, with no wall-clock field.",
    message: "ProvenanceEvent id must match the canonical prev-and-body digest.",
  })
);

/**
 * Content-addressed link in a timestamp-free provenance hash chain.
 *
 * **Example** (Inspect the optional predecessor)
 *
 * ```ts
 * import { ProvenanceEvent } from "@/schema/Provenance"
 *
 * console.log(ProvenanceEvent.fields.prev !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProvenanceEvent extends S.Opaque<ProvenanceEvent, { readonly brand: unique symbol }>()(
  ProvenanceEventFields.mapFields(identity)
    .check(ProvenanceEventIdCheck)
    .pipe(
      $I.annoteSchema("ProvenanceEvent", {
        description: "Replay-stable provenance event whose id hashes only its predecessor and typed body.",
      })
    )
) {}
