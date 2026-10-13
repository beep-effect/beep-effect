import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { computeEdits } from "../../../effected/yaml/internal/diff.ts";

const runs = { arbitrary: fcRuns(100) };
const singleLine = Arbitrary.schema(S.String).pipe(Arbitrary.map(Str.replaceAll(/[\r\n]/g, "")));
it.effect.prop("applying character edits reconstructs the target and leaves no second diff", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([original, modified]) => Effect.sync(() => {
  const edits = computeEdits(original, modified);
  let result = original;
  let end = original.length;
  for (const edit of [...edits].reverse()) {
    assert.isAtLeast(edit.offset, 0);
    assert.isAtMost(edit.offset + edit.length, end);
    result = result.slice(0, edit.offset) + edit.content + result.slice(edit.offset + edit.length);
    end = edit.offset;
  }
  assert.strictEqual(result, modified);
  assert.deepStrictEqual(computeEdits(result, modified), []);
}), runs);
it.effect.prop("line edits retain the unchanged comment and blank-line bytes", [singleLine, singleLine], ([left, right]) => Effect.sync(() => {
  const original = `before:${left}\n# keep this comment\n\nafter:${left}`;
  const modified = `before:${right}\n# keep this comment\n\nafter:${right}`;
  let actual = original;
  const commentStart = `before:${left}\n`.length;
  const commentEnd = commentStart + "# keep this comment\n\n".length;
  for (const edit of [...computeEdits(original, modified)].reverse()) {
    assert.isTrue(edit.offset + edit.length <= commentStart || edit.offset >= commentEnd);
    actual = actual.slice(0, edit.offset) + edit.content + actual.slice(edit.offset + edit.length);
  }
  assert.strictEqual(actual, modified);
  assert.include(actual, "\n# keep this comment\n\n");
}), runs);
