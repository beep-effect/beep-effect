/**
 * RFC 3986-oriented URI schemas and normalization helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata.ts";

const $I = $RdfId.create("uri");

const SCHEME_PREFIX = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const UNRESERVED = /^[A-Za-z0-9._~-]$/;

const uriReferenceMetadata = makeSemanticSchemaMetadata({
  kind: "identifier",
  canonicalName: "URIReference",
  overview: "RFC 3986 URI reference syntax, including absolute and relative forms.",
  status: "stable",
  specifications: [{ name: "RFC 3986", section: "4.1", disposition: "normative" }],
  equivalenceBasis: "String equality after URI-family normalization when callers opt into normalization helpers.",
  canonicalizationRequired: true,
  representations: [{ kind: "JSON-LD", note: "Used as a transport-oriented identifier companion to IRI values." }],
});

const relativeUriReferenceMetadata = makeSemanticSchemaMetadata({
  kind: "identifier",
  canonicalName: "RelativeURIReference",
  overview: "RFC 3986 relative URI reference syntax.",
  status: "stable",
  specifications: [{ name: "RFC 3986", section: "4.2", disposition: "normative" }],
  equivalenceBasis: "String equality after percent-encoding normalization.",
  canonicalizationRequired: true,
});

const absoluteUriMetadata = makeSemanticSchemaMetadata({
  kind: "identifier",
  canonicalName: "AbsoluteURI",
  overview: "RFC 3986 absolute URI without a fragment component.",
  status: "stable",
  specifications: [{ name: "RFC 3986", section: "4.3", disposition: "normative" }],
  equivalenceBasis: "Scheme-aware normalized string equality.",
  canonicalizationRequired: true,
});

const uriMetadata = makeSemanticSchemaMetadata({
  kind: "identifier",
  canonicalName: "URI",
  overview: "RFC 3986 URI syntax including optional fragment components.",
  status: "stable",
  specifications: [{ name: "RFC 3986", section: "3", disposition: "normative" }],
  equivalenceBasis: "Scheme-aware normalized string equality.",
  canonicalizationRequired: true,
});

const makeReferenceChecks = (
  identifier: string,
  title: string,
  description: string,
  message: string,
  predicate: (value: string) => boolean
) =>
  S.makeFilterGroup(
    [
      S.isTrimmed({
        identifier: $I.create(identifier).make("TrimmedCheck"),
        title: `${title} Trimmed`,
        description: `${description} Values must not contain leading or trailing whitespace.`,
        message: `${title} values must not contain leading or trailing whitespace`,
      }),
      S.makeFilter(predicate, {
        identifier: $I.create(identifier).make("FormatCheck"),
        title,
        description,
        message,
      }),
    ],
    {
      identifier: $I.create(identifier).make("Checks"),
      title,
      description,
    }
  );

const makeNonEmptyReferenceChecks = (
  identifier: string,
  title: string,
  description: string,
  message: string,
  predicate: (value: string) => boolean
) =>
  S.makeFilterGroup(
    [
      S.isNonEmpty({
        identifier: $I.create(identifier).make("NonEmptyCheck"),
        title: `${title} Non Empty`,
        description: `${description} Values must not be empty.`,
        message: `${title} values must not be empty`,
      }),
      S.isTrimmed({
        identifier: $I.create(identifier).make("TrimmedCheck"),
        title: `${title} Trimmed`,
        description: `${description} Values must not contain leading or trailing whitespace.`,
        message: `${title} values must not contain leading or trailing whitespace`,
      }),
      S.makeFilter(predicate, {
        identifier: $I.create(identifier).make("FormatCheck"),
        title,
        description,
        message,
      }),
    ],
    {
      identifier: $I.create(identifier).make("Checks"),
      title,
      description,
    }
  );

const normalizePercentEncoding: (value: string) => string = Str.replaceWith(/%[0-9a-fA-F]{2}/g, (token) => {
  const decoded = String.fromCharCode(Number.parseInt(pipe(token, Str.slice(1)), 16));
  return UNRESERVED.test(decoded) ? decoded : Str.toUpperCase(token);
});

const normalizeAbsoluteUri = (value: string): string => {
  const url = new URL(value);
  const scheme = Str.toLowerCase(url.protocol);
  const host = Str.toLowerCase(url.host);
  const pathname = normalizePercentEncoding(url.pathname);
  const search = normalizePercentEncoding(url.search);
  const hash = normalizePercentEncoding(url.hash);

  if (scheme === "mailto:") {
    return `${scheme}${normalizePercentEncoding(url.pathname)}${search}${hash}`;
  }

  /* istanbul ignore next -- URL.host strips default http/https ports before this normalization guard */
  const normalizedHost =
    (scheme === "http:" && pipe(host, Str.endsWith(":80"))) || (scheme === "https:" && pipe(host, Str.endsWith(":443")))
      ? pipe(host, Str.replace(/:(80|443)$/, ""))
      : host;

  return `${scheme}//${normalizedHost}${pathname}${search}${hash}`;
};

