import {
  BeepQaProvenance,
  Exiftool,
  ExiftoolError,
  provenanceFromRawTags,
  ReadTagsRequest,
  WriteXmpPacketRequest,
} from "@beep/exiftool";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as Base64 from "effect/encoding/Base64";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";

// 8x8 single-color images generated once via `ffmpeg -f lavfi -i color=c=red`
// and embedded so the live lane needs only the exiftool binary itself.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEklEQVR4nGP8y4AdsOAQH6QSANErARssm0F5AAAAAElFTkSuQmCC";
const TINY_GIF_BASE64 =
  "R0lGODlhCAAIAPcfMQAAACQAAEgAAGwAAJAAALQAANgAAPwAAAAkACQkAEgkAGwkAJAkALQkANgkAPwkAABIACRIAEhIAGxIAJBIALRIANhIAPxIAABsACRsAEhsAGxsAJBsALRsANhsAPxsAACQACSQAEiQAGyQAJCQALSQANiQAPyQAAC0ACS0AEi0AGy0AJC0ALS0ANi0APy0AADYACTYAEjYAGzYAJDYALTYANjYAPzYAAD8ACT8AEj8AGz8AJD8ALT8ANj8APz8AAAAVSQAVUgAVWwAVZAAVbQAVdgAVfwAVQAkVSQkVUgkVWwkVZAkVbQkVdgkVfwkVQBIVSRIVUhIVWxIVZBIVbRIVdhIVfxIVQBsVSRsVUhsVWxsVZBsVbRsVdhsVfxsVQCQVSSQVUiQVWyQVZCQVbSQVdiQVfyQVQC0VSS0VUi0VWy0VZC0VbS0Vdi0Vfy0VQDYVSTYVUjYVWzYVZDYVbTYVdjYVfzYVQD8VST8VUj8VWz8VZD8VbT8Vdj8Vfz8VQAAqiQAqkgAqmwAqpAAqrQAqtgAqvwAqgAkqiQkqkgkqmwkqpAkqrQkqtgkqvwkqgBIqiRIqkhIqmxIqpBIqrRIqthIqvxIqgBsqiRsqkhsqmxsqpBsqrRsqthsqvxsqgCQqiSQqkiQqmyQqpCQqrSQqtiQqvyQqgC0qiS0qki0qmy0qpC0qrS0qti0qvy0qgDYqiTYqkjYqmzYqpDYqrTYqtjYqvzYqgD8qiT8qkj8qmz8qpD8qrT8qtj8qvz8qgAA/yQA/0gA/2wA/5AA/7QA/9gA//wA/wAk/yQk/0gk/2wk/5Ak/7Qk/9gk//wk/wBI/yRI/0hI/2xI/5BI/7RI/9hI//xI/wBs/yRs/0hs/2xs/5Bs/7Rs/9hs//xs/wCQ/ySQ/0iQ/2yQ/5CQ/7SQ/9iQ//yQ/wC0/yS0/0i0/2y0/5C0/7S0/9i0//y0/wDY/yTY/0jY/2zY/5DY/7TY/9jY//zY/wD8/yT8/0j8/2z8/5D8/7T8/9j8//z8/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEZAAfACwAAAAACAAIAAAIFAAPCBxIsKDBgQYOKlzI8EBCgQEBADs=";

const liveLayer = Layer.mergeAll(NodeServices.layer, Exiftool.makeLayer().pipe(Layer.provide(NodeServices.layer)));

const exiftoolAvailable = Effect.gen(function* () {
  const exiftool = yield* Exiftool;
  return yield* exiftool.version.pipe(
    Effect.map(() => true),
    Effect.catchIf(
      (error) =>
        O.exists(error.cause, (cause) => PlatformError.isPlatformError(cause) && cause.reason._tag === "NotFound"),
      () => Effect.succeed(false)
    )
  );
});

