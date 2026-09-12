import { chunkStepOutputForTesting } from "@beep/repo-cli/test/Quality";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const CHUNK = 32 * 1024;
const stripNewlines = Str.replaceAll("\n", " ");

describe("step output chunks", () => {
  it("keeps empty and short output as at most one chunk", () => {
    expect(chunkStepOutputForTesting("")).toEqual([]);
    expect(chunkStepOutputForTesting("one\ntwo")).toEqual(["one\ntwo"]);
    expect(chunkStepOutputForTesting("trailing\n")).toEqual(["trailing\n"]);
  });

  it("cuts at newlines below the chunk size and only mid-line when a line exceeds it", () => {
    const a = Str.repeat(20_000)("a");
    const b = Str.repeat(20_000)("b");
    expect(chunkStepOutputForTesting(`${a}\n${b}\nc`)).toEqual([a, `${b}\nc`]);
    const giant = Str.repeat(CHUNK * 2 + 10)("g");
    const chunks = chunkStepOutputForTesting(giant);
    expect(A.map(chunks, Str.length)).toEqual([CHUNK, CHUNK, 10]);
    expect(A.join(chunks, "")).toBe(giant);
  });

  it("restores newline-joined output whenever every line fits a chunk", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          S.String.pipe(S.Array, Arbitrary.schema),
          (raw) => {
            const output = A.join(A.map(raw, stripNewlines), "\n");
            const chunks = chunkStepOutputForTesting(output);
            expect(A.join(chunks, "\n")).toBe(output);
            expect(A.every(chunks, (chunk) => Str.length(chunk) <= CHUNK)).toBe(true);
            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));
});
