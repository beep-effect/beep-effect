/**
 * Normalization of one mail address as a provider or a table reports it.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { EmailString } from "@beep/schema/Email";
import { flow } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const bracketedAddressPattern = /<([^<>]*)>/u;
const surroundingQuotesPattern = /^['"\s]+|['"\s]+$/gu;

const decodeAddress = S.decodeUnknownOption(EmailString);

// `Name <addr>` keeps the bracketed part; any other entry is read whole.
const bracketedOrWhole = (raw: string): string =>
  O.getOrElse(O.flatMap(Str.match(bracketedAddressPattern)(raw), A.get(1)), () => raw);

/**
 * Reads one mail address out of a bare address, a quoted address, or one
 * `Name <address>` header entry.
 *
 * **Details**
 *
 * The bracketed part of a header entry is kept, surrounding single or double
 * quotes and whitespace are stripped, and the rest is decoded as a normalized
 * `EmailString`, which lowercases it. Anything that is not then one usable
 * address is none, never a failure.
 *
 * **Example** (Read a quoted address)
 *
 * ```ts
 * import { mailAddressOf } from "./MailAddress.ts"
 *
 * console.log(mailAddressOf("'Pat@Example.test'")) // Option.some("pat@example.test")
 * ```
 *
 * @internal
 * @param raw - Address as the provider or table reports it.
 * @returns The normalized address, when the input holds one.
 * @category parsers
 * @since 0.0.0
 */
export const mailAddressOf: (raw: string) => O.Option<EmailString> = flow(
  bracketedOrWhole,
  Str.replaceAll(surroundingQuotesPattern, ""),
  decodeAddress
);
