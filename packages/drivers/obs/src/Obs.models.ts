/**
 * Schema-first public models for the high-level OBS recording driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObsId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ObsId.create("Obs.models");

/**
 * Positive timeout value in milliseconds.
 *
 * @example
 * ```ts
 * import { PositiveMilliseconds } from "@beep/obs"
 *
 * const timeout = PositiveMilliseconds.make(5000)
 * console.log(timeout)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
export const PositiveMilliseconds = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isFinite({
        identifier: $I`PositiveMillisecondsFiniteCheck`,
        title: "Positive Milliseconds Finite",
        description: "Timeout milliseconds must be finite numbers.",
        message: "Expected finite milliseconds",
      }),
      S.isGreaterThan(0, {
        identifier: $I`PositiveMillisecondsGreaterThanZeroCheck`,
        title: "Positive Milliseconds Greater Than Zero",
        description: "Timeout milliseconds must be greater than zero.",
        message: "Expected milliseconds greater than zero",
      }),
    ],
    {
      identifier: $I`PositiveMillisecondsChecks`,
      title: "Positive Milliseconds",
      description: "Checks for positive finite timeout milliseconds.",
    }
  )
).pipe(
  $I.annoteSchema("PositiveMilliseconds", {
    description: "Positive finite timeout value in milliseconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive timeout value in milliseconds.
 *
 * @example
 * ```ts
 * import { PositiveMilliseconds } from "@beep/obs"
 * import type { PositiveMilliseconds as PositiveMillisecondsValue } from "@beep/obs"
 *
 * const timeout: PositiveMillisecondsValue = PositiveMilliseconds.make(5000)
 * console.log(timeout)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveMilliseconds = typeof PositiveMilliseconds.Type;

/**
 * Network port number in the closed 1-65535 range.
 *
 * @example
 * ```ts
 * import { ObsWebSocketPort } from "@beep/obs"
 *
 * const port = ObsWebSocketPort.make(4455)
 * console.log(port)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObsWebSocketPort = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`ObsWebSocketPortMinimumCheck`,
        title: "Obs WebSocket Port Minimum",
        description: "Network ports must be at least 1.",
        message: "Expected a port of at least 1",
      }),
      S.isLessThanOrEqualTo(65_535, {
        identifier: $I`ObsWebSocketPortMaximumCheck`,
        title: "Obs WebSocket Port Maximum",
        description: "Network ports must not exceed 65535.",
        message: "Expected a port of at most 65535",
      }),
    ],
    {
      identifier: $I`ObsWebSocketPortChecks`,
      title: "Obs WebSocket Port",
      description: "Checks for network ports in the closed 1-65535 range.",
    }
  )
).pipe(
  $I.annoteSchema("ObsWebSocketPort", {
    description: "Network port number in the closed 1-65535 range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Network port number in the closed 1-65535 range.
 *
 * @example
 * ```ts
 * import { ObsWebSocketPort } from "@beep/obs"
 * import type { ObsWebSocketPort as ObsWebSocketPortValue } from "@beep/obs"
 *
 * const port: ObsWebSocketPortValue = ObsWebSocketPort.make(4455)
 * console.log(port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsWebSocketPort = typeof ObsWebSocketPort.Type;

/**
 * Runtime configuration overrides for the OBS driver.
 *
 * The default `eventSubscriptions` bitmask 79 selects
 * General(1) | Config(2) | Scenes(4) | Inputs(8) | Outputs(64).
 *
 * @example
 * ```ts
 * import { ObsConfigInput } from "@beep/obs"
 *
 * const config = ObsConfigInput.make({})
 * console.log(config.port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsConfigInput extends S.Class<ObsConfigInput>($I`ObsConfigInput`)(
  {
    connectTimeoutMillis: PositiveMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(5000),
      $I.annoteKey("ObsConfigInput.connectTimeoutMillis", {
        description: "Timeout in milliseconds for the obs-websocket connect handshake.",
      })
    ),
    eventSubscriptions: S.Int.pipe(
      SchemaUtils.withKeyDefaults(79),
      $I.annoteKey("ObsConfigInput.eventSubscriptions", {
        description: "EventSubscription bitmask sent in Identify (default 79: General|Config|Scenes|Inputs|Outputs).",
      })
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(2000),
      $I.annoteKey("ObsConfigInput.forceKillAfterMillis", {
        description: "Timeout in milliseconds before an interrupted spawned process is force-killed.",
      })
    ),
    host: S.String.pipe(
      SchemaUtils.withKeyDefaults("127.0.0.1"),
      $I.annoteKey("ObsConfigInput.host", {
        description: "Host the obs-websocket server listens on.",
      })
    ),
    obsBinaryPath: S.String.pipe(
      SchemaUtils.withKeyDefaults("obs"),
      $I.annoteKey("ObsConfigInput.obsBinaryPath", {
        description: "Executable path or command name used to spawn OBS Studio.",
      })
    ),
    password: S.OptionFromOptionalKey(S.String.pipe(S.Redacted)).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsConfigInput.password", {
        description:
          "obs-websocket password, when the server requires authentication (caller reads OBS_WEBSOCKET_PASSWORD).",
      })
    ),
    port: ObsWebSocketPort.pipe(
      SchemaUtils.withKeyDefaults(4455),
      $I.annoteKey("ObsConfigInput.port", {
        description: "Port the obs-websocket server listens on.",
      })
    ),
  },
  $I.annote("ObsConfigInput", {
    description: "Optional runtime configuration overrides for the OBS driver.",
  })
) {}

/**
 * Constructor input accepted by {@link ObsConfigInput} and the driver layer
 * factories — every field optional, schema defaults applied.
 *
 * @example
 * ```ts
 * import type { ObsConfigInputOptions } from "@beep/obs"
 *
 * const options: ObsConfigInputOptions = { port: 4455 }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsConfigInputOptions = (typeof ObsConfigInput)["~type.make.in"];

/**
 * Resolved runtime configuration for the OBS driver.
 *
 * @example
 * ```ts
 * import { resolveObsConfig } from "@beep/obs"
 *
 * const config = resolveObsConfig({})
 * console.log(config.host)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsConfig extends S.Class<ObsConfig>($I`ObsConfig`)(
  {
    connectTimeoutMillis: PositiveMilliseconds.pipe(
      $I.annoteKey("ObsConfig.connectTimeoutMillis", {
        description: "Resolved timeout in milliseconds for the obs-websocket connect handshake.",
      })
    ),
    eventSubscriptions: S.Int.pipe(
      $I.annoteKey("ObsConfig.eventSubscriptions", {
        description: "Resolved EventSubscription bitmask sent in Identify.",
      })
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      $I.annoteKey("ObsConfig.forceKillAfterMillis", {
        description: "Resolved timeout in milliseconds before an interrupted spawned process is force-killed.",
      })
    ),
    host: S.String.pipe(
      $I.annoteKey("ObsConfig.host", {
        description: "Resolved host the obs-websocket server listens on.",
      })
    ),
    obsBinaryPath: S.String.pipe(
      $I.annoteKey("ObsConfig.obsBinaryPath", {
        description: "Resolved executable path or command name used to spawn OBS Studio.",
      })
    ),
    password: S.Option(S.String.pipe(S.Redacted)).pipe(
      $I.annoteKey("ObsConfig.password", {
        description: "Resolved obs-websocket password, when authentication is configured.",
      })
    ),
    port: ObsWebSocketPort.pipe(
      $I.annoteKey("ObsConfig.port", {
        description: "Resolved port the obs-websocket server listens on.",
      })
    ),
  },
  $I.annote("ObsConfig", {
    description: "Resolved runtime configuration for the OBS driver.",
  })
) {}

/**
 * Resolve optional configuration overrides into a full {@link ObsConfig}
 * with schema defaults applied.
 *
 * @example
 * ```ts
 * import { resolveObsConfig } from "@beep/obs"
 *
 * const config = resolveObsConfig()
 * console.log(config.port)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveObsConfig = (input?: ObsConfigInputOptions | undefined): ObsConfig =>
  ObsConfig.make(ObsConfigInput.make(input ?? {}));

/**
 * Result of verifying the OBS process behind the connected session.
 *
 * @example
 * ```ts
 * import { EnsureRunningResult } from "@beep/obs"
 *
 * const result = EnsureRunningResult.make({
 *   spawned: false,
 *   obsVersion: "32.1.2",
 *   obsWebSocketVersion: "5.5.2"
 * })
 * console.log(result.spawned)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnsureRunningResult extends S.Class<EnsureRunningResult>($I`EnsureRunningResult`)(
  {
    obsVersion: S.String.pipe(
      $I.annoteKey("EnsureRunningResult.obsVersion", {
        description: "OBS Studio version reported by the connected server.",
      })
    ),
    obsWebSocketVersion: S.String.pipe(
      $I.annoteKey("EnsureRunningResult.obsWebSocketVersion", {
        description: "obs-websocket plugin version reported by the connected server.",
      })
    ),
    spawned: S.Boolean.pipe(
      $I.annoteKey("EnsureRunningResult.spawned", {
        description: "Whether the driver had to spawn the OBS process to establish this session.",
      })
    ),
  },
  $I.annote("EnsureRunningResult", {
    description: "Result of verifying the OBS process behind the connected session.",
  })
) {}

/**
 * Request to provision the idempotent QA capture scene.
 *
 * @example
 * ```ts
 * import { EnsureQaSceneRequest } from "@beep/obs"
 *
 * const request = EnsureQaSceneRequest.make({})
 * console.log(request.sceneName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnsureQaSceneRequest extends S.Class<EnsureQaSceneRequest>($I`EnsureQaSceneRequest`)(
  {
    inputKind: S.String.pipe(
      SchemaUtils.withKeyDefaults("pipewire-screen-capture-source"),
      $I.annoteKey("EnsureQaSceneRequest.inputKind", {
        description: "OBS input kind used for the capture source (Wayland PipeWire portal capture by default).",
      })
    ),
    inputName: S.String.pipe(
      SchemaUtils.withKeyDefaults("beep-qa-capture"),
      $I.annoteKey("EnsureQaSceneRequest.inputName", {
        description: "Name of the capture input provisioned inside the QA scene.",
      })
    ),
    sceneName: S.String.pipe(
      SchemaUtils.withKeyDefaults("beep-qa"),
      $I.annoteKey("EnsureQaSceneRequest.sceneName", {
        description: "Name of the QA scene to provision.",
      })
    ),
  },
  $I.annote("EnsureQaSceneRequest", {
    description: "Request to provision the idempotent QA capture scene.",
  })
) {}

/**
 * Result of provisioning the QA capture scene.
 *
 * A none `restoreToken` means the PipeWire portal picker has not persisted a
 * window selection yet: the first interactive pick populates it, and a stale
 * token makes the picker reappear rather than failing.
 *
 * @example
 * ```ts
 * import { EnsureQaSceneResult } from "@beep/obs"
 * import * as O from "effect/Option"
 *
 * const result = EnsureQaSceneResult.make({
 *   sceneName: "beep-qa",
 *   inputName: "beep-qa-capture",
 *   sceneCreated: true,
 *   inputCreated: true,
 *   restoreToken: O.none()
 * })
 * console.log(result.sceneCreated)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnsureQaSceneResult extends S.Class<EnsureQaSceneResult>($I`EnsureQaSceneResult`)(
  {
    inputCreated: S.Boolean.pipe(
      $I.annoteKey("EnsureQaSceneResult.inputCreated", {
        description: "Whether the capture input had to be created by this call.",
      })
    ),
    inputName: S.String.pipe(
      $I.annoteKey("EnsureQaSceneResult.inputName", {
        description: "Name of the provisioned capture input.",
      })
    ),
    restoreToken: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("EnsureQaSceneResult.restoreToken", {
        description: "PipeWire portal RestoreToken read back from the input settings, when present.",
      })
    ),
    sceneCreated: S.Boolean.pipe(
      $I.annoteKey("EnsureQaSceneResult.sceneCreated", {
        description: "Whether the QA scene had to be created by this call.",
      })
    ),
    sceneName: S.String.pipe(
      $I.annoteKey("EnsureQaSceneResult.sceneName", {
        description: "Name of the provisioned QA scene.",
      })
    ),
  },
  $I.annote("EnsureQaSceneResult", {
    description: "Result of provisioning the idempotent QA capture scene.",
  })
) {}

/**
 * Request to start an OBS recording into a specific directory.
 *
 * @example
 * ```ts
 * import { StartRecordingRequest } from "@beep/obs"
 *
 * const request = StartRecordingRequest.make({ recordDirectory: "/tmp/qa-video" })
 * console.log(request.recordDirectory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StartRecordingRequest extends S.Class<StartRecordingRequest>($I`StartRecordingRequest`)(
  {
    recordDirectory: S.String.pipe(
      $I.annoteKey("StartRecordingRequest.recordDirectory", {
        description: "Directory the record output writes files to (SetRecordDirectory before StartRecord).",
      })
    ),
    waitForActiveTimeoutMillis: PositiveMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(10_000),
      $I.annoteKey("StartRecordingRequest.waitForActiveTimeoutMillis", {
        description: "Timeout in milliseconds waiting for the RecordStateChanged STARTED event.",
      })
    ),
  },
  $I.annote("StartRecordingRequest", {
    description: "Request to start an OBS recording into a specific directory.",
  })
) {}

/**
 * Result of a started recording. `recordStartEpochMs` is the wall-clock
 * receipt time of the `OBS_WEBSOCKET_OUTPUT_STARTED` event — the Lane B
 * clock-sync anchor for correlating witness events with video time.
 *
 * @example
 * ```ts
 * import { StartRecordingResult } from "@beep/obs"
 *
 * const result = StartRecordingResult.make({ recordStartEpochMs: 1722300000000, recordDirectory: "/tmp/qa-video" })
 * console.log(result.recordStartEpochMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StartRecordingResult extends S.Class<StartRecordingResult>($I`StartRecordingResult`)(
  {
    recordDirectory: S.String.pipe(
      $I.annoteKey("StartRecordingResult.recordDirectory", {
        description: "Directory the record output writes files to.",
      })
    ),
    recordStartEpochMs: S.Finite.pipe(
      $I.annoteKey("StartRecordingResult.recordStartEpochMs", {
        description: "Wall-clock epoch milliseconds captured when the STARTED event was received (clock anchor).",
      })
    ),
  },
  $I.annote("StartRecordingResult", {
    description: "Result of a started OBS recording, carrying the clock-sync anchor.",
  })
) {}

/**
 * Request options for stopping an OBS recording.
 *
 * @example
 * ```ts
 * import { StopRecordingRequest } from "@beep/obs"
 *
 * const request = StopRecordingRequest.make({})
 * console.log(request.waitForStoppedTimeoutMillis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StopRecordingRequest extends S.Class<StopRecordingRequest>($I`StopRecordingRequest`)(
  {
    waitForStoppedTimeoutMillis: PositiveMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(10_000),
      $I.annoteKey("StopRecordingRequest.waitForStoppedTimeoutMillis", {
        description: "Timeout in milliseconds waiting for the RecordStateChanged STOPPED event.",
      })
    ),
  },
  $I.annote("StopRecordingRequest", {
    description: "Request options for stopping an OBS recording.",
  })
) {}

/**
 * Result of a stopped recording. `outputPath` comes from the `StopRecord`
 * response (authoritative), and the STOPPED event has been awaited so the
 * file is closed and safe to read.
 *
 * @example
 * ```ts
 * import { StopRecordingResult } from "@beep/obs"
 *
 * const result = StopRecordingResult.make({ outputPath: "/tmp/qa-video/capture.mkv" })
 * console.log(result.outputPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StopRecordingResult extends S.Class<StopRecordingResult>($I`StopRecordingResult`)(
  {
    outputPath: S.String.pipe(
      $I.annoteKey("StopRecordingResult.outputPath", {
        description: "Committed recording file path reported by the StopRecord response.",
      })
    ),
  },
  $I.annote("StopRecordingResult", {
    description: "Result of a stopped OBS recording with the committed output path.",
  })
) {}
