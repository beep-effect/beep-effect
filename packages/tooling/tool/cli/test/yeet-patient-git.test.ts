import { PATIENT_GIT_OPTIONS, patientGit } from "@beep/repo-cli/test/Yeet";
import { assert, describe, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

describe("Yeet patient git options", () => {
  it("gives the long-running mutations a 15-minute timeout and the kit's default output bound", () => {
    assert.isTrue(Duration.equals(PATIENT_GIT_OPTIONS.timeout, Duration.minutes(15)));
    assert.strictEqual(PATIENT_GIT_OPTIONS.maxOutputBytes, 16 * 1024 * 1024);
    assert.isTrue(Effect.isEffect(patientGit));
  });
});
