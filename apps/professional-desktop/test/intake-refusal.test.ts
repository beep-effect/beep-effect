import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { intakeRefusal } from "@/intake/DocumentIntake.models";
import { IntakeFileMetadata } from "../src/intake/DocumentIntake.models.ts";

const MEGABYTE = 1024 * 1024;

describe("what intake refuses, before it reads a byte", () => {
  it("refuses an empty file instead of filing nothing", () => {
    const refusal = intakeRefusal(IntakeFileMetadata.make({ name: "empty.txt", size: 0 }));

    pipe(refusal, O.isSome, assertTrue);
    expect(
      O.getOrElse(refusal, () => ""),
      "a filed zero-byte file asks the model to explain a document that does not exist"
    ).toContain("empty");
  });

  it("refuses an oversized file and names the limit", () => {
    const refusal = intakeRefusal(IntakeFileMetadata.make({ name: "huge.bin", size: 26 * MEGABYTE }));

    expect(O.getOrElse(refusal, () => "")).toContain("25 MB");
  });

  it("accepts an ordinary document", () => {
    assertNone(intakeRefusal(IntakeFileMetadata.make({ name: "contract.pdf", size: 4 * MEGABYTE })));
  });
});
