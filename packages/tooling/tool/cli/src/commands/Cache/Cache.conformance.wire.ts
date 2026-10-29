/**
 * Direct-wire Remote Cache case executors with sanitized receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { MimeType, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { nearestRank } from "../../internal/stats/NearestRank.ts";
import {
  CacheConformanceExchange,
  CacheConformanceMeasurement,
  CacheConformanceTarget,
} from "./Cache.conformance.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import type {
  CacheConformanceBearers,
  CacheConformanceCaseId,
  CacheConformanceCredentialRole,
  CacheConformanceFault,
  CacheConformanceHashShape,
  CacheConformanceLoadEnvelope,
  CacheConformanceMethod,
  CacheConformanceOperation,
  CacheConformanceOutcome,
  CacheConformanceProxyEvent,
  CacheConformanceRoute,
  CacheConformanceSelectorShape,
} from "./Cache.conformance.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.wire");

/**
 * One named expectation recorded by a wire case.
 *
 * **Example** (Record a satisfied expectation)
 * ```ts
 * import { CacheConformanceWireCheck } from "@beep/repo-cli/commands/Cache"
 * const check = CacheConformanceWireCheck.make({ id: "genuine-miss-404", ok: true, detail: "404" })
 * console.assert(check.ok)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceWireCheck extends S.Opaque<CacheConformanceWireCheck, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.NonEmptyString, ok: S.Boolean, detail: S.String }).pipe(
    $I.annoteSchema("CacheConformanceWireCheck", {
      description: "Named expectation with a sanitized detail; never a bearer, tag value or body.",
    })
  )
) {}

/**
 * Exchanges and expectations observed by one executed wire case.
 *
 * **Example** (Inspect the outcome fields)
 * ```ts
 * import { CacheConformanceWireOutcome } from "@beep/repo-cli/commands/Cache"
 * console.assert("unsupported" in CacheConformanceWireOutcome.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceWireOutcome extends S.Opaque<
  CacheConformanceWireOutcome,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    exchanges: S.Array(CacheConformanceExchange),
    strict: S.Array(CacheConformanceWireCheck),
    policy: S.Array(CacheConformanceWireCheck),
    observability: S.Array(CacheConformanceWireCheck).pipe(S.withConstructorDefault(Effect.succeed([]))),
    performance: S.Array(CacheConformanceWireCheck).pipe(S.withConstructorDefault(Effect.succeed([]))),
    measurements: S.Array(CacheConformanceMeasurement).pipe(S.withConstructorDefault(Effect.succeed([]))),
    notes: S.Array(S.String),
    unsupported: S.OptionFromNullOr(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CacheConformanceWireOutcome", {
      description: "Sanitized exchanges plus strict and Beep-policy expectations for one wire case.",
    })
  )
) {}

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const digestText = (text: string) => hashBytes(new TextEncoder().encode(text));
const StatusBody = S.fromJsonString(S.Struct({ status: S.Literals(["disabled", "enabled", "over_limit", "paused"]) }));
const UploadBody = S.fromJsonString(S.Struct({ urls: S.Array(S.String) }));
const QueryBody = S.fromJsonString(
  S.Record(
    S.String,
    S.NullOr(
      S.Union([
        S.Struct({ size: S.Int, taskDurationMs: S.Int, tag: S.optionalKey(S.String) }),
        S.Struct({ error: S.Struct({ message: S.String }) }),
      ])
    )
  )
);
const decodeStatusBody = S.decodeUnknownOption(StatusBody);
const decodeUploadBody = S.decodeUnknownOption(UploadBody);
const decodeQueryBody = S.decodeUnknownOption(QueryBody);
const OptionalAbsence = S.Literals([404, 405, 501]);
const isOptionalAbsence = S.is(OptionalAbsence);

type ArtifactSegment = {
  readonly segment: string;
  readonly shape: CacheConformanceHashShape;
};

type WireStep = {
  readonly label: string;
  readonly role: CacheConformanceCredentialRole;
  readonly method: CacheConformanceMethod;
  readonly route: CacheConformanceRoute;
  readonly hash?: ArtifactSegment;
  readonly selector?: CacheConformanceSelectorShape;
  readonly params?: ReadonlyArray<readonly [string, string]>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
  readonly contentType?: string;
  readonly abortAfter?: number;
  readonly neverWritten?: boolean;
  readonly strictScored?: boolean;
  /** Send a PUT without the opaque `x-artifact-tag` every signing writer sends. */
  readonly untagged?: boolean;
};

type WireReply = {
  readonly receipt: CacheConformanceExchange;
  readonly sentTag: O.Option<string>;
  readonly status: O.Option<number>;
  readonly headers: Headers.Headers;
  readonly body: Uint8Array;
};

type WireContext = {
  readonly base: string;
  readonly target: CacheConformanceTarget;
  readonly bearers: CacheConformanceBearers;
  readonly operations: ReadonlyArray<CacheConformanceOperation>;
};

type Recorder = {
  readonly exchanges: Array<CacheConformanceExchange>;
  readonly strict: Array<CacheConformanceWireCheck>;
  readonly policy: Array<CacheConformanceWireCheck>;
  readonly observability: Array<CacheConformanceWireCheck>;
  readonly performance: Array<CacheConformanceWireCheck>;
  readonly measurements: Array<CacheConformanceMeasurement>;
  readonly notes: Array<string>;
  unsupported: O.Option<string>;
};

const inRange = (minimum: number, maximum: number) => (status: number) => status >= minimum && status <= maximum;
const isSuccessStatus = inRange(200, 299);

/**
 * Classify a delivered HTTP status; 404 is a miss only for a never-written hash.
 *
 * **Example** (Separate a miss from a 404 on a written hash)
 * ```ts
 * import { classifyCacheConformanceStatus } from "@beep/repo-cli/commands/Cache"
 * console.assert(classifyCacheConformanceStatus(true)(404) === "miss")
 * console.assert(classifyCacheConformanceStatus(false)(404) === "not-found")
 * ```
 *
 * @param neverWritten - Whether the requested hash was never written in this namespace.
 * @returns A classifier from HTTP status to conformance outcome.
 * @category validation
 * @since 0.0.0
 */
export const classifyCacheConformanceStatus = (neverWritten: boolean) =>
  Match.type<number>().pipe(
    Match.when(isSuccessStatus, (): CacheConformanceOutcome => "success"),
    Match.when(404, (): CacheConformanceOutcome => (neverWritten ? "miss" : "not-found")),
    Match.when(401, (): CacheConformanceOutcome => "unauthorized"),
    Match.when(403, (): CacheConformanceOutcome => "forbidden"),
    Match.when(429, (): CacheConformanceOutcome => "throttled"),
    Match.when(inRange(400, 499), (): CacheConformanceOutcome => "client-error"),
    Match.when(inRange(500, 599), (): CacheConformanceOutcome => "server-error"),
    Match.orElse((): CacheConformanceOutcome => "unexpected-status")
  );

const ReceiptMediaType = MimeType.check(S.isMaxLength(128)).pipe(
  $I.annoteSchema("ReceiptMediaType", { description: "Registered media type within the exchange receipt bound." })
);
const isReceiptMediaType = S.is(ReceiptMediaType);

