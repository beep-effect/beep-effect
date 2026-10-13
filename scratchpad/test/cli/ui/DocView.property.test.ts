import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderToString } from "ink";
import { createElement } from "react";
import { CliLinks } from "../../../effected/cli/CliLinks.ts";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { CliUi } from "../../../effected/cli/ui/CliUi.ts";
import { DocView } from "../../../effected/cli/ui/DocView.ts";
import { Audience, TerminalEnv } from "../../../effected/env/index.ts";
import { capturing } from "../helpers/live.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  words: S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "中", "é"])).check(S.isMinLength(1), S.isMaxLength(12)),
  width: S.Int.check(S.isBetween({ minimum: 20, maximum: 80 })),
});

it.layer(Layer.mergeAll(CliTheme.layerTest({ color: "none" }), CliLinks.layerTest("off"), Audience.layerTest("human"), TerminalEnv.layerTest()), { timeout: "30 seconds" })((it) => {
  it.effect.prop("DocView preserves renderer bytes, and re-rendering its parsed rows is idempotent", [Arbitrary.schema(Sample)], ([sample]) =>
    Effect.gen(function* () {
      yield* CliUi.context;
      const ctx = Render.contextOf({ audience: "human", width: sample.width });
      const doc = [Doc.paragraph(A.join(sample.words, " "))];
      const printed = Render.plain(doc, ctx);
      const frame = renderToString(createElement(DocView, { doc, ctx }), { columns: sample.width });
      assert.strictEqual(frame, printed);
      const captured = capturing();
      yield* Doc.print(doc, { format: "plain", width: sample.width }).pipe(Effect.provideService(Console.Console, captured.console));
      assert.deepStrictEqual(captured.lines, [frame]);
      const rows = [Doc.lines(Str.split(frame, "\n"))];
      const restored = renderToString(createElement(DocView, { doc: rows, ctx }), { columns: sample.width });
      assert.strictEqual(restored, frame);
      assert.strictEqual(renderToString(createElement(DocView, { doc: rows, ctx }), { columns: sample.width }), restored);
    }), runs);
});
