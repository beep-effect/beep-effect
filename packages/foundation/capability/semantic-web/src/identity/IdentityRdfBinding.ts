/**
 * Exact RDF dataset binding for identity registry entries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdentityEntry } from "@beep/identity";
import { $SemanticWebId } from "@beep/identity/packages";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad, NamedNode, ObjectTerm, Subject } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Effect, HashMap, pipe, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Dataset, Quad } from "@beep/rdf/Rdf";

const $I = $SemanticWebId.create("identity/IdentityRdfBinding");

const identifierPathIri = $SemanticWebId.create("identity/identifier").iri;
const curiePathIri = $SemanticWebId.create("identity/curie").iri;
const sameNamedNode = SchemaUtils.toEquivalence(NamedNode);
const sameSubject = SchemaUtils.toEquivalence(Subject);

const IdentityRdfBindingFields = S.Struct({
  identifierPath: NamedNode,
  curiePath: NamedNode,
  fiberPaths: S.Record(S.String, NamedNode),
});

const predicateEntries = (binding: typeof IdentityRdfBindingFields.Type): ReadonlyArray<readonly [string, NamedNode]> =>
  pipe(
    R.toEntries(binding.fiberPaths),
    A.map(([fiber, path]) => Tuple.make(`fiberPaths.${fiber}`, path)),
    A.prepend(Tuple.make("curiePath", binding.curiePath)),
    A.prepend(Tuple.make("identifierPath", binding.identifierPath))
  );

const predicateCollision = (binding: typeof IdentityRdfBindingFields.Type): O.Option<string> => {
  let seen = HashMap.empty<string, string>();

  for (const [label, path] of predicateEntries(binding)) {
    const previous = HashMap.get(seen, path.value);
    if (O.isSome(previous)) {
      return O.some(`${previous.value} and ${label} collide at RDF predicate '${path.value}'`);
    }
    seen = HashMap.set(seen, path.value, label);
  }

  return O.none();
};

const IdentityRdfPredicatePathsDistinct = S.makeFilter<typeof IdentityRdfBindingFields.Type>(
  (binding) =>
    pipe(
      predicateCollision(binding),
      O.match({
        onNone: () => true,
        onSome: (collision) => collision,
      })
    ),
  {
    identifier: $I`IdentityRdfPredicatePathsDistinct`,
    title: "Distinct Identity RDF Predicate Paths",
    description: "Requires identifier, CURIE, and fiber RDF predicate paths to be pairwise distinct.",
    message: "Identity RDF predicate paths must be pairwise distinct.",
  }
);

const CheckedIdentityRdfBindingFields = IdentityRdfBindingFields.pipe(S.check(IdentityRdfPredicatePathsDistinct));

/**
 * Explicit predicate binding for identity registry fields and named fibers.
 *
 * **Example** (Bind one identity fiber)
 *
 * ```ts
 * import { IdentityRdfBinding } from "@beep/semantic-web"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const binding = IdentityRdfBinding.make({
 *   identifierPath: makeNamedNode("https://example.com/identity"),
 *   curiePath: makeNamedNode("https://example.com/curie"),
 *   fiberPaths: { label: makeNamedNode("https://example.com/label") }
 * })
 * console.log(binding.fiberPaths.label.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentityRdfBinding extends S.Class<IdentityRdfBinding>($I`IdentityRdfBinding`)(
  CheckedIdentityRdfBindingFields,
  $I.annote("IdentityRdfBinding", {
    description: "Explicit RDF predicates for identity registry fields and named string fibers.",
  })
) {}

/**
 * Default identity and CURIE predicates with no implicit fiber predicates.
 *
 * **Details**
 *
 * Both predicates are taken from bound `@beep/semantic-web` identity composer
 * projections. Fiber predicates must always be supplied explicitly.
 *
 * **Example** (Inspect the default identifier predicate)
 *
 * ```ts
 * import { DefaultIdentityRdfBinding } from "@beep/semantic-web"
 *
 * console.log(DefaultIdentityRdfBinding.identifierPath.value)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DefaultIdentityRdfBinding: IdentityRdfBinding = IdentityRdfBinding.make({
  identifierPath: makeNamedNode(identifierPathIri),
  curiePath: makeNamedNode(curiePathIri),
  fiberPaths: R.empty<string, NamedNode>(),
});

/**
 * Failure returned when an identity fiber has no explicitly bound RDF predicate.
 *
 * **Example** (Identify an unmapped fiber)
 *
 * ```ts import.meta.vitest name="Identify an unmapped fiber"
 * import { IdentityFiberPathError } from "@beep/semantic-web"
 *
 * const error = IdentityFiberPathError.make({ fiber: "label" })
 * error._tag // => "IdentityFiberPathError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityFiberPathError extends S.TaggedError<IdentityFiberPathError>($I`IdentityFiberPathError`)(
  "IdentityFiberPathError",
  { fiber: S.String },
  $I.annoteError<IdentityFiberPathError>("IdentityFiberPathError", {
    description: "An identity fiber has no explicitly bound RDF predicate.",
  })
) {}

/**
 * Failure returned when an identity entry IRI cannot be decoded as an RDF named node.
 *
 * **Example** (Inspect an invalid entry IRI)
 *
 * ```ts import.meta.vitest name="Inspect an invalid entry IRI"
 * import { IdentityEntryIriError } from "@beep/semantic-web"
 *
 * const error = IdentityEntryIriError.make({
 *   identity: "@beep/example/Invalid",
 *   iri: "not an iri"
 * })
 * error.iri // => "not an iri"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityEntryIriError extends S.TaggedError<IdentityEntryIriError>($I`IdentityEntryIriError`)(
  "IdentityEntryIriError",
  { identity: S.String, iri: S.String },
  $I.annoteError<IdentityEntryIriError>("IdentityEntryIriError", {
    description: "An identity entry IRI cannot be decoded as an RDF named node.",
  })
) {}

/**
 * Failure returned when an RDF subject cannot be decoded as one exact identity entry.
 *
 * **Example** (Describe an invalid identity subject)
 *
 * ```ts
 * import { IdentityDatasetDecodeError } from "@beep/semantic-web"
 *
 * const error = IdentityDatasetDecodeError.make({
 *   subject: "_:identity",
 *   message: "Identity entry subjects must be named nodes."
 * })
 * console.log(error.subject)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityDatasetDecodeError extends S.TaggedError<IdentityDatasetDecodeError>(
  $I`IdentityDatasetDecodeError`
)(
  "IdentityDatasetDecodeError",
  { subject: S.String, message: S.String },
  $I.annoteError<IdentityDatasetDecodeError>("IdentityDatasetDecodeError", {
    description: "An RDF subject cannot be decoded as one exact identity registry entry.",
  })
) {}

/**
 * Decodes an identity entry's IRI as its RDF subject, failing typed instead of defecting.
 *
 * **Details**
 *
 * A schema-valid `IdentityEntry` only guarantees `iri` is a string; this is the single
 * boundary where that string becomes a `NamedNode`, shared by the dataset codec and the
 * SHACL projection so both surface `IdentityEntryIriError` for malformed IRIs.
 *
 * **Example** (Decode a registered entry's subject)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { IdentityEntry } from "@beep/identity"
 * import { decodeEntrySubject } from "@beep/semantic-web/identity/IdentityRdfBinding"
 *
 * const entry = IdentityEntry.make({
 *   identity: "@beep/semantic-web/Example",
 *   iri: "https://ns.beep.sh/semantic-web/Example",
 *   curie: "beep:semantic-web/Example",
 *   fibers: {}
 * })
 * const subject = Effect.runSync(decodeEntrySubject(entry))
 * console.log(subject.value)
 * ```
 *
 * @param entry - Registered identity entry whose `iri` becomes the subject.
 * @returns The entry's subject as an RDF named node.
 * @category codecs
 * @since 0.0.0
 */
