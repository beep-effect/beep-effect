import {
  ExtractClipRequest,
  ExtractClipResult,
  FFmpeg,
  FFmpegError,
  LuminanceSample,
  ProbeRegionLuminanceRequest,
  ProbeRegionLuminanceResult,
} from "@beep/ffmpeg";
import {
  BeaconEdge,
  BeaconEvent,
  ClockCorrelator,
  CorrelateClockRequest,
  detectBeaconEdges,
  fitBeaconClockSync,
} from "@beep/qa-capture";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Context, Effect, Layer, pipe } from "effect";
import type { FFmpegShape } from "@beep/ffmpeg";

const T0 = 1753838000000;
const FLIP_INTERVAL_MS = 150;
const FIRST_FLIP_OFFSET_MS = 500;

const makeFlips = (paintJitterMs = 0): ReadonlyArray<BeaconEvent> =>
  A.makeBy(8, (flipIndex) =>
    BeaconEvent.make({
      flipIndex,
      isWhite: flipIndex % 2 === 0,
      kind: "beacon",
      seq: flipIndex + 1,
      tEpochMs: T0 + FIRST_FLIP_OFFSET_MS + flipIndex * FLIP_INTERVAL_MS,
      tPaintEpochMs: T0 + FIRST_FLIP_OFFSET_MS + flipIndex * FLIP_INTERVAL_MS + paintJitterMs,
    })
  );

// Video timeline starts exactly at T0: white iff the last flip at or before t
// had an even index.
const lumaAtSeconds = (timeSeconds: number): number => {
  const sinceFirstFlipMs = timeSeconds * 1000 - FIRST_FLIP_OFFSET_MS;
  if (sinceFirstFlipMs < 0) {
    return 16;
  }
  const flipIndex = Math.min(7, Math.floor(sinceFirstFlipMs / FLIP_INTERVAL_MS));
  return flipIndex % 2 === 0 ? 235 : 16;
};

const syntheticSamples = (fps: number, durationSeconds: number): ReadonlyArray<LuminanceSample> =>
  A.makeBy(Math.floor(durationSeconds * fps), (frameIndex) =>
    LuminanceSample.make({
      frameIndex,
      meanLuma: lumaAtSeconds(frameIndex / fps),
      ptsTimeSeconds: frameIndex / fps,
    })
  );

const notCalled = (operation: string) =>
  Effect.fnUntraced(function* () {
    return yield* Effect.die(`FFmpeg.${operation} must not be called by this correlator scenario`);
  });

const stubFfmpeg = (overrides: Partial<FFmpegShape>): Layer.Layer<FFmpeg> =>
  Layer.succeed(FFmpeg)(
    FFmpeg.of({
      extractClip: notCalled("extractClip"),
      extractFrameAt: notCalled("extractFrameAt"),
      extractFrames: notCalled("extractFrames"),
      extractFramesAt: notCalled("extractFramesAt"),
      probeRegionLuminance: notCalled("probeRegionLuminance"),
      probeVideo: notCalled("probeVideo"),
      renderContactSheet: notCalled("renderContactSheet"),
      renderGif: notCalled("renderGif"),
      writeContainerMetadata: notCalled("writeContainerMetadata"),
      ...overrides,
    })
  );

const beaconCapableFfmpeg = stubFfmpeg({
  extractClip: Effect.fnUntraced(function* (request: ExtractClipRequest) {
    return ExtractClipResult.make({
      durationSeconds: request.durationSeconds,
      fileSizeBytes: 1024,
      outPath: request.outPath,
      startSeconds: request.startSeconds,
      videoPath: request.videoPath,
    });
  }),
  probeRegionLuminance: Effect.fnUntraced(function* (request: ProbeRegionLuminanceRequest) {
    return ProbeRegionLuminanceResult.make({
      samples: syntheticSamples(30, 2.2),
      videoPath: request.videoPath,
    });
  }),
});
class ProbeCalls extends Context.Service<
  ProbeCalls,
  { readonly clips: Array<ExtractClipRequest>; readonly probes: Array<ProbeRegionLuminanceRequest> }
