import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as AcpError from "../Acp.errors.ts";
import type { ChildProcessSpawner } from "effect/process";

const encoder = new TextEncoder();

export const makeChildStdio = (handle: ChildProcessSpawner.ChildProcessHandle) =>
  Stdio.make({
    args: Effect.succeed([]),
    stdin: handle.stdout,
    stdout: () =>
      Sink.mapInput(handle.stdin, (chunk: string | Uint8Array) => (P.isString(chunk) ? encoder.encode(chunk) : chunk)),
    stderr: () => Sink.drain,
  });

export const makeTerminationError = (
  handle: ChildProcessSpawner.ChildProcessHandle
): Effect.Effect<AcpError.AcpError> =>
  Effect.match(handle.exitCode, {
    onFailure: (cause) =>
      AcpError.AcpTransportError.make({
        detail: "Failed to determine ACP process exit status",
        cause: O.some(cause),
      }),
    onSuccess: (code) => AcpError.AcpProcessExitedError.make({ code: O.some(code) }),
  });