export const decodeEntrySubject = Effect.fn("IdentityRdfBinding.decodeEntrySubject")(function* (entry: IdentityEntry) {
  return yield* NamedNode.decodeEffect({
    termType: "NamedNode",
    value: entry.iri,
  }).pipe(
    Effect.mapError(() =>
      IdentityEntryIriError.make({
        identity: entry.identity,
        iri: entry.iri,
      })
    )
  );
});

const literalAt = Effect.fn("IdentityRdfBinding.literalAt")(function* (
  subject: string,
  path: NamedNode,
  quads: ReadonlyArray<Quad>,
  cardinalityMessage: string
) {
  const matching = pipe(
    quads,
    A.filter(
      P.Struct({
        predicate: sameNamedNode(path),
      })
    )
  );

  const cardinalityError = () =>
    Effect.fail(
      IdentityDatasetDecodeError.make({
        subject,
        message: cardinalityMessage,
      })
    );
  const quad = yield* pipe(
    matching,
    A.match({
      onEmpty: cardinalityError,
      onNonEmpty: (found) => (A.length(found) === 1 ? Effect.succeed(A.headNonEmpty(found)) : cardinalityError()),
    })
  );

  return yield* ObjectTerm.match(quad.object, {
    BlankNode: () =>
      Effect.fail(
        IdentityDatasetDecodeError.make({
          subject,
          message: "Identity registry values must be plain string literals.",
        })
      ),
    NamedNode: () =>
      Effect.fail(
        IdentityDatasetDecodeError.make({
          subject,
          message: "Identity registry values must be plain string literals.",
        })
      ),
    Literal: (literal) =>
      sameNamedNode(literal.datatype, XSD_STRING) && O.isNone(literal.language)
        ? Effect.succeed(literal.value)
        : Effect.fail(
            IdentityDatasetDecodeError.make({
              subject,
              message: "Identity registry values must be plain string literals.",
            })
          ),
  });
});

