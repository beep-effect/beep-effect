/**
 * Shared identifier normalizers and graduating constructors.
 *
 * **Details**
 *
 * Identifier deduplication and PartyKey v1 generation call the same
 * normalizers, so every adapter (mail headers, contact cards, directories)
 * produces identical canonical values for the same identifier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  canonicalEmail,
  canonicalExchangeDn,
  canonicalHandle,
  canonicalText,
  graduatePhone,
} from "../../internal/IdentifierCore.ts";
import { IdentifierIssue } from "./Identifier.errors.ts";
import { EmailAddress, ExchangeDn, ExternalId, NativeAccountId, PhoneNumber, Username } from "./Identifier.model.ts";
import type { Canonical } from "../../internal/IdentifierCore.ts";
import type { IdentifierIssueField } from "./Identifier.errors.ts";
import type { ExternalIdInput, NativeAccountIdInput, PhoneNumberInput, UsernameInput } from "./Identifier.model.ts";

const liftCore = Effect.fnUntraced(function* (input: string, field: IdentifierIssueField, core: Canonical) {
  return yield* Effect.fromResult(Result.mapError(core, (reason) => IdentifierIssue.make({ reason, input, field })));
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
  return yield* liftCore(raw, "value", canonicalText(raw));
});

/**
 * Normalize a required namespace. A missing namespace is a `missing-authority`
 * issue.
 *
 * **Example** (Trim a service namespace)
 *
 * ```ts
 * import { normalizeNamespace } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(normalizeNamespace(" urn:example:directory "))) // "urn:example:directory"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeNamespace = Effect.fn("PartyIdentifier.normalizeNamespace")(function* (raw: string) {
  return yield* liftCore(
    raw,
    "namespace",
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
  return yield* liftCore(raw, "value", canonicalEmail(raw));
});

/**
 * Graduated Exchange DN normalizer: NFC/trim, locale-independent uppercase,
 * then NFC.
 *
 * **Example** (Uppercase an Exchange DN)
 *
 * ```ts
 * import { normalizeExchangeDn } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(normalizeExchangeDn("/o=ExampleOrg/cn=dana"))) // "/O=EXAMPLEORG/CN=DANA"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeExchangeDn = Effect.fn("PartyIdentifier.normalizeExchangeDn")(function* (raw: string) {
  return yield* liftCore(raw, "value", canonicalExchangeDn(raw));
});

/**
 * Graduated username-handle normalizer: NFC/trim, locale-independent lowercase,
 * then NFC.
 *
 * **Example** (Lowercase a handle)
 *
 * ```ts
 * import { normalizeUsernameHandle } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(normalizeUsernameHandle(" Dana.Example "))) // "dana.example"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeUsernameHandle = Effect.fn("PartyIdentifier.normalizeUsernameHandle")(function* (raw: string) {
  return yield* liftCore(raw, "handle", canonicalHandle(raw));
});

/**
 * Graduated phone normalizer returning E.164. A number without a leading `+`
 * needs explicit, supported country context: without it the number is
 * `ambiguous-phone`, and with an unsupported country it is
 * `unsupported-country` with `field: "country"` and the country code as `input`. Numbers that the pinned phone metadata does not
 * validate are `invalid-phone` and are never repaired.
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
  return yield* Effect.mapError(liftCore(input.raw, "value", graduatePhone(input)), (issue) =>
    issue.reason === "unsupported-country"
      ? IdentifierIssue.make({ reason: issue.reason, input: O.getOrElse(input.country, () => ""), field: "country" })
      : issue
  );
});

const decodeCase =
  <A>(decode: (input: unknown) => Effect.Effect<A, S.SchemaError>) =>
  (input: unknown) =>
    Effect.mapError(decode(input), () => IdentifierIssue.make({ reason: "invalid-basis", input: "", field: "basis" }));

const decodeEmailAddress = decodeCase(S.decodeUnknownEffect(EmailAddress, { onExcessProperty: "error" }));
const decodePhoneNumber = decodeCase(S.decodeUnknownEffect(PhoneNumber, { onExcessProperty: "error" }));
const decodeExchangeDn = decodeCase(S.decodeUnknownEffect(ExchangeDn, { onExcessProperty: "error" }));
const decodeUsername = decodeCase(S.decodeUnknownEffect(Username, { onExcessProperty: "error" }));
const decodeNativeAccountId = decodeCase(S.decodeUnknownEffect(NativeAccountId, { onExcessProperty: "error" }));
const decodeExternalId = decodeCase(S.decodeUnknownEffect(ExternalId, { onExcessProperty: "error" }));

/**
 * Graduate a raw email spelling into an `EmailAddress` identifier.
 *
 * **Example** (Graduate a mail header address)
 *
 * ```ts
 * import { emailAddress } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runSync(emailAddress("Dana Example <Dana@EXAMPLE.test>"))
 * console.log(id.normalized) // "dana@example.test"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emailAddress = Effect.fn("PartyIdentifier.emailAddress")(function* (raw: string) {
  const normalized = yield* normalizeEmail(raw);
  return yield* decodeEmailAddress({ _tag: "EmailAddress", normalized, raw });
});

/**
 * Graduate a raw phone spelling into a `PhoneNumber` identifier.
 *
 * **Example** (Graduate an international number)
 *
 * ```ts
 * import { PhoneNumberInput, phoneNumber } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const id = Effect.runSync(phoneNumber(PhoneNumberInput.make({ raw: "+1 201-555-0123", country: O.none() })))
 * console.log(id.e164) // "+12015550123"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const phoneNumber = Effect.fn("PartyIdentifier.phoneNumber")(function* (input: PhoneNumberInput) {
  const e164 = yield* normalizePhone(input);
  return yield* decodePhoneNumber({ _tag: "PhoneNumber", e164, raw: input.raw });
});

/**
 * Graduate a raw X.500 / legacyExchangeDN spelling into an `ExchangeDn` identifier.
 *
 * **Example** (Graduate an Exchange DN)
 *
 * ```ts
 * import { exchangeDn } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runSync(exchangeDn(" /o=ExampleOrg/cn=dana "))
 * console.log(id.normalized) // "/O=EXAMPLEORG/CN=DANA"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const exchangeDn = Effect.fn("PartyIdentifier.exchangeDn")(function* (raw: string) {
  const normalized = yield* normalizeExchangeDn(raw);
  return yield* decodeExchangeDn({ _tag: "ExchangeDn", normalized, raw });
});

/**
 * Graduate a handle within one service into a `Username` identifier.
 *
 * **Example** (Graduate a username within one service)
 *
 * ```ts
 * import { UsernameInput, username } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runSync(username(UsernameInput.make({ service: "https://chat.example.test", handle: "Dana" })))
 * console.log(id.handle) // "dana"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const username = Effect.fn("PartyIdentifier.username")(function* (input: UsernameInput) {
  const service = yield* normalizeNamespace(input.service);
  const handle = yield* normalizeUsernameHandle(input.handle);
  return yield* decodeUsername({ _tag: "Username", service, handle });
});

/**
 * Graduate a service-native account id; case and internal whitespace are kept.
 *
 * **Example** (Keep a native id case-sensitive)
 *
 * ```ts
 * import { NativeAccountIdInput, nativeAccountId } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runSync(nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:directory", value: " AbC-1 " })))
 * console.log(id.value) // "AbC-1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const nativeAccountId = Effect.fn("PartyIdentifier.nativeAccountId")(function* (input: NativeAccountIdInput) {
  const service = yield* normalizeNamespace(input.service);
  const value = yield* normalizeText(input.value);
  return yield* decodeNativeAccountId({ _tag: "NativeAccountId", service, value });
});

/**
 * Graduate an id issued under an external scheme namespace; case and internal
 * whitespace are kept.
 *
 * **Example** (Graduate an externally issued id)
 *
 * ```ts
 * import { ExternalIdInput, externalId } from "@beep/party-domain/Identifier"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runSync(externalId(ExternalIdInput.make({ scheme: "urn:example:bar-number", value: "AbC-1" })))
 * console.log(id.scheme) // "urn:example:bar-number"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const externalId = Effect.fn("PartyIdentifier.externalId")(function* (input: ExternalIdInput) {
  const scheme = yield* normalizeNamespace(input.scheme);
  const value = yield* normalizeText(input.value);
  return yield* decodeExternalId({ _tag: "ExternalId", scheme, value });
});
