/**
 * Exhaustive conformance classification for lossless Lexical editor-state wire.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.conformance
 * @since 0.0.0
 */

import { $LexicalSchemaId } from "@beep/identity/packages";
import * as Conformance from "@beep/schema/Conformance";
import { pipe, Result } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BeepLexicalConformanceAnnotation } from "./internal/conformance/Lexical.conformance-registry.ts";
import {
  analyzeEditorStateCompatibilityResult,
  LexicalCompatibilityIssue,
  SerializedEditorState,
  SerializedEditorStateWire,
} from "./Lexical.model.ts";

const $I = $LexicalSchemaId.create("Lexical.conformance");

const encodeEditorState = S.encodeResult(SerializedEditorState);
const decodeEditorStateWire = S.decodeUnknownResult(SerializedEditorStateWire);
const wireEquivalence = S.toEquivalence(SerializedEditorStateWire);

class CompatibleEditorState extends S.TaggedClass<CompatibleEditorState>($I`CompatibleEditorState`)(
  "compatible",
  {
    state: SerializedEditorState,
    wire: SerializedEditorStateWire,
  },
  $I.annote("CompatibleEditorState", {
    description: "Lossless Lexical wire already equal to its strict v1 semantic encoding.",
  })
) {}

class NormalizableEditorState extends S.TaggedClass<NormalizableEditorState>($I`NormalizableEditorState`)(
  "normalizable",
  {
    state: SerializedEditorState,
    wire: SerializedEditorStateWire,
    normalizedWire: SerializedEditorStateWire,
  },
  $I.annote("NormalizableEditorState", {
    description: "Lexical wire accepted by the strict model after a declared canonical normalization.",
  })
) {}

class UnsupportedEditorState extends S.TaggedClass<UnsupportedEditorState>($I`UnsupportedEditorState`)(
  "unsupported",
  {
    issues: S.NonEmptyArray(LexicalCompatibilityIssue),
    wire: SerializedEditorStateWire,
  },
  $I.annote("UnsupportedEditorState", {
    description: "Valid lossless Lexical JSON wire outside the package's supported strict semantic grammar.",
  })
) {}

class InvalidEditorState extends S.TaggedClass<InvalidEditorState>($I`InvalidEditorState`)(
  "invalid",
  {
    message: S.NonEmptyString,
  },
  $I.annote("InvalidEditorState", {
    description: "Input which is not valid lossless Lexical JSON editor-state wire.",
  })
) {}

/**
 * Exhaustive compatibility result for a Lexical editor-state boundary.
 *
 * **Details**
 *
 * `compatible` values are exact strict-v1 fixed points. `normalizable` values
 * are accepted after a declared schema normalization and retain both forms.
 * `unsupported` values remain lossless JSON but cannot enter the strict model.
 * `invalid` values do not satisfy even the lossless JSON-wire boundary.
 *
 * **Example** (Match every compatibility outcome)
 *
 * ```ts import.meta.vitest name="Match every compatibility outcome"
 * import { inspectEditorStateConformance, LexicalConformanceResult } from "@beep/lexical-schema/Lexical.conformance"
 *
 * const result = inspectEditorStateConformance({ root: null })
 * const status = LexicalConformanceResult.match(result, {
 *   compatible: () => "compatible",
 *   normalizable: () => "normalizable",
 *   unsupported: () => "unsupported",
 *   invalid: () => "invalid",
 * })
 * status // => "invalid"
 * ```
 *
 * @invariant Every input is classified into exactly one exhaustive result case.
 * @see {@link https://lexical.dev/docs/concepts/serialization#lexical---html | Lexical serialization and deserialization} for the upstream import and export semantics.
 * @category diagnostics
 * @since 0.0.0
 */
export const LexicalConformanceResult = S.Union([
  CompatibleEditorState,
  NormalizableEditorState,
  UnsupportedEditorState,
  InvalidEditorState,
]).pipe(
  Conformance.annotateConformance(BeepLexicalConformanceAnnotation),
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LexicalConformanceResult", {
    description: "Exhaustive strict, normalizable, unsupported, or invalid Lexical editor-state classification.",
  })
);

/**
 * Runtime result represented by {@link LexicalConformanceResult}.
 *
 * @see {@link LexicalConformanceResult} for constructors, guards, and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type LexicalConformanceResult = typeof LexicalConformanceResult.Type;

const invalidConformanceResult = ({ message }: { readonly message: string }): LexicalConformanceResult =>
  LexicalConformanceResult.cases.invalid.make({ message });

const unavailableStrictStateIssue = LexicalCompatibilityIssue.make({
  message: "Strict semantic state is unavailable.",
});

const unsupportedIssues = (
  issues: ReadonlyArray<LexicalCompatibilityIssue>
): A.NonEmptyReadonlyArray<LexicalCompatibilityIssue> => [
  pipe(A.head(issues), O.getOrElse(constant(unavailableStrictStateIssue))),
  ...A.drop(issues, 1),
];

const normalizeEditorStateWire = (state: SerializedEditorState) =>
  pipe(encodeEditorState(state), Result.flatMap(decodeEditorStateWire));

/**
 * Classify unknown input against the lossless and strict Lexical boundaries.
 *
 * **Example** (Recognize unsupported future wire)
 *
 * ```ts import.meta.vitest name="Recognize unsupported future wire"
 * import { inspectEditorStateConformance } from "@beep/lexical-schema/Lexical.conformance"
 *
 * const result = inspectEditorStateConformance({
 *   root: { type: "root", version: 9, children: [{ type: "future-node", version: 1 }] },
 * })
 * result._tag // => "unsupported"
 * ```
 *
 * @param input - Unknown editor-state input to classify without discarding lossless wire.
 * @returns One exhaustive conformance result with all recoverable representations retained.
 * @invariant Strictly accepted normalized values re-encode to `normalizedWire`.
 * @see {@link https://lexical.dev/docs/concepts/serialization#lexicalnodeexportjson | Lexical node serialization} for the upstream JSON contract.
 * @category validation
 * @since 0.0.0
 */
export const inspectEditorStateConformance = (input: unknown): LexicalConformanceResult =>
  Result.match(analyzeEditorStateCompatibilityResult(input), {
    onFailure: invalidConformanceResult,
    onSuccess: ({ issues, state, wire }) =>
      O.match(state, {
        onNone: () => LexicalConformanceResult.cases.unsupported.make({ issues: unsupportedIssues(issues), wire }),
        onSome: (strictState) =>
          Result.match(normalizeEditorStateWire(strictState), {
            onFailure: invalidConformanceResult,
            onSuccess: (normalizedWire) =>
              wireEquivalence(wire, normalizedWire)
                ? LexicalConformanceResult.cases.compatible.make({ state: strictState, wire })
                : LexicalConformanceResult.cases.normalizable.make({
                    state: strictState,
                    wire,
                    normalizedWire,
                  }),
          }),
      }),
  });
