import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Context, Effect, Equal, FileSystem, HashSet, Layer, Number as N, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ByteDrift, ByteExpectation, verifyByteExpectations } from "@/corpus/ByteWitness";

const $I = $SemanticaId.create("fixtures/F1");

const fixtureIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Branded kebab-case identifier for one synthetic F1 document.
 *
 * **Example** (Recognize a fixture id)
 *
 * ```ts
 * import { isF1FixtureId } from "@/fixtures/F1"
 *
 * console.log(isF1FixtureId("md-structure")) // true
 * console.log(isF1FixtureId("MdStructure")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const F1FixtureId = S.String.check(
  S.isPattern(fixtureIdPattern, {
    identifier: $I`F1FixtureIdPattern`,
    title: "F1 fixture id syntax",
    description: "A non-empty lowercase kebab-case synthetic fixture identifier.",
    message: "F1 fixture id must use lowercase kebab-case syntax.",
  })
).pipe(
  S.brand("F1FixtureId"),
  $I.annoteSchema("F1FixtureId", {
    description: "Branded lowercase kebab-case identifier for one F1 fixture.",
  })
);

/**
 * Decoded value accepted by {@link F1FixtureId}.
 *
 * @see {@link F1FixtureId} for validation and branding.
 * @category models
 * @since 0.0.0
 */
export type F1FixtureId = typeof F1FixtureId.Type;

/**
 * Schema-derived guard for F1 fixture ids.
 *
 * **Example** (Narrow an unknown fixture id)
 *
 * ```ts
 * import { isF1FixtureId } from "@/fixtures/F1"
 *
 * const value: unknown = "html-article"
 * console.log(isF1FixtureId(value)) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isF1FixtureId = S.is(F1FixtureId);

/**
 * Media types covered by the deterministic F1 corpus.
 *
 * **Example** (Check the PDF media type)
 *
 * ```ts
 * import { FixtureMediaType } from "@/fixtures/F1"
 *
 * console.log(FixtureMediaType.is["application/pdf"]("application/pdf")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FixtureMediaType = LiteralKit(["text/markdown", "text/html", "application/pdf"]).annotate(
  $I.annote("FixtureMediaType", {
    description: "Markdown, HTML, and born-digital PDF media types exercised by F1.",
  })
);

/**
 * Decoded literal accepted by {@link FixtureMediaType}.
 *
 * @see {@link FixtureMediaType} for literal helpers and validation.
 * @category models
 * @since 0.0.0
 */
export type FixtureMediaType = typeof FixtureMediaType.Type;

/**
 * Expected parser outcome for an F1 document.
 *
 * **Example** (Check a degraded expectation)
 *
 * ```ts
 * import { FixtureExpectation } from "@/fixtures/F1"
 *
 * console.log(FixtureExpectation.is.degraded("degraded")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FixtureExpectation = LiteralKit(["parses", "degraded"]).annotate(
  $I.annote("FixtureExpectation", {
    description: "Expected successful parse or declared typed degradation for an F1 fixture.",
  })
);

/**
 * Decoded literal accepted by {@link FixtureExpectation}.
 *
 * @see {@link FixtureExpectation} for literal helpers and validation.
 * @category models
 * @since 0.0.0
 */
export type FixtureExpectation = typeof FixtureExpectation.Type;

/**
 * Declared malformed-input class for a degraded F1 document.
 *
 * **Example** (Check invalid UTF-8 degradation)
 *
 * ```ts
 * import { FixtureDegradedKind } from "@/fixtures/F1"
 *
 * console.log(FixtureDegradedKind.is["invalid-utf8"]("invalid-utf8")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FixtureDegradedKind = LiteralKit(["invalid-utf8", "truncated", "malformed-structure"]).annotate(
  $I.annote("FixtureDegradedKind", {
    description: "Invalid UTF-8, truncation, or malformed structure declared by a degraded F1 fixture.",
  })
);

/**
 * Decoded literal accepted by {@link FixtureDegradedKind}.
 *
 * @see {@link FixtureDegradedKind} for literal helpers and validation.
 * @category models
 * @since 0.0.0
 */