>()("@beep/qa-capture/test/ClockCorrelator.test/ProbeCalls") {}
const DelayedBeaconTestLayer = Layer.suspend(() => {
  const clips: Array<ExtractClipRequest> = [];
  const probes: Array<ProbeRegionLuminanceRequest> = [];
  const ffmpeg = stubFfmpeg({
    extractClip: Effect.fnUntraced(function* (request: ExtractClipRequest) {
      clips[A.length(clips)] = request;
      return ExtractClipResult.make({
        durationSeconds: request.durationSeconds,
        fileSizeBytes: 1024,
        outPath: request.outPath,
        startSeconds: request.startSeconds,
        videoPath: request.videoPath,
      });
    }),
    probeRegionLuminance: Effect.fnUntraced(function* (request: ProbeRegionLuminanceRequest) {
      probes[A.length(probes)] = request;
      const clip = O.getOrThrow(A.last(clips));
      const samples = A.makeBy(Math.floor(O.getOrThrow(clip.durationSeconds) * 30), (frameIndex) =>
        LuminanceSample.make({
          frameIndex,
          meanLuma: lumaAtSeconds(frameIndex / 30 + clip.startSeconds - 4),
          ptsTimeSeconds: frameIndex / 30,
        })
      );
      expect(A.length(detectBeaconEdges(samples))).toBe(8);
      return ProbeRegionLuminanceResult.make({ samples, videoPath: request.videoPath });
    }),
  });
  return Layer.merge(Layer.succeed(ProbeCalls, { clips, probes }), ClockCorrelator.layer.pipe(Layer.provide(ffmpeg)));
});

const failingClipFfmpeg = stubFfmpeg({
  extractClip: Effect.fnUntraced(function* () {
    return yield* FFmpegError.make({ message: "boom", operation: "extractClip" });
  }),
});

