import { TailscaleCommandExitError, TailscaleCommandSpawnError } from "@beep/tailscale";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameTailscaleCommandExitError = S.toEquivalence(TailscaleCommandExitError);
const sameTailscaleCommandSpawnError = S.toEquivalence(TailscaleCommandSpawnError);

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
});