/**
 * Retain a registered media type while dropping untrusted response parameters.
 *
 * **Details**
 * Unknown subtypes are omitted. Response parameters and invented media types
 * may contain credentials, private paths or artifact content; truncating their
 * raw text does not make them safe evidence. Historical receipt decoding is
 * unchanged; both current wire capture paths use this projection.
 *
 * **Example** (Discard response parameters)
 * ```ts
 * import { classifyCacheConformanceMediaType } from "@beep/repo-cli/commands/Cache"
 * import * as O from "effect/Option"
 * console.assert(O.contains(classifyCacheConformanceMediaType(O.some("application/json; charset=utf-8")), "application/json"))
 * ```
 *
 * @param header - Optional untrusted response Content-Type field.
 * @returns Only the bounded registered media type, without parameters.
 * @category validation
 * @since 0.0.0
 */
export const classifyCacheConformanceMediaType = (header: O.Option<string>): O.Option<string> =>
  header.pipe(
    O.flatMap(flow(Str.split(";"), A.head)),
    O.map(flow(Str.trim, Str.toLowerCase)),
    O.filter(isReceiptMediaType)
  );

const authorization = (bearers: CacheConformanceBearers, role: CacheConformanceCredentialRole) =>
  Match.value(role).pipe(
    Match.when("missing", O.none<string>),
    Match.when("malformed", () => O.some("Bearer")),
    Match.orElse((named) => O.some(`Bearer ${Redacted.value(bearers[named])}`))
  );

const operationFor = (context: WireContext, step: WireStep) =>
  step.hash?.shape === "empty"
    ? O.none()
    : A.findFirst(
        context.operations,
        (operation) => operation.route === step.route && operation.method === step.method
      ).pipe(O.map((operation) => operation.operationId));

const buildRequest = (context: WireContext, step: WireStep) => {
  const path = step.route === "/v8/artifacts/{hash}" ? `/v8/artifacts/${step.hash?.segment ?? ""}` : step.route;
  const base = HttpClientRequest.make(step.method)(`${context.base}${path}`).pipe(
    HttpClientRequest.appendUrlParams(step.params ?? [["teamId", context.target.namespace.teamId]]),
    HttpClientRequest.setHeaders({
      ...step.headers,
      ...O.getSomesStruct({ authorization: authorization(context.bearers, step.role) }),
    })
  );
  const contentType = step.contentType ?? "application/octet-stream";
  return O.fromUndefinedOr(step.body).pipe(
    O.map((body) =>
      O.fromUndefinedOr(step.abortAfter).pipe(
        O.map((cut) =>
          HttpClientRequest.bodyStream(
            base,
            Stream.concat(Stream.make(body.subarray(0, cut)), Stream.fail("conformance-aborted-write")),
            { contentType, contentLength: body.byteLength }
          )
        ),
        O.getOrElse(() => HttpClientRequest.bodyUint8Array(base, body, contentType))
      )
    ),
    O.getOrElse(() => base)
  );
};

const optionalDigest = (present: boolean, bytes: Uint8Array) =>
  present ? hashBytes(bytes).pipe(Effect.asSome) : Effect.succeed(O.none<Sha256Hex>());

// Signing clients send an opaque tag on every upload; a fresh random base64
// value per PUT stands in for it unless the step is explicitly untagged or
// supplies its own. Only the tag's digest reaches a receipt.
const withWriterTag = Effect.fnUntraced(function* (step: WireStep) {
  const explicit = O.fromUndefinedOr(step.headers?.["x-artifact-tag"]);
  if (step.method !== "PUT" || (step.untagged ?? false) || O.isSome(explicit)) return { step, sentTag: explicit };
  const tag = Base64.encode(yield* randomBytes(32));
  return { step: { ...step, headers: { ...step.headers, "x-artifact-tag": tag } }, sentTag: O.some(tag) };
});

/**
 * Read a client response into its status, headers and complete body bytes.
 *
 * **Example** (Reference the reply reader)
 * ```ts
 * import { readCacheConformanceReply } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof readCacheConformanceReply === "function")
 * ```
 *
 * @internal
 * @param response - Client response to drain.
 * @returns An effect yielding the status, headers and complete body bytes.
 * @category utilities
 * @since 0.0.0
 */
export const readCacheConformanceReply = (response: HttpClientResponse.HttpClientResponse) =>
  response.arrayBuffer.pipe(
    Effect.map((buffer) => ({
      status: O.some(response.status),
      headers: response.headers,
      body: new Uint8Array(buffer),
    }))
  );

const send = Effect.fnUntraced(function* (context: WireContext, unsigned: WireStep) {
  const client = yield* HttpClient.HttpClient;
  const { step, sentTag } = yield* withWriterTag(unsigned);
  const started = yield* Clock.currentTimeMillis;
  const empty = new Uint8Array();
  const observed = yield* client.execute(buildRequest(context, step)).pipe(
    Effect.flatMap((response) =>
      readCacheConformanceReply(response).pipe(
        Effect.map((reply) => ({ ...reply, fault: O.none<CacheConformanceOutcome>() })),
        Effect.orElseSucceed(() => ({
          status: O.some(response.status),
          headers: response.headers,
          body: empty,
          fault: O.some<CacheConformanceOutcome>("truncated-body"),
        }))
      )
    ),
    Effect.orElseSucceed(() => ({
      status: O.none<number>(),
      headers: Headers.empty,
      body: empty,
      fault: O.some<CacheConformanceOutcome>("transport-error"),
    })),
    Effect.timeoutOption(Duration.millis(context.target.requestTimeoutMs)),
    Effect.map(
      O.getOrElse(() => ({
        status: O.none<number>(),
        headers: Headers.empty,
        body: empty,
        fault: O.some<CacheConformanceOutcome>("timeout"),
      }))
    )
  );
  const finished = yield* Clock.currentTimeMillis;
  const tag = Headers.get(observed.headers, "x-artifact-tag");
  const requestBody = O.fromUndefinedOr(step.body);
  const receipt = CacheConformanceExchange.make({
    step: step.label,
    role: step.role,
    method: step.method,
    route: step.route,
    operationId: operationFor(context, step),
    strictScored: step.strictScored ?? true,
    selector: step.selector ?? "team-id",
    hash: step.hash?.shape ?? "none",
    outcome: O.getOrElse(observed.fault, () =>
      O.match(observed.status, {
        onNone: (): CacheConformanceOutcome => "transport-error",
        onSome: classifyCacheConformanceStatus(step.neverWritten ?? false),
      })
    ),
    status: observed.status,
    contentType: classifyCacheConformanceMediaType(Headers.get(observed.headers, "content-type")),
    requestBytes: S.Natural.make(
      O.match(requestBody, {
        onNone: () => 0,
        onSome: (body) => Math.min(body.byteLength, step.abortAfter ?? body.byteLength),
      })
    ),
    requestSha256: yield* O.match(requestBody, {
      onNone: () => Effect.succeed(O.none<Sha256Hex>()),
      onSome: (body) => optionalDigest(true, body),
    }),
    requestTagSha256: yield* O.match(sentTag, {
      onNone: () => Effect.succeed(O.none<Sha256Hex>()),
      onSome: (value) => digestText(value).pipe(Effect.asSome),
    }),
    responseBytes: S.Natural.make(observed.body.byteLength),
    responseSha256: yield* optionalDigest(O.isSome(observed.status) && step.method !== "HEAD", observed.body),
    tagPresent: O.isSome(tag),
    tagSha256: yield* O.match(tag, {
      onNone: () => Effect.succeed(O.none<Sha256Hex>()),
      onSome: (value) => digestText(value).pipe(Effect.asSome),
    }),
    durationPresent: O.isSome(Headers.get(observed.headers, "x-artifact-duration")),
    elapsedMs: S.Natural.make(Math.max(0, Math.round(finished - started))),
  });
  return {
    receipt,
    sentTag,
    status: observed.status,
    headers: observed.headers,
    body: observed.body,
  } satisfies WireReply;
});

