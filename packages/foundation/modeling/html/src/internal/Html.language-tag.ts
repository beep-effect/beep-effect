/**
 * RFC 5646 language-tag validity over the package's pinned IANA registry.
 *
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { HashSet, MutableHashSet, pipe } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { IANA_LANGUAGE_TAG_REGISTRY } from "./Html.language-tag-registry.generated.ts";

const languages = HashSet.fromIterable(IANA_LANGUAGE_TAG_REGISTRY.languages);
const extlangPrefixes = IANA_LANGUAGE_TAG_REGISTRY.extlangPrefixes;
const scripts = HashSet.fromIterable(IANA_LANGUAGE_TAG_REGISTRY.scripts);
const regions = HashSet.fromIterable(IANA_LANGUAGE_TAG_REGISTRY.regions);
const variants = HashSet.fromIterable(IANA_LANGUAGE_TAG_REGISTRY.variants);
const grandfathered = HashSet.fromIterable(IANA_LANGUAGE_TAG_REGISTRY.grandfathered);

const ASCII_TAG_PATTERN = /^[A-Za-z0-9-]+$/u;
const ALPHA_PATTERN = /^[a-z]+$/u;
const REGION_PATTERN = /^(?:[a-z]{2}|[0-9]{3})$/u;
const VARIANT_PATTERN = /^(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3})$/u;
const EXTENSION_SINGLETON_PATTERN = /^[0-9a-wy-z]$/u;
const EXTENSION_SUBTAG_PATTERN = /^[a-z0-9]{2,8}$/u;
const PRIVATE_USE_SUBTAG_PATTERN = /^[a-z0-9]{1,8}$/u;

type ParsedLanguageTag = readonly [normalized: string, subtags: ReadonlyArray<string>, primary: string];

const parseLanguageTag = (value: string): O.Option<ParsedLanguageTag> => {
  if (Str.isEmpty(value) || !ASCII_TAG_PATTERN.test(value)) return O.none();

  const normalized = Str.toLowerCase(value);
  const subtags = Str.split("-")(normalized);
  const primary = subtags[0];
  return primary === undefined || A.some(subtags, Str.isEmpty) ? O.none() : O.some([normalized, subtags, primary]);
};

const isPrivateUseRange = (subtags: ReadonlyArray<string>, start: number): boolean => {
  const privateUse = A.drop(subtags, start);
  return (
    A.isReadonlyArrayNonEmpty(privateUse) && A.every(privateUse, (subtag) => PRIVATE_USE_SUBTAG_PATTERN.test(subtag))
  );
};

const isRegisteredPrimary = (primary: string): boolean =>
  primary.length >= 2 && primary.length <= 8 && ALPHA_PATTERN.test(primary) && HashSet.has(languages, primary);

const consumeExtlang = (subtags: ReadonlyArray<string>, primary: string, index: number): number => {
  const possible = subtags[index];
  return primary.length <= 3 &&
    possible !== undefined &&
    possible.length === 3 &&
    ALPHA_PATTERN.test(possible) &&
    extlangPrefixes[possible] === primary
    ? index + 1
    : index;
};

const consumeScript = (subtags: ReadonlyArray<string>, index: number): number => {
  const possible = subtags[index];
  return possible !== undefined &&
    possible.length === 4 &&
    ALPHA_PATTERN.test(possible) &&
    HashSet.has(scripts, possible)
    ? index + 1
    : index;
};

const consumeRegion = (subtags: ReadonlyArray<string>, index: number): number => {
  const possible = subtags[index];
  return possible !== undefined && REGION_PATTERN.test(possible) && HashSet.has(regions, possible) ? index + 1 : index;
};

const scanVariants = (subtags: ReadonlyArray<string>, start: number): O.Option<number> => {
  const seen = MutableHashSet.empty<string>();
  let index = start;
  let possible = subtags[index];

  while (possible !== undefined && VARIANT_PATTERN.test(possible)) {
    if (!HashSet.has(variants, possible) || MutableHashSet.has(seen, possible)) return O.none();
    MutableHashSet.add(seen, possible);
    index += 1;
    possible = subtags[index];
  }

  return O.some(index);
};

const scanExtensionPayload = (subtags: ReadonlyArray<string>, start: number): O.Option<number> => {
  let index = start;
  while (EXTENSION_SUBTAG_PATTERN.test(subtags[index] ?? "")) index += 1;
  return index === start ? O.none() : O.some(index);
};

const scanExtensions = (subtags: ReadonlyArray<string>, start: number): O.Option<number> => {
  const seen = MutableHashSet.empty<string>();
  let index = start;
  let possible = subtags[index];

  while (possible !== undefined && EXTENSION_SINGLETON_PATTERN.test(possible)) {
    if (MutableHashSet.has(seen, possible)) return O.none();
    MutableHashSet.add(seen, possible);
    const payloadEnd = scanExtensionPayload(subtags, index + 1);
    if (O.isNone(payloadEnd)) return O.none();
    index = payloadEnd.value;
    possible = subtags[index];
  }

  return O.some(index);
};

const isValidTagRemainder = (subtags: ReadonlyArray<string>, index: number): boolean =>
  subtags[index] === "x" ? isPrivateUseRange(subtags, index + 1) : index === subtags.length;

const isValidParsedLanguageTag = ([normalized, subtags, primary]: ParsedLanguageTag): boolean => {
  if (HashSet.has(grandfathered, normalized)) return true;
  if (primary === "x") return isPrivateUseRange(subtags, 1);
  if (!isRegisteredPrimary(primary)) return false;

  const remainderStart = consumeRegion(subtags, consumeScript(subtags, consumeExtlang(subtags, primary, 1)));
  return pipe(
    scanVariants(subtags, remainderStart),
    O.flatMap((index) => scanExtensions(subtags, index)),
    O.exists((index) => isValidTagRemainder(subtags, index))
  );
};

/**
 * Tests one string against RFC 5646 section 2.2.9 using the pinned IANA
 * Language Subtag Registry.
 *
 * **Details**
 *
 * Deprecated registrations remain valid. Registered extended-language subtags
 * require their IANA primary-language prefix. Extension payloads are checked
 * for RFC syntax and duplicate singletons, but not extension-specific
 * semantics, which RFC 5646 does not require a base validating processor to
 * implement.
 *
 * **Example** (Call `isValidBcp47LanguageTag`)
 *
 * ```ts
 * import { isValidBcp47LanguageTag } from "./Html.language-tag"
 *
 * console.log(isValidBcp47LanguageTag("zh-Hant-TW")) // true
 * console.log(isValidBcp47LanguageTag("en_US")) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isValidBcp47LanguageTag = (value: string): boolean =>
  pipe(parseLanguageTag(value), O.exists(isValidParsedLanguageTag));
