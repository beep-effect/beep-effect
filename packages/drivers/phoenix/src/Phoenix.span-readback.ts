/**
 * Bounded exact-identity span queries for delivery reconciliation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PhoenixId } from "@beep/identity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { PhoenixConfigInput } from "./Phoenix.config.ts";

const $I = $PhoenixId.create("Phoenix.span-readback");
const text = S.String.check(S.isMaxLength(4096));
const scalar = S.Union([text, S.Finite, S.Boolean]);
const traceId = S.String.check(S.isPattern(/^[0-9a-f]{32}$/));
const spanId = S.String.check(S.isPattern(/^[0-9a-f]{16}$/));
/**
 * Exact identity and the only attribute keys allowed out of the reader.
 * **Example** (Inspecting a lookup)
 * ```ts
 * import { PhoenixSpanLookup } from "@beep/phoenix"
 * console.log(typeof PhoenixSpanLookup.make)
 * ```
 * **Details** The caller owns this allowlist. Unknown response attributes and event/message content never leave this reader. The server must return an unpaginated unique match; omitted rows are not proof of non-delivery.
 * @category models
 * @since 0.0.0
 */
export class PhoenixSpanLookup extends S.Opaque<PhoenixSpanLookup, { readonly brand: unique symbol }>()(
  S.Struct({
    project: S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/)),
    traceId,
    spanId,
    attributeKeys: S.Array(S.String.check(S.isMinLength(1), S.isMaxLength(128))).check(S.isMaxLength(64)),
  }).pipe($I.annoteSchema("PhoenixSpanLookup", { description: "Bounded exact span lookup and projection allowlist." }))
) {}
/**
 * Positive scalar projection of one stored span.
 * **Example** (Inspecting evidence)
 * ```ts
 * import { PhoenixStoredSpan } from "@beep/phoenix"
 * console.log(typeof PhoenixStoredSpan.make)
 * ```
 * **Details** This is query evidence, not a persistence guarantee. Unexpected content is discarded and malformed requested values refuse the response.
 * @category models
 * @since 0.0.0
 */
export class PhoenixStoredSpan extends S.Opaque<PhoenixStoredSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    traceId,
    spanId,
    parentId: S.NullOr(spanId),
    name: text,
    kind: text,
    startTime: S.String.check(S.isMaxLength(64)),
    endTime: S.String.check(S.isMaxLength(64)),
    status: S.Literals(["OK", "ERROR", "UNSET"]),
    attributes: S.Record(S.String, scalar),
  }).pipe(
    $I.annoteSchema("PhoenixStoredSpan", { description: "Requested scalar metadata and structural span identity." })
  )
) {}
/**
 * Content-free lookup failure; none of these means an event was not delivered.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { PhoenixSpanReadError } from "@beep/phoenix"
 * console.log(PhoenixSpanReadError.make({ reason: "oversize" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class PhoenixSpanReadError extends S.TaggedError<PhoenixSpanReadError, { readonly brand: unique symbol }>(
  $I`PhoenixSpanReadError`
)(
  "PhoenixSpanReadError",
  {
    reason: S.Literals([
      "configuration",
      "busy",
      "transport",
      "timed-out",
      "http",
      "not-found",
      "oversize",
      "invalid-response",
      "ambiguous",
    ]),
  },
  $I.annote("PhoenixSpanReadError", { description: "Safe bounded-query failure." })
) {}
const fail = (reason: PhoenixSpanReadError["reason"]) => PhoenixSpanReadError.make({ reason });
const row = S.Struct({
  context: S.Struct({ trace_id: traceId, span_id: spanId }),
  parent_id: S.NullOr(spanId),
  name: text,
  span_kind: text,
  start_time: text,
  end_time: text,
  status_code: PhoenixStoredSpan.fields.status,
  attributes: S.Record(S.String, S.Unknown),
});
const page = S.Struct({ data: S.Array(row).check(S.isMaxLength(2)), next_cursor: S.NullOr(text) });
const decodePageJson = S.decodeEffect(S.fromJsonString(page));

/**
 * Make a one-query-at-a-time Phoenix reader with a 256 KiB streaming ceiling.
 * **Example** (Inspecting the reader)
 * ```ts
 * import { makePhoenixSpanReader } from "@beep/phoenix"
 * console.log(typeof makePhoenixSpanReader)
 * ```
 * **Details** Uses explicit driver configuration, including its optional API key, without environment discovery. Require a raw HTTP client without retries/redirects. Only HTTPS or loopback HTTP origins are allowed. Each query has a 5 second cooperative deadline, no waiting queue and an exact identity check. A missing result returns None; malformed, paginated, duplicate, unauthorized or unavailable replies fail safely. No raw response content is returned in errors or logged.
 * @category services
 * @since 0.0.0
 */
