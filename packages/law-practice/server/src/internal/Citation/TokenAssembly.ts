/** Source tokenizer assembly control flow, eyecite 2.7.6 (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenAssembly");
const Position = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16));
const Id = S.Natural;
const Span = S.Tuple([Position, Position]);
const Reason = LiteralKit(["invalid-policy", "invalid-input", "host-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed token assembly boundary failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenAssemblyFailure extends S.TaggedError<
  CitationTokenAssemblyFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenAssemblyFailure`)(
  "CitationTokenAssemblyFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenAssemblyFailure>("CitationTokenAssemblyFailure", {
    description: "Token assembly failed without source content or host causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationAssemblyView extends S.Opaque<CitationAssemblyView, { readonly brand: unique symbol }>()(
  S.Struct({ start: S.Int, end: S.Int, hasData: S.Boolean, truthy: S.Boolean, citation: S.Boolean }).pipe(
    $I.annoteSchema("CitationAssemblyView", {
      description: "Trusted current token state, distinct from its stable sorting key.",
    })
  )
) {}
const Text = S.TaggedStruct("Text", { start: Position, end: Position });
const Token = S.TaggedStruct("Token", { id: Id });
const Item = S.Union([Text, Token]);
const Input = S.Struct({
  length: Position,
  ids: S.Array(Id).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
});
/** @internal @category models @since 0.0.0 */
export class CitationAssemblyResult extends S.Opaque<CitationAssemblyResult, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(Item).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
    citations: S.Array(S.Tuple([S.Natural, Id])).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
  }).pipe(
    $I.annoteSchema("CitationAssemblyResult", {
      description: "Mixed token/text plans and exact special-token indices; identities refer to the captured host.",
    })
  )
) {}
/** Captured source-object and gap-planning protocol. Implementations own source
 * token construction/merge semantics and bounded text-span allocation. This
 * profile requires immutable token spans/data/classes during assembly; edition
 * state may change through merge. General custom span/data mutation is open.
 * Methods
 * have R = never; caller-owned mutable token state is observed in source order.
 * @internal @category services @since 0.0.0
 */
export class CitationTokenAssemblyHost extends Context.Service<
  CitationTokenAssemblyHost,
  {
    readonly read: (
      id: number
    ) => Effect.Effect<CitationAssemblyView, CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
    readonly merge: (
      left: number,
      right: number
    ) => Effect.Effect<boolean, CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
    readonly nominative: (
      id: number
    ) => Effect.Effect<boolean, CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
    readonly text: (
      start: number,
      end: number
    ) => Effect.Effect<ReadonlyArray<typeof Span.Type>, CitationTokenAssemblyFailure | CitationSafetyLimitExceeded>;
  }
>()($I`CitationTokenAssemblyHost`) {}
const invalid = () => CitationTokenAssemblyFailure.make({ reason: "invalid-input" });
const safety = (limit: "candidates" | "tokens") => CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const order = Order.Struct({ start: Order.Number, end: Order.flip(Order.Number) });

/** Stable source sorting, merge-before-overlap and deferred last-token commit.
 * The deferred token lets nominative replacement pop only the final token,
 * preserving the source's already-emitted text gaps without an array stack.
 * Host effects are captured once; no partial assembly result escapes failure.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenAssembly = Effect.fn("Citation.makeTokenAssembly")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationTokenAssemblyFailure.make({ reason: "invalid-policy" })
  );
  const timing = yield* makeCitationRegexTiming(limits, true);
  const host = yield* CitationTokenAssemblyHost;
  const assemble = Effect.fn("Citation.assembleTokens")(function* (input: unknown) {
    const { length, ids } = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(invalid));
    if (ids.length > limits.candidates) return yield* safety("candidates");
    const keys = yield* Effect.forEach(ids, (id) => host.read(id).pipe(Effect.map((view) => ({ ...view, id }))), {
      concurrency: 1,
    });
    const sorted = A.sort(
      A.filter(keys, (key) => key.hasData),
      order
    );
    const items = MutableList.make<typeof Item.Type>();
    const citations = MutableList.make<readonly [number, number]>();
    let pending = O.none<number>();
    let offset = 0;
    const append = Effect.fn("Citation.appendAssemblyItem")(function* (item: typeof Item.Type) {
      if (items.length >= limits.tokens) return yield* safety("tokens");
      MutableList.append(items, item);
    });
    const commit = Effect.fn("Citation.commitPendingToken")(function* () {
      if (O.isNone(pending)) return;
      const index = items.length;
      yield* append({ _tag: "Token", id: pending.value });
      MutableList.append(citations, [index, pending.value]);
      pending = O.none();
    });
    const gap = Effect.fn("Citation.appendTextGap")(function* (start: number, end: number) {
      const spans = yield* host.text(start, end);
      if (spans.length > limits.tokens - items.length) return yield* safety("tokens");
      for (const [start, end] of spans) yield* append({ _tag: "Text", start, end });
    });
    const previousTruthy = Effect.fn("Citation.previousTruthyToken")(function* () {
      if (O.isNone(pending)) return O.none<number>();
      const previous = yield* host.read(pending.value);
      return previous.truthy ? pending : O.none<number>();
    });
    const tryMerge = Effect.fn("Citation.tryAssemblyMerge")(function* (previous: O.Option<number>, id: number) {
      if (O.isNone(previous)) return false;
      return yield* host.merge(previous.value, id);
    });
    const mayReplace = Effect.fn("Citation.mayReplaceNominative")(function* (
      previous: O.Option<number>,
      citation: boolean
    ) {
      if (!citation || O.isNone(previous)) return false;
      return yield* host.nominative(previous.value);
    });
    const visit = Effect.fn("Citation.visitAssemblyToken")(function* (id: number) {
      const token = yield* host.read(id);
      if (token.start > token.end || token.end > length) return yield* invalid();
      const last = yield* previousTruthy();
      if (yield* tryMerge(last, id)) return;
      if (offset > token.start) {
        if (!(yield* mayReplace(last, token.citation))) return;
        pending = O.none();
      }
      yield* commit();
      if (offset < token.start) yield* gap(offset, token.start);
      pending = O.some(id);
      offset = token.end;
    });
    for (const key of sorted) {
      yield* Effect.yieldNow;
      yield* visit(key.id);
    }
    yield* commit();
    if (offset < length) yield* gap(offset, length);
    return CitationAssemblyResult.make({
      items: MutableList.takeAll(items),
      citations: MutableList.takeAll(citations),
    });
  }, timing.timed);
  return { assemble };
});
