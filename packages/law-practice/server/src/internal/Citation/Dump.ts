/** Builtin dump_citations formatting adapted from eyecite 2.7.6 utils.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * Rendering views carry no verification authority and never mint source anchors.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationNativeRendering } from "./NativeRendering.ts";
import { makeCitationPythonRepr } from "./PythonRepr.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import {
  citationPythonPointAt,
  concatCitationPythonRanges,
  findCitationPythonLiteral,
  makeCitationPythonUnicode,
  normalizeCitationPythonSlice,
} from "./PythonUnicode.ts";
import { CitationRegexOperation } from "./RegexPolicy.ts";
import type { CitationEngineLimits, CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/Dump");
/** Closed builtin formatting failure without input data or parser causes.
 * @internal @category errors @since 0.0.0
 */
export class CitationDumpFailure extends S.TaggedError<CitationDumpFailure, { readonly brand: unique symbol }>(
  $I`CitationDumpFailure`
)(
  "CitationDumpFailure",
  { reason: S.Literals(["invalid-policy", "invalid-input", "invalid-configuration"]) },
  $I.annoteError<CitationDumpFailure>("CitationDumpFailure", {
    description: "Builtin dump preparation failed without source text or nested causes.",
  })
) {}
const fail = (reason: CitationDumpFailure["reason"]) => CitationDumpFailure.make({ reason });
/** Native label words, with a lossless ASCII convenience form for symbolic names.
 * @internal @category models @since 0.0.0
 */
export const CitationDumpLabel = S.Union([
  S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16), S.isAscii()),
  CitationPythonUnicodeStorage,
]).pipe(
  $I.annoteSchema("CitationDumpLabel", {
    description: "Source class/key text without collapsing adjacent surrogate words.",
  })
);
/** Schema-derived rendering label.
 * @internal @category models @since 0.0.0
 */
export type CitationDumpLabel = typeof CitationDumpLabel.Type;

/** Closed builtin dump values; arbitrary object repr and subclass hooks are separate.
 * @internal @category models @since 0.0.0
 */
export const CitationDumpScalar = S.TaggedUnion({
  Text: { value: CitationPythonUnicodeStorage },
  Integer: { value: S.Int },
  Boolean: { value: S.Boolean },
  None: {},
}).pipe($I.annoteSchema("CitationDumpScalar", { description: "Owned builtin scalar observation for source repr." }));
/** Schema-derived builtin dump scalar.
 * @internal @category models @since 0.0.0
 */
export type CitationDumpScalar = typeof CitationDumpScalar.Type;
const Named = S.Struct({ name: CitationDumpLabel, value: CitationDumpScalar });
/** Preserve source dictionary insertion order independently of semantic field order.
 * @internal @category models @since 0.0.0
 */
export const CitationDumpField = S.TaggedUnion({
  Scalar: Named.fields,
  Fields: { name: S.String, entries: S.Array(Named).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)) },
}).pipe(
  $I.annoteSchema("CitationDumpField", { description: "One ordered scalar or flat builtin dictionary dump field." })
);
/** Schema-derived ordered dump field.
 * @internal @category models @since 0.0.0
 */
export type CitationDumpField = typeof CitationDumpField.Type;
/** Source-visible class label, native span and ordered dump observations.
 * @internal @category models @since 0.0.0
 */
export class CitationDumpRow extends S.Opaque<CitationDumpRow, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: CitationDumpLabel,
    span: S.Tuple([S.Int, S.Int]),
    fields: S.Array(CitationDumpField).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
  }).pipe(
    $I.annoteSchema("CitationDumpRow", {
      description: "Private formatting observation, not a Citation codec or verified occurrence.",
    })
  )
) {}
const Input = S.toType(
  S.Struct({
    text: CitationPythonUnicodeStorage,
    citations: S.Array(CitationDumpRow).check(S.isMaxLength(CitationEngineAbsoluteMaxima.mentions)),
    contextChars: S.optionalKey(S.Int),
  })
);
const whitespace = HashSet.fromIterable(citationPythonTextData.whitespace);
const newline = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([10]) });
const endpoint = (value: bigint, size: number) =>
  Number(value < -BigInt(size) ? -BigInt(size) : value > BigInt(size) ? BigInt(size) : value);
