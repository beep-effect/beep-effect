/**
 * Positive metadata projection of bounded native OTLP trace requests.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Fixed64, LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { nativeTraceWire } from "./internal/native-trace-wire.ts";
import { hashPrivateIdentifier } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("native-trace");
const TokenCount = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const SafeName = S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/));
const hexId = (length: number) =>
  S.String.check(
    S.isPattern(new RegExp(`^[0-9a-f]{${length}}$`)),
    S.makeFilter((value) => value !== Str.repeat(length)("0"), {
      identifier: "NonZeroId",
      message: "Identifier must not be zero",
    })
  );
const TraceId = hexId(32);
const SpanId = hexId(16);
const NanoTime = S.String.check(
  S.isPattern(/^(0|[1-9][0-9]{0,19})$/),
  S.makeFilter((value) => value !== "0" && (value.length < 20 || value <= "18446744073709551615"), {
    identifier: "UnsignedNanoseconds",
    message: "Time is outside the unsigned OTLP range",
  })
);
const SpanKind = S.Literals([
  "AGENT",
  "LLM",
  "TOOL",
  "CHAIN",
  "RETRIEVER",
  "EMBEDDING",
  "RERANKER",
  "GUARDRAIL",
  "EVALUATOR",
  "PROMPT",
  "UNKNOWN",
]);
const UsageConvention = S.Literals(["claude-code", "openinference", "unknown"]);
const FixtureSurface = LiteralKit(["cli", "desktop"]).pipe(
  $I.annoteSchema("FixtureSurface", { description: "Declared synthetic fixture surface, never real harness coverage." })
);
const optionalHash = S.OptionFromOptionalKey(Sha256Hex);
const Rejection = S.Struct({ ordinal: S.Natural, reason: S.tag("invalid-span") });

/**
 * Owned route policy and bounded native request bytes.
 *
 * **Example** (Inspect native trace request)
 * ```ts
 * import { NativeTraceRequest } from "@beep/repo-ai-metrics/native-trace"
 * console.log(typeof NativeTraceRequest.make)
 * ```
 * **Details** Route identity is supplied by the receiver configuration, not asserted by a producer attribute. Only exact approved model names and explicitly enabled finite synthetic fixture labels may survive in plaintext. Fixture labels are ignored by default, and never attest real application activity. At most 256 KiB is decoded; the HTTP adapter must enforce the same limit while streaming, before constructing this value.
 * @category models
 * @since 0.0.0
 */
export class NativeTraceRequest extends S.Opaque<NativeTraceRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    routeId: Sha256Hex,
    hashSalt: S.Redacted(S.String),
    contentType: S.Literals(["application/json", "application/x-protobuf"]),
    body: S.Uint8Array.check(
      S.makeFilter((body) => body.byteLength <= 262144, {
        identifier: "NativeRequestBytes",
        message: "Native request exceeds 256 KiB",
      })
    ),
    approvedModels: S.Array(SafeName).check(S.isMaxLength(256)),
    usageConvention: UsageConvention,
    syntheticFixtureMetadata: S.OptionFromOptionalKey(S.Literal(true)).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
  }).pipe($I.annoteSchema("NativeTraceRequest", { description: "Private bounded request with an owned route policy." }))
) {}

/**
 * Content-free native span metadata preserving source identity and measured time.
 *
 * **Example** (Inspect native trace metadata)
 * ```ts
 * import { NativeTraceMetadata } from "@beep/repo-ai-metrics/native-trace"
 * console.log(typeof NativeTraceMetadata.make)
 * ```
 * **Details** No prompt, completion, tool body, exception text, resource map or arbitrary attribute is retained. Zero/unset timestamps remain unknown. Model names require an explicit allowlist; other source strings are hashed except explicitly enabled finite synthetic fixture labels. Usage categories retain their declared convention and are not summed here.
 * @category models
 * @since 0.0.0
 */
