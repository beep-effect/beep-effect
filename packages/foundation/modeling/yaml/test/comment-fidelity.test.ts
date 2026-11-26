import {
  Yaml,
  YamlDocument,
  YamlFormat,
  YamlFormattingOptions,
  YamlMap,
  YamlScalar,
  YamlSeq,
  YamlStringifyOptions,
  YamlVisitor,
} from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { fixtureText } from "./fixture-text.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const firstMap = (doc: YamlDocument): YamlMap => {
  assert.instanceOf(doc.contents, YamlMap);
  assert.ok(S.is(YamlMap)(doc.contents));
  return doc.contents;
};

const JsonString = S.fromJsonString(S.String);

describe("invalid block-scalar header comments", () => {
  it("strips separated comments while preserving header bytes and line endings", () => {
    for (const header of ["> hello ", "| invalid\t", "|++ ", "|22\t"]) {
      for (const newline of ["\n", "\r", "\r\n"]) {
        const source = `${header}# comment${newline}`;
        assert.strictEqual(Yaml.stripComments(source), `${header}${newline}`);
        assert.strictEqual(Yaml.stripComments(source, "_"), `${header}_________${newline}`);
      }
    }
  });

  it("preserves unseparated hashes, block-scalar body hashes and other error content", () => {
    for (const source of [
      "> hello#content\n",
      "|#content\n",
      "|\n  # body\n",
      '"unterminated # content',
      "'unterminated # content",
    ]) {
      assert.strictEqual(Yaml.stripComments(source), source);
      assert.strictEqual(Yaml.stripComments(source, "_"), source);
    }
  });
});