const looksLikeAbsoluteUri = (value: string): boolean => SCHEME_PREFIX.test(value);

const isUriReference = (value: string): boolean => value === "" || URL.canParse(value, "https://example.invalid");

const isRelativeUriReference = (value: string): boolean =>
  value === "" || (isUriReference(value) && !looksLikeAbsoluteUri(value));

const isAbsoluteUri = (value: string): boolean =>
  value.length > 0 && looksLikeAbsoluteUri(value) && URL.canParse(value) && !pipe(value, Str.includes("#"));

const isUri = (value: string): boolean => value.length > 0 && looksLikeAbsoluteUri(value) && URL.canParse(value);

const uriReferenceChecks = makeReferenceChecks(
  "URIReference",
  "URI Reference",
  "An RFC 3986 URI reference.",
  "Expected a valid RFC 3986 URI reference",
  isUriReference
);

const relativeUriReferenceChecks = makeReferenceChecks(
  "RelativeURIReference",
  "Relative URI Reference",
  "An RFC 3986 relative URI reference.",
  "Expected a valid RFC 3986 relative URI reference",
  isRelativeUriReference
);

const absoluteUriChecks = makeNonEmptyReferenceChecks(
  "AbsoluteURI",
  "Absolute URI",
  "An RFC 3986 absolute URI without a fragment component.",
  "Expected a valid RFC 3986 absolute URI",
  isAbsoluteUri
);

const uriChecks = makeNonEmptyReferenceChecks("URI", "URI", "An RFC 3986 URI.", "Expected a valid RFC 3986 URI", isUri);

