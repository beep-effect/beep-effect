import { CliLinks, CliTheme, Doc, Render, Status } from "@beep/cli-kit";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { AudienceShape } from "@beep/runtime-env/Audience";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { Document } from "@beep/cli-kit";
import type { AudienceKind } from "@beep/runtime-env";

const ESC = String.fromCharCode(0x1b);
const strip = (text: string): string => Str.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "")(text);

const GREPPED_FINDING_PATH = `/very/long/absolute/path/${Str.repeat(4)("deeply/nested/")}file.ts:12:3`;
const finding = [
  Doc.status(Status.core, "failure"),
  " ",
  GREPPED_FINDING_PATH,
  "  rule-name  ",
  Doc.text("a message that runs on", "muted"),
];
const PROSE = A.join(
  Array.from({ length: 30 }, (_, i) => `word${i}`),
  " "
);

const env = (audience: AudienceKind, isTerminal: boolean, color: "none" | "truecolor" = "none") => {
  const stream = {
    isTerminal,
    color,
    hyperlinks: false,
    columns: isTerminal ? O.some(40) : O.none<number>(),
  };
  const terminal = TerminalEnv.layerTest({ stdinIsTerminal: isTerminal, stdout: stream, stderr: stream });
  return Layer.mergeAll(
    terminal,
    CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
    Audience.layerTest(audience),
    CliLinks.layerTest("off")
  );
};

const printed = Effect.fn("printed")(function* (doc: Document) {
  const out: Array<string> = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
  });
  yield* Doc.print(doc).pipe(Effect.provideService(Console.Console, double));
  return pipe(out, A.join("\n"), Str.split("\n"));
});

describe("Render.context's width follows the stream's terminal for a human", () => {
  it.layer(env("human", false), { timeout: "30 seconds" })((it) => {
    it.effect("a human on a pipe gets no limit, as an agent and a CI do", () =>
      Effect.gen(function* () {
        for (const audience of ["human", "agent", "ci"] as const) {
          const ctx = yield* Render.context("stdout").pipe(
            Effect.provideService(Audience, AudienceShape.make({ kind: audience, source: "override" }))
          );
          assert.strictEqual(ctx.width, Number.POSITIVE_INFINITY, audience);
        }
      })
    );
  });

  it.layer(env("human", true), { timeout: "30 seconds" })((it) => {
    it.effect("positive control: a human at a terminal still lays out at the terminal's width", () =>
      Effect.gen(function* () {
        const ctx = yield* Render.context("stdout");
        assert.strictEqual(ctx.width, 40);
        const lines = yield* printed([Doc.paragraph(PROSE)]);
        assert.isAbove(lines.length, 1, "prose wraps at a terminal");
      })
    );
  });

  it.layer(env("human", false), { timeout: "30 seconds" })((it) => {
    it.effect("the width option still wins over both rules", () =>
      Effect.gen(function* () {
        const piped = yield* Render.context("stdout", { width: 30 });
        assert.strictEqual(piped.width, 30);
      })
    );
  });

  const terminal = TerminalEnv.layerTest({
    stdinIsTerminal: true,
    stdout: { isTerminal: false, columns: O.some(40) },
    stderr: { isTerminal: true, columns: O.some(40) },
  });
  const layer = Layer.mergeAll(
    terminal,
    CliTheme.layer().pipe(Layer.provide(terminal)),
    Audience.layerTest("human"),
    CliLinks.layerTest("off")
  );
  it.layer(layer, { timeout: "30 seconds" })((it) => {
    it.effect("decides per stream: a human with stdout piped and stderr at a terminal", () =>
      Effect.gen(function* () {
        const out = yield* Render.context("stdout");
        const err = yield* Render.context("stderr");
        assert.strictEqual(out.width, Number.POSITIVE_INFINITY);
        assert.strictEqual(err.width, 40);
      })
    );
  });

  it.layer(env("human", false), { timeout: "30 seconds" })((it) => {
    it.effect("a piped human's finding prints on one line with its glyph", () =>
      Effect.gen(function* () {
        const lines = yield* printed([Doc.paragraph(...finding)]);
        assert.lengthOf(lines, 1);
        assert.include(
          lines[0],
          `✗ ${GREPPED_FINDING_PATH}`,
          "a reader greps a finding by path:line:col, so it stays on one line"
        );
      })
    );
  });
});

describe("Doc.line with wrap: false", () => {
  it("stays one line at a narrow width in every renderer, keeping its glyph and token", () => {
    for (const audience of ["human", "agent", "ci"] as const) {
      const ctx = Render.contextOf({ audience, width: 20, color: "truecolor" });
      for (const render of [Render.plain, Render.ansi, Render.githubLog, Render.markdown]) {
        const text = render([Doc.line(finding, { wrap: false })], ctx);
        assert.lengthOf(Str.split(text, "\n"), 1, `${audience} ${render === Render.plain ? "plain" : "other"}`);
        assert.include(strip(text), GREPPED_FINDING_PATH);
      }
    }
    const human = Render.ansi(
      [Doc.line(finding, { wrap: false })],
      Render.contextOf({ audience: "human", width: 20, color: "truecolor" })
    );
    assert.include(human, ESC, "the glyph and the muted text are still painted for a person");
    assert.match(strip(human), /^✗ /);
  });

  it("control: the same line without wrap: false wraps at that width", () => {
    const ctx = Render.contextOf({ audience: "human", width: 20 });
    assert.isAbove(Str.split(Render.plain([Doc.line(finding)], ctx), "\n").length, 1);
  });

  it("truncate still wins over wrap: false", () => {
    const ctx = Render.contextOf({ audience: "agent", width: 20 });
    const text = Render.plain([Doc.line(finding, { truncate: true, wrap: false })], ctx);
    assert.lengthOf(Str.split(text, "\n"), 1);
    assert.isAtMost(text.length, 20);
  });

  it("is atomic in a list item while the prose beside it wraps", () => {
    const ctx = Render.contextOf({ audience: "agent", width: 30 });
    const text = Render.plain([Doc.list([Doc.line(finding, { wrap: false }), Doc.paragraph(PROSE)])], ctx);
    const lines = Str.split(text, "\n");
    assert.lengthOf(
      A.filter(lines, (line) => Str.includes(GREPPED_FINDING_PATH)(line)),
      1
    );
    assert.isAbove(lines.length, 3, "the prose item wrapped");
  });

  it("the node carries wrap only when given", () => {
    assert.notProperty(Doc.line("x"), "wrap");
    assert.strictEqual(Doc.line("x", { wrap: false }).wrap, false);
  });
});
