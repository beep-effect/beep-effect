/**
 * Exit code proofs of the command failures. Every value is synthetic.
 */
import { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
import { describe, expect, it } from "@effect/vitest";
import { Runtime } from "effect";
import * as A from "effect/Array";
import { DocketIntakeCommandError, docketIntakeExitCode } from "@/Errors";

describe("@beep/docket-intake command failures", () => {
  it("exits 1 when a command failed, 2 when it was refused and 3 when Graph throttled", () => {
    const failures = [
      DocketIntakeCommandError.failed("no run latest in the journal"),
      DocketIntakeCommandError.refused("undo writes; pass --yes"),
      DocketIntakeCommandError.fromIntake(DocketIntakeError.make({ cause: "throttled", stage: "calendar" })),
      DocketIntakeCommandError.fromIntake(DocketIntakeError.make({ cause: "transport", stage: "mailbox" })),
    ];

    expect(A.map(failures, (failure) => [failure.kind, failure[Runtime.errorExitCode]])).toStrictEqual([
      ["failed", 1],
      ["refused", 2],
      ["throttled", 3],
      ["failed", 1],
    ]);
    expect(docketIntakeExitCode("throttled")).toBe(3);
  });
});
