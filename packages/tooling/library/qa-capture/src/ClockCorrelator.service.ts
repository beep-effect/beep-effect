/**
 * Clock correlation: maps witness wall-clock time onto the video timeline.
 *
 * Preference order: visual sync-beacon fit (confidence high/medium), OBS
 * record-state anchor (medium), assumed-start hint (low). Correlation is
 * total — every failure degrades to the next method and the service always
 * produces a {@link ClockSync}, never aborting extraction.
 *
 * Beacon detection rides the `@beep/ffmpeg` `probeRegionLuminance` op
 * (crop + signalstats), so no dependency-free PNG luma reader is needed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractClipRequest, FFmpeg, ProbeRegionLuminanceRequest } from "@beep/ffmpeg";
import { $QaCaptureId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Context, Effect, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { BeaconEvent, EpochMilliseconds } from "./ActionEvent.models.ts";
import { ClockSync } from "./QaCapture.models.ts";
import type { LuminanceSample } from "@beep/ffmpeg";

const $I = $QaCaptureId.create("ClockCorrelator.service");

/**
 * Minimum corner-region luma contrast required to trust beacon detection.
 *
 * @example
 * ```ts
 * import { BEACON_MIN_CONTRAST } from "@beep/qa-capture"
 * console.log(BEACON_MIN_CONTRAST)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const BEACON_MIN_CONTRAST = 64;

/**
 * Residual RMS (milliseconds) at or under which a beacon fit is `high`
 * confidence.
 *
 * @example
 * ```ts
 * import { BEACON_HIGH_CONFIDENCE_RMS_MS } from "@beep/qa-capture"
 * console.log(BEACON_HIGH_CONFIDENCE_RMS_MS)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const BEACON_HIGH_CONFIDENCE_RMS_MS = 25;

const BEACON_MEDIUM_CONFIDENCE_RMS_MS = 80;
const BEACON_MIN_PAIRS = 3;
const BEACON_HIGH_MIN_PAIRS = 4;

/**
 * One luma transition detected in the beacon corner region.
 *
 * @example
 * ```ts
 * import { BeaconEdge } from "@beep/qa-capture"
 * const edge = BeaconEdge.make({ timeSeconds: 0.433, toWhite: true })
 * console.log(edge)
 * ```
 * @category models
 * @since 0.0.0
 */
export class BeaconEdge extends S.Class<BeaconEdge>($I`BeaconEdge`)(
  {
    timeSeconds: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`BeaconEdgeTimeMinimumCheck`,
        title: "Beacon Edge Time Minimum",
        description: "Edge times are zero or greater.",
        message: "Expected a non-negative edge time",
      })
    ).pipe(
      $I.annoteKey("BeaconEdge.timeSeconds", {
        description: "Video-timeline moment the corner region changed state, in seconds.",
      })
    ),
    toWhite: S.Boolean.pipe(
      $I.annoteKey("BeaconEdge.toWhite", {
        description: "Whether the region transitioned to white.",
      })
    ),
  },
  $I.annote("BeaconEdge", {
    description: "One luma transition detected in the beacon corner region.",
  })
) {}

/**
 * Detect beacon flips from per-frame corner-region luma samples.
 *
 * Applies a contrast gate (`max - min` must reach the threshold), binarizes
 * around the midpoint, and reports the frame times where the binary state
 * changes.
 *
 * @param samples - Per-frame corner-region luma samples, in frame order.
 * @param minContrast - Minimum luma spread the samples must show before any edge is reported.
 * @returns Frame times where the beacon changed state, in ascending order.
 * @example
 * ```ts
 * import { LuminanceSample } from "@beep/ffmpeg"
 * import { detectBeaconEdges } from "@beep/qa-capture"
 * const edges = detectBeaconEdges([
 *   LuminanceSample.make({ frameIndex: 0, meanLuma: 16, ptsTimeSeconds: 0 }),
 *   LuminanceSample.make({ frameIndex: 1, meanLuma: 235, ptsTimeSeconds: 0.033 })
 * ])
 * console.log(edges.length)
 * ```
 * @category correlation
 * @since 0.0.0
 */
