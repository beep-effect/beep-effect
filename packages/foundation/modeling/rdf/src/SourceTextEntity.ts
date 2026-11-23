/**
 * The interchange projection of a source-text identity: a `prov:Entity` at the
 * instance IRI of its capture id, with its kept fields on `text:` predicates.
 *
 * **Details**
 *
 * The scope reference is never written. A reader supplies it on decode, the
 * capture id is minted again from the decoded fields and that scope, and the
 * result must name the entity's subject.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RdfId } from "@beep/identity/packages";
import { iri } from "@beep/identity/Registry";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { mintCaptureId } from "@beep/text/Capture";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { instanceIri } from "./InstanceIri.ts";
import { Entity, ObjectRef, ProvBundle } from "./Prov.ts";
import { provBundleToDataset } from "./ProvRdf.ts";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "./Rdf.ts";
import { RDF_TYPE } from "./Vocab/Rdf.ts";
import type { ProvRdfCodecError } from "./ProvRdf.ts";
import type { Dataset, NamedNode, ObjectTerm, Quad, Subject } from "./Rdf.ts";

const $I = $RdfId.create("SourceTextEntity");

/**
 * Why a dataset was refused as a source-text entity.
 *
 * **Details**
 *
 * `integrityMismatch` covers a tampered or malformed kept field and a decode
 * under another scope: the minted capture id no longer names the subject.
 *
 * **Example** (Read a refusal reason)
 *
 * ```ts import.meta.vitest name="Read a refusal reason"
 * import { SourceTextEntityRefusalReason } from "@beep/rdf/SourceTextEntity"
 *
 * SourceTextEntityRefusalReason.is.unknownQuad("unknownQuad") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SourceTextEntityRefusalReason = LiteralKit([
  "missingField",
  "duplicateField",
  "unknownQuad",
  "notACapture",
  "integrityMismatch",
]).pipe(
  $I.annoteSchema("SourceTextEntityRefusalReason", {
    description: "Why a dataset was refused as the interchange projection of a source-text identity.",
  })
);

/**
 * Decoded type of {@link SourceTextEntityRefusalReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type SourceTextEntityRefusalReason = typeof SourceTextEntityRefusalReason.Type;

/**
 * A dataset is not the projection of a source-text identity under the
 * reader's scope.
 *
 * **Example** (Describe a refusal)
 *
 * ```ts import.meta.vitest name="Describe a refusal"
 * import { SourceTextEntityRefused } from "@beep/rdf/SourceTextEntity"
 *
 * SourceTextEntityRefused.make({ reason: "missingField" }).reason // => "missingField"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SourceTextEntityRefused extends S.TaggedError<SourceTextEntityRefused, { readonly brand: unique symbol }>(
  $I`SourceTextEntityRefused`
)(
  "SourceTextEntityRefused",
  {
    reason: SourceTextEntityRefusalReason,
  },
  $I.annoteError<SourceTextEntityRefused>("SourceTextEntityRefused", {
    description: "A dataset is not the prov:Entity projection of a source-text identity under the reader's scope.",
  })
) {}

/**
 * The error channel of both projection directions.
 *
 * @category errors
 * @since 0.0.0
 */
export type SourceTextEntityError =
  | SourceTextEntityRefused
  | Effect.Error<ReturnType<typeof mintCaptureId>>
  | ProvRdfCodecError;

const captureClass = makeNamedNode(iri("text:SourceTextCapture"));

const keptPredicates = {
  sourceRef: makeNamedNode(iri("text:sourceRef")),
  locator: makeNamedNode(iri("text:locator")),
  sourceDigest: makeNamedNode(iri("text:sourceDigest")),
  textDigest: makeNamedNode(iri("text:textDigest")),
  extractorName: makeNamedNode(iri("text:extractorName")),
  extractorVersion: makeNamedNode(iri("text:extractorVersion")),
  normalizationVersion: makeNamedNode(iri("text:normalizationVersion")),
};

const keptFields = (identity: SourceTextIdentity): ReadonlyArray<readonly [NamedNode, string]> => [
  [keptPredicates.sourceRef, identity.sourceRef],
  [keptPredicates.locator, identity.locator],
  [keptPredicates.sourceDigest, identity.sourceDigest],
  [keptPredicates.textDigest, identity.textDigest],
  [keptPredicates.extractorName, identity.extractor.name],
  [keptPredicates.extractorVersion, identity.extractor.version],
  [keptPredicates.normalizationVersion, identity.normalizationVersion],
];

const refused = (reason: SourceTextEntityRefusalReason): SourceTextEntityRefused =>
  SourceTextEntityRefused.make({ reason });

const decodeIdentity = S.decodeUnknownEffect(SourceTextIdentity);

const decodeObjectRef = S.decodeEffect(ObjectRef);

const isCaptureType = (quad: Quad): boolean =>
  quad.predicate.value === RDF_TYPE.value &&
  quad.object.termType === "NamedNode" &&
  quad.object.value === captureClass.value;

const captureSubject = (quads: ReadonlyArray<Quad>): Result.Result<Subject, SourceTextEntityRefused> =>
  pipe(
    A.filter(quads, isCaptureType),
    A.map((quad) => quad.subject),
    A.match({
      onEmpty: () => Result.fail(refused("notACapture")),
      onNonEmpty: (subjects) =>
        subjects.length === 1 ? Result.succeed(A.headNonEmpty(subjects)) : Result.fail(refused("notACapture")),
    })
  );

