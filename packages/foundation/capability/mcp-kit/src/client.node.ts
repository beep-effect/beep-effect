/**
 * `@beep/mcp-kit/client.node`, the kit client over a spawned stdio host and
 * the Node entry of the client: it binds {@link layerProtocolNdjson} to a child
 * process's stdin/stdout through `effect/unstable/process`. The caller
 * supplies the `ChildProcessSpawner` (for example
 * `NodeChildProcessSpawner.layer` from `@effect/platform-node`), so this
 * module adds no platform dependency to the kit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer, Queue, Stream } from "effect";
import { decodeLines, layerProtocolNdjson } from "./client.ts";
import type { PlatformError } from "effect/PlatformError";
import type * as ChildProcess from "effect/unstable/process/ChildProcess";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { RpcClient } from "effect/unstable/rpc";
import type { McpClientOptions } from "./client.ts";

const encoder = new TextEncoder();

/**
 * `RpcClient.Protocol` over the stdio of a spawned host process: each request
 * is one newline-delimited JSON line on the child's stdin, responses are read
 * from its stdout. The child lives as long as the layer's scope.
 *
 * **Example** (Spawn a stdio host)
 *
 * ```ts
 * import { layerProtocolStdioCommand } from "@beep/mcp-kit/client.node"
 * import * as Layer from "effect/Layer"
 * import * as ChildProcess from "effect/unstable/process/ChildProcess"
 *
 * const protocol = layerProtocolStdioCommand({ command: ChildProcess.make("bun", ["run", "./src/bin.ts"]) })
 * console.log(Layer.isLayer(protocol))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerProtocolStdioCommand = (options: {
  readonly command: ChildProcess.Command;
  /**
   * Identity presented on every request; defaults to `McpClientOptions.make({})`.
   */
  readonly client?: McpClientOptions | undefined;
}): Layer.Layer<RpcClient.Protocol, PlatformError, ChildProcessSpawner> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const handle = yield* options.command;
      const outbound = yield* Queue.unbounded<Uint8Array>();
      yield* Stream.fromQueue(outbound).pipe(Stream.run(handle.stdin), Effect.orDie, Effect.forkScoped);
      return layerProtocolNdjson({
        write: (line) => Queue.offer(outbound, encoder.encode(`${line}\n`)),
        lines: Stream.orDie(decodeLines(handle.stdout)),
        client: options.client,
      });
    })
  );
