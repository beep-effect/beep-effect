/**
 * Witness event collector service.
 *
 * Serves the {@link QaCollectorApi} on a loopback Bun HTTP server, decodes
 * NDJSON lines per-event into a queue, appends accepted events to
 * `events.ndjson` from a single writer fiber, and completes a stop deferred
 * when `POST /stop` arrives. The collector handle file and all resources are
 * scoped: closing the serving scope drains the queue, removes the handle
 * file, and shuts the server down.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { SchemaUtils, UnknownRecord } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Clock, Context, Deferred, Effect, Fiber, FileSystem, Layer, Match, Path, pipe, Queue, Ref } from "effect";
import * as S from "effect/Schema";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { decodeActionEventJson, encodeActionEventJson, MarkerEvent } from "./ActionEvent.models.ts";
import { CollectorHealth, EventsAccepted, MarkAccepted, QaCollectorApi, StopAccepted } from "./Collector.api.ts";
import { QaCaptureError } from "./QaCapture.errors.ts";
import {
  CollectorHandle,
  decodeCollectorHandleJson,
  encodeCollectorHandleJson,
  RoundNumber,
  SessionId,
} from "./QaCapture.models.ts";
import { Witness } from "./Witness.service.ts";
import type { Cause, Scope } from "effect";
import type { ActionEvent } from "./ActionEvent.models.ts";

const $I = $QaCaptureId.create("Collector.service");

/**
 * Placeholder sequence carried by server-side markers (`POST /mark`) before
 * canonical re-sequencing.
 *
 * **Details**
 *
 * The collector rewrites EVERY accepted event's seq with one monotone
 * session-wide counter at ingest (witness counters restart per navigation, so
 * raw page-local seqs collide across page loads). This constant only fills
 * the schema-required field on a server-minted marker until that rewrite.
 *
 * **Example** (Log server marker seq base)
 *
 * ```ts
 * import { SERVER_MARKER_SEQ_BASE } from "@beep/qa-capture"
 * console.log(SERVER_MARKER_SEQ_BASE)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SERVER_MARKER_SEQ_BASE = 1000000;

// The witness encodes its own `seq`, but only the collector knows the canonical
// session-wide one. Re-reading the encoded line through a schema keeps the
// rewrite schema-owned rather than a raw JSON.parse round trip.
const EventLine = S.fromJsonString(UnknownRecord);
const decodeEventLine = S.decodeUnknownEffect(EventLine);
const encodeEventLine = S.encodeUnknownEffect(EventLine);

/**
 * TCP port a collector may bind, including `0` for an ephemeral port.
 *
 * **Example** (Make ephemeral bind port)
 *
 * ```ts
 * import { CollectorBindPort } from "@beep/qa-capture"
 * const port = CollectorBindPort.make(0)
 * console.log(port)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CollectorBindPort = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`CollectorBindPortMinimumCheck`,
        title: "Collector Bind Port Minimum",
        description: "Bind ports are zero (ephemeral) or greater.",
        message: "Expected a port of at least zero",
      }),
      S.isLessThanOrEqualTo(65535, {
        identifier: $I`CollectorBindPortMaximumCheck`,
        title: "Collector Bind Port Maximum",
        description: "Bind ports do not exceed 65535.",
        message: "Expected a port of at most 65535",
      }),
    ],
    {
      identifier: $I`CollectorBindPortChecks`,
      title: "Collector Bind Port",
      description: "Checks for bindable TCP port numbers including ephemeral zero.",
    }
  )
).pipe(
  $I.annoteSchema("CollectorBindPort", {
    description: "TCP port a collector may bind, including 0 for an ephemeral port.",
  })
);

/**
 * TCP port a collector may bind, including `0` for an ephemeral port.
 *
 * **Example** (Type annotated bind port)
 *
 * ```ts
 * import { CollectorBindPort } from "@beep/qa-capture"
 * import type { CollectorBindPort as CollectorBindPortValue } from "@beep/qa-capture"
 * const port: CollectorBindPortValue = CollectorBindPort.make(43117)
 * console.log(port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CollectorBindPort = typeof CollectorBindPort.Type;

/**
 * Options accepted by {@link Collector} `serve`.
 *
 * **Example** (Make collector serve options)
 *
 * ```ts
 * import { CollectorServeOptions } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const options = CollectorServeOptions.make({
 *   eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *   handlePath: O.none(),
 *   round: 1,
 *   sessionDir: "/repo/.beep/qa/round-1",
 *   sessionId: "qa-2026-07-30-091500"
 * })
 * console.log(options.port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CollectorServeOptions extends S.Class<CollectorServeOptions>($I`CollectorServeOptions`)(
  {
    allowedOrigins: S.Array(S.String).pipe(
      SchemaUtils.withKeyDefaults(["*"]),
      $I.annoteKey("CollectorServeOptions.allowedOrigins", {
        description: "CORS origins allowed to post witness events; the CLI scopes this to app origins.",
      })
    ),
    eventsPath: S.String.pipe(
      $I.annoteKey("CollectorServeOptions.eventsPath", {
        description: "Absolute path of the events NDJSON log to append.",
      })
    ),
    handlePath: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>())),
      $I.annoteKey("CollectorServeOptions.handlePath", {
        description: "Discovery handle file path (.beep/qa/current.json); written while live when present.",
      })
    ),
    hostname: S.String.pipe(
      SchemaUtils.withKeyDefaults("127.0.0.1"),
      $I.annoteKey("CollectorServeOptions.hostname", {
        description: "Loopback hostname to bind.",
      })
    ),
    port: CollectorBindPort.pipe(
      SchemaUtils.withKeyDefaults(43117),
      $I.annoteKey("CollectorServeOptions.port", {
        description: "TCP port to bind; 0 requests an ephemeral port.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("CollectorServeOptions.round", {
        description: "QA round number being recorded.",
      })
    ),
    sessionDir: S.String.pipe(
      $I.annoteKey("CollectorServeOptions.sessionDir", {
        description: "Absolute path of the round directory.",
      })
    ),
    sessionId: SessionId.pipe(
      $I.annoteKey("CollectorServeOptions.sessionId", {
        description: "Capture session identifier.",
      })
    ),
  },
  $I.annote("CollectorServeOptions", {
    description: "Options accepted by Collector.serve.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(CollectorServeOptions);
}

/**
 * Live view of a serving collector returned by {@link Collector} `serve`.
 *
 * **Example** (Inspect running collector port)
 *
 * ```ts
 * import type { CollectorRunning } from "@beep/qa-capture"
 * const inspect = (running: CollectorRunning) => running.port
 * console.log(inspect)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CollectorRunning {
  readonly awaitStop: Effect.Effect<void>;
  readonly eventsWritten: Effect.Effect<number>;
  readonly handle: CollectorHandle;
  readonly port: number;
  readonly rejectedCount: Effect.Effect<number>;
}

/**
 * Runtime shape exposed by the {@link Collector} service.
 *
 * **Example** (Stub collector service shape)
 *
 * ```ts
 * import type { CollectorShape } from "@beep/qa-capture"
 * import { Effect } from "effect"
 * const service: CollectorShape = { serve: () => Effect.die("not implemented") }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CollectorShape {
  readonly serve: (options: CollectorServeOptions) => Effect.Effect<CollectorRunning, QaCaptureError, Scope.Scope>;
}

const portOfServer = (server: HttpServer.HttpServer["Service"], fallback: number): number =>
  Match.value(server.address).pipe(
    Match.tag("TcpAddress", (address) => address.port),
    Match.orElse(() => fallback)
  );

// `process.kill(pid, 0)` probes liveness without signalling; a throw means
// the pid is gone and its handle file is reclaimable.
const isPidAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });

const makeService = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const witness = yield* Witness;

  // A missing handle file and an undecodable one both read as None: neither
  // proves a live owner, so the caller decides between reclaiming (serve) and
  // leaving the file untouched (teardown).
  const readHandleFile = (handlePath: string): Effect.Effect<O.Option<CollectorHandle>> =>
    fs.readFileString(handlePath).pipe(
      Effect.flatMap(decodeCollectorHandleJson),
      Effect.asSome,
      Effect.catchCause(() => Effect.succeedNone)
    );

  // Teardown removes the handle only while this session still owns it: after
  // a stale-handle takeover the successor's handle must survive the
  // predecessor's scope close.
  const removeHandleIfOwned = (handlePath: string, sessionId: CollectorHandle["sessionId"]): Effect.Effect<void> =>
    readHandleFile(handlePath).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.void,
          onSome: (current) =>
            current.sessionId === sessionId ? fs.remove(handlePath, { force: true }).pipe(Effect.ignore) : Effect.void,
        })
      )
    );

  // One live collector owns current.json per checkout: a decodable handle
  // whose pid is alive and foreign refuses the takeover, while dead-pid or
  // undecodable handles are stale and get overwritten.
  const guardHandleTakeover = Effect.fnUntraced(function* (handlePath: string) {
    const existing = yield* readHandleFile(handlePath);
    yield* O.match(existing, {
      onNone: () => Effect.void,
      onSome: (previous) =>
        Effect.flatMap(isPidAlive(previous.pid), (alive) =>
          alive && previous.pid !== process.pid
            ? Effect.fail(
                QaCaptureError.make({
                  message:
                    `collector session "${previous.sessionId}" (pid ${previous.pid}, round ${previous.round}) is still live; ` +
                    "stop it with `bun run beep qa stop` or remove the handle file to reclaim the session",
                  operation: "collectorServe",
                  path: O.some(handlePath),
                })
              )
            : Effect.void
        ),
    });
  });

  const serve = Effect.fn("Collector.serve")(function* (options: CollectorServeOptions) {
    const script = yield* witness.script;

    yield* fs.makeDirectory(path.dirname(options.eventsPath), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("collectorServe", "could not create the events log directory", {
          cause,
          path: options.eventsPath,
        })
      )
    );
    yield* fs.writeFileString(options.eventsPath, "").pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("collectorServe", "could not initialize the events log", {
          cause,
          path: options.eventsPath,
        })
      )
    );

    const queue = yield* Queue.make<readonly [ActionEvent, number], Cause.Done>();
    const stopped = yield* Deferred.make<void>();
    const acceptedRef = yield* Ref.make(0);
    const rejectedRef = yield* Ref.make(0);
    const canonicalSeqRef = yield* Ref.make(1);

    // The witness restarts its page-local counter on every navigation, so raw
    // seqs collide across page loads. The collector owns the canonical
    // session-wide sequence: every accepted event's seq is rewritten at
    // ingest, and the on-disk value is the only one evidence may reference.
    const appendEvent = ([event, seq]: readonly [ActionEvent, number]) =>
      encodeActionEventJson(event).pipe(
        Effect.flatMap(decodeEventLine),
        Effect.map((fields) => ({ ...fields, seq })),
        Effect.flatMap(encodeEventLine),
        Effect.flatMap((line) => fs.writeFileString(options.eventsPath, `${line}\n`, { flag: "a" })),
        Effect.catchCause((cause) => Effect.logWarning("qa collector failed to append an event", cause))
      );

    // Drain finalizer registered before the writer fork: on scope close the
    // queue is ended, the writer consumes every remaining event, and only
    // then does the writer fiber wind down.
    const writer = yield* pipe(
      Queue.take(queue),
      Effect.flatMap(appendEvent),
      Effect.forever,
      Effect.catchTag("Done", () => Effect.void),
      Effect.forkScoped
    );
    yield* Effect.addFinalizer(() => Queue.end(queue).pipe(Effect.andThen(Fiber.join(writer)), Effect.ignore));

    const acceptEvent = (event: ActionEvent) =>
      Ref.getAndUpdate(canonicalSeqRef, (current) => current + 1).pipe(
        Effect.tap((seq) => Queue.offer(queue, [event, seq] as const)),
        Effect.tap(() => Ref.update(acceptedRef, (count) => count + 1))
      );

    const ingestLine = (line: string) =>
      decodeActionEventJson(line).pipe(
        Effect.flatMap(acceptEvent),
        Effect.catchCause(() => Ref.update(rejectedRef, (count) => count + 1))
      );

    const ingestBatch = Effect.fnUntraced(function* (payload: string) {
      const lines = pipe(payload, Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
      const before = { accepted: yield* Ref.get(acceptedRef), rejected: yield* Ref.get(rejectedRef) };
      yield* Effect.forEach(lines, ingestLine, { discard: true });
      const accepted = (yield* Ref.get(acceptedRef)) - before.accepted;
      const rejected = (yield* Ref.get(rejectedRef)) - before.rejected;
      return EventsAccepted.make({ accepted, rejected });
    });

    const acceptMarker = Effect.fnUntraced(function* (label: string) {
      const seq = yield* acceptEvent(
        MarkerEvent.make({
          kind: "marker",
          label,
          seq: SERVER_MARKER_SEQ_BASE,
          tEpochMs: yield* Clock.currentTimeMillis,
        })
      );
      return MarkAccepted.make({ seq });
    });

    const handlers = HttpApiBuilder.group(QaCollectorApi, "collector", (group) =>
      group
        .handle("health", () =>
          Effect.map(
            Effect.all({ eventsWritten: Ref.get(acceptedRef), rejected: Ref.get(rejectedRef) }),
            ({ eventsWritten, rejected }) =>
              CollectorHealth.make({
                eventsWritten,
                rejected,
                round: options.round,
                sessionId: options.sessionId,
                status: "ok",
              })
          )
        )
        .handle("witnessJs", () => Effect.succeed(script))
        .handle("events", ({ payload }) => ingestBatch(payload))
        .handle("mark", ({ payload }) => acceptMarker(payload.label))
        .handle("stop", () =>
          Deferred.succeed(stopped, undefined).pipe(Effect.as(StopAccepted.make({ status: "stopping" })))
        )
    );

    const cors = HttpRouter.middleware(
      HttpMiddleware.cors({
        allowedHeaders: ["*"],
        allowedMethods: ["GET", "POST", "OPTIONS"],
        allowedOrigins: options.allowedOrigins,
      })
    );

    const app = Layer.mergeAll(HttpApiBuilder.layer(QaCollectorApi).pipe(Layer.provide(handlers)), cors.layer);
    const serverLayer = HttpRouter.serve(app, { disableListenLog: true, disableLogger: true }).pipe(
      Layer.provideMerge(BunHttpServer.layer({ hostname: options.hostname, port: options.port }))
    );

    const built = yield* Layer.build(serverLayer).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("collectorServe", "could not start the collector HTTP server", { cause })
      )
    );
    const server = Context.get(built, HttpServer.HttpServer);
    const port = portOfServer(server, options.port);

    const handle = CollectorHandle.make({
      eventsPath: options.eventsPath,
      pid: process.pid,
      port,
      round: options.round,
      sessionDir: options.sessionDir,
      sessionId: options.sessionId,
      startedAtEpochMs: yield* Clock.currentTimeMillis,
    });

    yield* O.match(options.handlePath, {
      onNone: () => Effect.void,
      onSome: (handlePath) =>
        guardHandleTakeover(handlePath).pipe(
          Effect.andThen(encodeCollectorHandleJson(handle)),
          Effect.flatMap((json) => fs.writeFileString(handlePath, json)),
          Effect.mapError((cause) =>
            QaCaptureError.fromUnknown("collectorServe", "could not write the collector handle file", {
              cause,
              path: handlePath,
            })
          ),
          Effect.andThen(Effect.addFinalizer(() => removeHandleIfOwned(handlePath, handle.sessionId)))
        ),
    });

    const running: CollectorRunning = {
      awaitStop: Deferred.await(stopped),
      eventsWritten: Ref.get(acceptedRef),
      handle,
      port,
      rejectedCount: Ref.get(rejectedRef),
    };
    return running;
  });

  const service: CollectorShape = { serve };
  return service;
});

/**
 * Effect service that runs the witness event collector.
 *
 * **Example** (Access collector layer)
 *
 * ```ts
 * import { Collector } from "@beep/qa-capture"
 * const layer = Collector.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Collector extends Context.Service<Collector, CollectorShape>()($I`Collector`) {
  /**
   * Live collector layer over the witness, file-system, and path services.
   *
   * **Example** (Import live collector layer)
   *
   * ```ts
   * import { Collector } from "@beep/qa-capture"
   * const layer = Collector.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Collector, never, FileSystem.FileSystem | Path.Path | Witness> = Layer.effect(
    Collector,
    Effect.map(makeService(), Collector.of)
  );
}
