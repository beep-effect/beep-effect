/**
 * Experimental OTLP packet capture helpers for server observability testing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Clock, Context, Effect, Layer, Match, MutableRef, pipe } from "effect";
import * as S from "effect/Schema";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import { decodeNonNegativeInt } from "../../internal/decode.ts";
import type * as O from "effect/Option";
import type * as HttpBody from "effect/unstable/http/HttpBody";

const $I = $ObservabilityId.create("experimental/server/OtlpPacketLab");
const textDecoder = new TextDecoder();

/**
 * OTLP packet families captured by the packet lab.
 *
 * **Example** (Enum traces kind value)
 *
 * ```ts import.meta.vitest name="Enum traces kind value"
 * import { OtlpPacketKind } from "@beep/observability/experimental/server"
 *
 * const kind: OtlpPacketKind = OtlpPacketKind.Enum.traces
 * kind // => "traces"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OtlpPacketKind = LiteralKit(["logs", "metrics", "traces"]).pipe(
  $I.annoteSchema("OtlpPacketKind", {
    description: "OTLP packet families captured by the packet lab.",
  })
);

/**
 * Runtime type for {@link OtlpPacketKind}.
 *
 * **Example** (Type alias string assignment)
 *
 * ```typescript
 * import type { OtlpPacketKind } from "@beep/observability/experimental/server"
 *
 * const kind: OtlpPacketKind = "traces"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OtlpPacketKind = typeof OtlpPacketKind.Type;

/**
 * OTLP body encodings captured by the packet lab.
 *
 * **Example** (Enum json encoding value)
 *
 * ```ts import.meta.vitest name="Enum json encoding value"
 * import { OtlpPacketEncoding } from "@beep/observability/experimental/server"
 *
 * const encoding: OtlpPacketEncoding = OtlpPacketEncoding.Enum.json
 * encoding // => "json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OtlpPacketEncoding = LiteralKit(["json", "protobuf"]).pipe(
  $I.annoteSchema("OtlpPacketEncoding", {
    description: "OTLP body encodings captured by the packet lab.",
  })
);

/**
 * Runtime type for {@link OtlpPacketEncoding}.
 *
 * **Example** (Type alias string assignment)
 *
 * ```typescript
 * import type { OtlpPacketEncoding } from "@beep/observability/experimental/server"
 *
 * const encoding: OtlpPacketEncoding = "json"
 * console.log(encoding)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OtlpPacketEncoding = typeof OtlpPacketEncoding.Type;

/**
 * One captured OTLP packet.
 *
 * **Example** (Make packet with fields)
 *
 * ```ts import.meta.vitest name="Make packet with fields"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { OtlpPacket } from "@beep/observability/experimental/server"
 *
 * const zero = S.decodeUnknownSync(NonNegativeInt)(0)
 * const packet = OtlpPacket.make({
 *   capturedAtMs: zero,
 *   contentType: "application/json",
 *   encoding: "json",
 *   kind: "traces",
 *   preview: "{}",
 *   size: zero
 * })
 * packet.kind // => "traces"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OtlpPacket extends S.Class<OtlpPacket>($I`OtlpPacket`)(
  {
    kind: OtlpPacketKind,
    encoding: OtlpPacketEncoding,
    capturedAtMs: NonNegativeInt,
    contentType: S.String,
    size: NonNegativeInt,
    preview: S.String,
  },
  $I.annote("OtlpPacket", {
    description: "One captured OTLP packet.",
  })
) {}

/**
 * Packet lab service for capturing serialized OTLP payloads.
 *
 * **Example** (Yield lab and snapshot)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { OtlpPacketLab } from "@beep/observability/experimental/server"
 *
 * const program = Effect.gen(function* () {
 *   const lab = yield* OtlpPacketLab
 *   return yield* lab.snapshot
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OtlpPacketLab extends Context.Service<
  OtlpPacketLab,
  {
    readonly snapshot: Effect.Effect<ReadonlyArray<OtlpPacket>>;
    readonly clear: Effect.Effect<void>;
    readonly latest: (kind: OtlpPacketKind) => Effect.Effect<O.Option<OtlpPacket>>;
  }
>()("@beep/observability/experimental/server/OtlpPacketLab") {}

const contentTypeFromBody: (body: HttpBody.HttpBody) => string | undefined = Match.type<HttpBody.HttpBody>().pipe(
  Match.tagsExhaustive({
    Empty: () => undefined,
    FormData: () => undefined,
    Raw: (body) => body.contentType,
    Stream: () => undefined,
    Uint8Array: (body) => body.contentType,
  })
);

const previewFromBody: (body: HttpBody.HttpBody) => string = Match.type<HttpBody.HttpBody>().pipe(
  Match.tagsExhaustive({
    Uint8Array: (body) => {
      const contentType = contentTypeFromBody(body) ?? "application/octet-stream";
      return Str.contains(contentType, "json") || Str.startsWith(contentType, "text/")
        ? pipe(textDecoder.decode(body.body), Str.slice(0, 400))
        : `Uint8Array(${body.body.length})`;
    },
    Empty: () => "",
    Raw: (body) => `Raw(${body.contentLength ?? 0})`,
    FormData: () => "FormData",
    Stream: (body) => `Stream(${body.contentLength ?? 0})`,
  })
);

const sizeFromBody: (body: HttpBody.HttpBody) => number = Match.type<HttpBody.HttpBody>().pipe(
  Match.tagsExhaustive({
    Empty: () => 0,
    FormData: () => 0,
    Raw: (body) => body.contentLength ?? 0,
    Stream: (body) => body.contentLength ?? 0,
    Uint8Array: (body) => body.body.length,
  })
);

const makePacket = (
  clock: Clock.Clock,
  kind: OtlpPacketKind,
  encoding: OtlpPacketEncoding,
  body: HttpBody.HttpBody
): OtlpPacket =>
  OtlpPacket.make({
    kind,
    encoding,
    capturedAtMs: decodeNonNegativeInt(clock.currentTimeMillisUnsafe()),
    contentType: contentTypeFromBody(body) ?? "application/octet-stream",
    size: decodeNonNegativeInt(sizeFromBody(body)),
    preview: previewFromBody(body),
  });

const makePacketLabRuntime = (clock: Clock.Clock) => {
  const packets = MutableRef.make<ReadonlyArray<OtlpPacket>>(A.empty());

  const snapshot = Effect.fn("OtlpPacketLab.snapshot")(() => Effect.sync(() => MutableRef.get(packets)));
  const clear = Effect.fn("OtlpPacketLab.clear")(() => Effect.sync(() => void MutableRef.set(packets, A.empty())));
  const latest = Effect.fn("OtlpPacketLab.latest")((kind: OtlpPacketKind) =>
    Effect.sync(() =>
      pipe(
        MutableRef.get(packets),
        A.filter((packet) => packet.kind === kind),
        A.last
      )
    )
  );

  return {
    service: OtlpPacketLab.of({
      snapshot: snapshot(),
      clear: clear(),
      latest,
    }),
    capture: (kind: OtlpPacketKind, encoding: OtlpPacketEncoding, body: HttpBody.HttpBody) =>
      void MutableRef.update(packets, A.append(makePacket(clock, kind, encoding, body))),
  };
};

const makeLayer = (encoding: OtlpPacketEncoding, baseLayer: Layer.Layer<OtlpSerialization.OtlpSerialization>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      const runtime = makePacketLabRuntime(clock);

      return Layer.mergeAll(
        Layer.succeed(OtlpPacketLab, runtime.service),
        Layer.effect(
          OtlpSerialization.OtlpSerialization,
          Effect.gen(function* () {
            const base = yield* OtlpSerialization.OtlpSerialization;

            return OtlpSerialization.OtlpSerialization.of({
              traces(data) {
                const body = base.traces(data);
                runtime.capture("traces", encoding, body);
                return body;
              },
              metrics(data) {
                const body = base.metrics(data);
                runtime.capture("metrics", encoding, body);
                return body;
              },
              logs(data) {
                const body = base.logs(data);
                runtime.capture("logs", encoding, body);
                return body;
              },
            });
          })
        ).pipe(Layer.provide(baseLayer))
      );
    })
  );

/**
 * Build a packet lab backed by JSON OTLP serialization.
 *
 * **Example** (Provide JSON lab layer)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { OtlpPacketLab, layerJson } from "@beep/observability/experimental/server"
 *
 * const snapshot = Effect.gen(function* () {
 *   const lab = yield* OtlpPacketLab
 *   return yield* lab.snapshot
 * }).pipe(Effect.provide(layerJson))
 *
 * console.log(snapshot)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerJson = makeLayer("json", OtlpSerialization.layerJson);

/**
 * Build a packet lab backed by protobuf OTLP serialization.
 *
 * **Example** (Provide protobuf lab layer)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { OtlpPacketLab, layerProtobuf } from "@beep/observability/experimental/server"
 *
 * const snapshot = Effect.gen(function* () {
 *   const lab = yield* OtlpPacketLab
 *   return yield* lab.snapshot
 * }).pipe(Effect.provide(layerProtobuf))
 *
 * console.log(snapshot)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerProtobuf = makeLayer("protobuf", OtlpSerialization.layerProtobuf);
