/**
 * Turtle PN_LOCAL parser-side helpers and safe emission fallback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const PN_LOCAL_ESCAPABLE = "_~.-!$&'()*+,;=/?#@%";
const HEX = /^[0-9A-Fa-f]$/;
const SafePnLocalArbitraryValues = ["prefLabel", "a.b", "9lives", "_local", "skos:prefLabel"] as const;
const EscapedPnLocalArbitraryValues = ["prefLabel", "Ontology.models\\/HttpUrl", "claim\\#1", "a%20b"] as const;
const SafePnPrefixArbitraryValues = ["skos", "beep", "schema.org", "ns_1"] as const;
const IriReferenceUnsafeCharacter = /[\u0000-\u0020<>"{}|^`\\]/gu;

const codePointOf = (character: string): number | undefined => character.codePointAt(0);

const isBetween = (value: number, min: number, max: number): boolean => value >= min && value <= max;

const isDigit = (character: string): boolean => {
  const codePoint = codePointOf(character);
  return codePoint !== undefined && isBetween(codePoint, 0x30, 0x39);
};

const isHex = (character: string): boolean => HEX.test(character);

const isPnCharsBase = (character: string): boolean => {
  const codePoint = codePointOf(character);

  return (
    codePoint !== undefined &&
    (isBetween(codePoint, 0x41, 0x5a) ||
      isBetween(codePoint, 0x61, 0x7a) ||
      isBetween(codePoint, 0xc0, 0xd6) ||
      isBetween(codePoint, 0xd8, 0xf6) ||
      isBetween(codePoint, 0xf8, 0x2ff) ||
      isBetween(codePoint, 0x370, 0x37d) ||
      isBetween(codePoint, 0x37f, 0x1fff) ||
      isBetween(codePoint, 0x200c, 0x200d) ||
      isBetween(codePoint, 0x2070, 0x218f) ||
      isBetween(codePoint, 0x2c00, 0x2fef) ||
      isBetween(codePoint, 0x3001, 0xd7ff) ||
      isBetween(codePoint, 0xf900, 0xfdcf) ||
      isBetween(codePoint, 0xfdf0, 0xfffd) ||
      isBetween(codePoint, 0x10000, 0xeffff))
  );
};

const isPnCharsU = (character: string): boolean => isPnCharsBase(character) || character === "_";

const isPnChars = (character: string): boolean => {
  const codePoint = codePointOf(character);

  return (
    isPnCharsU(character) ||
    character === "-" ||
    isDigit(character) ||
    codePoint === 0xb7 ||
    (codePoint !== undefined && (isBetween(codePoint, 0x300, 0x36f) || isBetween(codePoint, 0x203f, 0x2040)))
  );
};

const isEscapable = (character: string): boolean => PN_LOCAL_ESCAPABLE.includes(character);

const isSafeFirst = (character: string): boolean => isPnCharsU(character) || character === ":" || isDigit(character);

const isSafeMiddle = (character: string): boolean => isPnChars(character) || character === "." || character === ":";

const isSafeFinal = (character: string): boolean => isPnChars(character) || character === ":";

const isSafeLocalInternal = (local: string): boolean => {
  const characters = [...local];

  if (characters.length === 0 || !isSafeFirst(characters[0] ?? "")) {
    return false;
  }

  if (characters.length === 1) {
    return true;
  }

  const final = characters.at(-1);

  if (final === undefined || !isSafeFinal(final)) {
    return false;
  }

  return characters.slice(1, -1).every(isSafeMiddle);
};

const isSafePrefixInternal = (prefix: string): boolean => {
  const characters = [...prefix];

  if (characters.length === 0 || !isPnCharsBase(characters[0] ?? "")) {
    return false;
  }

  if (characters.length === 1) {
    return true;
  }

  const final = characters.at(-1);

  if (final === undefined || !isPnChars(final)) {
    return false;
  }

  return characters.slice(1, -1).every((character) => isPnChars(character) || character === ".");
};

const percentEncodeCharacter = (character: string): string => {
  const codePoint = character.codePointAt(0) ?? 0;
  return `%${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
};

const iriReferenceValue = (iri: string): string => iri.replace(IriReferenceUnsafeCharacter, percentEncodeCharacter);

/**
 * Schema for local names that can be emitted as unescaped Turtle PN_LOCAL values.
 *
 * **Example** (Validate safe local name)
 *
 * ```ts import.meta.vitest name="Validate safe local name"
 * import * as S from "effect/Schema"
 * import { SafePnLocal } from "@beep/identity"
 *
 * S.is(SafePnLocal)("prefLabel") // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const SafePnLocal = S.String.check(
  S.makeFilter(isSafeLocalInternal, {
    identifier: "@beep/identity/PnLocal/SafePnLocal",
    title: "Safe PN_LOCAL",
    description: "A local name that can be emitted as an unescaped Turtle PN_LOCAL value.",
    message: "Expected an unescaped Turtle PN_LOCAL value.",
  })
).annotate({
  identifier: "@beep/identity/PnLocal/SafePnLocal",
  title: "Safe PN_LOCAL",
  description: "A local name that can be emitted as an unescaped Turtle PN_LOCAL value.",
  toArbitrary: () => (fc) => fc.constantFrom(...SafePnLocalArbitraryValues),
});

/**
 * Runtime type for {@link SafePnLocal}.
 *
 * **Example** (Type a safe local)
 *
 * ```ts
 * import type { SafePnLocal } from "@beep/identity"
 *
 * const local: SafePnLocal = "prefLabel"
 * console.log(local)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export type SafePnLocal = typeof SafePnLocal.Type;

const isSafePnLocal = S.is(SafePnLocal);

/**
 * Schema for namespace prefixes that can be emitted as unescaped Turtle PN_PREFIX values.
 *
 * **Example** (Validate safe prefix)
 *
 * ```ts import.meta.vitest name="Validate safe prefix"
 * import * as S from "effect/Schema"
 * import { SafePnPrefix } from "@beep/identity"
 *
 * S.is(SafePnPrefix)("skos") // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const SafePnPrefix = S.String.check(
  S.makeFilter(isSafePrefixInternal, {
    identifier: "@beep/identity/PnLocal/SafePnPrefix",
    title: "Safe PN_PREFIX",
    description: "A namespace prefix that can be emitted as an unescaped Turtle PN_PREFIX value.",
    message: "Expected an unescaped Turtle PN_PREFIX value.",
  })
).annotate({
  identifier: "@beep/identity/PnLocal/SafePnPrefix",
  title: "Safe PN_PREFIX",
  description: "A namespace prefix that can be emitted as an unescaped Turtle PN_PREFIX value.",
  toArbitrary: () => (fc) => fc.constantFrom(...SafePnPrefixArbitraryValues),
});

/**
 * Runtime type for {@link SafePnPrefix}.
 *
 * **Example** (Type a safe prefix)
 *
 * ```ts
 * import type { SafePnPrefix } from "@beep/identity"
 *
 * const prefix: SafePnPrefix = "skos"
 * console.log(prefix)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export type SafePnPrefix = typeof SafePnPrefix.Type;

const isSafePnPrefix = S.is(SafePnPrefix);

/**
 * Check whether a local name can be emitted as an unescaped Turtle PN_LOCAL.
 *
 * **Example** (Check safe local names)
 *
 * ```ts import.meta.vitest name="Check safe local names"
 * import { isSafeLocal } from "@beep/identity"
 *
 * isSafeLocal("prefLabel") // => true
 * isSafeLocal("Ontology.models/HttpUrl") // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSafeLocal = (local: string): boolean => isSafePnLocal(local);

/**
 * Check whether a namespace prefix can be emitted as an unescaped Turtle PN_PREFIX.
 *
 * **Example** (Check safe prefixes)
 *
 * ```ts import.meta.vitest name="Check safe prefixes"
 * import { isSafePrefix } from "@beep/identity"
 *
 * isSafePrefix("skos") // => true
 * isSafePrefix("bad:prefix") // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSafePrefix = (prefix: string): boolean => isSafePnPrefix(prefix);

type LocalUnit = { readonly kind: "plx" } | { readonly kind: "raw"; readonly character: string };

const tokenizeLocal = (local: string): O.Option<ReadonlyArray<LocalUnit>> => {
  const units: Array<LocalUnit> = [];

  for (let index = 0; index < local.length; ) {
    const character = local[index] ?? "";

    if (character === "\\") {
      const escaped = local[index + 1] ?? "";

      if (!isEscapable(escaped)) {
        return O.none();
      }

      units.push({ kind: "plx" });
      index += 2;
      continue;
    }

    if (character === "%") {
      const first = local[index + 1] ?? "";
      const second = local[index + 2] ?? "";

      if (!isHex(first) || !isHex(second)) {
        return O.none();
      }

      units.push({ kind: "plx" });
      index += 3;
      continue;
    }

    const [raw] = [...local.slice(index)];

    if (raw === undefined) {
      return O.none();
    }

    units.push({ kind: "raw", character: raw });
    index += raw.length;
  }

  return O.some(units);
};

const isFirstUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeFirst(unit.character);

const isMiddleUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeMiddle(unit.character);

const isFinalUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeFinal(unit.character);

const acceptsEscapedUnits = (units: ReadonlyArray<LocalUnit>): boolean => {
  if (units.length === 0 || !isFirstUnit(units[0] ?? { kind: "raw", character: "" })) {
    return false;
  }

  if (units.length === 1) {
    return true;
  }

  const final = units.at(-1);

  if (final === undefined || !isFinalUnit(final)) {
    return false;
  }

  return units.slice(1, -1).every(isMiddleUnit);
};

const acceptsEscapedLocalInternal = (local: string): boolean =>
  O.match(tokenizeLocal(local), {
    onNone: () => false,
    onSome: acceptsEscapedUnits,
  });

/**
 * Schema for escaped local names accepted by Turtle PN_LOCAL parsing.
 *
 * **Example** (Validate escaped local name)
 *
 * ```ts import.meta.vitest name="Validate escaped local name"
 * import * as S from "effect/Schema"
 * import { EscapedPnLocal } from "@beep/identity"
 *
 * S.is(EscapedPnLocal)("Ontology.models\\/HttpUrl") // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const EscapedPnLocal = S.String.check(
  S.makeFilter(acceptsEscapedLocalInternal, {
    identifier: "@beep/identity/PnLocal/EscapedPnLocal",
    title: "Escaped PN_LOCAL",
    description: "A local name with Turtle PN_LOCAL parser-side escapes accepted at the parser boundary.",
    message: "Expected a Turtle PN_LOCAL value with valid parser-side escapes.",
  })
).annotate({
  identifier: "@beep/identity/PnLocal/EscapedPnLocal",
  title: "Escaped PN_LOCAL",
  description: "A local name with Turtle PN_LOCAL parser-side escapes accepted at the parser boundary.",
  toArbitrary: () => (fc) => fc.constantFrom(...EscapedPnLocalArbitraryValues),
});

/**
 * Runtime type for {@link EscapedPnLocal}.
 *
 * **Example** (Type an escaped local)
 *
 * ```ts
 * import type { EscapedPnLocal } from "@beep/identity"
 *
 * const local: EscapedPnLocal = "Ontology.models\\/HttpUrl"
 * console.log(local)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export type EscapedPnLocal = typeof EscapedPnLocal.Type;

const isEscapedPnLocal = S.is(EscapedPnLocal);

/**
 * Check whether an escaped local name is accepted by Turtle PN_LOCAL parsing.
 *
 * **Example** (Accept escaped local name)
 *
 * ```ts import.meta.vitest name="Accept escaped local name"
 * import { acceptsEscapedLocal } from "@beep/identity"
 *
 * acceptsEscapedLocal("Ontology.models\\/HttpUrl") // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const acceptsEscapedLocal = (local: string): boolean => isEscapedPnLocal(local);

/**
 * Remove Turtle PN_LOCAL backslash escapes from an escaped local name.
 *
 * **Example** (Unescape local name)
 *
 * ```ts import.meta.vitest name="Unescape local name"
 * import { unescapeLocal } from "@beep/identity"
 *
 * unescapeLocal("Ontology.models\\/HttpUrl") // => "Ontology.models/HttpUrl"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const unescapeLocal = (local: string): string => local.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, "$1");

/**
 * Escape characters that Turtle permits through PN_LOCAL backslash escapes.
 *
 * **Details**
 *
 * Escaped-local emission currently feeds codec parity tests only. Writer-side
 * identity output uses {@link prefixedNameOrIri} and falls back to full IRIs
 * for unsafe locals.
 *
 * **Example** (Escape local name)
 *
 * ```ts import.meta.vitest name="Escape local name"
 * import { escapeLocal } from "@beep/identity"
 *
 * escapeLocal("Ontology.models/HttpUrl") // => "Ontology\\.models\\/HttpUrl"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const escapeLocal = (local: string): string => local.replace(/[_~.\-!$&'()*+,;=/?#@%]/g, "\\$&");

/**
 * Emit a prefixed name only when the prefix and local part are safe, otherwise emit a full IRI reference.
 *
 * **Example** (Emit prefixed name or IRI)
 *
 * ```ts
 * import { prefixedNameOrIri } from "@beep/identity"
 *
 * const rendered = prefixedNameOrIri("Ontology.models/HttpUrl", {
 *   prefix: "beep",
 *   fullIri: "https://ns.beep.sh/Ontology.models/HttpUrl"
 * })
 * console.log(rendered) // "<https://ns.beep.sh/Ontology.models/HttpUrl>"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const prefixedNameOrIri: {
  (local: string, options: { readonly prefix: string; readonly fullIri: string }): string;
  (options: { readonly prefix: string; readonly fullIri: string }): (local: string) => string;
} = dual(2, (local: string, options: { readonly prefix: string; readonly fullIri: string }): string =>
  isSafePrefix(options.prefix) && isSafeLocal(local)
    ? `${options.prefix}:${local}`
    : `<${iriReferenceValue(options.fullIri)}>`
);
