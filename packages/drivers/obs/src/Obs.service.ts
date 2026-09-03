/**
 * High-level OBS recording driver service.
 *
 * Layers on top of {@link ObsProtocol}: provisions the QA capture scene
 * idempotently, starts and stops recordings with event-confirmed state
 * transitions, and (through {@link Obs.makeLayer}) spawns OBS Studio detached
 * when the websocket is not reachable, retry-connecting until the server
 * accepts the session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObsId } from "@beep/identity/packages";
import { A, O, P, R } from "@beep/utils";
import { Clock, Context, Duration, Effect, Layer, PubSub, Result, Schedule } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { ObsError } from "./Obs.errors.ts";
import {
  EnsureQaSceneRequest,
  EnsureQaSceneResult,
  EnsureRunningResult,
  resolveObsConfig,
  StartRecordingResult,
  StopRecordingRequest,
  StopRecordingResult,
} from "./Obs.models.ts";
import {
  ObsInputSettingsInfo,
  ObsRecordStateChangedEvent,
  ObsRecordStatus,
  ObsSceneItemList,
  ObsSceneList,
  ObsStopRecordResult,
  ObsVersionInfo,
} from "./ObsProtocol.models.ts";
import { ObsProtocol } from "./ObsProtocol.service.ts";
import type { UnknownRecord } from "@beep/schema";
import type { Stream } from "effect";
import type * as Scope from "effect/Scope";
import type { Socket } from "effect/unstable/socket";
import type { ObsConfig, ObsConfigInputOptions, StartRecordingRequest } from "./Obs.models.ts";
import type { ObsEvent, ObsOutputState, ObsRequestType } from "./ObsProtocol.models.ts";
import type { ObsProtocolShape } from "./ObsProtocol.service.ts";

const $I = $ObsId.create("Obs.service");

const OBS_REQUEST_STATUS_RESOURCE_NOT_FOUND = 600;
const OBS_SPAWN_RETRY_INTERVAL = Duration.millis(500);
const OBS_SPAWN_RETRY_CAP = Duration.seconds(15);

const filterConnectFailure = <E>(error: E): Result.Result<ObsError, E> =>
  ObsError.is(error) && error.operation === "connect" ? Result.succeed(error) : Result.fail(error);

const filterResourceNotFound = <E>(error: E): Result.Result<ObsError, E> =>
  ObsError.is(error) && O.exists(error.requestStatusCode, (code) => code === OBS_REQUEST_STATUS_RESOURCE_NOT_FOUND)
    ? Result.succeed(error)
    : Result.fail(error);

const decodeResponseData =
  <T, E>(operation: string, requestType: ObsRequestType, decode: (input: unknown) => Effect.Effect<T, E>) =>
  (responseData: O.Option<UnknownRecord>): Effect.Effect<T, ObsError> =>
    O.match(responseData, {
      onNone: () =>
        Effect.fail(
          ObsError.make({
            message: `obs-websocket returned no response data for ${requestType}.`,
            operation,
            requestType: O.some(requestType),
          })
        ),
      onSome: (data) =>
        decode(data).pipe(
          Effect.mapError((cause) =>
            ObsError.fromUnknown(operation, `Failed to decode the ${requestType} response payload.`, {
              cause,
              requestType,
            })
          )
        ),
    });

const awaitRecordState = Effect.fn("Obs.awaitRecordState")(
  (subscription: PubSub.Subscription<ObsEvent>, state: ObsOutputState, timeoutMillis: number, operation: string) =>
    Effect.repeat(PubSub.take(subscription), {
      until: (event) => ObsRecordStateChangedEvent.is(event) && event.outputState === state,
    }).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(timeoutMillis),
        orElse: () =>
          Effect.fail(
            ObsError.make({
              message: `Timed out after ${timeoutMillis}ms waiting for the RecordStateChanged ${state} event.`,
              operation,
            })
          ),
      })
    )
);

/**
 * Runtime shape exposed by the {@link Obs} service.
 *
 * **Example** (Take first event stream)
 *
 * ```ts
 * import type { ObsShape } from "@beep/obs"
 * import { Stream } from "effect"
 *
 * const eventsOf = (obs: ObsShape) => Stream.take(obs.events, 1)
 * console.log(eventsOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ObsShape {
  /**
   * Provision the QA capture scene idempotently and make it the program
   * scene, reading back the PipeWire portal `RestoreToken` when present.
   */
  readonly ensureQaScene: (request?: EnsureQaSceneRequest | undefined) => Effect.Effect<EnsureQaSceneResult, ObsError>;
  /**
   * Verify the connected OBS instance via `GetVersion` and report whether the
   * driver had to spawn the process for this session.
   */
  readonly ensureRunning: Effect.Effect<EnsureRunningResult, ObsError>;
  /**
   * Driver events published by the connected obs-websocket session.
   */
  readonly events: Stream.Stream<ObsEvent>;
  /**
   * Fetch the current record output status.
   */
  readonly recordStatus: Effect.Effect<ObsRecordStatus, ObsError>;
  /**
   * Set the record directory, start recording, and await the STARTED event —
   * capturing the wall-clock receipt time as the recording clock anchor.
   */
  readonly startRecording: (request: StartRecordingRequest) => Effect.Effect<StartRecordingResult, ObsError>;
  /**
   * Stop recording, take the authoritative `outputPath` from the StopRecord
   * response, and await the STOPPED event so the file is closed.
   */
  readonly stopRecording: (request?: StopRecordingRequest | undefined) => Effect.Effect<StopRecordingResult, ObsError>;
}

