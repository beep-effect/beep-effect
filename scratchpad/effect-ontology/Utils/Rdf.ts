/**
 * Pure RDF term and quad construction helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { GraphTerm, IRI as IriValue, Literal, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf";
import { IRI, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { dual2 } from "./Dual.ts";

/**
 * Concatenates a namespace and local identifier, then validates the result as
 * an IRI.
 *
 * **Gotchas**
 *
 * {@link IRI.decodeUnknownSync} throws if the concatenated string is not a valid IRI.
 *
 * **Example** (Build a person IRI)
 *
 * ```ts
 * import { buildIri } from "@effect-ontology/Utils/Rdf"
 *
 * console.log(buildIri("https://example.com/", "ada")) // "https://example.com/ada"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const buildIri = dual2(
  (baseNamespace: string, localName: string): IriValue => IRI.decodeUnknownSync(`${baseNamespace}${localName}`)
);

/**
 * Converts an IRI string to a named node while preserving an existing named node.
 *
 * **Example** (Create a named node)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { canonicalNamedNode } from "@effect-ontology/Utils/Rdf"
 *
 * const node = canonicalNamedNode(IRI.decodeUnknownSync("https://example.com/person"))
 * console.log(node.value) // "https://example.com/person"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const canonicalNamedNode = (value: IriValue | NamedNode): NamedNode =>
  P.isString(value) ? makeNamedNode(value) : value;

/**
 * Constructs an RDF literal with an optional datatype or language tag.
 *
 * **Example** (Create a plain string literal)
 *
 * ```ts
 * import { canonicalLiteral } from "@effect-ontology/Utils/Rdf"
 *
 * const literal = canonicalLiteral({ value: "Ada" })
 * console.log(literal.value) // "Ada"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const canonicalLiteral = (input: {
  readonly value: string;
  readonly datatype?: O.Option<IriValue | NamedNode>;
  readonly language?: O.Option<string>;
}): Literal => {
  const datatype = O.getOrElse(input.datatype ?? O.none(), () => XSD_STRING);
  const language = O.getOrUndefined(input.language ?? O.none());
  return makeLiteral(input.value, canonicalNamedNode(datatype).value, P.isUndefined(language) ? {} : { language });
};

/**
 * Constructs an RDF quad from canonical IRIs or prebuilt RDF terms.
 *
 * **Example** (Create a quad in the default graph)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { canonicalQuad } from "@effect-ontology/Utils/Rdf"
 * import * as O from "effect/Option"
 *
 * const quad = canonicalQuad({
 *   subject: IRI.decodeUnknownSync("https://example.com/ada"),
 *   predicate: IRI.decodeUnknownSync("https://example.com/name"),
 *   object: IRI.decodeUnknownSync("https://example.com/Ada"),
 *   graph: O.none()
 * })
 * console.log(quad.subject.value) // "https://example.com/ada"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const canonicalQuad = (input: {
  readonly subject: IriValue | Subject;
  readonly predicate: IriValue | NamedNode;
  readonly object: IriValue | ObjectTerm;
  readonly graph: O.Option<IriValue | GraphTerm>;
}): Quad => {
  const subject = P.isString(input.subject) ? makeNamedNode(input.subject) : input.subject;
  const predicate = canonicalNamedNode(input.predicate);
  const object = P.isString(input.object) ? makeNamedNode(input.object) : input.object;
  return O.match(
    O.map(input.graph, (value) => (P.isString(value) ? makeNamedNode(value) : value)),
    {
      onNone: () => makeQuad(subject, predicate, object),
      onSome: (graph) => makeQuad(subject, predicate, { object, graph }),
    }
  );
};