export const detectBeaconEdges = (
  samples: ReadonlyArray<LuminanceSample>,
  minContrast: number = BEACON_MIN_CONTRAST
): ReadonlyArray<BeaconEdge> => {
  if (A.length(samples) < 2) {
    return [];
  }
  const lumas = A.map(samples, (sample) => sample.meanLuma);
  const min = Math.min(...lumas);
  const max = Math.max(...lumas);
  if (max - min < minContrast) {
    return [];
  }
  const midpoint = (max + min) / 2;
  const binary = A.map(lumas, (luma) => luma >= midpoint);
  const edges: Array<BeaconEdge> = [];
  A.forEach(samples, (sample, index) => {
    const previous = index === 0 ? O.none() : O.fromUndefinedOr(binary[index - 1]);
    const current = binary[index] === true;
    O.match(previous, {
      onNone: () => undefined,
      onSome: (before) => {
        if (before !== current) {
          edges[A.length(edges)] = BeaconEdge.make({ timeSeconds: sample.ptsTimeSeconds, toWhite: current });
        }
        return undefined;
      },
    });
  });
  return edges;
};

const byPaintTime = Order.mapInput(Order.Number, (event: BeaconEvent) => event.tPaintEpochMs);
const byEdgeTime = Order.mapInput(Order.Number, (edge: BeaconEdge) => edge.timeSeconds);

/**
 * Least-squares fit of a slope-1.0 clock offset from detected beacon edges
 * and witness beacon flip events.
 *
 * Pairs edges to flips in order after aligning on the first
 * direction-matching edge; drops trailing direction mismatches. Returns
 * `none` when fewer than three consistent pairs remain.
 *
 * @example
 * ```ts
 * import { BeaconEdge, fitBeaconClockSync } from "@beep/qa-capture"
 * const sync = fitBeaconClockSync([BeaconEdge.make({ timeSeconds: 0.4, toWhite: true })], [])
 * console.log(sync)
 * ```
 * @category correlation
 * @since 0.0.0
 */
export const fitBeaconClockSync: {
  (flips: ReadonlyArray<BeaconEvent>): (edges: ReadonlyArray<BeaconEdge>) => O.Option<ClockSync>;
  (edges: ReadonlyArray<BeaconEdge>, flips: ReadonlyArray<BeaconEvent>): O.Option<ClockSync>;
} = dual(2, (edges: ReadonlyArray<BeaconEdge>, flips: ReadonlyArray<BeaconEvent>): O.Option<ClockSync> => {
  const sortedFlips = A.sort(flips, byPaintTime);
  const sortedEdges = A.sort(edges, byEdgeTime);
  const firstFlip = A.head(sortedFlips);
  return O.flatMap(firstFlip, (flip) => {
    const alignedStart = A.findFirstIndex(sortedEdges, (edge) => edge.toWhite === flip.isWhite);
    return O.flatMap(alignedStart, (startIndex) => {
      const aligned = A.drop(sortedEdges, startIndex);
      const pairs = pipe(
        A.zip(aligned, sortedFlips),
        A.filter(([edge, event]) => edge.toWhite === event.isWhite)
      );
      if (A.length(pairs) < BEACON_MIN_PAIRS) {
        return O.none();
      }
      const residualsBase = A.map(pairs, ([edge, event]) => edge.timeSeconds * 1000 - event.tPaintEpochMs);
      const offsetMs = A.reduce(residualsBase, 0, (sum, value) => sum + value) / A.length(residualsBase);
      const squared = A.map(residualsBase, (value) => (value - offsetMs) ** 2);
      const residualRmsMs = Math.sqrt(A.reduce(squared, 0, (sum, value) => sum + value) / A.length(squared));
      const confidence =
        residualRmsMs <= BEACON_HIGH_CONFIDENCE_RMS_MS && A.length(pairs) >= BEACON_HIGH_MIN_PAIRS
          ? "high"
          : residualRmsMs <= BEACON_MEDIUM_CONFIDENCE_RMS_MS
            ? "medium"
            : "low";
      return O.some(
        ClockSync.make({
          confidence,
          method: "beacon",
          offsetMs,
          residualRmsMs,
          slope: 1,
        })
      );
    });
  });
});

