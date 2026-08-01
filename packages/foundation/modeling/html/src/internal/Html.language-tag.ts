/**
 * RFC 5646 language-tag validity over the package's pinned IANA registry.
 *
 * @since 0.0.0
 */
import { HashSet, MutableHashSet } from "effect";
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

/**
 * Tests one string against RFC 5646 section 2.2.9 using the pinned IANA
 * Language Subtag Registry.
 *
 * Deprecated registrations remain valid. Registered extended-language subtags
 * require their IANA primary-language prefix. Extension payloads are checked
 * for RFC syntax and duplicate singletons, but not extension-specific
 * semantics, which RFC 5646 does not require a base validating processor to
 * implement.
 *
 * @example
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
export const isValidBcp47LanguageTag = (value: string): boolean => {
  if (value.length === 0 || !ASCII_TAG_PATTERN.test(value)) return false;
  const normalized = value.toLowerCase();
  const subtags = normalized.split("-");
  const primary = subtags[0];
  if (primary === undefined || subtags.some((subtag) => subtag.length === 0)) return false;

  if (HashSet.has(grandfathered, normalized)) return true;
  if (primary === "x") {
    return subtags.length > 1 && subtags.slice(1).every((subtag) => PRIVATE_USE_SUBTAG_PATTERN.test(subtag));
  }
  if (primary.length < 2 || primary.length > 8 || !ALPHA_PATTERN.test(primary) || !HashSet.has(languages, primary)) {
    return false;
  }

  let index = 1;
  const possibleExtlang = subtags[index];
  if (
    primary.length <= 3 &&
    possibleExtlang !== undefined &&
    possibleExtlang.length === 3 &&
    ALPHA_PATTERN.test(possibleExtlang) &&
    extlangPrefixes[possibleExtlang] === primary
  ) {
    index += 1;
  }

  const possibleScript = subtags[index];
  if (
    possibleScript !== undefined &&
    possibleScript.length === 4 &&
    ALPHA_PATTERN.test(possibleScript) &&
    HashSet.has(scripts, possibleScript)
  ) {
    index += 1;
  }

  const possibleRegion = subtags[index];
  if (possibleRegion !== undefined && REGION_PATTERN.test(possibleRegion) && HashSet.has(regions, possibleRegion)) {
    index += 1;
  }

  const seenVariants = MutableHashSet.empty<string>();
  let possibleVariant = subtags[index];
  while (possibleVariant !== undefined && VARIANT_PATTERN.test(possibleVariant)) {
    if (!HashSet.has(variants, possibleVariant) || MutableHashSet.has(seenVariants, possibleVariant)) return false;
    MutableHashSet.add(seenVariants, possibleVariant);
    index += 1;
    possibleVariant = subtags[index];
  }

  const seenSingletons = MutableHashSet.empty<string>();
  let possibleSingleton = subtags[index];
  while (possibleSingleton !== undefined && EXTENSION_SINGLETON_PATTERN.test(possibleSingleton)) {
    if (MutableHashSet.has(seenSingletons, possibleSingleton)) return false;
    MutableHashSet.add(seenSingletons, possibleSingleton);
    index += 1;
    let extensionLength = 0;
    while (EXTENSION_SUBTAG_PATTERN.test(subtags[index] ?? "")) {
      index += 1;
      extensionLength += 1;
    }
    if (extensionLength === 0) return false;
    possibleSingleton = subtags[index];
  }

  if (subtags[index] === "x") {
    index += 1;
    const privateUse = subtags.slice(index);
    return privateUse.length > 0 && privateUse.every((subtag) => PRIVATE_USE_SUBTAG_PATTERN.test(subtag));
  }
  return index === subtags.length;
};
