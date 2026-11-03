/** Bounded complete regex results retaining Python source-point capture spans.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRegexWorkerFailure, preflightCitationRegexJson } from "./RegexWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexResult");
const max = CitationEngineAbsoluteMaxima;
const Limits = S.toType(CitationEngineLimits);
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
const paddedLength = (bytes: number) => 4 * ((bytes + 2 - ((bytes + 2) % 3)) / 3);
const Wire = S.TaggedStruct("Complete", {
  version: S.tag("citation-regex-result/v1"),
  groups: Groups,
  matches: Count,
  spans: S.String.check(S.isMaxLength(paddedLength(max.processMessageBytes))),
}).pipe(
  $I.annoteSchema("Wire", {
    description: "Flat complete-result envelope. Native capture words are decoded only after contextual size checks.",
  })
);
const Json = S.fromJsonString(Wire);
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
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexResult = Effect.fn("Citation.makeRegexResult")(function* (
  policy: unknown,
  expectedGroupsInput: unknown,
  sourcePointsInput: unknown
) {
  const badRuntime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(badRuntime));
  const groups = yield* S.decodeUnknownEffect(Groups)(expectedGroupsInput).pipe(Effect.mapError(badRuntime));
  const sourcePoints = yield* S.decodeUnknownEffect(Position)(sourcePointsInput).pipe(Effect.mapError(badRuntime));
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.extractDeadline, limits.operationDeadline);
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.extractDeadline)
    ? "operationDeadline"
    : "extractDeadline";
  const counts = Effect.fn("Citation.checkRegexResultCounts")(function* (matchesInput: unknown) {
    const matches = yield* S.decodeUnknownEffect(Count)(matchesInput).pipe(Effect.mapError(invalid));
    if (matches > limits.patternMatches) return yield* safety("patternMatches");
    const bytes = matches * (groups + 1) * 8;
    // Includes the fixed header and LF, even for a zero-match result.
    const header = yield* S.encodeEffect(Json)({
      _tag: "Complete",
      version: "citation-regex-result/v1",
      groups,
      matches,
      spans: "",
    }).pipe(Effect.mapError(invalid));
    const completeBytes = encoder.encode(header).byteLength + 1 + paddedLength(bytes);
    if (completeBytes > limits.processMessageBytes) return yield* safety("processMessageBytes");
    return { matches, bytes, completeBytes };
  });
  const validate = Effect.fn("Citation.validateRegexCaptures")(function* (matches: number, bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let previousStart = -1;
    let previousEnd = -1;
    for (let match = 0; match < matches; match++) {
      for (let group = 0; group <= groups; group++) {
        const offset = (match * (groups + 1) + group) * 8;
        if (offset % 4096 === 0) yield* Effect.yieldNow;
        const start = view.getUint32(offset, true);
        const end = view.getUint32(offset + 4, true);
        if (start === absent || end === absent) {
          if (group === 0 || start !== absent || end !== absent) return yield* invalid();
          continue;
        }
        if (start > end || end > sourcePoints) return yield* invalid();
        if (group === 0) {
          // Python can return an empty match and then a nonempty match at the
          // same position. Two identical empty whole matches are not progress.
          if (start < previousEnd || (start === end && start === previousStart && previousStart === previousEnd))
            return yield* invalid();
          previousStart = start;
          previousEnd = end;
        }
        // Lookaround captures can lie outside the whole-match range.
      }
    }
  });
  const timed = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety(deadlineLimit)) }),
      Effect.provideService(Clock.Clock, clock)
    );
  const decode = Effect.fn("Citation.decodeRegexResult")(function* (body: Uint8Array) {
    if (body.byteLength + 1 > limits.processMessageBytes) return yield* safety("processMessageBytes");
    yield* preflightCitationRegexJson(body, 5);
    const text = yield* Effect.try({ try: () => decoder.decode(body), catch: invalid });
    const wire = yield* S.decodeEffect(Json, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
    if (wire.groups !== groups) return yield* invalid();
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
    const text = yield* S.encodeEffect(Json)({
      _tag: "Complete",
      version: "citation-regex-result/v1",
      groups,
      matches: layout.matches,
      spans,
    }).pipe(Effect.mapError(invalid));
    const frame = encoder.encode(`${text}\n`);
    if (frame.byteLength !== layout.completeBytes) return yield* invalid();
    return frame;
  }, timed);
  return { decode, encode };
});
