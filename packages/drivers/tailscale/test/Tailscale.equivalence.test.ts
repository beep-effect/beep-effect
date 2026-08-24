import {
  TailscaleCommandExitError,
  TailscaleCommandOutputError,
  TailscaleCommandSpawnError,
  TailscaleCommandTimeoutError,
  TailscaleStatusParseError,
} from "@beep/tailscale";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameTailscaleCommandExitError = S.toEquivalence(TailscaleCommandExitError);
const sameTailscaleCommandSpawnError = S.toEquivalence(TailscaleCommandSpawnError);
const sameTailscaleCommandOutputError = S.toEquivalence(TailscaleCommandOutputError);
const sameTailscaleCommandTimeoutError = S.toEquivalence(TailscaleCommandTimeoutError);
const sameTailscaleStatusParseError = S.toEquivalence(TailscaleStatusParseError);

describe("Tailscale declared-field equivalence", () => {
  it("treats field-equal command exits as equivalent and field-different ones as distinct", () => {
    const a = TailscaleCommandExitError.make({
      argumentCount: 2,
      executable: "tailscale",
      exitCode: 1,
      stderrLength: 17,
      subcommand: "status",
    });
    const b = TailscaleCommandExitError.make({
      argumentCount: 2,
      executable: "tailscale",
      exitCode: 1,
      stderrLength: 17,
      subcommand: "status",
    });
    const c = TailscaleCommandExitError.make({
      argumentCount: 2,
      executable: "tailscale",
      exitCode: 2,
      stderrLength: 17,
      subcommand: "status",
    });

    expect(sameTailscaleCommandExitError(a, b)).toBe(true);
    expect(sameTailscaleCommandExitError(a, c)).toBe(false);
  });

  it("excludes the opaque spawn cause from diagnostic identity", () => {
    const a = TailscaleCommandSpawnError.make({
      argumentCount: 2,
      cause: "first",
      executable: "tailscale",
      subcommand: "status",
    });
    const b = TailscaleCommandSpawnError.make({
      argumentCount: 2,
      cause: "second",
      executable: "tailscale",
      subcommand: "status",
    });

    expect(sameTailscaleCommandSpawnError(a, b)).toBe(true);
  });

  it("compares output errors by command context while excluding the opaque cause", () => {
    const a = TailscaleCommandOutputError.make({
      argumentCount: 1,
      cause: "stream torn",
      executable: "tailscale",
      subcommand: "status",
    });
    const b = TailscaleCommandOutputError.make({
      argumentCount: 1,
      cause: "different stream failure",
      executable: "tailscale",
      subcommand: "status",
    });
    const c = TailscaleCommandOutputError.make({
      argumentCount: 3,
      cause: "stream torn",
      executable: "tailscale",
      subcommand: "status",
    });

    expect(sameTailscaleCommandOutputError(a, b)).toBe(true);
    expect(sameTailscaleCommandOutputError(a, c)).toBe(false);
  });

  it("compares timeout errors by command context and timeout while excluding the opaque cause", () => {
    const a = TailscaleCommandTimeoutError.make({
      argumentCount: 1,
      cause: "timeout defect",
      executable: "tailscale",
      subcommand: "status",
      timeoutMs: 5000,
    });
    const b = TailscaleCommandTimeoutError.make({
      argumentCount: 1,
      cause: "another defect",
      executable: "tailscale",
      subcommand: "status",
      timeoutMs: 5000,
    });
    const c = TailscaleCommandTimeoutError.make({
      argumentCount: 1,
      cause: "timeout defect",
      executable: "tailscale",
      subcommand: "status",
      timeoutMs: 9000,
    });

    expect(sameTailscaleCommandTimeoutError(a, b)).toBe(true);
    expect(sameTailscaleCommandTimeoutError(a, c)).toBe(false);
  });

  it("treats all status parse errors as equivalent because identity excludes the opaque cause", () => {
    const a = TailscaleStatusParseError.make({ cause: "bad json" });
    const b = TailscaleStatusParseError.make({ cause: "missing field" });

    expect(sameTailscaleStatusParseError(a, b)).toBe(true);
  });
});
