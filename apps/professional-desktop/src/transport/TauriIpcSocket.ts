/**
 * App-local Tauri-IPC transport for the desktop chat sidecar (transport spike).
 *
 * cspell:words Unlisten
 *
 * Builds an Effect {@link Socket} whose inbound frames arrive on the Rust shell's
 * `sidecar://rx` event channel (the sidecar's stdout, bridged in
 * `src-tauri/src/lib.rs`) and whose outbound frames are written to the sidecar's
 * stdin via the `sidecar_send` command. Tunnelling the existing ndjson rpc frames
 * over this socket lets `RpcClient.layerProtocolSocket` drive the same
 * {@link ChatRpcs} contract the HTTP transport uses — with no loopback HTTP, no
 * `:3939`, and no CSP `connect-src` carve-out.
 *
 * Inbound frames are modelled as an Effect {@link Stream} fed by the two Tauri
 * `listen` channels; the listeners are torn down through {@link Scope} finalizers
 * rather than manual teardown. The Tauri Promise/callback boundary (`invoke`,
 * `listen`) is lifted into Effect with `Effect.tryPromise`, so the transport
 * logic itself stays free of bare Promise chains. Inbound payloads and the
 * sidecar-closed payload are decoded with `effect/Schema` at the boundary.
 *
 * This is the ONLY module that imports `@tauri-apps/api`; keeping the framework
 * wrapper app-local preserves the rule that shared clients/drivers stay
 * browser-safe (see `standards/architecture/03-driver-boundaries.md`).
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, tapRedactedCause } from "@beep/observability/CauseRedaction";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Str from "@beep/utils/Str";
import { thunkEffectVoid } from "@beep/utils/thunk";
import { invoke } from "@tauri-apps/api/core";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Socket } from "effect/unstable/socket";
import { SidecarTransport } from "./SidecarTransport.ts";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type * as Cause from "effect/Cause";
import type * as Scope from "effect/Scope";

const $I = $ProfessionalDesktopId.create("transport/TauriIpcSocket");

const FRAME_SEPARATOR = "\n";

const ipcListenerFailures = Metric.counter("desktop_ipc_listener_failures_total", { incremental: true });
const ipcInboundFrames = Metric.counter("desktop_ipc_inbound_frames_total", { incremental: true });
const ipcInboundBytes = Metric.counter("desktop_ipc_inbound_bytes_total", { incremental: true });
const ipcDecodeFailures = Metric.counter("desktop_ipc_decode_failures_total", { incremental: true });
const ipcClosedEvents = Metric.counter("desktop_ipc_closed_events_total", { incremental: true });
const ipcOutboundFrames = Metric.counter("desktop_ipc_outbound_frames_total", { incremental: true });
const ipcOutboundBytes = Metric.counter("desktop_ipc_outbound_bytes_total", { incremental: true });
const ipcSendFailures = Metric.counter("desktop_ipc_send_failures_total", { incremental: true });
const ipcSendDuration = Metric.timer("desktop_ipc_send_duration");

/**
 * The Tauri event names the Rust shell uses for the IPC stdio bridge: inbound
 * ndjson rpc frames ride `sidecar://rx`, and a terminal sidecar lifecycle signal
 * rides `sidecar://closed` (see `src-tauri/src/lib.rs`).
 */
const SidecarEvent = {
  closed: "sidecar://closed",
  rx: "sidecar://rx",
} as const;

