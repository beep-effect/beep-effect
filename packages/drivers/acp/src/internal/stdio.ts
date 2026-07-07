import { Effect, Sink, Stdio } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as AcpError from "../Acp.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

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
