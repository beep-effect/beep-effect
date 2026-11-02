/**
 * Graduated party identifier schemas.
 *
 * The branded value schemas re-run the shared normalizers as checks, so a
 * decoded identifier holds a canonical value and a forged one fails to decode.
 * Phone numbers are the one structural exception: decoding checks the E.164
 * shape only, while validity under phone metadata is checked once, at
 * graduation, so stored identifiers survive a metadata update.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { CountryCode } from "@beep/schema/CountryCode";
import * as S from "effect/Schema";
import {
  canonicalEmail,
  canonicalExchangeDn,
  canonicalHandle,
  canonicalText,
  e164Pattern,
  isFixedPoint,
} from "../../internal/IdentifierCore.ts";

const $I = $PartyDomainId.create("values/Identifier/Identifier.model");

const CanonicalTextCheck = S.makeFilter(
  isFixedPoint(canonicalText),
  $I.annote("CanonicalTextCheck", {
    title: "Canonical identifier text",
    description: "Non-empty NFC text with no leading or trailing White_Space and no unpaired surrogate.",
    message: "Expected non-empty NFC text with no surrounding whitespace",
  })
);

/**
 * A required namespace (service, issuer, tenant or source system) after NFC/trim,
 * case and internal whitespace preserved.
 *
 * @category models
 * @since 0.0.0
 */
export const IdentifierNamespace = S.String.check(CanonicalTextCheck).pipe(
  S.brand("IdentifierNamespace"),
  $I.annoteSchema("IdentifierNamespace", { description: "Required identifier namespace after NFC/trim." })
);

/**
 * {@inheritDoc IdentifierNamespace}
 *
 * @category models
 * @since 0.0.0
 */
export type IdentifierNamespace = typeof IdentifierNamespace.Type;

/**
 * A case-preserving identifier value (native account id, external id or
 * source-record id) after NFC/trim.
 *
 * @category models
 * @since 0.0.0
 */
export const IdentifierValue = S.String.check(CanonicalTextCheck).pipe(
  S.brand("IdentifierValue"),
  $I.annoteSchema("IdentifierValue", { description: "Case-preserving identifier value after NFC/trim." })
);

/**
 * {@inheritDoc IdentifierValue}
 *
 * @category models
 * @since 0.0.0
 */
export type IdentifierValue = typeof IdentifierValue.Type;

/**
 * A graduated email address: lowercase, NFC, ASCII A-label domain.
 *
 * @category models
 * @since 0.0.0
 */
export const NormalizedEmail = S.String.check(
  S.makeFilter(
    isFixedPoint(canonicalEmail),
    $I.annote("NormalizedEmailCheck", {
      title: "Graduated email address",
      description: "A bare mailbox already in graduated form: lowercase, NFC, UTS #46 STD3 A-label domain.",
      message: "Expected a graduated email address",
    })
  )
).pipe(S.brand("NormalizedEmail"), $I.annoteSchema("NormalizedEmail", { description: "Graduated email address." }));

/**
 * {@inheritDoc NormalizedEmail}
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizedEmail = typeof NormalizedEmail.Type;

/**
 * An E.164 phone number. Decoding checks the shape only; validity under phone
 * metadata is established at graduation (`normalizePhone`), so a stored value
 * keeps decoding after a metadata update.
 *
 * @category models
 * @since 0.0.0
 */
export const E164Phone = S.String.check(S.isPattern(e164Pattern, { message: "Expected an E.164 phone number" })).pipe(
  S.brand("E164Phone"),
  $I.annoteSchema("E164Phone", { description: "E.164 phone number." })
);

/**
 * {@inheritDoc E164Phone}
 *
 * @category models
 * @since 0.0.0
 */
export type E164Phone = typeof E164Phone.Type;

/**
 * A graduated X.500 / legacyExchangeDN address: NFC/trim and uppercase.
 *
 * @category models
 * @since 0.0.0
 */
export const NormalizedExchangeDn = S.String.check(
  S.makeFilter(
    isFixedPoint(canonicalExchangeDn),
    $I.annote("NormalizedExchangeDnCheck", {
      title: "Graduated Exchange DN",
      description: "NFC/trim, locale-independent uppercase Exchange DN.",
      message: "Expected an uppercase NFC Exchange DN",
    })
  )
).pipe(
  S.brand("NormalizedExchangeDn"),
  $I.annoteSchema("NormalizedExchangeDn", { description: "Graduated Exchange DN." })
);

/**
 * {@inheritDoc NormalizedExchangeDn}
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizedExchangeDn = typeof NormalizedExchangeDn.Type;

/**
 * A graduated username handle: NFC/trim and lowercase.
 *
 * @category models
 * @since 0.0.0
 */