/**
 * Request accepted by {@link ClockCorrelator} `correlate`.
 *
 * @example
 * ```ts
 * import { CorrelateClockRequest } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const request = CorrelateClockRequest.make({
 *   assumedStartEpochMs: 1753838000000,
 *   beaconEvents: [],
 *   recordStartEpochMs: O.none(),
 *   videoPath: "/round/video/capture.webm",
 *   workDir: "/round/clips"
 * })
 * console.log(request.videoPath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorrelateClockRequest extends S.Class<CorrelateClockRequest>($I`CorrelateClockRequest`)(
  {
    assumedStartEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CorrelateClockRequest.assumedStartEpochMs", {
        description: "Recording-start hint captured just before the context was created.",
      })
    ),
    beaconEvents: S.Array(BeaconEvent).pipe(
      SchemaUtils.withKeyDefaults([]),
      $I.annoteKey("CorrelateClockRequest.beaconEvents", {
        description: "Witness beacon flip events, when a sync beacon ran.",
      })
    ),
    beaconRegionSize: S.Int.check(
      S.isGreaterThanOrEqualTo(16, {
        identifier: $I`CorrelateClockRequestRegionSizeMinimumCheck`,
        title: "Correlate Clock Region Size Minimum",
        description: "Beacon probe regions are at least 16 pixels square.",
        message: "Expected a beacon region of at least 16 pixels",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(128),
      $I.annoteKey("CorrelateClockRequest.beaconRegionSize", {
        description: "Square edge length of the top-left probe region in pixels.",
      })
    ),
    probePadSeconds: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`CorrelateClockRequestProbePadMinimumCheck`,
        title: "Correlate Clock Probe Pad Minimum",
        description: "Probe pads are zero or greater.",
        message: "Expected a non-negative probe pad",
      })
    ).pipe(
      SchemaUtils.withKeyDefaults(2),
      $I.annoteKey("CorrelateClockRequest.probePadSeconds", {
        description: "Seconds of padding around the beacon flip span when cutting the probe clip.",
      })
    ),
    recordStartEpochMs: S.Option(EpochMilliseconds).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<number>())),
      S.withDecodingDefault(Effect.succeed(O.none<number>())),
      $I.annoteKey("CorrelateClockRequest.recordStartEpochMs", {
        description: "OBS RecordStateChanged STARTED receipt time, when Lane B recorded.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("CorrelateClockRequest.videoPath", {
        description: "Recorded video path to correlate against.",
      })
    ),
    workDir: S.String.pipe(
      $I.annoteKey("CorrelateClockRequest.workDir", {
        description: "Writable directory for the normalized beacon probe clip.",
      })
    ),
  },
  $I.annote("CorrelateClockRequest", {
    description: "Request accepted by ClockCorrelator.correlate.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(CorrelateClockRequest);
}

/**
 * Runtime shape exposed by the {@link ClockCorrelator} service.
 *
 * @example
 * ```ts
 * import type { ClockCorrelatorShape } from "@beep/qa-capture"
 * import { Effect } from "effect"
 * const service: ClockCorrelatorShape = { correlate: () => Effect.die("not implemented") }
 * console.log(service)
 * ```
 * @category services
 * @since 0.0.0
 */
export interface ClockCorrelatorShape {
  readonly correlate: (request: CorrelateClockRequest) => Effect.Effect<ClockSync>;
}

const obsRecordStateSync = (recordStartEpochMs: number): ClockSync =>
  ClockSync.make({
    confidence: "medium",
    method: "obs-record-state",
    offsetMs: -recordStartEpochMs,
    residualRmsMs: 0,
    slope: 1,
  });

