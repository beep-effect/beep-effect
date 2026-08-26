/**
 * WHATWG author-conformance validation for `srcset` attributes.
 *
 * @packageDocumentation \@beep/html/Html.srcset
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { BigInt as BI, flow, MutableHashSet, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const $I = $HtmlId.create("Html.srcset");

const ASCII_WHITESPACE_PATTERN = /^[\t\n\f\r ]$/u;
const WIDTH_DESCRIPTOR_PATTERN = /^([0-9]+)w$/u;
const DENSITY_DESCRIPTOR_PATTERN = /^(?:([0-9]+)(?:\.([0-9]+))?|\.([0-9]+))(?:[eE]([+-]?)([0-9]+))?x$/u;
const LEADING_ZEROS_PATTERN = /^0+/u;
const TRAILING_ZEROS_PATTERN = /0+$/u;

type DensityKey = string;
type ParsedDescriptor = readonly [profile: "width", value: string] | readonly [profile: "density", value: DensityKey];
type ParsedCandidate = readonly [descriptor: ParsedDescriptor, position: number, hasSeparator: boolean];
type ParsedCandidateUrl = readonly [position: number, hasSeparator: boolean];

const BIGINT_ZERO = BI.BigInt(0);
const BIGINT_NEGATIVE_ONE = BI.BigInt(-1);
const makeDensityKey = (coefficient: string, exponent: bigint): DensityKey => `${coefficient}:${exponent}`;
const makeWidthDescriptor = (value: string): ParsedDescriptor => ["width", value];
const makeDensityDescriptor = (value: DensityKey): ParsedDescriptor => ["density", value];
const defaultDensityKey = makeDensityKey("1", BIGINT_ZERO);

const isAsciiWhitespace = flow(Str.match(ASCII_WHITESPACE_PATTERN), O.isSome);
const characterAt = (input: string, index: number): O.Option<string> => Str.charAt(input, index);
const characterAtIs = (input: string, index: number, expected: string): boolean =>
  pipe(
    characterAt(input, index),
    O.exists((character) => Str.Equivalence(character, expected))
  );

const scanWhile = (input: string, start: number, predicate: (character: string) => boolean): number => {
  let position = start;

  while (position < Str.length(input) && pipe(characterAt(input, position), O.exists(predicate))) {
    position += 1;
  }

  return position;
};

const skipAsciiWhitespace = (input: string, start: number): number => scanWhile(input, start, isAsciiWhitespace);

const scanUrl = (input: string, start: number): number =>
  scanWhile(input, start, (character) => !isAsciiWhitespace(character));

const scanDescriptor = (input: string, start: number): number =>
  scanWhile(input, start, (character) => !isAsciiWhitespace(character) && !Str.Equivalence(character, ","));

const normalizeWidth = flow(Str.replace(LEADING_ZEROS_PATTERN, ""), O.liftPredicate(Str.isNonEmpty));

const densityKey = flow(
  Str.match(DENSITY_DESCRIPTOR_PATTERN),
  O.flatMap((match) => {
    const [, integer = "", fraction = "", leadingDotFraction = "", exponentSign = "", exponentDigits = "0"] = match;
    const decimal = Str.isNonEmpty(fraction) ? fraction : leadingDotFraction;
    const significant = pipe(integer, Str.concat(decimal), Str.replace(LEADING_ZEROS_PATTERN, ""));

    if (Str.isEmpty(significant)) {
      return O.none();
    }

    const coefficient = pipe(significant, Str.replace(TRAILING_ZEROS_PATTERN, ""));
    const trailingZeros = Str.length(significant) - Str.length(coefficient);

    return pipe(
      BI.fromString(exponentDigits),
      O.map((explicitExponent) => {
        const signedExponent = Str.Equivalence(exponentSign, "-")
          ? pipe(explicitExponent, BI.multiply(BIGINT_NEGATIVE_ONE))
          : explicitExponent;
        const exponent = pipe(
          signedExponent,
          BI.subtract(BI.BigInt(Str.length(decimal))),
          BI.sum(BI.BigInt(trailingZeros))
        );

        return makeDensityKey(coefficient, exponent);
      })
    );
  })
);

const parseDescriptor = (descriptor: string): O.Option<ParsedDescriptor> =>
  pipe(
    descriptor,
    Str.match(WIDTH_DESCRIPTOR_PATTERN),
    O.flatMap((match) => {
      const [, digits = ""] = match;
      return pipe(digits, normalizeWidth, O.map(makeWidthDescriptor));
    }),
    O.orElse(() => pipe(descriptor, densityKey, O.map(makeDensityDescriptor)))
  );

const trimTrailingCommas = (input: string, start: number, end: number): readonly [number, number] => {
  let urlEnd = end;
  let trailingCommas = 0;

  while (urlEnd > start && characterAtIs(input, urlEnd - 1, ",")) {
    urlEnd -= 1;
    trailingCommas += 1;
  }

  return [urlEnd, trailingCommas];
};

const parseCandidateUrl = (
  input: string,
  start: number,
  isValidUrl: (url: string) => boolean
): O.Option<ParsedCandidateUrl> => {
  const position = scanUrl(input, start);
  const [urlEnd, trailingCommas] = trimTrailingCommas(input, start, position);
  const url = pipe(input, Str.slice(start, urlEnd));

  return trailingCommas > 1 ||
    Str.isEmpty(url) ||
    pipe(url, Str.startsWith(",")) ||
    pipe(url, Str.endsWith(",")) ||
    !isValidUrl(url)
    ? O.none()
    : O.some([position, trailingCommas === 1]);
};

const finishDescriptorCandidate = (
  input: string,
  descriptor: ParsedDescriptor,
  start: number
): O.Option<ParsedCandidate> => {
  const position = skipAsciiWhitespace(input, start);
  if (position >= Str.length(input)) return O.some([descriptor, position, false]);
  return characterAtIs(input, position, ",") ? O.some([descriptor, position + 1, true]) : O.none();
};

const parseCandidateDescriptor = (input: string, start: number, hasSeparator: boolean): O.Option<ParsedCandidate> => {
  const descriptorless = makeDensityDescriptor(defaultDensityKey);
  if (hasSeparator) return O.some([descriptorless, start, true]);

  const position = skipAsciiWhitespace(input, start);
  if (position >= Str.length(input)) return O.some([descriptorless, position, false]);
  if (characterAtIs(input, position, ",")) return O.some([descriptorless, position + 1, true]);

  const descriptorEnd = scanDescriptor(input, position);
  return pipe(
    input,
    Str.slice(position, descriptorEnd),
    parseDescriptor,
    O.flatMap((descriptor) => finishDescriptorCandidate(input, descriptor, descriptorEnd))
  );
};

const parseCandidate = (
  input: string,
  start: number,
  isValidUrl: (url: string) => boolean
): O.Option<ParsedCandidate> =>
  pipe(
    parseCandidateUrl(input, start, isValidUrl),
    O.flatMap(([position, hasSeparator]) => parseCandidateDescriptor(input, position, hasSeparator))
  );

const registerDescriptor = (
  descriptor: ParsedDescriptor,
  profile: O.Option<SrcsetProfile>,
  widthValues: MutableHashSet.MutableHashSet<string>,
  densityValues: MutableHashSet.MutableHashSet<DensityKey>
): O.Option<SrcsetProfile> => {
  const nextProfile = descriptor[0];
  const values = nextProfile === "width" ? widthValues : densityValues;
  if (
    pipe(
      profile,
      O.exists((current) => !Str.Equivalence(current, nextProfile))
    ) ||
    MutableHashSet.has(values, descriptor[1])
  ) {
    return O.none();
  }

  MutableHashSet.add(values, descriptor[1]);
  return O.some(nextProfile);
};

/**
 * Descriptor profile represented by a conforming `srcset` value.
 *
 * **Example** (Width profile membership check)
 *
 * ```ts import.meta.vitest name="Width profile membership check"
 * import { SrcsetProfile } from "@beep/html/Html.srcset"
 *
 * SrcsetProfile.is.width("width") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SrcsetProfile = LiteralKit(["width", "density"]).pipe(
  $I.annoteSchema("SrcsetProfile", {
    description: "The mutually exclusive width or pixel-density descriptor profile of a srcset value.",
  })
);

/**
 * Decoded type of {@link SrcsetProfile}.
 *
 * **Example** (Density profile type assignment)
 *
 * ```ts import.meta.vitest name="Density profile type assignment"
 * import type { SrcsetProfile } from "@beep/html/Html.srcset"
 *
 * const profile: SrcsetProfile = "density"
 * console.log(profile)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SrcsetProfile = typeof SrcsetProfile.Type;

/**
 * Validates a `srcset` value against the WHATWG authoring grammar and returns
 * its descriptor profile. The URL callback keeps URL syntax ownership at the
 * caller's HTML boundary.
 *
 * **Details**
 *
 * A descriptorless candidate belongs to the density profile and is equivalent
 * to `1x` for duplicate detection.
 *
 * **Example** (Inspect density srcset profile)
 *
 * ```ts import.meta.vitest name="Inspect density srcset profile"
 * import { inspectSrcset } from "@beep/html/Html.srcset"
 * import * as O from "effect/Option"
 *
 * const result = inspectSrcset("small.png 1x, large.png 2x", () => true)
 * O.getOrNull(result) // => "density"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectSrcset: {
  (isValidUrl: (url: string) => boolean): (input: string) => O.Option<SrcsetProfile>;
  (input: string, isValidUrl: (url: string) => boolean): O.Option<SrcsetProfile>;
} = dual(2, (input: string, isValidUrl: (url: string) => boolean): O.Option<SrcsetProfile> => {
  let position = 0;
  let profile = O.none<SrcsetProfile>();
  const widthValues = MutableHashSet.empty<string>();
  const densityValues = MutableHashSet.empty<DensityKey>();

  while (position < Str.length(input)) {
    position = skipAsciiWhitespace(input, position);
    const candidate = parseCandidate(input, position, isValidUrl);
    if (O.isNone(candidate)) return O.none();

    const [descriptor, nextPosition, hasSeparator] = candidate.value;
    const registered = registerDescriptor(descriptor, profile, widthValues, densityValues);
    if (O.isNone(registered)) return O.none();

    profile = registered;
    position = nextPosition;
    if (!hasSeparator) return profile;
  }

  return O.none();
});