const makeRecorder = (): Recorder => ({
  exchanges: [],
  strict: [],
  policy: [],
  observability: [],
  performance: [],
  measurements: [],
  notes: [],
  unsupported: O.none(),
});

const track = (recorder: Recorder, replies: ReadonlyArray<WireReply>) => {
  for (const reply of replies) recorder.exchanges.push(reply.receipt);
};

const sendTracked = (context: WireContext, recorder: Recorder) => (step: WireStep) =>
  send(context, step).pipe(Effect.tap((reply) => Effect.sync(() => track(recorder, [reply]))));

const expectStrict = (recorder: Recorder, id: string, ok: boolean, detail: string) =>
  recorder.strict.push(CacheConformanceWireCheck.make({ id, ok, detail }));
const expectPolicy = (recorder: Recorder, id: string, ok: boolean, detail: string) =>
  recorder.policy.push(CacheConformanceWireCheck.make({ id, ok, detail }));

const statusText = (reply: WireReply) =>
  `${reply.receipt.step} answered ${O.match(reply.status, { onNone: () => reply.receipt.outcome, onSome: (status) => `${status} (${reply.receipt.outcome})` })}`;
const succeeded = (reply: WireReply) => reply.receipt.outcome === "success";
const denied = (reply: WireReply) => reply.receipt.outcome === "unauthorized" || reply.receipt.outcome === "forbidden";
const rejected = (reply: WireReply) => O.exists(reply.status, inRange(400, 499));
const missing = (reply: WireReply) => reply.receipt.outcome === "miss";
const header = (reply: WireReply, name: string) => Headers.get(reply.headers, name);
const text = (reply: WireReply) => new TextDecoder().decode(reply.body);

const randomBytes = (bytes: number) =>
  Crypto.Crypto.use((crypto) => crypto.randomBytes(bytes)).pipe(
    CacheCommandError.mapError("Cannot draw conformance randomness.")
  );
const randomHex = (bytes: number) => randomBytes(bytes).pipe(Effect.map(Hex.encode));
const freshHash = randomHex(16);
const valid = (segment: string): ArtifactSegment => ({ segment, shape: "valid" });
const sameBody = (reply: WireReply, digest: Sha256Hex) =>
  succeeded(reply) && O.contains(reply.receipt.responseSha256, digest);

const claimNote = (claimed: boolean, claim: string) =>
  claimed ? "" : ` The topology does not claim ${claim}; the failure is attributed to that design.`;

type WireCase = (
  context: WireContext,
  recorder: Recorder
) => Effect.Effect<void, CacheCommandError | S.SchemaError, HttpClient.HttpClient | Crypto.Crypto>;

const putStep = (
  label: string,
  role: CacheConformanceCredentialRole,
  hash: ArtifactSegment,
  body: Uint8Array,
  extra: Partial<WireStep> = {}
): WireStep => ({ label, role, method: "PUT", route: "/v8/artifacts/{hash}", hash, body, ...extra });
const readStep = (
  label: string,
  role: CacheConformanceCredentialRole,
  method: "GET" | "HEAD",
  hash: ArtifactSegment,
  extra: Partial<WireStep> = {}
): WireStep => ({ label, role, method, route: "/v8/artifacts/{hash}", hash, ...extra });

const writeArtifact = Effect.fnUntraced(function* (
  context: WireContext,
  recorder: Recorder,
  label: string,
  size: number,
  extra: Partial<WireStep> = {}
) {
  const hash = yield* freshHash;
  const body = yield* randomBytes(size);
  const reply = yield* sendTracked(context, recorder)(putStep(label, "writer", valid(hash), body, extra));
  return { hash, body, digest: yield* hashBytes(body), reply, tag: reply.sentTag };
});

const roundTrip = (size: number): WireCase =>
  Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
    const run = sendTracked(context, recorder);
    const written = yield* writeArtifact(context, recorder, "writer-put", size);
    expectStrict(recorder, "upload-accepted", succeeded(written.reply), statusText(written.reply));
    if (succeeded(written.reply))
      expectStrict(
        recorder,
        "upload-response-schema",
        O.isSome(decodeUploadBody(text(written.reply))),
        "PUT 200/202 documents an ArtifactUploadResponse body with urls"
      );
    const existence = yield* run(readStep("reader-head", "reader", "HEAD", valid(written.hash)));
    expectStrict(recorder, "head-exists", O.contains(existence.status, 200), statusText(existence));
    expectStrict(
      recorder,
      "head-content-length",
      O.contains(header(existence, "content-length"), `${size}`),
      "HEAD Content-Length equals the stored byte count"
    );
    const download = yield* run(readStep("reader-get", "reader", "GET", valid(written.hash)));
    expectStrict(recorder, "round-trip-bytes", sameBody(download, written.digest), statusText(download));
    expectStrict(
      recorder,
      "tag-round-trip",
      O.exists(written.tag, (tag) => O.contains(header(download, "x-artifact-tag"), tag)),
      "GET returns the opaque x-artifact-tag the writer sent"
    );
  });

const status: WireCase = (context, recorder) =>
  Effect.forEach(["writer", "reader"] as const, (role) =>
    sendTracked(
      context,
      recorder
    )({ label: `${role}-status`, role, method: "GET", route: "/v8/artifacts/status" }).pipe(
      Effect.map((reply) => {
        expectStrict(recorder, `status-200-${role}`, O.contains(reply.status, 200), statusText(reply));
        expectStrict(
          recorder,
          `status-schema-${role}`,
          O.isSome(decodeStatusBody(text(reply))),
          "body decodes as CachingStatusResponse"
        );
      })
    )
  );

const contentTypes: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const written = yield* writeArtifact(context, recorder, "writer-put-octet-stream", 64);
  expectStrict(recorder, "octet-stream-accepted", succeeded(written.reply), statusText(written.reply));
  const hash = yield* freshHash;
  const body = yield* randomBytes(64);
  const other = yield* run(
    putStep("writer-put-text-plain", "writer", valid(hash), body, { contentType: "text/plain", strictScored: false })
  );
  if (succeeded(other)) {
    const download = yield* run(readStep("reader-get-text-plain", "reader", "GET", valid(hash)));
    expectStrict(
      recorder,
      "non-octet-accepted-exactly",
      sameBody(download, yield* hashBytes(body)),
      statusText(download)
    );
  } else {
    const existence = yield* run(
      readStep("writer-head-text-plain", "writer", "HEAD", valid(hash), { neverWritten: true })
    );
    expectStrict(recorder, "non-octet-rejected-cleanly", rejected(other) && missing(existence), statusText(other));
  }
  recorder.notes.push("A request without Content-Length is not sent; fetch always frames byte bodies.");
});

