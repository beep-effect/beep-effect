/**
 * The one digest format of every content-addressed identifier the text and
 * knowledge layers mint, the versioned domain tag hashed at the head of each
 * preimage, and the domain brands over the digest.
 *
 * **Details**
 *
 * Every brand here is a brand over {@link Sha256PrefixedDigest}: the encoded
 * form is always `sha256:` plus 64 lowercase hex characters, so a stored
 * identifier keeps its bytes when a domain brand is added. The minting
 * function that produces these values lives with the canonical JSON owner,
 * `@beep/jsonc/Mint`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as S from "effect/Schema";
import { $SchemaId } from "./internal/SchemaId.ts";
import { Sha256PrefixedDigest } from "./Sha256.ts";

const $I = $SchemaId.create("ContentHash");

/**
 * A content-addressed identifier: the SHA-256 digest of a versioned,
 * domain-tagged canonical preimage, written `sha256:<64 lowercase hex>`.
 *
 * **Details**
 *
 * A brand over {@link Sha256PrefixedDigest}, so any `ContentHash` is also a
 * prefixed digest. Domain identifiers such as {@link ActivityId} brand it once
 * more.
 *
 * **Example** (Brand a prefixed digest as a content hash)
 *
 * ```ts import.meta.vitest name="Brand a prefixed digest as a content hash"
 * import * as S from "effect/Schema"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * const isContentHash = S.is(ContentHash)
 *
 * isContentHash("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") // => true
 * isContentHash("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContentHash = Sha256PrefixedDigest.pipe(
  S.brand("ContentHash"),
  $I.annoteSchema("ContentHash", {
    description: "A content-addressed identifier: the SHA-256 digest of a versioned, domain-tagged canonical preimage.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;

/**
 * A versioned domain tag such as `activity/v1`: the first element of every
 * content-hash preimage, so two domains, or two versions of one domain, never
 * hash one preimage alike.
 *
 * **Details**
 *
 * The grammar is a lowercase domain name of letters, digits and hyphens, a
 * slash, `v` and a positive version number without leading zeros. A changed
 * preimage bumps the version in the same change.
 *
 * **Example** (Accept a versioned tag)
 *
 * ```ts import.meta.vitest name="Accept a versioned tag"
 * import * as S from "effect/Schema"
 * import { DomainTag } from "@beep/schema/ContentHash"
 *
 * const isDomainTag = S.is(DomainTag)
 *
 * isDomainTag("activity/v1") // => true
 * isDomainTag("activity/v0") // => false
 * isDomainTag("Activity/v1") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DomainTag = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9-]*\/v[1-9][0-9]*$/,
    $I.annote("DomainTagPattern", {
      title: "Domain Tag",
      description: "A lowercase domain name, a slash and a positive version number.",
      message: "Expected a domain tag of the form <domain>/v<n>.",
    })
  )
).pipe(
  S.brand("DomainTag"),
  $I.annoteSchema("DomainTag", {
    description: "The versioned domain separator hashed as the head of every content-hash preimage.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type DomainTag = typeof DomainTag.Type;

/**
 * The id of one `prov:Activity` run: a {@link ContentHash} minted from the
 * facts known when the run starts, so the run's outputs can name it.
 *
 * **Details**
 *
 * `@beep/jsonc/ActivityStart` mints native ids from the `activity/v1`
 * preimage. Imported activities brand an id minted by their importer.
 *
 * **Example** (Narrow a content hash to an activity id)
 *
 * ```ts import.meta.vitest name="Narrow a content hash to an activity id"
 * import * as S from "effect/Schema"
 * import { ActivityId, ContentHash } from "@beep/schema/ContentHash"
 *
 * const hash = ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const activity = ActivityId.make(hash)
 *
 * S.is(ContentHash)(activity) // => true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ActivityId = ContentHash.pipe(
  S.brand("ActivityId"),
  $I.annoteSchema("ActivityId", {
    description: "Content hash identifying one prov:Activity run, minted from its start-time facts.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ActivityId = typeof ActivityId.Type;
