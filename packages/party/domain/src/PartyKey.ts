/**
 * PartyKey v1: the deterministic key of one identity ingestion anchor.
 *
 * A PartyKey is `pk:v1:` followed by the lowercase hex SHA-256 of the UTF-8
 * canonical JSON bytes of one basis object. It names an anchor, not proof that
 * its users are one person: `KeyAssignment` claims map keys to a `PartyId`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Identifier,
  IdentifierIssue,
  IdentifierNamespace,
  IdentifierValue,
  normalizeNamespace,
  normalizeText,
} from "./Identifier.ts";

const $I = $PartyDomainId.create("PartyKey");

const partyKeyPrefix = "pk:v1:";

/**
 * A version 1 PartyKey: `pk:v1:` and 64 lowercase hexadecimal digits.
 *
 * **Example** (Accept only the v1 shape)
 *
 * ```ts
 * import { PartyKey } from "@beep/party-domain/PartyKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PartyKey)(`pk:v1:${"a".repeat(64)}`)) // true
 * console.log(S.is(PartyKey)(`pk:v1:${"A".repeat(64)}`)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PartyKey = S.String.check(
  S.isPattern(/^pk:v1:[0-9a-f]{64}$/, { message: "Expected pk:v1: followed by 64 lowercase hex digits" })
).pipe(S.brand("PartyKey"), $I.annoteSchema("PartyKey", { description: "Deterministic PartyKey v1." }));

/**
 * {@inheritDoc PartyKey}
 *
 * @category models
 * @since 0.0.0
 */
export type PartyKey = typeof PartyKey.Type;

/**
 * Identifier-kind token hashed as a basis `scheme`. `email`, `tel` and `x500`
 * are globally scoped; `user`, `native` and `ext` require a namespace.
 *
 * @category models
 * @since 0.0.0
 */
export const IdentifierScheme = LiteralKit(["email", "tel", "x500", "user", "native", "ext"]).pipe(
  $I.annoteSchema("IdentifierScheme", { description: "Identifier-kind token hashed as a PartyKey basis scheme." })
);

/**
 * {@inheritDoc IdentifierScheme}
 *
 * @category models
 * @since 0.0.0
 */
export type IdentifierScheme = typeof IdentifierScheme.Type;

const globallyScopedScheme = IdentifierScheme.pick(["email", "tel", "x500"]);

/**
 * A basis authority: empty for a globally scoped scheme, otherwise a namespace.
 *
 * @category models
 * @since 0.0.0
 */
export const BasisAuthority = S.Union([S.Literal(""), IdentifierNamespace]).pipe(
  $I.annoteSchema("BasisAuthority", { description: "Empty for a globally scoped scheme, otherwise a namespace." })
);

/**
 * {@inheritDoc BasisAuthority}
 *
 * @category models
 * @since 0.0.0
 */
export type BasisAuthority = typeof BasisAuthority.Type;

const IdentifierBasisFields = S.Struct({
  kind: S.tag("identifier"),
  scheme: IdentifierScheme,
  authority: BasisAuthority,
  value: IdentifierValue,
});

const SchemeAuthorityCheck = S.makeFilter(
  (basis: typeof IdentifierBasisFields.Type) =>
    S.is(globallyScopedScheme)(basis.scheme) === Str.isEmpty(basis.authority),
  $I.annote("SchemeAuthorityCheck", {
    title: "Scheme authority",
    description: "Globally scoped schemes carry an empty authority; namespaced schemes require one.",
    message: "Expected an empty authority exactly for email, tel and x500",
  })
);

/**
 * Basis for an identifier anchor: `{ kind: "identifier", scheme, authority, value }`.
 *
 * @category models
 * @since 0.0.0
 */
export class IdentifierBasis extends S.Opaque<IdentifierBasis, { readonly brand: unique symbol }>()(
  IdentifierBasisFields.check(SchemeAuthorityCheck).pipe(
    $I.annoteSchema("IdentifierBasis", { description: "PartyKey v1 basis for one graduated identifier." })
  )
) {}

/**
 * Basis for a record with no usable identifier: the stable source namespace and
 * native record id, never a display name.
 *
 * @category models
 * @since 0.0.0
 */