const durations: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const timed = yield* freshHash;
  const untimed = yield* freshHash;
  const malformed = yield* freshHash;
  const body = yield* randomBytes(32);
  yield* run(
    putStep("writer-put-duration", "writer", valid(timed), body, { headers: { "x-artifact-duration": "4321" } })
  );
  for (const method of ["HEAD", "GET"] as const) {
    const reply = yield* run(readStep(`reader-${Str.toLowerCase(method)}-duration`, "reader", method, valid(timed)));
    expectStrict(
      recorder,
      `duration-round-trip-${Str.toLowerCase(method)}`,
      O.contains(header(reply, "x-artifact-duration"), "4321"),
      statusText(reply)
    );
  }
  yield* run(putStep("writer-put-no-duration", "writer", valid(untimed), body));
  const absent = yield* run(readStep("reader-get-no-duration", "reader", "GET", valid(untimed)));
  expectStrict(
    recorder,
    "absent-duration-zero",
    succeeded(absent) && O.getOrElse(header(absent, "x-artifact-duration"), () => "0") === "0",
    statusText(absent)
  );
  const bad = yield* run(
    putStep("writer-put-malformed-duration", "writer", valid(malformed), body, {
      headers: { "x-artifact-duration": "not-a-number" },
    })
  );
  expectStrict(
    recorder,
    "malformed-duration-attributable",
    O.exists(bad.status, (code) => code < 500),
    statusText(bad)
  );
  recorder.notes.push(`malformed duration upload: ${statusText(bad)}`);
});

const metadata: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const hash = yield* freshHash;
  const body = yield* randomBytes(48);
  const tag = yield* randomHex(32);
  const sha = yield* randomHex(20);
  const dirty = yield* randomHex(20);
  yield* run(
    putStep("writer-put-metadata", "writer", valid(hash), body, {
      headers: { "x-artifact-tag": tag, "x-artifact-sha": sha, "x-artifact-dirty-hash": dirty },
    })
  );
  const download = yield* run(readStep("reader-get-metadata", "reader", "GET", valid(hash)));
  const existence = yield* run(readStep("reader-head-metadata", "reader", "HEAD", valid(hash)));
  expectStrict(recorder, "tag-preserved", O.contains(header(download, "x-artifact-tag"), tag), statusText(download));
  expectStrict(recorder, "sha-preserved", O.contains(header(download, "x-artifact-sha"), sha), statusText(download));
  expectStrict(
    recorder,
    "dirty-hash-preserved",
    O.contains(header(download, "x-artifact-dirty-hash"), dirty),
    statusText(download)
  );
  expectStrict(
    recorder,
    "head-sha-preserved",
    O.contains(header(existence, "x-artifact-sha"), sha),
    statusText(existence)
  );
});

const optionalRoute = (
  label: string,
  route: "/v8/artifacts" | "/v8/artifacts/events",
  payload: (written: string, unwritten: string) => Effect.Effect<string, never, Crypto.Crypto>,
  verify: (
    recorder: Recorder,
    reply: WireReply,
    written: { readonly hash: string; readonly size: number },
    unwritten: string
  ) => void
): WireCase =>
  Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
    const written = yield* writeArtifact(context, recorder, "writer-put-seed", 24);
    const unwritten = yield* freshHash;
    const reply = yield* sendTracked(
      context,
      recorder
    )({
      label,
      role: "reader",
      method: "POST",
      route,
      body: new TextEncoder().encode(yield* payload(written.hash, unwritten)),
      contentType: "application/json",
    });
    if (O.exists(reply.status, isOptionalAbsence)) {
      recorder.unsupported = O.some(`${route} is absent (${statusText(reply)}); the route is optional.`);
      return;
    }
    verify(recorder, reply, { hash: written.hash, size: 24 }, unwritten);
  });

const QueryRequest = S.fromJsonString(S.Struct({ hashes: S.Array(S.String) }));
const EventsRequest = S.Struct({
  sessionId: S.String,
  source: S.Literals(["LOCAL", "REMOTE"]),
  event: S.Literals(["HIT", "MISS"]),
  hash: S.String,
  duration: S.Int,
}).pipe(S.Array, S.fromJsonString);

const batchQuery = optionalRoute(
  "reader-post-query",
  "/v8/artifacts",
  (written, unwritten) => S.encodeEffect(QueryRequest)({ hashes: [written, unwritten] }).pipe(Effect.orDie),
  (recorder, reply, written, unwritten) => {
    const decoded = decodeQueryBody(text(reply));
    expectStrict(recorder, "query-map-shape", O.isSome(decoded), statusText(reply));
    O.map(decoded, (map) => {
      expectStrict(
        recorder,
        "query-written-present",
        O.exists(
          O.flatMap(R.get(map, written.hash), O.fromNullishOr),
          (info) => "size" in info && info.size === written.size
        ),
        "written hash maps to ArtifactInfo with its size"
      );
      expectStrict(
        recorder,
        "query-unwritten-null",
        O.exists(R.get(map, unwritten), P.isNull),
        "unwritten hash maps to null"
      );
    });
  }
);

const cacheEvents = optionalRoute(
  "reader-post-events",
  "/v8/artifacts/events",
  (written) =>
    Crypto.Crypto.use((crypto) => crypto.randomUUIDv4()).pipe(
      Effect.orDie,
      Effect.flatMap((sessionId) =>
        S.encodeEffect(EventsRequest)([{ sessionId, source: "REMOTE", event: "HIT", hash: written, duration: 10 }])
      ),
      Effect.orDie
    ),
  (recorder, reply) => expectStrict(recorder, "events-accepted", O.contains(reply.status, 200), statusText(reply))
);

const clientStatus: WireCase = (context, recorder) =>
  writeArtifact(context, recorder, "writer-put", 16).pipe(
    Effect.map(({ reply }) => {
      expectStrict(recorder, "upload-accepted", succeeded(reply), statusText(reply));
      recorder.notes.push(
        `Upload ${statusText(reply)}; the OpenAPI documents 200 and 202, while client acceptance of any 2xx is scored by native runs.`
      );
    })
  );

const genuineMiss: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const hash = yield* freshHash;
  for (const method of ["GET", "HEAD"] as const) {
    const reply = yield* sendTracked(
      context,
      recorder
    )(readStep(`reader-${Str.toLowerCase(method)}-unwritten`, "reader", method, valid(hash), { neverWritten: true }));
    expectStrict(recorder, `genuine-miss-404-${Str.toLowerCase(method)}`, missing(reply), statusText(reply));
  }
});

const authMatrix: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 32);
  for (const role of ["missing", "malformed", "unknown"] as const) {
    const reply = yield* run(readStep(`${role}-get`, role, "GET", valid(written.hash)));
    expectPolicy(recorder, `deny-${role}-bearer`, denied(reply), statusText(reply));
  }
  for (const role of ["reader", "writer"] as const) {
    const reply = yield* run(readStep(`${role}-get`, role, "GET", valid(written.hash)));
    expectPolicy(recorder, `allow-${role}-read`, sameBody(reply, written.digest), statusText(reply));
  }
  const anonymous = yield* run({
    label: "missing-status",
    role: "missing",
    method: "GET",
    route: "/v8/artifacts/status",
  });
  expectPolicy(recorder, "status-requires-bearer", denied(anonymous), statusText(anonymous));
});

