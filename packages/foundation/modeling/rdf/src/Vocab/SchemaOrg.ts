/**
 * Schema.org vocabulary helpers.
 *
 * **Details**
 *
 * The canonical namespace is `https://schema.org/` (the form schema.org uses
 * for editorial work, term-page canonical URLs, and download flavours since
 * v12.0). The legacy `http://schema.org/` spelling remains valid in external
 * data and generic `@beep/rdf` IRI codecs preserve it exactly. Schema.org-aware
 * boundaries can opt into `canonicalizeSchemaOrgIri`; the vocabulary constants
 * in this module mint the canonical `https` form.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { SCHEMA_ORG_NAMESPACE } from "./generated/SchemaOrg.terms.ts";

/**
 * Generated namespace IRI and term inventory for this vocabulary.
 *
 * Single-sourced from the `@beep/identity` `CoreVocab` registry via
 * `bun run beep sync-data-to-ts --target vocab-terms`.
 *
 * @category constants
 * @since 0.0.0
 */
export { SCHEMA_ORG_NAMESPACE, SCHEMA_ORG_TERMS } from "./generated/SchemaOrg.terms.ts";

/**
 * `schema:name`
 *
 * **Example** (Inspect SCHEMA_NAME NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect SCHEMA_NAME NamedNode"
 * import { SCHEMA_NAME } from "@beep/rdf/Vocab/SchemaOrg"
 *
 * SCHEMA_NAME.value // => "https://schema.org/name"
 * SCHEMA_NAME.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SCHEMA_NAME = makeNamedNode(`${SCHEMA_ORG_NAMESPACE}name`);

/**
 * `schema:Person`
 *
 * **Example** (Inspect SCHEMA_PERSON NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect SCHEMA_PERSON NamedNode"
 * import { SCHEMA_PERSON } from "@beep/rdf/Vocab/SchemaOrg"
 *
 * SCHEMA_PERSON.value // => "https://schema.org/Person"
 * SCHEMA_PERSON.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SCHEMA_PERSON = makeNamedNode(`${SCHEMA_ORG_NAMESPACE}Person`);

/**
 * `schema:Thing`
 *
 * **Example** (Inspect SCHEMA_THING NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect SCHEMA_THING NamedNode"
 * import { SCHEMA_THING } from "@beep/rdf/Vocab/SchemaOrg"
 *
 * SCHEMA_THING.value // => "https://schema.org/Thing"
 * SCHEMA_THING.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SCHEMA_THING = makeNamedNode(`${SCHEMA_ORG_NAMESPACE}Thing`);
