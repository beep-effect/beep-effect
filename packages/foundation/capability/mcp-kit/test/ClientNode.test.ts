/**
 * `@beep/mcp-kit/client.node`: the NDJSON protocol bound to a spawned host.
 * The spawner is a fake whose handle is wired to an in-process stdio fixture
 * host, so the plumbing (stdin queue drain, stdout line split, scope) is
 * proven without a real child process.
 *
 * @since 0.0.0
 */
import { connect } from "@beep/mcp-kit/client";
import { layerProtocolStdioCommand } from "@beep/mcp-kit/client.node";
import { withStdioHost } from "@beep/mcp-kit/test/Conformance";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Sink, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { fixtureHost } from "./fixtures/FixtureHost.ts";
import type { StdioHost } from "@beep/mcp-kit/test/Conformance";

// A spawner whose only process is the fixture host: bytes written to the
// handle's stdin reach the host, the host's lines come back as stdout bytes.
const fakeSpawner = (io: StdioHost) =>
  ChildProcessSpawner.make((_command) =>
    Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
        isRunning: Effect.succeed(true),
        kill: () => Effect.void,
        stdin: Sink.forEach((bytes: Uint8Array) => io.sendChunk(bytes)),
        stdout: Stream.encodeText(Stream.map(io.lines, (line) => `${line}\n`)),
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.succeed(Effect.void),
      })
    )
  );

describe("layerProtocolStdioCommand", () => {
  it.effect("discovers and calls a tool through a spawned host's stdio", () =>
    withStdioHost(fixtureHost)((io) =>
      Effect.gen(function* () {
        const protocol = yield* Layer.build(
          layerProtocolStdioCommand({ command: ChildProcess.make("fixture-host") }).pipe(
            Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, fakeSpawner(io)))
          )
        );
        const { discovery, rpc } = yield* connect.pipe(Effect.provideContext(protocol));
        assert.deepStrictEqual(discovery.supportedVersions, ["2026-07-28"]);
        const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "spawned" } });
        assert.deepStrictEqual(result.structuredContent, { echoed: "spawned" });
      })
    )
  );
});
