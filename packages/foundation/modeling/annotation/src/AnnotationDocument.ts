/**
 * Annotation documents: the schema ingredients of a caller-owned document over
 * one text capture, its pure checks, and its one checked codec.
 *
 * **Details**
 *
 * A document holds its capture (`text`), an anchors table keyed by occurrence
 * id, an annotations table keyed by annotation id, and attribution keyed by
 * annotation id with one {@link Generation} per activity. The schema checks
 * what needs no hash; {@link makeDocumentCodec} adds the key verification
 * that does, refuses a repeated key, writes one canonical JSON form, and
 * assembles a document from unkeyed parts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import { ContentHash } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { constFalse } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AnnotationId, AnnotationTargets } from "./AnnotationId.ts";
import { Generation, mintRunEntityId } from "./Generation.ts";
import { canonicalDocumentJson, decodeEnvelope, refuseRepeatedKeys } from "./internal/DocumentJson.ts";
import { mintAnnotationId } from "./Kind.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { ActivityId } from "@beep/schema/ContentHash";
import type * as Digest from "effect/crypto/Digest";
import type * as DateTime from "effect/DateTime";
import type { DocumentEnvelope } from "./internal/DocumentJson.ts";
import type { Annotation, ClosedKindRegistry, KindRegistry } from "./Kind.ts";

const $I = $AnnotationId.create("AnnotationDocument");

const sameCapture = S.toEquivalence(SourceTextIdentity);

const annotationDocumentView = S.Struct({
  text: SourceTextIdentity,
  anchors: S.HashMap(OccurrenceId, Anchored),
  annotations: S.HashMap(AnnotationId, S.Struct({ _tag: S.String, targets: AnnotationTargets, body: S.Unknown })),
  attribution: S.HashMap(AnnotationId, S.HashSet(Generation)),
}).pipe(
  $I.annoteSchema("AnnotationDocumentView", {
    description: "The kind-independent view of an annotation document over one text capture.",
  })
);

/**
 * The kind-independent view every document built from
 * {@link makeAnnotationDocument} satisfies: annotations are read as
 * `{ _tag, targets, body }` with the body unread.
 *
 * **Gotchas**
 *
 * Only the type is exported, not a schema: a branded schema would be
 * nominal, and no caller-owned document would satisfy it.
 *
 * **Example** (Read the capture of a document)
 *
 * ```ts
 * import type { AnnotationDocumentView } from "@beep/annotation/AnnotationDocument"
 *
 * const scopeOf = (document: AnnotationDocumentView) => document.text.scopeRef
 * console.log(typeof scopeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AnnotationDocumentView = typeof annotationDocumentView.Type;

const everyTargetResolves = (document: AnnotationDocumentView): boolean =>
  HashMap.every(document.annotations, (annotation) =>
    HashSet.every(annotation.targets, (target) => HashMap.has(document.anchors, target))
  );

const everyAnnotationAttributed = (document: AnnotationDocumentView): boolean =>
  HashMap.every(document.annotations, (_, id) =>
    O.exists(HashMap.get(document.attribution, id), (generations) => !HashSet.isEmpty(generations))
  );

const everyAnchorOnCapture = (document: AnnotationDocumentView): boolean =>
  HashMap.every(document.anchors, (anchored) => sameCapture(Anchored.source(anchored), document.text));

const attributionWellKeyed = (document: AnnotationDocumentView): boolean =>
  HashMap.every(
    document.attribution,
    (generations, id) =>
      HashMap.has(document.annotations, id) &&
      HashSet.every(generations, (generation) => Eq.equals(generation.content, id)) &&
      HashSet.size(HashSet.map(generations, (generation) => generation.activity)) === HashSet.size(generations)
  );

/**
 * The pure document checks: every target has an anchors row, every
 * annotation is attributed, every anchor's receipt names the capture, and
 * attribution is keyed by annotation with one generation per activity.
 *
 * **Details**
 *
 * Whether a key is the hash of its value needs the digest service, so the
 * checked decode of {@link makeDocumentCodec} verifies keys after these
 * checks pass.
 *
 * **Example** (Check a document with the group)
 *
 * ```ts
 * import { AnnotationDocumentChecks } from "@beep/annotation/AnnotationDocument"
 * import { TextDocument } from "@beep/annotation/Kinds"
 *
 * const Checked = TextDocument.check(AnnotationDocumentChecks)
 * console.log(Checked.ast._tag)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AnnotationDocumentChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      everyTargetResolves,
      $I.annote("EveryTargetResolves", {
        title: "Every Target Resolves",
        description: "Every annotation target has a row in the anchors table.",
        message: "Expected every annotation target to resolve in anchors.",
      })
    ),
    S.makeFilter(
      everyAnnotationAttributed,
      $I.annote("EveryAnnotationAttributed", {
        title: "Every Annotation Attributed",
        description: "Every annotation has a non-empty generation set.",
        message: "Expected a non-empty attribution for every annotation.",
      })
    ),
    S.makeFilter(
      everyAnchorOnCapture,
      $I.annote("EveryAnchorOnCapture", {
        title: "Every Anchor On Capture",
        description: "Every anchors row carries a receipt whose source is the document's capture.",
        message: "Expected every anchor receipt to name the document's capture.",
      })
    ),
    S.makeFilter(
      attributionWellKeyed,
      $I.annote("AttributionWellKeyed", {
        title: "Attribution Well Keyed",
        description: "Attribution keys are annotations, each generation names its key, one generation per activity.",
        message: "Expected attribution keyed by annotation with one generation per (content, activity).",
      })
    ),
  ],
  $I.annote("AnnotationDocumentChecks", { description: "The pure invariants of an annotation document." })
);

/**
 * Whether every annotation id a body references names an annotation of the
 * document whose kind the referencing kind may reference.
 *
 * **Example** (Check the references of a document)
 *
 * ```ts
 * import { referencesResolve } from "@beep/annotation/AnnotationDocument"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 *
 * const resolves = referencesResolve(DocumentKinds)
 * console.log(typeof resolves)
 * ```
 *
 * @param kinds - The registry the document's annotations belong to.
 * @returns A predicate over documents.
 * @category validation
 * @since 0.0.0
 */