/**
 * A single inbound ndjson rpc frame as delivered on `sidecar://rx`. The Rust
 * bridge only forwards complete, newline-delimited, non-blank UTF-8 frames, so a
 * frame is decoded as a non-empty string at the boundary instead of trusting an
 * `unknown` event payload.
 *
 * **Example** (Validate inbound frame schema)
 *
 * ```ts
 * import { InboundFrame } from "@/transport/TauriIpcSocket"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InboundFrame)("{\"jsonrpc\":\"2.0\"}\n")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InboundFrame = S.NonEmptyString.pipe(
  $I.annoteSchema("InboundFrame", {
    description: "A single complete inbound ndjson rpc frame emitted on `sidecar://rx`.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
  }))
);

type InboundFrame = typeof InboundFrame.Type;

const SidecarClosedKind = LiteralKit(["error", "terminated", "event-stream-closed"]).pipe(
  $I.annoteSchema("SidecarClosedKind", {
    description: "Finite sidecar lifecycle reason emitted on `sidecar://closed`.",
  })
);

/**
 * The `sidecar://closed` payload carrying the sidecar's terminal lifecycle
 * reason. Nullable wire fields decode to `Option` at the boundary so absence is
 * explicit downstream (see effect-first EF-17).
 *
 * **Example** (Make terminated closed payload)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { SidecarClosedPayload } from "@/transport/TauriIpcSocket"
 *
 * const payload = SidecarClosedPayload.make({ kind: "terminated" })
 * console.log(O.isNone(payload.message)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SidecarClosedPayload extends S.Class<SidecarClosedPayload>($I`SidecarClosedPayload`)(
  {
    code: S.OptionFromNullOr(S.Int).pipe(SchemaUtils.withNoneDefault),
    kind: SidecarClosedKind.annotateKey({
      description: "Terminal sidecar lifecycle reason.",
    }),
    message: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
    signal: S.OptionFromNullOr(S.Int).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SidecarClosedPayload", {
    description: "Terminal sidecar lifecycle payload delivered on `sidecar://closed`.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(SidecarClosedPayload);
}

// `none` when an optional lifecycle field is absent, else its string form —
// hoisted so the message match below is not an option-match nested in a match.
const optionLabel = (option: O.Option<number | string>): string =>
  O.match(option, { onNone: () => "none", onSome: (value) => `${value}` });

const sidecarClosedMessage = (payload: SidecarClosedPayload): string =>
  O.match(O.filter(payload.message, Str.isNonEmpty), {
    onNone: () => `sidecar ${payload.kind}: code=${optionLabel(payload.code)} signal=${optionLabel(payload.signal)}`,
    onSome: (message) => `sidecar ${payload.kind}: ${message}`,
  });

/**
 * Raised when the sidecar reports a terminal lifecycle event on
 * `sidecar://closed`, carrying the decoded payload so callers keep the typed
 * close reason.
 *
 * **Example** (Create a terminal sidecar failure)
 *
 * ```ts
 * import { SidecarClosedError, SidecarClosedPayload } from "@/transport/TauriIpcSocket"
 *
 * const error = SidecarClosedError.make({
 *   message: "sidecar terminated",
 *   payload: SidecarClosedPayload.make({ kind: "terminated" })
 * })
 * console.log(error.payload.kind)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SidecarClosedError extends S.TaggedError<SidecarClosedError>($I`SidecarClosedError`)(
  "SidecarClosedError",
  {
    message: S.String,
    payload: SidecarClosedPayload,
  },
  $I.annoteError<SidecarClosedError>("SidecarClosedError", {
    description: "The sidecar emitted a terminal `sidecar://closed` lifecycle event.",
  })
) {}

/**
 * Raised when writing an outbound frame to the sidecar's stdin via the
 * `sidecar_send` command fails at the Tauri boundary.
 *
 * **Example** (Create a sidecar send failure)
 *
 * ```ts
 * import { SidecarSendError } from "@/transport/TauriIpcSocket"
 *
 * const error = SidecarSendError.make({
 *   causeMessage: "stdin closed",
 *   message: "sidecar send failed: stdin closed"
 * })
 * console.log(error.causeMessage)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SidecarSendError extends S.TaggedError<SidecarSendError>($I`SidecarSendError`)(
  "SidecarSendError",
  {
    causeMessage: S.String,
    message: S.String,
  },
  $I.annoteError<SidecarSendError>("SidecarSendError", {
    description: "Writing an outbound ndjson frame to the sidecar's stdin failed.",
  })
) {}

const unknownToMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : `${cause}`);

const toSocketError = (cause: unknown): Socket.SocketError =>
  Socket.isSocketError(cause) ? cause : Socket.SocketError.make({ reason: Socket.SocketReadError.make({ cause }) });

const toSidecarSendError = (cause: unknown): SidecarSendError => {
  const causeMessage = unknownToMessage(cause);
  return SidecarSendError.make({ causeMessage, message: `sidecar send failed: ${causeMessage}` });
};

/**
 * A raw inbound Tauri event, tagged by its source channel. The event payloads
 * stay `unknown` here and are decoded downstream in the stream pipeline, so the
 * synchronous Tauri callbacks only offer onto the queue and never spawn fibers.
 *
 * **Example** (Construct Rx inbound event)
 *
 * ```ts
 * import { InboundEvent } from "@/transport/TauriIpcSocket"
 *
 * const event = InboundEvent.cases.Rx.make({ payload: "frame\n" })
 * console.log(event._tag) // "Rx"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InboundEvent = S.TaggedUnion({
  Closed: { payload: S.Unknown },
  Rx: { payload: S.Unknown },
}).annotate(
  $I.annote("InboundEvent", {
    description: "A raw inbound sidecar event tagged by its Tauri channel.",
  })
);

type InboundEvent = typeof InboundEvent.Type;

/**
 * Register one Tauri event listener and tie its `UnlistenFn` to the current
 * scope, so the listener is torn down through scope finalization instead of
 * manual teardown. The Promise that `listen` returns is the only Promise
 * boundary, and it is lifted into Effect with `Effect.tryPromise`. The handler
 * is a pure synchronous offer, so no fiber is spawned from the callback.
 */