const writeBoundary: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const split = claimNote(context.target.policy.readerWriterSplit, "a reader/writer split");
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 32);
  const fresh = yield* freshHash;
  const replacement = yield* randomBytes(32);
  const created = yield* run(putStep("reader-put-new", "reader", valid(fresh), replacement));
  expectPolicy(recorder, "reader-put-denied", denied(created), `${statusText(created)}.${split}`);
  const after = yield* run(readStep("writer-head-new", "writer", "HEAD", valid(fresh), { neverWritten: true }));
  expectPolicy(recorder, "reader-put-created-nothing", missing(after), `${statusText(after)}.${split}`);
  const overwrite = yield* run(putStep("reader-put-existing", "reader", valid(written.hash), replacement));
  expectPolicy(recorder, "reader-overwrite-denied", denied(overwrite), `${statusText(overwrite)}.${split}`);
  const intact = yield* run(readStep("writer-get-existing", "writer", "GET", valid(written.hash)));
  expectPolicy(recorder, "prior-object-intact", sameBody(intact, written.digest), statusText(intact));
  recorder.notes.push("The reader execution role's storage denial is deployed-IAM evidence and stays a lab case.");
});

const tenantBinding: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const binding = claimNote(context.target.policy.tenantBinding, "tenant binding");
  const { teamId, foreignTeamId } = context.target.namespace;
  const foreign = [["teamId", foreignTeamId]] as const;
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 32);
  const foreignRead = yield* run(readStep("foreign-get-own-namespace", "foreign", "GET", valid(written.hash)));
  expectPolicy(recorder, "foreign-read-denied", rejected(foreignRead), `${statusText(foreignRead)}.${binding}`);
  const planted = yield* freshHash;
  const body = yield* randomBytes(32);
  const foreignWrite = yield* run(putStep("foreign-put-own-namespace", "foreign", valid(planted), body));
  expectPolicy(recorder, "foreign-write-denied", rejected(foreignWrite), `${statusText(foreignWrite)}.${binding}`);
  const plantedCheck = yield* run(
    readStep("writer-head-planted", "writer", "HEAD", valid(planted), { neverWritten: true })
  );
  expectPolicy(
    recorder,
    "foreign-write-created-nothing",
    missing(plantedCheck),
    `${statusText(plantedCheck)}.${binding}`
  );
  const select = yield* run(
    readStep("writer-get-foreign-namespace", "writer", "GET", valid(written.hash), {
      params: foreign,
      selector: "foreign-team-id",
    })
  );
  expectPolicy(recorder, "cross-namespace-read-denied", rejected(select), `${statusText(select)}.${binding}`);
  const escaped = yield* freshHash;
  const crossWrite = yield* run(
    putStep("writer-put-foreign-namespace", "writer", valid(escaped), body, {
      params: foreign,
      selector: "foreign-team-id",
    })
  );
  expectPolicy(recorder, "cross-namespace-write-denied", rejected(crossWrite), `${statusText(crossWrite)}.${binding}`);
  const crossCheck = yield* run(
    readStep("foreign-head-foreign-namespace", "foreign", "HEAD", valid(escaped), {
      params: foreign,
      selector: "foreign-team-id",
      neverWritten: true,
    })
  );
  expectPolicy(
    recorder,
    "cross-namespace-write-created-nothing",
    !succeeded(crossCheck),
    `${statusText(crossCheck)}.${binding}`
  );
  recorder.notes.push(`namespace ${teamId === foreignTeamId ? "and foreign namespace coincide" : "pair is distinct"}`);
});

const selectorShapes = (teamId: string, foreignTeamId: string) =>
  [
    ["empty", [["teamId", ""]]],
    [
      "conflicting",
      [
        ["teamId", teamId],
        ["teamId", foreignTeamId],
      ],
    ],
    [
      "slug-conflict",
      [
        ["teamId", teamId],
        ["slug", foreignTeamId],
      ],
    ],
    ["traversal", [["teamId", `${teamId}/../${foreignTeamId}`]]],
    ["encoded", [["teamId", `${teamId}%2F..%2F${foreignTeamId}`]]],
    ["oversized", [["teamId", `${teamId}${Str.repeat(4096)("x")}`]]],
  ] as const satisfies ReadonlyArray<
    readonly [CacheConformanceSelectorShape, ReadonlyArray<readonly [string, string]>]
  >;

const tenantNormalization: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 32);
  const body = yield* randomBytes(32);
  for (const [shape, params] of selectorShapes(
    context.target.namespace.teamId,
    context.target.namespace.foreignTeamId
  )) {
    const read = yield* run(
      readStep(`writer-get-selector-${shape}`, "writer", "GET", valid(written.hash), { params, selector: shape })
    );
    expectPolicy(recorder, `selector-${shape}-read-fails-closed`, rejected(read), statusText(read));
    const fresh = yield* freshHash;
    const write = yield* run(
      putStep(`writer-put-selector-${shape}`, "writer", valid(fresh), body, { params, selector: shape })
    );
    expectPolicy(recorder, `selector-${shape}-write-fails-closed`, rejected(write), statusText(write));
    const check = yield* run(
      readStep(`writer-head-selector-${shape}`, "writer", "HEAD", valid(fresh), { neverWritten: true })
    );
    expectPolicy(recorder, `selector-${shape}-created-nothing`, missing(check), statusText(check));
  }
});

const percentEncode = (value: string) =>
  A.join(
    A.map(A.fromIterable(new TextEncoder().encode(value)), (byte) => `%${Hex.encode(Uint8Array.of(byte))}`),
    ""
  );

// Each probe names the valid hash a lax server could resolve it to, so the
// follow-up writer HEAD proves no object was created there.
const hashShapes = (hash: string) =>
  [
    ["non-hex", { segment: "not-a-hex-hash", shape: "non-hex" }, O.none()],
    ["traversal", { segment: `..%2F${hash}`, shape: "traversal" }, O.some(hash)],
    ["encoded", { segment: percentEncode(hash), shape: "encoded" }, O.some(hash)],
    ["empty", { segment: "", shape: "empty" }, O.none()],
    ["oversized", { segment: Str.repeat(4096)("a"), shape: "oversized" }, O.none()],
  ] as const satisfies ReadonlyArray<readonly [CacheConformanceHashShape, ArtifactSegment, O.Option<string>]>;

const artifactHashes: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const body = yield* randomBytes(32);
  for (const shape of A.map(hashShapes(""), ([name]) => name)) {
    const probes = hashShapes(yield* freshHash);
    const [, hash, resolved] = A.findFirst(probes, ([name]) => name === shape).pipe(O.getOrThrow);
    const write = yield* run(putStep(`writer-put-hash-${shape}`, "writer", hash, body));
    expectPolicy(recorder, `hash-${shape}-write-fails-closed`, rejected(write), statusText(write));
    const read = yield* run(readStep(`reader-get-hash-${shape}`, "reader", "GET", hash));
    expectPolicy(recorder, `hash-${shape}-read-fails-closed`, rejected(read), statusText(read));
    const check = yield* run(
      readStep(
        `writer-head-hash-${shape}`,
        "writer",
        "HEAD",
        O.match(resolved, { onNone: () => hash, onSome: valid }),
        {
          neverWritten: O.isSome(resolved),
        }
      )
    );
    expectPolicy(recorder, `hash-${shape}-created-nothing`, !succeeded(check), statusText(check));
  }
  recorder.notes.push("Oversized means more than 128 hex characters; the probe sends 4096.");
});

