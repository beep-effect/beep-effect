import {
  ExtractFrameAtRequest,
  ExtractFramesAtRequest,
  ExtractFramesRequest,
  FFmpeg,
  FFmpegError,
  MetadataPair,
  ProbeVideoRequest,
  RenderGifRequest,
  WriteContainerMetadataRequest,
} from "@beep/ffmpeg";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  ExtractFramesAtResult,
  ExtractFramesResult,
  FFmpegEvent,
  FFmpegEventSink,
  FFmpegShape,
  RenderGifResult,
  TimestampedFrame,
  VideoProbe,
  WriteContainerMetadataResult,
} from "@beep/ffmpeg";
import type { Effect, FileSystem, Layer, Path } from "effect";

declare const service: FFmpegShape;
declare const sink: FFmpegEventSink;

describe("@beep/ffmpeg", () => {
  it("exports typed errors and the service layer", () => {
    expect(FFmpegError.make({ message: "boom", operation: "extractFrames" })).type.toBe<FFmpegError>();
    expect(FFmpegError.fromUnknown("probeVideo", "boom", { cause: new Error("nope") })).type.toBe<FFmpegError>();
    expect(FFmpeg.makeLayer()).type.toBe<
      Layer.Layer<
        FFmpeg,
        never,
        FileSystem.FileSystem | Path.Path | import("effect/unstable/process").ChildProcessSpawner.ChildProcessSpawner
      >
    >();
  });

  it("exports request, result, and event types", () => {
    const request = ExtractFramesRequest.make({
      fps: 1,
      manifestPath: O.none(),
      outDir: "./frames",
      overwrite: false,
      prefix: O.none(),
      videoPath: "./clip.mp4",
    });

    expect(service.probeVideo(ProbeVideoRequest.make({ videoPath: "./clip.mp4" }))).type.toBe<
      Effect.Effect<VideoProbe, FFmpegError>
    >();
    expect(service.extractFrames(request, sink)).type.toBe<Effect.Effect<ExtractFramesResult, FFmpegError>>();
    expect<FFmpegEvent["kind"]>().type.toBe<"completed" | "progress" | "started">();
  });

  it("exports capture request, result, and service method types", () => {
    expect(
      service.extractFrameAt(
        ExtractFrameAtRequest.make({
          outPath: "./frames/frame.png",
          overwrite: false,
          timestampSeconds: 1.25,
          videoPath: "./capture.webm",
        })
      )
    ).type.toBe<Effect.Effect<TimestampedFrame, FFmpegError>>();
    expect(
      service.extractFramesAt(
        ExtractFramesAtRequest.make({
          manifestPath: O.none(),
          outDir: "./frames",
          overwrite: false,
          prefix: O.none(),
          timestampsSeconds: [0.5, 1.25],
          videoPath: "./capture.webm",
        })
      )
    ).type.toBe<Effect.Effect<ExtractFramesAtResult, FFmpegError>>();
    expect(
      service.renderGif(
        RenderGifRequest.make({
          dither: "bayer",
          durationSeconds: 2,
          fps: 10,
          outPath: "./clips/drag.gif",
          overwrite: false,
          startSeconds: 1.5,
          videoPath: "./capture.webm",
          width: 640,
        })
      )
    ).type.toBe<Effect.Effect<RenderGifResult, FFmpegError>>();
    expect(
      service.writeContainerMetadata(
        WriteContainerMetadataRequest.make({
          metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
          outPath: "./tagged/capture.webm",
          overwrite: false,
          videoPath: "./capture.webm",
        })
      )
    ).type.toBe<Effect.Effect<WriteContainerMetadataResult, FFmpegError>>();
  });
});
