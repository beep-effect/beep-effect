/**
 * The JSON envelope of an annotation document: the three keyed tables as entry
 * arrays, read before the document schema so a repeated key is refused, and
 * sorted after the schema encode so one document has one byte form.
 *
 * @internal
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type { DocumentTable } from "../AnnotationDocument.ts";

const $I = $AnnotationId.create("internal/DocumentJson");

const Rest = [S.Record(S.String, S.Unknown)] as const;

const TableEntry = S.Tuple([S.String, S.Unknown]);

const GenerationJson = S.StructWithRest(S.Struct({ run: S.String }), Rest);

const AttributionEntry = S.Tuple([S.String, S.Array(GenerationJson)]);

// The document JSON as far as key handling needs it: every other field passes through unread.
const documentEnvelope = S.StructWithRest(
  S.Struct({
    anchors: S.Array(TableEntry),
    annotations: S.Array(TableEntry),
    attribution: S.Array(AttributionEntry),
  }),
  Rest
).pipe(
  $I.annoteSchema("DocumentEnvelope", {
    description: "The keyed tables of an encoded annotation document, as entry arrays.",
  })
);

/**
 * The document JSON as far as key handling needs it: the three keyed tables
 * as entry arrays, every other field unread.
 *
 * @internal
 * @since 0.0.0
 */
export type DocumentEnvelope = typeof documentEnvelope.Type;

/**
 * Decode unknown input as a document envelope.
 *
 * @internal
 * @since 0.0.0
 */
export const decodeEnvelope = (input: unknown): Effect.Effect<DocumentEnvelope, S.SchemaError> =>
  S.decodeUnknownEffect(documentEnvelope)(input);

const byKey = Order.mapInput(Order.String, (entry: readonly [string, unknown]) => entry[0]);

const byRun = Order.mapInput(Order.String, (generation: { readonly run: string }) => generation.run);

/**
 * Sort every table by its encoded key and every generation set by its run id.
 *
 * @internal
 * @since 0.0.0
 */
export const canonicalDocumentJson = (envelope: DocumentEnvelope): DocumentEnvelope => ({
  ...envelope,
  anchors: A.sort(envelope.anchors, byKey),
  annotations: A.sort(envelope.annotations, byKey),
  attribution: A.map(A.sort(envelope.attribution, byKey), ([key, generations]) => [key, A.sort(generations, byRun)]),
});

// The least key that appears twice, by sorting and comparing neighbours.
const repeatedIn = (entries: ReadonlyArray<readonly [string, unknown]>): O.Option<string> => {
  const keys = A.sort(
    A.map(entries, ([key]) => key),
    Order.String
  );
  return A.findFirst(A.zip(keys, A.drop(keys, 1)), ([key, next]) => (key === next ? O.some(key) : O.none()));
};

const tables: ReadonlyArray<DocumentTable> = ["anchors", "annotations", "attribution"];

/**
 * The first table, in the order anchors, annotations, attribution, that holds
 * a repeated key, with its least repeated key.
 *
 * @internal
 * @since 0.0.0
 */
export const refuseRepeatedKeys = (
  envelope: DocumentEnvelope
): O.Option<{ readonly table: DocumentTable; readonly key: string }> =>
  A.findFirst(tables, (table) => O.map(repeatedIn(envelope[table]), (key) => ({ table, key })));