/**
 * RFC 3986 `URI-reference` schema, including absolute and relative forms.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { URIReference } from "@beep/rdf/Uri"
 *
 * const decoded = S.decodeUnknownSync(URIReference)("https://example.com/path")
 * console.log(decoded) // "https://example.com/path"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const URIReference = S.String.check(uriReferenceChecks).pipe(
  S.brand("URIReference"),
  $I.annoteSchema("URIReference", {
    description: "RFC 3986 URI reference syntax, including both absolute and relative forms.",
    semanticSchemaMetadata: uriReferenceMetadata,
  })
);

/**
 * Type for {@link URIReference}.
 *
 * @example
 * ```ts
 * import type { URIReference } from "@beep/rdf/Uri"
 *
 * const acceptURIReference = (value: URIReference) => value
 * console.log(acceptURIReference)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type URIReference = typeof URIReference.Type;

/**
 * RFC 3986 `relative-ref` schema.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { RelativeURIReference } from "@beep/rdf/Uri"
 *
 * const decoded = S.decodeUnknownSync(RelativeURIReference)("/path/to/resource")
 * console.log(decoded) // "/path/to/resource"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const RelativeURIReference = S.String.check(relativeUriReferenceChecks).pipe(
  S.brand("RelativeURIReference"),
  $I.annoteSchema("RelativeURIReference", {
    description: "RFC 3986 relative URI reference syntax (`relative-ref`).",
    semanticSchemaMetadata: relativeUriReferenceMetadata,
  })
);

/**
 * Type for {@link RelativeURIReference}.
 *
 * @example
 * ```ts
 * import type { RelativeURIReference } from "@beep/rdf/Uri"
 *
 * const acceptRelativeURIReference = (value: RelativeURIReference) => value
 * console.log(acceptRelativeURIReference)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type RelativeURIReference = typeof RelativeURIReference.Type;

/**
 * RFC 3986 `absolute-URI` schema without a fragment component.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { AbsoluteURI } from "@beep/rdf/Uri"
 *
 * const decoded = S.decodeUnknownSync(AbsoluteURI)("https://example.com")
 * console.log(decoded) // "https://example.com"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const AbsoluteURI = S.String.check(absoluteUriChecks).pipe(
  S.brand("AbsoluteURI"),
  $I.annoteSchema("AbsoluteURI", {
    description: "RFC 3986 absolute URI syntax without a fragment component.",
    semanticSchemaMetadata: absoluteUriMetadata,
  })
);

/**
 * Type for {@link AbsoluteURI}.
 *
 * @example
 * ```ts
 * import type { AbsoluteURI } from "@beep/rdf/Uri"
 *
 * const acceptAbsoluteURI = (value: AbsoluteURI) => value
 * console.log(acceptAbsoluteURI)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AbsoluteURI = typeof AbsoluteURI.Type;

/**
 * RFC 3986 `URI` schema.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { URI } from "@beep/rdf/Uri"
 *
 * const decoded = S.decodeUnknownSync(URI)("https://example.com/page#anchor")
 * console.log(decoded) // "https://example.com/page#anchor"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const URI = S.String.check(uriChecks).pipe(
  S.brand("URI"),
  $I.annoteSchema("URI", {
    description: "RFC 3986 URI syntax.",
    semanticSchemaMetadata: uriMetadata,
  })
);

/**
 * Type for {@link URI}.
 *
 * @example
 * ```ts
 * import type { URI } from "@beep/rdf/Uri"
 *
 * const acceptURI = (value: URI) => value
 * console.log(acceptURI)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type URI = typeof URI.Type;

/**
 * Normalize a URI or URI reference for transport-oriented comparisons.
 *
 * @example
 * ```typescript
 * import { normalizeUriReference } from "@beep/rdf/Uri"
 *
 * const normalized = normalizeUriReference("HTTP://Example.COM:80/Path")
 * console.log(normalized) // "http://example.com/Path"
 * ```
 *
 * @param value - URI or URI reference text.
 * @returns Normalized URI text.
 * @since 0.0.0
 * @category utilities
 */
export const normalizeUriReference = (value: URIReference | string): string =>
  looksLikeAbsoluteUri(value) && URL.canParse(value) ? normalizeAbsoluteUri(value) : normalizePercentEncoding(value);

/**
 * Resolve a URI reference against an absolute base URI.
 *
 * @example
 * ```typescript
 * import { resolveUriReference } from "@beep/rdf/Uri"
 *
 * const resolved = resolveUriReference("https://example.com/a/b", "../c")
 * console.log(resolved) // "https://example.com/c"
 * ```
 *
 * @param base - Absolute base URI.
 * @param reference - Relative or absolute URI reference.
 * @returns Resolved absolute URI string.
 * @since 0.0.0
 * @category utilities
 */
export const resolveUriReference: {
  (reference: URIReference | string): (base: AbsoluteURI | string) => string;
  (base: AbsoluteURI | string, reference: URIReference | string): string;
} = dual(2, (base: AbsoluteURI | string, reference: URIReference | string): string =>
  normalizeAbsoluteUri(new URL(reference, base).href)
);

/**
 * Compare two URI values using URI-family normalization rules.
 *
 * @example
 * ```typescript
 * import { areUrisEquivalent } from "@beep/rdf/Uri"
 *
 * const same = areUrisEquivalent("HTTP://Example.COM/", "http://example.com/")
 * console.log(same) // true
 * ```
 *
 * @param left - Left URI value.
 * @param right - Right URI value.
 * @returns `true` when both normalized forms are equal.
 * @since 0.0.0
 * @category utilities
 */
export const areUrisEquivalent: {
  (right: URIReference | string): (left: URIReference | string) => boolean;
  (left: URIReference | string, right: URIReference | string): boolean;
} = dual(
  2,
  (left: URIReference | string, right: URIReference | string): boolean =>
    normalizeUriReference(left) === normalizeUriReference(right)
);
