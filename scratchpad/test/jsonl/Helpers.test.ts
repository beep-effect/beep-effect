import { CursoredSlice, Slice, matchesFrame } from "@beep/scratchpad/effected/jsonl/Slice";
import { readRangeText, readTail } from "@beep/scratchpad/effected/jsonl/internal/tail";
import { utf8Length } from "@beep/scratchpad/effected/jsonl/internal/utf8";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Utf16Text = S.String;
describe("JSONL helper boundaries", () => {
  it.prop("matches TextEncoder for arbitrary UTF-16 strings", [Utf16Text], ([text]) => {
    assert.strictEqual(utf8Length(text), new TextEncoder().encode(text).length);
  });
  it.each(["\ud800", "\udc00", "\ud800a", "\ud800\ud800", "\ud800\udfff", "é", "€"])(
    "counts isolated and paired code units %s",
    (text) => {
      assert.strictEqual(utf8Length(text), new TextEncoder().encode(text).length);
    }
  );
  it("rejects a scope filter when the frame has no scope", () => {
    assert.isFalse(matchesFrame({ at: DateTime.makeUnsafe(0), event: "mail", data: null }, { scopes: ["box"] }));
  });
  it.effect("returns an empty partial tail window when no newline exists", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "unfinished");
      const tail = yield* readTail(fs, "/journal", 3, 0);
      assert.strictEqual(tail.text, "");
      assert.strictEqual(tail.start, 10);
      assert.isFalse(tail.atFileStart);
    })
  );
  it.effect("stops a range at EOF even when the requested length exceeds the file", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "é😀");
      assert.strictEqual(yield* readRangeText(fs, "/journal", 0, 100), "é😀");
      assert.strictEqual(yield* readRangeText(fs, "/journal", 6, 100), "");
    })
  );
});

describe("selection schemas", () => {
  it("retains a tag domain and validates byte cursors", () => {
    const tags = S.Literal("mail");
    const selection = Slice(tags);
    const resumed = CursoredSlice(tags);
    assert.isTrue(S.is(selection)({ events: ["mail"], scopes: ["box"] }));
    assert.isFalse(S.is(selection)({ events: ["foreign"] }));
    assert.isTrue(S.is(resumed)({ cursor: 0 }));
    assert.isFalse(S.is(resumed)({ cursor: -1 }));
    assert.isFalse(S.is(resumed)({ cursor: 1.5 }));
  });
});
