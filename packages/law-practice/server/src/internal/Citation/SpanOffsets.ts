/** SpanUpdater step folding and bisect lookup from eyecite 2.7.6 annotate.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * This consumes prepared diff steps; it does not implement a diff algorithm.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationRegexInputLayout } from "./RegexInput.ts";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SpanOffsets");
const max = CitationEngineAbsoluteMaxima;
const Operation = LiteralKit(["=", "+", "-"]).pipe(
  $I.annoteSchema("Operation", { description: "Original equal, inserted and deleted source-point runs." })
);
const Kind = LiteralKit(["shift", "replace"]).pipe(
  $I.annoteSchema("Kind", { description: "Original relative or constant offset updater." })
);
/** @internal @category models @since 0.0.0 */
export const CitationSpanOffsetSide = LiteralKit(["left", "right"]).pipe(
  $I.annoteSchema("CitationSpanOffsetSide", {
    description: "Built-in bisect-left or bisect-right semantics, not an arbitrary callback.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationSpanOffsetSide = typeof CitationSpanOffsetSide.Type;
/** @internal @category models @since 0.0.0 */
export class CitationSpanDiffStep extends S.Opaque<CitationSpanDiffStep, { readonly brand: unique symbol }>()(
  S.Struct({ operation: Operation, amount: S.Natural.check(S.isLessThanOrEqualTo(max.diffInputUtf16)) }).pipe(
    $I.annoteSchema("CitationSpanDiffStep", {
      description: "One prepared native source-point edit run, including zero-length supplied controls.",
    })
  )
) {}
/** Prepared owners supply real source layouts; shape alone is no diff proof.
 * @internal @category models @since 0.0.0
 */
export class CitationSpanOffsetsPlan extends S.Opaque<CitationSpanOffsetsPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    before: CitationRegexInputLayout,
    after: CitationRegexInputLayout,
    steps: S.Array(CitationSpanDiffStep).check(S.isMaxLength(max.diffSteps)),
  }).pipe(
    $I.annoteSchema("CitationSpanOffsetsPlan", {
      description: "Prepared source layouts and ordered edit steps before bounded immutable index allocation.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationSpanOffsetEntry extends S.Opaque<CitationSpanOffsetEntry, { readonly brand: unique symbol }>()(
  S.Struct({ offset: S.Natural, kind: Kind, value: S.Int }).pipe(
    $I.annoteSchema("CitationSpanOffsetEntry", {
      description: "Source constructor state as data, without retaining source updater functions.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-policy", "invalid-plan", "invalid-offset", "empty-map"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed prepared offset-map failures without source text or arrays." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationSpanOffsetsFailure extends S.TaggedError<
  CitationSpanOffsetsFailure,
  { readonly brand: unique symbol }
>($I`CitationSpanOffsetsFailure`)(
  "CitationSpanOffsetsFailure",
  { reason: Reason },
  $I.annoteError<CitationSpanOffsetsFailure>("CitationSpanOffsetsFailure", {
    description: "Offset indexing failed without source content, callbacks or partial state.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationSpanOffsetsFailure.make({ reason });
const Position = S.Int.check(S.isBetween({ minimum: -max.diffInputUtf16, maximum: max.diffInputUtf16 })).pipe(
  $I.annoteSchema("Position", {
    description: "Bounded original lookup coordinate, retaining negative and beyond-source observations.",
  })
);
const Plan = S.toType(CitationSpanOffsetsPlan);
const safety = (limit: "diffInputUtf16" | "diffSteps") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const measure = Effect.fn("Citation.measureSpanOffsetRuns")(function* (steps: ReadonlyArray<CitationSpanDiffStep>) {
  let consumed = 0;
  let emitted = 0;
  let entries = 0;
  for (let index = 0; index < steps.length; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const step = A.getUnsafe(steps, index);
    if (step.operation !== "+") {
      consumed += step.amount;
      entries++;
    }
    if (step.operation !== "-") emitted += step.amount;
  }
  return { consumed, emitted, entries };
});
const build = Effect.fn("Citation.buildSpanOffsetIndex")(function* (
  steps: ReadonlyArray<CitationSpanDiffStep>,
  count: number
) {
  const table = new DataView(new ArrayBuffer(count * 12));
  let offset = 0;
  let delta = 0;
  let cursor = 0;
  const put = (value: number) => table.setInt32(cursor++ * 4, value, true);
  const append = (position: number, shift: number, deleted: boolean) => {
    put(position);
    put(deleted ? 1 : 0);
    put(deleted ? position + shift : shift);
  };
  for (let index = 0; index < steps.length; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const step = A.getUnsafe(steps, index);
    if (step.operation === "+") {
      delta += step.amount;
      continue;
    }
    const deleted = step.operation === "-";
    append(offset, delta, deleted);
    offset += step.amount;
    if (deleted) delta -= step.amount;
  }
  return (index: number) => table.getInt32(index * 4, true);
});
/** Build only from prepared steps/layouts. UTF-16 and step checks precede packed
 * index allocation. The enclosing HTML/annotation operation owns its deadline;
 * cooperative construction and lookup methods require no caller services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSpanOffsets = Effect.fn("Citation.makeSpanOffsets")(function* (policy: unknown, raw: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const decoded = yield* S.decodeUnknownEffect(Plan)(raw).pipe(Effect.mapError(() => fail("invalid-plan")));
  if (decoded.steps.length > limits.diffSteps) return yield* safety("diffSteps");
  if (decoded.before.utf16Units + decoded.after.utf16Units > limits.diffInputUtf16)
    return yield* safety("diffInputUtf16");
  const before = decoded.before.pythonLength;
  const after = decoded.after.pythonLength;
  const steps = A.map(decoded.steps, (step) => CitationSpanDiffStep.make({ ...step }));
  const measured = yield* measure(steps);
  if (measured.consumed !== before || measured.emitted !== after) return yield* fail("invalid-plan");
  const count = measured.entries;
  const at = yield* build(steps, count);
  const update = Effect.fn("Citation.updateSpanOffset")(function* (rawPosition: unknown, rawSide: unknown) {
    const position = yield* S.decodeUnknownEffect(Position)(rawPosition).pipe(
      Effect.mapError(() => fail("invalid-offset"))
    );
    const side = yield* S.decodeUnknownEffect(CitationSpanOffsetSide)(rawSide).pipe(
      Effect.mapError(() => fail("invalid-offset"))
    );
    if (count === 0) return yield* fail("empty-map");
    let lower = 0;
    let upper = count;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      const key = at(middle * 3);
      if (side === "left" ? key < position : key <= position) lower = middle + 1;
      else upper = middle;
    }
    // Python index -1 deliberately chooses the final source updater.
    const selected = lower === 0 ? count - 1 : lower - 1;
    const value = at(selected * 3 + 2);
    return at(selected * 3 + 1) === 0 ? position + value : value;
  });
  const snapshot = Effect.gen(function* () {
    const entries = A.empty<CitationSpanOffsetEntry>();
    for (let index = 0; index < count; index++) {
      if (index % 256 === 0) yield* Effect.yieldNow;
      entries.push(
        CitationSpanOffsetEntry.make({
          offset: at(index * 3),
          kind: at(index * 3 + 1) === 0 ? "shift" : "replace",
          value: at(index * 3 + 2),
        })
      );
    }
    return entries;
  }).pipe(Effect.withSpan("Citation.snapshotSpanOffsets"));
  return { update, snapshot };
});