const scopedListen = (
  event: (typeof SidecarEvent)[keyof typeof SidecarEvent],
  toEvent: (payload: unknown) => InboundEvent,
  queue: Queue.Enqueue<InboundEvent, Socket.SocketError | Cause.Done>
): Effect.Effect<UnlistenFn, Socket.SocketError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        import("@tauri-apps/api/event").then(({ listen }) =>
          listen<unknown>(event, (received) => Queue.offerUnsafe(queue, toEvent(received.payload)))
        ),
      catch: toSocketError,
    }),
    (unlisten) => Effect.sync(unlisten)
  ).pipe(
    Effect.tapError(() => Metric.update(Metric.withAttributes(ipcListenerFailures, { event }), 1)),
    tapRedactedCause(
      LogRedactedCauseOptions.make({
        message: "Tauri IPC listener registration failed",
        level: "Error",
        attributes: { event, subsystem: "ipc" },
      })
    ),
    Effect.withSpan("desktop.ipc.listen", { attributes: { event } })
  );

/**
 * Decode one raw inbound event into a downstream effect: an `Rx` event decodes
 * to its ndjson frame, while a `Closed` event decodes its lifecycle payload and
 * fails the stream with a typed {@link SidecarClosedError}. Decode failures in
 * either branch surface as `Socket.SocketError`, matching the read signature.
 */
const decodeInboundEvent = (event: InboundEvent): Effect.Effect<InboundFrame, Socket.SocketError> =>
  InboundEvent.match({
    Closed: ({ payload }) =>
      SidecarClosedPayload.decodeUnknownEffect(payload).pipe(
        Effect.tapError(() => Metric.update(Metric.withAttributes(ipcDecodeFailures, { event: "Closed" }), 1)),
        tapRedactedCause(
          LogRedactedCauseOptions.make({
            message: "Tauri IPC close payload decode failed",
            level: "Error",
            attributes: { event: "Closed", subsystem: "ipc" },
          })
        ),
        Effect.matchEffect({
          onFailure: flow(toSocketError, Effect.fail),
          onSuccess: (decoded) =>
            Metric.update(Metric.withAttributes(ipcClosedEvents, { kind: decoded.kind }), 1).pipe(
              Effect.andThen(
                Effect.logWarning("Tauri IPC sidecar closed").pipe(
                  Effect.annotateLogs({ close_kind: decoded.kind, subsystem: "ipc" })
                )
              ),
              Effect.andThen(
                SidecarClosedError.make({ message: sidecarClosedMessage(decoded), payload: decoded }).pipe(
                  toSocketError,
                  Effect.fail
                )
              )
            ),
        })
      ),
    Rx: ({ payload }) =>
      InboundFrame.decodeUnknownEffect(payload).pipe(
        Effect.tapError(() => Metric.update(Metric.withAttributes(ipcDecodeFailures, { event: "Rx" }), 1)),
        tapRedactedCause(
          LogRedactedCauseOptions.make({
            message: "Tauri IPC inbound frame decode failed",
            level: "Error",
            attributes: { event: "Rx", subsystem: "ipc" },
          })
        ),
        Effect.tap((frame) =>
          Metric.update(Metric.withAttributes(ipcInboundFrames, { event: "Rx" }), 1).pipe(
            Effect.andThen(Metric.update(ipcInboundBytes, Str.length(frame)))
          )
        ),
        Effect.mapError(toSocketError)
      ),
  })(event).pipe(Effect.withSpan("desktop.ipc.decode_inbound", { attributes: { event: event._tag } }));