export class NativeTraceMetadata extends S.Opaque<NativeTraceMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-trace/v1"),
    eventId: Sha256Hex,
    routeId: Sha256Hex,
    namespaceId: Sha256Hex,
    traceId: TraceId,
    spanId: SpanId,
    parentSpanId: S.OptionFromOptionalKey(SpanId),
    nameHash: optionalHash,
    kind: SpanKind,
    startTimeUnixNano: S.OptionFromOptionalKey(NanoTime),
    endTimeUnixNano: S.OptionFromOptionalKey(NanoTime),
    durationKnown: S.Boolean,
    status: S.Literals(["unset", "ok", "error"]),
    sessionHash: optionalHash,
    fixtureSurface: S.OptionFromOptionalKey(FixtureSurface).pipe(S.withConstructorDefault(Effect.succeedNone)),
    modelHash: optionalHash,
    modelName: S.OptionFromOptionalKey(SafeName),
    usage: S.Struct({
      convention: UsageConvention,
      input: S.OptionFromOptionalKey(TokenCount),
      output: S.OptionFromOptionalKey(TokenCount),
      cacheRead: S.OptionFromOptionalKey(TokenCount),
      cacheWrite: S.OptionFromOptionalKey(TokenCount),
    }),
  })
    .check(
      S.makeFilter(
        (value) => {
          const both = O.isSome(value.startTimeUnixNano) && O.isSome(value.endTimeUnixNano);
          return (
            value.durationKnown === both &&
            (!both ||
              (O.isSome(value.startTimeUnixNano) &&
                O.isSome(value.endTimeUnixNano) &&
                (value.endTimeUnixNano.value.length > value.startTimeUnixNano.value.length ||
                  (value.endTimeUnixNano.value.length === value.startTimeUnixNano.value.length &&
                    value.endTimeUnixNano.value >= value.startTimeUnixNano.value))))
          );
        },
        { identifier: "NativeTimingEvidence", message: "Duration evidence must match valid source endpoints" }
      )
    )
    .pipe(
      $I.annoteSchema("NativeTraceMetadata", {
        description: "Positive allowlisted span projection before durable intake.",
      })
    )
) {}

/**
 * Safe metadata batch with explicit rejected occurrence ordinals.
 *
 * **Example** (Inspect native trace batch)
 * ```ts
 * import { NativeTraceBatch } from "@beep/repo-ai-metrics/native-trace"
 * console.log(typeof NativeTraceBatch.make)
 * ```
 * **Details** Request hashes are salted and include route identity. Rejections contain no offending value. Projection alone is neither durable acceptance nor a network acknowledgment.
 * @category models
 * @since 0.0.0
 */
export class NativeTraceBatch extends S.Opaque<NativeTraceBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-trace-batch/v1"),
    requestId: Sha256Hex,
    namespaceId: Sha256Hex,
    routeId: Sha256Hex,
    spans: S.Array(NativeTraceMetadata).check(S.isMaxLength(1024)),
    rejections: S.Array(Rejection).check(S.isMaxLength(1024)),
  })
    .check(
      S.makeFilter(
        (value) => {
          const total = value.spans.length + value.rejections.length;
          const ordinals = A.map(value.rejections, (entry) => entry.ordinal);
          return (
            total <= 1024 &&
            A.dedupe(ordinals).length === ordinals.length &&
            A.every(ordinals, (ordinal) => ordinal < total)
          );
        },
        { identifier: "NativeBatchPopulation", message: "Native batch counts and rejection positions must reconcile" }
      )
    )
    .pipe(
      $I.annoteSchema("NativeTraceBatch", { description: "Sanitized native metadata and bounded rejection evidence." })
    )
) {}

/**
 * Payload-free native projection refusal.
 *
 * **Example** (Inspect native trace error)
 * ```ts
 * import { NativeTraceError } from "@beep/repo-ai-metrics/native-trace"
 * console.log(NativeTraceError.make({ reason: "invalid-envelope" }).message)
 * ```
 * **Details** Raw decoder errors and inputs are deliberately not attached.
 * @category errors
 * @since 0.0.0
 */
export class NativeTraceError extends S.TaggedError<NativeTraceError, { readonly brand: unique symbol }>(
  $I`NativeTraceError`
)(
  "NativeTraceError",
  { reason: S.Literals(["missing-salt", "oversize", "invalid-envelope", "too-many-spans", "hash-failure"]) },
  $I.annote("NativeTraceError", { description: "Safe native admission boundary refusal." })
) {
  override get message(): string {
    return `Native trace request refused (${this.reason}).`;
  }
}
const failure = (reason: NativeTraceError["reason"]) => NativeTraceError.make({ reason });

