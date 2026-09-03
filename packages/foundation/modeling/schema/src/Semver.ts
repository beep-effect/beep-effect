/**
 * Schema-backed Semantic Versioning value object and comparison helpers.
 *
 * **Example** (Decode and format version)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Semver, SemverFromString } from "@beep/schema/Semver"
 *
 * const program = Effect.gen(function* () {
 *   const version = yield* S.decodeUnknownEffect(SemverFromString)("v1.2.3-rc.1+build.5")
 *   return Semver.format(version)
 * })
 *
 * const formatted = await Effect.runPromise(program)
 * console.log(formatted)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect, flow, Match, Number as N, pipe, SchemaGetter, SchemaIssue } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaUtils from "./SchemaUtils/index.ts";
import type * as Ordering from "effect/Ordering";
import type * as AST from "effect/SchemaAST";

const $I = $SchemaId.create("Semver");

const semverNumericIdentifierPattern = /^(?:0|[1-9]\d*)$/;
const semverPrereleaseIdentifierPattern = /^(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)$/;
const semverBuildIdentifierPattern = /^[0-9A-Za-z-]+$/;
const rangeComparatorPattern = /^(\^|>=|>|<=|<|=)?(.+)$/;
const comparatorSpacePattern = /(\^|>=|>|<=|<|=)\s+(v?)/g;

const SemverNumberSegmentString = S.String.check(
  S.isPattern(semverNumericIdentifierPattern, {
    identifier: $I`SemverNumberSegmentStringCheck`,
    title: "Semver Number Segment String",
    description: "A SemVer numeric identifier with no leading zeroes unless the value is exactly zero.",
    message: "SemVer numeric identifiers must be non-negative integers without leading zeroes",
  })
).pipe(
  $I.annoteSchema("SemverNumberSegmentString", {
    description: "A SemVer numeric identifier string.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

const SemverNumberSegment = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`SemverNumberSegmentNonNegativeCheck`,
    title: "Semver Number Segment Non Negative",
    description: "A SemVer numeric segment must be zero or greater.",
    message: "SemVer numeric segments must be non-negative integers",
  })
).pipe(
  $I.annoteSchema("SemverNumberSegment", {
    description: "A safe non-negative integer segment in a semantic version.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

const SemverPrereleaseIdentifier = S.String.check(
  S.isPattern(semverPrereleaseIdentifierPattern, {
    identifier: $I`SemverPrereleaseIdentifierCheck`,
    title: "Semver Prerelease Identifier",
    description:
      "A SemVer prerelease identifier: numeric identifiers cannot have leading zeroes, while alphanumeric identifiers may include ASCII letters, digits, and hyphens.",
    message: "SemVer prerelease identifiers must be numeric or ASCII alphanumeric-hyphen identifiers",
  })
).pipe(
  $I.annoteSchema("SemverPrereleaseIdentifier", {
    description: "A SemVer prerelease identifier.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

const SemverBuildIdentifier = S.String.check(
  S.isPattern(semverBuildIdentifierPattern, {
    identifier: $I`SemverBuildIdentifierCheck`,
    title: "Semver Build Identifier",
    description: "A SemVer build metadata identifier made from ASCII letters, digits, and hyphens.",
    message: "SemVer build identifiers must contain only ASCII letters, digits, and hyphens",
  })
).pipe(
  $I.annoteSchema("SemverBuildIdentifier", {
    description: "A SemVer build metadata identifier.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

const RangeComparatorOperator = S.Literals(["^", ">=", ">", "<=", "<", "="]).pipe(
  $I.annoteSchema("RangeComparatorOperator", {
    description: "Comparator operator supported by the lightweight SemVer range checker.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption"])
);

type RangeComparatorOperator = typeof RangeComparatorOperator.Type;

type RangeComparator = {
  readonly operator: RangeComparatorOperator;
  readonly version: Semver;
};

const isSemverNumberSegmentString = SemverNumberSegmentString.is;
const isSemverNumberSegment = SemverNumberSegment.is;
const isSemverPrereleaseIdentifier = SemverPrereleaseIdentifier.is;
const isSemverBuildIdentifier = SemverBuildIdentifier.is;
const decodeRangeComparatorOperator = RangeComparatorOperator.decodeUnknownOption;

const equalOrdering: Ordering.Ordering = 0;
const greaterThanOrdering: Ordering.Ordering = 1;
const lessThanOrdering: Ordering.Ordering = -1;

const joinDot = A.join(".");
const splitTrim = (separator: string | RegExp): ((value: string) => ReadonlyArray<string>) =>
  flow(Str.split(separator), A.map(Str.trim));
const splitTrimNonEmpty = (separator: string | RegExp): ((value: string) => ReadonlyArray<string>) =>
  flow(splitTrim(separator), A.filter(Str.isNonEmpty));

const splitOnce =
  (separator: string) =>
  (value: string): readonly [string, O.Option<string>] => {
    const segments = Str.split(separator)(value);
    const head = pipe(
      segments,
      A.head,
      O.getOrElse(() => "")
    );
    const tail = pipe(
      segments,
      A.tail,
      O.filter((values) => A.length(values) > 0),
      O.map(A.join(separator))
    );

    return [head, tail];
  };

const normalizeMainSegments = (segments: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.length(segments) === 2 ? A.append(segments, "0") : segments;

const normalizeOptionalSegments = (segments: O.Option<string>, prefix: "-" | "+"): string =>
  pipe(
    segments,
    O.map(splitTrim(".")),
    O.map(joinDot),
    O.map((value) => `${prefix}${value}`),
    O.getOrElse(() => "")
  );

const getMatchGroup = (match: RegExpMatchArray, index: number): O.Option<string> =>
  pipe(match, A.get(index), O.flatMap(O.fromNullishOr));

const parseNumberSegment: (value: string) => O.Option<number> = flow(
  O.liftPredicate(isSemverNumberSegmentString),
  O.flatMap(N.parse),
  O.filter(isSemverNumberSegment)
);

const parseIdentifierList =
  (isIdentifier: (value: string) => boolean) =>
  (value: string): O.Option<ReadonlyArray<string>> => {
    const segments = splitTrim(".")(value);

    return pipe(
      segments,
      A.match({
        onEmpty: O.none,
        onNonEmpty: (values) => (A.every(values, isIdentifier) ? O.some(values) : O.none()),
      })
    );
  };

const parseOptionalIdentifierList = (
  isIdentifier: (value: string) => boolean
): ((value: O.Option<string>) => O.Option<ReadonlyArray<string>>) =>
  flow(
    O.map(parseIdentifierList(isIdentifier)),
    O.getOrElse(() => O.some(A.empty<string>()))
  );

const parseMain = (value: string): O.Option<Readonly<{ major: number; minor: number; patch: number }>> => {
  const segments = splitTrim(".")(value);

  return pipe(
    O.all({
      major: pipe(segments, A.get(0), O.flatMap(parseNumberSegment)),
      minor: pipe(segments, A.get(1), O.flatMap(parseNumberSegment)),
      patch: pipe(segments, A.get(2), O.flatMap(parseNumberSegment)),
    }),
    O.filter(() => A.length(segments) === 3)
  );
};

const compareFirstNonEqual: (comparisons: ReadonlyArray<Ordering.Ordering>) => Ordering.Ordering = flow(
  A.findFirst((ordering) => ordering !== equalOrdering),
  O.getOrElse(() => equalOrdering)
);

const compareIdentifierLength = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): Ordering.Ordering =>
  N.Order(A.length(left), A.length(right));

const comparePrereleaseSegments = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): Ordering.Ordering =>
  pipe(
    left,
    A.match({
      onEmpty: () =>
        pipe(
          right,
          A.match({
            onEmpty: () => equalOrdering,
            onNonEmpty: () => greaterThanOrdering,
          })
        ),
      onNonEmpty: (leftSegments) =>
        pipe(
          right,
          A.match({
            onEmpty: () => lessThanOrdering,
            onNonEmpty: (rightSegments) => {
              const ordering = A.reduce<readonly [string, string], Ordering.Ordering>(
                A.zip(leftSegments, rightSegments),
                equalOrdering,
                (current, [leftIdentifier, rightIdentifier]) =>
                  current === equalOrdering
                    ? Semver.comparePreReleaseIdentifier(leftIdentifier, rightIdentifier)
                    : current
              );

              return ordering === equalOrdering ? compareIdentifierLength(leftSegments, rightSegments) : ordering;
            },
          })
        ),
    })
  );

const parseComparatorOperator: (value: O.Option<string>) => O.Option<RangeComparatorOperator> = flow(
  O.filter(Str.isNonEmpty),
  O.orElseSome(() => "="),
  O.flatMap(decodeRangeComparatorOperator)
);

const parseComparator: (value: string) => O.Option<RangeComparator> = flow(
  Str.trim,
  Str.match(rangeComparatorPattern),
  O.flatMap((match) =>
    pipe(
      O.all({
        operator: parseComparatorOperator(getMatchGroup(match, 1)),
        version: pipe(getMatchGroup(match, 2), O.flatMap(Semver.fromStr)),
      }),
      O.map(({ operator, version }) => ({
        operator,
        version,
      }))
    )
  )
);

const parseComparatorGroup: (group: string) => O.Option<ReadonlyArray<RangeComparator>> = flow(
  Str.trim,
  Str.replaceAll(comparatorSpacePattern, "$1$2"),
  splitTrimNonEmpty(/\s+/),
  A.match({
    onEmpty: O.none,
    onNonEmpty: flow(A.map(parseComparator), O.all),
  })
);

const compareToRangeTarget = (version: Semver, target: Semver): Ordering.Ordering => Semver.compare(version, target);

const satisfiesCaretRange = (version: Semver, target: Semver): boolean => {
  const compared = compareToRangeTarget(version, target);

  return (
    compared >= equalOrdering &&
    (target.major > 0
      ? version.major === target.major
      : target.minor > 0
        ? version.major === 0 && version.minor === target.minor
        : version.major === 0 && version.minor === 0 && version.patch === target.patch)
  );
};

const satisfiesComparator = (version: Semver, comparator: RangeComparator): boolean => {
  const compared = compareToRangeTarget(version, comparator.version);

  return Match.type<RangeComparatorOperator>().pipe(
    Match.when("^", () => satisfiesCaretRange(version, comparator.version)),
    Match.when(">=", () => compared >= equalOrdering),
    Match.when(">", () => compared > equalOrdering),
    Match.when("<=", () => compared <= equalOrdering),
    Match.when("<", () => compared < equalOrdering),
    Match.when("=", () => compared === equalOrdering),
    Match.exhaustive
  )(comparator.operator);
};

const parseSemver = (value: string): O.Option<Semver> => {
  const normalized = Semver.normalizeStr(value);
  const [withoutBuild, build] = splitOnce("+")(normalized);
  const [main, prerelease] = splitOnce("-")(withoutBuild);

  return pipe(
    O.all({
      main: parseMain(main),
      prerelease: parseOptionalIdentifierList(isSemverPrereleaseIdentifier)(prerelease),
      build: parseOptionalIdentifierList(isSemverBuildIdentifier)(build),
    }),
    O.flatMap(({ main, prerelease, build }) =>
      Semver.decodeOption({
        major: main.major,
        minor: main.minor,
        patch: main.patch,
        prerelease,
        build,
      })
    )
  );
};

const decodeSemverFromString = (value: string): Effect.Effect<Semver, SchemaIssue.Issue> =>
  pipe(
    Semver.fromStr(value),
    Effect.fromOption(
      () =>
        new SchemaIssue.InvalidValue({
          message: "Expected a valid semantic version string",
        })
    )
  );

const encodeSemverToString = (value: Semver): Effect.Effect<string> => Effect.succeed(Semver.format(value));

/**
 * Structured semantic version value object.
 *
 * **Gotchas**
 *
 * `prerelease` participates in precedence ordering. `build` is preserved for
 * formatting and round trips, but it is ignored by {@link Semver.compare}
 * according to the SemVer precedence rules.
 *
 * **Example** (Make and format version)
 *
 * ```ts import.meta.vitest name="Make and format version"
 * import { Semver } from "@beep/schema/Semver"
 *
 * const version = Semver.make({
 *   major: 1,
 *   minor: 2,
 *   patch: 3,
 *   prerelease: ["rc", "1"],
 *   build: ["20260629"],
 * })
 *
 * Semver.format(version) // => "1.2.3-rc.1+20260629"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Semver extends S.Class<Semver>($I`Semver`)(
  {
    major: SemverNumberSegment,
    minor: SemverNumberSegment,
    patch: SemverNumberSegment,
    prerelease: S.Array(SemverPrereleaseIdentifier),
    build: S.Array(SemverBuildIdentifier),
  },
  $I.annote("Semver", {
    description: "Structured semantic version with core, prerelease, and build metadata segments.",
  })
) {
  static readonly decodeOption: {
    (input: unknown, options?: AST.ParseOptions): O.Option<Semver>;
    (options?: AST.ParseOptions): (input: unknown) => O.Option<Semver>;
  } = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownOption(Semver));

  /**
   * Normalizes supported loose boundary strings before strict SemVer parsing.
   *
   * **Details**
   *
   * This trims whitespace, removes a leading `v`, trims dot-separated
   * identifiers, and expands `MAJOR.MINOR` to `MAJOR.MINOR.0`. It does not make
   * invalid values valid; parsing still rejects malformed segments.
   *
   * **Example** (Normalize loose version string)
   *
   * ```ts import.meta.vitest name="Normalize loose version string"
   * import { Semver } from "@beep/schema/Semver"
   *
   * Semver.normalizeStr(" v1.2-rc.1 ") // => "1.2.0-rc.1"
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  static readonly normalizeStr = (version: string): string => {
    const normalized = pipe(version, Str.trim, Str.replace(/^v/, ""));
    const [withoutBuild, build] = splitOnce("+")(normalized);
    const [main, prerelease] = splitOnce("-")(withoutBuild);
    const normalizedMain = pipe(main, splitTrim("."), normalizeMainSegments, joinDot);

    return `${normalizedMain}${normalizeOptionalSegments(prerelease, "-")}${normalizeOptionalSegments(build, "+")}`;
  };

  /**
   * Parses a supported SemVer boundary string into a structured value.
   *
   * **Example** (Parse version string)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Semver } from "@beep/schema/Semver"
   *
   * const parsed = Semver.fromStr("v2.4")
   * const formatted = O.map(parsed, Semver.format)
   * console.log(formatted)
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly fromStr = (value: string): O.Option<Semver> => parseSemver(value);

  /**
   * Splits a prerelease string into validated SemVer prerelease identifiers.
   *
   * **Example** (Split prerelease identifiers)
   *
   * ```ts import.meta.vitest name="Split prerelease identifiers"
   * import * as O from "effect/Option"
   * import { Semver } from "@beep/schema/Semver"
   *
   * O.getOrThrow(Semver.preReleaseSegmentsFromStr("alpha.1")) // => ["alpha", "1"]
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly preReleaseSegmentsFromStr = (prerelease: string): O.Option<ReadonlyArray<string>> =>
    parseIdentifierList(isSemverPrereleaseIdentifier)(prerelease);

  /**
   * Formats a structured SemVer value back to a canonical string.
   *
   * **Example** (Format structured version)
   *
   * ```ts import.meta.vitest name="Format structured version"
   * import { Semver } from "@beep/schema/Semver"
   *
   * const version = Semver.make({ major: 1, minor: 0, patch: 0, prerelease: [], build: ["7"] })
   * Semver.format(version) // => "1.0.0+7"
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  static readonly format = (value: Semver): string => {
    const prerelease = pipe(
      value.prerelease,
      A.match({
        onEmpty: () => "",
        onNonEmpty: (segments) => `-${joinDot(segments)}`,
      })
    );
    const build = pipe(
      value.build,
      A.match({
        onEmpty: () => "",
        onNonEmpty: (segments) => `+${joinDot(segments)}`,
      })
    );

    return `${value.major}.${value.minor}.${value.patch}${prerelease}${build}`;
  };

  /**
   * Compares two prerelease identifiers using SemVer precedence rules.
   *
   * **Example** (Compare prerelease identifiers)
   *
   * ```ts import.meta.vitest name="Compare prerelease identifiers"
   * import { Semver } from "@beep/schema/Semver"
   *
   * Semver.comparePreReleaseIdentifier("2", "11") // => -1
   * Semver.comparePreReleaseIdentifier("alpha", "beta") // => -1
   * ```
   *
   * @category ordering
   * @since 0.0.0
   */
  static readonly comparePreReleaseIdentifier: {
    (right: string): (left: string) => Ordering.Ordering;
    (left: string, right: string): Ordering.Ordering;
  } = dual(2, (left: string, right: string): Ordering.Ordering => {
    const leftNumeric = isSemverNumberSegmentString(left);
    const rightNumeric = isSemverNumberSegmentString(right);

    if (leftNumeric && rightNumeric) {
      return pipe(
        O.all({
          left: parseNumberSegment(left),
          right: parseNumberSegment(right),
        }),
        O.map(({ left, right }) => N.Order(left, right)),
        O.getOrElse(() => Str.localeCompare(right)(left))
      );
    }
    if (leftNumeric) {
      return lessThanOrdering;
    }
    if (rightNumeric) {
      return greaterThanOrdering;
    }
    return Str.localeCompare(right)(left);
  });

  /**
   * Compares two versions using SemVer precedence.
   *
   * **Gotchas**
   *
   * String inputs are normalized with {@link Semver.normalizeStr} and parsed
   * before comparison. If either string cannot be parsed, comparison falls back
   * to lexical ordering of the formatted inputs.
   *
   * **Example** (Compare version precedence)
   *
   * ```ts import.meta.vitest name="Compare version precedence"
   * import { Semver } from "@beep/schema/Semver"
   *
   * Semver.compare("1.0.0-alpha", "1.0.0") // => -1
   * Semver.compare("1.0.0+1", "1.0.0+2") // => 0
   * ```
   *
   * @category ordering
   * @since 0.0.0
   */
  static readonly compare: {
    (right: string | Semver): (left: string | Semver) => Ordering.Ordering;
    (left: string | Semver, right: string | Semver): Ordering.Ordering;
  } = dual(2, (left: string | Semver, right: string | Semver): Ordering.Ordering => {
    const leftSemver = P.isString(left) ? Semver.fromStr(left) : O.some(left);
    const rightSemver = P.isString(right) ? Semver.fromStr(right) : O.some(right);

    return pipe(
      O.all({
        left: leftSemver,
        right: rightSemver,
      }),
      O.map(({ left, right }) =>
        compareFirstNonEqual([
          N.Order(left.major, right.major),
          N.Order(left.minor, right.minor),
          N.Order(left.patch, right.patch),
          comparePrereleaseSegments(left.prerelease, right.prerelease),
        ])
      ),
      O.getOrElse(() =>
        Str.localeCompare(P.isString(right) ? right : Semver.format(right))(
          P.isString(left) ? left : Semver.format(left)
        )
      )
    );
  });

  /**
   * Checks whether a version satisfies a small SemVer comparator range.
   *
   * **Details**
   *
   * Supported syntax is intentionally small: whitespace-separated comparators,
   * `||` range groups, and the `^`, `>=`, `>`, `<=`, `<`, and `=` operators.
   * Build metadata is ignored for precedence comparisons.
   *
   * **Example** (Check version range satisfaction)
   *
   * ```ts import.meta.vitest name="Check version range satisfaction"
   * import { Semver } from "@beep/schema/Semver"
   *
   * Semver.satisfiesRange("v20.1.0", "^18.0.0 || ^20.0.0") // => true
   * Semver.satisfiesRange("2.0.0", "^1.2.3") // => false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly satisfiesRange: {
    (range: string): (rawVersion: string) => boolean;
    (rawVersion: string, range: string): boolean;
  } = dual(2, (rawVersion: string, range: string): boolean =>
    pipe(
      Semver.fromStr(rawVersion),
      O.map((version) =>
        pipe(
          range,
          splitTrimNonEmpty("||"),
          A.some((group) =>
            pipe(
              parseComparatorGroup(group),
              O.map(A.every((comparator) => satisfiesComparator(version, comparator))),
              O.getOrElse(() => false)
            )
          )
        )
      ),
      O.getOrElse(() => false)
    )
  );
}

/**
 * Codec that decodes supported SemVer strings into {@link Semver} values.
 *
 * **Example** (Decode SemVer string codec)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Semver, SemverFromString } from "@beep/schema/Semver"
 *
 * const program = Effect.gen(function* () {
 *   const version = yield* S.decodeUnknownEffect(SemverFromString)("v1.2")
 *   return Semver.format(version)
 * })
 *
 * const formatted = await Effect.runPromise(program)
 * console.log(formatted)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SemverFromString = S.String.pipe(
  S.decodeTo(Semver, {
    decode: SchemaGetter.transformOrFail(decodeSemverFromString),
    encode: SchemaGetter.transformOrFail(encodeSemverToString),
  }),
  $I.annoteSchema("SemverFromString", {
    description: "Codec that decodes supported semantic version strings into structured Semver values.",
  })
);

/**
 * Type for {@link SemverFromString}.
 *
 * **Example** (Annotate SemverFromString type)
 *
 * ```ts
 * import { Semver } from "@beep/schema/Semver"
 * import type { SemverFromString } from "@beep/schema/Semver"
 *
 * const parsed: SemverFromString = Semver.make({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] })
 * console.log(Semver.format(parsed))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemverFromString = typeof SemverFromString.Type;