describe("comment fidelity (#127)", () => {
  describe("composer attribution", () => {
    it.effect("attributes an own-line comment FORWARD to the following pair", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n\n# section\nb: 2\n");
        const map = firstMap(doc);
        const [a, b] = map.items;
        assert.isUndefined(a?.key.commentBefore);
        assert.isUndefined(a?.value?.comment);
        assert.strictEqual(
          b?.key.commentBefore,
          " section",
          "the issue's exact case: `# section` documents `b`, not `a`"
        );
        assert.strictEqual(b?.key.spaceBefore, true);
      })
    );

    it.effect("attributes a same-line comment as the pair's trailing comment", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1 # trailing a\nb: 2\n");
        const map = firstMap(doc);
        assert.strictEqual(map.items[0]?.value?.comment, " trailing a");
        assert.isUndefined(map.items[1]?.value?.comment);
      })
    );

    it.effect("joins consecutive leading comment lines with a newline", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n# line one\n# line two\nb: 2\n");
        const map = firstMap(doc);
        assert.strictEqual(map.items[1]?.key.commentBefore, " line one\n line two");
      })
    );

    it.effect("preserves a blank line without comments as spaceBefore", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n\nb: 2\n");
        const map = firstMap(doc);
        assert.isUndefined(map.items[0]?.key.spaceBefore);
        assert.strictEqual(map.items[1]?.key.spaceBefore, true);
        assert.isUndefined(map.items[1]?.key.commentBefore);
      })
    );

    it.effect("own-line comments after a mapping's last entry become the mapping's trailing comment", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a:\n  b: 1\n  # end of a\nc: 2\n");
        const map = firstMap(doc);
        const aValue = map.items[0]?.value;
        assert.instanceOf(aValue, YamlMap);
        assert.ok(S.is(YamlMap)(aValue));
        assert.strictEqual(aValue.comment, " end of a");
        assert.isUndefined(aValue.items[0]?.value?.comment, "the comment must not attach backward to the b entry");
      })
    );

    it.effect("attributes seq item comments: own-line forward, same-line trailing", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n");
        const map = firstMap(doc);
        const seq = map.items[0]?.value;
        assert.instanceOf(seq, YamlSeq);
        assert.ok(S.is(YamlSeq)(seq));
        assert.strictEqual(
          seq.commentBefore,
          " first step",
          "a comment between `key:` and the sequence leads the VALUE node (the sequence itself), the same attachment the yaml npm package uses"
        );
        const [first, second] = seq.items;
        assert.instanceOf(first, YamlScalar);
        assert.ok(S.is(YamlScalar)(first));
        assert.isUndefined(first.commentBefore);
        assert.ok(S.is(YamlScalar)(second));
        assert.strictEqual(second.commentBefore, " mid", "comments between items lead the next item");
        assert.strictEqual(second.comment, " inline");
      })
    );

    it.effect("a key comment and a value comment both survive — neither shadows the other", () =>
      Effect.gen(function* () {
        const source = "a: # kc\n  1 # vc\n";
        const doc = yield* YamlDocument.parse(source);
        const pair = firstMap(doc).items[0];
        assert.strictEqual(
          pair?.key.comment,
          " kc",
          "the key line carries its own comment because the value renders below"
        );
        assert.strictEqual(pair?.value?.comment, " vc", "the value carries a trailing comment on its own line");
        const out = yield* doc.stringify();
        assert.strictEqual(
          (O.getOrNull(Str.match(/#/g)(out)) ?? []).length,
          2,
          `a comment was dropped (an emitter that returns the key's comment and stops drops the value's silently): ${yield* S.encodeEffect(JsonString)(out)}`
        );
        assert.strictEqual(YamlFormat.formatToString(out), out);
      })
    );

    it.effect("a key-line comment ahead of a block value trails the KEY", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: # c\n  b: 1\n");
        assert.strictEqual(
          firstMap(doc).items[0]?.key.comment,
          " c",
          "it was written on the key's line and it stays there"
        );

        const spilled = yield* YamlDocument.parse("a:\n  # c\n  b: 1\n");
        assert.isUndefined(firstMap(spilled).items[0]?.key.comment);
        assert.strictEqual(
          firstMap(spilled).items[0]?.value?.commentBefore,
          " c",
          "the own-line form below the key is a different shape and keeps its own line, so both round-trip byte-intact"
        );
      })
    );

    it.effect("an own-line comment between `:` and the value leads the value node", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a:\n  # note\n  1\n");
        const map = firstMap(doc);
        const value = map.items[0]?.value;
        assert.instanceOf(value, YamlScalar);
        assert.ok(S.is(YamlScalar)(value));
        assert.strictEqual(value.commentBefore, " note");
      })
    );

    it.effect("stores RAW post-# text: alignment, no-space and bare # survive", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("#no-space\n#   aligned\n#\na: 1\n");
        const map = firstMap(doc);
        assert.strictEqual(
          map.items[0]?.key.commentBefore,
          "no-space\n   aligned\n ",
          'reference parity: raw slices; a bare `#` stores " " so it is distinguishable from an embedded blank line ("")'
        );
        assert.isUndefined(
          doc.commentBefore,
          "with no `---` to separate it, a header block is just the first own-line comment in the item stream, so it leads the first key"
        );
      })
    );

    it.effect("embeds a blank line WITHIN a comment run; blank BEFORE the run is spaceBefore", () =>
      Effect.gen(function* () {
        const interior = yield* YamlDocument.parse("a: 1\n# one\n\n# two\nb: 2\n");
        const im = firstMap(interior);
        assert.strictEqual(im.items[1]?.key.commentBefore, " one\n\n two");
        assert.isUndefined(im.items[1]?.key.spaceBefore);

        const before = yield* YamlDocument.parse("a: 1\n\n# one\n# two\nb: 2\n");
        const bm = firstMap(before);
        assert.strictEqual(bm.items[1]?.key.commentBefore, " one\n two");
        assert.strictEqual(bm.items[1]?.key.spaceBefore, true);

        const after = yield* YamlDocument.parse("a: 1\n# one\n\nb: 2\n");
        const am = firstMap(after);
        assert.strictEqual(am.items[1]?.key.commentBefore, " one\n");
        assert.isUndefined(am.items[1]?.key.spaceBefore);
      })
    );

    it.effect("a shallow terminal comment escapes the nested block to the next outer key", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("c:\n  d: 1\n# tail\n\ne: 3\n");
        const map = firstMap(doc);
        const cValue = map.items[0]?.value;
        assert.instanceOf(cValue, YamlMap);
        assert.ok(S.is(YamlMap)(cValue));
        assert.isUndefined(
          cValue.comment,
          "only a comment at the nested content's column stays the nested map's trailing comment"
        );
        assert.strictEqual(
          map.items[1]?.key.commentBefore,
          " tail\n",
          "reference parity: a column-0 `# tail` after `c:`'s nested block documents `e`, not the nested block"
        );
      })
    );

    it.effect("joins a multi-line header comment onto the first key", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# one\n# two\na: 1\n");
        assert.strictEqual(firstMap(doc).items[0]?.key.commentBefore, " one\n two");
      })
    );

    it.effect("comments on BOTH sides of a `---` marker keep their sides", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# before\n---\n# after\na: 1\n");
        assert.strictEqual(doc.commentBefore, " before");
        assert.strictEqual(
          doc.contents?.commentBefore,
          " after",
          "the marker partitions the leading run per comment; deciding once from the first comment merged both sides into one block"
        );
        for (const text of ["# before\n---\n# after\na: 1\n", "# b1\n# b2\n---\n# a1\n# a2\na: 1\n"]) {
          assert.strictEqual(
            YamlFormat.formatToString(text),
            text,
            "re-emitting the merged block above the marker is lossless, but wrong, and a fixed point, so it stays wrong quietly"
          );
        }
      })
    );

    it.effect("a header AFTER a `---` marker leads the root node", () =>
      Effect.gen(function* () {
        const after = yield* YamlDocument.parse("---\n# hdr\na: 1\n");
        assert.isUndefined(after.commentBefore);
        assert.strictEqual(after.contents?.commentBefore, " hdr");
      })
    );

    it.effect("a header AHEAD of a `---` marker is the document's commentBefore", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# hdr\n---\na: 1\n");
        assert.strictEqual(
          doc.commentBefore,
          " hdr",
          "the CST hands the header over in a position the leading branch can claim; this is not a known gap"
        );
        assert.isUndefined(
          doc.comment,
          "`decorateDocumentSourceMultiline` runs on every parse and once wrote `commentBefore` into the `comment` key, turning every document header into a trailing comment; its conditional spreads compiled clean where TS1117 caught the two sibling sites of that rename as duplicate keys"
        );
        assert.strictEqual(YamlFormat.formatToString("# hdr\n---\na: 1\n"), "# hdr\n---\na: 1\n");
      })
    );

    it.effect("captures comments after the document end marker as the document's comment", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n...\n# after\n");
        assert.strictEqual(doc.comment, " after");
        assert.isUndefined(doc.commentBefore);
      })
    );
  });

  describe("stringifier emission", () => {
    const roundtrips = Effect.fn("roundtrips")(function* (source: string, options?: YamlStringifyOptions) {
      const doc = yield* YamlDocument.parse(source);
      const out = yield* doc.stringify(options);
      assert.strictEqual(out, source);
      const again = yield* YamlDocument.parse(out);
      const stringify1 = yield* again.stringify(options);
      assert.strictEqual(stringify1, out, "the emission is stable: parse(out) stringifies identically");
    });

    it.effect("emits leading, trailing and section comments in block mappings", () =>
      roundtrips("# doc header\n# line two\na: 1 # trailing a\n\n# section\nb: 2\n")
    );

    it.effect("emits a mapping's trailing comment after its last entry", () =>
      roundtrips("a:\n  b: 1\n  # end of a\nc: 2\n")
    );

    it.effect("emits blank lines preserved as spaceBefore", () => roundtrips("a: 1\n\nb: 2\n"));

    it.effect("emits raw comment text byte-intact: no-space, alignment, bare #", () =>
      roundtrips("a: 1 #tight\n#no-space\n#   aligned\n#\nb: 2\n")
    );

    it.effect("the all-space capture escape keeps the `#` and `# ` spellings apart from an embedded blank line", () =>
      Effect.gen(function* () {
        yield* roundtrips("a: 1\n#\nb: 2\n");
        yield* roundtrips("a: 1\n# \nb: 2\n");
        yield* roundtrips("a: 1 #\n");
        yield* roundtrips("a: 1 # \n");
        yield* roundtrips("# one\n\n# two\na: 1\n");
      })
    );

    it.effect("an empty document keeps its markers and trailing comment (PR #338)", () =>
      Effect.gen(function* () {
        yield* roundtrips("---\n...\n# tail\n");
        yield* roundtrips("---\n");
        const doc = yield* YamlDocument.parse("---\n...\n# tail\n");
        assert.isNull(doc.contents);
        assert.strictEqual(doc.comment, " tail");
        assert.strictEqual(YamlFormat.formatToString("---\n...\n# tail\n"), "---\n...\n# tail\n");
      })
    );

    it.effect("emits blank lines within and after a comment run byte-intact", () =>
      roundtrips("a: 1\n# one\n\n# two\nb: 2\nc:\n  d: 1\n# tail\n\ne: 3\n")
    );

    it.effect("keeps a key-line comment on the key line when the value starts below", () =>
      roundtrips("a: # c\n  b: 1\n")
    );

    it.effect("emits the document trailing comment after the end marker", () =>
      roundtrips("a: 1\n...\n# after\n# more\n")
    );

    it.effect("emits a value's own leading comment above the spilled value", () => roundtrips("a:\n  # note\n  1\n"));

    it.effect("emits seq item comments in block style", () =>
      roundtrips(
        "steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n",
        YamlStringifyOptions.make({ indentSequences: true })
      )
    );

    it.effect("emits comment-carrying flow collections in multi-line flow layout", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("m: { a: 1, # c\n  b: 2 }\n");
        const out = yield* doc.stringify();
        assert.strictEqual(
          out,
          "m:\n  {\n    a: 1, # c\n    b: 2\n  }\n",
          "single-line flow cannot carry `#` comments (they would swallow the closing bracket); pin the exact FIRST emission (multi-line flow layout), not just comment presence"
        );
        assert.include(out, "a: 1, # c");
        assert.include(out, "{");
        const parsed2 = yield* Yaml.parse(out);
        assert.deepStrictEqual(parsed2, { m: { a: 1, b: 2 } }, "the multi-line flow re-layout preserves semantics");
        const again = yield* YamlDocument.parse(out);
        const stringify3 = yield* again.stringify();
        assert.strictEqual(stringify3, out, "idempotent from the second pass on");
      })
    );

    it.effect("emits comment-carrying flow sequences in multi-line flow layout", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("s: [ one, # c\n  two ]\n");
        const out = yield* doc.stringify();
        assert.strictEqual(
          out,
          "s:\n  [\n    one, # c\n    two\n  ]\n",
          "pin the exact FIRST emission (multi-line flow layout), not just comment presence"
        );
        assert.include(out, "# c");
        assert.include(out, "[");
        const parsed4 = yield* Yaml.parse(out);
        assert.deepStrictEqual(parsed4, { s: ["one", "two"] });
        const again = yield* YamlDocument.parse(out);
        const stringify5 = yield* again.stringify();
        assert.strictEqual(stringify5, out);
      })
    );

    it.effect("flow: an own-line comment attributes FORWARD to the next item, first emit a fixed point (PR #338)", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("[ a\n# own\n, b ]\n");
        const seq = doc.contents;
        assert.instanceOf(seq, YamlSeq);
        assert.ok(S.is(YamlSeq)(seq));
        const second = seq.items[1];
        assert.ok(S.is(YamlScalar)(second));
        assert.strictEqual(second.commentBefore, " own");
        const out = yield* doc.stringify();
        assert.strictEqual(
          out,
          "[\n  a,\n  # own\n  b\n]\n",
          "backward attachment would render `a, # own`, which a REPARSE attributes forward again, so the first emission would not be a fixed point"
        );
        const again = yield* YamlDocument.parse(out);
        const stringify6 = yield* again.stringify();
        assert.strictEqual(stringify6, out);
      })
    );

    it.effect(
      "flow: a same-line comment still trails its item; the following own-line comment goes forward (PR #338)",
      () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("[ a # t\n# own\n, b ]\n");
          const seq = doc.contents;
          assert.ok(S.is(YamlSeq)(seq));
          const first = seq.items[0];
          assert.ok(S.is(YamlScalar)(first));
          assert.strictEqual(first.comment, " t");
          const second = seq.items[1];
          assert.ok(S.is(YamlScalar)(second));
          assert.strictEqual(second.commentBefore, " own");
          const out = yield* doc.stringify();
          assert.strictEqual(out, "[\n  a, # t\n  # own\n  b\n]\n");
          const again = yield* YamlDocument.parse(out);
          const stringify7 = yield* again.stringify();
          assert.strictEqual(stringify7, out);
        })
    );

    it.effect("flow: an own-line comment after the last item becomes the sequence's trailing comment (PR #338)", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("[ a,\nb\n# own\n]\n");
        const seq = doc.contents;
        assert.ok(S.is(YamlSeq)(seq));
        assert.strictEqual(seq.comment, " own");
        const out = yield* doc.stringify();
        assert.strictEqual(
          out,
          "[\n  a,\n  b\n  # own\n]\n",
          "pin the exact FIRST emission: a stringifier that dropped or relocated `# own` could still fixed-point on its reduced output"
        );
        const again = yield* YamlDocument.parse(out);
        const stringify8 = yield* again.stringify();
        assert.strictEqual(stringify8, out);
      })
    );

    describe("flow blank-line fidelity, closers indented past the block level", () => {
      it.effect("flow seq: the blank line before an own-line comment run survives", () =>
        Effect.gen(function* () {
          const source = "a: [\n  1,\n\n  # c\n  2\n  ]\n";
          const doc = yield* YamlDocument.parse(source);
          const seq = firstMap(doc).items[0]?.value;
          assert.instanceOf(seq, YamlSeq);
          assert.ok(S.is(YamlSeq)(seq));
          const second = seq.items[1];
          assert.ok(S.is(YamlScalar)(second));
          assert.strictEqual(second.commentBefore, " c");
          assert.strictEqual(second.spaceBefore, true);
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(
            out,
            "a:\n  [\n    1,\n\n    # c\n    2\n  ]\n",
            "the first emission is the expected multi-line flow re-layout, pinned exactly INCLUDING the blank line before the fixed point"
          );
          assert.strictEqual(YamlFormat.formatToString(out), out);
        })
      );

      it.effect("flow map control: the blank line before an own-line comment run stays preserved", () =>
        Effect.gen(function* () {
          const source = "m: {\n  a: 1,\n\n  # c\n  b: 2\n  }\n";
          const doc = yield* YamlDocument.parse(source);
          const map = firstMap(doc).items[0]?.value;
          assert.instanceOf(map, YamlMap);
          assert.ok(S.is(YamlMap)(map));
          assert.strictEqual(map.items[1]?.key.commentBefore, " c");
          assert.strictEqual(map.items[1]?.key.spaceBefore, true);
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(out, "m:\n  {\n    a: 1,\n\n    # c\n    b: 2\n  }\n");
          assert.strictEqual(YamlFormat.formatToString(out), out);
        })
      );

      it.effect("flow seq: the blank line before the TERMINAL comment run survives as a leading embed", () =>
        Effect.gen(function* () {
          const source = "a: [\n  1,\n  2\n\n  # tail\n  ]\n";
          const doc = yield* YamlDocument.parse(source);
          const seq = firstMap(doc).items[0]?.value;
          assert.instanceOf(seq, YamlSeq);
          assert.ok(S.is(YamlSeq)(seq));
          assert.strictEqual(seq.comment, "\n tail");
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(out, "a:\n  [\n    1,\n    2\n\n    # tail\n  ]\n");
          assert.strictEqual(YamlFormat.formatToString(out), out);
        })
      );

      it.effect("flow seq: a blank WITHIN a comment run embeds as an empty line", () =>
        Effect.gen(function* () {
          const source = "a: [\n  1,\n\n  # c1\n\n  # c2\n  2\n  ]\n";
          const doc = yield* YamlDocument.parse(source);
          const seq = firstMap(doc).items[0]?.value;
          assert.instanceOf(seq, YamlSeq);
          assert.ok(S.is(YamlSeq)(seq));
          const second = seq.items[1];
          assert.ok(S.is(YamlScalar)(second));
          assert.strictEqual(second.commentBefore, " c1\n\n c2");
          assert.strictEqual(second.spaceBefore, true);
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(out, "a:\n  [\n    1,\n\n    # c1\n\n    # c2\n    2\n  ]\n");
          assert.strictEqual(YamlFormat.formatToString(out), out);
        })
      );

      it.effect("an inline flow map with only a trailing comment stays on one line", () =>
        Effect.gen(function* () {
          const source = "a: {b: 1} # t\n";
          const parsed9 = yield* YamlDocument.parse(source);
          const map = firstMap(parsed9).items[0]?.value;
          assert.instanceOf(map, YamlMap);
          assert.ok(S.is(YamlMap)(map));
          assert.strictEqual(map.comment, " t");
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(
            out,
            "a: {b: 1} # t\n",
            "a collection's OWN trailing comment renders AFTER the closing bracket, so it cannot swallow it and is no reason to expand a single-line flow; only a comment on an ITEM forces the one-entry-per-line layout, and yaml@2.9.0 re-emits both spellings as `a: { b: 1 } # t`"
          );
          assert.strictEqual(YamlFormat.formatToString(out), out);
        })
      );

      it("an inline flow seq with only a trailing comment stays on one line", () => {
        const source = "a: [1, 2] # t\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(out, "a: [1, 2] # t\n");
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });

      it("an INNER comment still forces the multi-line flow layout", () => {
        const source = "a: {\n  b: 1 # inner\n  }\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(out, "a:\n  {\n    b: 1 # inner\n  }\n");
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });

      it.effect("flow seq nested in a block mapping keeps the blank line", () =>
        Effect.gen(function* () {
          const source = "top:\n  inner: [\n    1,\n\n    # c\n    2\n    ]\n";
          const out = YamlFormat.formatToString(source);
          assert.strictEqual(out, "top:\n  inner:\n    [\n      1,\n\n      # c\n      2\n    ]\n");
          assert.strictEqual(YamlFormat.formatToString(out), out);
          const parsed10 = yield* Yaml.parse(out);
          assert.deepStrictEqual(parsed10, { top: { inner: [1, 2] } });
        })
      );
    });

    it.effect("emits comments on explicit-key spill pairs (#323 interaction)", () =>
      Effect.gen(function* () {
        const key = `pkg-a@1.0.0(${Str.repeat(1100)("a")})`;
        const source = `# entry\n? ${key}\n: 1 # one\n`;
        const doc = yield* YamlDocument.parse(source);
        const out = yield* doc.stringify();
        assert.include(out, "# entry");
        assert.include(out, ": 1 # one");
        const again = yield* YamlDocument.parse(out);
        const stringify11 = yield* again.stringify();
        assert.strictEqual(stringify11, out);
      })
    );

    describe("block-scalar header comments (#341)", () => {
      const roundtrips: ReadonlyArray<readonly [string, string]> = [
        ["map literal", "a: | # hdr\n  body\n"],
        ["map folded", "a: > # hdr\n  body\n"],
        ["seq literal", "- | # hdr\n  body\n"],
        ["seq folded", "- > # hdr\n  body\n"],
        ["map strip-chomp", "a: |- # hdr\n  body\n"],
        ["seq strip-chomp", "- |- # hdr\n  body\n"],
        ["map redundant keep-chomp", "a: |+ # hdr\n  body\n"],
        ["seq redundant keep-chomp", "- |+ # hdr\n  body\n"],
        ["map folded redundant keep-chomp", "a: >+ # hdr\n  body\n"],
        ["map redundant indent indicator", "a: |2 # hdr\n  body\n"],
        ["map folded redundant indent indicator", "a: >2 # hdr\n  body\n"],
        ["map redundant indent indicator with keep", "a: |2+ # hdr\n  body\n"],
        ["map redundant keep-chomp bare header", "a: |+\n  body\n"],
        ["map redundant indent indicator bare header", "a: |2\n  body\n"],
      ];
      for (const [name, source] of roundtrips) {
        it.effect(`roundtrips byte-intact: ${name}`, () =>
          Effect.gen(function* () {
            const doc = yield* YamlDocument.parse(source);
            const out = yield* doc.stringify();
            assert.strictEqual(
              out,
              source,
              "the header line is the ONE line of a block scalar that legally carries a `#` comment, and the stringifier re-emits it there; an explicit indicator the value alone cannot derive re-emits too"
            );
            const again = yield* YamlDocument.parse(out);
            const stringify12 = yield* again.stringify();
            assert.strictEqual(stringify12, out);
          })
        );
      }

      it.effect("captures the header comment on the SCALAR node", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("a: | # hdr\n  body\n");
          const pair = firstMap(doc).items[0];
          assert.isUndefined(pair?.key.commentBefore);
          const scalar = pair?.value;
          assert.instanceOf(scalar, YamlScalar);
          assert.ok(S.is(YamlScalar)(scalar));
          assert.strictEqual(
            scalar.comment,
            " hdr",
            "the lexer packs the header comment inside the scalar's CST token, so makeScalar captures it as the SCALAR's trailing comment (reference `yaml` parity); the header line IS the line the value ends on, so it needs no concept of its own"
          );
          assert.strictEqual(scalar.value, "body\n");
        })
      );

      it.effect("captures a seq item's header comment on the item scalar", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("- | # hdr\n  body\n");
          assert.instanceOf(doc.contents, YamlSeq);
          assert.ok(S.is(YamlSeq)(doc.contents));
          const item = doc.contents.items[0];
          assert.instanceOf(item, YamlScalar);
          assert.ok(S.is(YamlScalar)(item));
          assert.strictEqual(item.comment, " hdr");
        })
      );

      it.effect("emits the header comment on an explicit-key spill pair's value header", () =>
        Effect.gen(function* () {
          const key = `pkg-a@1.0.0(${Str.repeat(1100)("a")})`;
          const source = `? ${key}\n: | # hdr\n  body\n`;
          const doc = yield* YamlDocument.parse(source);
          const out = yield* doc.stringify();
          assert.strictEqual(out, source);
          const again = yield* YamlDocument.parse(out);
          const stringify13 = yield* again.stringify();
          assert.strictEqual(stringify13, out);
        })
      );

      it.effect("a key-line comment and a header comment both land on the value, in different slots", () =>
        Effect.gen(function* () {
          const source = "a: # pair\n  | # hdr\n  body\n";
          const doc = yield* YamlDocument.parse(source);
          const pair = firstMap(doc).items[0];
          assert.strictEqual(pair?.key.comment, " pair");
          const scalar = pair?.value;
          assert.instanceOf(scalar, YamlScalar);
          assert.ok(S.is(YamlScalar)(scalar));
          assert.strictEqual(scalar.comment, " hdr");
          const out = yield* doc.stringify();
          assert.strictEqual(
            (O.getOrNull(Str.match(/#/g)(out)) ?? []).length,
            2,
            "both comments want the key line, because the block-scalar header hoists onto it; the header wins the line and the key's comment spills above, one comment per line, neither dropped"
          );
          const again = yield* YamlDocument.parse(out);
          const stringify14 = yield* again.stringify();
          assert.strictEqual(stringify14, out);
        })
      );

      it.effect("a key-line comment rides along when the header hoists onto the key line", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("a: # pair\n  |\n  body\n");
          const out = yield* doc.stringify();
          assert.strictEqual(
            out,
            "a: | # pair\n  body\n",
            "the scalar's header is emitted on the key line, so a comment written on that line lands after it: relocation within the same line, not across lines"
          );
          const again = yield* YamlDocument.parse(out);
          const stringify15 = yield* again.stringify();
          assert.strictEqual(stringify15, out, "the same-line relocation is a fixed point");
        })
      );

      it.effect("captures the explicit indicators on the scalar: chomp keep and blockIndent", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("a: |2+ # hdr\n  body\n");
          const scalar = firstMap(doc).items[0]?.value;
          assert.ok(S.is(YamlScalar)(scalar));
          assert.strictEqual(scalar.chomp, "keep");
          assert.strictEqual(scalar.blockIndent, 2);
          assert.strictEqual(scalar.value, "body\n");
          const doc2 = yield* YamlDocument.parse("a: |\n  body\n");
          const scalar2 = firstMap(doc2).items[0]?.value;
          assert.ok(S.is(YamlScalar)(scalar2));
          assert.isUndefined(scalar2.blockIndent, "no explicit indicator, no captured field");
        })
      );

      it.effect("an explicit indicator that no longer matches the rendered indent normalizes away", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("a: |4\n    body\n");
          const scalar = firstMap(doc).items[0]?.value;
          assert.ok(S.is(YamlScalar)(scalar));
          assert.strictEqual(scalar.blockIndent, 4);
          assert.strictEqual(scalar.value, "body\n");
          const stringify16 = yield* doc.stringify();
          assert.strictEqual(
            stringify16,
            "a: |\n  body\n",
            "blockIndent 4 with a rendered indent of 2 would lie about the content columns, so the header falls back to auto-detection"
          );
        })
      );

      it.effect("a +/- inside the header comment is not a chomp indicator (regression)", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("a: | # x+y\n  body\n");
          const scalar = firstMap(doc).items[0]?.value;
          assert.ok(S.is(YamlScalar)(scalar));
          assert.strictEqual(
            scalar.chomp,
            "clip",
            "getBlockChomp once scanned the whole header line, so a `+` in `# x+y` parsed as keep-chomp and re-emitted as `|+`, changing what the document means"
          );
          const stringify17 = yield* doc.stringify();
          assert.strictEqual(stringify17, "a: | # x+y\n  body\n");

          const doc2 = yield* YamlDocument.parse("a: | # strip-me\n  body\n");
          const scalar2 = firstMap(doc2).items[0]?.value;
          assert.ok(S.is(YamlScalar)(scalar2));
          assert.strictEqual(scalar2.chomp, "clip");
        })
      );

      it("survives the YamlFormat path", () => {
        const text = "a: | # hdr\n  body\nb: 1\n";
        assert.strictEqual(YamlFormat.formatToString(text), text);
      });
    });

    describe("document-root block-scalar header comments (#349)", () => {
      const roundtrips: ReadonlyArray<readonly [string, string]> = [
        ["literal", "| # hdr\n  body\n"],
        ["folded", "> # hdr\n  body\n"],
        ["strip-chomp", "|- # hdr\n  body\n"],
        ["keep-chomp", "|+ # hdr\n  body\n"],
        ["indent indicator", "|2 # hdr\n  body\n"],
        ["after a document start marker", "--- | # hdr\n  body\n"],
        ["with an anchor (tag/anchor branch of stringifyDocument)", "&a | # hdr\n  body\n"],
        ["with a tag (tag/anchor branch of stringifyDocument)", "!!str | # hdr\n  body\n"],
      ];
      for (const [name, source] of roundtrips) {
        it.effect(`roundtrips byte-intact: ${name}`, () =>
          Effect.gen(function* () {
            const doc = yield* YamlDocument.parse(source);
            const out = yield* doc.stringify();
            assert.strictEqual(
              out,
              source,
              "the pair, seq-item and explicit-key paths each splice the captured header comment back onto the header line (#341); the DOCUMENT ROOT is the fourth caller, once with no slot, so the comment was captured on the node and silently dropped on emit"
            );
            const again = yield* YamlDocument.parse(out);
            const stringify18 = yield* again.stringify();
            assert.strictEqual(stringify18, out);
          })
        );
      }

      it.effect("captures the header comment on the root scalar", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("| # hdr\n  body\n");
          assert.instanceOf(doc.contents, YamlScalar);
          assert.ok(S.is(YamlScalar)(doc.contents));
          assert.strictEqual(doc.contents.comment, " hdr");
          assert.strictEqual(doc.contents.value, "body\n");
        })
      );

      it("survives the YamlFormat path", () => {
        const text = "| # hdr\n  body\n";
        assert.strictEqual(YamlFormat.formatToString(text), text);
      });

      it.effect("canonical mode still drops it", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("| # hdr\n  body\n");
          const stringify19 = yield* doc.stringify(YamlStringifyOptions.make({ forceDefaultStyles: true }));
          assert.notInclude(stringify19, "#");
        })
      );
    });

    describe("distinct missing or mis-shared comment slots in legal consumer YAML", () => {
      it("keeps a blank line on the side of the marker it was written on", () => {
        const source = "# a\n---\n# b\n\nx: 1\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(
          out,
          source,
          "a format pass has no licence to move the blank; one shared `lastLeadingCommentOffset` embedded the blank below an AFTER-marker comment into the PRE-marker block, moving it across the marker"
        );
        assert.strictEqual(YamlFormat.formatToString(out), out, "the across-marker move was not even a fixed point");
      });

      it("keeps an after-marker comment when the document has no content", () => {
        const source = "# a\n---\n# b\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(
          (O.getOrNull(Str.match(/#/g)(out)) ?? []).length,
          2,
          "the pre-marker run already holds the document header and there is no content node to lead, so the after-marker run once fell through both branches and was discarded"
        );
        assert.include(out, "# a");
        assert.include(out, "# b");
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });

      it("leaves a value's trailing comment on the value's line under a leading block", () => {
        const source = "a:\n  # lead\n  1 # vc\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(
          out,
          source,
          "the key line must not route through `entryTrailing`, which reaches past an absent key comment to the VALUE's, printing it on the key line and then skipping the value's own"
        );
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });

      it("keeps a key-line comment on an ALIAS key's line", () => {
        const source = "a: &x 1\n*x : # c\n  2\n";
        const out = YamlFormat.formatToString(source);
        assert.include(out, "# c");
        assert.notInclude(
          out,
          "2 # c",
          "the stringifier emits an alias key in implicit form, so the key owns its line and the comment belongs on it, though `keyIsSimple` once rejected every non-scalar"
        );
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });

      it("emits a marker-LESS header over a scalar root", () => {
        const source = "# h\n42\n";
        const out = YamlFormat.formatToString(source);
        assert.strictEqual(
          out,
          source,
          "a scalar root stores the header on the root node itself; an emission slot gated on a `---` marker captured and dropped it"
        );
        assert.strictEqual(YamlFormat.formatToString(out), out);
      });
    });

    describe("explicit-key pairs emit their value's leading comment (#348)", () => {
      it.effect("keeps both comments on an explicit-key entry and stays a fixed point", () =>
        Effect.gen(function* () {
          const source = "? - seq1\n: # lala\n  #lala\n  - seq2\n";
          const doc = yield* YamlDocument.parse(source);
          const value = firstMap(doc).items[0]?.value;
          assert.instanceOf(value, YamlSeq);
          assert.ok(S.is(YamlSeq)(value));
          assert.include(
            value.commentBefore ?? "",
            "lala",
            "both comments sit on the `:` side with the value below, so both lead the value and join into one run"
          );
          const out = yield* doc.stringify();
          assert.strictEqual(YamlFormat.formatToString(out), out);
          assert.strictEqual(
            (O.getOrNull(Str.match(/#/g)(out)) ?? []).length,
            2,
            "every sibling branch of the block-mapping stringifier consults the value node's own `commentBefore`; the explicit-key (`? k` / `: v`) branch once did not and dropped it on emit (RZP5 and XW4D in the yaml-test-suite corpus are this shape)"
          );
        })
      );

      it("reaches its fixed point on the FIRST format pass", () => {
        const once = YamlFormat.formatToString("? - seq1\n: # lala\n - #lala\n  seq2\n");
        assert.strictEqual(
          once,
          "? - seq1\n:\n  #lala\n  - seq2\n  # lala\n",
          "pin the bytes too, not just the idempotence: asserting only `f(f(x)) === f(x)` stays green no matter how `f(x)` drifts"
        );
        assert.strictEqual(YamlFormat.formatToString(once), once);
      });

      it.effect("a value leading comment ALONE survives an explicit-key pair", () =>
        Effect.gen(function* () {
          const source = "? - seq1\n:\n  #lead\n  - seq2\n";
          const doc = yield* YamlDocument.parse(source);
          const seq = firstMap(doc).items[0]?.value;
          assert.ok(S.is(YamlSeq)(seq));
          assert.strictEqual(seq.commentBefore, "lead");
          const stringify20 = yield* doc.stringify();
          assert.strictEqual(stringify20, source);
        })
      );
    });

    describe("a terminal comment survives a last pair with a NULL value (#348)", () => {
      it.effect("control: a non-null last value keeps it", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("x: 1\n# c\n");
          assert.strictEqual(
            doc.comment,
            " c",
            "at the ROOT the terminal run belongs to the DOCUMENT: the document is the root collection's enclosing scope, so the escape rule that hands a shallow terminal comment outward applies at the top"
          );
        })
      );

      it.effect("a null last value keeps it too", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse("x:\n# c\n");
          assert.strictEqual(
            doc.comment,
            " c",
            "with an EMPTY last value, consumeValueNode consumed the comment looking for a value and the caller discarded it, because a leading comment can only attach to a value node that exists; one format pass lost it (NKF9 in the corpus)"
          );
        })
      );

      it.effect("an empty KEY and value keeps it", () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse(":\n# c\n");
          assert.strictEqual(doc.comment, " c");
        })
      );

      it("a null last value is a fixed point through the format path", () => {
        for (const text of ["x:\n# c\n", ":\n# c\n", ":\n# c\n---\n{: null}\n"]) {
          assert.strictEqual(YamlFormat.formatToString(text), text);
        }
      });

      it("the comment still forward-attributes when a pair follows it", () => {
        const text = "x:\n# c\ny: 2\n";
        assert.strictEqual(
          YamlFormat.formatToString(text),
          text,
          "rewinding must not steal the comment from the NEXT pair: with a following key this is `commentBefore`, not a terminal run"
        );
      });

      it.effect("a comment escaping an indented root collection lands on the document", () =>
        Effect.gen(function* () {
          assert.strictEqual(
            (yield* YamlDocument.parse("  - a\n  - b\n# esc\n")).comment,
            " esc",
            'an INDENTED root collection disowns a column-0 terminal comment, which escapes past the root to the document\'s trailing `comment` (yaml@2.9.0: `doc.comment === " esc"`); it used to be dropped there, so one format pass deleted the line'
          );
          assert.strictEqual((yield* YamlDocument.parse("  a: 1\n  b: 2\n# e1\n\n# e2\n")).comment, " e1\n\n e2");
          assert.strictEqual((yield* YamlDocument.parse("  - a\n# esc\n...\n# after\n")).comment, " esc\n after");
        })
      );

      it("an escaped root comment is a fixed point through the format path", () => {
        assert.strictEqual(YamlFormat.formatToString("  - a\n  - b\n# esc\n"), "- a\n- b\n# esc\n");
        assert.strictEqual(YamlFormat.formatToString("  - a\n  # own\n# esc\n"), "- a\n# own\n# esc\n");
        for (const text of ["- a\n- b\n# esc\n", "a: 1\n# own\n\n# esc\n"]) {
          assert.strictEqual(YamlFormat.formatToString(text), text);
        }
      });

      it("keeps both header comments across two empty-key documents", () => {
        const once = YamlFormat.formatToString("---\n# c1\n:\n---\n# c2\n{ : }\n");
        assert.include(once, "# c1");
        assert.include(once, "# c2");
        assert.strictEqual(YamlFormat.formatToString(once), once);
      });
    });

    it.effect("canonical mode (forceDefaultStyles) stays comment-free — the conformance contract", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# doc\na: 1 # trailing\n\n# section\nb: 2\n");
        const out = yield* doc.stringify(YamlStringifyOptions.make({ forceDefaultStyles: true }));
        assert.notInclude(out, "#");
        assert.strictEqual(out, "a: 1\nb: 2\n");
      })
    );
  });

  describe("YamlFormat.formatToString — the systems repro gate", () => {
    const fixture = fixtureText("comment-fidelity/workflow.yaml");

    it("roundtrips the workflow repro byte-intact (fixed point)", () => {
      const options = YamlFormattingOptions.make({ indentSequences: true });
      const out = YamlFormat.formatToString(fixture, undefined, options);
      assert.strictEqual(
        out,
        fixture,
        "the headline gate: leading, trailing and own-line section comments in the workflow file round-trip byte-intact, a committed fixed point under indentSequences: true"
      );
    });

    it("preserveComments keeps its name: true preserves per-node comments, false strips them", () => {
      const preserved = YamlFormat.formatToString(
        fixture,
        undefined,
        YamlFormattingOptions.make({ indentSequences: true })
      );
      assert.include(preserved, "# Deploy workflow");
      assert.include(preserved, "# only main");
      assert.include(preserved, "# check the repo out");
      assert.include(preserved, "# install deps");

      const stripped = YamlFormat.formatToString(
        fixture,
        undefined,
        YamlFormattingOptions.make({
          indentSequences: true,
          preserveComments: false,
        })
      );
      assert.notInclude(stripped, "#");
    });

    it.effect("formatting preserves the parsed value exactly", () =>
      Effect.gen(function* () {
        const out = YamlFormat.formatToString(
          fixture,
          undefined,
          YamlFormattingOptions.make({ indentSequences: true })
        );
        const parsed21 = yield* Yaml.parse(out);
        const parsed22 = yield* Yaml.parse(fixture);
        assert.deepStrictEqual(parsed21, parsed22);
      })
    );
  });

  describe("blank-line fidelity — header block and terminal comment run (systems item 10)", () => {
    it("keeps the blank line between a document-header comment block and the first key (fixed point)", () => {
      for (const text of ["# hdr\n# hdr2\n\nversion: 2\n", "# hdr\n\nversion: 2\n"]) {
        assert.strictEqual(YamlFormat.formatToString(text), text);
      }
    });

    it("keeps the blank line between a doc-header block and a `---` marker (fixed point)", () => {
      const text = "# hdr\n\n---\nversion: 2\n";
      assert.strictEqual(YamlFormat.formatToString(text), text);
    });

    it("roundtrips a dependabot-style header byte-intact (fixed point)", () => {
      const fixture = fixtureText("comment-fidelity/dependabot.yaml");
      assert.strictEqual(
        YamlFormat.formatToString(fixture, undefined, YamlFormattingOptions.make({ indentSequences: true })),
        fixture
      );
    });

    it.effect("captures the header's trailing blank as a trailing empty line", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# hdr\n\nversion: 2\n");
        assert.strictEqual(
          firstMap(doc).items[0]?.key.commentBefore,
          " hdr\n",
          "a blank line adjacent to a comment run is a CAPTURE-side embed, an empty line in the joined comment string (trailing for the document header, leading for a collection's terminal run), so emission needs no new state"
        );
      })
    );

    it("keeps the blank line before a nested mapping's terminal comment run (claude.yml reduction, fixed point)", () => {
      for (const text of [
        "m:\n  a: 1\n\n  # c\n",
        "m:\n  a: |\n    text\n\n  # c\n",
        "m:\n  a: |\n    text\n\n  # c1\n  b: 2\n\n  # c2\n  # c3\n\n  # c4\n",
      ]) {
        assert.strictEqual(YamlFormat.formatToString(text), text);
      }
    });

    it("keeps the blank line before a block sequence's terminal comment run (fixed point)", () => {
      const text = "s:\n  - 1\n\n  # c\n";
      assert.strictEqual(
        YamlFormat.formatToString(text, undefined, YamlFormattingOptions.make({ indentSequences: true })),
        text
      );
    });

    it("controls: pre-existing blank-line shapes stay untouched", () => {
      for (const text of [
        "a: 1\n\nb: 2\n",
        "a: 1\n\n# c\nb: 2\n",
        "a: |\n  text\n\n# c\nb: 2\n",
        "# hdr\nversion: 2\n",
        "m:\n  a: 1\n  # c\n",
        "m:\n  a: 1\n\n# tail\nnext: 2\n",
      ]) {
        assert.strictEqual(
          YamlFormat.formatToString(text),
          text,
          "no blank is invented where none was written, and an escaped-to-outer comment keeps its blank"
        );
      }
    });

    it("accepted normalizations hold: blank runs collapse to one, whitespace-only lines strip", () => {
      assert.strictEqual(YamlFormat.formatToString("a: 1\n\n\nb: 2\n"), "a: 1\n\nb: 2\n");
      assert.strictEqual(YamlFormat.formatToString("# hdr\n\n\nversion: 2\n"), "# hdr\n\nversion: 2\n");
      assert.strictEqual(YamlFormat.formatToString("a: 1\n   \nb: 2\n"), "a: 1\n\nb: 2\n");
    });
  });

  describe("visitor", () => {
    it.effect(
      "Comment events discriminate placement and come once from the key or value node, never again from the pair",
      () =>
        Effect.gen(function* () {
          const events = yield* Stream.runCollect(
            YamlVisitor.visit("# header\n# section\na: 1 # trailing\n...\n# tail\n")
          );
          const comments = A.filter([...events], (e) => e._tag === "Comment");
          assert.deepStrictEqual(
            A.map(comments, (c) => [c.placement, c.text]),
            [
              ["leading", " header\n section"],
              ["trailing", " trailing"],
              ["trailing", " tail"],
            ]
          );
        })
    );
  });

  describe("format properties over the fidelity inputs", () => {
    const fileFixtures: ReadonlyArray<readonly [string, string, YamlFormattingOptions]> = [
      [
        "workflow.yaml",
        fixtureText("comment-fidelity/workflow.yaml"),
        YamlFormattingOptions.make({ indentSequences: true }),
      ],
      [
        "dependabot.yaml",
        fixtureText("comment-fidelity/dependabot.yaml"),
        YamlFormattingOptions.make({ indentSequences: true }),
      ],
    ];
    const inlineInputs: ReadonlyArray<string> = [
      "a: 1\n\n# section\nb: 2\n",
      "a: 1 # trailing a\nb: 2\n",
      "a: 1\n# line one\n# line two\nb: 2\n",
      "a: 1\n\nb: 2\n",
      "a:\n  b: 1\n  # end of a\nc: 2\n",
      "steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n",
      "# hdr\n# hdr2\n\nversion: 2\n",
      "# hdr\n\n---\nversion: 2\n",
      "m:\n  a: 1\n\n  # c\n",
      "m:\n  a: |\n    text\n\n  # c\n",
      "m:\n  a: |\n    text\n\n  # c1\n  b: 2\n\n  # c2\n  # c3\n\n  # c4\n",
      "a: 1\n\n# c\nb: 2\n",
      "a: |\n  text\n\n# c\nb: 2\n",
      "m:\n  a: 1\n\n# tail\nnext: 2\n",
      "a: |+\n  text\n\nb: 1\n",
      "a: >+\n  text\n\n# tail\n",
      "# header\n# section\na: 1 # trailing\n...\n# tail\n",
    ];

    for (const [name, fixture, options] of fileFixtures) {
      it(`idempotence + meaning preservation — ${name}`, () => {
        const once = YamlFormat.formatToString(fixture, undefined, options);
        assert.strictEqual(
          YamlFormat.formatToString(once, undefined, options),
          once,
          "idempotence holds for EVERY fidelity input, known or not: a second pass that moves is rewriting content"
        );
        assert.deepStrictEqual(
          Result.getOrThrow(Yaml.parseResult(once)),
          Result.getOrThrow(Yaml.parseResult(fixture)),
          "meaning preservation (parse∘format === parse); the keep-chomp growth regression broke both properties while every byte fixture stayed green"
        );
      });
    }

    for (const input of inlineInputs) {
      it(`idempotence + meaning preservation — ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(input), identity)}`, () => {
        const once = YamlFormat.formatToString(input);
        assert.strictEqual(
          YamlFormat.formatToString(once),
          once,
          "idempotence holds for EVERY fidelity input, known or not: a second pass that moves is rewriting content"
        );
        assert.deepStrictEqual(
          Result.getOrThrow(Yaml.parseAllResult(once)),
          Result.getOrThrow(Yaml.parseAllResult(input)),
          "meaning preservation (parse∘format === parse); the keep-chomp growth regression broke both properties while every byte fixture stayed green"
        );
      });
    }
  });
});
