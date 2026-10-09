import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CliTheme } from "../../effected/cli/CliTheme.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";
import { Status } from "../../effected/cli/Status.ts";

const runs = { arbitrary: fcRuns(100) };

it.layer(CliTheme.layerTest({ color: "truecolor", stderrColor: "basic" }), { timeout: "30 seconds" })((it) => {
  it.effect.prop("theme painting retains safe text and audience normalization is idempotent", [Arbitrary.schema(S.String)], ([input]) => Effect.gen(function* () {
    const theme = yield* CliTheme;
    const text = Fmt.sanitize(input);
    for (const stream of ["stdout", "stderr"] as const) {
      const current = theme.forStream(stream);
      const painted = current.paint("accent", text);
      assert.strictEqual(Fmt.sanitize(painted), text);
      assert.strictEqual(current.paint("accent", Fmt.sanitize(painted)), painted);
      const normalized = CliTheme.forAudience(current, "agent");
      assert.strictEqual(CliTheme.forAudience(normalized, "agent"), normalized);
      assert.strictEqual(normalized.paint("accent", text), text);
      assert.strictEqual(normalized.status(Status.core, "success", text), text === "" ? Status.core.glyph("success", current.glyphs) : `${Status.core.glyph("success", current.glyphs)} ${text}`);
    }
  }), runs);
});