const assumedStartSync = (assumedStartEpochMs: number): ClockSync =>
  ClockSync.make({
    confidence: "low",
    method: "assumed-start",
    offsetMs: -assumedStartEpochMs,
    residualRmsMs: 0,
    slope: 1,
  });

const makeService = Effect.fnUntraced(function* () {
  const ffmpeg = yield* FFmpeg;

  const probeBeaconWindow = Effect.fn("ClockCorrelator.probeBeaconWindow")(function* (
    request: CorrelateClockRequest,
    flips: ReadonlyArray<BeaconEvent>,
    first: BeaconEvent,
    last: BeaconEvent
  ) {
    // The probe window is derived from the beacon events themselves —
    // never a fixed head window — so a slow first paint cannot push the
    // flips outside the probed clip.
    const clipStartSeconds = Math.max(
      0,
      (first.tPaintEpochMs - request.assumedStartEpochMs) / 1000 - request.probePadSeconds
    );
    const clipDurationSeconds = Math.max(
      1,
      (last.tPaintEpochMs - first.tPaintEpochMs) / 1000 + 2 * request.probePadSeconds
    );
    // Normalizing to h264/mp4 sidesteps keyframe-sparse webm seeking.
    const clip = yield* ffmpeg.extractClip(
      ExtractClipRequest.make({
        codec: "h264",
        durationSeconds: clipDurationSeconds,
        outPath: `${request.workDir}/beacon-probe.mp4`,
        overwrite: true,
        startSeconds: clipStartSeconds,
        videoPath: request.videoPath,
      })
    );
    const probe = yield* ffmpeg.probeRegionLuminance(
      ProbeRegionLuminanceRequest.make({
        height: request.beaconRegionSize,
        videoPath: clip.outPath,
        width: request.beaconRegionSize,
        x: 0,
        y: 0,
      })
    );
    const edges = A.map(detectBeaconEdges(probe.samples), (edge) =>
      BeaconEdge.make({ timeSeconds: edge.timeSeconds + clipStartSeconds, toWhite: edge.toWhite })
    );
    return fitBeaconClockSync(edges, flips);
  });

  const beaconFit = Effect.fn("ClockCorrelator.beaconFit")(function* (request: CorrelateClockRequest) {
    const flips = A.sort(request.beaconEvents, byPaintTime);
    const span = O.all([A.head(flips), A.last(flips)]);
    return yield* O.match(span, {
      onNone: () => Effect.succeed(O.none<ClockSync>()),
      onSome: ([first, last]) => probeBeaconWindow(request, flips, first, last),
    });
  });

  const correlate = Effect.fn("ClockCorrelator.correlate")(function* (request: CorrelateClockRequest) {
    const beacon = yield* beaconFit(request).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("qa clock correlator beacon fit failed; degrading", cause).pipe(
          Effect.as(O.none<ClockSync>())
        )
      )
    );
    return O.getOrElse(beacon, () =>
      O.match(request.recordStartEpochMs, {
        onNone: () => assumedStartSync(request.assumedStartEpochMs),
        onSome: obsRecordStateSync,
      })
    );
  });

  const service: ClockCorrelatorShape = { correlate };
  return service;
});

/**
 * Effect service deriving a {@link ClockSync} for a recorded round.
 *
 * @example
 * ```ts
 * import { ClockCorrelator } from "@beep/qa-capture"
 * const layer = ClockCorrelator.layer
 * console.log(layer)
 * ```
 * @category services
 * @since 0.0.0
 */
export class ClockCorrelator extends Context.Service<ClockCorrelator, ClockCorrelatorShape>()($I`ClockCorrelator`) {
  /**
   * Live correlator layer over the `@beep/ffmpeg` driver.
   *
   * @example
   * ```ts
   * import { ClockCorrelator } from "@beep/qa-capture"
   * const layer = ClockCorrelator.layer
   * console.log(layer)
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<ClockCorrelator, never, FFmpeg> = Layer.effect(
    ClockCorrelator,
    Effect.map(makeService(), ClockCorrelator.of)
  );
}
