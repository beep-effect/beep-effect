/** Bind owned native regex captures to built-in source token construction.
 * eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationRegexResultEnvelope } from "./RegexResult.ts";
import { CitationTokenConstruction, CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationPythonSliceLayout } from "./PythonUnicode.ts";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";
import type { CitationRegexCapture } from "./RegexResult.ts";
import type { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import type { CitationTokenAssemblyFailure } from "./TokenAssembly.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenCapture");
const Bindings = S.Struct({
  groups: CitationRegexResultEnvelope.fields.groups,
  names: S.Record(S.String.check(S.isMaxLength(256)), S.Int.check(S.isBetween({ minimum: 1, maximum: 10 }))),
})
  .check(
    S.makeFilter(
      (v) =>
        A.every(R.values(v.names), (index) => index <= v.groups) &&
        HashSet.size(HashSet.fromIterable(R.values(v.names))) === R.size(v.names),
      $I.annote("NameBindings", { description: "Unique participating named ordinals within the captured group count." })
    )
  )
  .pipe(
    $I.annoteSchema("Bindings", {
      description: "Captured group count and compiler-owned name-to-ordinal metadata; not execution authority.",
    })
  );
const ResultMetadata = S.Struct({
  matches: CitationRegexResultEnvelope.fields.matches,
  groups: CitationRegexResultEnvelope.fields.groups,
}).pipe(
  $I.annoteSchema("ResultMetadata", {
    description: "Context-owned decoded frame cardinality checked before capture reads.",
  })
);
const Recipe = S.Struct({
  kind: CitationTokenSeed.fields.kind,
  offset: S.optionalKey(
    S.Int.check(
      S.isBetween({
        minimum: -CitationEngineAbsoluteMaxima.producedTextUtf16,
        maximum: CitationEngineAbsoluteMaxima.producedTextUtf16,
      })
    )
  ),
  extra: S.optionalKey(S.Unknown),
}).pipe(
  $I.annoteSchema("Recipe", {
    description:
      "Built-in constructor selection and raw extras validated before materialization; no callback execution.",
  })
);
const EmptyExtra = S.Record(S.String, S.Never).pipe(
  $I.annoteSchema("EmptyExtra", { description: "An exact empty keyword dictionary for non-citation built-ins." })
);
const CitationExtra = S.Struct({
  exact_editions: S.optionalKey(CitationTokenSeed.fields.exact),
  variation_editions: S.optionalKey(CitationTokenSeed.fields.variation),
  short: S.optionalKey(S.Boolean),
}).pipe(
  $I.annoteSchema("CitationExtra", {
    description: "Current frozen array/bool citation-constructor extras; other Python protocols remain open.",
  })
);
const Reason = LiteralKit([
  "invalid-input",
  "invalid-bindings",
  "missing-capture",
  "invalid-extra",
  "invalid-frame",
]).pipe($I.annoteSchema("Reason", { description: "Closed native capture/constructor binding failures." }));
/** @internal @category errors @since 0.0.0 */
export class CitationTokenCaptureFailure extends S.TaggedError<
  CitationTokenCaptureFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenCaptureFailure`)(
  "CitationTokenCaptureFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenCaptureFailure>("CitationTokenCaptureFailure", {
    description: "Capture binding failed without source text, names, payloads or causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationTokenCaptureFailure.make({ reason });
/** Live owned result/source and token-store capacity ports. The transport caller
 * binds cursor and group metadata to this exact source/program before issuance.
 * The producer must not reenter the token store while borrowing its capacity.
 * Allocation approval is an existing operation-ledger hook, never request data.
 * @internal @category services @since 0.0.0
 */
export class CitationTokenCaptureRuntime extends Context.Service<
  CitationTokenCaptureRuntime,
  {
    readonly source: CitationPreparedRegexInput;
    readonly result: {
      readonly matches: number;
      readonly groups: number;
      readonly capture: (
        match: unknown,
        group: unknown
      ) => Effect.Effect<typeof CitationRegexCapture.Type, CitationRegexWorkerFailure>;
    };
    readonly construct: <E>(
      produce: (remaining: number) => Effect.Effect<CitationTokenConstruction, E>
    ) => Effect.Effect<number, E | CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
    readonly beforeAllocate: (
      layout: CitationPythonSliceLayout
    ) => Effect.Effect<void, CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
  }
>()($I`CitationTokenCaptureRuntime`) {}

/** Capture transport-owned operands once. Each token selects group one, maps
 * every named ordinal, preserves unmatched/null data and applies source offset.
 * Only the current built-in string/null groups and array/bool extra profile is
 * accepted; custom constructors and iterable/object protocols remain open.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenCapture = Effect.fn("Citation.makeTokenCapture")(function* (
  policy: unknown,
  bindingsInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-input"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const runtime = yield* CitationTokenCaptureRuntime;
  const decoded = yield* S.decodeUnknownEffect(Bindings)(bindingsInput).pipe(
    Effect.mapError(() => fail("invalid-bindings"))
  );
  const names = A.sort(
    R.toEntries(decoded.names),
    Order.mapInput(Order.Number, ([, index]: readonly [string, number]) => index)
  );
  const observed = yield* S.decodeEffect(ResultMetadata)(runtime.result).pipe(
    Effect.mapError(() => fail("invalid-bindings"))
  );
  if (decoded.groups !== observed.groups || observed.matches > limits.patternMatches)
    return yield* fail("invalid-bindings");
  const capture = Effect.fn("Citation.tokenCaptureRange")((match: number, group: number) =>
    runtime.result.capture(match, group).pipe(Effect.mapError(() => fail("invalid-frame")))
  );
  const extras = Effect.fn("Citation.decodeTokenExtra")(function* (kind: typeof Recipe.Type.kind, input: unknown) {
    if (kind !== "CitationToken") {
      yield* S.decodeUnknownEffect(EmptyExtra, { onExcessProperty: "error" })(input).pipe(
        Effect.mapError(() => fail("invalid-extra"))
      );
      return { exact: A.empty<number>(), variation: A.empty<number>(), short: false };
    }
    const extra = yield* S.decodeUnknownEffect(CitationExtra, { onExcessProperty: "error" })(input).pipe(
      Effect.mapError(() => fail("invalid-extra"))
    );
    const exact = A.map(extra.exact_editions ?? [], (id) => id);
    const variation = A.map(extra.variation_editions ?? [], (id) => id);
    if (exact.length + variation.length > limits.candidates)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
    return { exact, variation, short: extra.short ?? false };
  });
  const build = Effect.fn("Citation.tokenFromNativeMatch")(function* (matchInput: unknown, recipeInput: unknown) {
    const match = yield* S.decodeUnknownEffect(S.Natural)(matchInput).pipe(
      Effect.mapError(() => fail("invalid-input"))
    );
    if (match >= observed.matches) return yield* fail("invalid-frame");
    if (decoded.groups < 1) return yield* fail("missing-capture");
    const recipe = yield* S.decodeUnknownEffect(Recipe, { onExcessProperty: "error" })(recipeInput).pipe(
      Effect.mapError(() => fail("invalid-input"))
    );
    const first = yield* capture(match, 1);
    const extra = yield* extras(recipe.kind, recipe.extra === undefined ? {} : recipe.extra);
    return yield* runtime.construct(
      Effect.fn("Citation.produceCapturedToken")(function* (remaining: number) {
        let used = 0;
        const materialize = Effect.fn("Citation.materializeTokenCapture")(function* (
          range: typeof CitationRegexCapture.Type
        ) {
          if (range._tag === "Unmatched") return null;
          return yield* runtime.source
            .slice(
              range,
              Effect.fn("Citation.reserveTokenCapture")(function* (layout: CitationPythonSliceLayout) {
                if (layout.utf16Units > remaining - used)
                  return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
                yield* runtime.beforeAllocate(layout);
                used += layout.utf16Units;
              })
            )
            .pipe(Effect.catchTag("CitationRegexInputFailure", () => Effect.fail(fail("invalid-frame"))));
        });
        const data = yield* materialize(first);
        const groups = yield* Effect.forEach(
          names,
          ([name, index]) =>
            capture(match, index).pipe(
              Effect.flatMap(materialize),
              Effect.map((value) => Tuple.make(name, value))
            ),
          { concurrency: 1 }
        );
        return CitationTokenConstruction.make({
          seed: CitationTokenSeed.make({
            kind: recipe.kind,
            data,
            start: first._tag === "Range" ? first.start : -1,
            end: first._tag === "Range" ? first.end : -1,
            groups: R.fromEntries(groups),
            ...extra,
          }),
          offset: recipe.offset ?? 0,
        });
      })
    );
  }, timing.timed);
  return { build };
});