const readFaults: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 32, { strictScored: false });
  for (const role of ["unknown", "missing"] as const) {
    const reply = yield* run(readStep(`${role}-get-written`, role, "GET", valid(written.hash)));
    expectStrict(recorder, `${role}-auth-distinct-from-miss`, denied(reply), statusText(reply));
  }
  const miss = yield* run(
    readStep("reader-get-unwritten", "reader", "GET", valid(yield* freshHash), { neverWritten: true })
  );
  expectStrict(recorder, "genuine-miss-404", missing(miss), statusText(miss));
  const hit = yield* run(readStep("reader-get-written", "reader", "GET", valid(written.hash)));
  expectStrict(recorder, "authorized-hit", sameBody(hit, written.digest), statusText(hit));
  recorder.notes.push(
    "429, 5xx, timeout, reset and truncated-body classes need lab fault injection; the classifier records each distinctly."
  );
});

const writeFaults: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 4096);
  const replacement = yield* randomBytes(4096);
  for (const role of ["reader", "unknown"] as const) {
    const reply = yield* run(putStep(`${role}-put-existing`, role, valid(written.hash), replacement));
    expectPolicy(recorder, `${role}-write-not-acknowledged`, !succeeded(reply), statusText(reply));
  }
  const aborted = yield* run(
    putStep("writer-put-aborted", "writer", valid(written.hash), replacement, {
      abortAfter: 1024,
      strictScored: false,
    })
  );
  expectPolicy(recorder, "aborted-write-not-acknowledged", !succeeded(aborted), statusText(aborted));
  const intact = yield* run(readStep("reader-get-existing", "reader", "GET", valid(written.hash)));
  expectPolicy(recorder, "prior-object-intact", sameBody(intact, written.digest), statusText(intact));
  // The one deliberately untagged write: an acknowledged upload must be readable.
  const unsignedHash = yield* freshHash;
  const unsignedBody = yield* randomBytes(512);
  const unsigned = yield* run(
    putStep("writer-put-untagged", "writer", valid(unsignedHash), unsignedBody, { untagged: true })
  );
  const unsignedRead = yield* run(readStep("reader-get-untagged", "reader", "GET", valid(unsignedHash)));
  const readable = !succeeded(unsigned) || sameBody(unsignedRead, yield* hashBytes(unsignedBody));
  expectPolicy(
    recorder,
    "untagged-write-readable",
    readable,
    readable
      ? `${statusText(unsigned)}; ${statusText(unsignedRead)}`
      : `acknowledged write unreadable: tag passthrough requires every writer to sign; ${statusText(unsigned)}; ${statusText(unsignedRead)}`
  );
});

const concurrentWrites: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const identical = yield* freshHash;
  const shared = yield* randomBytes(32 * 1024);
  const sharedDigest = yield* hashBytes(shared);
  const copies = yield* Effect.forEach(
    A.makeBy(4, (index) => putStep(`writer-put-identical-${index + 1}`, "writer", valid(identical), shared)),
    (step) => send(context, step),
    { concurrency: 4 }
  );
  track(recorder, copies);
  expectPolicy(
    recorder,
    "identical-writes-idempotent",
    A.every(copies, succeeded),
    A.join(A.map(copies, statusText), "; ")
  );
  const settled = yield* run(readStep("reader-get-identical", "reader", "GET", valid(identical)));
  expectPolicy(recorder, "identical-writes-complete", sameBody(settled, sharedDigest), statusText(settled));
  const conflicting = yield* freshHash;
  const bodies = yield* Effect.forEach(
    A.makeBy(4, (index) => 16 * 1024 + index * 1024),
    randomBytes
  );
  const digests = yield* Effect.forEach(bodies, (body) => hashBytes(body));
  const writes = yield* Effect.forEach(
    A.map(bodies, (body, index) => putStep(`writer-put-conflicting-${index + 1}`, "writer", valid(conflicting), body)),
    (step) => send(context, step),
    { concurrency: 4 }
  );
  track(recorder, writes);
  const winner = yield* run(readStep("reader-get-conflicting", "reader", "GET", valid(conflicting)));
  const index = A.findFirstIndex(digests, (digest) => sameBody(winner, digest));
  expectPolicy(recorder, "conflicting-writes-atomic", O.isSome(index), statusText(winner));
  expectPolicy(
    recorder,
    "winner-acknowledged",
    O.exists(index, (position) => O.exists(A.get(writes, position), succeeded)),
    "the stored body belongs to a write that returned 2xx"
  );
  recorder.notes.push(
    `conflicting writes: ${O.match(index, { onNone: () => "no complete body won", onSome: (position) => `write ${position + 1} of 4 won` })}; ${A.join(A.map(writes, statusText), "; ")}`
  );
});

const readDuringWrite: WireCase = Effect.fnUntraced(function* (context: WireContext, recorder: Recorder) {
  const run = sendTracked(context, recorder);
  const prior = yield* writeArtifact(context, recorder, "writer-put-prior", 64 * 1024);
  const next = yield* randomBytes(512 * 1024);
  const nextDigest = yield* hashBytes(next);
  const [overwrite, reads] = yield* Effect.all(
    [
      send(context, putStep("writer-put-overwrite", "writer", valid(prior.hash), next)),
      Effect.forEach(
        A.makeBy(6, (index) => readStep(`reader-get-during-${index + 1}`, "reader", "GET", valid(prior.hash))),
        (step) => send(context, step),
        { concurrency: 6 }
      ),
    ],
    { concurrency: 2 }
  );
  track(recorder, [overwrite, ...reads]);
  expectPolicy(
    recorder,
    "reads-complete-prior-or-new",
    A.every(reads, (reply) => sameBody(reply, prior.digest) || sameBody(reply, nextDigest)),
    A.join(A.map(reads, statusText), "; ")
  );
  const final = yield* run(readStep("reader-get-after", "reader", "GET", valid(prior.hash)));
  expectPolicy(
    recorder,
    "acknowledged-write-visible",
    sameBody(final, succeeded(overwrite) ? nextDigest : prior.digest),
    `${statusText(overwrite)}; ${statusText(final)}`
  );
});

const prepareCase = <Case>(
  cases: HashMap.HashMap<CacheConformanceCaseId, Case>,
  id: CacheConformanceCaseId,
  executor: string,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers,
  operations: ReadonlyArray<CacheConformanceOperation>
) =>
  HashMap.get(cases, id).pipe(
    Effect.fromOption(() => CacheCommandError.new(`${id} has no ${executor} executor.`)),
    Effect.map((execute) => ({
      execute,
      recorder: makeRecorder(),
      context: {
        base: Str.replace(/\/+$/, "")(target.baseUrl.href),
        target,
        bearers,
        operations,
      } satisfies WireContext,
    }))
  );

const wireCases = HashMap.make<ReadonlyArray<readonly [CacheConformanceCaseId, WireCase]>>(
  ["RC-001", status],
  ["RC-002", roundTrip(0)],
  ["RC-003", roundTrip(4096)],
  ["RC-004", contentTypes],
  ["RC-005", durations],
  ["RC-006", metadata],
  ["RC-007", batchQuery],
  ["RC-008", cacheEvents],
  ["RC-009", clientStatus],
  ["RC-010", genuineMiss],
  ["RC-011", authMatrix],
  ["RC-012", writeBoundary],
  ["RC-014", tenantBinding],
  ["RC-015", tenantNormalization],
  ["RC-016", artifactHashes],
  ["RC-023", readFaults],
  ["RC-024", writeFaults],
  ["RC-025", concurrentWrites],
  ["RC-026", readDuringWrite]
);

