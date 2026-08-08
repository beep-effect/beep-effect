/**
 * AT Protocol AT URI schemas for Lexicon record references.
 *
 * **Details**
 *
 * This module models the current AT Protocol Lexicon `at-uri` subset from the
 * official {@link https://atproto.com/specs/at-uri-scheme | AT URI scheme}
 * specification: `at://AUTHORITY[/COLLECTION[/RKEY]]`.
 *
 * The authority is validated as either an AT Protocol handle from
 * {@link https://atproto.com/specs/handle | Handle Identifier Syntax} or an
 * AT Protocol DID from
 * {@link https://atproto.com/specs/did | DID Identifier Syntax}. The DID
 * shape intentionally follows AT Protocol's stricter DID profile rather than
 * the broader {@link https://www.w3.org/TR/did-core/#did-syntax | W3C DID Core}
 * syntax because AT URIs identify repository content inside the AT Protocol
 * network.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// cspell:words NSID NSIDs Nsid nsid RKEY bsky ewvi nxzyoun zhxrhs ragtjsm vknwkz oxrd Fdef

const $I = $SchemaId.create("AtURI");

const AT_URI_SCHEME = "at://";
const MAX_AT_URI_LENGTH = 8192;
const MAX_ATPROTO_DID_LENGTH = 2048;
const MAX_HANDLE_LENGTH = 253;
const MAX_NSID_LENGTH = 317;
const MAX_NSID_AUTHORITY_LENGTH = 253;
const MAX_RECORD_KEY_LENGTH = 512;

const atprotoDidPattern = /^did:[a-z]+:[A-Za-z0-9._:%-]*[A-Za-z0-9._-]$/u;
const handleLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const handleTopLevelLabelPattern = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const nsidAuthorityLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const nsidFirstAuthorityLabelPattern = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const nsidNamePattern = /^[A-Za-z][A-Za-z0-9]{0,62}$/u;
const recordKeyPattern = /^[A-Za-z0-9._:~-]+$/u;
const percentEscapePattern = /^%[0-9A-F]{2}$/u;
const didRawCharacterPattern = /^[A-Za-z0-9._:-]$/u;

const hasLowercaseAtUriScheme = Str.startsWith(AT_URI_SCHEME);
const hasQueryOrFragment = (value: string): boolean => value.includes("?") || value.includes("#");
const hasNoQueryOrFragment = (value: string): boolean => !hasQueryOrFragment(value);

const hasNormalizedPercentEncoding = (value: string): boolean => {
  for (let index = value.indexOf("%"); index >= 0; index = value.indexOf("%", index + 1)) {
    const escape = value.slice(index, index + 3);
    if (!percentEscapePattern.test(escape)) {
      return false;
    }

    const decoded = String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (decoded === "%" || didRawCharacterPattern.test(decoded)) {
      return false;
    }
  }

  return true;
};

const isAtProtocolDid = (value: string): boolean =>
  value.length <= MAX_ATPROTO_DID_LENGTH && atprotoDidPattern.test(value) && hasNormalizedPercentEncoding(value);

const isAtProtocolHandle = (value: string): boolean => {
  if (value.length > MAX_HANDLE_LENGTH || value !== Str.toLowerCase(value)) {
    return false;
  }

  const labels = Str.split(".")(value);
  const topLevelLabel = labels[labels.length - 1];

  return (
    labels.length >= 2 &&
    topLevelLabel !== undefined &&
    labels.every((label) => handleLabelPattern.test(label)) &&
    handleTopLevelLabelPattern.test(topLevelLabel)
  );
};

const isAuthority = (value: string): boolean =>
  Str.startsWith("did:")(value) ? isAtProtocolDid(value) : isAtProtocolHandle(value);

const isNsid = (value: string): boolean => {
  if (value.length > MAX_NSID_LENGTH) {
    return false;
  }

  const segments = Str.split(".")(value);
  const name = segments[segments.length - 1];
  const authority = segments.slice(0, -1);
  const firstAuthoritySegment = authority[0];

  return (
    segments.length >= 3 &&
    name !== undefined &&
    firstAuthoritySegment !== undefined &&
    authority.join(".").length <= MAX_NSID_AUTHORITY_LENGTH &&
    nsidFirstAuthorityLabelPattern.test(firstAuthoritySegment) &&
    authority.every((segment) => nsidAuthorityLabelPattern.test(segment)) &&
    nsidNamePattern.test(name)
  );
};

const isRecordKey = (value: string): boolean =>
  value.length > 0 &&
  value.length <= MAX_RECORD_KEY_LENGTH &&
  value !== "." &&
  value !== ".." &&
  recordKeyPattern.test(value);

const hasLexiconAtUriShape = (value: string): boolean => {
  if (!hasLowercaseAtUriScheme(value) || hasQueryOrFragment(value) || Str.endsWith("/")(value)) {
    return false;
  }

  const [authority, collection, recordKey, extraSegment] = Str.split("/")(value.slice(AT_URI_SCHEME.length));

  return (
    authority !== undefined &&
    authority.length > 0 &&
    extraSegment === undefined &&
    isAuthority(authority) &&
    (collection === undefined || (collection.length > 0 && isNsid(collection))) &&
    (recordKey === undefined || (recordKey.length > 0 && isRecordKey(recordKey)))
  );
};

const AtUriChecks = S.makeFilterGroup(
  [
    S.isMinLength(AT_URI_SCHEME.length + 1, {
      identifier: $I`AtUriMinLengthCheck`,
      title: "AT URI Min Length",
      description: "An AT URI string with the `at://` scheme and a non-empty authority candidate.",
      message: "AT URI must include the at:// scheme and a non-empty authority",
    }),
    S.isMaxLength(MAX_AT_URI_LENGTH, {
      identifier: $I`AtUriMaxLengthCheck`,
      title: "AT URI Max Length",
      description: "An AT URI string within the AT Protocol defensive maximum length.",
      message: `AT URI must not exceed ${MAX_AT_URI_LENGTH} characters`,
    }),
    S.makeFilter(hasLowercaseAtUriScheme, {
      identifier: $I`AtUriLowercaseSchemeCheck`,
      title: "AT URI Lowercase Scheme",
      description: "An AT URI string that starts with the lowercase at:// scheme.",
      message: "AT URI scheme must be lowercase at://",
    }),
    S.makeFilter(hasNoQueryOrFragment, {
      identifier: $I`AtUriNoQueryOrFragmentCheck`,
      title: "AT URI No Query Or Fragment",
      description: "A current Lexicon AT URI string without query or fragment components.",
      message: "AT URI Lexicon references must not include query or fragment components",
    }),
    S.makeFilter(hasLexiconAtUriShape, {
      identifier: $I`AtUriLexiconShapeCheck`,
      title: "AT URI Lexicon Shape",
      description:
        "An AT URI matching at://AUTHORITY[/COLLECTION[/RKEY]] with AT Protocol authority, NSID collection, and record-key components.",
      message: "AT URI must match at://AUTHORITY[/COLLECTION[/RKEY]] using normalized AT Protocol components",
    }),
  ],
  {
    identifier: $I`AtUriChecks`,
    title: "AT URI",
    description: "Checks for the current AT Protocol Lexicon at-uri subset.",
  }
);

/**
 * Branded schema for normalized AT Protocol Lexicon AT URI strings.
 *
 * **Gotchas**
 *
 * `AtUri` validates the current Lexicon reference subset of the official
 * {@link https://atproto.com/specs/at-uri-scheme | AT URI scheme}. It accepts
 * repository authorities expressed as normalized handles or AT Protocol DIDs,
 * optional collection NSIDs, and optional record keys.
 *
 * This schema deliberately rejects the broader URI grammar that the AT URI
 * scheme reserves for possible future use: query strings, fragments, trailing
 * slashes, empty path segments, and non-normalized percent escapes are outside
 * the current Lexicon `at-uri` surface. Handles and NSID authority segments
 * must already be lowercase; record keys remain case-sensitive as required by
 * {@link https://atproto.com/specs/record-key | Record Key Syntax}.
 *
 * **Example** (Decode DID AT URI)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { AtUri } from "@beep/schema/AtURI"
 *
 * const uri = Effect.runSync(
 *   S.decodeUnknownEffect(AtUri)(
 *     "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3jui7kd54zh2y"
 *   )
 * )
 *
 * console.log(uri) // "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3jui7kd54zh2y"
 * ```
 *
 * **Example** (Reject uppercase handles)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AtUri } from "@beep/schema/AtURI"
 *
 * const isAtUri = S.is(AtUri)
 *
 * console.log(isAtUri("at://alice.example.com/app.bsky.feed.post/self")) // true
 * console.log(isAtUri("at://Alice.example.com/app.bsky.feed.post/self")) // false
 * ```
 *
 * @see {@link https://atproto.com/specs/at-uri-scheme | AT Protocol AT URI scheme} for the AT URI scheme.
 * @see {@link https://atproto.com/specs/did | AT Protocol DID Identifier Syntax} for AT Protocol DID syntax.
 * @see {@link https://www.w3.org/TR/did-core/#did-syntax | W3C DID Core DID syntax} for W3C DID Core syntax.
 * @see {@link https://atproto.com/specs/handle | AT Protocol Handle Identifier Syntax} for handle identifier syntax.
 * @see {@link https://atproto.com/specs/nsid | AT Protocol NSID Syntax} for NSID syntax.
 * @see {@link https://atproto.com/specs/record-key | AT Protocol Record Key Syntax} for record key syntax.
 * @category validation
 * @since 0.0.0
 */
