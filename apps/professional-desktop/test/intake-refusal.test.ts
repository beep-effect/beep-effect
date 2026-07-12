import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import { intakeRefusal } from "@/intake/DocumentIntakeTarget";

const MEGABYTE = 1024 * 1024;

describe("what intake refuses, before it reads a byte", () => {
  it("refuses an empty file instead of filing nothing", () => {
    // A zero-byte file was accepted, classified, and filed: it wrote a content-free
    // object into the vault, and the model was asked to explain a document that did not
    // exist — so it produced a rationale about nothing at all, in earnest.
    const refusal = intakeRefusal({ name: "empty.txt", size: 0 });

    expect(O.isSome(refusal)).toBe(true);
    expect(O.getOrElse(refusal, () => "")).toContain("empty");
  });

  it("refuses an oversized file and names the limit", () => {
    const refusal = intakeRefusal({ name: "huge.bin", size: 26 * MEGABYTE });

    expect(O.getOrElse(refusal, () => "")).toContain("25 MB");
  });

  it("accepts an ordinary document", () => {
    expect(intakeRefusal({ name: "contract.pdf", size: 4 * MEGABYTE })).toStrictEqual(O.none());
  });
});
