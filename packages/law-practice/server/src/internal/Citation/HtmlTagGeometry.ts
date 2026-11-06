/** Original HTML tag lookup/conversion from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * Diff generation and emphasis discovery are upstream prepared-stage duties.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexInputLayout, makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";
import { CitationSpanOffsetsPlan, makeCitationSpanOffsets } from "./SpanOffsets.ts";
import { CitationTextBudget } from "./TextBudget.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlTagGeometry");
const max = CitationEngineAbsoluteMaxima;
const Coordinate = S.Natural.check(S.isLessThanOrEqualTo(max.diffInputUtf16)).pipe(
  $I.annoteSchema("Coordinate", { description: "Bounded original markup source-point coordinate." })
);
/** The source tuple contains stripped inner markup, not the element's tag name.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlEmphasis extends S.Opaque<CitationHtmlEmphasis, { readonly brand: unique symbol }>()(
  S.Struct({ text: CitationPythonUnicodeStorage, start: Coordinate, end: Coordinate }).pipe(
    $I.annoteSchema("CitationHtmlEmphasis", {
      description: "One prepared original emphasis match with native inner markup and source-point bounds.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlTagGeometryInput extends S.Opaque<
  CitationHtmlTagGeometryInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationPythonUnicodeStorage,
    forward: CitationSpanOffsetsPlan,
    backward: CitationSpanOffsetsPlan,
    tags: S.Array(CitationHtmlEmphasis).check(S.isMaxLength(max.tokens)),
  }).pipe(
    $I.annoteSchema("CitationHtmlTagGeometryInput", {
      description: "Prepared native plain text, coherent bidirectional diff plans and source emphasis matches.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlTagProjection extends S.Opaque<CitationHtmlTagProjection, { readonly brand: unique symbol }>()(
  S.Struct({ text: CitationPythonUnicodeStorage, start: S.Int, end: S.Int }).pipe(
    $I.annoteSchema("CitationHtmlTagProjection", {
      description: "Original mapped source bounds plus Python-sliced native text, before verified mention conversion.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-policy", "invalid-input", "empty-tags"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed HTML geometry failures without markup, text or map data." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationHtmlTagGeometryFailure extends S.TaggedError<
  CitationHtmlTagGeometryFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlTagGeometryFailure`)(
  "CitationHtmlTagGeometryFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlTagGeometryFailure>("CitationHtmlTagGeometryFailure", {
    description: "Prepared HTML geometry failed without source or partial output.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationHtmlTagGeometryFailure.make({ reason });
const Input = S.toType(CitationHtmlTagGeometryInput);
const Tags = CitationHtmlEmphasis.pipe(S.toType, S.Array)
  .check(S.isMaxLength(max.tokens))
  .pipe(
    $I.annoteSchema("Tags", { description: "Bounded supplied original emphasis tuples before first-tag conversion." })
  );
const sameLayout = CitationRegexInputLayout.pipe(S.toType, S.toEquivalence);
const bound = (index: number, length: number) => Num.max(0, Num.min(length, index < 0 ? length + index : index));
const contains = (tag: CitationHtmlEmphasis, position: number) => tag.start <= position && position < tag.end;
/** Build inside an enclosing operation's captured Scope/timing/budget. This
 * component proves geometry from prepared plans, not the source diff producer.
 * Returned methods require no caller services and copy exposed native buffers.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationHtmlTagGeometry = Effect.fn("Citation.makeHtmlTagGeometry")(function* (
  policy: unknown,
  raw: unknown
) {
  yield* CitationTextBudget;
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const decoded = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (decoded.tags.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  const input = yield* makeCitationRegexInput(limits);
  const plain = yield* input.prepareUnicode(decoded.plain, () => Effect.void);
  if (
    !sameLayout(decoded.forward.before, plain.layout) ||
    !sameLayout(decoded.backward.after, plain.layout) ||
    !sameLayout(decoded.forward.after, decoded.backward.before)
  )
    return yield* fail("invalid-input");
  const forward = yield* makeCitationSpanOffsets(limits, decoded.forward);
  const backward = yield* makeCitationSpanOffsets(limits, decoded.backward);
  const tags = yield* Effect.forEach(
    decoded.tags,
    Effect.fn("Citation.ownHtmlEmphasis")(function* (tag) {
      const text = (yield* input.prepareUnicode(tag.text, () => Effect.void)).value.storage;
      return CitationHtmlEmphasis.make({ text, start: tag.start, end: tag.end });
    })
  );
  const find = Effect.fn("Citation.findHtmlTagsAtPosition")(function* (position: unknown) {
    const markup = yield* forward.update(position, "right");
    let found = O.none<CitationHtmlEmphasis>();
    for (let index = 0; index < tags.length; index++) {
      if (index % 256 === 0) yield* Effect.yieldNow;
      const tag = A.getUnsafe(tags, index);
      if (!contains(tag, markup)) continue;
      if (O.isSome(found)) return A.empty<CitationHtmlEmphasis>();
      found = O.some(tag);
    }
    if (O.isNone(found)) return A.empty<CitationHtmlEmphasis>();
    const tag = found.value;
    const text = (yield* input.prepareUnicode(tag.text, () => Effect.void)).value.storage;
    return [CitationHtmlEmphasis.make({ text, start: tag.start, end: tag.end })];
  });
  const convert = Effect.fn("Citation.convertHtmlTagToPlain")(function* (rawTags: unknown) {
    const results = yield* S.decodeUnknownEffect(Tags)(rawTags).pipe(Effect.mapError(() => fail("invalid-input")));
    if (results.length > limits.tokens)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
    const tag = yield* Effect.fromOption(A.head(results), () => fail("empty-tags"));
    const start = yield* backward.update(tag.start, "right");
    const end = yield* backward.update(tag.end, "right");
    const first = bound(start, plain.value.pythonLength);
    const last = Num.max(first, bound(end, plain.value.pythonLength));
    const text = yield* plain.slice({ start: first, end: last }, () => Effect.void);
    return CitationHtmlTagProjection.make({ text, start, end });
  });
  return { find, convert };
});