/**
 * Inbound ndjson rpc frames as an Effect {@link Stream}. The two Tauri listeners
 * (`sidecar://rx`, `sidecar://closed`) are attached inside `Stream.callback` and
 * offer raw, tagged events onto the backing queue; the events are decoded with
 * `effect/Schema` downstream. Once both listeners are live the bridge tells Rust
 * it is ready via `sidecar_ipc_ready`, which replays any frames buffered during
 * sidecar boot (Tauri events are not durable), and finally runs `onOpen` (the
 * read handler's open hook) so it fires only after the transport is subscribed.
 * Listener teardown rides the stream's scope, so no manual unlisten bookkeeping
 * is needed.
 */
const inboundFrames = (onOpen: O.Option<Effect.Effect<void>>): Stream.Stream<InboundFrame, Socket.SocketError> =>
  Stream.callback<InboundEvent, Socket.SocketError>(
    Effect.fnUntraced(function* (queue: Queue.Enqueue<InboundEvent, Socket.SocketError | Cause.Done>) {
      // `Stream.callback` does not surface the register body's own failure, so a
      // rejected `listen` or `sidecar_ipc_ready` would otherwise leave the
      // consumer waiting on a queue that never closes. Push any setup failure
      // onto the queue so the inbound stream fails (and `runRaw` retries through
      // RpcClient) instead of hanging.
      const setup = Effect.gen(function* () {
        yield* scopedListen(SidecarEvent.rx, (payload) => InboundEvent.cases.Rx.make({ payload }), queue);
        yield* scopedListen(SidecarEvent.closed, (payload) => InboundEvent.cases.Closed.make({ payload }), queue);

        // Listeners are live; tell Rust to replay any frames buffered during boot.
        yield* Effect.tryPromise({
          try: () => invoke<void>("sidecar_ipc_ready"),
          catch: toSocketError,
        });

        // The transport is subscribed and Rust has replayed buffered frames; only
        // now run the read handler's open hook.
        yield* O.getOrElse(onOpen, () => Effect.void);
      });
      yield* Effect.onError(setup, (cause) => Queue.failCause(queue, cause));
    })
  ).pipe(Stream.mapEffect(decodeInboundEvent));

/**
 * Ship a single complete, newline-terminated outbound frame to the sidecar's
 * stdin via the `sidecar_send` command. The frame already carries its ndjson
 * framing, so it is written verbatim.
 */
const sendFrame = Effect.fn("sendFrame")(function* (frame: string): Effect.fn.Return<void, SidecarSendError> {
  yield* Metric.update(ipcOutboundBytes, Str.length(frame));
  return yield* Effect.gen(function* () {
    const transport = yield* Effect.tryPromise({
      try: () => invoke<unknown>("sidecar_transport"),
      catch: (cause) => {
        const causeMessage = unknownToMessage(cause);
        return SidecarSendError.make({ causeMessage, message: `sidecar transport probe failed: ${causeMessage}` });
      },
    }).pipe(Effect.flatMap(SidecarTransport.decodeUnknownEffect), Effect.mapError(toSidecarSendError));

    const rpcSessionToken = yield* Effect.fromOption(transport.rpcSessionToken, () =>
      SidecarSendError.make({
        causeMessage: "missing RPC session token",
        message: "sidecar transport did not provide an RPC session token for IPC send",
      })
    );

    yield* Effect.tryPromise({
      try: () => invoke<void>("sidecar_send", { frame, rpcSessionToken }),
      catch: (cause) => {
        const causeMessage = unknownToMessage(cause);
        return SidecarSendError.make({ causeMessage, message: `sidecar send failed: ${causeMessage}` });
      },
    });
    yield* Metric.update(ipcOutboundFrames, 1);
  }).pipe(
    Effect.trackDuration(ipcSendDuration),
    Effect.tapError(() => Metric.update(ipcSendFailures, 1)),
    tapRedactedCause(
      LogRedactedCauseOptions.make({
        message: "Tauri IPC frame send failed",
        level: "Error",
        attributes: { subsystem: "ipc" },
      })
    )
  );
});