export const referencesResolve =
  (kinds: KindRegistry) =>
  (document: AnnotationDocumentView): boolean =>
    HashMap.every(document.annotations, (annotation) =>
      O.match(R.get(kinds, annotation._tag), {
        onNone: constFalse,
        onSome: (kind) =>
          A.every(A.fromIterable(kind.referencedIds(annotation.body)), (id) =>
            O.exists(HashMap.get(document.annotations, id), (referenced) =>
              A.contains(kind.references, referenced._tag)
            )
          ),
      })
    );

const referencesResolveCheck = (kinds: KindRegistry) =>
  S.makeFilter(
    referencesResolve(kinds),
    $I.annote("ReferencesResolve", {
      title: "References Resolve",
      description: "Every referenced annotation id resolves to an annotation of an allowed kind in the document.",
      message: "Expected every body reference to resolve to an annotation of an allowed kind.",
    })
  );

/**
 * Schema ingredients of a caller-owned annotation document over a closed kind
 * registry: the annotation union, the four fields and the checks.
 *
 * **Details**
 *
 * The caller wraps `fields` in its own annotated `S.Opaque` struct and
 * applies `checks`, which hold {@link AnnotationDocumentChecks} and the
 * registry's {@link referencesResolve}.
 *
 * **Example** (Build a document schema over the OA kinds)
 *
 * ```ts
 * import { makeAnnotationDocument } from "@beep/annotation/AnnotationDocument"
 * import { OaKinds } from "@beep/annotation/Kinds"
 * import * as S from "effect/Schema"
 *
 * const parts = makeAnnotationDocument(OaKinds)
 * const Document = S.Struct(parts.fields).check(parts.checks)
 * console.log(Document.ast._tag)
 * ```
 *
 * @param kinds - A closed kind registry.
 * @returns The annotation union, the document fields and the document checks.
 * @category constructors
 * @since 0.0.0
 */