export class SourceRecordBasis extends S.Opaque<SourceRecordBasis, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("source-record"), authority: IdentifierNamespace, value: IdentifierValue }).pipe(
    $I.annoteSchema("SourceRecordBasis", { description: "PartyKey v1 fallback basis for an identifier-free record." })
  )
) {}

/**
 * Any PartyKey v1 basis, discriminated by `kind`.
 *
 * @category models
 * @since 0.0.0
 */
export const PartyKeyBasis = S.Union([IdentifierBasis, SourceRecordBasis]).pipe(
  $I.annoteSchema("PartyKeyBasis", { description: "Any PartyKey v1 basis object." }),
  S.toTaggedUnion("kind")
);

/**
 * {@inheritDoc PartyKeyBasis}
 *
 * @category models
 * @since 0.0.0
 */
export type PartyKeyBasis = typeof PartyKeyBasis.Type;

/**
 * Stable source identity of an identifier-free record.
 *
 * @category models
 * @since 0.0.0
 */
export class SourceRecordInput extends S.Opaque<SourceRecordInput, { readonly brand: unique symbol }>()(
  S.Struct({ namespace: S.String, recordId: S.String }).pipe(
    $I.annoteSchema("SourceRecordInput", { description: "Stable source namespace and native record id." })
  )
) {}

const namedEscapes: Readonly<Record<string, string>> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
};

const isControl = (char: string): boolean => O.exists(Str.charCodeAt(char, 0), (code) => code < 0x20);

const escapeChar = (char: string): string =>
  namedEscapes[char] ??
  (isControl(char)
    ? `\\u${pipe(O.getOrElse(Str.charCodeAt(char, 0), () => 0).toString(16), Str.padStart(4, "0"))}`
    : char);

const escapeJsonString = (value: string): string => A.join(A.map(A.fromIterable(value), escapeChar), "");

const codePoints = (value: string): ReadonlyArray<number> =>
  A.map(A.fromIterable(value), (char) => O.getOrElse(Str.codePointAt(char, 0), () => 0));

const byKeyCodePoint: Order.Order<readonly [string, string]> = Order.mapInput(
  A.makeOrder(Order.Number),
  ([key]: readonly [string, string]) => codePoints(key)
);

const basisEntries = PartyKeyBasis.match({
  identifier: (basis): ReadonlyArray<readonly [string, string]> => [
    ["authority", basis.authority],
    ["kind", basis.kind],
    ["scheme", basis.scheme],
    ["value", basis.value],
  ],
  "source-record": (basis): ReadonlyArray<readonly [string, string]> => [
    ["authority", basis.authority],
    ["kind", basis.kind],
    ["value", basis.value],
  ],
});

const decodeBasis = S.decodeUnknownEffect(PartyKeyBasis, { onExcessProperty: "error" });

/**
 * Decode a basis at the PartyKey boundary. Missing fields, extra fields,
 * non-string values, unknown schemes, a scheme/authority mismatch and values
 * that are not already canonical (NFC/trim, no unpaired surrogates) fail as an
 * `invalid-basis` issue.
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodePartyKeyBasis = Effect.fn("PartyKey.decodePartyKeyBasis")(function* (input: unknown) {
  return yield* Effect.mapError(decodeBasis(input), (error) =>
    IdentifierIssue.make({ reason: "invalid-basis", input: error.message })
  );
});

/**
 * Serialize a basis as PartyKey v1 canonical JSON after decoding it: string
 * fields only, keys sorted by Unicode code point, no insignificant whitespace,
 * minimal escaping (quote, backslash and C0 controls) and no trailing newline.
 *
 * **Example** (The pinned email basis)
 *
 * ```ts
 * import { canonicalJson } from "@beep/party-domain/PartyKey"
 * import * as Effect from "effect/Effect"
 *
 * const text = Effect.runSync(
 *   canonicalJson({ kind: "identifier", scheme: "email", authority: "", value: "dana@example.test" })
 * )
 * console.log(text)
 * // {"authority":"","kind":"identifier","scheme":"email","value":"dana@example.test"}
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const canonicalJson = Effect.fn("PartyKey.canonicalJson")(function* (input: unknown) {
  const basis = yield* decodePartyKeyBasis(input);
  const members = A.map(
    A.sort(basisEntries(basis), byKeyCodePoint),
    ([key, value]) => `"${escapeJsonString(key)}":"${escapeJsonString(value)}"`
  );
  return `{${A.join(members, ",")}}`;
});

/**
 * The UTF-8 canonical bytes that a PartyKey v1 hashes.
 *
 * @category serialization
 * @since 0.0.0
 */
