/**
 * The core namespaces every ontology projection binds, whatever registry the ontology was folded over.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { namespace } from "@beep/identity/Registry";
import * as A from "effect/Array";

/**
 * The core namespaces, ascending by prefix.
 *
 * @category constants
 * @since 0.0.0
 */
export const coreNamespaces = [
  namespace("dcterms"),
  namespace("owl"),
  namespace("rdf"),
  namespace("rdfs"),
  namespace("skos"),
];

/**
 * Check whether a prefix is a core prefix bound to an IRI other than its core namespace.
 *
 * @category predicates
 * @since 0.0.0
 */
export const rebindsCorePrefix = ({ iri, prefix }: { readonly iri: string; readonly prefix: string }): boolean =>
  A.some(coreNamespaces, (core) => core.prefix === prefix && core.iri !== iri);
