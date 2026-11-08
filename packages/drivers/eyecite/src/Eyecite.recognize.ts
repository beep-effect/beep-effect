/**
 * Pinned synchronous recognizer boundary. Invoke only inside an owned child;
 * wrapping synchronous parsing in Effect does not provide preemption.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { extractCitations } from "eyecite-ts";
import {
  EyeciteComponentName,
  EyeciteFailure,
  EyeciteRecognizeInput,
  EyeciteRecognizeOutput,
} from "./Eyecite.models.ts";
import type { Citation, Span } from "eyecite-ts";

const range = (span: Span) => ({ start: span.originalStart, end: span.originalEnd });
const text = (value: string | number | undefined) =>
  O.getOrNull(O.map(O.fromUndefinedOr(value), (value) => `${value}`));
const components = (spans: Readonly<Partial<Record<EyeciteComponentName, Span>>> | undefined) => {
  const values: Readonly<Partial<Record<EyeciteComponentName, Span>>> = O.getOrElse(
    O.fromUndefinedOr(spans),
    () => ({})
  );
  return A.getSomes(
    A.map(EyeciteComponentName.literals, (name) =>
      O.map(O.fromUndefinedOr(values[name]), (span) => ({ name, range: range(span) }))
    )
  );
};
const project = (token: Citation) =>
  Match.value(token).pipe(
    Match.when({ type: "case" }, (value) =>
      O.some({
        type: value.type,
        range: range(value.span),
        components: components(value.spans),
        volume: text(value.volume),
        reporter: value.reporter,
        page: text(value.page),
        plaintiff: text(value.plaintiff),
        defendant: text(value.defendant),
        caseName: text(value.caseName),
        year: text(value.year),
      })
    ),
    Match.when({ type: "shortFormCase" }, (value) =>
      O.some({
        type: value.type,
        range: range(value.span),
        components: components(value.spans),
        volume: text(value.volume),
        reporter: value.reporter,
      })
    ),
    Match.when({ type: "id" }, (value) =>
      O.some({ type: value.type, range: range(value.span), components: components(value.spans) })
    ),
    Match.when({ type: "supra" }, (value) =>
      O.some({
        type: value.type,
        range: range(value.span),
        components: components(value.spans),
        partyName: text(value.partyName),
      })
    ),
    Match.when({ type: "statute", title: 35, code: "U.S.C.", section: P.isString }, (value) =>
      O.some({
        type: value.type,
        range: range(value.span),
        components: components(value.spans),
        title: value.title,
        section: value.section,
      })
    ),
    Match.when({ type: "regulation", title: 37, code: "C.F.R.", section: P.isString }, (value) =>
      O.some({
        type: value.type,
        range: range(value.span),
        components: components(value.spans),
        title: value.title,
        section: value.section,
      })
    ),
    Match.orElse(() => O.none())
  );
/**
 * Validate and project one pinned recognizer invocation inside an owned child.
 * No donor pointer, confidence, publication graph or default resolution escapes.
 * This operation provides no isolation by itself; the caller owns that boundary.
 * @example
 * import { recognizeEyecite } from "@beep/eyecite/recognize"
 * const operation = recognizeEyecite({ source: "35 U.S.C. 101", sourceUtf16: 100, candidates: 10 })
 * void operation // Execute only in an owned RPC child, never its supervisor.
 * @category parsing
 * @since 0.0.0
 */
export const recognizeEyecite = Effect.fn("Eyecite.recognize")(function* (input: unknown) {
  const request = yield* S.decodeUnknownEffect(S.toType(EyeciteRecognizeInput))(input).pipe(
    Effect.mapError(() => EyeciteFailure.make({ reason: "invalid-input" }))
  );
  if (Str.length(request.source) > request.sourceUtf16) return yield* EyeciteFailure.make({ reason: "source-limit" });
  const extracted = yield* Effect.try({
    try: () => extractCitations(request.source, { resolve: false }),
    catch: () => EyeciteFailure.make({ reason: "parser-failed" }),
  });
  if (A.length(extracted) > request.candidates) return yield* EyeciteFailure.make({ reason: "candidate-limit" });
  const tokens = yield* Effect.try({
    try: () => A.getSomes(A.map(extracted, project)),
    catch: () => EyeciteFailure.make({ reason: "invalid-result" }),
  });
  return yield* S.decodeUnknownEffect(S.toType(EyeciteRecognizeOutput))({
    tokens,
    outsideProfile: A.length(extracted) - A.length(tokens),
  }).pipe(Effect.mapError(() => EyeciteFailure.make({ reason: "invalid-result" })));
});