const makeService = Effect.fn("Obs.make")(function* (
  options?: { readonly spawned?: boolean | undefined } | undefined
): Effect.fn.Return<ObsShape, never, ObsProtocol> {
  const protocol = yield* ObsProtocol;
  const spawned = options?.spawned === true;

  const ensureRunning = protocol.request("GetVersion").pipe(
    Effect.flatMap(decodeResponseData("ensureRunning", "GetVersion", ObsVersionInfo.decodeEffect)),
    Effect.map((version) =>
      EnsureRunningResult.make({
        obsVersion: version.obsVersion,
        obsWebSocketVersion: version.obsWebSocketVersion,
        spawned,
      })
    ),
    Effect.withSpan("Obs.ensureRunning")
  );

  const readInputSettings = Effect.fn("Obs.readInputSettings")((inputName: string) =>
    protocol
      .request("GetInputSettings", { inputName })
      .pipe(Effect.flatMap(decodeResponseData("ensureQaScene", "GetInputSettings", ObsInputSettingsInfo.decodeEffect)))
  );

  const ensureQaScene = Effect.fn("Obs.ensureQaScene")(function* (
    requestInput?: EnsureQaSceneRequest | undefined
  ): Effect.fn.Return<EnsureQaSceneResult, ObsError> {
    const request = requestInput ?? EnsureQaSceneRequest.make({});
    const sceneList = yield* protocol
      .request("GetSceneList")
      .pipe(Effect.flatMap(decodeResponseData("ensureQaScene", "GetSceneList", ObsSceneList.decodeEffect)));
    const sceneExists = A.some(sceneList.scenes, (scene) => scene.sceneName === request.sceneName);
    if (!sceneExists) {
      yield* protocol.request("CreateScene", { sceneName: request.sceneName });
    }

    const existingSettings = yield* readInputSettings(request.inputName).pipe(
      Effect.asSome,
      Effect.catchFilter(filterResourceNotFound, () => Effect.succeedNone)
    );
    const inputCreated = O.isNone(existingSettings);
    if (inputCreated) {
      yield* protocol.request("CreateInput", {
        inputKind: request.inputKind,
        inputName: request.inputName,
        inputSettings: {},
        sceneName: request.sceneName,
      });
    } else {
      // GetInputSettings is a global lookup: the input can exist while being
      // attached to a different scene, so cross-check the target scene's item
      // list and attach the capture input when it is missing.
      const sceneItems = yield* protocol
        .request("GetSceneItemList", { sceneName: request.sceneName })
        .pipe(Effect.flatMap(decodeResponseData("ensureQaScene", "GetSceneItemList", ObsSceneItemList.decodeEffect)));
      const inputAttached = A.some(sceneItems.sceneItems, (item) =>
        O.exists(O.filter(R.get(item, "sourceName"), P.isString), (name) => name === request.inputName)
      );
      if (!inputAttached) {
        yield* protocol.request("CreateSceneItem", { sceneName: request.sceneName, sourceName: request.inputName });
      }
    }

    const settings = yield* O.match(existingSettings, {
      onNone: () => readInputSettings(request.inputName),
      onSome: Effect.succeed,
    });
    const restoreToken = O.filter(R.get(settings.inputSettings, "RestoreToken"), P.isString);

    yield* protocol.request("SetCurrentProgramScene", { sceneName: request.sceneName });

    return EnsureQaSceneResult.make({
      inputCreated,
      inputName: request.inputName,
      restoreToken,
      sceneCreated: !sceneExists,
      sceneName: request.sceneName,
    });
  });

  const startRecording = Effect.fn("Obs.startRecording")((request: StartRecordingRequest) =>
    Effect.scoped(
      Effect.gen(function* () {
        const subscription = yield* protocol.subscribeEvents;
        yield* protocol.request("SetRecordDirectory", { recordDirectory: request.recordDirectory });
        yield* protocol.request("StartRecord");
        yield* awaitRecordState(
          subscription,
          "OBS_WEBSOCKET_OUTPUT_STARTED",
          request.waitForActiveTimeoutMillis,
          "startRecording"
        );
        const recordStartEpochMs = yield* Clock.currentTimeMillis;
        return StartRecordingResult.make({
          recordDirectory: request.recordDirectory,
          recordStartEpochMs,
        });
      })
    )
  );

  const stopRecording = Effect.fn("Obs.stopRecording")((requestInput?: StopRecordingRequest | undefined) =>
    Effect.scoped(
      Effect.gen(function* () {
        const request = requestInput ?? StopRecordingRequest.make({});
        const subscription = yield* protocol.subscribeEvents;
        const stopResult = yield* protocol
          .request("StopRecord")
          .pipe(Effect.flatMap(decodeResponseData("stopRecording", "StopRecord", ObsStopRecordResult.decodeEffect)));
        yield* awaitRecordState(
          subscription,
          "OBS_WEBSOCKET_OUTPUT_STOPPED",
          request.waitForStoppedTimeoutMillis,
          "stopRecording"
        );
        return StopRecordingResult.make({ outputPath: stopResult.outputPath });
      })
    )
  );

  const recordStatus = protocol
    .request("GetRecordStatus")
    .pipe(
      Effect.flatMap(decodeResponseData("recordStatus", "GetRecordStatus", ObsRecordStatus.decodeEffect)),
      Effect.withSpan("Obs.recordStatus")
    );

  return {
    ensureQaScene,
    ensureRunning,
    events: protocol.events,
    recordStatus,
    startRecording,
    stopRecording,
  };
});