/**
 * Execute one wire case against a target and return its sanitized outcome.
 *
 * **Details**
 * Hashes are fresh random hex per run inside the target namespace. Bearer
 * values are only placed on request headers; receipts carry digests and
 * classes, never URLs, bearers, tag values or bodies.
 *
 * **Example** (Reference the wire executor)
 * ```ts
 * import { runCacheConformanceWireCase } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheConformanceWireCase === "function")
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheConformanceWireCase = Effect.fn("CacheConformance.runWireCase")(function* (
  id: CacheConformanceCaseId,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers,
  operations: ReadonlyArray<CacheConformanceOperation>
) {
  const { execute, context, recorder } = yield* prepareCase(wireCases, id, "direct-wire", target, bearers, operations);
  yield* execute(context, recorder);
  return outcomeOf(recorder);
}, CacheCommandError.mapError("Cannot execute a direct-wire conformance case."));

const outcomeOf = (recorder: Recorder) =>
  CacheConformanceWireOutcome.make({
    exchanges: recorder.exchanges,
    strict: recorder.strict,
    policy: recorder.policy,
    observability: recorder.observability,
    performance: recorder.performance,
    measurements: recorder.measurements,
    notes: recorder.notes,
    unsupported: recorder.unsupported,
  });

type FaultProxy = {
  readonly url: string;
  readonly events: Effect.Effect<ReadonlyArray<CacheConformanceProxyEvent>>;
  readonly setScenario: (id: string, fault: CacheConformanceFault) => Effect.Effect<void>;
};

type LabCase = (
  context: WireContext,
  recorder: Recorder,
  proxy: FaultProxy,
  envelope: CacheConformanceLoadEnvelope
) => Effect.Effect<void, CacheCommandError | S.SchemaError, HttpClient.HttpClient | Crypto.Crypto>;

const expectObservable = (recorder: Recorder, id: string, ok: boolean, detail: string) =>
  recorder.observability.push(CacheConformanceWireCheck.make({ id, ok, detail }));
const expectEnvelope = (recorder: Recorder, id: string, ok: boolean, detail: string) =>
  recorder.performance.push(CacheConformanceWireCheck.make({ id, ok, detail }));

const faultProbes = [
  ["none", "unwritten", "miss"],
  ["none", "written", "success"],
  ["status-429", "written", "throttled"],
  ["status-503", "written", "server-error"],
  ["timeout", "written", "timeout"],
  ["reset", "written", "transport-error"],
  ["truncated-body", "written", "truncated-body"],
] as const satisfies ReadonlyArray<readonly [CacheConformanceFault, "written" | "unwritten", CacheConformanceOutcome]>;

/** Client deadline for the proxied fault probes; the proxy holds a `timeout` fault longer. */
const faultProbeTimeoutMs = 1500;

const faultClasses: LabCase = Effect.fnUntraced(function* (
  context: WireContext,
  recorder: Recorder,
  proxy: FaultProxy
) {
  const written = yield* writeArtifact(context, recorder, "writer-put-seed", 4096);
  const unwritten = yield* freshHash;
  const viaProxy: WireContext = {
    ...context,
    base: proxy.url,
    target: CacheConformanceTarget.make({ ...context.target, requestTimeoutMs: faultProbeTimeoutMs }),
  };
  const run = sendTracked(viaProxy, recorder);
  const seen = A.empty<CacheConformanceOutcome>();
  for (const [fault, artifact, expected] of faultProbes) {
    const scenario = `rc-023-${fault}-${artifact}`;
    yield* proxy.setScenario(scenario, fault);
    const reply = yield* run(
      readStep(
        `reader-get-${fault}-${artifact}`,
        "reader",
        "GET",
        valid(artifact === "written" ? written.hash : unwritten),
        {
          neverWritten: artifact === "unwritten",
          strictScored: false,
        }
      )
    );
    seen.push(reply.receipt.outcome);
    expectObservable(
      recorder,
      `fault-${fault}-${artifact}-distinct`,
      reply.receipt.outcome === expected && (fault === "none" || reply.receipt.outcome !== "miss"),
      `expected ${expected}; ${statusText(reply)}`
    );
  }
  yield* proxy.setScenario("rc-023-done", "none");
  // A held `timeout` response is only recorded once the proxy's hold ends,
  // after the client deadline; wait (bounded) for that receipt.
  const all = yield* proxy.events.pipe(
    Effect.repeat({
      until: (events) => A.some(events, (event) => event.fault === "timeout"),
      times: 80,
      schedule: Schedule.spaced(Duration.millis(100)),
    })
  );
  const receipts = A.filter(all, (event) => Str.startsWith("rc-023-")(event.scenario));
  for (const [fault, artifact] of faultProbes) {
    const scenario = `rc-023-${fault}-${artifact}`;
    expectObservable(
      recorder,
      `proxy-receipt-${fault}-${artifact}`,
      A.some(receipts, (event) => event.scenario === scenario && event.fault === fault),
      "the proxy recorded a direct receipt naming the injected fault"
    );
  }
  for (const event of receipts) recorder.exchanges.push(event.exchange);
  expectObservable(
    recorder,
    "fault-classes-pairwise-distinct",
    A.dedupe(seen).length === faultProbes.length,
    A.join(seen, ", ")
  );
  recorder.notes.push(
    "Faults were injected at the loopback proxy in front of the target, so this proves receipt attribution of each class, not backend-originated faults."
  );
});

const latencies = (replies: ReadonlyArray<WireReply>) => A.map(replies, (reply) => reply.receipt.elapsedMs);
const quantile = (values: ReadonlyArray<number>, q: number) =>
  S.Natural.make(O.getOrElse(nearestRank(values, q), () => 0));
const measure = (
  label: string,
  sizeBytes: number,
  readConcurrency: number,
  writeConcurrency: number,
  writes: ReadonlyArray<WireReply>,
  reads: ReadonlyArray<WireReply>,
  failures: number
) =>
  CacheConformanceMeasurement.make({
    label,
    sizeBytes: S.Natural.make(sizeBytes),
    readConcurrency: S.Natural.make(readConcurrency),
    writeConcurrency: S.Natural.make(writeConcurrency),
    requests: S.Natural.make(writes.length + reads.length),
    failures: S.Natural.make(failures),
    readP50Ms: quantile(latencies(reads), 0.5),
    readP95Ms: quantile(latencies(reads), 0.95),
    readMaxMs: quantile(latencies(reads), 1),
    writeP50Ms: quantile(latencies(writes), 0.5),
    writeP95Ms: quantile(latencies(writes), 0.95),
    writeMaxMs: quantile(latencies(writes), 1),
  });

/** Sequential write-then-read rounds per payload size. */
const payloadRounds = 6;

