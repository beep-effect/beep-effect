/**
 * Graduated party identifiers and their shared normalizers.
 *
 * Identifier deduplication and PartyKey v1 generation call the same
 * normalizers, so every adapter (mail headers, contact cards, directories)
 * produces identical canonical values for the same identifier. The branded
 * value schemas re-run those normalizers as checks, so a decoded identifier
 * always holds a canonical value and a forged one fails to decode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./tr46.d.ts" />
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { CountryCode } from "@beep/schema/CountryCode";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js";
import { toASCII } from "tr46";

const $I = $PartyDomainId.create("Identifier");

const leadingTrailingWhiteSpace = /^\p{White_Space}+|\p{White_Space}+$/gu;
const unpairedSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const bareMailbox = /^([^\s<>@"]+)@([^\s<>@"]+)$/u;
const wrappedMailbox = /^[^<>]*<([^\s<>@"]+)@([^\s<>@"]+)>$/u;
const e164Pattern = /^\+[1-9][0-9]{1,14}$/u;

/**
 * Why an identifier or PartyKey basis was rejected as a data-quality issue.
 *
 * @category models
 * @since 0.0.0
 */
export const IdentifierIssueReason = LiteralKit([
  "empty-value",
  "unpaired-surrogate",
  "unparseable-mailbox",
  "invalid-domain",
  "missing-authority",
  "ambiguous-phone",
  "invalid-phone",
  "missing-source-record-identity",
  "invalid-basis",
]).pipe(
  $I.annoteSchema("IdentifierIssueReason", {
    description: "Why an identifier or PartyKey basis was rejected as a data-quality issue.",
  })
);

/**
 * {@inheritDoc IdentifierIssueReason}
 *
 * @category models
 * @since 0.0.0
 */
export type IdentifierIssueReason = typeof IdentifierIssueReason.Type;

/**
 * A data-quality issue raised while graduating an identifier or building a
 * PartyKey basis. It is never repaired by stripping or guessing.
 *
 * **Example** (Inspect an issue reason)
 *
 * ```ts
 * import { IdentifierIssue } from "@beep/party-domain/Identifier"
 *
 * const issue = IdentifierIssue.make({ reason: "invalid-domain", input: "a@-bad-.test" })
 * console.log(issue.reason) // "invalid-domain"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentifierIssue extends S.TaggedError<IdentifierIssue, { readonly brand: unique symbol }>(
  $I`IdentifierIssue`
)(
  "IdentifierIssue",
  {
    reason: IdentifierIssueReason,
    input: S.String,
  },
  $I.annoteError<IdentifierIssue>("IdentifierIssue", {
    description: "A data-quality issue raised while graduating an identifier or building a PartyKey basis.",
  })
) {}

// ---------------------------------------------------------------------------
// Pure normalization core, shared by the normalizers and the schema checks
// ---------------------------------------------------------------------------

const failWith = (reason: IdentifierIssueReason) => (): IdentifierIssueReason => reason;

const canonicalText = (raw: string): Result.Result<string, IdentifierIssueReason> =>
  unpairedSurrogate.test(raw)
    ? Result.fail("unpaired-surrogate")
    : Result.liftPredicate(
        pipe(raw, Str.normalize("NFC"), Str.replace(leadingTrailingWhiteSpace, "")),
        Str.isNonEmpty,
        failWith("empty-value")
      );

const mailboxParts = (text: string) =>
  pipe(
    O.orElse(O.fromNullishOr(bareMailbox.exec(text)), () => O.fromNullishOr(wrappedMailbox.exec(text))),
    O.flatMap((match) => O.all({ local: O.fromNullishOr(match[1]), domain: O.fromNullishOr(match[2]) }))
  );

const asciiDomain = (domain: string) =>
  O.fromNullishOr(
    toASCII(domain, {
      checkHyphens: true,
      checkBidi: true,
      checkJoiners: true,
      useSTD3ASCIIRules: true,
      verifyDNSLength: true,
      transitionalProcessing: false,
    })
  );

const canonicalEmail = (raw: string): Result.Result<string, IdentifierIssueReason> =>
  Result.flatMap(canonicalText(raw), (text) =>
    pipe(
      Result.fromOption(mailboxParts(text), failWith("unparseable-mailbox")),
      Result.flatMap(({ local, domain }) =>
        Result.map(Result.fromOption(asciiDomain(domain), failWith("invalid-domain")), (ascii) =>
          pipe(`${local}@${ascii}`, Str.toLowerCase, Str.normalize("NFC"))
        )
      )
    )
  );

const canonicalExchangeDn = (raw: string) =>
  Result.map(canonicalText(raw), (text) => pipe(text, Str.toUpperCase, Str.normalize("NFC")));

const canonicalHandle = (raw: string) =>
  Result.map(canonicalText(raw), (text) => pipe(text, Str.toLowerCase, Str.normalize("NFC")));

const canonicalPhone = (raw: string, country: O.Option<CountryCode>): Result.Result<string, IdentifierIssueReason> =>
  Result.flatMap(canonicalText(raw), (text) => {
    const international = Str.startsWith("+")(text);
    const region = O.filter(country, isSupportedCountry);
    return !international && O.isNone(region)
      ? Result.fail("ambiguous-phone")
      : Result.fromOption(
          pipe(
            O.fromNullishOr(
              international
                ? parsePhoneNumberFromString(text)
                : parsePhoneNumberFromString(text, O.getOrUndefined(region))
            ),
            O.filter((phone) => phone.isValid()),
            O.map((phone) => phone.number)
          ),
          failWith("invalid-phone")
        );
  });

const isFixedPoint =
  (normalize: (value: string) => Result.Result<string, IdentifierIssueReason>) =>
  (value: string): boolean =>
    Result.match(normalize(value), { onFailure: () => false, onSuccess: (normalized) => normalized === value });

// ---------------------------------------------------------------------------
// Branded canonical value schemas
// ---------------------------------------------------------------------------

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
 * A validated E.164 phone number.
 *
 * @category models
 * @since 0.0.0
 */