const spawnObsDetached = Effect.fn("Obs.spawnObsDetached")(function* (config: ObsConfig) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make(config.obsBinaryPath, ["--minimize-to-tray"], {
    detached: true,
    forceKillAfter: Duration.millis(config.forceKillAfterMillis),
    stderr: "ignore",
    stdin: "ignore",
    stdout: "ignore",
  });
  // Spawn inside a short-lived scope: `unref` first so scope close releases
  // the handle without killing the detached OBS process.
  yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      yield* Effect.asVoid(handle.unref);
    })
  ).pipe(
    Effect.mapError((cause) =>
      ObsError.fromUnknown(
        "ensureRunning",
        `Failed to spawn "${config.obsBinaryPath}" — install OBS Studio or configure obsBinaryPath.`,
        { cause }
      )
    )
  );
});

const connectAndMake = Effect.fn("Obs.connectAndMake")(function* (
  configInput?: ObsConfigInputOptions | undefined
): Effect.fn.Return<
  ObsShape,
  ObsError,
  Scope.Scope | Socket.WebSocketConstructor | ChildProcessSpawner.ChildProcessSpawner
> {
  const config = resolveObsConfig(configInput);
  const first = yield* ObsProtocol.connect(configInput).pipe(
    Effect.asSome,
    Effect.catchFilter(filterConnectFailure, (error) =>
      Effect.logInfo("obs-websocket is not reachable; spawning OBS Studio detached.").pipe(
        Effect.annotateLogs({ message: error.message }),
        Effect.as(O.none<ObsProtocolShape>())
      )
    )
  );
  const spawned = O.isNone(first);
  const protocol = yield* O.match(first, {
    onNone: () =>
      spawnObsDetached(config).pipe(
        Effect.andThen(
          ObsProtocol.connect(configInput).pipe(
            Effect.retry({
              schedule: Schedule.spaced(OBS_SPAWN_RETRY_INTERVAL).pipe(
                Schedule.upTo({ duration: OBS_SPAWN_RETRY_CAP })
              ),
              while: (error) => error.operation === "connect",
            })
          )
        )
      ),
    onSome: Effect.succeed,
  });
  return yield* makeService({ spawned }).pipe(Effect.provideService(ObsProtocol, protocol));
});

/**
 * Effect service for high-level OBS recording control.
 *
 * **Example** (Access Obs service layer)
 *
 * ```ts
 * import { Obs } from "@beep/obs"
 *
 * const layer = Obs.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Obs extends Context.Service<Obs, ObsShape>()($I`Obs`) {
  /**
   * Build the service over an {@link ObsProtocol} already in context. This is
   * the composition and test seam: provide a stubbed protocol to exercise the
   * high-level operations without a live OBS.
   *
   * **Example** (Verify Obs layer type)
   *
   * ```ts
   * import { Obs } from "@beep/obs"
   * import { Layer } from "effect"
   *
   * console.log(Layer.isLayer(Obs.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Obs, never, ObsProtocol> = Layer.effect(Obs, Effect.map(makeService(), Obs.of));

  /**
   * Build the fully-connected layer: probe the obs-websocket server, spawn
   * `obs --minimize-to-tray` detached (with `unref`, so it outlives this
   * process) when the probe is refused, then retry-connect on a spaced
   * schedule capped at ~15 seconds before failing. Authentication failures
   * (missing password, close code 4009) mean the server was reachable, so
   * they fail immediately without spawning or retrying.
   *
   * **Details**
   *
   * Provide `Socket.layerWebSocketConstructorGlobal` from
   * `effect/unstable/socket` (Bun global WebSocket) plus a platform
   * `ChildProcessSpawner` layer.
   *
   * **Example** (Verify makeLayer result)
   *
   * ```ts
   * import { Obs } from "@beep/obs"
   * import { Layer } from "effect"
   *
   * console.log(Layer.isLayer(Obs.makeLayer()))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config?: ObsConfigInputOptions | undefined
  ): Layer.Layer<Obs, ObsError, Socket.WebSocketConstructor | ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(Obs, Effect.map(connectAndMake(config), Obs.of));
}
