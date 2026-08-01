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

const skipAsciiWhitespace = (input: string, start: number): number => {
  let position = start;

  while (position < Str.length(input) && pipe(characterAt(input, position), O.exists(isAsciiWhitespace))) {
    position += 1;
  }

  return position;
};

const scanUrl = (input: string, start: number): number => {
  let position = start;

  while (
    position < Str.length(input) &&
    pipe(
      characterAt(input, position),
      O.exists((character) => !isAsciiWhitespace(character))
    )
  ) {
    position += 1;
  }

  return position;
};

const scanDescriptor = (input: string, start: number): number => {
  let position = start;

  while (
    position < Str.length(input) &&
    pipe(
      characterAt(input, position),
      O.exists((character) => !isAsciiWhitespace(character) && !Str.Equivalence(character, ","))
    )
  ) {
    position += 1;
  }

  return position;
};

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

/**
 * Descriptor profile represented by a conforming `srcset` value.
 *
 * @example
 * ```ts
 * import { SrcsetProfile } from "@beep/html/Html.srcset"
 *
 * console.log(SrcsetProfile.is.width("width")) // true
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
 * @example
 * ```ts
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
 * A descriptorless candidate belongs to the density profile and is equivalent
 * to `1x` for duplicate detection.
 *
 * @example
 * ```ts
 * import { inspectSrcset } from "@beep/html/Html.srcset"
 * import * as O from "effect/Option"
 *
 * const result = inspectSrcset("small.png 1x, large.png 2x", () => true)
 * console.log(O.getOrNull(result)) // "density"
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

  const register = (descriptor: ParsedDescriptor): boolean => {
    if (descriptor[0] === "width") {
      if (
        pipe(
          profile,
          O.exists((current) => Str.Equivalence(current, "density"))
        ) ||
        MutableHashSet.has(widthValues, descriptor[1])
      ) {
        return false;
      }

      profile = O.some("width");
      MutableHashSet.add(widthValues, descriptor[1]);
      return true;
    }

    if (
      pipe(
        profile,
        O.exists((current) => Str.Equivalence(current, "width"))
      ) ||
      MutableHashSet.has(densityValues, descriptor[1])
    ) {
      return false;
    }

    profile = O.some("density");
    MutableHashSet.add(densityValues, descriptor[1]);
    return true;
  };

  while (position < Str.length(input)) {
    position = skipAsciiWhitespace(input, position);

    if (position >= Str.length(input) || characterAtIs(input, position, ",")) {
      return O.none();
    }

    const urlStart = position;
    position = scanUrl(input, position);

    let urlEnd = position;
    let trailingCommas = 0;

    while (urlEnd > urlStart && characterAtIs(input, urlEnd - 1, ",")) {
      urlEnd -= 1;
      trailingCommas += 1;
    }

    if (trailingCommas > 1) {
      return O.none();
    }

    const url = pipe(input, Str.slice(urlStart, urlEnd));

    if (Str.isEmpty(url) || pipe(url, Str.startsWith(",")) || pipe(url, Str.endsWith(",")) || !isValidUrl(url)) {
      return O.none();
    }

    let descriptor = makeDensityDescriptor(defaultDensityKey);
    let hasSeparator = trailingCommas === 1;

    if (!hasSeparator) {
      position = skipAsciiWhitespace(input, position);

      if (position < Str.length(input) && characterAtIs(input, position, ",")) {
        position += 1;
        hasSeparator = true;
      } else if (position < Str.length(input)) {
        const descriptorStart = position;
        position = scanDescriptor(input, position);

        const parsedDescriptor = pipe(input, Str.slice(descriptorStart, position), parseDescriptor);

        if (O.isNone(parsedDescriptor)) {
          return O.none();
        }

        descriptor = parsedDescriptor.value;
        position = skipAsciiWhitespace(input, position);

        if (position < Str.length(input)) {
          if (!characterAtIs(input, position, ",")) {
            return O.none();
          }

          position += 1;
          hasSeparator = true;
        }
      }
    }

    if (!register(descriptor)) {
      return O.none();
    }

    if (!hasSeparator) {
      return profile;
    }
  }

  return O.none();
});
