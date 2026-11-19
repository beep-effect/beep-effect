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

import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
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

const SCHEMA_ORG_CANONICAL_ORIGIN = pipe(SCHEMA_ORG_NAMESPACE, Str.slice(0, Str.length(SCHEMA_ORG_NAMESPACE) - 1));

const nonCanonicalSchemaOrgOrigins = ["http://schema.org", "http://www.schema.org", "https://www.schema.org"] as const;

const schemaOrgOriginDelimiters = ["/", "?", "#"] as const;

const startsWithinOrigin = (value: string, origin: string): boolean =>
  value === origin ||
  pipe(
    schemaOrgOriginDelimiters,
    A.some((delimiter) => pipe(value, Str.startsWith(`${origin}${delimiter}`)))
  );

/**
 * Rewrite legacy schema.org namespace spellings to the canonical
 * `https://schema.org/` form, leaving every other IRI untouched.
 *
 * **Details**
 *
 * Schema.org treats `http://schema.org/…` and `https://schema.org/…` as the
 * same vocabulary, but RDF IRI equality is codepoint-strict, so mixed forms
 * silently break joins, SPARQL matches, and SHACL paths. The consumer owns
 * canonicalization: this helper implements the lossless `http -> https`
 * rewrite (including the stray `www.schema.org` host) at schema.org-aware
 * boundaries. Generic IRI codecs preserve codepoint identity; other
 * vocabularies are never scheme-rewritten.
 *
 * **Example** (Canonicalize a legacy schema.org IRI)
 *
 * ```ts import.meta.vitest name="Canonicalize a legacy schema.org IRI"
 * import { canonicalizeSchemaOrgIri } from "@beep/rdf/Vocab/SchemaOrg"
 *
 * canonicalizeSchemaOrgIri("http://schema.org/name") // => "https://schema.org/name"
 * canonicalizeSchemaOrgIri("http://purl.org/dc/terms/creator") // => "http://purl.org/dc/terms/creator"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canonicalizeSchemaOrgIri = (value: string): string =>
  pipe(
    nonCanonicalSchemaOrgOrigins,
    A.findFirst((origin) => startsWithinOrigin(value, origin)),
    O.match({
      onNone: () => value,
      onSome: (origin) => `${SCHEMA_ORG_CANONICAL_ORIGIN}${pipe(value, Str.slice(Str.length(origin)))}`,
    })
  );
