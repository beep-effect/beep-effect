/**
 * OWL vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * OWL namespace IRI.
 *
 * @example
 * ```ts
 * import { OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl"
 *
 * const classIri = `${OWL_NAMESPACE}Class`
 * console.log(classIri) // "http://www.w3.org/2002/07/owl#Class"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#" as const;

/**
 * OWL local-name inventory mirrored by `@beep/identity`.
 *
 * @example
 * ```ts
 * import { OWL_TERMS } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_TERMS.includes("ObjectProperty")) // true
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_TERMS = [
  "AnnotationProperty",
  "AsymmetricProperty",
  "Class",
  "DatatypeProperty",
  "FunctionalProperty",
  "InverseFunctionalProperty",
  "IrreflexiveProperty",
  "NamedIndividual",
  "Nothing",
  "ObjectProperty",
  "Ontology",
  "ReflexiveProperty",
  "SymmetricProperty",
  "Thing",
  "TransitiveProperty",
  "backwardCompatibleWith",
  "deprecated",
  "equivalentClass",
  "equivalentProperty",
  "imports",
  "incompatibleWith",
  "inverseOf",
  "priorVersion",
  "sameAs",
  "versionInfo",
] as const;

/**
 * `owl:Class`
 *
 * @example
 * ```ts
 * import { OWL_CLASS } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_CLASS.value) // "http://www.w3.org/2002/07/owl#Class"
 * console.log(OWL_CLASS.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_CLASS = makeNamedNode(`${OWL_NAMESPACE}Class`);

/**
 * `owl:ObjectProperty`
 *
 * @example
 * ```ts
 * import { OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_OBJECT_PROPERTY.value) // "http://www.w3.org/2002/07/owl#ObjectProperty"
 * console.log(OWL_OBJECT_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_OBJECT_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}ObjectProperty`);

/**
 * `owl:DatatypeProperty`
 *
 * @example
 * ```ts
 * import { OWL_DATATYPE_PROPERTY } from "@beep/rdf/Vocab/Owl"
 *
 * console.log(OWL_DATATYPE_PROPERTY.value) // "http://www.w3.org/2002/07/owl#DatatypeProperty"
 * console.log(OWL_DATATYPE_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @since 0.0.0
 * @category constants
 */
export const OWL_DATATYPE_PROPERTY = makeNamedNode(`${OWL_NAMESPACE}DatatypeProperty`);