export type FixtureDegradedKind = typeof FixtureDegradedKind.Type;

const F1FixtureFields = S.Struct({
  id: F1FixtureId,
  relativePath: S.NonEmptyString,
  mediaType: FixtureMediaType,
  expectation: FixtureExpectation,
  degradedKind: S.OptionFromNullOr(FixtureDegradedKind),
  sha256: Sha256Hex,
  bytes: NonNegativeInt,
  summary: S.NonEmptyString,
});

const F1FixtureExpectationCheck = S.makeFilter(
  (fixture: typeof F1FixtureFields.Type) =>
    FixtureExpectation.$match(fixture.expectation, {
      parses: () => O.isNone(fixture.degradedKind),
      degraded: () => O.isSome(fixture.degradedKind),
    }),
  {
    identifier: $I`F1FixtureExpectationCheck`,
    title: "F1 fixture expected outcome",
    description: "Requires degraded fixtures to name a degradation and parsing fixtures to omit one.",
    message: "F1 degradedKind must be Some exactly when expectation is degraded.",
  }
);

const F1FixtureDefinition = F1FixtureFields.check(F1FixtureExpectationCheck);

/**
 * Content-addressed metadata and expected parser outcome for one synthetic document.
 *
 * **Example** (Create a parsing Markdown fixture)
 *
 * ```ts
 * import { F1Fixture, F1FixtureId } from "@/fixtures/F1"
 * import { NonNegativeInt, Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const fixture = F1Fixture.make({
 *   id: F1FixtureId.make("md-structure"),
 *   relativePath: "documents/md-structure.md",
 *   mediaType: "text/markdown",
 *   expectation: "parses",
 *   degradedKind: O.none(),
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   bytes: NonNegativeInt.make(12),
 *   summary: "Structured synthetic paper."
 * })
 * console.log(fixture.expectation) // "parses"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class F1Fixture extends S.Class<F1Fixture>($I`F1Fixture`)(
  F1FixtureDefinition,
  $I.annote("F1Fixture", {
    description: "Content-addressed F1 document metadata with a declared parser outcome.",
  })
) {}

const F1IndexFields = S.Struct({
  schemaVersion: S.Literal("f1-index/v1"),
  fixtures: S.NonEmptyArray(F1Fixture),
});

type F1IndexFields = typeof F1IndexFields.Type;

const f1FixtureIdsAreUnique = (index: F1IndexFields): boolean =>
  Equal.equals(
    HashSet.size(HashSet.fromIterable(A.map(index.fixtures, (fixture) => fixture.id))),
    A.length(index.fixtures)
  );

const countFixtures = (index: F1IndexFields, mediaType: FixtureMediaType, expectation: FixtureExpectation): number =>
  A.length(
    A.filter(
      index.fixtures,
      (fixture) => Str.Equivalence(fixture.mediaType, mediaType) && Str.Equivalence(fixture.expectation, expectation)
    )
  );

const f1HasOneDegradedPerMediaType = (index: F1IndexFields): boolean =>
  A.every(FixtureMediaType.Options, (mediaType) => Equal.equals(countFixtures(index, mediaType, "degraded"), 1));

const f1HasTwoParsingFixturesPerMediaType = (index: F1IndexFields): boolean =>
  A.every(FixtureMediaType.Options, (mediaType) =>
    N.isGreaterThanOrEqualTo(countFixtures(index, mediaType, "parses"), 2)
  );

const F1IndexChecks = S.makeFilterGroup([
  S.makeFilter(f1FixtureIdsAreUnique, {
    identifier: $I`F1FixtureIdsUnique`,
    title: "F1 fixture id uniqueness",
    description: "Requires every synthetic F1 document to carry a unique fixture id.",
    message: "F1 fixture ids must be unique.",
  }),
  S.makeFilter(f1HasOneDegradedPerMediaType, {
    identifier: $I`F1OneDegradedPerMediaType`,
    title: "F1 degraded media coverage",
    description: "Requires exactly one declared degraded fixture for each F1 media type.",
    message: "F1 must contain exactly one degraded fixture per media type.",
  }),
  S.makeFilter(f1HasTwoParsingFixturesPerMediaType, {
    identifier: $I`F1TwoParsingPerMediaType`,
    title: "F1 parsing media coverage",
    description: "Requires at least two parsing fixtures for each F1 media type.",
    message: "F1 must contain at least two parsing fixtures per media type.",
  }),
]);

const F1IndexDefinition = F1IndexFields.check(F1IndexChecks);

/**
 * Schema-refined index of every committed F1 document and expected parser outcome.
 *
 * **Example** (Inspect the index version)
 *
 * ```ts
 * import { F1Index } from "@/fixtures/F1"
 *
 * console.log(F1Index.fields.schemaVersion.literal) // "f1-index/v1"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class F1Index extends S.Class<F1Index>($I`F1Index`)(
  F1IndexDefinition,
  $I.annote("F1Index", {
    description: "Validated F1 fixture index with deterministic coverage and uniqueness constraints.",
  })
) {}

const F1DriftKind = LiteralKit(["missing-file", "sha256-mismatch", "bytes-mismatch"]);

/**
 * Row-level drift between the F1 index and a committed fixture file.
 *
 * **Example** (Construct a missing-file drift)
 *
 * ```ts
 * import { F1Diff, F1FixtureId } from "@/fixtures/F1"
 *
 * const diff = F1Diff.cases["missing-file"].make({
 *   id: F1FixtureId.make("html-article"),
 *   relativePath: "documents/html-article.html"
 * })
 * console.log(diff.kind) // "missing-file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const F1Diff = F1DriftKind.toTaggedUnion("kind")({
  "missing-file": {
    id: F1FixtureId,
    relativePath: S.NonEmptyString,
  },
  "sha256-mismatch": {
    id: F1FixtureId,
    relativePath: S.NonEmptyString,
    expectedSha256: Sha256Hex,
    actualSha256: Sha256Hex,
  },
  "bytes-mismatch": {
    id: F1FixtureId,
    relativePath: S.NonEmptyString,
    expectedBytes: NonNegativeInt,
    actualBytes: NonNegativeInt,
  },
}).pipe(
  $I.annoteSchema("F1Diff", {
    description: "Exhaustive missing-file, hash-mismatch, and byte-mismatch F1 drift details.",
  })
);

/**
 * Runtime type for {@link F1Diff}.
 *
 * @see {@link F1Diff} for constructors and discriminator-aware helpers.
 * @category models
 * @since 0.0.0
 */