// Positive wire subset, field numbers from OpenTelemetry proto v1.9.0 (Apache-2.0):
// https://github.com/open-telemetry/opentelemetry-proto/tree/v1.9.0/opentelemetry/proto
// Event/link payloads are skipped. AnyValue collections stay opaque bytes and are
// never recursively decoded; selected attributes require a single scalar value.
// This is not a full OTLP schema.
const Attributes = S.Array(S.Struct({ key: S.String.check(S.isMaxLength(256)), value: S.Unknown })).check(
  S.isMaxLength(128)
);
const optionalAttributes = S.optionalKey(Attributes);
const RawEnvelope = S.Struct({
  resourceSpans: S.optionalKey(
    S.Array(
      S.Struct({
        resource: S.optionalKey(S.Struct({ attributes: optionalAttributes })),
        scopeSpans: S.optionalKey(
          S.Array(S.Struct({ spans: S.optionalKey(S.Array(S.Unknown).check(S.isMaxLength(1024))) })).check(
            S.isMaxLength(128)
          )
        ),
      })
    ).check(S.isMaxLength(16))
  ),
});
const WireTime = S.Union([S.String.check(S.isPattern(/^[0-9]{1,20}$/)), TokenCount]);
const RawSpan = S.Struct({
  traceId: S.Unknown,
  spanId: S.Unknown,
  parentSpanId: S.optionalKey(S.Unknown),
  name: S.optionalKey(S.String),
  startTimeUnixNano: S.optionalKey(WireTime),
  endTimeUnixNano: S.optionalKey(WireTime),
  attributes: optionalAttributes,
  status: S.optionalKey(S.Struct({ code: S.optionalKey(S.Literals([0, 1, 2])) })),
});
const TextValue = S.Struct({ stringValue: S.String.check(S.isMaxLength(4096)) });
const OneValue = S.Struct({
  stringValue: S.optionalKey(S.Unknown),
  boolValue: S.optionalKey(S.Unknown),
  intValue: S.optionalKey(S.Unknown),
  doubleValue: S.optionalKey(S.Unknown),
  arrayValue: S.optionalKey(S.Unknown),
  kvlistValue: S.optionalKey(S.Unknown),
  bytesValue: S.optionalKey(S.Unknown),
}).check(
  S.makeFilter(
    (value) =>
      A.filter(
        ["stringValue", "boolValue", "intValue", "doubleValue", "arrayValue", "kvlistValue", "bytesValue"],
        (key) => key in value
      ).length === 1,
    {
      identifier: "OneAttributeValue",
      message: "Attribute must have exactly one value kind",
    }
  )
);
const NumberValue = S.Union([
  S.Struct({ intValue: S.Union([TokenCount, S.String.check(S.isPattern(/^(0|[1-9][0-9]{0,15})$/))]) }),
  S.Struct({ doubleValue: TokenCount }),
]);
const id = (value: unknown, length: number, protobuf: boolean) =>
  S.decodeUnknownEffect(hexId(length))(
    protobuf && S.is(S.Uint8Array)(value) ? Hex.encode(value) : S.is(S.String)(value) ? Str.toLowerCase(value) : value
  );
const time = Effect.fnUntraced(function* (value: typeof WireTime.Type | undefined) {
  if (value === undefined) return O.none<bigint>();
  const decoded = yield* S.decodeEffect(Fixed64)(value);
  return decoded > BigInt(0) ? O.some(decoded) : O.none<bigint>();
});
const attributeValues = (attributes: typeof Attributes.Type, keys: ReadonlyArray<string>) =>
  A.map(
    A.filter(attributes, (attribute) => A.contains(keys, attribute.key)),
    (attribute) => attribute.value
  );
const textAttribute = Effect.fnUntraced(function* (attributes: typeof Attributes.Type, keys: ReadonlyArray<string>) {
  const decoded = yield* Effect.forEach(attributeValues(attributes, keys), (value) =>
    S.decodeUnknownEffect(OneValue)(value).pipe(
      Effect.flatMap(S.decodeUnknownEffect(TextValue)),
      Effect.map((value) => value.stringValue)
    )
  );
  const distinct = A.dedupe(decoded);
  if (distinct.length > 1) return yield* failure("invalid-envelope");
  return A.head(distinct);
});
const countAttribute = Effect.fnUntraced(function* (attributes: typeof Attributes.Type, key: string) {
  const decoded = yield* Effect.forEach(attributeValues(attributes, [key]), (value) =>
    S.decodeUnknownEffect(OneValue)(value).pipe(
      Effect.flatMap(S.decodeUnknownEffect(NumberValue)),
      Effect.flatMap((value) =>
        S.decodeEffect(TokenCount)("intValue" in value ? Number(value.intValue) : value.doubleValue)
      )
    )
  );
  const distinct = A.dedupe(decoded);
  if (distinct.length > 1) return yield* failure("invalid-envelope");
  return A.head(distinct);
});
const decodeRawEnvelopeJson = S.decodeEffect(S.fromJsonString(RawEnvelope));
const decodeBoundaryValue = S.decodeUnknownEffect(S.Option(FixtureSurface));

