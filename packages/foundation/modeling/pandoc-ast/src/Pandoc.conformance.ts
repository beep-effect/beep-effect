/**
 * Exhaustive conformance classification for Pandoc JSON wire values.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.conformance
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import * as Conformance from "@beep/schema/Conformance";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, O, P, R } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import { PandocJsonConformanceAnnotation } from "./internal/conformance/Pandoc.conformance-registry.ts";
import { isPandocKnownConstructorName } from "./internal/Pandoc.registry.ts";
import {
  decodePandocJsonLossless,
  decodePandocJsonStrict,
  encodePandocJson,
  PandocConstructorWire,
  PandocLosslessIssue,
} from "./Pandoc.codec.ts";
import { PandocDocument } from "./Pandoc.model.ts";

const $I = $PandocAstId.create("Pandoc.conformance");

/**
 * Stable identifiers for the invariants checked by Pandoc conformance inspection.
 *
 * **Example** (Recognize semantic-subset invariant)
 *
 * ```ts import.meta.vitest name="Recognize semantic-subset invariant"
 * import { PandocConformanceInvariantId } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * PandocConformanceInvariantId.is["pandoc.semantic-subset"]("pandoc.semantic-subset") // => true
 * ```
 *
 * @see {@link https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs | Pandoc 1.23.1 AST definitions} for the pinned constructor definitions.
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceInvariantId = LiteralKit([
  "pandoc.semantic-subset",
  "pandoc.raw.exact-retention",
  "pandoc.table.column-width-payload",
]).pipe(
  $I.annoteSchema("PandocConformanceInvariantId", {
    description: "Stable identifier for an invariant checked by Pandoc conformance inspection.",
  })
);

/**
 * Runtime type for {@link PandocConformanceInvariantId}.
 *
 * @see {@link PandocConformanceInvariantId} for the complete literal domain.
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceInvariantId = typeof PandocConformanceInvariantId.Type;

/**
 * Complete ordered invariant set checked by the Pandoc conformance facade.
 *
 * **Example** (Make the checked invariant tuple)
 *
 * ```ts import.meta.vitest name="Make the checked invariant tuple"
 * import { PandocCheckedInvariantIds } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const ids = PandocCheckedInvariantIds.make([
 *   "pandoc.semantic-subset",
 *   "pandoc.raw.exact-retention",
 *   "pandoc.table.column-width-payload",
 * ])
 * ids.length // => 3
 * ```
 *
 * @invariant Every conformance result reports these three stable IDs in this order.
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocCheckedInvariantIds = S.Tuple(PandocConformanceInvariantId.members).pipe(
  $I.annoteSchema("PandocCheckedInvariantIds", {
    description: "Complete ordered invariant set checked by the Pandoc conformance facade.",
  })
);

/**
 * Runtime type for {@link PandocCheckedInvariantIds}.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocCheckedInvariantIds = typeof PandocCheckedInvariantIds.Type;

const checkedInvariantIds = PandocCheckedInvariantIds.make(PandocConformanceInvariantId.Options);

const PandocConformanceWire = S.Record(S.String, S.Json).pipe(
  $I.annoteSchema("PandocConformanceWire", {
    description: "Exact JSON object retained by Pandoc conformance inspection.",
  })
);

class FuturePandocConstructorIssue extends S.TaggedClass<FuturePandocConstructorIssue>(
  $I`FuturePandocConstructorIssue`
)(
  "futureConstructor",
  {
    constructor: S.String.annotateKey({
      description: "Future constructor name retained by the open semantic wire lane.",
    }),
  },
  $I.annote("FuturePandocConstructorIssue", {
    description: "Future Pandoc constructor retained losslessly but outside the pinned current AST.",
  })
) {}

class NonCanonicalPandocWireIssue extends S.TaggedClass<NonCanonicalPandocWireIssue>($I`NonCanonicalPandocWireIssue`)(
  "nonCanonicalWire",
  {
    message: S.NonEmptyString.annotateKey({
      description: "Explanation of the strict encode fixed-point mismatch.",
    }),
  },
  $I.annote("NonCanonicalPandocWireIssue", {
    description: "Lossless Pandoc JSON which strict decoding would not reproduce exactly.",
  })
) {}

/**
 * Unsupported-but-lossless reason discovered at the Pandoc JSON boundary.
 *
 * **Example** (Match an unsupported reason)
 *
 * ```ts import.meta.vitest name="Match an unsupported reason"
 * import { PandocConformanceIssue } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const issue = PandocConformanceIssue.cases.futureConstructor.make({ constructor: "FutureBlock" })
 * PandocConformanceIssue.match(issue, {
 *   futureConstructor: ({ constructor }) => constructor,
 *   nonCanonicalWire: ({ message }) => message,
 * }) // => "FutureBlock"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceIssue = S.Union([FuturePandocConstructorIssue, NonCanonicalPandocWireIssue]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocConformanceIssue", {
    description: "Exhaustive unsupported-but-lossless Pandoc conformance reason.",
  })
);

/**
 * Runtime issue represented by {@link PandocConformanceIssue}.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceIssue = typeof PandocConformanceIssue.Type;

class CompatiblePandocDocument extends S.TaggedClass<CompatiblePandocDocument>($I`CompatiblePandocDocument`)(
  "compatible",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    document: PandocDocument,
    wire: PandocConformanceWire,
  },
  $I.annote("CompatiblePandocDocument", {
    description: "Pandoc JSON that is an exact fixed point of the pinned strict semantic codec.",
  })
) {}

class UnsupportedPandocDocument extends S.TaggedClass<UnsupportedPandocDocument>($I`UnsupportedPandocDocument`)(
  "unsupported",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    document: PandocDocument,
    issues: S.NonEmptyArray(PandocConformanceIssue),
    wire: PandocConformanceWire,
  },
  $I.annote("UnsupportedPandocDocument", {
    description: "Lossless Pandoc JSON retained outside the pinned exact strict semantic profile.",
  })
) {}

class InvalidPandocDocument extends S.TaggedClass<InvalidPandocDocument>($I`InvalidPandocDocument`)(
  "invalid",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    issues: S.Array(PandocLosslessIssue),
    message: S.NonEmptyString,
    wire: S.OptionFromOptionalKey(PandocConformanceWire).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("InvalidPandocDocument", {
    description: "Input that fails the Pandoc JSON envelope or a pinned current-constructor payload invariant.",
  })
) {}

/**
 * Exhaustive result of Pandoc JSON conformance inspection.
 *
 * **Details**
 *
 * `compatible` means the input is accepted by the pinned current semantic
 * grammar and strict encoding reproduces its exact JSON. `unsupported` keeps
 * valid future constructors or a non-canonical lossless wire explicit.
 * `invalid` identifies a malformed envelope or current-constructor payload.
 * Its retained wire is `Some` after lossless envelope decoding and `None` when
 * decoding fails before an exact JSON object can be retained; encoding omits
 * the absent `wire` key.
 * No `normalizable` case exists because this package declares no semantics-
 * preserving canonical rewrite.
 *
 * **Example** (Match every conformance outcome)
 *
 * ```ts import.meta.vitest name="Match every conformance outcome"
 * import { Effect } from "effect"
 * import { inspectPandocConformance, PandocConformanceResult } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const result = Effect.runSync(inspectPandocConformance(null))
 * const status = PandocConformanceResult.match(result, {
 *   compatible: () => "compatible",
 *   unsupported: () => "unsupported",
 *   invalid: () => "invalid",
 * })
 * status // => "invalid"
 * ```
 *
 * @invariant Every input is classified into exactly one exhaustive result case.
 * @invariant `compatible` values are exact fixed points of strict decode followed by encode.
 * @invariant An `invalid` result represents absent retained wire as `Option.none()` rather than `undefined`.
 * @see {@link https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs | Pandoc JSON AST types} for the pinned wire constructors.
 * @see {@link https://pandoc.org/MANUAL.html#json-filters | Pandoc JSON filters} for the filter interchange contract.
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceResult = S.Union([
  CompatiblePandocDocument,
  UnsupportedPandocDocument,
  InvalidPandocDocument,
]).pipe(
  Conformance.annotateConformance(PandocJsonConformanceAnnotation),
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocConformanceResult", {
    description: "Exhaustive compatible, unsupported, or invalid Pandoc JSON classification.",
  })
);

/**
 * Runtime result represented by {@link PandocConformanceResult}.
 *
 * @see {@link PandocConformanceResult} for constructors, guards, and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceResult = typeof PandocConformanceResult.Type;

type JsonRecord = Readonly<Record<string, S.Json>>;

const isJsonArray = (value: S.Json): value is ReadonlyArray<S.Json> => A.isArray(value);

const isJsonRecord = (value: S.Json): value is JsonRecord =>
  P.isObject(value) && !P.isNull(value) && !isJsonArray(value);

const decodeConstructorOption = S.decodeUnknownOption(PandocConstructorWire);

const collectFutureConstructorNames = (value: S.Json): ReadonlyArray<string> =>
  pipe(
    decodeConstructorOption(value),
    O.map((constructor) =>
      isPandocKnownConstructorName(constructor.t)
        ? pipe(
            O.fromNullishOr(constructor.c),
            O.map(collectFutureConstructorNames),
            O.getOrElse(A.emptyReadonly<string>)
          )
        : [constructor.t]
    ),
    O.getOrElse(() =>
      isJsonArray(value)
        ? A.flatMap(value, collectFutureConstructorNames)
        : isJsonRecord(value)
          ? A.flatMap(R.values(value), collectFutureConstructorNames)
          : A.emptyReadonly<string>()
    )
  );

const jsonEquivalence = S.toEquivalence(S.Json);

const invalidResult = (
  message: string,
  issues: ReadonlyArray<PandocLosslessIssue>,
  wire: O.Option<JsonRecord> = O.none()
): PandocConformanceResult =>
  PandocConformanceResult.cases.invalid.make({
    checkedInvariantIds,
    issues,
    message,
    wire,
  });

/**
 * Classify unknown input against lossless and strict Pandoc JSON boundaries.
 *
 * **Example** (Recognize a future constructor)
 *
 * ```ts import.meta.vitest name="Recognize a future constructor"
 * import { Effect } from "effect"
 * import { inspectPandocConformance } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const result = Effect.runSync(inspectPandocConformance({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [{ t: "FutureBlock", c: { exact: true } }],
 *   meta: {},
 * }))
 * result._tag // => "unsupported"
 * ```
 *
 * @param input - Unknown Pandoc JSON input to classify without discarding valid future wire.
 * @returns An infallible effect containing one exhaustive conformance result.
 * @invariant Malformed pinned constructors are `invalid`; unknown future constructors are `unsupported`.
 * @invariant Raw inline and block format/text pairs survive strict round trips byte-for-byte.
 * @invariant `ColWidth` requires a finite numeric payload while `ColWidthDefault` remains nullary.
 * @see {@link https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs#L250-L355 | Pandoc 1.23.1 inline and block constructors} for the pinned constructor payload definitions.
 * @category validation
 * @since 0.0.0
 */