const decodeSubject = Effect.fn("IdentityRdfBinding.decodeSubject")(function* (
  binding: IdentityRdfBinding,
  dataset: Dataset,
  subject: Subject
) {
  const subjectValue = yield* Subject.match(subject, {
    BlankNode: (blankNode) =>
      Effect.fail(
        IdentityDatasetDecodeError.make({
          subject: blankNode.value,
          message: "Identity entry subjects must be named nodes.",
        })
      ),
    NamedNode: (namedNode) => Effect.succeed(namedNode.value),
  });
  const quads = pipe(
    dataset.quads,
    A.filter(
      P.Struct({
        subject: sameSubject(subject),
      })
    )
  );
  const knownPaths = pipe(
    R.toEntries(binding.fiberPaths),
    A.map(([, path]) => path),
    A.prepend(binding.curiePath),
    A.prepend(binding.identifierPath)
  );
  const unknownPredicate = pipe(
    quads,
    A.findFirst(
      (quad) =>
        !pipe(
          knownPaths,
          A.some((path) => sameNamedNode(path, quad.predicate))
        )
    )
  );

  yield* pipe(
    unknownPredicate,
    O.match({
      onNone: () => Effect.void,
      onSome: () =>
        Effect.fail(
          IdentityDatasetDecodeError.make({
            subject: subjectValue,
            message: "Identity entry contains an unmapped RDF predicate.",
          })
        ),
    })
  );

  const identity = yield* literalAt(
    subjectValue,
    binding.identifierPath,
    quads,
    "Expected exactly one identity identifier literal."
  );
  const curie = yield* literalAt(
    subjectValue,
    binding.curiePath,
    quads,
    "Expected exactly one identity CURIE literal."
  );
  const decodedFibers = yield* Effect.forEach(R.toEntries(binding.fiberPaths), ([fiber, path]) => {
    const matching = pipe(quads, A.filter(P.Struct({ predicate: sameNamedNode(path) })));

    return A.match(matching, {
      onEmpty: () => Effect.succeed(O.none<[string, string]>()),
      onNonEmpty: () =>
        literalAt(
          subjectValue,
          path,
          quads,
          "Expected at most one plain string literal for a mapped identity fiber."
        ).pipe(Effect.map((value) => O.some(Tuple.make(fiber, value)))),
    });
  });

  return IdentityEntry.make({
    identity,
    iri: subjectValue,
    curie,
    fibers: pipe(decodedFibers, A.getSomes, R.fromEntries),
  });
});

