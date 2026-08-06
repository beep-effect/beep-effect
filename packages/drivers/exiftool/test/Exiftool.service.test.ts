import {
  BeepQaProvenance,
  Exiftool,
  ExiftoolError,
  ReadTagsRequest,
  TagAssignment,
  WriteTagsRequest,
  WriteXmpPacketRequest,
} from "@beep/exiftool";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const encoder = new TextEncoder();

// TODO(effect-native-migration): model schema
const exiftoolJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown))([
  {
    SourceFile: "frame.png",
    "System:FileName": "frame.png",
    "System:FileSize": "2.9 kB",
    "File:FileType": "PNG",
    "File:MIMEType": "image/png",
    "PNG:ImageWidth": 8,
    "PNG:ImageHeight": 8,
    "XMP-beepQA:SessionId": "sess-1",
    "XMP-beepQA:CapturedAtEpochMs": 1753900000000,
  },
]);

const makeStream = (text: string) => (text.length === 0 ? Stream.empty : Stream.succeed(encoder.encode(text)));

const makeHandle = (stdout: string, stderr = "", exitCode = 0): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: makeStream(stderr),
    stdin: Sink.drain,
    stdout: makeStream(stdout),
    unref: Effect.succeed(Effect.void),
  });

const makeFakeSpawnerLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return ChildProcessSpawner.ChildProcessSpawner.of(
        ChildProcessSpawner.make((command) =>
          Effect.gen(function* () {
            if (!ChildProcess.isStandardCommand(command)) {
              return makeHandle("", "unsupported command", 1);
            }

            commands[A.length(commands)] = command;

            if (A.contains(command.args, "-ver")) {
              return makeHandle("13.55\n", "", exitCode);
            }

            if (A.contains(command.args, "-j")) {
              return makeHandle(exiftoolJson, "", exitCode);
            }

            // Write invocation: args end with [..., "-o", outputPath, sourcePath].
            const outputPath = A.get(command.args, A.length(command.args) - 2);
            if (O.isSome(outputPath) && exitCode === 0) {
              yield* fs.writeFileString(outputPath.value, "staged bytes");
            }

            return makeHandle("    1 image files created\n", "exiftool stderr", exitCode);
          })
        )
      );
    })
  );

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  Exiftool.makeLayer().pipe(Layer.provide(makeFakeSpawnerLayer(commands, exitCode)), Layer.provide(NodeServices.layer));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, {
          recursive: true,
          force: true,
        });
      })
  );

