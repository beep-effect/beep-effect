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

/**
 * One normalized code point emitted for a raw cluster, with its whitespace
 * verdict precomputed.
 */
type EmittedPoint = readonly [point: string, whitespace: boolean];

/**
 * The normalized form of one raw cluster: its NFKC text (for join checks) and
 * the quote-straightened code points it emits.
 */
type ClusterForm = readonly [normalized: string, emitted: ReadonlyArray<EmittedPoint>];

// Memo keys longer than this are computed directly so hostile long clusters
// never retain large keys.
const MAX_MEMO_KEY_LENGTH = 32;

// Performance boundary (single-pass scan): normalization visits every code
// point of a source up to 1,000,000 UTF-16 units long, so the per-point path
// below uses native string/array operations and module-scope helper
// references. Module-namespace helper calls cost a property lookup per call (a
// getter call under Vite's module runner), which dominated hosted CI. All
// mutation stays inside one `normalizeWithRawOffsets` call; its completed
// schema value is immutable to every downstream consumer.
const getMemoized = MutableHashMap.get;
const setMemoized = MutableHashMap.set;
const isMemoized = O.isSome;

// Hostile inputs repeat few distinct short clusters, so every pure per-cluster
// computation runs once per distinct raw text instead of once per occurrence.
// Each cache lives for one normalization call.
type Memo<A> = (key: string, compute: () => A) => A;

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

/**
 * Mutable single-pass normalization state.
 *
 * Each raw cluster is a half-open UTF-16 range whose code points normalize as
 * one unit. A cluster is final as soon as the next code point does not join
 * it, and emitting it depends only on already-emitted output, so clusters are
 * normalized and appended while the source is scanned.
 */
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

// Four letters (U+0E33, U+0EB3, U+FF9E, U+FF9F) normalize to text that starts
// with a combining mark. Their own category is not a mark, so the rule reads the
// normalized point: left as its own cluster, such a letter would keep a later
// mark (Z, U+FF9E, U+0323) from composing with the cluster before it.
const startsWithMark = (scan: NormalizationScan, point: string): boolean =>
  scan.leadingMarks(point, () => isMarkLeading(formOf(scan, point)[0]));

// A code point joins the open cluster when normalizing them together differs
// from normalizing each on its own.
const joinsCluster = (scan: NormalizationScan, rawCluster: string, point: string): boolean =>
  normalizeUnicode(rawCluster + point) !== formOf(scan, rawCluster)[0] + formOf(scan, point)[0];

const appendNormalizedPoint = (scan: NormalizationScan, [point, whitespace]: EmittedPoint): void => {
  const { clusterEnd, clusterStart, ends, points, starts } = scan;
  if (!whitespace) {
    // One offset entry per UTF-16 code unit: a code point spans one or two.
    for (let unit = 0; unit < point.length; unit++) {
      starts.push(clusterStart);
      ends.push(clusterEnd);
    }
    points.push(point);
    scan.lastPointIsSpace = false;
    return;
  }
  // Whitespace runs collapse into one space that spans the whole raw run.
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
  // A code point whose normalized form starts with a combining mark always joins,
  // so the join verdict (which normalizes the whole open cluster) runs only for
  // other code points. Its memo key is the cluster followed by exactly one code
  // point, which fixes both inputs of the verdict.
  if (startsWithMark(scan, point) || scan.joins(rawCluster + point, () => joinsCluster(scan, rawCluster, point))) {
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
export const normalizeWithRawOffsets = (source: string): NormalizedTextWithRawOffsets => {
  // One left-to-right pass builds the parallel offset maps, which can hold
  // multiple entries per source code unit (see the single-pass scan boundary).
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
  // The scan opens with an empty cluster: every code point leaves it as its own
  // cluster (an empty cluster normalizes to nothing and emits nothing), so the
  // first point needs no special case and an empty source emits nothing.
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
