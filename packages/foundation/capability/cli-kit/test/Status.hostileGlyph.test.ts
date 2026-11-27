import { CliLog, CliLogger, CliMessage, CliTheme, Doc, Glyphs, Render, Status } from "@beep/cli-kit";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { Audience } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Str from "effect/String";
import type { AudienceKind } from "@beep/runtime-env";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);
const HOSTILE_GLYPH = `${ESC}]8;;https://evil.example${BEL}!${ESC}]8;;${BEL}${ESC}[2A${BEL}`;
const vocab = Status.extend({ evil: { glyph: HOSTILE_GLYPH, ascii: HOSTILE_GLYPH, token: "failure", rank: 95 } });

const withoutColour = (line: string): string => Str.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "")(line);

const assertNeutralised = (line: string, label: string): void => {
  assert.include(line, "!", `${label}: the mark itself is drawn`);
  assert.notInclude(withoutColour(line), ESC, `${label}: no escape but the kit's own colour`);
  assert.notInclude(line, BEL, `${label}: no bell`);
  assert.notInclude(line, "evil.example", `${label}: no hyperlink target`);
};

const run = Effect.fn("run")(function* (
  effect: Effect.Effect<void, never, CliTheme | Audience>,
  audience: AudienceKind
) {
  const lines: Array<string> = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => lines.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => lines.push(pipe(args, A.map(String), A.join(" "))),
  });
  yield* effect.pipe(
    provideBuilt(Layer.mergeAll(CliTheme.layerTest({ color: "truecolor" }), Audience.layerTest(audience))),
    provideBuilt(Logger.layer([CliLogger.make()])),
    Effect.provideService(Console.Console, double)
  );
  return lines;
});

describe("a hostile status glyph is neutralised on every path", () => {
  for (const audience of ["agent", "human"] as const) {
    it.effect(`CliLog.status, for ${audience === "agent" ? "an agent" : "a person"}`, () =>
      Effect.gen(function* () {
        const [line = ""] = yield* run(CliLog.status(vocab, "evil", "boom"), audience);
        assertNeutralised(line, "CliLog.status");
        if (audience === "agent") assert.notInclude(line, ESC, "an agent gets no escape at all");
        else assert.include(line, ESC, "control: a person's glyph is still painted");
      })
    );

    it.effect(`CliMessage.status, for ${audience === "agent" ? "an agent" : "a person"}`, () =>
      Effect.gen(function* () {
        const [line = ""] = yield* run(CliMessage.status(vocab, "evil", "boom"), audience);
        assertNeutralised(line, "CliMessage.status");
        if (audience === "agent") assert.notInclude(line, ESC);
      })
    );

    it(`a document's status mark, for ${audience === "agent" ? "an agent" : "a person"}`, () => {
      const ctx = Render.contextOf({ audience, color: "truecolor" });
      const line = Render.ansi([Doc.paragraph(Doc.status(vocab, "evil"), " boom")], ctx);
      assertNeutralised(line, "Doc");
    });
  }

  it("Status.glyph and a theme's status are the shared source", () => {
    assert.strictEqual(vocab.glyph("evil", Glyphs.unicode), "!");
    assert.strictEqual(vocab.glyph("evil", Glyphs.ascii), "!");
    assert.strictEqual(Status.core.glyph("failure", Glyphs.unicode), "✗", "control: an ordinary glyph is unchanged");
  });
});