describe("@beep/exiftool service", () => {
  it.effect(
    "reports the exiftool version through the fake child-process layer",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      const version = yield* Effect.gen(function* () {
        const exiftool = yield* Exiftool;
        return yield* exiftool.version;
      }).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));

      expect(version).toBe("13.55");
      expect(commands[0]?.command).toBe("exiftool");
      expect(commands[0]?.args).toEqual(["-ver"]);
    })
  );

  it.effect(
    "reads tags into cleaned metadata with the -config file first",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "frame.png");
          yield* fs.writeFileString(filePath, "png bytes");

          const exiftool = yield* Exiftool;
          const result = yield* exiftool.readTags(ReadTagsRequest.make({ filePath }));

          expect(
            pipe(
              result.metadata.fileType,
              O.getOrElse(() => "")
            )
          ).toBe("PNG");
          expect(
            pipe(
              result.metadata.fileName,
              O.getOrElse(() => "")
            )
          ).toBe("frame.png");
          expect(
            pipe(
              result.metadata.imageWidth,
              O.getOrElse(() => 0)
            )
          ).toBe(8);
          expect(
            pipe(
              result.metadata.imageHeight,
              O.getOrElse(() => 0)
            )
          ).toBe(8);
          expect(result.metadata.raw["XMP-beepQA:SessionId"]).toBe("sess-1");

          const args = commands[0]?.args ?? [];
          expect(args[0]).toBe("-config");
          expect(A.contains(args, "-j")).toBe(true);
          expect(A.contains(args, "-G1")).toBe(true);
          expect(A.contains(args, "-n")).toBe(false);
          expect(
            pipe(
              A.last(args),
              O.getOrElse(() => "")
            )
          ).toBe(filePath);

          const numericRequest = yield* exiftool.readTags(ReadTagsRequest.make({ filePath, numeric: true }));
          expect(numericRequest.filePath).toBe(filePath);
          expect(A.contains(commands[1]?.args ?? [], "-n")).toBe(true);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "writes tags temp-then-commit without leaving staging behind",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "frame.png");
          yield* fs.writeFileString(filePath, "original bytes");

          const exiftool = yield* Exiftool;
          const result = yield* exiftool.writeTags(
            WriteTagsRequest.make({
              assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "sess-1" })],
              filePath,
            })
          );

          expect(result.tagsWritten).toBe(1);
          expect(yield* fs.readFileString(filePath)).toBe("staged bytes");
          expect(yield* fs.readDirectory(tmpDir)).toEqual(["frame.png"]);

          const args = commands[0]?.args ?? [];
          expect(args[0]).toBe("-config");
          expect(A.contains(args, "-XMP-beepQA:sessionId=sess-1")).toBe(true);
          expect(A.contains(args, "-o")).toBe(true);
          expect(
            pipe(
              A.last(args),
              O.getOrElse(() => "")
            )
          ).toBe(filePath);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "embeds provenance packets through the write-tags path",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "frame.gif");
          yield* fs.writeFileString(filePath, "gif bytes");

          const exiftool = yield* Exiftool;
          const result = yield* exiftool.writeXmpPacket(
            WriteXmpPacketRequest.make({
              filePath,
              provenance: BeepQaProvenance.make({
                actionId: "act-9",
                capturedAtEpochMs: 1753900000000,
                scenarioName: "sash-drag",
                sessionId: "sess-1",
              }),
            })
          );

          expect(result.tagsWritten).toBe(4);
          expect(yield* fs.readFileString(filePath)).toBe("staged bytes");

          const args = commands[0]?.args ?? [];
          expect(A.contains(args, "-XMP-beepQA:sessionId=sess-1")).toBe(true);
          expect(A.contains(args, "-XMP-beepQA:capturedAtEpochMs=1753900000000")).toBe(true);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "refuses unwritable extensions before spawning and points at FFmpeg",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "capture.webm");
          yield* fs.writeFileString(filePath, "webm bytes");

          const exiftool = yield* Exiftool;
          const error = yield* Effect.flip(
            exiftool.writeTags(
              WriteTagsRequest.make({
                assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "sess-1" })],
                filePath,
              })
            )
          );

          expect(error).toBeInstanceOf(ExiftoolError);
          expect(error.operation).toBe("writeTags");
          expect(pipe(error.message, Str.includes("FFmpeg.writeContainerMetadata"))).toBe(true);
          expect(yield* fs.readFileString(filePath)).toBe("webm bytes");
          expect(A.length(commands)).toBe(0);

          const emptyError = yield* Effect.flip(
            exiftool.writeTags(WriteTagsRequest.make({ assignments: [], filePath: path.join(tmpDir, "frame.png") }))
          );
          expect(pipe(emptyError.message, Str.includes("at least one tag assignment"))).toBe(true);
          expect(A.length(commands)).toBe(0);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "normalizes failed exiftool exits into ExiftoolError",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "frame.png");
          yield* fs.writeFileString(filePath, "original bytes");

          const exiftool = yield* Exiftool;
          const error = yield* Effect.flip(
            exiftool.writeTags(
              WriteTagsRequest.make({
                assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "sess-1" })],
                filePath,
              })
            )
          );

          expect(error).toBeInstanceOf(ExiftoolError);
          expect(pipe(error.message, Str.includes("could not write tags"))).toBe(true);
          expect(
            pipe(
              error.exitCode,
              O.getOrElse(() => 0)
            )
          ).toBe(7);
          expect(yield* fs.readFileString(filePath)).toBe("original bytes");
          expect(yield* fs.readDirectory(tmpDir)).toEqual(["frame.png"]);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, 7))));
    })
  );
});
