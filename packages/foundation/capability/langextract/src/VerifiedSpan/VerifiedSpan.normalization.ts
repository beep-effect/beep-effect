/**
 * Versioned text normalization shared by verified-span location and persistence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LangExtractId } from "@beep/identity";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { flow } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("VerifiedSpan/normalization");
const MarkLeadingText = S.String.check(
  S.isPattern(
    /^\p{M}/u,
    $I.annote("MarkLeadingTextCheck", {
      title: "Mark-Leading Text",
      description: "Checks for text whose first code point is a Unicode combining mark.",
      message: "Expected text that starts with a Unicode combining-mark code point.",
    })
  )
);
const WhitespaceCodePoint = S.String.check(
  S.isPattern(
    /^\s$/u,
    $I.annote("WhitespaceCodePointCheck", {
      title: "Whitespace Code Point",
      description: "Checks for one Unicode whitespace code point.",
      message: "Expected one Unicode whitespace code point.",
    })
  )
);

/**
 * Internal normalized locator text with raw UTF-16 offset maps.
 *
 * **Example** (Inspect the normalized text field)
 *
 * ```ts
 * import { NormalizedTextWithRawOffsets } from "@beep/langextract/VerifiedSpan/VerifiedSpan.normalization"
 *
 * NormalizedTextWithRawOffsets.fields.text !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 * @internal
 */
export class NormalizedTextWithRawOffsets extends S.Opaque<
  NormalizedTextWithRawOffsets,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ends: S.Array(S.Natural),
    starts: S.Array(S.Natural),
    text: S.String,
  }).pipe(
    $I.annoteSchema("NormalizedTextWithRawOffsets", {
      description: "Normalized locator text paired with the raw UTF-16 source range behind each normalized code unit.",
    })
  )
) {}

const isMarkLeading = S.is(MarkLeadingText);
const isWhitespace = S.is(WhitespaceCodePoint);
const normalizeUnicode = Str.normalize("NFKC");
const straightenQuotes = flow(Str.replace(/[‘’‚‛]/gu, "'"), Str.replace(/[“”„‟]/gu, '"'));

type EmittedPoint = readonly [point: string, whitespace: boolean];

type ClusterForm = readonly [nfkcForJoinChecks: string, quoteStraightenedPoints: ReadonlyArray<EmittedPoint>];

// decision: per-call-cluster-memo
const MAX_MEMO_KEY_LENGTH = 32;

// decision: hot-scans-use-native-loops
const getMemoized = MutableHashMap.get;
const setMemoized = MutableHashMap.set;
const isMemoized = O.isSome;

type Memo<A> = (key: string, compute: () => A) => A;

// decision: per-call-cluster-memo
const memo = <A>(): Memo<A> => {
  const cache = MutableHashMap.empty<string, A>();
  return (key, compute) => {
    if (key.length > MAX_MEMO_KEY_LENGTH) {
      return compute();
    }
    const cached = getMemoized(cache, key);
    if (isMemoized(cached)) {
      return cached.value;
    }
    const value = compute();
    setMemoized(cache, key, value);
    return value;
  };
};

const clusterForm = (rawCluster: string): ClusterForm => {
  const normalized = normalizeUnicode(rawCluster);
  return [normalized, A.map(A.fromIterable(straightenQuotes(normalized)), (point) => [point, isWhitespace(point)])];
};

type NormalizationScan = {
  readonly starts: Array<number>;
  readonly ends: Array<number>;
  readonly points: Array<string>;
  readonly leadingMarks: Memo<boolean>;
  readonly clusterForms: Memo<ClusterForm>;
  readonly joins: Memo<boolean>;
  clusterStart: number;
  clusterEnd: number;
  lastPointIsSpace: boolean;
};

const formOf = (scan: NormalizationScan, rawCluster: string): ClusterForm =>
  scan.clusterForms(rawCluster, () => clusterForm(rawCluster));

const nfkcFormStartsWithMark = (scan: NormalizationScan, point: string): boolean =>
  scan.leadingMarks(point, () => isMarkLeading(formOf(scan, point)[0]));

const joinsCluster = (scan: NormalizationScan, rawCluster: string, point: string): boolean =>
  normalizeUnicode(rawCluster + point) !== formOf(scan, rawCluster)[0] + formOf(scan, point)[0];

const appendNormalizedPoint = (scan: NormalizationScan, [point, whitespace]: EmittedPoint): void => {
  const { clusterEnd, clusterStart, ends, points, starts } = scan;
  if (!whitespace) {
    for (let unit = 0; unit < point.length; unit++) {
      starts.push(clusterStart);
      ends.push(clusterEnd);
    }
    points.push(point);
    scan.lastPointIsSpace = false;
    return;
  }
  if (scan.lastPointIsSpace) {
    ends[ends.length - 1] = clusterEnd;
    return;
  }
  starts.push(clusterStart);
  ends.push(clusterEnd);
  points.push(" ");
  scan.lastPointIsSpace = true;
};

const emitCluster = (source: string, scan: NormalizationScan): void => {
  const [, emitted] = formOf(scan, Str.slice(scan.clusterStart, scan.clusterEnd)(source));
  for (const point of emitted) {
    appendNormalizedPoint(scan, point);
  }
};

const scanPoint = (source: string, scan: NormalizationScan, point: string): void => {
  const pointEnd = scan.clusterEnd + point.length;
  const rawCluster = Str.slice(scan.clusterStart, scan.clusterEnd)(source);
  // decision: per-call-cluster-memo
  if (
    nfkcFormStartsWithMark(scan, point) ||
    scan.joins(rawCluster + point, () => joinsCluster(scan, rawCluster, point))
  ) {
    scan.clusterEnd = pointEnd;
    return;
  }
  emitCluster(source, scan);
  scan.clusterStart = scan.clusterEnd;
  scan.clusterEnd = pointEnd;
};

/**
 * Normalize locator text while retaining the raw UTF-16 range behind every
 * normalized code unit.
 *
 * **Details**
 *
 * One left-to-right pass splits the source into raw clusters, half-open UTF-16
 * ranges whose code points normalize as one unit. A cluster closes as soon as
 * the next code point does not join it, and its output depends only on output
 * already emitted, so each cluster is normalized and appended during the scan.
 * Every normalized code unit gets one entry in `starts` and `ends`, so a raw
 * code unit may sit behind several entries. A whitespace run collapses to one
 * space whose raw range spans the whole run. An empty source yields empty text
 * and empty offset maps.
 *
 * **Example** (Normalize locator text with offsets)
 *
 * ```ts
 * import { normalizeWithRawOffsets } from "@beep/langextract/VerifiedSpan/VerifiedSpan.normalization"
 *
 * normalizeWithRawOffsets("office").text // => "office"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @internal
 */
// decision: hot-scans-use-native-loops
export const normalizeWithRawOffsets = (source: string): NormalizedTextWithRawOffsets => {
  const scan: NormalizationScan = {
    clusterEnd: 0,
    clusterForms: memo(),
    clusterStart: 0,
    ends: A.empty(),
    joins: memo(),
    lastPointIsSpace: false,
    leadingMarks: memo(),
    points: A.empty(),
    starts: A.empty(),
  };
  for (const point of source) {
    scanPoint(source, scan, point);
  }
  emitCluster(source, scan);

  return NormalizedTextWithRawOffsets.make({
    ends: scan.ends,
    starts: scan.starts,
    text: A.join(scan.points, ""),
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
