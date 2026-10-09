import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import { CommandNeutralizer } from "../../effected/github-commands/CommandNeutralizer.ts";
import { commandLines, LINE_BREAK } from "./helpers/runnerCommands.ts";

const runs = { arbitrary: fcRuns(100) };
const hostileText = S.Union([S.String, S.Literals(["::error::x", "##[warning]x", "\u0085::notice::x", "\r", "\n", "\r\n", "## heading", "\u200b", "\ufeff"])]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));

describe("CommandNeutralizer property floor", () => {
  it.effect.prop("text and lines are idempotent and neither runner parser finds a command", [hostileText], ([text]) =>
    Effect.sync(() => {
      const once = CommandNeutralizer.text(text);
      const lines = CommandNeutralizer.lines(text);
      assert.strictEqual(CommandNeutralizer.text(once), once);
      assert.deepStrictEqual(CommandNeutralizer.lines(A.join(lines, "\n")), lines);
      assert.strictEqual(A.join(lines, "\n"), once);
      assert.deepStrictEqual(commandLines(once), []);
      assert.strictEqual(lines.length, Str.split(text, LINE_BREAK).length);
      // Removing only introduced zero-width markers preserves the original data and line order.
      const withoutMarkers = Str.replaceAll("\u200b", "");
      assert.strictEqual(withoutMarkers(once), withoutMarkers(A.join(Str.split(text, LINE_BREAK), "\n")));
    }), runs);

  it.effect.prop("quiet markdown headings and plain data retain every character except line ending normalization", [Arbitrary.schema(S.String)], ([payload]) =>
    Effect.sync(() => {
      const quiet = `## heading ${Str.replaceAll("##[", "## (")(payload)}`;
      const lines = A.map(Str.split(quiet, LINE_BREAK), (line) => `data ${line}`);
      const text = A.join(lines, "\r\n");
      assert.deepStrictEqual(CommandNeutralizer.lines(text), lines);
      assert.strictEqual(CommandNeutralizer.text(text), A.join(lines, "\n"));
    }), runs);
});
