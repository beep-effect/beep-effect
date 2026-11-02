/**
 * Pure identifier normalization core shared by the graduating normalizers and
 * the branded value-schema checks. Private to `@beep/party-domain`.
 *
 * @since 0.0.0
 */
/// <reference path="../tr46.d.ts" />

import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js";
import { toASCII } from "tr46";
import type { IdentifierIssueReason } from "../values/Identifier/Identifier.errors.ts";
import type { PhoneNumberInput } from "../values/Identifier/Identifier.model.ts";

const leadingTrailingWhiteSpace = /^\p{White_Space}+|\p{White_Space}+$/gu;
const unpairedSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const bareMailbox = /^([^\s<>@"]+)@([^\s<>@"]+)$/u;
const wrappedMailbox = /^[^<>]*<([^\s<>@"]+)@([^\s<>@"]+)>$/u;

/**
 * E.164 shape: `+`, a non-zero leading digit, at most 15 digits.
 *
 * @since 0.0.0
 */
export const e164Pattern = /^\+[1-9][0-9]{1,14}$/u;

/**
 * Normalization outcome.
 *
 * @since 0.0.0
 */
export type Canonical = Result.Result<string, IdentifierIssueReason>;

const failWith = (reason: IdentifierIssueReason) => (): IdentifierIssueReason => reason;

/**
 * NFC, then trim leading/trailing `White_Space`; reject unpaired surrogates and
 * empty results.
 *
 * @since 0.0.0
 */
export const canonicalText = (raw: string): Canonical =>
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

/**
 * Graduated email: strict mailbox grammar, UTS #46 nontransitional STD3 domain,
 * whole-address lowercase, NFC.
 *
 * @since 0.0.0
 */
export const canonicalEmail = (raw: string): Canonical =>
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

/**
 * Graduated Exchange DN: NFC/trim, uppercase, NFC.
 *
 * @since 0.0.0
 */
export const canonicalExchangeDn = (raw: string): Canonical =>
  Result.map(canonicalText(raw), (text) => pipe(text, Str.toUpperCase, Str.normalize("NFC")));

/**
 * Graduated username handle: NFC/trim, lowercase, NFC.
 *
 * @since 0.0.0
 */
export const canonicalHandle = (raw: string): Canonical =>
  Result.map(canonicalText(raw), (text) => pipe(text, Str.toLowerCase, Str.normalize("NFC")));

/**
 * Graduated phone: a number without `+` needs a supported country; the parsed
 * number must be valid under the pinned `libphonenumber-js` metadata. Returns
 * E.164.
 *
 * @since 0.0.0
 */
export const graduatePhone = ({ raw, country }: PhoneNumberInput): Canonical =>
  Result.flatMap(canonicalText(raw), (text) => {
    const international = Str.startsWith("+")(text);
    const region = O.filter(country, isSupportedCountry);
    if (!international && O.isNone(country)) {
      return Result.fail("ambiguous-phone");
    }
    if (!international && O.isNone(region)) {
      return Result.fail("unsupported-country");
    }
    return Result.fromOption(
      pipe(
        O.fromNullishOr(
          international ? parsePhoneNumberFromString(text) : parsePhoneNumberFromString(text, O.getOrUndefined(region))
        ),
        O.filter((phone) => phone.isValid()),
        O.map((phone) => phone.number)
      ),
      failWith("invalid-phone")
    );
  });

/**
 * A value is canonical when normalizing it succeeds and returns it unchanged.
 *
 * @since 0.0.0
 */
export const isFixedPoint =
  (normalize: (value: string) => Canonical) =>
  (value: string): boolean =>
    Result.match(normalize(value), { onFailure: () => false, onSuccess: (normalized) => normalized === value });
