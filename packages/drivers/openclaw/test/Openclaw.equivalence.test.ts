import { OpenclawCommandSpawnError, OpenclawCommandTimeoutError, OpenclawOutputParseError } from "@beep/openclaw";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameOpenclawCommandSpawnError = S.toEquivalence(OpenclawCommandSpawnError);
const sameOpenclawCommandTimeoutError = S.toEquivalence(OpenclawCommandTimeoutError);
const sameOpenclawOutputParseError = S.toEquivalence(OpenclawOutputParseError);

describe("Openclaw declared-field equivalence", () => {
  it("treats field-equal timeouts as equivalent and field-different ones as distinct", () => {
    const a = OpenclawCommandTimeoutError.make({
      executable: "openclaw",
      subcommand: "doctor",
      timeoutMs: 60_000,
    });
    const b = OpenclawCommandTimeoutError.make({
      executable: "openclaw",
      subcommand: "doctor",
      timeoutMs: 60_000,
    });
    const c = OpenclawCommandTimeoutError.make({
      executable: "openclaw",
      subcommand: "doctor",
      timeoutMs: 45_000,
    });

    expect(sameOpenclawCommandTimeoutError(a, b)).toBe(true);
    expect(sameOpenclawCommandTimeoutError(a, c)).toBe(false);
  });

  it("excludes required opaque defect causes from diagnostic identity", () => {
    const spawnA = OpenclawCommandSpawnError.make({
      argumentCount: 2,
      cause: "first",
      executable: "openclaw",
      subcommand: "doctor",
    });
    const spawnB = OpenclawCommandSpawnError.make({
      argumentCount: 2,
      cause: "second",
      executable: "openclaw",
      subcommand: "doctor",
    });
    const parseA = OpenclawOutputParseError.make({
      cause: "first",
      executable: "openclaw",
      stdoutLength: 17,
      subcommand: "secrets reload",
    });
    const parseB = OpenclawOutputParseError.make({
      cause: "second",
      executable: "openclaw",
      stdoutLength: 17,
      subcommand: "secrets reload",
    });

    expect(sameOpenclawCommandSpawnError(spawnA, spawnB)).toBe(true);
    expect(sameOpenclawOutputParseError(parseA, parseB)).toBe(true);
  });
});