const provenanceFor = (sessionId: string): BeepQaProvenance =>
  BeepQaProvenance.make({
    actionId: "act-9",
    capturedAtEpochMs: 1753900000000,
    clockOffsetMs: O.some(12.5),
    commitSha: O.some("abc1234"),
    scenarioName: "sash-drag",
    sessionId,
    sourceVideo: O.some("video/capture.webm"),
    toolVersions: O.some({ exiftool: "13.55" }),
  });

const roundTrip = Effect.fn("ExiftoolLive.roundTrip")(function* (fileName: string, base64: string, sessionId: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exiftool = yield* Exiftool;
  const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-exiftool-live-" });
  const filePath = path.join(tmpDir, fileName);
  const bytes = yield* Effect.orDie(Effect.fromResult(Base64.decode(base64)));
  yield* fs.writeFile(filePath, bytes);

  const written = yield* exiftool.writeXmpPacket(
    WriteXmpPacketRequest.make({ filePath, provenance: provenanceFor(sessionId) })
  );
  expect(written.tagsWritten).toBe(8);

  const read = yield* exiftool.readTags(ReadTagsRequest.make({ filePath }));
  expect(read.metadata.raw["XMP-beepQA:SessionId"]).toBe(sessionId);

  const decoded = provenanceFromRawTags(read.metadata.raw);
  pipe(decoded, O.isSome, assertTrue);
  const provenance = pipe(
    decoded,
    O.getOrElse(() => BeepQaProvenance.make({ actionId: "", capturedAtEpochMs: 0, scenarioName: "", sessionId: "" }))
  );
  expect(provenance.sessionId).toBe(sessionId);
  expect(provenance.scenarioName).toBe("sash-drag");
  expect(provenance.actionId).toBe("act-9");
  expect(provenance.capturedAtEpochMs).toBe(1753900000000);
  assertSome(provenance.clockOffsetMs, 12.5);
  assertSome(provenance.commitSha, "abc1234");
  assertSome(provenance.sourceVideo, "video/capture.webm");
  assertSome(provenance.toolVersions, { exiftool: "13.55" });

  return read;
});

it.layer(liveLayer, { excludeTestServices: true, timeout: "30 seconds" })("@beep/exiftool live", (it) => {
  it.effect("round-trips XMP-beepQA provenance through a real PNG", (ctx) =>
    Effect.gen(function* () {
      if (!(yield* exiftoolAvailable)) {
        return ctx.skip("The exiftool executable was not found.");
      }

      const read = yield* roundTrip("frame.png", TINY_PNG_BASE64, "sess-live-png");
      assertSome(read.metadata.fileType, "PNG");
      assertSome(read.metadata.imageWidth, 8);
    })
  );

  it.effect("round-trips XMP-beepQA provenance through a real GIF", (ctx) =>
    Effect.gen(function* () {
      if (!(yield* exiftoolAvailable)) {
        return ctx.skip("The exiftool executable was not found.");
      }

      const read = yield* roundTrip("frame.gif", TINY_GIF_BASE64, "sess-live-gif");
      assertSome(read.metadata.fileType, "GIF");
    })
  );

  it.effect("refuses video containers with a pointer at FFmpeg.writeContainerMetadata", (ctx) =>
    Effect.gen(function* () {
      if (!(yield* exiftoolAvailable)) {
        return ctx.skip("The exiftool executable was not found.");
      }

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const exiftool = yield* Exiftool;
      const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-exiftool-live-" });
      const filePath = path.join(tmpDir, "capture.webm");
      yield* fs.writeFileString(filePath, "not really webm");

      const error = yield* Effect.flip(
        exiftool.writeXmpPacket(WriteXmpPacketRequest.make({ filePath, provenance: provenanceFor("sess-live") }))
      );

      expect(error).toBeInstanceOf(ExiftoolError);
      expect(pipe(error.message, Str.includes("FFmpeg.writeContainerMetadata"))).toBe(true);
    })
  );
});