export const canonicalBytes = Effect.fn("PartyKey.canonicalBytes")(function* (input: unknown) {
  return utf8ToBytes(yield* canonicalJson(input));
});

/**
 * Compute the PartyKey v1 of a basis.
 *
 * @category constructors
 * @since 0.0.0
 */
export const partyKeyOfBasis = Effect.fn("PartyKey.partyKeyOfBasis")(function* (input: unknown) {
  const bytes = yield* canonicalBytes(input);
  return PartyKey.make(`${partyKeyPrefix}${bytesToHex(sha256(bytes))}`);
});

/**
 * The identifier basis of a graduated identifier. `scheme` is the identifier-kind
 * token (`email`, `tel`, `x500`, `user`, `native`, `ext`); `authority` is the
 * required namespace, empty only for a globally scoped scheme; `value` is the
 * shared-normalized canonical value, never the raw spelling.
 *
 * @category serialization
 * @since 0.0.0
 */
export const identifierBasis = Effect.fn("PartyKey.identifierBasis")(function* (identifier: Identifier) {
  const fields = Identifier.match(identifier, {
    EmailAddress: (id) => ({ scheme: "email", authority: "", value: id.normalized }),
    PhoneNumber: (id) => ({ scheme: "tel", authority: "", value: id.e164 }),
    ExchangeDn: (id) => ({ scheme: "x500", authority: "", value: id.normalized }),
    Username: (id) => ({ scheme: "user", authority: id.service, value: id.handle }),
    NativeAccountId: (id) => ({ scheme: "native", authority: id.service, value: id.value }),
    ExternalId: (id) => ({ scheme: "ext", authority: id.scheme, value: id.value }),
  });
  return yield* Effect.mapError(
    S.decodeUnknownEffect(IdentifierBasis, { onExcessProperty: "error" })({ kind: "identifier", ...fields }),
    (error) => IdentifierIssue.make({ reason: "invalid-basis", input: error.message })
  );
});

/**
 * The PartyKey v1 of one graduated identifier. Emit one key per identifier;
 * never hash a list of identifiers.
 *
 * **Example** (Header and card share one key)
 *
 * ```ts
 * import { emailAddress } from "@beep/party-domain/Identifier"
 * import { partyKeyOf } from "@beep/party-domain/PartyKey"
 * import * as Effect from "effect/Effect"
 *
 * const key = (raw: string) => Effect.runSync(Effect.flatMap(emailAddress(raw), partyKeyOf))
 * console.log(key("Dana Example <Dana@EXAMPLE.test>") === key(" dana@example.test ")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const partyKeyOf = Effect.fn("PartyKey.partyKeyOf")(function* (identifier: Identifier) {
  return yield* partyKeyOfBasis(yield* identifierBasis(identifier));
});

/**
 * The fallback PartyKey v1 of a record with no usable identifier, from its stable
 * source namespace and native record id (NFC/trim, case preserved). A missing
 * namespace or id is a data-quality issue; display names are never a fallback.
 * Such keys carry no cross-source equality guarantee.
 *
 * @category constructors
 * @since 0.0.0
 */
export const sourceRecordPartyKey = Effect.fn("PartyKey.sourceRecordPartyKey")(function* (input: SourceRecordInput) {
  const identity = yield* Effect.mapError(
    Effect.all({ authority: normalizeNamespace(input.namespace), value: normalizeText(input.recordId) }),
    (failure) =>
      failure.reason === "unpaired-surrogate"
        ? failure
        : IdentifierIssue.make({ reason: "missing-source-record-identity", input: failure.input })
  );
  return yield* partyKeyOfBasis({ kind: "source-record", ...identity });
});