export const inspectPandocConformance = Effect.fn("Pandoc.inspectPandocConformance")(
  (input: unknown): Effect.Effect<PandocConformanceResult> =>
    decodePandocJsonLossless(input).pipe(
      Effect.flatMap((lossless) => {
        const issues = lossless.issues;
        if (A.isReadonlyArrayNonEmpty(issues)) {
          return Effect.succeed(
            invalidResult("Pandoc JSON contains malformed pinned constructor payloads.", issues, O.some(lossless.wire))
          );
        }

        return decodePandocJsonStrict(lossless.wire).pipe(
          Effect.flatMap((document) =>
            encodePandocJson(document).pipe(
              Effect.map((encoded) => {
                const futureConstructors = A.dedupe(collectFutureConstructorNames(lossless.wire));
                const futureIssues = A.map(futureConstructors, (constructor) =>
                  PandocConformanceIssue.cases.futureConstructor.make({ constructor })
                );
                const conformanceIssues = jsonEquivalence(lossless.wire, {
                  "pandoc-api-version": encoded["pandoc-api-version"],
                  blocks: encoded.blocks,
                  meta: encoded.meta,
                })
                  ? futureIssues
                  : A.append(
                      futureIssues,
                      PandocConformanceIssue.cases.nonCanonicalWire.make({
                        message: "Strict semantic encoding does not reproduce the retained Pandoc JSON exactly.",
                      })
                    );

                return A.isReadonlyArrayNonEmpty(conformanceIssues)
                  ? PandocConformanceResult.cases.unsupported.make({
                      checkedInvariantIds,
                      document,
                      issues: conformanceIssues,
                      wire: lossless.wire,
                    })
                  : PandocConformanceResult.cases.compatible.make({
                      checkedInvariantIds,
                      document,
                      wire: lossless.wire,
                    });
              })
            )
          ),
          Effect.catch((error) => Effect.succeed(invalidResult(error.message, issues, O.some(lossless.wire))))
        );
      }),
      Effect.catch((error) => Effect.succeed(invalidResult(error.message, A.emptyReadonly())))
    )
);