export const AtUri = S.String.check(AtUriChecks)
  .annotate({
    toArbitrary: () => (fc) => {
      const handle = fc
        .tuple(
          fc.array(fc.constantFrom("alice", "bsky", "feed", "photos", "repo"), { minLength: 1, maxLength: 2 }),
          fc.constantFrom("app", "com", "net", "social")
        )
        .map(([labels, topLevelLabel]) => `${labels.join(".")}.${topLevelLabel}`);
      const did = fc.constantFrom(
        "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
        "did:plc:ragtjsm2j2vknwkz3zp4oxrd",
        "did:web:example.com",
        "did:example:abc%2Fdef"
      );
      const collection = fc.constantFrom(
        "app.bsky.feed.post",
        "com.atproto.repo.strongRef",
        "tools.ozone.moderation.defs"
      );
      const recordKey = fc.constantFrom("3jui7kd54zh2y", "self", "A_B-1~z", "2026-06-29T12:34:56.000Z");
      const path = fc.oneof(
        fc.constant(""),
        collection.map((collectionSegment) => `/${collectionSegment}`),
        fc
          .tuple(collection, recordKey)
          .map(([collectionSegment, recordKeySegment]) => `/${collectionSegment}/${recordKeySegment}`)
      );

      return fc
        .tuple(fc.oneof(handle, did), path)
        .map(([authority, pathSegment]) => `${AT_URI_SCHEME}${authority}${pathSegment}`);
    },
  })
  .pipe(
    S.brand("AtUri"),
    $I.annoteSchema("AtUri", {
      description: "A normalized AT Protocol Lexicon AT URI string shaped as at://AUTHORITY[/COLLECTION[/RKEY]].",
      documentation:
        "Validates the current Lexicon at-uri subset from https://atproto.com/specs/at-uri-scheme, using official AT Protocol handle, DID, NSID, and record-key component syntax.",
    })
  );

