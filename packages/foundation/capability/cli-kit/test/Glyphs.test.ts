import { Glyphs } from "@beep/cli-kit";
import { displayWidth } from "@beep/cli-kit/internal/displayWidth";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

describe("Glyphs", () => {
  it("unicode and ascii are distinct, tagged sets", () => {
    assert.strictEqual(Glyphs.unicode.kind, "unicode");
    assert.strictEqual(Glyphs.ascii.kind, "ascii");
    assert.strictEqual(Glyphs.unicode.ellipsis, "…");
    assert.strictEqual(Glyphs.ascii.ellipsis, "...");
    assert.strictEqual(Glyphs.unicode.arrow, "→");
    assert.strictEqual(Glyphs.ascii.arrow, "->");
  });

  it("the ascii set is ascii only, and every set has spinner frames", () => {
    const text = A.join([Glyphs.ascii.ellipsis, Glyphs.ascii.bullet, Glyphs.ascii.arrow, ...Glyphs.ascii.spinner], "");
    for (const ch of text)
      assert.isBelow(
        O.getOrElse(Str.codePointAt(ch, 0), () => 0),
        128
      );
    assert.isAbove(Glyphs.unicode.spinner.length, 0);
    assert.isAbove(Glyphs.ascii.spinner.length, 0);
  });

  it("carries a path separator per audience and a spinner interval", () => {
    assert.strictEqual(Glyphs.unicode.pathSeparator.human, "›");
    assert.strictEqual(Glyphs.unicode.pathSeparator.agent, " > ");
    assert.strictEqual(Glyphs.ascii.pathSeparator.human, ">");
    assert.strictEqual(Glyphs.ascii.pathSeparator.agent, " > ");
    assert.strictEqual(Glyphs.unicode.spinnerIntervalMs, 80);
    assert.strictEqual(Glyphs.ascii.spinnerIntervalMs, 80);
  });

  it("the ascii separators are ascii only", () => {
    for (const ch of Glyphs.ascii.pathSeparator.human + Glyphs.ascii.pathSeparator.agent) {
      assert.isBelow(
        O.getOrElse(Str.codePointAt(ch, 0), () => 0),
        128
      );
    }
  });

  it("the readonly shared sets keep their nested content and exact frame order", () => {
    for (const set of [Glyphs.unicode, Glyphs.ascii]) {
      assert.strictEqual(Glyphs.select({ ascii: set.kind === "ascii" }), set);
      assert.deepStrictEqual(set.pathSeparator, { human: set.kind === "unicode" ? "›" : ">", agent: " > " });
      assert.deepStrictEqual(
        set.spinner,
        set.kind === "unicode" ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] : ["-", "\\", "|", "/"]
      );
    }
  });

  it("carries tree glyphs of one width per set: branch, last, pipe and blank", () => {
    assert.deepStrictEqual(Glyphs.unicode.tree, { branch: "├─ ", last: "└─ ", pipe: "│  ", blank: "   " });
    assert.deepStrictEqual(Glyphs.ascii.tree, { branch: "|-- ", last: "\\-- ", pipe: "|   ", blank: "    " });
    for (const set of [Glyphs.unicode, Glyphs.ascii]) {
      const widths = A.map(R.values(set.tree), (g) => displayWidth(g));
      assert.strictEqual(A.dedupe(widths).length, 1, `${set.kind} segments share a width so branches align`);
      assert.strictEqual(
        Glyphs.select({ ascii: set.kind === "ascii" }).tree,
        set.tree,
        "selection shares the readonly tree data"
      );
    }
    for (const ch of A.join(R.values(Glyphs.ascii.tree), ""))
      assert.isBelow(
        O.getOrElse(Str.codePointAt(ch, 0), () => 0),
        128
      );
  });
});

describe("Glyphs.select", () => {
  it("is Unicode unless told otherwise", () => {
    assert.strictEqual(Glyphs.select(), Glyphs.unicode);
    assert.strictEqual(Glyphs.select({}), Glyphs.unicode);
    assert.strictEqual(Glyphs.select({ term: "xterm-256color" }), Glyphs.unicode);
  });

  it("ascii: true and ascii: false decide, whatever TERM says", () => {
    assert.strictEqual(Glyphs.select({ ascii: true }), Glyphs.ascii);
    assert.strictEqual(Glyphs.select({ ascii: true, term: "xterm" }), Glyphs.ascii);
    assert.strictEqual(Glyphs.select({ ascii: false, term: "dumb" }), Glyphs.unicode);
  });

  it("auto, the default, is ASCII only for TERM=dumb, from the term the caller passes", () => {
    assert.strictEqual(Glyphs.select({ ascii: "auto", term: "dumb" }), Glyphs.ascii);
    assert.strictEqual(Glyphs.select({ term: "dumb" }), Glyphs.ascii);
    assert.strictEqual(Glyphs.select({ ascii: "auto", term: "xterm" }), Glyphs.unicode);
    assert.strictEqual(Glyphs.select({ ascii: "auto", term: "DUMB" }), Glyphs.unicode, "TERM is case-sensitive");
    assert.strictEqual(Glyphs.select({ ascii: "auto" }), Glyphs.unicode, "no term is not dumb");
  });
});
