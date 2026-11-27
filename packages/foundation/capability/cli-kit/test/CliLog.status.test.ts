import { CliLog, CliLogger, CliTheme, Status } from "@beep/cli-kit";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { Audience } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { AudienceKind } from "@beep/runtime-env";
import type * as LogLevel from "effect/LogLevel";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);
const HOSTILE_LOGGED_TEXT = `boom ${ESC}[31mred${ESC}[0m ${ESC}]8;;https://evil.example${BEL}click${ESC}]8;;${BEL} ${ESC}[2A`;

const capture = Effect.fn("capture")(function* (
  effect: Effect.Effect<void, never, CliTheme>,
  audience: AudienceKind | undefined
) {
  const out: Array<string> = [];
  const err: Array<string> = [];
  const levels: Array<LogLevel.LogLevel> = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
  });
  const recorder = Logger.make(({ logLevel }) => {
    levels.push(logLevel);
  });
  yield* effect.pipe(
    provideBuilt(CliTheme.layerTest({ color: "truecolor" })),
    provideBuilt(audience === undefined ? Layer.empty : Audience.layerTest(audience)),
    provideBuilt(Logger.layer([CliLogger.make(), recorder])),
    Effect.provideService(Console.Console, double)
  );
  return { out, err, levels };
});

it.layer(CliTheme.layerTest({ color: "truecolor" }), { timeout: "30 seconds" })("CliTheme.forAudience", (it) => {
  it.effect(
    "an agent gets the theme at colour none, whatever the terminal could do; anyone else the theme itself",
    () =>
      Effect.gen(function* () {
        const theme = (yield* CliTheme).forStream("stdout");
        assert.strictEqual(theme.color, "truecolor");
        const agent = CliTheme.forAudience(theme, "agent");
        assert.strictEqual(agent.color, "none");
        assert.notInclude(agent.status(Status.core, "failure", "x"), ESC);
        assert.strictEqual(agent.sgr("failure"), "");
        assert.strictEqual(agent.glyphs, theme.glyphs);
        for (const audience of ["human", "ci", undefined] as const) {
          assert.strictEqual(CliTheme.forAudience(theme, audience), theme, String(audience));
        }
        assert.include(theme.status(Status.core, "failure", "x"), ESC, "control: the theme itself paints");
      })
  );
});