/**
 * Type for {@link AtUri}.
 *
 * **Example** (Type decoded AT URI)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { AtUri, type AtUri as AtUriValue } from "@beep/schema/AtURI"
 *
 * const uri: AtUriValue = Effect.runSync(
 *   S.decodeUnknownEffect(AtUri)("at://alice.example.com/app.bsky.feed.post/self")
 * )
 *
 * console.log(uri) // "at://alice.example.com/app.bsky.feed.post/self"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AtUri = typeof AtUri.Type;

/**
 * Companion namespace for encoded AT URI type surfaces.
 *
 * **Example** (Encode decoded AT URI)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { AtUri } from "@beep/schema/AtURI"
 *
 * const uri = Effect.runSync(
 *   S.decodeUnknownEffect(AtUri)("at://did:web:example.com/app.bsky.feed.post/self")
 * )
 * const encoded: AtUri.Encoded = Effect.runSync(S.encodeEffect(AtUri)(uri))
 *
 * console.log(encoded) // "at://did:web:example.com/app.bsky.feed.post/self"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AtUri {
  /**
   * Encoded string type for {@link AtUri}.
   *
   * **Example** (Round-trip encode AT URI)
   *
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { AtUri } from "@beep/schema/AtURI"
   *
   * const decoded = Effect.runSync(
   *   S.decodeUnknownEffect(AtUri)("at://alice.example.com/app.bsky.feed.post/self")
   * )
   * const encoded: AtUri.Encoded = Effect.runSync(S.encodeEffect(AtUri)(decoded))
   *
   * console.log(encoded) // "at://alice.example.com/app.bsky.feed.post/self"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AtUri.Encoded;
}