/**
 * Encodes identity entries as an exact RDF dataset under an explicit binding.
 *
 * **Details**
 *
 * Every entry IRI becomes its named-node subject. Identity, CURIE, and fiber
 * values are emitted as `xsd:string` literals. Invalid entry IRIs and missing
 * fiber predicates fail in the typed error channel.
 *
 * **Example** (Encode an empty registry dataset)
 *
 * ```ts import.meta.vitest name="Encode an empty registry dataset"
 * import { DefaultIdentityRdfBinding, entriesToDataset } from "@beep/semantic-web"
 * import { Effect } from "effect"
 *
 * const dataset = await Effect.runPromise(entriesToDataset(DefaultIdentityRdfBinding)([]))
 * dataset.quads.length // => 0
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const entriesToDataset = (binding: IdentityRdfBinding) =>
  Effect.fn("IdentityRdfBinding.entriesToDataset")(function* (entries: ReadonlyArray<IdentityEntry>) {
    const encoded = yield* Effect.forEach(
      entries,
      Effect.fnUntraced(function* (entry) {
        const subject = yield* decodeEntrySubject(entry);

        return yield* Effect.forEach(R.toEntries(entry.fibers), ([fiber, value]) =>
          pipe(
            R.get(binding.fiberPaths, fiber),
            O.match({
              onNone: () => Effect.fail(IdentityFiberPathError.make({ fiber })),
              onSome: (path) => Effect.succeed(makeQuad(subject, path, makeLiteral(value, XSD_STRING.value))),
            })
          )
        ).pipe(
          Effect.map((fiberQuads) =>
            pipe(
              [
                makeQuad(subject, binding.identifierPath, makeLiteral(entry.identity, XSD_STRING.value)),
                makeQuad(subject, binding.curiePath, makeLiteral(entry.curie, XSD_STRING.value)),
              ],
              A.appendAll(fiberQuads)
            )
          )
        );
      })
    );

    return makeDataset(A.flatten(encoded));
  });

/**
 * Decodes an exact identity registry dataset under an explicit predicate binding.
 *
 * **Details**
 *
 * Subjects must be named nodes with exactly one identifier and CURIE literal.
 * Mapped fibers are optional per entry, but any present fiber must have exactly
 * one plain string literal and no unknown predicates are accepted.
 *
 * **Example** (Decode an empty registry dataset)
 *
 * ```ts import.meta.vitest name="Decode an empty registry dataset"
 * import { DefaultIdentityRdfBinding, datasetToEntries } from "@beep/semantic-web"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { Effect } from "effect"
 *
 * const entries = await Effect.runPromise(datasetToEntries(DefaultIdentityRdfBinding)(makeDataset([])))
 * entries.length // => 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const datasetToEntries = (binding: IdentityRdfBinding) =>
  Effect.fn("IdentityRdfBinding.datasetToEntries")(function* (dataset: Dataset) {
    const subjects = pipe(
      dataset.quads,
      A.map((quad) => quad.subject),
      A.dedupeWith(sameSubject)
    );

    return yield* Effect.forEach(subjects, (subject) => decodeSubject(binding, dataset, subject));
  });