export type F1Diff = typeof F1Diff.Type;

/**
 * Reports that `fixtures/f1/index.json` could not be read or decoded.
 *
 * **Example** (Construct an index decode failure)
 *
 * ```ts
 * import { F1IndexDecodeFailed } from "@/fixtures/F1"
 *
 * const error = F1IndexDecodeFailed.make({
 *   message: "F1 index is invalid.",
 *   indexPath: "fixtures/f1/index.json"
 * })
 * console.log(error._tag) // "F1IndexDecodeFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class F1IndexDecodeFailed extends S.TaggedError<F1IndexDecodeFailed>($I`F1IndexDecodeFailed`)(
  "F1IndexDecodeFailed",
  {
    message: S.NonEmptyString,
    indexPath: S.NonEmptyString,
  },
  $I.annoteError<F1IndexDecodeFailed>("F1IndexDecodeFailed", {
    description: "Typed boundary failure for unreadable or schema-invalid F1 index JSON.",
  })
) {}

/**
 * Reports all missing, hash-mismatched, or byte-mismatched F1 fixture files.
 *
 * **Example** (Inspect a drift error)
 *
 * ```ts
 * import { F1Diff, F1Drift, F1FixtureId } from "@/fixtures/F1"
 *
 * const error = F1Drift.make({
 *   message: "F1 fixture drift detected.",
 *   indexPath: "fixtures/f1/index.json",
 *   diffs: [F1Diff.cases["missing-file"].make({
 *     id: F1FixtureId.make("html-article"),
 *     relativePath: "documents/html-article.html"
 *   })]
 * })
 * console.log(error.diffs[0].kind) // "missing-file"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class F1Drift extends S.TaggedError<F1Drift>($I`F1Drift`)(
  "F1Drift",
  {
    message: S.NonEmptyString,
    indexPath: S.NonEmptyString,
    diffs: S.NonEmptyArray(F1Diff),
  },
  $I.annoteError<F1Drift>("F1Drift", {
    description: "Typed failure carrying every mismatch between the F1 index and committed fixture bytes.",
  })
) {}

/**
 * Service shape for loading and verifying the committed F1 index.
 *
 * @category services
 * @since 0.0.0
 */