const payloadEnvelope: LabCase = Effect.fnUntraced(function* (
  context: WireContext,
  recorder: Recorder,
  _proxy: FaultProxy,
  envelope: CacheConformanceLoadEnvelope
) {
  const run = sendTracked(context, recorder);
  const sizes = [
    ["p50", envelope.artifactSizes.p50Bytes],
    ["p95", envelope.artifactSizes.p95Bytes],
    ["p99", envelope.artifactSizes.p99Bytes],
    ["envelope-2x-p99", envelope.envelope.payloadBytes],
    ["observed-max", envelope.artifactSizes.maxBytes],
  ] as const;
  for (const [label, size] of sizes) {
    const writes = A.empty<WireReply>();
    const reads = A.empty<WireReply>();
    let failures = 0;
    for (let round = 0; round < payloadRounds; round++) {
      const hash = yield* freshHash;
      const body = yield* randomBytes(size);
      const digest = yield* hashBytes(body);
      const write = yield* run(putStep(`writer-put-${label}`, "writer", valid(hash), body));
      const read = yield* run(readStep(`reader-get-${label}`, "reader", "GET", valid(hash)));
      writes.push(write);
      reads.push(read);
      if (!succeeded(write) || !sameBody(read, digest)) failures++;
    }
    recorder.measurements.push(measure(`payload-${label}`, size, 1, 1, writes, reads, failures));
    expectEnvelope(
      recorder,
      `payload-${label}-correct`,
      failures === 0,
      `${failures} of ${payloadRounds} round trips failed at ${size} bytes; ${O.match(
        A.findFirst(A.appendAll(writes, reads), (reply) => !succeeded(reply)),
        { onNone: () => "all 2xx", onSome: statusText }
      )}`
    );
  }
  recorder.notes.push(`Each size ran ${payloadRounds} sequential write-then-read round trips with random bytes.`);
});

const freshArtifact = Effect.fnUntraced(function* (size: number) {
  const hash = yield* freshHash;
  const body = yield* randomBytes(size);
  return { hash, body, digest: yield* hashBytes(body) };
});
const freshArtifacts = (count: number, size: number) =>
  Effect.forEach(
    A.makeBy(count, () => size),
    freshArtifact
  );

/** Concurrent rounds per concurrency step. */
const concurrencyRounds = 2;

const concurrencyEnvelope: LabCase = Effect.fnUntraced(function* (
  context: WireContext,
  recorder: Recorder,
  _proxy: FaultProxy,
  envelope: CacheConformanceLoadEnvelope
) {
  const size = envelope.artifactSizes.p95Bytes;
  const poolSize = envelope.envelope.readConcurrency;
  const pool = yield* freshArtifacts(poolSize, size);
  const seeded = yield* Effect.forEach(
    pool,
    (entry, index) => send(context, putStep(`writer-put-pool-${index + 1}`, "writer", valid(entry.hash), entry.body)),
    { concurrency: envelope.envelope.writeConcurrency }
  );
  track(recorder, seeded);
  expectEnvelope(
    recorder,
    "concurrency-pool-seeded",
    A.every(seeded, succeeded),
    A.join(
      A.map(
        A.filter(seeded, (reply) => !succeeded(reply)),
        statusText
      ),
      "; "
    )
  );
  const steps = [
    ["observed-peak", envelope.concurrency.readPeak, envelope.concurrency.writePeak],
    ["envelope-1.5x-peak", envelope.envelope.readConcurrency, envelope.envelope.writeConcurrency],
  ] as const;
  for (const [label, readers, writers] of steps) {
    const writes = A.empty<WireReply>();
    const reads = A.empty<WireReply>();
    let failures = 0;
    for (let round = 0; round < concurrencyRounds; round++) {
      const fresh = yield* freshArtifacts(writers, size);
      const [roundWrites, roundReads] = yield* Effect.all(
        [
          Effect.forEach(
            fresh,
            (entry, index) =>
              send(context, putStep(`writer-put-${label}-${index + 1}`, "writer", valid(entry.hash), entry.body)),
            { concurrency: writers }
          ),
          Effect.forEach(
            A.makeBy(readers, (index) => index),
            (index) =>
              send(
                context,
                readStep(
                  `reader-get-${label}-${index + 1}`,
                  "reader",
                  "GET",
                  valid(pool[index % pool.length]?.hash ?? "")
                )
              ),
            { concurrency: readers }
          ),
        ],
        { concurrency: 2 }
      );
      const verified = yield* Effect.forEach(
        fresh,
        (entry, index) =>
          send(context, readStep(`reader-verify-${label}-${index + 1}`, "reader", "GET", valid(entry.hash))),
        { concurrency: writers }
      );
      track(recorder, [...roundWrites, ...roundReads, ...verified]);
      writes.push(...roundWrites);
      reads.push(...roundReads);
      failures += A.filter(roundWrites, (reply) => !succeeded(reply)).length;
      failures += A.filter(
        roundReads,
        (reply, index) => !sameBody(reply, pool[index % pool.length]?.digest ?? sharedNoDigest)
      ).length;
      failures += A.filter(verified, (reply, index) => !sameBody(reply, fresh[index]?.digest ?? sharedNoDigest)).length;
    }
    recorder.measurements.push(measure(`concurrency-${label}`, size, readers, writers, writes, reads, failures));
    expectEnvelope(
      recorder,
      `concurrency-${label}-correct`,
      failures === 0,
      `${failures} incorrect or failed of ${writes.length + reads.length} requests plus write verification at ${readers} readers / ${writers} writers`
    );
  }
  recorder.notes.push(
    `Each step ran ${concurrencyRounds} rounds of simultaneous writes and reads at the p95 size; every write was read back.`
  );
  const unavailable = A.filter(recorder.exchanges, (exchange) => O.contains(exchange.status, 503));
  if (A.isReadonlyArrayNonEmpty(unavailable))
    recorder.notes.push(
      `503 answers: GET ${A.filter(unavailable, (exchange) => exchange.method === "GET").length}, PUT ${A.filter(unavailable, (exchange) => exchange.method === "PUT").length}; on a Lambda topology these are throttles at the reserved concurrency cap.`
    );
});

const sharedNoDigest = Sha256Hex.make(Str.repeat(64)("0"));

const labCases = HashMap.make<ReadonlyArray<readonly [CacheConformanceCaseId, LabCase]>>(
  ["RC-023", faultClasses],
  ["RC-027", payloadEnvelope],
  ["RC-028", concurrencyEnvelope]
);

/**
 * Case ids the lab runner executes.
 *
 * **Example** (List lab-executed cases)
 * ```ts
 * import { cacheConformanceLabCaseIds } from "@beep/repo-cli/commands/Cache"
 * console.assert(cacheConformanceLabCaseIds.includes("RC-027"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const cacheConformanceLabCaseIds: ReadonlyArray<CacheConformanceCaseId> = ["RC-023", "RC-027", "RC-028"];

/**
 * Execute one lab case: proxied fault classes or a measured envelope.
 *
 * **Details**
 * RC-023 sends reads through the fault proxy with a short client deadline and
 * checks that each injected class reaches a distinct receipt; RC-027 and
 * RC-028 measure payload sizes and concurrency directly against the target.
 *
 * **Example** (Reference the lab executor)
 * ```ts
 * import { runCacheConformanceLabCase } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheConformanceLabCase === "function")
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheConformanceLabCase = Effect.fn("CacheConformance.runLabCase")(function* (
  id: CacheConformanceCaseId,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers,
  operations: ReadonlyArray<CacheConformanceOperation>,
  proxy: FaultProxy,
  envelope: CacheConformanceLoadEnvelope
) {
  const { execute, context, recorder } = yield* prepareCase(labCases, id, "lab", target, bearers, operations);
  yield* execute(context, recorder, proxy, envelope);
  return outcomeOf(recorder);
}, CacheCommandError.mapError("Cannot execute a lab conformance case."));