const trimBefore = Effect.fn("Citation.trimDumpBefore")(function* (
  text: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  const last = yield* findCitationPythonLiteral(text, newline, start, end, true);
  let left = O.match(last, { onNone: () => start, onSome: (range) => start + range.end });
  while (left < end && HashSet.has(whitespace, String.fromCodePoint(citationPythonPointAt(text, left)))) {
    left++;
    if (left % 4096 === 0) yield* Effect.yieldNow;
  }
  return { start: left, end };
});
const trimAfter = Effect.fn("Citation.trimDumpAfter")(function* (
  text: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  const first = yield* findCitationPythonLiteral(text, newline, start, end);
  let right = O.match(first, { onNone: () => end, onSome: (range) => start + range.start });
  while (right > start && HashSet.has(whitespace, String.fromCodePoint(citationPythonPointAt(text, right - 1)))) {
    right--;
    if (right % 4096 === 0) yield* Effect.yieldNow;
  }
  return { start, end: right };
});
const contextRanges = Effect.fn("Citation.dumpContextRanges")(function* (
  text: CitationPythonUnicodeStorage,
  start: number,
  end: number,
  context: number
) {
  const size = text.bytes.length / text.width;
  const beforeStart = BigInt(start) - BigInt(context);
  const before = normalizeCitationPythonSlice(
    text,
    endpoint(beforeStart < BigInt(0) ? BigInt(0) : beforeStart, size),
    endpoint(BigInt(start), size)
  );
  const after = normalizeCitationPythonSlice(
    text,
    endpoint(BigInt(end), size),
    endpoint(BigInt(end) + BigInt(context), size)
  );
  return {
    before: yield* trimBefore(text, before.start, before.end),
    matched: normalizeCitationPythonSlice(text, endpoint(BigInt(start), size), endpoint(BigInt(end), size)),
    after: yield* trimAfter(text, after.start, after.end),
  };
});
const truthy = (value: CitationDumpScalar) =>
  CitationDumpScalar.match(value, {
    Text: ({ value }) => value.bytes.length > 0,
    Integer: ({ value }) => value !== 0,
    Boolean: ({ value }) => value,
    None: () => false,
  });
