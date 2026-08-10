/**
 * Schema-first session, clock-sync, provenance, and collector-handle models
 * for QA capture sessions.
 *
 * `session.json` (a {@link SessionManifest}) is the canonical schema-is-truth
 * form of a capture round; artifact-native metadata channels (XMP, container
 * tags) carry encoded {@link CaptureProvenance} projections of it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { EpochMilliseconds, SequenceNumber } from "./ActionEvent.models.ts";

const $I = $QaCaptureId.create("QaCapture.models");

/**
 * Recording lanes a capture session can run on.
 *
 * **Example** (Log playwright enum value)
 *
 * ```ts
 * import { CaptureLane } from "@beep/qa-capture"
 * console.log(CaptureLane.Enum.playwright)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureLane = LiteralKit(["obs", "playwright"]).pipe(
  $I.annoteSchema("CaptureLane", {
    description: "Recording lanes a capture session can run on.",
  })
);

/**
 * Recording lanes a capture session can run on.
 *
 * **Example** (Type annotated lane value)
 *
 * ```ts
 * import { CaptureLane } from "@beep/qa-capture"
 * import type { CaptureLane as CaptureLaneValue } from "@beep/qa-capture"
 * const lane: CaptureLaneValue = CaptureLane.Enum.playwright
 * console.log(lane)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CaptureLane = typeof CaptureLane.Type;

/**
 * Methods a clock synchronization can be derived from.
 *
 * **Example** (Log beacon enum value)
 *
 * ```ts
 * import { ClockSyncMethod } from "@beep/qa-capture"
 * console.log(ClockSyncMethod.Enum.beacon)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClockSyncMethod = LiteralKit(["assumed-start", "beacon", "obs-record-state"]).pipe(
  $I.annoteSchema("ClockSyncMethod", {
    description: "Methods a clock synchronization can be derived from.",
  })
);

/**
 * Methods a clock synchronization can be derived from.
 *
 * **Example** (Type annotated method value)
 *
 * ```ts
 * import { ClockSyncMethod } from "@beep/qa-capture"
 * import type { ClockSyncMethod as ClockSyncMethodValue } from "@beep/qa-capture"
 * const method: ClockSyncMethodValue = ClockSyncMethod.Enum.beacon
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClockSyncMethod = typeof ClockSyncMethod.Type;

/**
 * Confidence levels attached to a clock synchronization.
 *
 * **Example** (Log high confidence enum)
 *
 * ```ts
 * import { ClockConfidence } from "@beep/qa-capture"
 * console.log(ClockConfidence.Enum.high)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClockConfidence = LiteralKit(["high", "low", "medium"]).pipe(
  $I.annoteSchema("ClockConfidence", {
    description: "Confidence levels attached to a clock synchronization.",
  })
);

/**
 * Confidence levels attached to a clock synchronization.
 *
 * **Example** (Type annotated confidence value)
 *
 * ```ts
 * import { ClockConfidence } from "@beep/qa-capture"
 * import type { ClockConfidence as ClockConfidenceValue } from "@beep/qa-capture"
 * const confidence: ClockConfidenceValue = ClockConfidence.Enum.high
 * console.log(confidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClockConfidence = typeof ClockConfidence.Type;

/**
 * Kinds of artifacts a capture round can commit.
 *
 * **Example** (Log gif kind enum)
 *
 * ```ts
 * import { CaptureArtifactKind } from "@beep/qa-capture"
 * console.log(CaptureArtifactKind.Enum.gif)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureArtifactKind = LiteralKit(["clip", "frame", "gif", "sheet", "strip", "video"]).pipe(
  $I.annoteSchema("CaptureArtifactKind", {
    description: "Kinds of artifacts a capture round can commit.",
  })
);

/**
 * Kinds of artifacts a capture round can commit.
 *
 * **Example** (Type annotated kind value)
 *
 * ```ts
 * import { CaptureArtifactKind } from "@beep/qa-capture"
 * import type { CaptureArtifactKind as CaptureArtifactKindValue } from "@beep/qa-capture"
 * const kind: CaptureArtifactKindValue = CaptureArtifactKind.Enum.frame
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CaptureArtifactKind = typeof CaptureArtifactKind.Type;

/**
 * Non-empty QA capture session identifier.
 *
 * **Example** (Make session identifier)
 *
 * ```ts
 * import { SessionId } from "@beep/qa-capture"
 * const id = SessionId.make("qa-2026-07-30-091500")
 * console.log(id)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionId = S.String.check(
  S.isMinLength(1, {
    identifier: $I`SessionIdNonEmptyCheck`,
    title: "Session Id Non Empty",
    description: "Session identifiers must not be empty.",
    message: "Expected a non-empty session identifier",
  })
).pipe(
  $I.annoteSchema("SessionId", {
    description: "Non-empty QA capture session identifier.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-empty QA capture session identifier.
 *
 * **Example** (Type annotated session id)
 *
 * ```ts
 * import { SessionId } from "@beep/qa-capture"
 * import type { SessionId as SessionIdValue } from "@beep/qa-capture"
 * const id: SessionIdValue = SessionId.make("qa-2026-07-30-091500")
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SessionId = typeof SessionId.Type;

/**
 * One-based QA round number (`.beep/qa/round-N`).
 *
 * **Example** (Make first round number)
 *
 * ```ts
 * import { RoundNumber } from "@beep/qa-capture"
 * const round = RoundNumber.make(1)
 * console.log(round)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RoundNumber = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`RoundNumberMinimumCheck`,
    title: "Round Number Minimum",
    description: "QA round numbers are one-based positive integers.",
    message: "Expected a positive round number",
  })
).pipe(
  $I.annoteSchema("RoundNumber", {
    description: "One-based QA round number.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * One-based QA round number (`.beep/qa/round-N`).
 *
 * **Example** (Type annotated round number)
 *
 * ```ts
 * import { RoundNumber } from "@beep/qa-capture"
 * import type { RoundNumber as RoundNumberValue } from "@beep/qa-capture"
 * const round: RoundNumberValue = RoundNumber.make(2)
 * console.log(round)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RoundNumber = typeof RoundNumber.Type;

/**
 * Positive integer pixel dimension for viewports.
 *
 * **Example** (Make viewport width)
 *
 * ```ts
 * import { ViewportDimension } from "@beep/qa-capture"
 * const width = ViewportDimension.make(1280)
 * console.log(width)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ViewportDimension = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`ViewportDimensionMinimumCheck`,
    title: "Viewport Dimension Minimum",
    description: "Viewport dimensions are positive integer pixel counts.",
    message: "Expected a positive viewport dimension",
  })
).pipe(
  $I.annoteSchema("ViewportDimension", {
    description: "Positive integer pixel dimension for viewports.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive integer pixel dimension for viewports.
 *
 * **Example** (Type annotated dimension)
 *
 * ```ts
 * import { ViewportDimension } from "@beep/qa-capture"
 * import type { ViewportDimension as ViewportDimensionValue } from "@beep/qa-capture"
 * const width: ViewportDimensionValue = ViewportDimension.make(1280)
 * console.log(width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ViewportDimension = typeof ViewportDimension.Type;

/**
 * Loopback TCP port a collector can listen on.
 *
 * **Example** (Make collector port)
 *
 * ```ts
 * import { CollectorPort } from "@beep/qa-capture"
 * const port = CollectorPort.make(43117)
 * console.log(port)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CollectorPort = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`CollectorPortMinimumCheck`,
        title: "Collector Port Minimum",
        description: "Bound collector ports are at least one.",
        message: "Expected a port of at least one",
      }),
      S.isLessThanOrEqualTo(65535, {
        identifier: $I`CollectorPortMaximumCheck`,
        title: "Collector Port Maximum",
        description: "Collector ports do not exceed 65535.",
        message: "Expected a port of at most 65535",
      }),
    ],
    {
      identifier: $I`CollectorPortChecks`,
      title: "Collector Port",
      description: "Checks for valid bound TCP port numbers.",
    }
  )
).pipe(
  $I.annoteSchema("CollectorPort", {
    description: "Loopback TCP port a collector can listen on.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Loopback TCP port a collector can listen on.
 *
 * **Example** (Type annotated port)
 *
 * ```ts
 * import { CollectorPort } from "@beep/qa-capture"
 * import type { CollectorPort as CollectorPortValue } from "@beep/qa-capture"
 * const port: CollectorPortValue = CollectorPort.make(43117)
 * console.log(port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CollectorPort = typeof CollectorPort.Type;

/**
 * Tool name to version string record captured for reproducibility.
 *
 * **Example** (Record tool versions)
 *
 * ```ts
 * import { ToolVersions } from "@beep/qa-capture"
 * const versions: ToolVersions = { ffmpeg: "8.0", playwright: "1.62.0" }
 * console.log(versions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ToolVersions = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("ToolVersions", {
    description: "Tool name to version string record captured for reproducibility.",
  })
);

/**
 * Tool name to version string record captured for reproducibility.
 *
 * **Example** (Type tool versions record)
 *
 * ```ts
 * import type { ToolVersions } from "@beep/qa-capture"
 * const versions: ToolVersions = { ffmpeg: "8.0" }
 * console.log(versions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToolVersions = typeof ToolVersions.Type;

/**
 * Browser viewport size recorded for a capture session.
 *
 * **Example** (Make viewport dimensions)
 *
 * ```ts
 * import { Viewport } from "@beep/qa-capture"
 * const viewport = Viewport.make({ height: 800, width: 1280 })
 * console.log(viewport)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Viewport extends S.Class<Viewport>($I`Viewport`)(
  {
    height: ViewportDimension.pipe(
      $I.annoteKey("Viewport.height", {
        description: "Viewport height in CSS pixels.",
      })
    ),
    width: ViewportDimension.pipe(
      $I.annoteKey("Viewport.width", {
        description: "Viewport width in CSS pixels.",
      })
    ),
  },
  $I.annote("Viewport", {
    description: "Browser viewport size recorded for a capture session.",
  })
) {}

/**
 * Identity and environment of one QA capture session.
 *
 * **Example** (Construct capture session)
 *
 * ```ts
 * import { CaptureSession, Viewport } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const session = CaptureSession.make({
 *   commitDirty: true,
 *   commitSha: "f9b8aaac15",
 *   id: "qa-2026-07-30-091500",
 *   lane: "playwright",
 *   round: 1,
 *   scenario: O.some("sash-drag"),
 *   startedAtEpochMs: 1753838000000,
 *   toolVersions: {},
 *   url: "http://storybook.beep.localhost:1355/iframe.html?id=dock-dockviewreact--basic",
 *   viewport: Viewport.make({ height: 800, width: 1280 })
 * })
 * console.log(session.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureSession extends S.Class<CaptureSession>($I`CaptureSession`)(
  {
    commitDirty: S.Boolean.pipe(
      $I.annoteKey("CaptureSession.commitDirty", {
        description: "Whether the working tree had uncommitted changes at capture time.",
      })
    ),
    commitSha: S.String.pipe(
      $I.annoteKey("CaptureSession.commitSha", {
        description: "Git commit SHA the capture ran against.",
      })
    ),
    id: SessionId.pipe(
      $I.annoteKey("CaptureSession.id", {
        description: "Unique capture session identifier.",
      })
    ),
    lane: CaptureLane.pipe(
      $I.annoteKey("CaptureSession.lane", {
        description: "Recording lane the session ran on.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("CaptureSession.round", {
        description: "QA round number the session belongs to.",
      })
    ),
    scenario: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureSession.scenario", {
        description: "Scenario name driven during the session, when scripted.",
      })
    ),
    startedAtEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CaptureSession.startedAtEpochMs", {
        description: "Session start wall-clock timestamp in epoch milliseconds.",
      })
    ),
    toolVersions: ToolVersions.pipe(
      $I.annoteKey("CaptureSession.toolVersions", {
        description: "Tool versions captured for reproducibility.",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("CaptureSession.url", {
        description: "URL the recorded page was driven against.",
      })
    ),
    viewport: Viewport.pipe(
      $I.annoteKey("CaptureSession.viewport", {
        description: "Browser viewport size during the capture.",
      })
    ),
  },
  $I.annote("CaptureSession", {
    description: "Identity and environment of one QA capture session.",
  })
) {}

/**
 * Mapping from witness wall-clock time to video time.
 *
 * **Details**
 *
 * `videoTimeMs = slope * tEpochMs + offsetMs`; slope stays fixed at 1.0 for
 * all current methods.
 *
 * **Example** (Make clock sync mapping)
 *
 * ```ts
 * import { ClockSync } from "@beep/qa-capture"
 * const sync = ClockSync.make({
 *   confidence: "high",
 *   method: "beacon",
 *   offsetMs: -1753838000000,
 *   residualRmsMs: 8.4,
 *   slope: 1
 * })
 * console.log(sync.offsetMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClockSync extends S.Class<ClockSync>($I`ClockSync`)(
  {
    confidence: ClockConfidence.pipe(
      $I.annoteKey("ClockSync.confidence", {
        description: "Confidence level of the synchronization.",
      })
    ),
    method: ClockSyncMethod.pipe(
      $I.annoteKey("ClockSync.method", {
        description: "Method the synchronization was derived from.",
      })
    ),
    offsetMs: S.Finite.pipe(
      $I.annoteKey("ClockSync.offsetMs", {
        description: "Additive offset in milliseconds mapping epoch time onto video time.",
      })
    ),
    residualRmsMs: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ClockSyncResidualRmsMinimumCheck`,
        title: "Clock Sync Residual RMS Minimum",
        description: "Residual RMS values are zero or greater.",
        message: "Expected a non-negative residual RMS",
      })
    ).pipe(
      $I.annoteKey("ClockSync.residualRmsMs", {
        description: "Root-mean-square fit residual in milliseconds.",
      })
    ),
    slope: S.Finite.check(
      S.isGreaterThan(0, {
        identifier: $I`ClockSyncSlopePositiveCheck`,
        title: "Clock Sync Slope Positive",
        description: "Clock slopes are strictly positive.",
        message: "Expected a positive clock slope",
      })
    ).pipe(
      $I.annoteKey("ClockSync.slope", {
        description: "Multiplicative slope; fixed at 1.0 for all current methods.",
      })
    ),
  },
  $I.annote("ClockSync", {
    description: "Mapping from witness wall-clock time to video time.",
  })
) {}

/**
 * Provenance payload embedded into every committed artifact.
 *
 * **Details**
 *
 * This is the single schema encoded into each artifact's native metadata
 * channel — the `XMP-beepQA` namespace for PNG/JPEG/GIF via exiftool, and
 * container tags for webm/mkv/mp4 via ffmpeg remuxing.
 *
 * **Example** (Make provenance payload)
 *
 * ```ts
 * import { CaptureProvenance } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const provenance = CaptureProvenance.make({
 *   actionSeq: O.some(4),
 *   capturedAtEpochMs: 1753838000000,
 *   clockOffsetMs: -1753838000000,
 *   commitSha: "f9b8aaac15",
 *   scenarioName: O.some("sash-drag"),
 *   schemaVersion: "beep.qa.provenance.v1",
 *   sessionId: "qa-2026-07-30-091500",
 *   sourceVideo: O.some("video/capture.webm"),
 *   toolVersions: {}
 * })
 * console.log(provenance.sessionId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureProvenance extends S.Class<CaptureProvenance>($I`CaptureProvenance`)(
  {
    actionSeq: S.OptionFromOptionalKey(SequenceNumber).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureProvenance.actionSeq", {
        description: "Witness sequence number the artifact was extracted for, when event-scoped.",
      })
    ),
    capturedAtEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CaptureProvenance.capturedAtEpochMs", {
        description: "Wall-clock capture timestamp in epoch milliseconds.",
      })
    ),
    clockOffsetMs: S.Finite.pipe(
      $I.annoteKey("CaptureProvenance.clockOffsetMs", {
        description: "Clock synchronization offset applied during extraction.",
      })
    ),
    commitSha: S.String.pipe(
      $I.annoteKey("CaptureProvenance.commitSha", {
        description: "Git commit SHA the capture ran against.",
      })
    ),
    scenarioName: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureProvenance.scenarioName", {
        description: "Scenario name driven during the session, when scripted.",
      })
    ),
    schemaVersion: S.Literal("beep.qa.provenance.v1").pipe(
      $I.annoteKey("CaptureProvenance.schemaVersion", {
        description: "Provenance schema version literal.",
      })
    ),
    sessionId: SessionId.pipe(
      $I.annoteKey("CaptureProvenance.sessionId", {
        description: "Capture session the artifact belongs to.",
      })
    ),
    sourceVideo: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureProvenance.sourceVideo", {
        description: "Round-relative source video path, when derived from a recording.",
      })
    ),
    toolVersions: ToolVersions.pipe(
      $I.annoteKey("CaptureProvenance.toolVersions", {
        description: "Tool versions captured for reproducibility.",
      })
    ),
  },
  $I.annote("CaptureProvenance", {
    description: "Provenance payload embedded into every committed artifact.",
  })
) {}

/**
 * One committed artifact of a capture round.
 *
 * **Example** (Make gif artifact)
 *
 * ```ts
 * import { CaptureArtifact } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const artifact = CaptureArtifact.make({
 *   eventSeqs: [4, 9],
 *   fileSizeBytes: O.some(84213),
 *   kind: "gif",
 *   relativePath: "clips/sash-drag.gif"
 * })
 * console.log(artifact.relativePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureArtifact extends S.Class<CaptureArtifact>($I`CaptureArtifact`)(
  {
    eventSeqs: S.Array(SequenceNumber).pipe(
      $I.annoteKey("CaptureArtifact.eventSeqs", {
        description: "Witness sequence numbers the artifact gives evidence for.",
      })
    ),
    fileSizeBytes: S.OptionFromOptionalKey(
      S.Int.check(
        S.isGreaterThanOrEqualTo(0, {
          identifier: $I`CaptureArtifactFileSizeMinimumCheck`,
          title: "Capture Artifact File Size Minimum",
          description: "Artifact file sizes are zero or greater.",
          message: "Expected a non-negative file size",
        })
      )
    ).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureArtifact.fileSizeBytes", {
        description: "Committed file size in bytes, when measured.",
      })
    ),
    kind: CaptureArtifactKind.pipe(
      $I.annoteKey("CaptureArtifact.kind", {
        description: "Artifact kind.",
      })
    ),
    relativePath: S.String.pipe(
      $I.annoteKey("CaptureArtifact.relativePath", {
        description: "Path relative to the round directory.",
      })
    ),
  },
  $I.annote("CaptureArtifact", {
    description: "One committed artifact of a capture round.",
  })
) {}

/**
 * Canonical `session.json` payload for one capture round.
 *
 * **Example** (Make session manifest)
 *
 * ```ts
 * import { CaptureSession, SessionManifest, Viewport } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const manifest = SessionManifest.make({
 *   artifacts: [],
 *   clockSync: O.none(),
 *   eventsPath: "events.ndjson",
 *   legacyManifestPath: O.none(),
 *   schemaVersion: "beep.qa.capture-session.v1",
 *   session: CaptureSession.make({
 *     commitDirty: false,
 *     commitSha: "f9b8aaac15",
 *     id: "qa-2026-07-30-091500",
 *     lane: "playwright",
 *     round: 1,
 *     scenario: O.none(),
 *     startedAtEpochMs: 1753838000000,
 *     toolVersions: {},
 *     url: "http://storybook.beep.localhost:1355",
 *     viewport: Viewport.make({ height: 800, width: 1280 })
 *   }),
 *   videoPath: O.some("video/capture.webm")
 * })
 * console.log(manifest.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionManifest extends S.Class<SessionManifest>($I`SessionManifest`)(
  {
    artifacts: S.Array(CaptureArtifact).pipe(
      $I.annoteKey("SessionManifest.artifacts", {
        description: "Artifacts committed for the round.",
      })
    ),
    clockSync: S.OptionFromOptionalKey(ClockSync).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("SessionManifest.clockSync", {
        description: "Clock synchronization derived for the round, once correlated.",
      })
    ),
    eventsPath: S.String.pipe(
      $I.annoteKey("SessionManifest.eventsPath", {
        description: "Round-relative path of the witness events NDJSON log.",
      })
    ),
    legacyManifestPath: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("SessionManifest.legacyManifestPath", {
        description: "Round-relative path of the legacy screenshot manifest for judge compatibility.",
      })
    ),
    schemaVersion: S.Literal("beep.qa.capture-session.v1").pipe(
      $I.annoteKey("SessionManifest.schemaVersion", {
        description: "Session manifest schema version literal.",
      })
    ),
    session: CaptureSession.pipe(
      $I.annoteKey("SessionManifest.session", {
        description: "Capture session identity and environment.",
      })
    ),
    videoPath: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("SessionManifest.videoPath", {
        description: "Round-relative recorded video path, once committed.",
      })
    ),
  },
  $I.annote("SessionManifest", {
    description: "Canonical session.json payload for one capture round.",
  })
) {}

/**
 * Runtime discovery handle written to `.beep/qa/current.json` while a
 * collector is live, letting `beep qa stop` / `beep qa mark` find it.
 *
 * **Example** (Make collector handle)
 *
 * ```ts
 * import { CollectorHandle } from "@beep/qa-capture"
 * const handle = CollectorHandle.make({
 *   eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *   pid: 4242,
 *   port: 43117,
 *   round: 1,
 *   sessionDir: "/repo/.beep/qa/round-1",
 *   sessionId: "qa-2026-07-30-091500",
 *   startedAtEpochMs: 1753838000000
 * })
 * console.log(handle.port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CollectorHandle extends S.Class<CollectorHandle>($I`CollectorHandle`)(
  {
    eventsPath: S.String.pipe(
      $I.annoteKey("CollectorHandle.eventsPath", {
        description: "Absolute path of the events NDJSON log being appended.",
      })
    ),
    pid: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`CollectorHandlePidMinimumCheck`,
        title: "Collector Handle Pid Minimum",
        description: "Process identifiers are positive integers.",
        message: "Expected a positive process identifier",
      })
    ).pipe(
      $I.annoteKey("CollectorHandle.pid", {
        description: "Process id owning the live collector.",
      })
    ),
    port: CollectorPort.pipe(
      $I.annoteKey("CollectorHandle.port", {
        description: "Loopback TCP port the collector is bound to.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("CollectorHandle.round", {
        description: "QA round number being recorded.",
      })
    ),
    sessionDir: S.String.pipe(
      $I.annoteKey("CollectorHandle.sessionDir", {
        description: "Absolute path of the round directory.",
      })
    ),
    sessionId: SessionId.pipe(
      $I.annoteKey("CollectorHandle.sessionId", {
        description: "Capture session identifier.",
      })
    ),
    startedAtEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CollectorHandle.startedAtEpochMs", {
        description: "Collector start wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("CollectorHandle", {
    description: "Runtime discovery handle for a live collector.",
  })
) {}

/**
 * Decode an unknown value into a {@link SessionManifest}.
 *
 * **Example** (Decode unknown to manifest)
 *
 * ```ts
 * import { decodeSessionManifest } from "@beep/qa-capture"
 * const effect = decodeSessionManifest({})
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSessionManifest = S.decodeUnknownEffect(SessionManifest);

/**
 * Decode a JSON string into a {@link SessionManifest}.
 *
 * **Example** (Decode JSON to manifest)
 *
 * ```ts
 * import { decodeSessionManifestJson } from "@beep/qa-capture"
 * const effect = decodeSessionManifestJson("{}")
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSessionManifestJson = S.decodeUnknownEffect(S.fromJsonString(SessionManifest));

/**
 * Encode a {@link SessionManifest} into its JSON string representation.
 *
 * **Example** (Encode manifest to JSON)
 *
 * ```ts
 * import { encodeSessionManifestJson } from "@beep/qa-capture"
 * import type { SessionManifest } from "@beep/qa-capture"
 * const encode = (manifest: SessionManifest) => encodeSessionManifestJson(manifest)
 * console.log(encode)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeSessionManifestJson = S.encodeEffect(S.fromJsonString(SessionManifest));

/**
 * Decode a JSON string into a {@link CollectorHandle}.
 *
 * **Example** (Decode JSON to handle)
 *
 * ```ts
 * import { decodeCollectorHandleJson } from "@beep/qa-capture"
 * const effect = decodeCollectorHandleJson("{}")
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCollectorHandleJson = S.decodeUnknownEffect(S.fromJsonString(CollectorHandle));

/**
 * Encode a {@link CollectorHandle} into its JSON string representation.
 *
 * **Example** (Encode handle to JSON)
 *
 * ```ts
 * import { encodeCollectorHandleJson } from "@beep/qa-capture"
 * import type { CollectorHandle } from "@beep/qa-capture"
 * const encode = (handle: CollectorHandle) => encodeCollectorHandleJson(handle)
 * console.log(encode)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeCollectorHandleJson = S.encodeEffect(S.fromJsonString(CollectorHandle));

/**
 * Decode an unknown value into a {@link CaptureProvenance}.
 *
 * **Example** (Decode unknown provenance)
 *
 * ```ts
 * import { decodeCaptureProvenance } from "@beep/qa-capture"
 * const effect = decodeCaptureProvenance({})
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCaptureProvenance = S.decodeUnknownEffect(CaptureProvenance);
