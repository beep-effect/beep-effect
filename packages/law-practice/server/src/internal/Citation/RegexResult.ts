/** Bounded complete regex results retaining Python source-point capture spans.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { preflightCitationNativeJson } from "./NativeJson.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexResult");
const max = CitationEngineAbsoluteMaxima;
const Count = S.Natural.check(S.isLessThanOrEqualTo(max.patternMatches)).pipe(
  $I.annoteSchema("Count", { description: "Absolute raw-match count, including zero." })
);
// Every capturing group consumes pattern syntax. This conservative absolute
// bound does not qualify any pattern or replace its reviewed group descriptor.
const Groups = S.Natural.check(S.isLessThanOrEqualTo(max.patternUtf16)).pipe(
  $I.annoteSchema("Groups", { description: "Captured group count excluding the whole match." })
);
const Position = S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)).pipe(
  $I.annoteSchema("Position", { description: "Python source-point offset within the absolute source ceiling." })
);
const Index = S.Natural.pipe($I.annoteSchema("Index", { description: "Nonnegative contextual capture-table index." }));
const NativeCapture = S.UndefinedOr(S.Tuple([Position, Position])).pipe(
  $I.annoteSchema("NativeCapture", {
    description: "One native indices pair or an unmatched group, before contextual range validation.",
  })
);
const paddedLength = (bytes: number) => 4 * ((bytes + 2 - ((bytes + 2) % 3)) / 3);
/** @internal @category models @since 0.0.0 */
export class CitationRegexResultEnvelope extends S.Opaque<
  CitationRegexResultEnvelope,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Complete", {
    version: S.tag("citation-regex-result/v1"),
    groups: Groups,
    matches: Count,
    spans: S.String.check(S.isMaxLength(paddedLength(max.processMessageBytes))),
  }).pipe(
    $I.annoteSchema("CitationRegexResultEnvelope", {
      description: "Flat complete-result envelope. Native capture words are decoded only after contextual size checks.",
    })
  )
) {}
const Json = S.fromJsonString(CitationRegexResultEnvelope);
const NativeBytes = S.Uint8ArrayFromBase64;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const absent = 0xffffffff;
/** Native offsets remain unverified until document mapping and the public
 * verified-span adapter run. Empty captures are valid source points.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexCapturedRange extends S.Opaque<
  CitationRegexCapturedRange,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Range", { start: Position, end: Position })
    .check(
      S.makeFilter(
        (value) => value.start <= value.end,
        $I.annote("CaptureOrder", {
          description: "Require a forward source-point range, including empty captures.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexCapturedRange", {
        description: "A participating native capture, including empty captures.",
      })
    )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexUnmatchedCapture extends S.Opaque<
  CitationRegexUnmatchedCapture,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Unmatched", {}).pipe(
    $I.annoteSchema("CitationRegexUnmatchedCapture", {
      description: "A nonparticipating group, distinct from a participating empty capture.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationRegexCapture = S.Union([CitationRegexCapturedRange, CitationRegexUnmatchedCapture]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexCapture", {
    description: "Closed native capture observation without text or document authority.",
  })
);

/** Capture limits, Clock, source length and the reviewed pattern's group count.
 * The result is a live accessor over owned decoded bytes, never a request field.
 * All offsets are Python source points; projected display text is not consulted.
 * Trusted callers keep borrowed encode/frame buffers immutable during each call;
 * successful decoding owns a separate native capture buffer.
 * collect pulls one trusted native indices row at a time and preflights complete
 * result size before decoding/growing storage. It returns only a complete frame.
 * The pull effect runs in an isolated child: a synchronous native call still
 * requires the parent's independent regex deadline and retirement authority.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexResult = Effect.fn("Citation.makeRegexResult")(function* (
  policy: unknown,
  expectedGroupsInput: unknown,
  sourcePointsInput: unknown
) {
  const badRuntime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
  const limits = yield* decodeCitationRegexPolicy(policy, badRuntime);
  const groups = yield* S.decodeUnknownEffect(Groups)(expectedGroupsInput).pipe(Effect.mapError(badRuntime));
  const sourcePoints = yield* S.decodeUnknownEffect(Position)(sourcePointsInput).pipe(Effect.mapError(badRuntime));
  const { timed } = yield* makeCitationRegexTiming(limits, false);
  const counts = Effect.fn("Citation.checkRegexResultCounts")(function* (matchesInput: unknown) {
    const matches = yield* S.decodeUnknownEffect(Count)(matchesInput).pipe(Effect.mapError(invalid));
    if (matches > limits.patternMatches) return yield* safety("patternMatches");
    const bytes = matches * (groups + 1) * 8;
    // Includes the fixed header and LF, even for a zero-match result.
    const header = yield* S.encodeEffect(Json)(
      CitationRegexResultEnvelope.make({
        groups,
        matches,
        spans: "",
      })
    ).pipe(Effect.mapError(invalid));
    const completeBytes = encoder.encode(header).byteLength + 1 + paddedLength(bytes);
    if (completeBytes > limits.processMessageBytes) return yield* safety("processMessageBytes");
    return { matches, bytes, completeBytes };
  });
  const checkCapture = Effect.fnUntraced(function* (start: number, end: number, group: number) {
    if (start === absent || end === absent) {
      if (group === 0 || start !== absent || end !== absent) return yield* invalid();
      return false;
    }
    if (start > end || end > sourcePoints) return yield* invalid();
    return true;
  });
  const makeValidation = () => {
    let previousStart = -1;
    let previousEnd = -1;
    const wholeMatch = Effect.fnUntraced(function* (start: number, end: number) {
      // Python permits empty then nonempty at one position, but no duplicate empty match.
      if (start < previousEnd || (start === end && start === previousStart && previousStart === previousEnd))
        return yield* invalid();
      previousStart = start;
      previousEnd = end;
    });
    return Effect.fnUntraced(function* (view: DataView, rowOffset: number) {
      for (let group = 0; group <= groups; group++) {
        const offset = rowOffset + group * 8;
        if (offset % 4096 === 0) yield* Effect.yieldNow;
        const start = view.getUint32(offset, true);
        const end = view.getUint32(offset + 4, true);
        if (!(yield* checkCapture(start, end, group))) continue;
        if (group === 0) yield* wholeMatch(start, end);
        // Lookaround captures can lie outside the whole-match range.
      }
    });
  };
  const validate = Effect.fn("Citation.validateRegexCaptures")(function* (matches: number, bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const matchCaptures = makeValidation();
    for (let match = 0; match < matches; match++) yield* matchCaptures(view, match * (groups + 1) * 8);
  });

  const decode = Effect.fn("Citation.decodeRegexResult")(function* (
    body: Uint8Array,
    maximumMatchesInput: unknown = limits.patternMatches
  ) {
    const maximumMatches = yield* S.decodeUnknownEffect(Count)(maximumMatchesInput).pipe(Effect.mapError(invalid));
    if (maximumMatches > limits.patternMatches) return yield* safety("patternMatches");
    if (body.byteLength + 1 > limits.processMessageBytes) return yield* safety("processMessageBytes");
    yield* preflightCitationNativeJson(body, 5, invalid);
    const text = yield* Effect.try({ try: () => decoder.decode(body), catch: invalid });
    const wire = yield* S.decodeEffect(Json, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
    if (wire.groups !== groups) return yield* invalid();
    if (wire.matches > maximumMatches) return yield* safety("patternMatches");
    const layout = yield* counts(wire.matches);
    if (Str.length(wire.spans) !== paddedLength(layout.bytes)) return yield* invalid();
    const bytes = yield* S.decodeEffect(NativeBytes)(wire.spans).pipe(Effect.mapError(invalid));
    if (bytes.byteLength !== layout.bytes) return yield* invalid();
    yield* validate(layout.matches, bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const capture = Effect.fn("Citation.readRegexCapture")(function* (matchInput: unknown, groupInput: unknown) {
      const match = yield* S.decodeUnknownEffect(Index)(matchInput).pipe(Effect.mapError(invalid));
      const group = yield* S.decodeUnknownEffect(Index)(groupInput).pipe(Effect.mapError(invalid));
      if (match >= layout.matches || group > groups) return yield* invalid();
      const offset = (match * (groups + 1) + group) * 8;
      const start = view.getUint32(offset, true);
      if (start === absent) return CitationRegexUnmatchedCapture.make({});
      return CitationRegexCapturedRange.make({ start, end: view.getUint32(offset + 4, true) });
    });
    return { matches: layout.matches, groups, capture };
  }, timed);
  const encode = Effect.fn("Citation.encodeRegexResult")(function* (matchesInput: unknown, bytes: Uint8Array) {
    const layout = yield* counts(matchesInput);
    if (bytes.byteLength !== layout.bytes) return yield* invalid();
    yield* validate(layout.matches, bytes);
    const spans = yield* S.encodeEffect(NativeBytes)(bytes).pipe(Effect.mapError(invalid));
    const text = yield* S.encodeEffect(Json)(
      CitationRegexResultEnvelope.make({
        groups,
        matches: layout.matches,
        spans,
      })
    ).pipe(Effect.mapError(invalid));
    const frame = encoder.encode(`${text}\n`);
    if (frame.byteLength !== layout.completeBytes) return yield* invalid();
    return frame;
  }, timed);
  const Row = S.Array(NativeCapture)
    .check(S.isBetweenLength(groups + 1, groups + 1))
    .pipe(
      $I.annoteSchema("NativeCaptureRow", { description: "Exactly the contextual whole-match and group indices." })
    );
  const copyRow = Effect.fnUntraced(function* (view: DataView, offset: number, captures: typeof Row.Type) {
    for (let group = 0; group <= groups; group++) {
      if (group % 512 === 0) yield* Effect.yieldNow;
      const capture = O.fromUndefinedOr(captures[group]);
      view.setUint32(offset + group * 8, O.isSome(capture) ? capture.value[0] : absent, true);
      view.setUint32(offset + group * 8 + 4, O.isSome(capture) ? capture.value[1] : absent, true);
    }
  });
  const decodeRow = Effect.fnUntraced(function* (input: unknown) {
    if (!A.isArray(input) || input.length !== groups + 1) return yield* invalid();
    return yield* S.decodeUnknownEffect(Row)(input).pipe(Effect.mapError(invalid));
  });
  const collect = Effect.fn("Citation.collectRegexCaptures")(function* <E>(
    pull: Effect.Effect<O.Option<unknown>, E>,
    maximumMatchesInput: unknown = limits.patternMatches
  ) {
    const maximumMatches = yield* S.decodeUnknownEffect(Count)(maximumMatchesInput).pipe(Effect.mapError(invalid));
    if (maximumMatches > limits.patternMatches) return yield* safety("patternMatches");
    yield* counts(0);
    let matches = 0;
    let bytes = new Uint8Array(0);
    const checkRow = makeValidation();
    while (true) {
      yield* Effect.yieldNow;
      const next = yield* pull;
      if (O.isNone(next)) break;
      if (matches === maximumMatches) return yield* safety("patternMatches");
      // Count and complete-envelope preflight precede row decoding or growth.
      const layout = yield* counts(matches + 1);
      const captures = yield* decodeRow(next.value);
      if (layout.bytes > bytes.byteLength) {
        const capacity = Num.min(limits.processMessageBytes, Num.max(layout.bytes, bytes.byteLength * 2));
        const grown = new Uint8Array(capacity);
        grown.set(bytes);
        bytes = grown;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const offset = matches * (groups + 1) * 8;
      yield* copyRow(view, offset, captures);
      yield* checkRow(view, offset);
      matches++;
    }
    return yield* encode(matches, bytes.subarray(0, matches * (groups + 1) * 8));
  }, timed);
  return { decode, encode, collect };
});