export const makePhoenixSpanReader = Effect.fn("Phoenix.makeSpanReader")(function* (config: PhoenixConfigInput) {
  const url = yield* Effect.try({ try: () => new URL(config.baseUrl), catch: () => fail("configuration") });
  if (
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && A.contains(["127.0.0.1", "localhost", "[::1]"], url.hostname))
    ) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== "/"
  )
    return yield* fail("configuration");
  const client = yield* HttpClient.HttpClient;
  const permit = yield* Semaphore.make(1);
  const lookup = Effect.fn("Phoenix.spanReader.lookup")(function* (input: PhoenixSpanLookup) {
    const result = yield* Effect.scoped(
      Effect.gen(function* () {
        const request = HttpClientRequest.get(
          `${url.origin}/v1/projects/${encodeURIComponent(input.project)}/spans`
        ).pipe(
          HttpClientRequest.setUrlParams({ limit: "2", trace_id: input.traceId, span_id: input.spanId }),
          HttpClientRequest.setHeaders({
            ...config.headers,
            ...(O.isSome(config.apiKey) ? { authorization: `Bearer ${Redacted.value(config.apiKey.value)}` } : {}),
            "accept-encoding": "identity",
            accept: "application/json",
          })
        );
        const response = yield* client.execute(request).pipe(Effect.mapError(() => fail("transport")));
        if (response.status === 404) return yield* fail("not-found");
        if (response.status !== 200) return yield* fail("http");
        if (
          Str.trim(Str.split(";")(Str.toLowerCase(response.headers["content-type"] ?? ""))[0] ?? "") !==
            "application/json" ||
          Str.toLowerCase(response.headers["content-encoding"] ?? "identity") !== "identity"
        )
          return yield* fail("invalid-response");
        const bytes = new Uint8Array(262144);
        let used = 0;
        yield* response.stream.pipe(
          Stream.mapError(() => fail("transport")),
          Stream.runForEach((chunk) =>
            Effect.gen(function* () {
              if (chunk.byteLength > bytes.byteLength - used) return yield* fail("oversize");
              bytes.set(chunk, used);
              used += chunk.byteLength;
            })
          )
        );
        const decoded = yield* Effect.try({
          try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used)),
          catch: () => fail("invalid-response"),
        }).pipe(
          Effect.flatMap(decodePageJson),
          Effect.mapError(() => fail("invalid-response"))
        );
        if (decoded.next_cursor !== null || decoded.data.length > 1) return yield* fail("ambiguous");
        const found = decoded.data[0];
        if (found === undefined) return O.none<PhoenixStoredSpan>();
        if (found.context.trace_id !== input.traceId || found.context.span_id !== input.spanId)
          return yield* fail("invalid-response");
        const attributes = yield* S.decodeUnknownEffect(PhoenixStoredSpan.fields.attributes)(
          R.filter(found.attributes, (_value, key) => A.contains(input.attributeKeys, key))
        ).pipe(Effect.mapError(() => fail("invalid-response")));
        return O.some(
          yield* S.decodeEffect(PhoenixStoredSpan)({
            traceId: found.context.trace_id,
            spanId: found.context.span_id,
            parentId: found.parent_id,
            name: found.name,
            kind: found.span_kind,
            startTime: found.start_time,
            endTime: found.end_time,
            status: found.status_code,
            attributes,
          }).pipe(Effect.mapError(() => fail("invalid-response")))
        );
      })
    ).pipe(
      Effect.timeoutOrElse({ duration: 5000, orElse: () => Effect.fail(fail("timed-out")) }),
      permit.withPermitsIfAvailable(1)
    );
    return O.isSome(result) ? result.value : yield* fail("busy");
  });
  return { lookup };
});