describe("@beep/qa-capture clock correlator", () => {
  it("detects edges from a clean square wave", () => {
    const edges = detectBeaconEdges(syntheticSamples(30, 2.2));
    expect(A.length(edges)).toBe(8);
    expect(edges[0]?.toWhite).toBe(true);
  });

  it("refuses low-contrast regions", () => {
    const flat = A.makeBy(60, (frameIndex) =>
      LuminanceSample.make({ frameIndex, meanLuma: 100 + (frameIndex % 5), ptsTimeSeconds: frameIndex / 30 })
    );
    expect(A.length(detectBeaconEdges(flat))).toBe(0);
  });

  it("fits a perfect offset with zero residual and high confidence", () => {
    const flips = makeFlips();
    const edges = A.map(flips, (flip) =>
      BeaconEdge.make({ timeSeconds: (flip.tPaintEpochMs - T0) / 1000, toWhite: flip.isWhite })
    );
    const sync = fitBeaconClockSync(edges, flips);
    pipe(sync, O.isSome, assertTrue);
    O.match(sync, {
      onNone: () => undefined,
      onSome: (fit) => {
        expect(fit.method).toBe("beacon");
        expect(fit.confidence).toBe("high");
        expect(fit.slope).toBe(1);
        expect(Math.abs(fit.offsetMs + T0)).toBeLessThan(0.001);
        expect(fit.residualRmsMs).toBeLessThan(0.001);
        return undefined;
      },
    });
  });

  it("skips a leading spurious edge to align flip directions", () => {
    const flips = makeFlips();
    const aligned = A.map(flips, (flip) =>
      BeaconEdge.make({ timeSeconds: (flip.tPaintEpochMs - T0) / 1000, toWhite: flip.isWhite })
    );
    const edges = [BeaconEdge.make({ timeSeconds: 0.1, toWhite: false }), ...aligned];
    const sync = fitBeaconClockSync(edges, flips);
    pipe(sync, O.isSome, assertTrue);
    O.match(sync, {
      onNone: () => undefined,
      onSome: (fit) => {
        expect(Math.abs(fit.offsetMs + T0)).toBeLessThan(0.001);
        return undefined;
      },
    });
  });

  it("returns none below the minimum pair count", () => {
    const flips = A.take(makeFlips(), 2);
    const edges = A.map(flips, (flip) =>
      BeaconEdge.make({ timeSeconds: (flip.tPaintEpochMs - T0) / 1000, toWhite: flip.isWhite })
    );
    assertNone(fitBeaconClockSync(edges, flips));
  });

  it.layer(ClockCorrelator.layer.pipe(Layer.provide(beaconCapableFfmpeg)))(
    "correlates via the beacon when flips and video agree",
    (it) => {
      it.effect("correlates via the beacon when flips and video agree", () =>
        Effect.gen(function* () {
          const correlator = yield* ClockCorrelator;
          const sync = yield* correlator.correlate(
            CorrelateClockRequest.make({
              assumedStartEpochMs: T0,
              beaconEvents: makeFlips(),
              recordStartEpochMs: O.none(),
              videoPath: "/round/video/capture.webm",
              workDir: "/round/clips",
            })
          );
          expect(sync.method).toBe("beacon");
          expect(sync.confidence).toBe("high");
          // Frame quantization delays each detected edge by up to one frame
          // (33.3 ms at 30 fps); the mean shift survives in the offset.
          expect(Math.abs(sync.offsetMs + T0)).toBeLessThan(40);
          expect(sync.residualRmsMs).toBeLessThanOrEqual(25);
        })
      );
    }
  );

  it.layer(ClockCorrelator.layer.pipe(Layer.provide(stubFfmpeg({}))))(
    "degrades to the OBS record-state anchor without beacon flips",
    (it) => {
      it.effect("degrades to the OBS record-state anchor without beacon flips", () =>
        Effect.gen(function* () {
          const correlator = yield* ClockCorrelator;
          const sync = yield* correlator.correlate(
            CorrelateClockRequest.make({
              assumedStartEpochMs: T0,
              beaconEvents: [],
              recordStartEpochMs: O.some(T0 + 120),
              videoPath: "/round/video/capture.mkv",
              workDir: "/round/clips",
            })
          );
          expect(sync.method).toBe("obs-record-state");
          expect(sync.confidence).toBe("medium");
          expect(sync.offsetMs).toBe(-(T0 + 120));
        })
      );
    }
  );

  it.layer(ClockCorrelator.layer.pipe(Layer.provide(stubFfmpeg({}))))(
    "always produces an assumed-start sync as the last resort",
    (it) => {
      it.effect("always produces an assumed-start sync as the last resort", () =>
        Effect.gen(function* () {
          const correlator = yield* ClockCorrelator;
          const sync = yield* correlator.correlate(
            CorrelateClockRequest.make({
              assumedStartEpochMs: T0,
              beaconEvents: [],
              recordStartEpochMs: O.none(),
              videoPath: "/round/video/capture.webm",
              workDir: "/round/clips",
            })
          );
          expect(sync.method).toBe("assumed-start");
          expect(sync.confidence).toBe("low");
          expect(sync.offsetMs).toBe(-T0);
        })
      );
    }
  );

  it.layer(ClockCorrelator.layer.pipe(Layer.provide(failingClipFfmpeg)))(
    "degrades instead of failing when ffmpeg errors during the beacon fit",
    (it) => {
      it.effect("degrades instead of failing when ffmpeg errors during the beacon fit", () =>
        Effect.gen(function* () {
          const correlator = yield* ClockCorrelator;
          const sync = yield* correlator.correlate(
            CorrelateClockRequest.make({
              assumedStartEpochMs: T0,
              beaconEvents: makeFlips(),
              recordStartEpochMs: O.none(),
              videoPath: "/round/video/capture.webm",
              workDir: "/round/clips",
            })
          );
          expect(sync.method).toBe("assumed-start");
          expect(sync.confidence).toBe("low");
        })
      );
    }
  );
});
it.layer(DelayedBeaconTestLayer)("delayed first paint and probe ownership", (it) => {
  it.effect(
    "probes the requested clip and configured region after a delayed first paint",
    Effect.fnUntraced(function* () {
      const correlator = yield* ClockCorrelator;
      const calls = yield* ProbeCalls;
      const sync = yield* correlator.correlate(
        CorrelateClockRequest.make({
          assumedStartEpochMs: T0,
          beaconEvents: makeFlips(4000),
          beaconRegionSize: 96,
          probePadSeconds: 0.5,
          recordStartEpochMs: O.none(),
          videoPath: "/delayed/recording.webm",
          workDir: "/delayed/clips",
        })
      );
      expect(calls.clips).toEqual([
        ExtractClipRequest.make({
          codec: "h264",
          durationSeconds: O.some(2.05),
          outPath: "/delayed/clips/beacon-probe.mp4",
          overwrite: true,
          startSeconds: 4,
          videoPath: "/delayed/recording.webm",
        }),
      ]);
      expect(calls.probes).toEqual([
        ProbeRegionLuminanceRequest.make({
          height: 96,
          width: 96,
          x: 0,
          y: 0,
          videoPath: "/delayed/clips/beacon-probe.mp4",
        }),
      ]);
      expect(sync.method).toBe("beacon");
      expect(sync.confidence).toBe("high");
      expect(Math.abs(sync.offsetMs + T0)).toBeLessThan(40);
      expect(sync.residualRmsMs).toBeLessThanOrEqual(25);
    })
  );
});
