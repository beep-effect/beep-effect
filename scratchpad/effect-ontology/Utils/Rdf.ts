/**
 * Pure RDF term and quad construction helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { IRI as IriValue } from "@beep/rdf";
import { IRI } from "@beep/rdf";
import { dual2 } from "./Dual.ts";

/**
 * Build and validate an IRI from a namespace and local identifier.
 *
 * @param baseNamespace - Namespace prepended to the local identifier.
 * @param localName - Local identifier appended to the namespace.
 * @returns The validated combined IRI.
 * @since 0.0.0
 */
export const buildIri = dual2(
  (baseNamespace: string, localName: string): IriValue => IRI.fromUnknown(`${baseNamespace}${localName}`)
);
