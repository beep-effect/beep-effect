import {
  buildExtractClipArgs,
  buildExtractFrameAtArgs,
  ExtractClipRequest,
  ExtractFramesAtRequest,
} from "@beep/ffmpeg";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";

describe("@beep/ffmpeg optional clip duration and frame width bounds", () => {
  it("omits -t entirely when no duration is supplied", () => {
    const args = buildExtractClipArgs({
      codec: "h264",
      outputPath: "./clips/full.mp4",
      start: "0",
      videoPath: "./capture.webm",
    });
    expect(A.contains(args, "-t")).toBe(false);
    expect(args).toContain("libx264");
    expect(A.last(args)).toEqual(O.some("./clips/full.mp4"));
  });

  it("emits -t immediately after the input when a duration is supplied", () => {
    const args = buildExtractClipArgs({
      codec: "h264",
      duration: "2",
      outputPath: "./clips/cut.mp4",
      start: "1.5",
      videoPath: "./capture.webm",
    });
    const tIndex = A.findFirstIndex(args, (arg) => arg === "-t");
    expect(tIndex).toEqual(O.some(7));
    expect(args[8]).toBe("2");
  });

  it("defaults ExtractClipRequest.durationSeconds to none so a remux preserves the source span", () => {
    const request = ExtractClipRequest.make({
      outPath: "./video/normalized.mp4",
      startSeconds: 0,
      videoPath: "./video/capture.webm",
    });
    expect(request.durationSeconds).toEqual(O.none());
    expect(request.codec).toBe("h264");
  });

  it("adds a downscale-only filter when maxWidth is supplied", () => {
    const args = buildExtractFrameAtArgs({
      maxWidth: 960,
      outputPath: "./frames/drag-w0-0001.png",
      timestamp: "1.25",
      videoPath: "./capture.webm",
    });
    const vfIndex = A.findFirstIndex(args, (arg) => arg === "-vf");
    expect(O.isSome(vfIndex)).toBe(true);
    expect(args).toContain("scale='min(iw,960)':-2");
  });

  it("emits no filter when maxWidth is absent", () => {
    const args = buildExtractFrameAtArgs({
      outputPath: "./frames/drag-w0-0001.png",
      timestamp: "1.25",
      videoPath: "./capture.webm",
    });
    expect(A.contains(args, "-vf")).toBe(false);
  });

  it("defaults ExtractFramesAtRequest.maxWidth to none", () => {
    const request = ExtractFramesAtRequest.make({
      outDir: "./frames",
      timestampsSeconds: [0.5],
      videoPath: "./capture.webm",
    });
    expect(request.maxWidth).toEqual(O.none());
  });
});
