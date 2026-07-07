/**
 * Schema-backed request and response models for the xAI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XaiId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe, Tuple } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $XaiId.create("XAi.models");
const XAiSseEventIndex = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("XAiSseEventIndex", {
    description: "Zero-based server-sent event index emitted by xAI streaming endpoints.",
  })
);
const XAiWebSocketCloseCode = S.Int.check(S.isBetween({ minimum: 1000, maximum: 4999 })).pipe(
  $I.annoteSchema("XAiWebSocketCloseCode", {
    description: "WebSocket close code emitted by xAI realtime and streaming audio sessions.",
  })
);

/**
 * Numeric HTTP status code returned by the xAI driver.
 *
 * @example
 * ```ts
 * import { XAiHttpStatusCode } from "@beep/xai"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(XAiHttpStatusCode)(200)
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAiHttpStatusCode = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("XAiHttpStatusCode", {
    description: "Numeric HTTP status code returned by the xAI driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link XAiHttpStatusCode}.
 *
 * @example
 * ```ts
 * import type { XAiHttpStatusCode } from "@beep/xai"
 *
 * const status: XAiHttpStatusCode = 200
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiHttpStatusCode = typeof XAiHttpStatusCode.Type;

/**
 * URL query scalar accepted by xAI request options.
 *
 * @example
 * ```ts
 * import type { XAiQueryScalar } from "@beep/xai"
 *
 * const value: XAiQueryScalar = "usage"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAiQueryScalar = S.Union([S.Boolean, S.Null, S.Finite, S.String]).pipe(
  $I.annoteSchema("XAiQueryScalar", {
    description: "URL query scalar accepted by the xAI driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link XAiQueryScalar}.
 *
 * @example
 * ```ts
 * import type { XAiQueryScalar } from "@beep/xai"
 *
 * const value: XAiQueryScalar = 10
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiQueryScalar = typeof XAiQueryScalar.Type;

/**
 * URL query value accepted by xAI request options.
 *
 * @example
 * ```ts
 * import type { XAiQueryValue } from "@beep/xai"
 *
 * const value: XAiQueryValue = ["invoice", "usage"]
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAiQueryValue = S.Union([S.Array(XAiQueryScalar), XAiQueryScalar]).pipe(
  $I.annoteSchema("XAiQueryValue", {
    description: "URL query value accepted by the xAI driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link XAiQueryValue}.
 *
 * @example
 * ```ts
 * import type { XAiQueryValue } from "@beep/xai"
 *
 * const value: XAiQueryValue = "usage"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiQueryValue = typeof XAiQueryValue.Type;

const emptyStringRecord: Readonly<Record<string, string>> = R.empty();
const emptyQueryRecord: Readonly<Record<string, XAiQueryValue>> = R.empty();

/**
 * Request options accepted by every xAI endpoint method.
 *
 * `path` fills route parameters, `query` fills URL parameters, `body` sends
 * JSON, `formData` sends multipart/form-data, and `bytes` sends raw binary.
 *
 * @example
 * ```ts
 * import { XAiRequestOptions } from "@beep/xai"
 *
 * const request = XAiRequestOptions.make({
 *   body: { model: "grok-4", messages: [] },
 *   query: { limit: 10 }
 * })
 *
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiRequestOptions extends S.Class<XAiRequestOptions>($I`XAiRequestOptions`)(
  {
    accept: S.optionalKey(S.String),
    body: S.optionalKey(S.Unknown),
    bytes: S.optionalKey(S.Uint8Array),
    contentType: S.optionalKey(S.String),
    formData: S.optionalKey(S.instanceOf(FormData)),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(emptyStringRecord)),
    path: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(emptyStringRecord)),
    query: S.Record(S.String, XAiQueryValue).pipe(SchemaUtils.withKeyDefaults(emptyQueryRecord)),
  },
  $I.annote("XAiRequestOptions", {
    description: "Request options accepted by every xAI endpoint method.",
  })
) {}

/**
 * JSON response returned by the xAI driver.
 *
 * @example
 * ```ts
 * import { XAiJsonResponse } from "@beep/xai"
 *
 * const response = new XAiJsonResponse({
 *   body: { ok: true },
 *   headers: {},
 *   status: 200
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiJsonResponse extends S.TaggedClass<XAiJsonResponse>($I`XAiJsonResponse`)(
  "Json",
  {
    body: S.Unknown,
    contentType: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    headers: S.Record(S.String, S.String),
    status: XAiHttpStatusCode,
  },
  $I.annote("XAiJsonResponse", {
    description: "JSON response returned by the xAI driver.",
  })
) {}

/**
 * Text response returned by the xAI driver.
 *
 * @example
 * ```ts
 * import { XAiTextResponse } from "@beep/xai"
 *
 * const response = new XAiTextResponse({
 *   headers: {},
 *   status: 200,
 *   text: "ok"
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiTextResponse extends S.TaggedClass<XAiTextResponse>($I`XAiTextResponse`)(
  "Text",
  {
    contentType: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    headers: S.Record(S.String, S.String),
    status: XAiHttpStatusCode,
    text: S.String,
  },
  $I.annote("XAiTextResponse", {
    description: "Text response returned by the xAI driver.",
  })
) {}

/**
 * Binary response returned by the xAI driver.
 *
 * @example
 * ```ts
 * import { XAiBinaryResponse } from "@beep/xai"
 *
 * const response = new XAiBinaryResponse({
 *   bytes: new Uint8Array([1, 2, 3]),
 *   headers: {},
 *   status: 200
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiBinaryResponse extends S.TaggedClass<XAiBinaryResponse>($I`XAiBinaryResponse`)(
  "Binary",
  {
    bytes: S.Uint8Array,
    contentType: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    headers: S.Record(S.String, S.String),
    status: XAiHttpStatusCode,
  },
  $I.annote("XAiBinaryResponse", {
    description: "Binary response returned by the xAI driver.",
  })
) {}

/**
 * Empty response returned by xAI endpoints that have no body.
 *
 * @example
 * ```ts
 * import { XAiNoBodyResponse } from "@beep/xai"
 *
 * const response = new XAiNoBodyResponse({
 *   headers: {},
 *   status: 204
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiNoBodyResponse extends S.TaggedClass<XAiNoBodyResponse>($I`XAiNoBodyResponse`)(
  "NoBody",
  {
    contentType: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    headers: S.Record(S.String, S.String),
    status: XAiHttpStatusCode,
  },
  $I.annote("XAiNoBodyResponse", {
    description: "Empty response returned by xAI endpoints that have no body.",
  })
) {}

/**
 * Response union returned by non-streaming xAI endpoint methods.
 *
 * @example
 * ```ts
 * import type { XAiResponse } from "@beep/xai"
 *
 * const tag = (response: XAiResponse) => response._tag
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAiResponse = S.Union([XAiBinaryResponse, XAiJsonResponse, XAiNoBodyResponse, XAiTextResponse]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("XAiResponse", {
    description: "Response union returned by non-streaming xAI endpoint methods.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link XAiResponse}.
 *
 * @example
 * ```ts
 * import { XAiJsonResponse } from "@beep/xai"
 * import type { XAiResponse } from "@beep/xai"
 *
 * const response: XAiResponse = new XAiJsonResponse({
 *   body: { ok: true },
 *   headers: {},
 *   status: 200
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiResponse = typeof XAiResponse.Type;

/**
 * Parsed server-sent event emitted by streaming xAI endpoints.
 *
 * @example
 * ```ts
 * import { XAiServerSentEvent } from "@beep/xai"
 *
 * const event = XAiServerSentEvent.make({
 *   data: { delta: "hello" },
 *   done: false,
 *   index: 0
 * })
 *
 * console.log(event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XAiServerSentEvent extends S.Class<XAiServerSentEvent>($I`XAiServerSentEvent`)(
  {
    data: S.optionalKey(S.Unknown),
    done: S.Boolean,
    index: XAiSseEventIndex,
  },
  $I.annote("XAiServerSentEvent", {
    description: "Parsed server-sent event emitted by streaming xAI endpoints.",
  })
) {}

const XAiWebSocketEventKindBase = LiteralKit(["close", "error", "message"]);

/**
 * WebSocket event kinds emitted by xAI realtime and streaming audio sessions.
 *
 * @example
 * ```ts
 * import { XAiWebSocketEventKind } from "@beep/xai"
 *
 * const kind = XAiWebSocketEventKind.fromUnknown("message")
 * console.log(kind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiWebSocketEventKind = XAiWebSocketEventKindBase.pipe(
  $I.annoteSchema("XAiWebSocketEventKind", {
    description: "WebSocket event kinds emitted by xAI realtime and streaming audio sessions.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
    fromUnknown: S.decodeUnknownSync(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiWebSocketEventKindBase)
);

/**
 * Type for {@link XAiWebSocketEventKind}.
 *
 * @example
 * ```ts
 * import type { XAiWebSocketEventKind } from "@beep/xai"
 *
 * const kind: XAiWebSocketEventKind = "message"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiWebSocketEventKind = typeof XAiWebSocketEventKind.Type;

type XAiWebSocketEventMember<T extends XAiWebSocketEventKind> = {
  readonly bytes?: Uint8Array;
  readonly code?: number;
  readonly data?: unknown;
  readonly isBinary?: boolean;
  readonly kind: T;
  readonly reason?: string;
  readonly text?: string;
};

/**
 * Event emitted by an xAI WebSocket endpoint session.
 *
 * @example
 * ```ts
 * import { XAiWebSocketEvent } from "@beep/xai"
 *
 * const event: XAiWebSocketEvent = {
 *   kind: "message",
 *   text: "{\"type\":\"session.created\"}"
 * }
 *
 * console.log(event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAiWebSocketEvent = XAiWebSocketEventKind.mapMembers((members) => {
  const fields = <T extends XAiWebSocketEventKind>(literal: S.Literal<T>) => ({
    bytes: S.optionalKey(S.Uint8Array),
    code: S.optionalKey(XAiWebSocketCloseCode),
    data: S.optionalKey(S.Unknown),
    isBinary: S.optionalKey(S.Boolean),
    kind: S.tag(literal.literal),
    reason: S.optionalKey(S.String),
    text: S.optionalKey(S.String),
  });

  const makeClose = (literal: S.Literal<"close">) =>
    S.Class<XAiWebSocketEventMember<"close">>($I`XAiWebSocketEventCloseMember`)(
      fields(literal),
      $I.annote("XAiWebSocketEventCloseMember", {
        description: 'Event member emitted by an xAI WebSocket endpoint session for "close".',
      })
    );

  const makeError = (literal: S.Literal<"error">) =>
    S.Class<XAiWebSocketEventMember<"error">>($I`XAiWebSocketEventErrorMember`)(
      fields(literal),
      $I.annote("XAiWebSocketEventErrorMember", {
        description: 'Event member emitted by an xAI WebSocket endpoint session for "error".',
      })
    );

  const makeMessage = (literal: S.Literal<"message">) =>
    S.Class<XAiWebSocketEventMember<"message">>($I`XAiWebSocketEventMessageMember`)(
      fields(literal),
      $I.annote("XAiWebSocketEventMessageMember", {
        description: 'Event member emitted by an xAI WebSocket endpoint session for "message".',
      })
    );

  return pipe(members, Tuple.evolve([makeClose, makeError, makeMessage]));
}).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("XAiWebSocketEvent", {
    description: "Event emitted by an xAI WebSocket endpoint session.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link XAiWebSocketEvent}.
 *
 * @example
 * ```ts
 * import type { XAiWebSocketEvent } from "@beep/xai"
 *
 * const event: XAiWebSocketEvent = { kind: "message", text: "ok" }
 * console.log(event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiWebSocketEvent = typeof XAiWebSocketEvent.Type;