const makeParts = Effect.fn("Citation.makeDumpParts")(function* (
  limits: CitationEngineLimits,
  budget: CitationTextBudget["Service"],
  operation: CitationEngineOperation
) {
  const unicode = yield* makeCitationPythonUnicode(limits, operation);
  const ranges = MutableList.make<{
    readonly source: CitationPythonUnicodeStorage;
    readonly start: number;
    readonly end: number;
  }>();
  const range = (source: CitationPythonUnicodeStorage, start = 0, end = source.bytes.length / source.width) => {
    MutableList.append(ranges, { source, start, end });
  };
  const literal = Effect.fn("Citation.dumpLiteral")(function* (text: string) {
    const native = yield* unicode.fromTextReserved(text, budget.reserve);
    range(native.storage);
  });
  const label = (value: CitationDumpLabel) =>
    typeof value === "string"
      ? literal(value)
      : unicode.fromStorageReserved(value, budget.reserve).pipe(Effect.map((owned) => range(owned.storage)));
  let first = true;
  const line = Effect.suspend(() => {
    if (first) {
      first = false;
      return Effect.void;
    }
    return literal("\n");
  });
  const finish = () =>
    concatCitationPythonRanges(MutableList.takeAll(ranges), (layout) => budget.reserve(layout.utf16Units));
  return { range, literal, label, line, finish };
});
const renderFields = Effect.fn("Citation.dumpFields")(function* (
  fields: ReadonlyArray<CitationDumpField>,
  parts: Effect.Success<ReturnType<typeof makeParts>>,
  repr: Effect.Success<ReturnType<typeof makeCitationPythonRepr>>
) {
  const scalar = (value: CitationDumpScalar) =>
    CitationDumpScalar.match(value, {
      Text: ({ value }) => repr.text(value).pipe(Effect.map((output) => parts.range(output))),
      Integer: ({ value }) =>
        S.encodeEffect(S.FiniteFromString)(value).pipe(
          Effect.mapError(() => fail("invalid-input")),
          Effect.flatMap(parts.literal)
        ),
      Boolean: ({ value }) => parts.literal(value ? "True" : "False"),
      None: () => parts.literal("None"),
    });
  for (const field of fields)
    yield* CitationDumpField.match(field, {
      Fields: Effect.fnUntraced(function* (field) {
        if (field.entries.length === 0) return;
        yield* parts.line;
        yield* parts.literal("  * ");
        yield* parts.label(field.name);
        for (const entry of field.entries) {
          yield* parts.line;
          yield* parts.literal("    * ");
          yield* parts.label(entry.name);
          yield* parts.literal("=");
          yield* scalar(entry.value);
        }
      }),
      Scalar: Effect.fnUntraced(function* (field) {
        if (!truthy(field.value)) return;
        yield* parts.line;
        yield* parts.literal("  * ");
        yield* parts.label(field.name);
        yield* parts.literal("=");
        yield* scalar(field.value);
      }),
    });
});
/** Render builtin source observations with exact ANSI/context behavior and no logging.
 * Inputs remain immutable for the invocation. Every returned method captures R=never.
 * General citation.dump callbacks, dictionary subclasses and repr hooks stay separate.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDump = Effect.fn("Citation.makeDump")(function* (policy: unknown, printability: unknown) {
  const context = yield* makeCitationNativeRendering(policy, () => fail("invalid-policy"));
  const { limits, timing, unicode } = context;
  const table = yield* S.decodeUnknownEffect(S.String)(printability).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  yield* makeCitationPythonRepr(limits, table).pipe(Effect.mapError(() => fail("invalid-configuration")));
  const digest = yield* Digest.Digest;
  const render = Effect.fn("Citation.dumpBuiltins")(
    function* (raw: unknown) {
      const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
      if (request.citations.length > limits.mentions)
        return yield* CitationSafetyLimitExceeded.make({ operation: timing.operation, limit: "mentions" });
      const budget = yield* context.budget;
      const repr = yield* makeCitationPythonRepr(limits, table).pipe(
        Effect.provideService(CitationTextBudget, budget),
        Effect.provideService(Digest.Digest, digest)
      );
      const text = yield* unicode.fromStorageReserved(request.text, budget.reserve);
      const parts = yield* makeParts(limits, budget, timing.operation);
      for (const row of request.citations) {
        const context = yield* contextRanges(text.storage, row.span[0], row.span[1], request.contextChars ?? 30);
        yield* parts.line;
        yield* parts.literal("\x1b[32m");
        yield* parts.label(row.kind);
        yield* parts.literal(":\x1b[0m ");
        parts.range(text.storage, context.before.start, context.before.end);
        yield* parts.literal("\x1b[94m\x1b[1m");
        parts.range(text.storage, context.matched.start, context.matched.end);
        yield* parts.literal("\x1b[0m");
        parts.range(text.storage, context.after.start, context.after.end);
        yield* renderFields(row.fields, parts, repr);
      }
      return yield* parts.finish();
    },
    timing.timed,
    Effect.provideService(CitationRegexOperation, timing.operation)
  );
  const renderClosed: (
    input: unknown
  ) => Effect.Effect<CitationPythonUnicodeStorage, Effect.Error<ReturnType<typeof render>>> = render;
  return { render: renderClosed };
});