const parentIdentity = Effect.fnUntraced(function* (parent: unknown, protobuf: boolean) {
  if (parent === undefined || parent === "") return O.none<string>();
  if (S.is(S.Uint8Array)(parent) && parent.byteLength === 0) return O.none<string>();
  return O.some(yield* id(parent, 16, protobuf));
});
const claudeSpanKind = Match.type<string | undefined>().pipe(
  Match.when("claude_code.llm_request", (): typeof SpanKind.Type => "LLM"),
  Match.when("claude_code.interaction", (): typeof SpanKind.Type => "AGENT"),
  Match.when(Match.is("claude_code.tool", "claude_code.tool.execution"), (): typeof SpanKind.Type => "TOOL"),
  Match.orElse((): typeof SpanKind.Type => "UNKNOWN")
);
const projectedKind = (kind: O.Option<string>, name: string | undefined, convention: typeof UsageConvention.Type) => {
  const nativeKind = convention === "claude-code" ? claudeSpanKind(name) : "UNKNOWN";
  return O.isSome(kind) && S.is(SpanKind)(kind.value) ? kind.value : nativeKind;
};
const sourceTiming = Effect.fnUntraced(function* (span: typeof RawSpan.Type) {
  const start = yield* time(span.startTimeUnixNano);
  const end = yield* time(span.endTimeUnixNano);
  if (O.isSome(start) && O.isSome(end) && end.value < start.value) return yield* failure("invalid-envelope");
  return {
    startTimeUnixNano: O.map(start, (value) => value.toString()),
    endTimeUnixNano: O.map(end, (value) => value.toString()),
    durationKnown: O.isSome(start) && O.isSome(end),
  };
});
const projectedStatus = Match.type<(typeof RawSpan.Type)["status"]>().pipe(
  Match.when({ code: 1 }, (): NativeTraceMetadata["status"] => "ok"),
  Match.when({ code: 2 }, (): NativeTraceMetadata["status"] => "error"),
  Match.orElse((): NativeTraceMetadata["status"] => "unset")
);
const sourceUsage = Effect.fnUntraced(function* (
  attributes: typeof Attributes.Type,
  convention: typeof UsageConvention.Type
) {
  const isOi = convention === "openinference";
  return {
    convention,
    input: yield* countAttribute(attributes, isOi ? "llm.token_count.prompt" : "input_tokens"),
    output: yield* countAttribute(attributes, isOi ? "llm.token_count.completion" : "output_tokens"),
    cacheRead: yield* countAttribute(
      attributes,
      isOi ? "llm.token_count.prompt_details.cache_read" : "cache_read_tokens"
    ),
    cacheWrite: yield* countAttribute(
      attributes,
      isOi ? "llm.token_count.prompt_details.cache_write" : "cache_creation_tokens"
    ),
  };
});
const privateHash = (salt: string) => (value: string) =>
  hashPrivateIdentifier(value, O.some(salt)).pipe(Effect.mapError(() => failure("hash-failure")));
