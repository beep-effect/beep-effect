/**
 * Versioned text normalization shared by verified-span location and persistence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { Iterable as I, Match } from "effect";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { flow, pipe } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("VerifiedSpan/normalization");
const CombiningMark = S.String.check(
  S.isPattern(/^\p{M}$/u, {
    identifier: $I`CombiningMarkCheck`,
    title: "Combining Mark",
    description: "Checks for one Unicode combining-mark code point.",
    message: "Expected one Unicode combining-mark code point.",
  })
);
const WhitespaceCodePoint = S.String.check(
  S.isPattern(/^\s$/u, {
    identifier: $I`WhitespaceCodePointCheck`,
    title: "Whitespace Code Point",
    description: "Checks for one Unicode whitespace code point.",
    message: "Expected one Unicode whitespace code point.",
  })
);

/**
 * Internal normalized locator text with raw UTF-16 offset maps.
 *
 * @category models
 * @since 0.0.0
 * @internal
 */
export class NormalizedTextWithRawOffsets extends S.Class<NormalizedTextWithRawOffsets>(
  $I`NormalizedTextWithRawOffsets`
)(
  {
    ends: S.Array(NonNegativeInt),
    starts: S.Array(NonNegativeInt),
    text: S.String,
  },
  $I.annote("NormalizedTextWithRawOffsets", {
    description: "Normalized locator text paired with the raw UTF-16 source range behind each normalized code unit.",
  })
) {}

const RawCluster = S.Tuple([NonNegativeInt, NonNegativeInt]).pipe(
  $I.annoteSchema("RawCluster", {
    description: "Half-open raw UTF-16 range whose code points normalize as one cluster.",
  })
);
type RawCluster = typeof RawCluster.Type;

type SourceClusterState = readonly [start: NonNegativeInt, clusters: Array<RawCluster>];
type NormalizationState = readonly [starts: Array<NonNegativeInt>, ends: Array<NonNegativeInt>, points: Array<string>];
type NormalizedRawPoint = readonly [point: string, sourceStart: NonNegativeInt, sourceEnd: NonNegativeInt];

const rawCluster = (start: NonNegativeInt, end: NonNegativeInt): RawCluster => [start, end];
const normalizedRawPoint = (
  point: string,
  sourceStart: NonNegativeInt,
  sourceEnd: NonNegativeInt
): NormalizedRawPoint => [point, sourceStart, sourceEnd];
const sourceClusterInitial = (): SourceClusterState => [NonNegativeInt.make(0), A.empty()];
const normalizationInitial = (): NormalizationState => [A.empty(), A.empty(), A.empty()];
const isCombiningMark = S.is(CombiningMark);
const isWhitespace = S.is(WhitespaceCodePoint);
const normalizeUnicode = Str.normalize("NFKC");

const joinsNormalizedCluster = (source: string, cluster: RawCluster, point: string): boolean => {
  const clusterText = Str.slice(cluster[0], cluster[1])(source);
  return Bool.not(
    Eq.equals(
      normalizeUnicode(Str.concat(clusterText, point)),
      Str.concat(normalizeUnicode(clusterText), normalizeUnicode(point))
    )
  );
};

const sourceClusters = (source: string): ReadonlyArray<RawCluster> => {
  // Performance boundary: one allocation keeps cluster construction linear for
  // hostile 100k inputs. The completed array is read-only after this function.
  const [, clusters] = pipe(
    source,
    A.fromIterable,
    A.reduce(sourceClusterInitial(), ([start, clusters], point): SourceClusterState => {
      const end = NonNegativeInt.make(start + Str.length(point));
      const next = rawCluster(start, end);
      return [
        end,
        pipe(
          A.last(clusters),
          O.match({
            onNone: () => A.appendInPlace(clusters, next),
            onSome: (previous) =>
              pipe(
                Bool.match(isCombiningMark(point), {
                  onFalse: () => joinsNormalizedCluster(source, previous, point),
                  onTrue: () => true,
                }),
                Bool.match({
                  onFalse: () => A.appendInPlace(clusters, next),
                  onTrue: () => {
                    A.spliceInPlace(clusters, {
                      start: A.length(clusters) - 1,
                      deleteCount: 1,
                      items: [rawCluster(previous[0], end)],
                    });
                    return clusters;
                  },
                })
              ),
          })
        ),
      ];
    })
  );
  return clusters;
};

const normalizeCluster = flow(normalizeUnicode, Str.replace(/[‘’‚‛]/gu, "'"), Str.replace(/[“”„‟]/gu, '"'));

const appendNormalizedPoint = (
  [starts, ends, points]: NormalizationState,
  point: string,
  sourceStart: NonNegativeInt,
  sourceEnd: NonNegativeInt
): NormalizationState =>
  pipe(
    isWhitespace(point),
    Bool.match({
      onFalse: () => {
        A.appendAllInPlace(starts, A.replicate(sourceStart, Str.length(point)));
        A.appendAllInPlace(ends, A.replicate(sourceEnd, Str.length(point)));
        A.appendInPlace(points, point);
        return [starts, ends, points];
      },
      onTrue: () =>
        Match.value(O.exists(A.last(points), Eq.equals(" "))).pipe(
          Match.when(false, (): NormalizationState => {
            A.appendInPlace(starts, sourceStart);
            A.appendInPlace(ends, sourceEnd);
            A.appendInPlace(points, " ");
            return [starts, ends, points];
          }),
          Match.orElse((): NormalizationState => {
            A.spliceInPlace(ends, {
              start: A.length(ends) - 1,
              deleteCount: 1,
              items: [sourceEnd],
            });
            return [starts, ends, points];
          })
        ),
    })
  );

/**
 * Normalize locator text while retaining the raw UTF-16 range behind every
 * normalized code unit.
 *
 * @category utilities
 * @since 0.0.0
 * @internal
 */
export const normalizeWithRawOffsets = (source: string): NormalizedTextWithRawOffsets => {
  // Performance boundary: these parallel offset maps can hold multiple entries per source
  // code unit. Mutation stays inside this allocation boundary; the completed
  // schema value is immutable to every downstream consumer.
  const [starts, ends, points] = pipe(
    sourceClusters(source),
    I.flatMap(([sourceStart, sourceEnd]) =>
      pipe(
        source,
        Str.slice(sourceStart, sourceEnd),
        normalizeCluster,
        I.map((point) => normalizedRawPoint(point, sourceStart, sourceEnd))
      )
    ),
    I.reduce(normalizationInitial(), (state, [point, sourceStart, sourceEnd]) =>
      appendNormalizedPoint(state, point, sourceStart, sourceEnd)
    )
  );

  return NormalizedTextWithRawOffsets.make({
    ends,
    starts,
    text: A.join(points, ""),
  });
};

/**
 * Normalize text only for deterministic location and persisted association checks.
 *
 * **Details**
 *
 * The result uses NFKC, straight quote equivalents, and collapsed whitespace.
 * It is never evidence text: successful APIs always recover and emit a raw
 * source slice.
 *
 * **Example** (Normalize locator candidate text)
 *
 * ```ts import.meta.vitest name="Normalize locator candidate text"
 * import { normalizeTextLocator } from "@beep/langextract/VerifiedSpan"
 *
 * normalizeTextLocator("“ofﬁce”\nrecord") // => "\"office\" record"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeTextLocator = (value: string): string => normalizeWithRawOffsets(value).text;
