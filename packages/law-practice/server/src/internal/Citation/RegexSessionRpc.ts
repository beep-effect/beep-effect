/** Sequenced regex session messages and bounded codecs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import { makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationRegexResultEnvelope } from "./RegexResult.ts";
import { CitationRegexSessionJob } from "./RegexSessionProtocol.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import { CitationRegexExecutionFailure } from "./RegexWorkerRpc.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexSessionRpc");
/** Startup carries limits only; engine and descriptor travel with each job.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexSessionStartup extends S.Opaque<
  CitationRegexSessionStartup,
  { readonly brand: unique symbol }
>()(
  S.Struct({ limits: CitationEngineLimits }).pipe(
    $I.annoteSchema("CitationRegexSessionStartup", {
      description: "Bounded source-free session startup configuration.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexSessionReady extends S.Opaque<CitationRegexSessionReady, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Ready", { version: S.tag("citation-regex-worker/v3") }).pipe(
    $I.annoteSchema("CitationRegexSessionReady", { description: "Startup configuration decoded; no job accepted yet." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexSessionStarted extends S.Opaque<
  CitationRegexSessionStarted,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Started", { version: S.tag("citation-regex-worker/v3"), sequence: S.Natural }).pipe(
    $I.annoteSchema("CitationRegexSessionStarted", {
      description: "The sequenced job was decoded before native evaluation.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexSessionFailure extends S.Opaque<
  CitationRegexSessionFailure,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Failure", {
    version: S.tag("citation-regex-worker/v3"),
    sequence: S.Natural,
    failure: CitationRegexExecutionFailure,
  }).pipe(
    $I.annoteSchema("CitationRegexSessionFailure", { description: "Source-free terminal failure for exactly one job." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexSessionComplete extends S.Opaque<
  CitationRegexSessionComplete,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationRegexResultEnvelope.fields, sequence: S.Natural }).pipe(
    $I.annoteSchema("CitationRegexSessionComplete", {
      description: "Existing bounded capture result plus its job sequence.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationRegexSessionReply = S.Union([
  CitationRegexSessionReady,
  CitationRegexSessionStarted,
  CitationRegexSessionFailure,
  CitationRegexSessionComplete,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexSessionReply", {
    description: "Strict Ready and per-job Started/terminal conversation.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationRegexSessionReply = typeof CitationRegexSessionReply.Type;
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const runtime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
const encodeStartup = S.encodeEffect(S.fromJsonString(CitationRegexSessionStartup));
const Args = S.Tuple([
  S.String.check(S.isMaxLength(8192)).pipe(S.decodeTo(S.fromJsonString(CitationRegexSessionStartup))),
]);
const decodeArgs = S.decodeUnknownEffect(Args, { onExcessProperty: "error" });
const encodeReply = S.encodeEffect(S.fromJsonString(CitationRegexSessionReply));
const encodeResult = S.encodeEffect(S.fromJsonString(CitationRegexResultEnvelope));
const encoder = new TextEncoder();
/** @internal @category operations @since 0.0.0 */
export const encodeCitationRegexSessionStartup = Effect.fn("Citation.encodeRegexSessionStartup")(function* (
  startup: CitationRegexSessionStartup
) {
  const text = yield* encodeStartup(startup).pipe(Effect.mapError(runtime));
  if (text.length > 8192) return yield* runtime();
  return text;
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexSessionStartup = Effect.fn("Citation.decodeRegexSessionStartup")((args: unknown) =>
  decodeArgs(args).pipe(Effect.mapBoth({ onSuccess: ([startup]) => startup, onFailure: runtime }))
);
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexSessionReply = makeCitationNativeJsonDecoder({
  codec: S.fromJsonString(CitationRegexSessionReply),
  propertyCeiling: 9,
  maximumDepth: 2,
  invalid,
});
/** Check result header plus its already bounded ASCII base64 before encoding.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexSessionReply = Effect.fn("Citation.encodeRegexSessionReply")(function* (
  reply: CitationRegexSessionReply,
  maximum: number
) {
  const header = CitationRegexSessionReply.guards.Complete(reply) ? { ...reply, spans: "" } : reply;
  const text = yield* encodeReply(header).pipe(Effect.mapError(invalid));
  const size =
    encoder.encode(text).byteLength + 1 + (CitationRegexSessionReply.guards.Complete(reply) ? reply.spans.length : 0);
  if (size > maximum) return yield* exceeded();
  const encoded = yield* encodeReply(reply).pipe(Effect.mapError(invalid));
  const frame = encoder.encode(`${encoded}\n`);
  if (frame.byteLength !== size) return yield* invalid();
  return frame;
});
/** Retain the installation/startup guard that even a resource refusal fits.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationRegexSessionControls = Effect.fn("Citation.preflightRegexSessionControls")(function* (
  maximum: number
) {
  yield* encodeCitationRegexSessionReply(CitationRegexSessionReady.make({}), maximum);
  yield* encodeCitationRegexSessionReply(
    CitationRegexSessionStarted.make({ sequence: Number.MAX_SAFE_INTEGER }),
    maximum
  );
  yield* encodeCitationRegexSessionReply(
    CitationRegexSessionFailure.make({
      sequence: Number.MAX_SAFE_INTEGER,
      failure: CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" }),
    }),
    maximum
  );
});
/** Strip only transport sequence after strict sequenced reply validation.
 * @internal @category operations @since 0.0.0
 */
export const citationRegexSessionResult = Effect.fn("Citation.regexSessionResult")(
  (reply: CitationRegexSessionComplete) =>
    encodeResult(
      CitationRegexResultEnvelope.make({ groups: reply.groups, matches: reply.matches, spans: reply.spans })
    ).pipe(Effect.mapBoth({ onSuccess: (text) => encoder.encode(text), onFailure: invalid }))
);
/** @internal @category services @since 0.0.0 */
export const CitationRegexSessionRpcs = RpcGroup.make(
  Rpc.make("Evaluate", {
    payload: CitationRegexSessionJob,
    success: S.Uint8Array.check(S.isMaxLength(CitationEngineAbsoluteMaxima.processMessageBytes)),
    error: CitationRegexExecutionFailure,
  })
);
