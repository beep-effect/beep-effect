/**
 * Literal cleaning scans adapted from eyecite 2.7.6 clean.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * Native Unicode layout follows CPython 3.11.15, PSF-2.0.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationCleanerProduced } from "./CleanerPipeline.ts";
import { CitationCleanerTextAllocation, CitationCleanerTextOutput } from "./CleanerTextIdentity.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import type { CitationCleanerTextCharge, CitationCleanerWork } from "./CleanerPipeline.ts";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);

const $I = $LawPracticeServerId.create("internal/Citation/LiteralCleaners");
/**
 * The four regex-free primitive cleaner implementations. HTML and the public
 * named/custom cleaner pipeline remain separate integration work.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationLiteralCleaner = LiteralKit(["inline_whitespace", "all_whitespace", "underscores", "xml"]).pipe(
  $I.annoteSchema("CitationLiteralCleaner", {
    description: "Implemented literal clean.py primitives, not the complete clean_text step domain.",
  })
);
/**
 * Schema-derived literal cleaner name.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationLiteralCleaner = typeof CitationLiteralCleaner.Type;
const Input = S.Struct({
  cleaner: CitationLiteralCleaner,
  text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
}).pipe(
  $I.annoteSchema("Input", {
    description: "One bounded literal primitive request; no callable or source-proof fields.",
  })
);
const StageInput = S.Struct({
  ...Input.fields,
  text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
}).pipe(
  $I.annoteSchema("StageInput", {
    description: "Already-owned intermediate text; its original source allowance was checked at the outer boundary.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationLiteralCleanerStage extends S.Opaque<
  CitationLiteralCleanerStage,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
    charges: CitationCleanerProduced.fields.charges,
    allocation: CitationCleanerTextAllocation,
  }).pipe(
    $I.annoteSchema("CitationLiteralCleanerStage", {
      description:
        "Complete primitive output and the original live reservations issued before its slices/replacements.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationLiteralCleanerUnicodeStage extends S.Opaque<
  CitationLiteralCleanerUnicodeStage,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationLiteralCleanerStage.fields, storage: CitationPythonUnicodeStorage }).pipe(
    $I.annoteSchema("CitationLiteralCleanerUnicodeStage", {
      description: "Literal output with exact source code-point storage and original pre-materialization reservations.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "limit-exceeded", "deadline-exceeded"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed primitive input/count/deadline failures without text or causes." })
);
/**
 * Private redacted primitive failure; the public safety translator is not wired.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationLiteralCleanerFailure extends S.TaggedError<
  CitationLiteralCleanerFailure,
  { readonly brand: unique symbol }
>($I`CitationLiteralCleanerFailure`)(
  "CitationLiteralCleanerFailure",
  { reason: Reason },
  $I.annoteError<CitationLiteralCleanerFailure>("CitationLiteralCleanerFailure", {
    description: "Literal cleaner evaluation failed without source content or nested causes.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationLiteralCleanerFailure.make({ reason });
const invalidInput = () => failure("invalid-input");
const whitespace = HashSet.fromIterable(citationPythonTextData.whitespace);
const at = (text: string, index: number) => O.getOrElse(Str.charAt(text, index), () => "");
const literalMatch = (cleaner: CitationLiteralCleaner, char: string) => {
  if (cleaner === "underscores") return char === "_";
  if (cleaner === "inline_whitespace") return char === " " || char === "\t";
  return char === "\u200b" || HashSet.has(whitespace, char);
};
const xmlTerminator = (text: string, index: number) => at(text, index) === "?" && at(text, index + 1) === ">";
const xmlEnd = Effect.fnUntraced(function* (text: string) {
  if (!Str.startsWith("<?xml")(text)) return 0;
  for (let index = 5; index < Str.length(text); index++) {
    if (index % 4096 === 5) yield* Effect.yieldNow;
    const char = at(text, index);
    // Python dot excludes LF, while CR and Unicode separators match.
    if (char === "\n") break;
    if (xmlTerminator(text, index)) return index + 2;
  }
  return 0;
});
const selectRange = Effect.fnUntraced(function* (selection: O.Option<Uint8Array>, start: number, end: number) {
  if (O.isNone(selection)) return;
  for (let index = start; index < end; index++) {
    if (index % 8192 === 0) yield* Effect.yieldNow;
    selection.value[index] = 1;
  }
});
const scanRuns = Effect.fnUntraced(function* <E>(
  text: string,
  cleaner: CitationLiteralCleaner,
  appendRange: (start: number, end: number) => Effect.Effect<void, E>,
  appendSpace: (start: number) => Effect.Effect<void, E>
) {
  const length = Str.length(text);
  let unchanged = 0;
  let run = -1;
  let matches = 0;
  let wholeWhitespace = false;
  const flush = Effect.fnUntraced(function* (end: number) {
    if (cleaner === "underscores" && end - run < 2) return;
    yield* appendRange(unchanged, run);
    if (cleaner !== "underscores") yield* appendSpace(run);
    matches++;
    wholeWhitespace = cleaner !== "underscores" && run === 0 && end === length;
    unchanged = end;
  });
  const consume = Effect.fnUntraced(function* (index: number) {
    if (literalMatch(cleaner, at(text, index))) {
      if (run < 0) run = index;
      return;
    }
    if (run < 0) return;
    yield* flush(index);
    run = -1;
  });
  for (let index = 0; index <= length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    yield* consume(index);
  }
  yield* appendRange(unchanged, length);
  return matches === 0 ? "unchanged" : wholeWhitespace ? "space" : "fresh";
});
const pointUnits = (point: number) => (point > 65535 ? 2 : 1);
const pointWidth = (point: number) => (point <= 255 ? 1 : point <= 65535 ? 2 : 4);
const readNativePoint = (source: CitationPythonUnicodeStorage, index: number) => {
  let point = 0;
  for (let part = 0; part < source.width; part++)
    point += O.getOrElse(O.fromUndefinedOr(source.bytes[index + part]), () => 0) * 2 ** (8 * part);
  return point;
};
const selectedPoint = (original: number, flag: number | undefined) =>
  flag === 1 || flag === 2 ? O.some(flag === 2 ? 32 : original) : O.none<number>();
const visitNative = Effect.fnUntraced(function* <E>(
  source: CitationPythonUnicodeStorage,
  selection: Uint8Array,
  consume: (original: number, flag: number | undefined, offset: number) => Effect.Effect<void, E>
) {
  let offset = 0;
  for (let index = 0; index < source.bytes.length; index += source.width) {
    if (index % (source.width * 4096) === 0) yield* Effect.yieldNow;
    const original = readNativePoint(source, index);
    yield* consume(original, selection[offset], offset);
    offset += pointUnits(original);
  }
});
const writeNativePoint = (bytes: Uint8Array, cursor: number, width: number, original: number) => {
  let point = original;
  for (let part = 0; part < width; part++) {
    bytes[cursor++] = point & 255;
    point >>>= 8;
  }
  return cursor;
};
const encodeSelection = Effect.fnUntraced(function* (
  source: CitationPythonUnicodeStorage,
  selection: Uint8Array,
  expectedUnits: number
) {
  let points = 0;
  let largest = 0;
  let units = 0;
  yield* visitNative(
    source,
    selection,
    Effect.fnUntraced(function* (original, flag, offset) {
      if (original > 65535 && selection[offset + 1] !== flag) return yield* failure("invalid-input");
      const selected = selectedPoint(original, flag);
      if (O.isNone(selected)) return;
      if (flag === 2 && original > 65535) return yield* failure("invalid-input");
      if (selected.value > largest) largest = selected.value;
      units += pointUnits(selected.value);
      points++;
    })
  );
  if (units !== expectedUnits) return yield* failure("invalid-input");
  const width = pointWidth(largest);
  // All result slices and replacements have already reserved their units.
  const bytes = new Uint8Array(points * width);
  let cursor = 0;
  yield* visitNative(source, selection, (original, flag) =>
    Effect.sync(() => {
      const selected = selectedPoint(original, flag);
      if (O.isSome(selected)) cursor = writeNativePoint(bytes, cursor, width, selected.value);
    })
  );
  return CitationPythonUnicodeStorage.make({ width, bytes });
});
/**
 * Capture count ceilings, deadline and Clock. Each apply owns its output budget
 * and returns R = never. Scans yield at most every 4096 input UTF-16 units;
 * no native regex runs and no partial result escapes a failed evaluation.
 * The stage method also accepts already-owned intermediate text and reserves
 * each positive slice/replacement against the caller's shared text budget.
 * Neither method mints source mappings or supplies a public cleaner service.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationLiteralCleaners = Effect.fn("Citation.makeLiteralCleaners")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(input).pipe(Effect.mapError(invalidInput));
  const sourceCeiling = limits.sourceUtf16;
  const outputCeiling = limits.producedTextUtf16;
  const deadline = limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis);
  const clock = yield* Clock.Clock;
  const operationMillis = Duration.toMillis(limits.operationDeadline);
  const cleanMillis = Duration.toMillis(limits.cleanDeadline);
  const nativeDeadline = Duration.millis(cleanMillis <= operationMillis ? cleanMillis : operationMillis);
  const timeLimit = cleanMillis <= operationMillis ? "cleanDeadline" : "operationDeadline";
  const unicode = yield* makeCitationPythonUnicode(limits).pipe(Effect.mapError(invalidInput));
  const makeApply = <E>(
    schema: typeof Input,
    maximumInput: number,
    reserve: (units: number) => Effect.Effect<void, E>,
    selection: O.Option<Uint8Array> = O.none()
  ) =>
    Effect.fn("Citation.applyLiteralCleaner")(
      function* (input: unknown) {
        const { cleaner, text } = yield* S.decodeUnknownEffect(schema)(input).pipe(Effect.mapError(invalidInput));
        const length = Str.length(text);
        if (length > maximumInput) return yield* failure("limit-exceeded");
        return yield* Effect.gen(function* () {
          const output = MutableList.make<string>();
          let produced = 0;
          let allocation: CitationCleanerTextAllocation = "unchanged";
          const append = Effect.fn("Citation.appendCleanedText")(
            Effect.fnUntraced(function* (size: number, render: () => string) {
              if (size > outputCeiling - produced) return yield* failure("limit-exceeded");
              if (size > 0) yield* reserve(size);
              produced += size;
              if (size > 0) MutableList.append(output, render());
            })
          );
          const appendRange = Effect.fn("Citation.appendCleanedRange")(function* (start: number, end: number) {
            yield* selectRange(selection, start, end);
            return yield* append(end - start, () => Str.slice(start, end)(text));
          });
          if (cleaner === "xml") {
            const end = yield* xmlEnd(text);
            if (end > 0) allocation = "fresh";
            yield* appendRange(end, length);
          } else {
            allocation = yield* scanRuns(text, cleaner, appendRange, (start) => {
              if (O.isSome(selection)) selection.value[start] = 2;
              return append(1, () => " ");
            });
          }
          const result = pipe(output, MutableList.takeAll, A.join(""));
          return CitationCleanerTextOutput.make({
            text: result,
            allocation: Str.length(result) === 0 ? "empty" : allocation,
          });
        }).pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(failure("deadline-exceeded")) }));
      },
      Effect.provideService(Clock.Clock, clock)
    );
  const applyOutput = makeApply(Input, sourceCeiling, () => Effect.void);
  const stageSelection = Effect.fn("Citation.evaluateLiteralCleanerStage")(
    function* (input: unknown, work: CitationCleanerWork, selection: O.Option<Uint8Array>) {
      const charges: Array<CitationCleanerTextCharge> = [];
      const reserve = Effect.fn("Citation.reserveLiteralSlice")((units: number) =>
        work.reserveText(units).pipe(
          Effect.tap((charge) =>
            Effect.sync(() => {
              charges.push(charge);
            })
          ),
          Effect.asVoid
        )
      );
      const result = yield* makeApply(
        StageInput,
        CitationEngineAbsoluteMaxima.producedTextUtf16,
        reserve,
        selection
      )(input).pipe(
        Effect.catchTag(
          "CitationLiteralCleanerFailure",
          (error): Effect.Effect<never, CitationLiteralCleanerFailure | CitationSafetyLimitExceeded> => {
            if (error.reason === "limit-exceeded")
              return Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" }));
            if (error.reason === "deadline-exceeded")
              return Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: "cleanDeadline" }));
            return Effect.fail(error);
          }
        )
      );
      return CitationLiteralCleanerStage.make({ ...result, charges });
    },
    Effect.provideService(Clock.Clock, clock)
  );
  const stageUnicode = Effect.fn("Citation.applyNativeLiteralCleaner")(
    function* (cleaner: unknown, storage: unknown, work: CitationCleanerWork) {
      const name = yield* S.decodeUnknownEffect(CitationLiteralCleaner)(cleaner).pipe(Effect.mapError(invalidInput));
      const source = yield* unicode.fromStorage(storage).pipe(
        Effect.mapError((error) =>
          error.reason === "invalid-input"
            ? failure("invalid-input")
            : CitationSafetyLimitExceeded.make({
                operation: "clean",
                limit: error.reason === "limit-exceeded" ? "producedTextUtf16" : timeLimit,
              })
        )
      );
      // Selection is bounded metadata over the validated input, not produced text.
      // 1 retains a source point; 2 emits the one replacement space at a run start.
      const selection = new Uint8Array(source.utf16Units);
      const result = yield* stageSelection({ cleaner: name, text: source.text }, work, O.some(selection));
      const encoded = yield* encodeSelection(source.storage, selection, Str.length(result.text));
      return CitationLiteralCleanerUnicodeStage.make({
        ...result,
        storage: encoded,
      });
    },
    Effect.timeoutOrElse({
      duration: nativeDeadline,
      orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: timeLimit })),
    }),
    Effect.provideService(Clock.Clock, clock)
  );
  return {
    applyOutput,
    apply: Effect.fn("Citation.applyLiteralText")((input: unknown) =>
      applyOutput(input).pipe(Effect.map((result) => result.text))
    ),
    stage: Effect.fn("Citation.applyLiteralCleanerStage")((input: unknown, work: CitationCleanerWork) =>
      stageSelection(input, work, O.none())
    ),
    stageUnicode,
  };
});