export const makeAnnotationDocument = <const Kinds extends KindRegistry & ClosedKindRegistry<Kinds>>(kinds: Kinds) => {
  const cases: ReadonlyArray<Kinds[keyof Kinds & string]["case"]> = A.map(R.values(kinds), (kind) => kind.case);
  const Annotation = S.Union(cases);
  return {
    Annotation,
    fields: {
      text: SourceTextIdentity,
      anchors: S.HashMap(OccurrenceId, Anchored),
      annotations: S.HashMap(AnnotationId, Annotation),
      attribution: S.HashMap(AnnotationId, S.HashSet(Generation)),
    },
    checks: S.makeFilterGroup(
      [AnnotationDocumentChecks, referencesResolveCheck(kinds)],
      $I.annote("AnnotationDocumentAllChecks", {
        description: "The pure document invariants plus body reference resolution.",
      })
    ),
  };
};

/**
 * **Example** (Check a table name)
 *
 * ```ts import.meta.vitest name="Check a table name"
 * import { DocumentTable } from "@beep/annotation/AnnotationDocument"
 * import * as S from "effect/Schema"
 *
 * S.is(DocumentTable)("anchors") // => true
 * S.is(DocumentTable)("text") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentTable = LiteralKit(["anchors", "annotations", "attribution"]).pipe(
  $I.annoteSchema("DocumentTable", { description: "A keyed table of an annotation document." })
);

/**
 * **Example** (Name a table)
 *
 * ```ts
 * import type { DocumentTable } from "@beep/annotation/AnnotationDocument"
 *
 * const table: DocumentTable = "attribution"
 * console.log(table)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentTable = typeof DocumentTable.Type;

/**
 * A stored key that is not the hash of its value: an anchors key that is not
 * the occurrence id of its row, an annotation key that is not the content id
 * of its annotation, or a generation whose run is not the hash of its pair.
 *
 * **Example** (Read the table)
 *
 * ```ts import.meta.vitest name="Read the mismatched table"
 * import { DocumentKeyMismatch } from "@beep/annotation/AnnotationDocument"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * const error = DocumentKeyMismatch.make({
 *   table: "annotations",
 *   key: ContentHash.make("sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"),
 * })
 * error.table // => "annotations"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentKeyMismatch extends S.TaggedError<DocumentKeyMismatch, { readonly brand: unique symbol }>(
  $I`DocumentKeyMismatch`
)(
  "DocumentKeyMismatch",
  { table: DocumentTable, key: ContentHash },
  $I.annoteError<DocumentKeyMismatch>("DocumentKeyMismatch", {
    description: "A document key that does not equal the content hash of its value.",
  })
) {}

/**
 * A key that appears twice in one table of a document's JSON. The bare schema
 * would keep the last entry and drop the first without notice.
 *
 * **Example** (Read the repeated key)
 *
 * ```ts import.meta.vitest name="Read the repeated key"
 * import { DocumentKeyRepeated } from "@beep/annotation/AnnotationDocument"
 *
 * const error = DocumentKeyRepeated.make({ table: "anchors", key: "sha256:aa" })
 * error.key // => "sha256:aa"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentKeyRepeated extends S.TaggedError<DocumentKeyRepeated, { readonly brand: unique symbol }>(
  $I`DocumentKeyRepeated`
)(
  "DocumentKeyRepeated",
  { table: DocumentTable, key: S.String },
  $I.annoteError<DocumentKeyRepeated>("DocumentKeyRepeated", {
    description: "A key that appears twice in one keyed table of a document's JSON.",
  })
) {}

/**
 * Why {@link makeDocumentCodec}'s `assemble` refused its parts.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts import.meta.vitest name="Check a refusal reason"
 * import { DocumentAssemblyRefusal } from "@beep/annotation/AnnotationDocument"
 * import * as S from "effect/Schema"
 *
 * S.is(DocumentAssemblyRefusal)("target-without-anchor") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentAssemblyRefusal = LiteralKit([
  "anchor-off-capture",
  "target-without-anchor",
  "reference-unresolved",
]).pipe(
  $I.annoteSchema("DocumentAssemblyRefusal", {
    description: "Why the parts of an annotation document do not make a document.",
  })
);

/**
 * **Example** (Name a refusal)
 *
 * ```ts
 * import type { DocumentAssemblyRefusal } from "@beep/annotation/AnnotationDocument"
 *
 * const reason: DocumentAssemblyRefusal = "anchor-off-capture"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentAssemblyRefusal = typeof DocumentAssemblyRefusal.Type;

/**
 * The parts given to `assemble` do not make a document: an anchor names
 * another capture, a target has no anchor, or a body reference names no
 * annotation of an allowed kind.
 *
 * **Example** (Read the reason)
 *
 * ```ts import.meta.vitest name="Read the assembly refusal"
 * import { DocumentAssemblyRefused } from "@beep/annotation/AnnotationDocument"
 *
 * DocumentAssemblyRefused.make({ reason: "reference-unresolved" }).reason // => "reference-unresolved"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentAssemblyRefused extends S.TaggedError<DocumentAssemblyRefused, { readonly brand: unique symbol }>(
  $I`DocumentAssemblyRefused`
)(
  "DocumentAssemblyRefused",
  { reason: DocumentAssemblyRefusal },
  $I.annoteError<DocumentAssemblyRefused>("DocumentAssemblyRefused", {
    description: "The parts of an annotation document do not make a document.",
  })
) {}

type AnnotationShape =
  AnnotationDocumentView["annotations"] extends HashMap.HashMap<AnnotationId, infer Value> ? Value : never;

const requireKey = (table: DocumentTable, key: ContentHash) => (minted: ContentHash) =>
  Eq.equals(minted, key) ? Effect.void : Effect.fail(DocumentKeyMismatch.make({ table, key }));

/**
 * The one codec of a caller-owned document schema: the checked decode, the
 * canonical encode, and the assembler.
 *
 * **Details**
 *
 * - `decode(input)` reads the JSON envelope, refuses a repeated key with
 *   {@link DocumentKeyRepeated}, decodes through the schema's JSON codec (the
 *   pure checks), then verifies that every key is the hash of its value, else
 *   {@link DocumentKeyMismatch}. It is the only decode path for document JSON
 *   from the wire or storage.
 * - `encode(document)` writes every table sorted by encoded key and every
 *   generation set sorted by run, so one document has one JSON form.
 * - `assemble(parts)` mints every key from a capture, one generation, anchors
 *   and annotations, refuses with {@link DocumentAssemblyRefused}, and
 *   validates the result through the schema's type side.
 *
 * **Gotchas**
 *
 * The bare schema stays exported for composition and generators. It accepts a
 * document whose keys were consistently forged; only `decode` refuses one.
 *
 * **Example** (Build the codec of the text document)
 *
 * ```ts
 * import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument"
 * import { DocumentKinds, TextDocument } from "@beep/annotation/Kinds"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const codec = makeDocumentCodec({ schema: TextDocument, kinds: DocumentKinds })
 * const reread = (json: unknown) =>
 *   codec.decode(json).pipe(Effect.flatMap(codec.encode), Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof reread)
 * ```
 *
 * @param config - The document schema and the kind registry its annotations belong to.
 * @returns The checked `decode`, the canonical `encode` and the `assemble` constructor.
 * @category constructors
 * @since 0.0.0
 */
