import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CommentStyle } from "../../effected/templates/CommentStyle.ts";
describe("CommentStyle delimiter grammar", () => {
  it.effect("rejects every C0/C1 control while retaining Unicode and printable delimiters", () => Effect.sync(() => {
    for (let point = 0; point <= 0x9f; point += 1) {
      const prefix = String.fromCodePoint(point);
      const decoded = S.decodeResult(CommentStyle)({ prefix });
      assert.strictEqual(Result.isSuccess(decoded), /^\P{Cc}+$/u.test(prefix));
    }
    for (const prefix of ["", "\u2028", "\u2029", "💬", "é", "\ud800", "#\u0000", "#\u009f"]) {
      assert.strictEqual(Result.isSuccess(S.decodeResult(CommentStyle)({ prefix })), /^\P{Cc}+$/u.test(prefix));
    }
  }));
});
