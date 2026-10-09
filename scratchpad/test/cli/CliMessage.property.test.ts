import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { Audience } from "../../effected/env/index.ts";
import { CliMessage } from "../../effected/cli/CliMessage.ts";
import { CliTheme } from "../../effected/cli/CliTheme.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";
import { Status } from "../../effected/cli/Status.ts";

const runs = { arbitrary: fcRuns(100) };
it.layer(Layer.merge(CliTheme.layerTest({ color: "truecolor" }), Audience.layerTest("agent")), { timeout: "30 seconds" })((it) => {
  it.effect.prop("status messages retain sanitized text and are stable after normalization", [Arbitrary.schema(S.String)], ([input]) => Effect.gen(function* () {
    const lines: Array<unknown> = [];
    const theme = yield* CliTheme;
    const double = { ...globalThis.console, log: (value: unknown) => { lines.push(value); } };
    const text = Fmt.sanitize(input);
    yield* Effect.gen(function* () {
      yield* CliMessage.success(input);
      yield* CliMessage.success(text);
    }).pipe(Effect.provideService(Console.Console, double));
    const glyph = Status.core.glyph("success", theme.glyphs);
    const expected = text === "" ? glyph : `${glyph} ${text}`;
    assert.deepStrictEqual(lines, [expected, expected]);
  }), runs);
});
