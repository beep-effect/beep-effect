import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Style } from "../../../effected/cli/Token.ts";
import { inkProps } from "../../../effected/cli/ui/UiTheme.ts";

const runs = { arbitrary: fcRuns(100) };
const Color = S.Literals(["none", "basic", "256", "truecolor"]);

it.effect.prop("Ink props faithfully map every style flag and normalize idempotently", [Arbitrary.schema(Style), Arbitrary.schema(Color)], ([style, color]) =>
  Effect.gen(function* () {
    const formatted = inkProps(style, color);
    assert.deepStrictEqual(inkProps(color)(style), formatted);
    if (color === "none") {
      assert.deepStrictEqual(formatted, {});
    } else {
      assert.strictEqual(formatted.color, style.fg);
      assert.strictEqual(formatted.bold, style.bold === true ? true : undefined);
      assert.strictEqual(formatted.dimColor, style.dim === true ? true : undefined);
      assert.strictEqual(formatted.italic, style.italic === true ? true : undefined);
      assert.strictEqual(formatted.underline, style.underline === true ? true : undefined);
    }
    // Convert the target vocabulary back to Style before the second format pass.
    const parsed = yield* S.decodeUnknownEffect(Style)({
      ...(formatted.color === undefined ? {} : { fg: formatted.color }),
      ...(formatted.bold === undefined ? {} : { bold: formatted.bold }),
      ...(formatted.dimColor === undefined ? {} : { dim: formatted.dimColor }),
      ...(formatted.italic === undefined ? {} : { italic: formatted.italic }),
      ...(formatted.underline === undefined ? {} : { underline: formatted.underline }),
    });
    assert.deepStrictEqual(inkProps(parsed, color), formatted);
    const serialized = yield* S.encodeEffect(Style)(parsed);
    const reparsed = yield* S.decodeEffect(Style)(serialized);
    assert.deepStrictEqual(reparsed, parsed);
    assert.deepStrictEqual(inkProps(reparsed, color), formatted);
  }), runs);