export interface F1CatalogShape {
  readonly load: Effect.Effect<F1Index, F1IndexDecodeFailed | F1Drift>;
}

/**
 * App-local catalog that decodes the F1 index and verifies every fixture hash and byte length.
 *
 * **Example** (Describe an F1 load)
 *
 * ```ts
 * import { F1Catalog } from "@/fixtures/F1"
 * import { Effect } from "effect"
 *
 * const load = F1Catalog.pipe(Effect.flatMap((catalog) => catalog.load))
 * console.log(Effect.isEffect(load)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class F1Catalog extends Context.Service<F1Catalog, F1CatalogShape>()($I`F1Catalog`) {}

const F1_INDEX_PATH = "fixtures/f1/index.json";
const F1IndexFromJsonString = S.fromJsonString(F1Index);

const toF1Diff = (fixture: F1Fixture, drift: ByteDrift): F1Diff =>
  ByteDrift.match(drift, {
    "missing-file": ({ relativePath }) => F1Diff.cases["missing-file"].make({ id: fixture.id, relativePath }),
    "sha256-mismatch": ({ relativePath, expectedSha256, actualSha256 }) =>
      F1Diff.cases["sha256-mismatch"].make({
        id: fixture.id,
        relativePath,
        expectedSha256,
        actualSha256,
      }),
    "bytes-mismatch": ({ relativePath, expectedBytes, actualBytes }) =>
      F1Diff.cases["bytes-mismatch"].make({
        id: fixture.id,
        relativePath,
        expectedBytes,
        actualBytes,
      }),
  });

const makeF1Catalog = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load = Effect.gen(function* () {
    const source = yield* fs.readFileString(F1_INDEX_PATH).pipe(
      Effect.mapError(() =>
        F1IndexDecodeFailed.make({
          message: "The committed F1 index could not be read.",
          indexPath: F1_INDEX_PATH,
        })
      )
    );
    const index = yield* S.decodeEffect(F1IndexFromJsonString)(source).pipe(
      Effect.mapError(() =>
        F1IndexDecodeFailed.make({
          message: "The committed F1 index is not valid f1-index/v1 JSON.",
          indexPath: F1_INDEX_PATH,
        })
      )
    );
    const fixtureRoot = path.dirname(F1_INDEX_PATH);
    const byteDrifts = yield* verifyByteExpectations(
      fixtureRoot,
      A.map(index.fixtures, (fixture) =>
        ByteExpectation.make({
          relativePath: fixture.relativePath,
          sha256: fixture.sha256,
          bytes: fixture.bytes,
        })
      )
    ).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
    const findFixture = (relativePath: string) =>
      Effect.fromOption(
        A.findFirst(index.fixtures, (fixture) => Str.Equivalence(fixture.relativePath, relativePath))
      ).pipe(Effect.orDie);
    const diffs = yield* Effect.forEach(byteDrifts, (drift) =>
      findFixture(drift.relativePath).pipe(Effect.map((fixture) => toF1Diff(fixture, drift)))
    );
    if (A.isReadonlyArrayNonEmpty(diffs)) {
      return yield* F1Drift.make({
        message: "F1 fixture drift detected.",
        indexPath: F1_INDEX_PATH,
        diffs,
      });
    }
    return index;
  }).pipe(Effect.withSpan("F1Catalog.load"));

  return F1Catalog.of({ load });
});

/**
 * Live F1 catalog backed by Bun filesystem, path, and crypto services.
 *
 * **Example** (Inspect the live catalog layer)
 *
 * ```ts
 * import { F1CatalogLive } from "@/fixtures/F1"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(F1CatalogLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const F1CatalogLive = Layer.effect(F1Catalog, makeF1Catalog);
