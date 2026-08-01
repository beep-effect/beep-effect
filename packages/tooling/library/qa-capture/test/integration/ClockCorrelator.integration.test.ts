import { FFmpeg } from "@beep/ffmpeg";
import { BeaconEvent, ClockCorrelator, CorrelateClockRequest } from "@beep/qa-capture";
import { A, thunkEmptyStr } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

// Live lane: exercises the real ffmpeg binary on PATH. Skips cleanly
// (logInfo, no assertions) on machines without ffmpeg.
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideLive = provideScopedLayer(
  Layer.mergeAll(
    NodeServices.layer,
    ClockCorrelator.layer.pipe(Layer.provide(FFmpeg.makeLayer().pipe(Layer.provide(NodeServices.layer))))
  )
);

const skipNotice = Effect.logInfo("Skipping the live clock correlator lane because ffmpeg is not runnable on PATH.");

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
  );

const runTool = (command: string, args: ReadonlyArray<string>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdin: "ignore", stderr: "pipe", stdout: "pipe" })
      );
      const [stderr, exitCode] = yield* Effect.all([collectText(handle.stderr), handle.exitCode], {
        concurrency: "unbounded",
      });
      return { exitCode, stderr };
    })
  );

const ffmpegAvailable = runTool("ffmpeg", ["-version"]).pipe(
  Effect.map((result) => result.exitCode === 0),
  Effect.orElseSucceed(() => false)
);

const T0 = 1753838000000;
const FIRST_FLIP_OFFSET_MS = 500;
const FLIP_INTERVAL_MS = 150;

/**
 * 3s 320x240 30fps black clip whose 160x160 top-left corner flashes white in
 * exactly the witness beacon cadence: white during the first 150 ms of each
 * 300 ms cycle starting at t=0.5s, ending at t=1.7s — eight state flips.
 */
const makeBeaconClip = Effect.fnUntraced(function* (outPath: string) {
  const result = yield* runTool("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=black:size=320x240:rate=30:duration=3",
    "-vf",
    "drawbox=x=0:y=0:w=160:h=160:color=white:t=fill:enable='gte(t,0.5)*lt(t,1.7)*lt(mod(t-0.5,0.3),0.15)'",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]);
  expect(result.exitCode).toBe(0);
});

const makeFlips = (): ReadonlyArray<BeaconEvent> =>
  A.makeBy(8, (flipIndex) =>
    BeaconEvent.make({
      flipIndex,
      isWhite: flipIndex % 2 === 0,
      kind: "beacon",
      seq: flipIndex + 1,
      tEpochMs: T0 + FIRST_FLIP_OFFSET_MS + flipIndex * FLIP_INTERVAL_MS,
      tPaintEpochMs: T0 + FIRST_FLIP_OFFSET_MS + flipIndex * FLIP_INTERVAL_MS,
    })
  );

describe("@beep/qa-capture live clock correlator", () => {
  it.live(
    "recovers the wall-clock offset from a synthesized beacon video",
    () =>
      Effect.gen(function* () {
        if (!(yield* ffmpegAvailable)) {
          return yield* skipNotice;
        }

        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const videoPath = path.join(tmpDir, "beacon.mp4");
        yield* makeBeaconClip(videoPath);

        const correlator = yield* ClockCorrelator;
        const sync = yield* correlator.correlate(
          CorrelateClockRequest.make({
            assumedStartEpochMs: T0,
            beaconEvents: makeFlips(),
            recordStartEpochMs: O.none(),
            videoPath,
            workDir: tmpDir,
          })
        );

        expect(sync.method).toBe("beacon");
        expect(sync.slope).toBe(1);
        // The video timeline starts exactly at T0; frame quantization at
        // 30 fps plus the h264 normalization bound the recovered offset.
        expect(Math.abs(sync.offsetMs + T0)).toBeLessThan(80);
        expect(sync.residualRmsMs).toBeLessThan(80);
        expect(sync.confidence === "high" || sync.confidence === "medium").toBe(true);

        yield* fs.remove(tmpDir, { force: true, recursive: true });
      }).pipe(provideLive),
    120000
  );
});
