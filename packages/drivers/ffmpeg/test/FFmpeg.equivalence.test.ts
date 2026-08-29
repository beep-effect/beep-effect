import { FFmpegError } from "@beep/ffmpeg";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameFFmpegError = S.toEquivalence(FFmpegError);

describe("FFmpeg declared-field equivalence", () => {
  it("compares diagnostic fields and ignores the opaque defect cause", () => {
    const a = FFmpegError.make({ message: "ffmpeg failed", operation: "probeVideo" });
    const b = FFmpegError.make({ message: "ffmpeg failed", operation: "probeVideo" });
    const c = FFmpegError.make({ message: "ffmpeg failed again", operation: "probeVideo" });
    const firstCause = FFmpegError.fromUnknown("probeVideo", "ffmpeg failed", { cause: new Error("first") });
    const secondCause = FFmpegError.fromUnknown("probeVideo", "ffmpeg failed", { cause: new Error("second") });

    expect(sameFFmpegError(a, b)).toBe(true);
    expect(sameFFmpegError(a, c)).toBe(false);
    expect(sameFFmpegError(firstCause, secondCause)).toBe(true);
  });
});