const simpleValue = (object: ObjectTerm): Result.Result<string, SourceTextEntityRefused> =>
  object.termType === "Literal" && object.form._tag === "Simple"
    ? Result.succeed(object.value)
    : Result.fail(refused("integrityMismatch"));

const keptValue =
  (quads: ReadonlyArray<Quad>, subject: Subject) =>
  (predicate: NamedNode): Result.Result<string, SourceTextEntityRefused> =>
    pipe(
      A.filter(
        quads,
        (quad) =>
          quad.subject.termType === subject.termType &&
          quad.subject.value === subject.value &&
          quad.predicate.value === predicate.value
      ),
      A.match({
        onEmpty: () => Result.fail(refused("missingField")),
        onNonEmpty: (matches) =>
          matches.length === 1 ? simpleValue(A.headNonEmpty(matches).object) : Result.fail(refused("duplicateField")),
      })
    );

/**
 * Project a source-text identity to its `prov:Entity` dataset.
 *
 * **Example** (Project an identity)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import { toDataset } from "@beep/rdf/SourceTextEntity"
 * import { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(SourceTextIdentity)({
 *   scopeRef: "matter:example",
 *   sourceRef: "source:example",
 *   locator: "documents/source.txt",
 *   sourceDigest: `sha256:${"a".repeat(64)}`,
 *   textDigest: `sha256:${"b".repeat(64)}`,
 *   extractor: { name: "utf8", version: "1" },
 *   normalizationVersion: "1"
 * })
 *
 * Effect.runPromise(toDataset(identity).pipe(Effect.provide(Digest.layerWebCrypto))).then((dataset) =>
 *   console.log(HashSet.size(dataset.quads)) // 9
 * )
 * ```
 *
 * @param identity - The identity to project; its scope reference is not written.
 * @returns The entity record and its kept fields as one dataset.
 * @category serialization
 * @since 0.0.0
 */
export const toDataset = Effect.fn("SourceTextEntity.toDataset")(function* (identity: SourceTextIdentity) {
  const captureId = yield* mintCaptureId(identity);
  const subjectIri = instanceIri(captureId);
  const subject = makeNamedNode(subjectIri);
  const entityId = yield* decodeObjectRef(subjectIri);
  const entity = yield* Effect.fromResult(
    provBundleToDataset(ProvBundle.make({ records: [Entity.make({ id: O.some(entityId) })] }))
  );
  const kept = A.map(keptFields(identity), ([predicate, value]) => makeQuad(subject, predicate, makeLiteral(value)));
  return makeDataset([...entity.quads, makeQuad(subject, RDF_TYPE, captureClass), ...kept]);
});

/**
 * Read a source-text identity back from its `prov:Entity` dataset under the
 * reader's scope.
 *
 * **Details**
 *
 * The decoder refuses a dataset with no single capture subject, a missing or
 * repeated kept field, a capture id that does not name the subject, and any
 * quad the projection of the decoded identity would not write.
 *
 * **Example** (Round-trip an identity)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { fromDataset, toDataset } from "@beep/rdf/SourceTextEntity"
 * import { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(SourceTextIdentity)({
 *   scopeRef: "matter:example",
 *   sourceRef: "source:example",
 *   locator: "documents/source.txt",
 *   sourceDigest: `sha256:${"a".repeat(64)}`,
 *   textDigest: `sha256:${"b".repeat(64)}`,
 *   extractor: { name: "utf8", version: "1" },
 *   normalizationVersion: "1"
 * })
 *
 * const program = toDataset(identity).pipe(Effect.flatMap(fromDataset("matter:example")))
 *
 * Effect.runPromise(program.pipe(Effect.provide(Digest.layerWebCrypto))).then((decoded) =>
 *   console.log(decoded.sourceRef) // source:example
 * )
 * ```
 *
 * @param scopeRef - The scope the reader decodes under.
 * @returns A decoder from a dataset to the identity it projects.
 * @category serialization
 * @since 0.0.0
 */
export const fromDataset = (scopeRef: string) =>
  Effect.fn("SourceTextEntity.fromDataset")(function* (dataset: Dataset) {
    const quads = A.fromIterable(dataset.quads);
    const subject = yield* Effect.fromResult(captureSubject(quads));
    const field = keptValue(quads, subject);
    const values = yield* Effect.fromResult(
      Result.all({
        sourceRef: field(keptPredicates.sourceRef),
        locator: field(keptPredicates.locator),
        sourceDigest: field(keptPredicates.sourceDigest),
        textDigest: field(keptPredicates.textDigest),
        extractorName: field(keptPredicates.extractorName),
        extractorVersion: field(keptPredicates.extractorVersion),
        normalizationVersion: field(keptPredicates.normalizationVersion),
      })
    );
    const identity = yield* decodeIdentity({
      scopeRef,
      sourceRef: values.sourceRef,
      locator: values.locator,
      sourceDigest: values.sourceDigest,
      textDigest: values.textDigest,
      extractor: { name: values.extractorName, version: values.extractorVersion },
      normalizationVersion: values.normalizationVersion,
    }).pipe(Effect.mapError(() => refused("integrityMismatch")));
    const captureId = yield* mintCaptureId(identity);
    if (instanceIri(captureId) !== subject.value) {
      return yield* refused("integrityMismatch");
    }
    const expected = yield* toDataset(identity);
    if (HashSet.size(HashSet.difference(dataset.quads, expected.quads)) > 0) {
      return yield* refused("unknownQuad");
    }
    if (HashSet.size(HashSet.difference(expected.quads, dataset.quads)) > 0) {
      return yield* refused("missingField");
    }
    return identity;
  });
