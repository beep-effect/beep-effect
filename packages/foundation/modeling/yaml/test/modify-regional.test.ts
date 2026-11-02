// Region-confined scalar replacement for YamlFormat.modify (#659):
// a scalar write into an existing single-line scalar target splices ONLY the
// target's byte range — quote style preserved, CRLFs and every other byte
// outside the span untouched — and anything outside the fast path's
// preconditions keeps the whole-document pipeline's existing behavior.

import { Yaml, YamlStringifyOptions } from "@beep/yaml";
import { YamlFormat, YamlModificationError } from "@beep/yaml/YamlFormat";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const modify = YamlFormat.modify;
const modifyToString = YamlFormat.modifyToString;

describe("YamlFormat.modify region-confined scalar replacement (#659)", () => {
  it.effect("preserves regional NaN and positive zero while negative zero takes the full rewrite", () =>
    Effect.gen(function* () {
      const text = "a: 1 # value\r\nb: 2\r\n";
      assert.strictEqual(yield* modifyToString(text, ["a"], 0), "a: 0 # value\r\nb: 2\r\n");
      assert.strictEqual(yield* modifyToString(text, ["a"], Number.NaN), "a: .nan # value\r\nb: 2\r\n");
      assert.strictEqual(yield* modifyToString(text, ["a"], -0), "a: 0\nb: 2\n");
      const flow = "a: [1, 2] # value\r\n";
      assert.strictEqual(yield* modifyToString(flow, ["a", 0], 0), "a: [0, 2] # value\r\n");
      assert.strictEqual(yield* modifyToString(flow, ["a", 0], -0), "a: [0, 2] # value\n");
    })
  );

  it.effect("preserves single quotes and CRLF line endings — the issue repro", () =>
    Effect.gen(function* () {
      const text = "generated:\r\n  by: x\r\n  at: '2020-01-01T00:00:00Z'\r\n";
      const out = yield* modifyToString(text, ["generated", "at"], "2026-01-01T00:00:00Z");
      assert.strictEqual(out, "generated:\r\n  by: x\r\n  at: '2026-01-01T00:00:00Z'\r\n");
    })
  );

  it.effect("emits exactly one edit confined to the scalar span", () =>
    Effect.gen(function* () {
      const text = "generated:\n  by: x\n  at: '2020-01-01T00:00:00Z'\n";
      const edits = yield* modify(text, ["generated", "at"], "2026-01-01T00:00:00Z");
      assert.strictEqual(edits.length, 1);
      const edit = edits[0];
      assert.isDefined(edit);
      assert.strictEqual(Str.slice(edit.offset, edit.offset + edit.length)(text), "'2020-01-01T00:00:00Z'");
      assert.strictEqual(edit.content, "'2026-01-01T00:00:00Z'");
    })
  );

  it.effect("preserves double-quote style", () =>
    Effect.gen(function* () {
      const text = 'a: 1\nb: "two"\n';
      const out = yield* modifyToString(text, ["b"], "three");
      assert.strictEqual(out, 'a: 1\nb: "three"\n');
    })
  );

  it.effect("preserves plain style", () =>
    Effect.gen(function* () {
      const text = "a: hello\nb: 2\n";
      const edits = yield* modify(text, ["a"], "world");
      assert.strictEqual(edits.length, 1);
      assert.strictEqual(yield* modifyToString(text, ["a"], "world"), "a: world\nb: 2\n");
    })
  );

  it.effect("quotes a plain-target value that cannot stay plain, regionally", () =>
    Effect.gen(function* () {
      const text = "flag: value\nother: 1\n";
      const out = yield* modifyToString(text, ["flag"], "123");
      // "123" must not re-parse as a number: the stringifier quotes it.
      assert.ok(O.getOrNull(Str.match(/^flag: (['"])123\1\nother: 1\n$/)(out)));
      const edits = yield* modify(text, ["flag"], "123");
      assert.strictEqual(edits.length, 1);
      const edit = edits[0];
      assert.isDefined(edit);
      assert.ok(edit.offset + edit.length <= O.getOrElse(constant(-1))(Str.indexOf("\nother")(text)));
    })
  );

  it.effect("renders a non-string into a quoted target plain (type-correct), still regional", () =>
    Effect.gen(function* () {
      const text = "count: '5'\nkeep: x\n";
      const out = yield* modifyToString(text, ["count"], 7);
      assert.strictEqual(out, "count: 7\nkeep: x\n");
      assert.strictEqual((yield* modify(text, ["count"], 7)).length, 1);
    })
  );

  it.effect("handles booleans into quoted targets without quoting them; null keeps the pipeline", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* modifyToString('a: "x"\n', ["a"], true), "a: true\n");
      // null renders as an empty scalar in the whole-document pipeline
      // (`a:`), and the fast path deliberately defers to that convention.
      assert.strictEqual(yield* modifyToString("a: 'x'\n", ["a"], null), "a:\n");
    })
  );

  it.effect("preserves a same-line trailing comment (it lives outside the span)", () =>
    Effect.gen(function* () {
      const text = "a: 'v' # note\nb: 2\n";
      const out = yield* modifyToString(text, ["a"], "w");
      assert.strictEqual(out, "a: 'w' # note\nb: 2\n");
    })
  );

  it.effect("leaves LF bytes outside the span untouched, including EOF newline", () =>
    Effect.gen(function* () {
      const text = "# header\n\nlist:\n  - 'one'\n  - two\n\n# footer\n";
      const out = yield* modifyToString(text, ["list", 0], "uno");
      assert.strictEqual(out, "# header\n\nlist:\n  - 'uno'\n  - two\n\n# footer\n");
    })
  );

  it.effect("returns no edits for a no-op replacement", () =>
    Effect.gen(function* () {
      const text = "a: 'same'\r\n";
      assert.strictEqual((yield* modify(text, ["a"], "same")).length, 0);
      assert.strictEqual(yield* modifyToString(text, ["a"], "same"), text);
    })
  );

  it.effect("escapes an embedded single quote in single-quoted style", () =>
    Effect.gen(function* () {
      const text = "a: 'plain'\n";
      assert.strictEqual(yield* modifyToString(text, ["a"], "it's"), "a: 'it''s'\n");
    })
  );

  it.effect("escapes newlines in double-quoted style without touching the rest", () =>
    Effect.gen(function* () {
      const text = 'a: "x"\r\nb: 1\r\n';
      assert.strictEqual(yield* modifyToString(text, ["a"], "line1\nline2"), 'a: "line1\\nline2"\r\nb: 1\r\n');
    })
  );

  it.effect("falls back to the full pipeline when a single-quoted target gets an unquotable value", () =>
    Effect.gen(function* () {
      // A tab cannot live in single-quoted style; the whole-document
      // pipeline picks a style that can express it (double-quoted).
      const text = "a: 'x'\nb: 1\n";
      const out = yield* modifyToString(text, ["a"], "has\ttab");
      assert.ok(Str.includes("has\\ttab")(out));
      assert.ok((yield* modify(text, ["a"], "has\ttab")).length >= 1);
    })
  );

  it.effect("falls back for object values (synthesized subtree, existing behavior)", () =>
    Effect.gen(function* () {
      const text = "a: 'x'\nb: 1\n";
      const out = yield* modifyToString(text, ["a"], { nested: true });
      assert.ok(Str.includes("nested: true")(out));
      assert.ok((yield* modify(text, ["a"], { nested: true })).length >= 1);
    })
  );

  it.effect("falls back for removals and insertions (existing behavior)", () =>
    Effect.gen(function* () {
      const text = "a: 'x'\nb: 1\n";
      assert.strictEqual(yield* modifyToString(text, ["a"], undefined), "b: 1\n");
      assert.strictEqual(yield* modifyToString(text, ["c"], "new"), "a: 'x'\nb: 1\nc: new\n");
    })
  );

  it.effect("falls back for block scalar targets", () =>
    Effect.gen(function* () {
      const text = "a: |\n  line1\n  line2\nb: 1\n";
      // Exact whole-document pipeline output: the block scalar is replaced by
      // the stringifier's plain-scalar rendering. A weaker includes() check
      // would also pass if the fast path wrongly spliced the block header.
      assert.strictEqual(yield* modifyToString(text, ["a"], "replaced"), "a: replaced\nb: 1\n");
    })
  );

  it.effect("falls back for tagged targets and splices anchored ones", () =>
    Effect.gen(function* () {
      // The fallback re-serialises from the composed value: the replacement
      // scalar takes the stringifier's own rendering, with no tag carried
      // over from the replaced target. An anchor precedes the scalar's span,
      // so an anchored target splices and keeps its anchor and quote. Exact
      // outputs pin the tag bail precondition — includes() would pass under
      // either path.
      assert.strictEqual(yield* modifyToString("a: !str 'x'\nb: 1\n", ["a"], "y"), "a: y\nb: 1\n");
      assert.strictEqual(yield* modifyToString("a: &an 'x' # c\nb: 1\n", ["a"], "y"), "a: &an 'y' # c\nb: 1\n");
    })
  );

  it.effect("keeps a replaced anchor so aliases resolve to the new value", () =>
    Effect.gen(function* () {
      const mapping = yield* modifyToString("a: &an x # c\nb: *an\n", ["a"], "y");
      assert.strictEqual(mapping, "a: &an y # c\nb: *an\n");
      assert.deepStrictEqual(yield* Yaml.parse(mapping), { a: "y", b: "y" });

      const sequence = yield* modifyToString("- &an x\n- *an\n", [0], "y");
      assert.strictEqual(sequence, "- &an y\n- *an\n");
      assert.deepStrictEqual(yield* Yaml.parse(sequence), ["y", "y"]);

      // A block scalar takes the whole-document pipeline, which carries the
      // anchor onto the fresh replacement node.
      const block = yield* modifyToString("a: &an |\n  x\nb: *an\n", ["a"], "y");
      assert.strictEqual(block, "a: &an y\nb: *an\n");
      assert.deepStrictEqual(yield* Yaml.parse(block), { a: "y", b: "y" });

      const collection = yield* modifyToString("a: &an\n  k: 1\nb: *an\n", ["a"], { k: 2 });
      assert.deepStrictEqual(yield* Yaml.parse(collection), { a: { k: 2 }, b: { k: 2 } });
      const listed = yield* modifyToString("- &an x\n- *an\n", [0], ["y"]);
      assert.deepStrictEqual(yield* Yaml.parse(listed), [["y"], ["y"]]);
    })
  );

  it.effect("keeps an anchored empty-string replacement a quoted empty string", () =>
    Effect.gen(function* () {
      // The fresh node carrying the anchor has a synthetic zero-length span;
      // it must render its quotes, not the bare `&an` an empty source node
      // (null) renders as.
      const spliced = yield* modifyToString("a: &an x\nb: *an\n", ["a"], "");
      assert.strictEqual(spliced, "a: &an ''\nb: *an\n");
      assert.deepStrictEqual(yield* Yaml.parse(spliced), { a: "", b: "" });

      const block = yield* modifyToString("a: &an |\n  x\nb: *an\n", ["a"], "");
      assert.strictEqual(block, "a: &an ''\nb: *an\n");
      assert.deepStrictEqual(yield* Yaml.parse(block), { a: "", b: "" });

      // A document-shaping option forces the whole-document pipeline on a
      // spliceable target too.
      const rewritten = yield* modifyToString(
        "a: &an x\nb: *an\n",
        ["a"],
        "",
        YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" })
      );
      assert.strictEqual(rewritten, 'a: &an ""\nb: *an\n');
      assert.deepStrictEqual(yield* Yaml.parse(rewritten), { a: "", b: "" });

      // An anchor over an empty source node still reads null, and a tag still fixes its value.
      assert.deepStrictEqual(yield* Yaml.parse(yield* modifyToString("a: &an\nb: *an\n", ["c"], 1)), {
        a: null,
        b: null,
        c: 1,
      });
      assert.deepStrictEqual(yield* Yaml.parse(yield* modifyToString("a: &an !!str\nb: *an\n", ["c"], 1)), {
        a: "",
        b: "",
        c: 1,
      });
    })
  );

  it.effect("falls back for a multi-line quoted span", () =>
    Effect.gen(function* () {
      const text = "a: 'one\n  two'\nb: 1\n";
      assert.strictEqual(yield* modifyToString(text, ["a"], "joined"), "a: joined\nb: 1\n");
    })
  );

  it.effect("falls back to the whole-document pipeline on an explicit defaultScalarStyle", () =>
    Effect.gen(function* () {
      const text = "a: 'x'\nb: 1\n";
      // The explicit style request skips the fast path; the pipeline renders
      // the replacement as it always has (pins the fallback branch).
      const out = yield* modifyToString(
        text,
        ["a"],
        "y",
        YamlStringifyOptions.make({ defaultScalarStyle: "double-quoted" })
      );
      assert.strictEqual(out, "a: y\nb: 1\n");
    })
  );

  it.effect("falls back to the whole-document pipeline on forceDefaultStyles", () =>
    Effect.gen(function* () {
      // Canonical mode drops quotes, comments and CRLFs; the fast path would
      // preserve all three. Pins the `forceDefaultStyles` bail clause.
      assert.strictEqual(
        yield* modifyToString(
          "a: 'x' # note\r\nb: 1\r\n",
          ["a"],
          "y",
          YamlStringifyOptions.make({ forceDefaultStyles: true })
        ),
        "a: y\nb: 1\n"
      );
    })
  );

  it.effect("falls back to the whole-document pipeline on sortKeys", () =>
    Effect.gen(function* () {
      // The fast path would splice in place and return the UNSORTED
      // "b: 'y'\na: 1\n"; the pipeline sorts keys and drops the quotes.
      // Deleting the `sortKeys === true` bail clause must fail this test.
      assert.strictEqual(
        yield* modifyToString("b: 'x'\na: 1\n", ["b"], "y", YamlStringifyOptions.make({ sortKeys: true })),
        "a: 1\nb: y\n"
      );
    })
  );

  it.effect("falls back to the whole-document pipeline on indent", () =>
    Effect.gen(function* () {
      // The fast path would keep the original 4-space indentation; the
      // pipeline re-indents to 2. Pins the `indent !== undefined` clause.
      assert.strictEqual(
        yield* modifyToString("a:\n    k: 'x'\n", ["a", "k"], "y", YamlStringifyOptions.make({ indent: 2 })),
        "a:\n  k: y\n"
      );
    })
  );

  it.effect("falls back to the whole-document pipeline on finalNewline", () =>
    Effect.gen(function* () {
      // The EOF newline sits outside the scalar span, so the fast path would
      // keep it; the pipeline honours finalNewline:false. Pins the clause.
      assert.strictEqual(
        yield* modifyToString("a: 'x'\n", ["a"], "y", YamlStringifyOptions.make({ finalNewline: false })),
        "a: y"
      );
    })
  );

  it.effect("falls back to the whole-document pipeline on indentSequences", () =>
    Effect.gen(function* () {
      // The fast path would keep the indented sequence item; the pipeline
      // dedents it. Pins the `indentSequences !== undefined` clause.
      assert.strictEqual(
        yield* modifyToString("a:\n  - 'x'\n", ["a", 0], "y", YamlStringifyOptions.make({ indentSequences: false })),
        "a:\n- y\n"
      );
    })
  );

  it.effect("keeps typed navigation errors unchanged", () =>
    Effect.gen(function* () {
      const text = "a: 1\n";
      const error = yield* Effect.flip(YamlFormat.modify(text, ["missing", "deeper"], "v"));
      assert.ok(S.is(YamlModificationError)(error));
      assert.deepStrictEqual(error.path, ["missing", "deeper"]);
    })
  );

  it.effect("still refuses multi-document streams on the fast path shape and splices under directives", () =>
    Effect.gen(function* () {
      const stream = "a: '1'\n---\na: '2'\n";
      const streamResult = yield* Effect.exit(YamlFormat.modify(stream, ["a"], "x"));
      assertExitFailure(streamResult, streamResult.pipe(Exit.getCause, O.getOrThrow));
      // The splice touches only the target span, so the directive prologue keeps its bytes.
      assert.strictEqual(yield* modifyToString("%YAML 1.2\n---\na: '1'\n", ["a"], "x"), "%YAML 1.2\n---\na: 'x'\n");
    })
  );

  it.effect("splices sequence elements regionally", () =>
    Effect.gen(function* () {
      const text = "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - c\r\n";
      assert.strictEqual(yield* modifyToString(text, ["list", 0], "A"), "list:\r\n  - 'A'\r\n  - \"b\"\r\n  - c\r\n");
      assert.strictEqual(yield* modifyToString(text, ["list", 1], "B"), "list:\r\n  - 'a'\r\n  - \"B\"\r\n  - c\r\n");
      assert.strictEqual(yield* modifyToString(text, ["list", 2], "C"), "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - C\r\n");
    })
  );

  it.effect(
    "quotes a plain replacement carrying a flow indicator when the target sits in a flow collection (#695)",
    () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* modifyToString("a: [x, y]\n", ["a", 0], "p, q"), "a: ['p, q', y]\n");
        assert.strictEqual(yield* modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p,q"), "a: {b: 'p,q', c: y}\n");
        assert.strictEqual(yield* modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p}"), "a: {b: 'p}', c: y}\n");
        // Still regional: one edit, confined to the target span.
        const edits = yield* modify("a: [x, y]\n", ["a", 0], "p, q");
        assert.strictEqual(edits.length, 1);
        const edit = edits[0];
        assert.isDefined(edit);
        assert.strictEqual(edit.offset, 4);
        assert.strictEqual(edit.length, 1);
        assert.strictEqual(edit.content, "'p, q'");
      })
  );

  it.effect("a replacement without a flow indicator stays plain inside a flow collection", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* modifyToString("a: [x, y]\n", ["a", 0], "p q"), "a: [p q, y]\n");
    })
  );

  it.effect("finds the first key behind a leading BOM and keeps the BOM (#694)", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* modifyToString("\uFEFFa: 'x'\nb: 1\n", ["a"], "y"), "\uFEFFa: 'y'\nb: 1\n");
    })
  );
});
