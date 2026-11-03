/** Typed regex procedure and closed native conversation; no process authority.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRegexDescriptorFailure, CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { CitationRegexResultEnvelope } from "./RegexResult.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";
import {
  CitationRegexWorkerFailure,
  CitationRegexWorkerJob,
  preflightCitationRegexJson,
} from "./RegexWorkerProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexWorkerRpc");
const Reason = LiteralKit(["unsupported-profile", "native-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Native evaluation failures without source or engine diagnostics." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexEvaluationFailure extends S.TaggedError<
  CitationRegexEvaluationFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexEvaluationFailure`)(
  "CitationRegexEvaluationFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexEvaluationFailure>("CitationRegexEvaluationFailure", {
    description: "Closed isolated evaluator failure with no native cause retained.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export const CitationRegexExecutionFailure = S.Union([
  CitationRegexWorkerFailure,
  CitationRegexDescriptorFailure,
  CitationRegexTranslationFailure,
  CitationRegexEvaluationFailure,
  CitationSafetyLimitExceeded,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexExecutionFailure", {
    description: "Closed failures crossing the private regex boundary.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationRegexExecutionFailure = typeof CitationRegexExecutionFailure.Type;
/** @internal @category models @since 0.0.0 */
export class CitationRegexWorkerReady extends S.Opaque<CitationRegexWorkerReady, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Ready", { version: S.tag("citation-regex-worker/v1") }).pipe(
    $I.annoteSchema("CitationRegexWorkerReady", { description: "Explicit startup configuration was decoded." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexWorkerStarted extends S.Opaque<
  CitationRegexWorkerStarted,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Started", { version: S.tag("citation-regex-worker/v1") }).pipe(
    $I.annoteSchema("CitationRegexWorkerStarted", { description: "One complete job was decoded before evaluation." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexWorkerError extends S.Opaque<CitationRegexWorkerError, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failure", {
    version: S.tag("citation-regex-worker/v1"),
    failure: CitationRegexExecutionFailure,
  }).pipe(
    $I.annoteSchema("CitationRegexWorkerError", {
      description: "Only closed source-free failures cross the child boundary.",
    })
  )
) {}
const Control = S.Union([CitationRegexWorkerReady, CitationRegexWorkerStarted, CitationRegexWorkerError]).pipe(
  S.toTaggedUnion("_tag")
);
const ControlJson = S.fromJsonString(Control);
/** @internal @category models @since 0.0.0 */
export const CitationRegexWorkerReply = S.Union([
  CitationRegexWorkerReady,
  CitationRegexWorkerStarted,
  CitationRegexWorkerError,
  CitationRegexResultEnvelope,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexWorkerReply", {
    description: "Ready, Started, then a complete result or closed failure.",
  })
);
const ReplyJson = S.fromJsonString(CitationRegexWorkerReply);
/** @internal @category models @since 0.0.0 */
export class CitationRegexWorkerStartup extends S.Opaque<
  CitationRegexWorkerStartup,
  { readonly brand: unique symbol }
>()(
  S.Struct({ limits: CitationEngineLimits, descriptor: CitationRegexPatternDescriptor }).pipe(
    $I.annoteSchema("CitationRegexWorkerStartup", {
      description: "Trusted parent-selected policy and descriptor, containing no pattern or source text.",
    })
  )
) {}
const StartupJson = S.fromJsonString(CitationRegexWorkerStartup);
const argumentBound = 8 * CitationEngineAbsoluteMaxima.patternUtf16 + 8192;
const Args = S.Tuple([S.String.check(S.isMaxLength(argumentBound)).pipe(S.decodeTo(StartupJson))]).pipe(
  $I.annoteSchema("Args", { description: "One bounded explicit startup argument; no environment is read." })
);
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const runtime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
/** @internal @category operations @since 0.0.0 */
export const encodeCitationRegexStartup = Effect.fn("Citation.encodeRegexStartup")(function* (
  value: CitationRegexWorkerStartup
) {
  let units = 0;
  for (const name of R.keys(value.descriptor.profile.names)) {
    units += Str.length(name) + 8;
    if (units > 4 * value.limits.patternUtf16) return yield* runtime();
  }
  const encoded = yield* S.encodeEffect(StartupJson)(value).pipe(Effect.mapError(runtime));
  if (Str.length(encoded) > argumentBound) return yield* runtime();
  return encoded;
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexStartup = Effect.fn("Citation.decodeRegexStartup")((args: unknown) =>
  S.decodeUnknownEffect(Args, { onExcessProperty: "error" })(args).pipe(
    Effect.mapBoth({ onSuccess: ([value]) => value, onFailure: runtime })
  )
);
/** Constant-size control data; variable capture payloads use the result codec.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexControl = Effect.fn("Citation.encodeRegexControl")(function* (
  value: typeof Control.Type,
  maximum: number
) {
  const text = yield* S.encodeEffect(ControlJson)(value).pipe(Effect.mapError(invalid));
  const bytes = encoder.encode(`${text}\n`);
  if (bytes.byteLength > maximum)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
  return bytes;
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexReply = Effect.fn("Citation.decodeRegexReply")(function* (bytes: Uint8Array) {
  yield* preflightCitationRegexJson(bytes, 8, 2);
  const text = yield* Effect.try({ try: () => decoder.decode(bytes), catch: invalid });
  return yield* S.decodeEffect(ReplyJson, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
});
/** A resource failure must fit even when the original result/error cannot.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationRegexControlFrames = Effect.fn("Citation.preflightRegexControlFrames")(function* (
  maximum: number
) {
  yield* encodeCitationRegexControl(CitationRegexWorkerReady.make({}), maximum);
  yield* encodeCitationRegexControl(CitationRegexWorkerStarted.make({}), maximum);
  yield* encodeCitationRegexControl(
    CitationRegexWorkerError.make({
      failure: CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" }),
    }),
    maximum
  );
});
/** @internal @category services @since 0.0.0 */
export const CitationRegexRpcs = RpcGroup.make(
  Rpc.make("Evaluate", {
    payload: CitationRegexWorkerJob,
    success: S.Uint8Array.check(S.isMaxLength(CitationEngineAbsoluteMaxima.processMessageBytes)),
    error: CitationRegexExecutionFailure,
  })
);