export const E164Phone = S.String.check(
  S.isPattern(e164Pattern, { message: "Expected an E.164 phone number" }),
  S.makeFilter(
    isFixedPoint((value) => canonicalPhone(value, O.none())),
    $I.annote("E164PhoneCheck", {
      title: "Valid E.164 phone number",
      description: "An E.164 number that libphonenumber validates and formats to itself.",
      message: "Expected a valid E.164 phone number",
    })
  )
).pipe(S.brand("E164Phone"), $I.annoteSchema("E164Phone", { description: "Validated E.164 phone number." }));

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

// ---------------------------------------------------------------------------
// Identifier cases
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

const liftCore = Effect.fnUntraced(function* (input: string, core: Result.Result<string, IdentifierIssueReason>) {
  return yield* Effect.fromResult(Result.mapError(core, (reason) => IdentifierIssue.make({ reason, input })));
});

/**
 * Normalize to Unicode NFC and trim leading/trailing `White_Space`, preserving
 * case and internal whitespace. Rejects empty results and unpaired surrogates.
 *
 * **Example** (Trim and compose)
 *
 * ```ts
 * import { normalizeText } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(normalizeText("  Café ")) === "Café") // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeText = Effect.fn("PartyIdentifier.normalizeText")(function* (raw: string) {
  return yield* liftCore(raw, canonicalText(raw));
});

/**
 * Normalize a required namespace. A missing namespace is a `missing-authority`
 * issue.
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeNamespace = Effect.fn("PartyIdentifier.normalizeNamespace")(function* (raw: string) {
  return yield* liftCore(
    raw,
    Result.mapError(canonicalText(raw), (reason) => (reason === "empty-value" ? "missing-authority" : reason))
  );
});

/**
 * Graduated email normalizer. Accepts either a bare `local@domain` mailbox or a
 * display name followed by exactly one `<local@domain>` and nothing after it;
 * anything else (a second `@`, quoted local parts, trailing text) is an
 * `unparseable-mailbox` issue. The domain is converted with UTS #46
 * nontransitional processing and STD3 rules to its A-label form, the whole
 * address is lowercased and NFC is applied again. Dots, plus tags and other
 * characters are preserved; no provider alias rule runs.
 *
 * **Example** (Header and card spellings agree)
 *
 * ```ts
 * import { normalizeEmail } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const header = Effect.runSync(normalizeEmail("Dana Example <Dana@EXAMPLE.test>"))
 * const card = Effect.runSync(normalizeEmail(" dana@example.test "))
 * console.log(header === card) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeEmail = Effect.fn("PartyIdentifier.normalizeEmail")(function* (raw: string) {
  return yield* liftCore(raw, canonicalEmail(raw));
});

/**
 * Graduated Exchange DN normalizer: NFC/trim, locale-independent uppercase,
 * then NFC.
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeExchangeDn = Effect.fn("PartyIdentifier.normalizeExchangeDn")(function* (raw: string) {
  return yield* liftCore(raw, canonicalExchangeDn(raw));
});

/**
 * Graduated username-handle normalizer: NFC/trim, locale-independent lowercase,
 * then NFC.
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeUsernameHandle = Effect.fn("PartyIdentifier.normalizeUsernameHandle")(function* (raw: string) {
  return yield* liftCore(raw, canonicalHandle(raw));
});

/**
 * Graduated phone normalizer returning E.164. A number without a leading `+`
 * needs explicit country context; without it the number is ambiguous and
 * rejected. Invalid numbers are rejected rather than repaired.
 *
 * **Example** (Equivalent spellings share one E.164 value)
 *
 * ```ts
 * import { normalizePhone, PhoneNumberInput } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const national = Effect.runSync(normalizePhone(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("US") })))
 * const international = Effect.runSync(normalizePhone(PhoneNumberInput.make({ raw: "+1 201 555 0123", country: O.none() })))
 * console.log(national === international) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizePhone = Effect.fn("PartyIdentifier.normalizePhone")(function* (input: PhoneNumberInput) {
  return yield* liftCore(input.raw, canonicalPhone(input.raw, input.country));
});

// ---------------------------------------------------------------------------
// Graduating constructors (decode through the case schemas)
// ---------------------------------------------------------------------------

const decodeCase =
  <A>(decode: (input: unknown) => Effect.Effect<A, S.SchemaError>) =>
  (input: unknown, raw: string) =>
    Effect.mapError(decode(input), () => IdentifierIssue.make({ reason: "invalid-basis", input: raw }));

const decodeEmailAddress = decodeCase(S.decodeUnknownEffect(EmailAddress, { onExcessProperty: "error" }));
const decodePhoneNumber = decodeCase(S.decodeUnknownEffect(PhoneNumber, { onExcessProperty: "error" }));
const decodeExchangeDn = decodeCase(S.decodeUnknownEffect(ExchangeDn, { onExcessProperty: "error" }));
const decodeUsername = decodeCase(S.decodeUnknownEffect(Username, { onExcessProperty: "error" }));
const decodeNativeAccountId = decodeCase(S.decodeUnknownEffect(NativeAccountId, { onExcessProperty: "error" }));
const decodeExternalId = decodeCase(S.decodeUnknownEffect(ExternalId, { onExcessProperty: "error" }));

/**
 * Graduate a raw email spelling into an `EmailAddress` identifier.
 *
 * @category constructors
 * @since 0.0.0
 */
