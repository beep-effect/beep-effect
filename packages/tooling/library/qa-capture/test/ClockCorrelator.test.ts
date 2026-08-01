import { ExtractClipResult, FFmpeg, FFmpegError, LuminanceSample, ProbeRegionLuminanceResult } from "@beep/ffmpeg";
import {
  BeaconEdge,
  BeaconEvent,
  ClockCorrelator,
  CorrelateClockRequest,
  detectBeaconEdges,
  fitBeaconClockSync,
} from "@beep/qa-capture";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { ExtractClipRequest, FFmpegShape, ProbeRegionLuminanceRequest } from "@beep/ffmpeg";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
    expect(O.isSome(sync)).toBe(true);
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
    expect(O.isSome(sync)).toBe(true);
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
    expect(O.isNone(fitBeaconClockSync(edges, flips))).toBe(true);
  });

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
    }).pipe(provideScopedLayer(ClockCorrelator.layer.pipe(Layer.provide(beaconCapableFfmpeg))))
  );

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
    }).pipe(provideScopedLayer(ClockCorrelator.layer.pipe(Layer.provide(stubFfmpeg({})))))
  );

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
    }).pipe(provideScopedLayer(ClockCorrelator.layer.pipe(Layer.provide(stubFfmpeg({})))))
  );

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
    }).pipe(provideScopedLayer(ClockCorrelator.layer.pipe(Layer.provide(failingClipFfmpeg))))
  );
});
