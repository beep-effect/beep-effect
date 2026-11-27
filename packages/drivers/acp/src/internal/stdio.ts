import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as P from "effect/Predicate";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as AcpError from "../Acp.errors.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const encoder = new TextEncoder();

const SIGNAL_EXIT_MESSAGE = /^Process interrupted due to receipt of signal: '(SIG[A-Z0-9]+)'$/;
const CHILD_PROCESS_MODULE = "ChildProcess";
const EXIT_CODE_METHOD = "exitCode";

/**
 * Process handle members needed to classify how an ACP peer process ended.
 *
 * @category models
 * @since 0.0.0
 */
export type AcpTerminationHandle = Pick<ChildProcessSpawner.ChildProcessHandle, "exitCode" | "pid">;

export const makeChildStdio = (handle: ChildProcessSpawner.ChildProcessHandle) =>
  Stdio.make({
    args: Effect.succeed([]),
    stdin: handle.stdout,
    stdout: () =>
      Sink.mapInput(handle.stdin, (chunk: string | Uint8Array) => (P.isString(chunk) ? encoder.encode(chunk) : chunk)),
    stderr: () => Sink.drain,
  });

const isSignalExitReason = (cause: PlatformError.PlatformError): boolean =>
  cause.reason.module === CHILD_PROCESS_MODULE && cause.reason.method === EXIT_CODE_METHOD;

export const signalOf = (cause: PlatformError.PlatformError): O.Option<string> =>
  isSignalExitReason(cause) && P.isError(cause.reason.cause)
    ? O.flatMap(
        Str.match(SIGNAL_EXIT_MESSAGE)(cause.reason.cause.message),
        flow((matched) => matched[1], O.fromUndefinedOr)
      )
    : O.none();

/**
 * Classifies how an ACP peer process ended.
 *
 * A signal exit becomes `AcpProcessExitedError` with `signal`, an exit code becomes
 * `AcpProcessExitedError` with `code`, and any other exit-status failure becomes an
 * `AcpTransportError` for `read-process-exit-status`. Every error keeps the process id.
 */
export const makeTerminationError = (handle: AcpTerminationHandle): Effect.Effect<AcpError.AcpError> =>
  Effect.match(handle.exitCode, {
    onFailure: (cause): AcpError.AcpError =>
      O.match(signalOf(cause), {
        onNone: () =>
          AcpError.AcpTransportError.make({
            cause: O.some(cause),
            operation: O.some("read-process-exit-status"),
            pid: O.some(handle.pid),
          }),
        onSome: (signal) =>
          AcpError.AcpProcessExitedError.make({
            cause: O.some(cause),
            pid: O.some(handle.pid),
            signal: O.some(signal),
          }),
      }),
    onSuccess: (code): AcpError.AcpError =>
      AcpError.AcpProcessExitedError.make({ code: O.some(code), pid: O.some(handle.pid) }),
  });