describe("CliLog.status", () => {
  it.effect("paints the glyph on the log channel for a person, and the logger keeps that colour", () =>
    Effect.gen(function* () {
      const { out, err } = yield* capture(CliLog.status(Status.core, "failure", "acme/web: 404"), "human");
      assert.deepStrictEqual(out, []);
      assert.lengthOf(err, 1);
      const line = err[0] ?? "";
      assert.include(line, ESC, "the glyph is painted");
      assert.match(Str.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "")(line), /^✗ acme\/web: 404$/);
    })
  );

  it.effect("control: the same painted line through a plain Effect.logError is stripped by the logger", () =>
    Effect.gen(function* () {
      const painted = Effect.gen(function* () {
        const theme = (yield* CliTheme).forStream("stderr");
        yield* Effect.logError(theme.status(Status.core, "failure", "x"));
      });
      const { err } = yield* capture(painted, "human");
      assert.notInclude(err[0] ?? "", ESC);
    })
  );

  it.effect("an agent gets no escape of any kind", () =>
    Effect.gen(function* () {
      const { err } = yield* capture(CliLog.status(Status.core, "failure", HOSTILE_LOGGED_TEXT), "agent");
      assert.lengthOf(err, 1);
      assert.notInclude(err[0] ?? "", ESC);
      assert.notInclude(err[0] ?? "", BEL);
      assert.match(err[0] ?? "", /^✗ boom red click/);
    })
  );

  it.effect("a hostile escape in the text is neutralised for a person too: only the kit's glyph is painted", () =>
    Effect.gen(function* () {
      const { err } = yield* capture(CliLog.status(Status.core, "failure", HOSTILE_LOGGED_TEXT), "human");
      const line = err[0] ?? "";
      const boom = O.getOrThrow(Str.indexOf(" boom")(line));
      const glyph = Str.slice(0, boom)(line);
      const text = Str.slice(boom)(line);
      assert.include(glyph, ESC, "the glyph keeps its colour");
      assert.notInclude(text, ESC, "nothing from the text reaches the terminal as an escape");
      assert.notInclude(text, BEL);
      assert.notInclude(line, "]8;;https://evil.example");
      assert.include(text, "boom red click");
    })
  );

  it.effect("the level follows the status's rank, and level overrides it", () =>
    Effect.gen(function* () {
      const vocab = Status.extend({ timeout: { glyph: "⏱", ascii: "[time]", token: "warning", rank: 85 } });
      const { levels } = yield* capture(
        Effect.all(
          [
            CliLog.status(vocab, "failure", "a"),
            CliLog.status(vocab, "timeout", "b"),
            CliLog.status(vocab, "warning", "c"),
            CliLog.status(vocab, "success", "d"),
            CliLog.status(vocab, "success", "e", { level: "Debug" }),
          ],
          { concurrency: 1, discard: true }
        ),
        "human"
      );
      assert.deepStrictEqual(levels, ["Error", "Warn", "Warn", "Info"], "Debug is under the default minimum");
    })
  );

  it.effect("indent writes spaces or a string before the glyph, so an indented report line keeps its place", () =>
    Effect.gen(function* () {
      const { err } = yield* capture(
        Effect.all(
          [
            CliLog.status(Status.core, "failure", "error   x: red", { indent: 4 }),
            CliLog.status(Status.core, "failure", "y", { indent: "  │ " }),
            CliLog.status(Status.core, "failure", "z", { indent: -3 }),
            CliLog.status(Status.core, "failure", "w"),
          ],
          { concurrency: 1, discard: true }
        ),
        "agent"
      );
      assert.deepStrictEqual(err, ["    ✗ error   x: red", "  │ ✗ y", "✗ z", "✗ w"]);
    })
  );

  it.effect("a numeric indent is floored and capped at 64 spaces, never throwing", () =>
    Effect.gen(function* () {
      const { err } = yield* capture(
        Effect.all(
          [
            CliLog.status(Status.core, "info", "a", { indent: 1e12 }),
            CliLog.status(Status.core, "info", "b", { indent: 2.9 }),
            CliLog.status(Status.core, "info", "c", { indent: Number.POSITIVE_INFINITY }),
            CliLog.status(Status.core, "info", "d", { indent: Number.NaN }),
            CliLog.status(Status.core, "info", "e", { indent: 64 }),
          ],
          { concurrency: 1, discard: true }
        ),
        "agent"
      );
      assert.deepStrictEqual(err, [`${Str.repeat(64)(" ")}ℹ a`, "  ℹ b", "ℹ c", "ℹ d", `${Str.repeat(64)(" ")}ℹ e`]);
    })
  );

  it.effect("a string indent cannot carry an escape or a line break onto the trusted line", () =>
    Effect.gen(function* () {
      for (const audience of ["agent", "human"] as const) {
        const { err } = yield* capture(
          CliLog.status(Status.core, "failure", "boom", {
            indent: `${ESC}[2A${ESC}]8;;https://evil.example${BEL}\n\t>`,
          }),
          audience
        );
        const { err: plain } = yield* capture(CliLog.status(Status.core, "failure", "boom"), audience);
        assert.strictEqual(
          err[0],
          ` >${plain[0] ?? ""}`,
          `${audience}: nothing of the hostile indent but " >" is left`
        );
      }
    })
  );

  it.effect("without an Audience it paints, as for a person, and needs only CliTheme", () =>
    Effect.gen(function* () {
      const { err } = yield* capture(CliLog.status(Status.core, "info", "hello"), undefined);
      assert.include(err[0] ?? "", ESC);
    })
  );
});
