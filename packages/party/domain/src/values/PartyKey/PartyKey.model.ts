/**
 * PartyKey v1 schemas: the key, its identifier and source-record bases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  E164Phone,
  IdentifierNamespace,
  IdentifierValue,
  NormalizedEmail,
  NormalizedExchangeDn,
  NormalizedHandle,
} from "../Identifier/Identifier.model.ts";

const $I = $PartyDomainId.create("values/PartyKey/PartyKey.model");

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
 * **Example** (Check a scheme token)
 *
 * ```ts
 * import { IdentifierScheme } from "@beep/party-domain/PartyKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifierScheme)("tel")) // true
 * console.log(S.is(IdentifierScheme)("fax")) // false
 * ```
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
 * **Example** (Allow empty or trimmed authorities)
 *
 * ```ts
 * import { BasisAuthority } from "@beep/party-domain/PartyKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BasisAuthority)("")) // true
 * console.log(S.is(BasisAuthority)(" urn:example:directory")) // false
 * ```
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

/**
 * The graduated value schema each scheme hashes. A basis value must already be
 * that scheme's canonical value, so an adapter that skips the shared
 * normalizer cannot mint a divergent key.
 */
const schemeValueGuards: Readonly<Record<IdentifierScheme, (value: string) => boolean>> = {
  email: S.is(NormalizedEmail),
  tel: S.is(E164Phone),
  x500: S.is(NormalizedExchangeDn),
  user: S.is(NormalizedHandle),
  native: S.is(IdentifierValue),
  ext: S.is(IdentifierValue),
};

const SchemeCanonicalCheck = S.makeFilter(
  (basis: typeof IdentifierBasisFields.Type) =>
    S.is(globallyScopedScheme)(basis.scheme) === Str.isEmpty(basis.authority) &&
    schemeValueGuards[basis.scheme](basis.value),
  $I.annote("SchemeCanonicalCheck", {
    title: "Scheme-canonical identifier basis",
    description:
      "Globally scoped schemes carry an empty authority and namespaced schemes require one; the value is the scheme's graduated canonical value.",
    message: "Expected the scheme's authority rule and graduated canonical value",
  })
);

/**
 * Basis for an identifier anchor: `{ kind: "identifier", scheme, authority, value }`.
 *
 * **Example** (Require the scheme canonical value)
 *
 * ```ts
 * import { IdentifierBasis } from "@beep/party-domain/PartyKey"
 * import * as S from "effect/Schema"
 *
 * const basis = { kind: "identifier", scheme: "user", authority: "https://chat.example.test", value: "dana" }
 * console.log(S.is(IdentifierBasis)(basis)) // true
 * console.log(S.is(IdentifierBasis)({ ...basis, value: "Dana" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentifierBasis extends S.Opaque<IdentifierBasis, { readonly brand: unique symbol }>()(
  IdentifierBasisFields.check(SchemeCanonicalCheck).pipe(
    $I.annoteSchema("IdentifierBasis", { description: "PartyKey v1 basis for one graduated identifier." })
  )
) {}

/**
 * Basis for a record with no usable identifier: the stable source namespace and
 * native record id, never a display name.
 *
 * **Example** (Require a source namespace)
 *
 * ```ts
 * import { SourceRecordBasis } from "@beep/party-domain/PartyKey"
 * import * as S from "effect/Schema"
 *
 * const basis = { kind: "source-record", authority: "urn:example:contacts", value: "Card-17" }
 * console.log(S.is(SourceRecordBasis)(basis)) // true
 * console.log(S.is(SourceRecordBasis)({ ...basis, authority: "" })) // false
 * ```
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
 * **Example** (Read the basis kind)
 *
 * ```ts
 * import { PartyKeyBasis } from "@beep/party-domain/PartyKey"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const basis = Effect.runSync(
 *   S.decodeUnknownEffect(PartyKeyBasis)({ kind: "source-record", authority: "urn:example:contacts", value: "Card-17" })
 * )
 * console.log(PartyKeyBasis.match(basis, { identifier: () => "identifier", "source-record": () => "fallback" })) // "fallback"
 * ```
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
 * **Example** (Build raw source-record input)
 *
 * ```ts
 * import { SourceRecordInput } from "@beep/party-domain/PartyKey"
 *
 * const input = SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "Card-17" })
 * console.log(input.recordId) // "Card-17"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceRecordInput extends S.Opaque<SourceRecordInput, { readonly brand: unique symbol }>()(
  S.Struct({ namespace: S.String, recordId: S.String }).pipe(
    $I.annoteSchema("SourceRecordInput", { description: "Stable source namespace and native record id." })
  )
) {}