export const NormalizedHandle = S.String.check(
  S.makeFilter(
    isFixedPoint(canonicalHandle),
    $I.annote("NormalizedHandleCheck", {
      title: "Graduated username handle",
      description: "NFC/trim, locale-independent lowercase handle.",
      message: "Expected a lowercase NFC handle",
    })
  )
).pipe(S.brand("NormalizedHandle"), $I.annoteSchema("NormalizedHandle", { description: "Graduated handle." }));

/**
 * {@inheritDoc NormalizedHandle}
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizedHandle = typeof NormalizedHandle.Type;

/**
 * Email address identifier; `raw` keeps the source spelling.
 *
 * @category models
 * @since 0.0.0
 */
export class EmailAddress extends S.Opaque<EmailAddress, { readonly brand: unique symbol }>()(
  S.TaggedStruct("EmailAddress", { normalized: NormalizedEmail, raw: S.String }).pipe(
    $I.annoteSchema("EmailAddress", { description: "Email address identifier." })
  )
) {}

/**
 * Phone number identifier; `raw` keeps the source spelling.
 *
 * @category models
 * @since 0.0.0
 */
export class PhoneNumber extends S.Opaque<PhoneNumber, { readonly brand: unique symbol }>()(
  S.TaggedStruct("PhoneNumber", { e164: E164Phone, raw: S.String }).pipe(
    $I.annoteSchema("PhoneNumber", { description: "Phone number identifier." })
  )
) {}

/**
 * Exchange legacyExchangeDN / X.500 identifier; `raw` keeps the source spelling.
 *
 * @category models
 * @since 0.0.0
 */
export class ExchangeDn extends S.Opaque<ExchangeDn, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ExchangeDn", { normalized: NormalizedExchangeDn, raw: S.String }).pipe(
    $I.annoteSchema("ExchangeDn", { description: "Exchange DN identifier." })
  )
) {}

/**
 * Username within one service.
 *
 * @category models
 * @since 0.0.0
 */
export class Username extends S.Opaque<Username, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Username", { service: IdentifierNamespace, handle: NormalizedHandle }).pipe(
    $I.annoteSchema("Username", { description: "Username within one service." })
  )
) {}

/**
 * Service-native account id.
 *
 * @category models
 * @since 0.0.0
 */
export class NativeAccountId extends S.Opaque<NativeAccountId, { readonly brand: unique symbol }>()(
  S.TaggedStruct("NativeAccountId", { service: IdentifierNamespace, value: IdentifierValue }).pipe(
    $I.annoteSchema("NativeAccountId", { description: "Service-native account id." })
  )
) {}

/**
 * Id issued under an external scheme namespace.
 *
 * @category models
 * @since 0.0.0
 */
export class ExternalId extends S.Opaque<ExternalId, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ExternalId", { scheme: IdentifierNamespace, value: IdentifierValue }).pipe(
    $I.annoteSchema("ExternalId", { description: "Id issued under an external scheme namespace." })
  )
) {}

/**
 * An addressable identifier. It is shareable, reassignable and recyclable, so it
 * is never a party.
 *
 * @category models
 * @since 0.0.0
 */
export const Identifier = S.Union([EmailAddress, PhoneNumber, ExchangeDn, Username, NativeAccountId, ExternalId]).pipe(
  $I.annoteSchema("Identifier", { description: "Addressable identifier; never a party." }),
  S.toTaggedUnion("_tag")
);

/**
 * {@inheritDoc Identifier}
 *
 * @category models
 * @since 0.0.0
 */
export type Identifier = typeof Identifier.Type;

/**
 * Raw phone input with optional country context for non-international numbers.
 *
 * @category models
 * @since 0.0.0
 */
export class PhoneNumberInput extends S.Opaque<PhoneNumberInput, { readonly brand: unique symbol }>()(
  S.Struct({ raw: S.String, country: S.Option(CountryCode) }).pipe(
    $I.annoteSchema("PhoneNumberInput", { description: "Raw phone input with optional country context." })
  )
) {}

/**
 * Raw username input.
 *
 * @category models
 * @since 0.0.0
 */
export class UsernameInput extends S.Opaque<UsernameInput, { readonly brand: unique symbol }>()(
  S.Struct({ service: S.String, handle: S.String }).pipe(
    $I.annoteSchema("UsernameInput", { description: "Raw username input." })
  )
) {}

/**
 * Raw native account id input.
 *
 * @category models
 * @since 0.0.0
 */
export class NativeAccountIdInput extends S.Opaque<NativeAccountIdInput, { readonly brand: unique symbol }>()(
  S.Struct({ service: S.String, value: S.String }).pipe(
    $I.annoteSchema("NativeAccountIdInput", { description: "Raw native account id input." })
  )
) {}

/**
 * Raw external id input.
 *
 * @category models
 * @since 0.0.0
 */
export class ExternalIdInput extends S.Opaque<ExternalIdInput, { readonly brand: unique symbol }>()(
  S.Struct({ scheme: S.String, value: S.String }).pipe(
    $I.annoteSchema("ExternalIdInput", { description: "Raw external id input." })
  )
) {}
