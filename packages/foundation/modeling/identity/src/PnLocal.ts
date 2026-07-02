/**
 * Turtle PN_LOCAL parser-side helpers and safe emission fallback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

const PN_LOCAL_ESCAPABLE = "_~.-!$&'()*+,;=/?#@%";
const HEX = /^[0-9A-Fa-f]$/;

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

/**
 * Check whether a local name can be emitted as an unescaped Turtle PN_LOCAL.
 *
 * @example
 * ```ts
 * import { isSafeLocal } from "@beep/identity"
 *
 * console.log(isSafeLocal("prefLabel")) // true
 * console.log(isSafeLocal("Ontology.models/HttpUrl")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSafeLocal = (local: string): boolean => {
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

type LocalUnit = { readonly kind: "plx" } | { readonly kind: "raw"; readonly character: string };

const tokenizeLocal = (local: string): ReadonlyArray<LocalUnit> | undefined => {
  const units: Array<LocalUnit> = [];

  for (let index = 0; index < local.length; ) {
    const character = local[index] ?? "";

    if (character === "\\") {
      const escaped = local[index + 1] ?? "";

      if (!isEscapable(escaped)) {
        return undefined;
      }

      units.push({ kind: "plx" });
      index += 2;
      continue;
    }

    if (character === "%") {
      const first = local[index + 1] ?? "";
      const second = local[index + 2] ?? "";

      if (!isHex(first) || !isHex(second)) {
        return undefined;
      }

      units.push({ kind: "plx" });
      index += 3;
      continue;
    }

    const [raw] = [...local.slice(index)];

    if (raw === undefined) {
      return undefined;
    }

    units.push({ kind: "raw", character: raw });
    index += raw.length;
  }

  return units;
};

const isFirstUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeFirst(unit.character);

const isMiddleUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeMiddle(unit.character);

const isFinalUnit = (unit: LocalUnit): boolean => unit.kind === "plx" || isSafeFinal(unit.character);

/**
 * Check whether an escaped local name is accepted by Turtle PN_LOCAL parsing.
 *
 * @example
 * ```ts
 * import { acceptsEscapedLocal } from "@beep/identity"
 *
 * console.log(acceptsEscapedLocal("Ontology.models\\/HttpUrl")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const acceptsEscapedLocal = (local: string): boolean => {
  const units = tokenizeLocal(local);

  if (units === undefined || units.length === 0 || !isFirstUnit(units[0] ?? { kind: "raw", character: "" })) {
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

/**
 * Remove Turtle PN_LOCAL backslash escapes from an escaped local name.
 *
 * @example
 * ```ts
 * import { unescapeLocal } from "@beep/identity"
 *
 * console.log(unescapeLocal("Ontology.models\\/HttpUrl")) // "Ontology.models/HttpUrl"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const unescapeLocal = (local: string): string => local.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, "$1");

/**
 * Escape characters that Turtle permits through PN_LOCAL backslash escapes.
 *
 * @remarks
 * Escaped-local emission currently feeds codec parity tests only. Writer-side
 * identity output uses {@link prefixedNameOrIri} and falls back to full IRIs
 * for unsafe locals.
 *
 * @example
 * ```ts
 * import { escapeLocal } from "@beep/identity"
 *
 * console.log(escapeLocal("Ontology.models/HttpUrl")) // "Ontology\\.models\\/HttpUrl"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const escapeLocal = (local: string): string => local.replace(/[_~.\-!$&'()*+,;=/?#@%]/g, "\\$&");

/**
 * Emit a prefixed name only when the local part is safe, otherwise emit a full IRI reference.
 *
 * @example
 * ```ts
 * import { prefixedNameOrIri } from "@beep/identity"
 *
 * const rendered = prefixedNameOrIri("beep", "Ontology.models/HttpUrl", "https://ns.beep.sh/Ontology.models/HttpUrl")
 * console.log(rendered) // "<https://ns.beep.sh/Ontology.models/HttpUrl>"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const prefixedNameOrIri = (prefix: string, local: string, fullIri: string): string =>
  isSafeLocal(local) ? `${prefix}:${local}` : `<${fullIri}>`;