/**
 * Flush every complete (newline-terminated) frame currently buffered, leaving
 * any trailing partial frame in the buffer. A partial frame means the producer
 * was interrupted mid-frame; force-terminating it would corrupt the sidecar's
 * stdin protocol, so it waits for the rest of its bytes.
 */
const flushBufferedFrames = (buffer: Ref.Ref<string>): Effect.Effect<void, SidecarSendError> =>
  Ref.get(buffer).pipe(
    Effect.flatMap((pending) =>
      O.match(Str.indexOf(FRAME_SEPARATOR)(pending), {
        onNone: thunkEffectVoid,
        onSome: (newlineIndex) => {
          const frame = Str.slice(0, newlineIndex + 1)(pending);
          return Ref.set(buffer, Str.slice(newlineIndex + 1)(pending)).pipe(
            Effect.andThen(sendFrame(frame)),
            Effect.andThen(flushBufferedFrames(buffer))
          );
        },
      })
    )
  );

/**
 * The scoped outbound writer the {@link Socket} contract requires. Outgoing
 * chunks (already UTF-8 ndjson) accumulate in a buffer, and only complete frames
 * are shipped; a `CloseEvent` is ignored because the sidecar's stdin is closed
 * by killing the child on the Rust side, not by an in-band close frame. Send
 * failures are surfaced as `Socket.SocketError` to match the writer signature.
 */
const makeWriter: Effect.Effect<
  (chunk: Uint8Array | string | Socket.CloseEvent) => Effect.Effect<void, Socket.SocketError>,
  never,
  Scope.Scope
> = Effect.gen(function* () {
  const decoder = new TextDecoder();
  const buffer = yield* Ref.make("");

  return (chunk) =>
    Socket.isCloseEvent(chunk)
      ? Effect.void
      : Ref.update(
          buffer,
          (pending) => pending + (P.isString(chunk) ? chunk : decoder.decode(chunk, { stream: true }))
        ).pipe(
          Effect.andThen(flushBufferedFrames(buffer)),
          Effect.mapError((error) =>
            Socket.SocketError.make({ reason: Socket.SocketWriteError.make({ cause: error }) })
          )
        );
});

/**
 * The IPC {@link Socket}, built from the inbound frame {@link Stream} and the
 * scoped outbound writer. `runRaw` drives the read handler per inbound frame and
 * fails with a clean `SocketCloseError` (code 1000) when the inbound stream ends,
 * matching the `RpcClient` socket protocol's end-of-stream contract.
 */
const makeSocket: Effect.Effect<Socket.Socket> = Effect.sync(() =>
  Socket.make({
    runRaw: (handler, options) =>
      inboundFrames(O.fromUndefinedOr(options?.onOpen)).pipe(
        Stream.runForEach((frame) => {
          const result = handler(frame);
          return Effect.isEffect(result) ? Effect.asVoid(result) : Effect.void;
        }),
        Effect.andThen(Effect.fail(Socket.SocketError.make({ reason: Socket.SocketCloseError.make({ code: 1000 }) })))
      ),
    writer: makeWriter,
  })
);

/**
 * The `Socket` service that backs the IPC rpc client, bridged to the sidecar's
 * stdio through the Tauri Rust shell.
 *
 * **Example** (Confirm Layer instance)
 *
 * ```ts
 * import { TauriIpcSocketLive } from "@/transport/TauriIpcSocket"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(TauriIpcSocketLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TauriIpcSocketLive: Layer.Layer<Socket.Socket> = Layer.effect(Socket.Socket, makeSocket);
