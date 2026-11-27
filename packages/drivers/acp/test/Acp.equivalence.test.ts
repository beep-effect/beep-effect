import { Errors } from "@beep/acp";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameAcpError = S.toEquivalence(Errors.AcpError);

describe("ACP declared-field equivalence", () => {
  it("treats field-equal defect-bearing errors as equivalent and field-different ones as distinct", () => {
    const transport = (detail: string, cause: string) =>
      Errors.AcpTransportError.make({
        cause: O.some(new Error(cause)),
        detail: O.some(detail),
        method: O.some("session/new"),
        operation: O.some("call-rpc"),
        pid: O.some(42),
      });
    const a = transport("closed", "transport failed");
    const b = transport("closed", "transport failed");
    const c = transport("open", "transport failed");
    const d = transport("closed", "other failure");

    expect(sameAcpError(a, b)).toBe(true);
    expect(sameAcpError(a, c)).toBe(false);
    expect(sameAcpError(a, d), "the defect cause is payload, never identity").toBe(true);
    expect(sameAcpError(a, Errors.AcpTransportError.make({ cause: a.cause, detail: a.detail }))).toBe(false);
  });

  it("compares request-error diagnostics but never the cause", () => {
    const request = (method: string, cause: string) =>
      Errors.AcpRequestError.internalError(
        "Internal error",
        undefined,
        Errors.AcpRequestDiagnostics.make({
          cause: O.some(new Error(cause)),
          method: O.some(method),
          operation: O.some("handle-request"),
          requestId: O.some(7),
        })
      );

    expect(sameAcpError(request("x/test", "one"), request("x/test", "two"))).toBe(true);
    expect(sameAcpError(request("x/test", "one"), request("x/other", "one"))).toBe(false);
  });

  it("distinguishes process exits by signal, pid and stderr", () => {
    const exited = (signal: string, stderr: string) =>
      Errors.AcpProcessExitedError.make({ pid: O.some(9), signal: O.some(signal), stderr: O.some(stderr) });

    expect(sameAcpError(exited("SIGTERM", "bye"), exited("SIGTERM", "bye"))).toBe(true);
    expect(sameAcpError(exited("SIGTERM", "bye"), exited("SIGKILL", "bye"))).toBe(false);
    expect(sameAcpError(exited("SIGTERM", "bye"), exited("SIGTERM", "later"))).toBe(false);
    expect(sameAcpError(Errors.AcpInputStreamEndedError.make({}), Errors.AcpInputStreamEndedError.make({}))).toBe(true);
  });
});
