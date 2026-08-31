import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { identity, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { contentDigestSync, sha256TextSync } from "@/schema/Digest";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/ProviderCache");

/**
 * Provider request variants represented by the replay cache.
 *
 * **Example** (Check a text-generation request)
 *
 * ```ts
 * import { RequestKind } from "@/schema/ProviderCache"
 *
 * console.log(RequestKind.is["generate-text"]("generate-text")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RequestKind = LiteralKit(["embed", "generate-text"]).pipe(
  $I.annoteSchema("RequestKind", {
    description: "Embedding and text-generation requests supported by the content-addressed cache.",
  })
);

/**
 * Decoded provider request kind.
 *
 * **Example** (Annotate a request kind)
 *
 * ```ts
 * import type { RequestKind } from "@/schema/ProviderCache"
 *
 * const kind: RequestKind = "generate-text"
 * console.log(kind) // "generate-text"
 * ```
 *
 * @see {@link RequestKind} for literals.
 * @category type-level
 * @since 0.0.0
 */
export type RequestKind = typeof RequestKind.Type;

/**
 * Stable provider identity and input digest used as a cache preimage.
 *
 * **Example** (Inspect the cache version)
 *
 * ```ts
 * import { ProviderCacheKey } from "@/schema/ProviderCache"
 *
 * console.log(ProviderCacheKey.fields.schemaVersion.literals[0]) // "provider-cache/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderCacheKey extends S.Class<ProviderCacheKey>($I`ProviderCacheKey`)(
  {
    schemaVersion: S.Literal("provider-cache/v1"),
    model: ModelIdentity,
    requestKind: RequestKind,
    inputDigest: Sha256Hex,
  },
  $I.annote("ProviderCacheKey", {
    description: "Versioned provider model, request kind, and exact input digest used as a cache key preimage.",
  })
) {}

const ProviderCacheEntryFields = S.Struct({
  key: ProviderCacheKey,
  cacheKey: Sha256Hex,
  response: S.NonEmptyString,
  responseDigest: Sha256Hex,
});

const cacheKeyMatches = (entry: typeof ProviderCacheEntryFields.Type): boolean =>
  contentDigestSync(ProviderCacheKey)(entry.key).pipe(
    Result.match({
      onFailure: () => false,
      onSuccess: (digest) => Str.Equivalence(digest, entry.cacheKey),
    })
  );

const responseDigestMatches = (entry: typeof ProviderCacheEntryFields.Type): boolean =>
  Str.Equivalence(sha256TextSync(entry.response), entry.responseDigest);

const ProviderCacheEntryChecks = S.makeFilterGroup([
  S.makeFilter(cacheKeyMatches, {
    identifier: $I`ProviderCacheEntryKeyCheck`,
    title: "Provider cache key digest",
    description: "Requires cacheKey to hash the canonical encoded ProviderCacheKey.",
    message: "ProviderCacheEntry cacheKey must match the canonical key digest.",
  }),
  S.makeFilter(responseDigestMatches, {
    identifier: $I`ProviderCacheEntryResponseCheck`,
    title: "Provider response digest",
    description: "Requires responseDigest to hash the exact UTF-8 response text without JSON quoting.",
    message: "ProviderCacheEntry responseDigest must match the exact response text digest.",
  }),
]);

/**
 * Immutable content-addressed provider response cache entry.
 *
 * **Example** (Inspect the response field)
 *
 * ```ts
 * import { ProviderCacheEntry } from "@/schema/ProviderCache"
 *
 * console.log(ProviderCacheEntry.fields.response !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderCacheEntry extends S.Class<ProviderCacheEntry>($I`ProviderCacheEntry`)(
  ProviderCacheEntryFields.mapFields(identity).check(ProviderCacheEntryChecks),
  $I.annote("ProviderCacheEntry", {
    description: "Write-once provider response whose key and exact text digest are both verified.",
  })
) {}
