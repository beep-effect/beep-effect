/**
 * Scoped loopback reverse proxy that injects explicit faults into artifact reads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpMethod from "effect/http/HttpMethod";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  CacheConformanceBearers,
  CacheConformanceExchange,
  CacheConformanceMethod,
  CacheConformanceProxyEvent,
  CacheConformanceTarget,
} from "./Cache.conformance.schemas.ts";
import {
  classifyCacheConformanceBackendResult,
  classifyCacheConformanceMediaType,
  classifyCacheConformanceStatus,
  readCacheConformanceReply,
} from "./Cache.conformance.wire.ts";
import { CacheSyntheticRun } from "./Cache.experiment.schemas.ts";
import {
  corruptCacheArtifactBody,
  serveCacheLoopback,
  serveCachePrivateSocket,
  tamperCacheArtifactTag,
} from "./Cache.protocol.fixture.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type {
  CacheConformanceCredentialRole,
  CacheConformanceFault,
  CacheConformanceOperationId,
  CacheConformanceOutcome,
  CacheConformanceRoute,
  CacheConformanceSelectorShape,
} from "./Cache.conformance.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.proxy");

/**
 * Proxy configuration: the target to forward to, the run bearers used only to
 * label roles, and how long a `timeout` fault holds a response.
 *
 * **Example** (Inspect proxy options)
 * ```ts
 * import { CacheConformanceProxyOptions } from "@beep/repo-cli/commands/Cache"
 * console.assert("holdMs" in CacheConformanceProxyOptions.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceProxyOptions extends S.Opaque<
  CacheConformanceProxyOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    target: CacheConformanceTarget,
    bearers: CacheConformanceBearers,
    holdMs: S.Int.check(S.isBetween({ minimum: 1, maximum: 300_000 })),
    maxEvents: S.Int.check(S.isBetween({ minimum: 1, maximum: 5000 })).pipe(
      S.withDecodingDefaultKey(Effect.succeed(5000)),
      S.withConstructorDefault(Effect.succeed(5000))
    ),
    maxBodyBytes: S.Int.check(S.isBetween({ minimum: 1, maximum: 64 * 1024 * 1024 })).pipe(
      S.withDecodingDefaultKey(Effect.succeed(64 * 1024 * 1024)),
      S.withConstructorDefault(Effect.succeed(64 * 1024 * 1024))
    ),
    maxCaptureBytes: S.Int.check(S.isBetween({ minimum: 1, maximum: 64 * 1024 * 1024 })).pipe(
      S.withDecodingDefaultKey(Effect.succeed(64 * 1024 * 1024)),
      S.withConstructorDefault(Effect.succeed(64 * 1024 * 1024))
    ),
  }).pipe(
    $I.annoteSchema("CacheConformanceProxyOptions", {
      description:
        "Upstream target, role-labelling bearers, timeout hold and bounded capture budgets callers may lower.",
    })
  )
) {}

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const isNativeTaskHash = S.is(CacheSyntheticRun.fields.taskHash);
const captureLimit = 64;
const encodeEvent = S.encodeEffect(S.fromJsonString(CacheConformanceProxyEvent));
const ScenarioId = S.NonEmptyString.check(S.isMaxLength(96), S.isPattern(/^[A-Za-z0-9._-]+$/)).pipe(
  $I.annoteSchema("ScenarioId", { description: "Bounded controller-owned scenario label; never request text." })
);
const decodeScenarioId = S.decodeUnknownEffect(ScenarioId);
const hopHeaders = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "accept-encoding",
  "content-encoding",
  "keep-alive",
];
const withoutHop = Headers.removeMany(hopHeaders);
const ArtifactHash = S.String.check(S.isPattern(/^[0-9a-fA-F]{1,128}$/));
const isArtifactHash = S.is(ArtifactHash);
const empty = new Uint8Array();
// Bun prints the error that ends a response body stream; the message says the
// abort is the injected fault, not a proxy failure.
// A plain string keeps Bun's print to one line (an Error adds a stack).
const injectedAbort = (fault: "reset" | "truncated-body") =>
  `conformance fault proxy: injected ${fault} (intentional connection abort, not a failure)`;

type Delivered = {
  readonly status: O.Option<number>;
  readonly headers: Headers.Headers;
  readonly body: Uint8Array;
  readonly outcome: O.Option<CacheConformanceOutcome>;
  readonly response: HttpServerResponse.HttpServerResponse;
};

type UpstreamReply = {
  readonly status: O.Option<number>;
  readonly headers: Headers.Headers;
  readonly body: Uint8Array;
};

type Captured = { readonly body: Uint8Array; readonly tag: string };

const deliver = (
  status: number,
  headers: Headers.Headers,
  body: Uint8Array,
  head: boolean
): HttpServerResponse.HttpServerResponse => {
  const kept = Headers.remove(withoutHop(headers), "content-type");
  return head
    ? HttpServerResponse.empty({
        status,
        headers: O.match(Headers.get(headers, "content-length"), {
          onNone: () => kept,
          onSome: (length) => Headers.set(kept, "content-length", length),
        }),
      })
    : HttpServerResponse.uint8Array(body, {
        status,
        headers: kept,
        contentType: O.getOrElse(Headers.get(headers, "content-type"), () => "application/octet-stream"),
      });
};

const statusOnly = (status: number): Delivered => ({
  status: O.some(status),
  headers: Headers.empty,
  body: empty,
  outcome: O.none(),
  response: HttpServerResponse.empty({ status }),
});

const isSuccessStatus = (status: number) => status >= 200 && status < 300;
const isMethod = S.is(CacheConformanceMethod);
const routeOfPath = HashMap.make<ReadonlyArray<readonly [string, CacheConformanceRoute]>>(
  ["/v8/artifacts/status", "/v8/artifacts/status"],
  ["/v8/artifacts/events", "/v8/artifacts/events"]
);
const operationOf = HashMap.make<ReadonlyArray<readonly [string, CacheConformanceOperationId]>>(
  ["PUT /v8/artifacts/{hash}", "uploadArtifact"],
  ["HEAD /v8/artifacts/{hash}", "artifactExists"],
  ["GET /v8/artifacts/{hash}", "downloadArtifact"],
  ["GET /v8/artifacts/status", "getArtifactStatus"],
  ["POST /v8/artifacts/events", "recordCacheEvents"],
  ["POST /v8/artifacts", "queryArtifacts"]
);
// Faults answered by the proxy itself: no upstream status exists for them.
const syntheticFaults = HashSet.make<ReadonlyArray<CacheConformanceFault>>(
  "status-429",
  "status-503",
  "timeout",
  "reset",
  "wrong-team"
);
const bodyMethods = HashSet.make<ReadonlyArray<CacheConformanceMethod>>("PUT", "POST");
const readMethods = HashSet.make<ReadonlyArray<CacheConformanceMethod>>("GET", "HEAD");

type ProxyRequest = {
  readonly team: O.Option<string>;
  readonly hash: O.Option<string>;
  readonly route: CacheConformanceRoute;
  readonly method: CacheConformanceMethod;
  readonly read: boolean;
  readonly key: string;
};

const parseProxyRequest = (url: string, rawMethod: string): ProxyRequest => {
  const [pathname = "", query = ""] = Str.split(url, "?");
  const team = O.fromNullishOr(new URLSearchParams(query).get("teamId"));
  const hash = O.filter(
    Str.startsWith("/v8/artifacts/")(pathname)
      ? O.some(Str.slice("/v8/artifacts/".length)(pathname))
      : O.none<string>(),
    (value) => value !== "events" && value !== "status"
  );
  const method: CacheConformanceMethod = isMethod(rawMethod) ? rawMethod : "GET";
  const route: CacheConformanceRoute = O.isSome(hash)
    ? "/v8/artifacts/{hash}"
    : O.getOrElse(HashMap.get(routeOfPath, pathname), () => "/v8/artifacts" as const);
  return {
    team,
    hash,
    route,
    method,
    read: O.isSome(hash) && HashSet.has(readMethods, method),
    key: `${O.getOrElse(team, () => "")}\0${O.getOrElse(hash, () => "")}`,
  };
};

const readProxyBody = (request: HttpServerRequest.HttpServerRequest, method: CacheConformanceMethod) =>
  HashSet.has(bodyMethods, method)
    ? request.arrayBuffer.pipe(Effect.map((buffer) => new Uint8Array(buffer)))
    : Effect.succeed(empty);

const makeProxyCapture = Effect.fnUntraced(function* (options: CacheConformanceProxyOptions) {
  const events = yield* Ref.make(A.empty<CacheConformanceProxyEvent>());
  const requests = yield* Ref.make(0);
  const captureBytes = yield* Ref.make(0);
  const invalid = yield* Ref.make(false);
  const reserved = yield* Ref.make(HashSet.empty<string>());
  return {
    admit: Effect.gen(function* () {
      if (yield* Ref.get(invalid)) return false;
      return yield* Ref.modify(requests, (count) => (count < options.maxEvents ? [true, count + 1] : [false, count]));
    }),
    reserveUpload: Effect.fnUntraced(function* (parsed: ProxyRequest, body: Uint8Array, tag: O.Option<string>) {
      if (parsed.method !== "PUT" || O.isNone(tag)) return true;
      const slot = yield* Ref.modify(reserved, (keys) =>
        HashSet.has(keys, parsed.key) || HashSet.size(keys) < captureLimit
          ? [true, HashSet.add(keys, parsed.key)]
          : [false, keys]
      );
      const bytes = body.byteLength + new TextEncoder().encode(tag.value).byteLength;
      return yield* Ref.modify(captureBytes, (used) =>
        bytes <= options.maxCaptureBytes - used ? [slot, used + bytes] : [false, used]
      );
    }),
    record: Effect.fnUntraced(function* (event: CacheConformanceProxyEvent) {
      const encoded = yield* encodeEvent(event).pipe(Effect.result);
      if (Result.isFailure(encoded) || new TextEncoder().encode(encoded.success).byteLength > 4096) {
        yield* Ref.set(invalid, true);
        return false;
      }
      yield* Ref.update(events, A.append(event));
      return !(yield* Ref.get(invalid));
    }),
    invalidate: Ref.set(invalid, true),
    events: Effect.gen(function* () {
      const state = yield* Effect.all({
        captured: Ref.get(events),
        requests: Ref.get(requests),
        invalid: Ref.get(invalid),
      }).pipe(
        Effect.repeat({
          until: (state) => state.invalid || state.captured.length === state.requests,
          schedule: Schedule.spaced(Duration.millis(10)),
        }),
        Effect.timeoutOrElse({
          duration: Duration.sum(Duration.millis(options.holdMs), Duration.seconds(5)),
          orElse: () => Effect.fail(CacheCommandError.new("Conformance proxy capture has unfinished requests.")),
        })
      );
      if (state.invalid)
        return yield* CacheCommandError.new("Conformance proxy capture is incomplete or exceeded its bounds.");
      return state.captured;
    }),
  };
});

const digestOf = (bytes: Uint8Array, present: boolean) =>
  present ? hashBytes(bytes).pipe(Effect.asSome) : Effect.succeed(O.none<Sha256Hex>());
const digestTag = (tag: O.Option<string>) =>
  O.match(tag, {
    onNone: () => Effect.succeed(O.none<Sha256Hex>()),
    onSome: (value) => hashBytes(new TextEncoder().encode(value)).pipe(Effect.asSome),
  });

const proxyExchange = Effect.fnUntraced(function* (input: {
  readonly request: HttpServerRequest.HttpServerRequest;
  readonly parsed: ProxyRequest;
  readonly scenario: string;
  readonly fault: CacheConformanceFault;
  readonly body: Uint8Array;
  readonly delivered: Delivered;
  readonly neverWritten: boolean;
  readonly role: CacheConformanceCredentialRole;
  readonly selector: CacheConformanceSelectorShape;
  readonly elapsedMs: number;
}) {
  const { parsed, delivered, body } = input;
  const tag = Headers.get(delivered.headers, "x-artifact-tag");
  return CacheConformanceExchange.make({
    step: Str.slice(0, 96)(`proxy-${Str.toLowerCase(parsed.method)}-${input.scenario}`),
    role: input.role,
    method: parsed.method,
    route: parsed.route,
    operationId: HashMap.get(operationOf, `${parsed.method} ${parsed.route}`),
    strictScored: input.fault === "none",
    selector: input.selector,
    hash: O.match(parsed.hash, {
      onNone: () => "none",
      onSome: (value) => (isArtifactHash(value) ? "valid" : "non-hex"),
    }),
    taskHash: O.filter(parsed.hash, isNativeTaskHash),
    outcome: O.getOrElse(delivered.outcome, () =>
      O.match(delivered.status, {
        onNone: (): CacheConformanceOutcome => "transport-error",
        onSome: classifyCacheConformanceStatus(input.neverWritten),
      })
    ),
    status: delivered.status,
    backendResult: classifyCacheConformanceBackendResult(
      Headers.get(delivered.headers, "x-beep-cache-result"),
      parsed.method,
      delivered.status
    ),
    contentType: classifyCacheConformanceMediaType(Headers.get(delivered.headers, "content-type")),
    requestBytes: S.Natural.make(body.byteLength),
    requestSha256: yield* digestOf(body, body.byteLength > 0),
    requestTagSha256: yield* digestTag(Headers.get(input.request.headers, "x-artifact-tag")),
    responseBytes: S.Natural.make(delivered.body.byteLength),
    responseSha256: yield* digestOf(delivered.body, O.isSome(delivered.status) && parsed.method !== "HEAD"),
    tagPresent: O.isSome(tag),
    tagSha256: yield* digestTag(tag),
    durationPresent: O.isSome(Headers.get(delivered.headers, "x-artifact-duration")),
    elapsedMs: S.Natural.make(Math.max(0, Math.round(input.elapsedMs))),
  });
});

const makeCacheConformanceProxyHandler = Effect.fn("CacheConformance.makeProxyHandler")(function* (
  options: CacheConformanceProxyOptions
) {
  const client = yield* HttpClient.HttpClient;
  const { target, bearers } = options;
  const upstream = Str.replace(/\/+$/, "")(target.baseUrl.href);
  const scenario = yield* Ref.make<{ readonly id: string; readonly fault: CacheConformanceFault }>({
    id: "initial",
    fault: "none",
  });
  const capture = yield* makeProxyCapture(options);
  const reject = (status: number) => capture.invalidate.pipe(Effect.as(HttpServerResponse.empty({ status })));
  const written = yield* Ref.make(HashSet.empty<string>());
  const captures = yield* Ref.make(HashMap.empty<string, Captured>());
  // Later entries win, so a single-token topology labels its bearer `writer`.
  const roles = HashMap.make<ReadonlyArray<readonly [string, CacheConformanceCredentialRole]>>(
    [`Bearer ${Redacted.value(bearers.unknown)}`, "unknown"],
    [`Bearer ${Redacted.value(bearers.foreign)}`, "foreign"],
    [`Bearer ${Redacted.value(bearers.reader)}`, "reader"],
    [`Bearer ${Redacted.value(bearers.writer)}`, "writer"]
  );
  const roleOf = (authorization: O.Option<string>): CacheConformanceCredentialRole =>
    O.match(authorization, {
      onNone: () => "missing",
      onSome: (value) => O.getOrElse(HashMap.get(roles, value), () => "unknown"),
    });
  const selectorOf = (team: O.Option<string>): CacheConformanceSelectorShape =>
    O.match(team, {
      onNone: () => "empty",
      onSome: (value) =>
        value === target.namespace.teamId
          ? "team-id"
          : value === target.namespace.foreignTeamId
            ? "foreign-team-id"
            : "run-epoch",
    });

  const forward = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest, body: Uint8Array) {
    // Server requests carry any method string; only standard methods can be replayed upstream.
    if (!HttpMethod.isHttpMethod(request.method)) {
      return { status: O.none<number>(), headers: Headers.empty, body: empty };
    }
    const base = HttpClientRequest.make(request.method)(`${upstream}${request.url}`).pipe(
      HttpClientRequest.setHeaders(withoutHop(request.headers))
    );
    const outgoing =
      request.method === "PUT" || request.method === "POST"
        ? HttpClientRequest.bodyUint8Array(
            base,
            body,
            O.getOrElse(Headers.get(request.headers, "content-type"), () => "application/octet-stream")
          )
        : base;
    return yield* client.execute(outgoing).pipe(
      Effect.flatMap((response) => readCacheConformanceReply(response, options.maxBodyBytes)),
      Effect.catchTag("CacheCommandError", (error) => capture.invalidate.pipe(Effect.andThen(Effect.fail(error)))),
      Effect.timeoutOption(Duration.millis(target.requestTimeoutMs)),
      Effect.map(O.getOrElse(() => ({ status: O.none<number>(), headers: Headers.empty, body: empty }))),
      Effect.orElseSucceed(() => ({ status: O.none<number>(), headers: Headers.empty, body: empty }))
    );
  });

  // Faults rewrite only a successful upstream read; any other reply passes through.
  const rewriteStatus = (
    fault: CacheConformanceFault,
    head: boolean,
    reply: UpstreamReply,
    status: number
  ): Delivered => {
    const plain: Delivered = {
      status: reply.status,
      headers: reply.headers,
      body: reply.body,
      outcome: O.none(),
      response: deliver(status, reply.headers, reply.body, head),
    };
    if (status !== 200) return plain;
    return Match.value(fault).pipe(
      Match.when("missing-tag", (): Delivered => {
        const headers = Headers.remove(reply.headers, "x-artifact-tag");
        return { ...plain, headers, response: deliver(status, headers, reply.body, head) };
      }),
      Match.when("tampered-tag", (): Delivered => {
        const headers = O.match(Headers.get(reply.headers, "x-artifact-tag"), {
          onNone: () => reply.headers,
          onSome: (tag) => Headers.set(reply.headers, "x-artifact-tag", tamperCacheArtifactTag(tag)),
        });
        return { ...plain, headers, response: deliver(status, headers, reply.body, head) };
      }),
      Match.when("tampered-body", (): Delivered => {
        const body = corruptCacheArtifactBody(reply.body);
        return { ...plain, body, response: deliver(status, reply.headers, body, head) };
      }),
      Match.when("truncated-body", (): Delivered => {
        const partial = reply.body.subarray(0, Math.floor(reply.body.byteLength / 2));
        const kept = withoutHop(reply.headers);
        // A chunk followed by a delayed failure ships headers and part of
        // the body, then aborts: a client-visible truncated transfer.
        return {
          ...plain,
          body: partial,
          outcome: O.some("truncated-body"),
          response: HttpServerResponse.stream(
            Stream.concat(
              Stream.make(partial),
              Stream.fromEffect(Duration.millis(50).pipe(Effect.sleep)).pipe(
                Stream.drain,
                Stream.concat(Stream.fail(injectedAbort("truncated-body")))
              )
            ),
            { status, headers: kept }
          ),
        };
      }),
      Match.orElse(() => plain)
    );
  };
  const rewrite = (fault: CacheConformanceFault, head: boolean, reply: UpstreamReply): Delivered =>
    O.match(reply.status, {
      onNone: () => ({ ...statusOnly(502), outcome: O.none() }),
      onSome: (status) => rewriteStatus(fault, head, reply, status),
    });

  const respond = Effect.fnUntraced(function* (
    request: HttpServerRequest.HttpServerRequest,
    fault: CacheConformanceFault,
    team: O.Option<string>,
    hash: O.Option<string>,
    body: Uint8Array
  ) {
    const head = request.method === "HEAD";
    return yield* Match.value(fault).pipe(
      Match.when("status-429", () => Effect.succeed(statusOnly(429))),
      Match.when("status-503", () => Effect.succeed(statusOnly(503))),
      Match.when("timeout", () =>
        Effect.sleep(Duration.millis(options.holdMs)).pipe(
          Effect.as<Delivered>({ ...statusOnly(504), outcome: O.some("timeout") })
        )
      ),
      Match.when("reset", () =>
        Effect.succeed<Delivered>({
          status: O.none(),
          headers: Headers.empty,
          body: empty,
          outcome: O.some("transport-error"),
          response: HttpServerResponse.stream(Stream.fail(injectedAbort("reset"))),
        })
      ),
      Match.when("wrong-team", () =>
        Ref.get(captures).pipe(
          Effect.map((all) =>
            A.findFirst(
              A.fromIterable(all),
              ([key]) =>
                O.exists(hash, (value) => Str.endsWith(`\0${value}`)(key)) &&
                !O.exists(team, (value) => Str.startsWith(`${value}\0`)(key))
            ).pipe(
              O.match({
                onNone: () => statusOnly(404),
                onSome: ([, captured]): Delivered => {
                  const headers = Headers.fromInput({
                    "content-type": "application/octet-stream",
                    "x-artifact-tag": captured.tag,
                  });
                  return {
                    status: O.some(200),
                    headers,
                    body: captured.body,
                    outcome: O.none(),
                    response: deliver(200, headers, captured.body, head),
                  };
                },
              })
            )
          )
        )
      ),
      Match.orElse(() => forward(request, body).pipe(Effect.map((reply) => rewrite(fault, head, reply))))
    );
  });

  const recordUpload = Effect.fnUntraced(function* (
    request: HttpServerRequest.HttpServerRequest,
    parsed: ProxyRequest,
    body: Uint8Array,
    delivered: Delivered
  ) {
    if (parsed.method !== "PUT" || !O.exists(delivered.status, isSuccessStatus)) return;
    yield* Ref.update(written, HashSet.add(parsed.key));
    yield* O.match(Headers.get(request.headers, "x-artifact-tag"), {
      onNone: () => Effect.void,
      onSome: (tag) => Ref.update(captures, HashMap.set(parsed.key, { body, tag })),
    });
  });

  const app = Effect.gen(function* () {
    if (!(yield* capture.admit)) return yield* reject(503);
    const request = yield* HttpServerRequest.HttpServerRequest;
    const started = yield* Clock.currentTimeMillis;
    const current = yield* Ref.get(scenario);
    const parsed = parseProxyRequest(request.url, request.method);
    const fault: CacheConformanceFault = parsed.read ? current.fault : "none";
    const received = yield* readProxyBody(request, parsed.method).pipe(Effect.result);
    if (Result.isFailure(received)) return yield* reject(413);
    const body = received.success;
    if (body.byteLength > options.maxBodyBytes) return yield* reject(413);
    if (!(yield* capture.reserveUpload(parsed, body, Headers.get(request.headers, "x-artifact-tag"))))
      return yield* reject(503);
    const delivered = yield* respond(request, fault, parsed.team, parsed.hash, body);
    yield* recordUpload(request, parsed, body, delivered);
    const neverWritten = !HashSet.has(yield* Ref.get(written), parsed.key);
    const finished = yield* Clock.currentTimeMillis;
    const exchange = yield* proxyExchange({
      request,
      parsed,
      scenario: current.id,
      fault,
      body,
      delivered,
      neverWritten,
      role: roleOf(Headers.get(request.headers, "authorization")),
      selector: selectorOf(parsed.team),
      elapsedMs: finished - started,
    });
    const event = CacheConformanceProxyEvent.make({
      scenario: current.id,
      fault,
      upstreamStatus: HashSet.has(syntheticFaults, fault) ? O.none() : delivered.status,
      exchange,
    });
    return (yield* capture.record(event)) ? delivered.response : HttpServerResponse.empty({ status: 503 });
  });
  return {
    app,
    events: capture.events,
    setScenario: (id: string, fault: CacheConformanceFault) =>
      decodeScenarioId(id).pipe(
        Effect.mapError(() => CacheCommandError.make({ message: "Conformance proxy scenario label is invalid." })),
        Effect.flatMap((id) => Ref.set(scenario, { id, fault }))
      ),
  };
});

/**
 * Start a scoped loopback reverse proxy in front of a conformance target.
 *
 * **Details**
 * Requests are forwarded unchanged except for an explicit fault selected with
 * `setScenario`, which applies only to artifact `GET`/`HEAD` reads:
 * `missing-tag`, `tampered-tag` and `tampered-body` rewrite a successful
 * upstream response (tag and byte tampering reuse the protocol fixture's code);
 * `truncated-body` sends part of the body and then aborts the connection;
 * `wrong-team` replays a body and tag the proxy captured on an upload for the
 * same hash under a different team; `status-429` and `status-503` answer
 * without forwarding; `timeout` holds the response for `holdMs`; `reset`
 * aborts before any byte is sent. Events use the exchange receipt vocabulary
 * and describe what the client was delivered: never a URL, bearer, tag value
 * or body. A 404 is classed as a miss only when no upload of that hash in that
 * namespace passed through this proxy.
 *
 * **Example** (Scope a proxy)
 * ```ts
 * import { makeCacheConformanceFaultProxy } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof makeCacheConformanceFaultProxy === "function")
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const makeCacheConformanceFaultProxy = Effect.fn("CacheConformance.makeFaultProxy")(function* (
  options: CacheConformanceProxyOptions
) {
  const handler = yield* makeCacheConformanceProxyHandler(options);
  return {
    url: yield* serveCacheLoopback(handler.app, 64 * 1024 * 1024),
    events: handler.events,
    setScenario: handler.setScenario,
  };
}, CacheCommandError.mapError("Cannot run the conformance fault proxy."));

/**
 * Observe a fixed upstream through a scoped private Unix socket.
 *
 * **Details**
 * Uses the same bounded capture, failure attribution and header/body limits as
 * the loopback proxy. Only the address and listener differ. The supplied HTTP
 * client still owns upstream transport. An owner-only socket lets a supervisor
 * keep a worker's private network and mount only the chosen endpoint, without
 * sharing host networking. This observer authenticates no producer and grants
 * no role: the approved upstream still owns authorization and tenant policy.
 *
 * **Example** (Reference the private capture endpoint)
 * ```ts
 * import { makeCacheConformanceSocketProxy } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof makeCacheConformanceSocketProxy === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const makeCacheConformanceSocketProxy = Effect.fn("CacheConformance.makeSocketProxy")(function* (
  options: CacheConformanceProxyOptions
) {
  const handler = yield* makeCacheConformanceProxyHandler(options);
  return {
    address: yield* serveCachePrivateSocket(handler.app, 64 * 1024 * 1024),
    events: handler.events,
    setScenario: handler.setScenario,
  };
}, CacheCommandError.mapError("Cannot run the private conformance socket proxy."));