export const emailAddress = Effect.fn("PartyIdentifier.emailAddress")(function* (raw: string) {
  const normalized = yield* normalizeEmail(raw);
  return yield* decodeEmailAddress({ _tag: "EmailAddress", normalized, raw }, raw);
});

/**
 * Graduate a raw phone spelling into a `PhoneNumber` identifier.
 *
 * @category constructors
 * @since 0.0.0
 */
export const phoneNumber = Effect.fn("PartyIdentifier.phoneNumber")(function* (input: PhoneNumberInput) {
  const e164 = yield* normalizePhone(input);
  return yield* decodePhoneNumber({ _tag: "PhoneNumber", e164, raw: input.raw }, input.raw);
});

/**
 * Graduate a raw X.500 / legacyExchangeDN spelling into an `ExchangeDn` identifier.
 *
 * @category constructors
 * @since 0.0.0
 */
export const exchangeDn = Effect.fn("PartyIdentifier.exchangeDn")(function* (raw: string) {
  const normalized = yield* normalizeExchangeDn(raw);
  return yield* decodeExchangeDn({ _tag: "ExchangeDn", normalized, raw }, raw);
});

/**
 * Graduate a handle within one service into a `Username` identifier.
 *
 * @category constructors
 * @since 0.0.0
 */
export const username = Effect.fn("PartyIdentifier.username")(function* (input: UsernameInput) {
  const service = yield* normalizeNamespace(input.service);
  const handle = yield* normalizeUsernameHandle(input.handle);
  return yield* decodeUsername({ _tag: "Username", service, handle }, input.handle);
});

/**
 * Graduate a service-native account id; case and internal whitespace are kept.
 *
 * @category constructors
 * @since 0.0.0
 */
export const nativeAccountId = Effect.fn("PartyIdentifier.nativeAccountId")(function* (input: NativeAccountIdInput) {
  const service = yield* normalizeNamespace(input.service);
  const value = yield* normalizeText(input.value);
  return yield* decodeNativeAccountId({ _tag: "NativeAccountId", service, value }, input.value);
});

/**
 * Graduate an id issued under an external scheme namespace; case and internal
 * whitespace are kept.
 *
 * @category constructors
 * @since 0.0.0
 */
export const externalId = Effect.fn("PartyIdentifier.externalId")(function* (input: ExternalIdInput) {
  const scheme = yield* normalizeNamespace(input.scheme);
  const value = yield* normalizeText(input.value);
  return yield* decodeExternalId({ _tag: "ExternalId", scheme, value }, input.value);
});