export const makeDocumentCodec = <
  Document extends S.Top & {
    readonly Type: AnnotationDocumentView;
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
  Kinds extends KindRegistry,
>(config: {
  readonly schema: Document;
  readonly kinds: Kinds;
}) => {
  const json = S.toCodecJson(config.schema);
  const decodeJson = S.decodeUnknownEffect(json);
  const encodeJson = S.encodeEffect(json);
  const validate = S.decodeUnknownEffect(S.toType(config.schema));
  const mintAnnotation = mintAnnotationId(config.kinds);
  const assemblyChecks: ReadonlyArray<
    readonly [DocumentAssemblyRefusal, (document: AnnotationDocumentView) => boolean]
  > = [
    ["anchor-off-capture", everyAnchorOnCapture],
    ["target-without-anchor", everyTargetResolves],
    ["reference-unresolved", referencesResolve(config.kinds)],
  ];

  const verify = Effect.fnUntraced(function* (
    document: AnnotationDocumentView
  ): Effect.fn.Return<void, DocumentKeyMismatch | PreimageMintError, Digest.Digest> {
    yield* Effect.forEach(
      HashMap.toEntries(document.anchors),
      ([key, anchored]) => Effect.flatMap(mintOccurrenceId(anchored), requireKey("anchors", key)),
      { concurrency: 1, discard: true }
    );
    yield* Effect.forEach(
      HashMap.toEntries(document.annotations),
      ([key, annotation]) => Effect.flatMap(mintAnnotation(annotation), requireKey("annotations", key)),
      { concurrency: 1, discard: true }
    );
    yield* Effect.forEach(
      A.flatMap(HashMap.toValues(document.attribution), A.fromIterable),
      (generation) =>
        Effect.flatMap(
          mintRunEntityId(generation.content, generation.activity),
          requireKey("attribution", generation.run)
        ),
      { concurrency: 1, discard: true }
    );
  });

  const decode = Effect.fn("AnnotationDocument.decodeChecked")(function* (
    input: unknown
  ): Effect.fn.Return<
    Document["Type"],
    S.SchemaError | DocumentKeyRepeated | DocumentKeyMismatch | PreimageMintError,
    Digest.Digest
  > {
    const envelope = yield* decodeEnvelope(input);
    yield* O.match(refuseRepeatedKeys(envelope), {
      onNone: () => Effect.void,
      onSome: (repeated) => Effect.fail(DocumentKeyRepeated.make(repeated)),
    });
    const document = yield* decodeJson(input);
    yield* verify(document);
    return document;
  });

  const encode = Effect.fn("AnnotationDocument.encode")(function* (
    document: Document["Type"]
  ): Effect.fn.Return<DocumentEnvelope, S.SchemaError> {
    const encoded = yield* encodeJson(document);
    const envelope = yield* Effect.orDie(decodeEnvelope(encoded));
    return canonicalDocumentJson(envelope);
  });

  const assemble = Effect.fn("AnnotationDocument.assemble")(function* (parts: {
    readonly text: SourceTextIdentity;
    readonly generation: { readonly activity: ActivityId; readonly at: O.Option<DateTime.Utc> };
    readonly anchors: Iterable<Anchored>;
    readonly annotations: Iterable<Annotation<Kinds> & AnnotationShape>;
  }): Effect.fn.Return<Document["Type"], DocumentAssemblyRefused | PreimageMintError, Digest.Digest> {
    const anchorRows = A.fromIterable(parts.anchors);
    const occurrenceIds = yield* Effect.forEach(anchorRows, mintOccurrenceId, { concurrency: 1 });
    const rows = A.fromIterable(parts.annotations);
    const annotationIds = yield* Effect.forEach(rows, mintAnnotation, { concurrency: 1 });
    const { activity, at } = parts.generation;
    const generations = yield* Effect.forEach(
      annotationIds,
      (content) =>
        Effect.map(
          mintRunEntityId(content, activity),
          (run) => [content, HashSet.make(Generation.make({ run, content, activity, at }))] as const
        ),
      { concurrency: 1 }
    );
    const candidate = {
      text: parts.text,
      anchors: HashMap.fromIterable(A.zip(occurrenceIds, anchorRows)),
      annotations: HashMap.fromIterable(A.zip(annotationIds, rows)),
      attribution: HashMap.fromIterable(generations),
    };
    const refusal = A.findFirst(assemblyChecks, ([reason, holds]) => (holds(candidate) ? O.none() : O.some(reason)));
    return yield* O.match(refusal, {
      onNone: () => validate(candidate),
      onSome: (reason) => Effect.fail(DocumentAssemblyRefused.make({ reason })),
    });
  });

  return { decode, encode, assemble };
};