const hashTextOption = Effect.fnUntraced(function* (value: O.Option<string>, hash: ReturnType<typeof privateHash>) {
  return O.isSome(value) ? O.some(yield* hash(value.value)) : O.none();
});
const projectSpan = Effect.fnUntraced(function* (
  entry: { readonly span: unknown; readonly resource: typeof Attributes.Type },
  input: NativeTraceRequest,
  namespaceId: typeof Sha256Hex.Type,
  hash: ReturnType<typeof privateHash>,
  protobuf: boolean
) {
  const span = yield* S.decodeUnknownEffect(RawSpan)(entry.span);
  const traceId = yield* id(span.traceId, 32, protobuf);
  const spanId = yield* id(span.spanId, 16, protobuf);
  const parentSpanId = yield* parentIdentity(span.parentSpanId, protobuf);
  const attributes = [...entry.resource, ...(span.attributes ?? [])];
  const session = yield* textAttribute(attributes, ["session.id", "gen_ai.conversation.id"]);
  const model = yield* textAttribute(attributes, ["llm.model_name", "gen_ai.request.model", "model"]);
  const kindValue = yield* textAttribute(attributes, ["openinference.span.kind"]);
  const fixtureSurface = O.isSome(input.syntheticFixtureMetadata)
    ? yield* textAttribute(attributes, ["beep.fixture.surface"]).pipe(Effect.flatMap(decodeBoundaryValue))
    : O.none();
  const kind = projectedKind(kindValue, span.name, input.usageConvention);
  const timing = yield* sourceTiming(span);
  return NativeTraceMetadata.make({
    eventId: yield* hash(`native-span/v1:${input.routeId}:${traceId}:${spanId}`),
    routeId: input.routeId,
    namespaceId,
    traceId,
    spanId,
    parentSpanId,
    nameHash: yield* hashTextOption(O.fromUndefinedOr(span.name).pipe(O.filter((name) => name !== "")), hash),
    kind,
    ...timing,
    status: projectedStatus(span.status),
    fixtureSurface,
    sessionHash: yield* hashTextOption(session, hash),
    modelHash: yield* hashTextOption(model, hash),
    modelName: O.filter(model, (value) => A.contains(input.approvedModels, value)),
    usage: yield* sourceUsage(attributes, input.usageConvention),
  });
});

/**
 * Decode and sanitize native OTLP/HTTP JSON or protobuf traces before persistence.
 *
 * **Example** (Project a native trace request)
 * ```ts
 * import { projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace"
 * console.log(typeof projectNativeTraceRequest)
 * ```
 * **Details** Limits request bytes, groups, attributes and total spans. Invalid spans produce safe rejection ordinals; malformed envelopes fail as a whole. Original native trace/span IDs survive and deterministic event IDs scope them to the declared route. The caller must durably commit the result before acknowledging upstream.
 * @category services
 * @since 0.0.0
 */
export const projectNativeTraceRequest = Effect.fn("AiMetrics.projectNativeTraceRequest")(function* (
  input: NativeTraceRequest
) {
  if (input.body.byteLength > 262144) return yield* failure("oversize");
  const salt = Redacted.value(input.hashSalt);
  if (Str.trim(salt) === "") return yield* failure("missing-salt");
  const hash = privateHash(salt);
  const protobuf = input.contentType === "application/x-protobuf";
  const decoded = protobuf
    ? Effect.try({
        try: (): unknown => {
          const type = nativeTraceWire;
          return type.toObject(type.decode(input.body), { longs: String });
        },
        catch: () => failure("invalid-envelope"),
      }).pipe(Effect.flatMap(S.decodeUnknownEffect(RawEnvelope)))
    : Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true }).decode(input.body),
        catch: () => failure("invalid-envelope"),
      }).pipe(Effect.flatMap(decodeRawEnvelopeJson));
  const envelope = yield* decoded.pipe(Effect.mapError(() => failure("invalid-envelope")));
  const entries = A.flatMap(envelope.resourceSpans ?? [], (resource) =>
    A.flatMap(resource.scopeSpans ?? [], (scope) =>
      A.map(scope.spans ?? [], (span) => ({ span, resource: resource.resource?.attributes ?? [] }))
    )
  );
  if (entries.length > 1024) return yield* failure("too-many-spans");
  const namespaceId = yield* hash("ai-metrics-hash-salt-namespace/v1");
  const results = yield* Effect.forEach(entries, (entry) =>
    Effect.result(projectSpan(entry, input, namespaceId, hash, protobuf))
  );
  if (
    A.some(
      results,
      (result) =>
        Result.isFailure(result) && S.is(NativeTraceError)(result.failure) && result.failure.reason === "hash-failure"
    )
  )
    return yield* failure("hash-failure");
  return NativeTraceBatch.make({
    requestId: yield* hash(`native-request/v1:${input.routeId}:${Hex.encode(input.body)}`),
    namespaceId,
    routeId: input.routeId,
    spans: A.map(A.filter(results, Result.isSuccess), (result) => result.success),
    rejections: A.flatMap(results, (result, ordinal) =>
      Result.isFailure(result) ? [Rejection.make({ ordinal, reason: "invalid-span" })] : []
    ),
  });
});
