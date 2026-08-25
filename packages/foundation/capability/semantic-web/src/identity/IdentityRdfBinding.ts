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
import { Effect, pipe, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Dataset, Quad } from "@beep/rdf/Rdf";

const $I = $SemanticWebId.create("identity/IdentityRdfBinding");

const identifierPathIri = $SemanticWebId.create("identity/identifier").iri;
const curiePathIri = $SemanticWebId.create("identity/curie").iri;
const sameNamedNode = S.toEquivalence(NamedNode);
const sameSubject = S.toEquivalence(Subject);

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
  {
    identifierPath: NamedNode,
    curiePath: NamedNode,
    fiberPaths: S.Record(S.String, NamedNode),
  },
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
 * ```ts
 * import { IdentityFiberPathError } from "@beep/semantic-web"
 *
 * const error = IdentityFiberPathError.make({ fiber: "label" })
 * console.log(error._tag) // "IdentityFiberPathError"
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

const literalAt = Effect.fn("IdentityRdfBinding.literalAt")(function* (
  subject: string,
  path: NamedNode,
  quads: ReadonlyArray<Quad>,
  cardinalityMessage: string
) {
  const matching = pipe(
    quads,
    A.filter((quad) => sameNamedNode(quad.predicate, path))
  );

  if (A.length(matching) !== 1) {
    return yield* IdentityDatasetDecodeError.make({ subject, message: cardinalityMessage });
  }

  const quad = yield* pipe(
    A.head(matching),
    O.match({
      onNone: () => Effect.fail(IdentityDatasetDecodeError.make({ subject, message: cardinalityMessage })),
      onSome: Effect.succeed,
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
    A.filter((quad) => sameSubject(quad.subject, subject))
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
    const matching = pipe(
      quads,
      A.filter((quad) => sameNamedNode(quad.predicate, path))
    );

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
 * values are emitted as `xsd:string` literals; missing fiber predicates fail.
 *
 * **Example** (Encode an empty registry dataset)
 *
 * ```ts
 * import { DefaultIdentityRdfBinding, entriesToDataset } from "@beep/semantic-web"
 * import { Effect } from "effect"
 *
 * const dataset = await Effect.runPromise(entriesToDataset(DefaultIdentityRdfBinding)([]))
 * console.log(dataset.quads.length) // 0
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const entriesToDataset = (binding: IdentityRdfBinding) =>
  Effect.fn("IdentityRdfBinding.entriesToDataset")(function* (entries: ReadonlyArray<IdentityEntry>) {
    const encoded = yield* Effect.forEach(entries, (entry) => {
      const subject = makeNamedNode(entry.iri);

      return Effect.forEach(R.toEntries(entry.fibers), ([fiber, value]) =>
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
    });

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
 * ```ts
 * import { DefaultIdentityRdfBinding, datasetToEntries } from "@beep/semantic-web"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { Effect } from "effect"
 *
 * const entries = await Effect.runPromise(datasetToEntries(DefaultIdentityRdfBinding)(makeDataset([])))
 * console.log(entries.length) // 0
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
