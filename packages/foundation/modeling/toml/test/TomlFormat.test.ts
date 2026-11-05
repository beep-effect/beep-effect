// TomlFormat: the conservative whitespace formatter over the linear CST and
// the path-addressed modifier over the semantic view. Format never reorders,
// collapses blank lines or rewrites values, and never touches a byte inside
// a multi-line string; modify PINS the insertion-placement rules the design
// left open, and every modified document is proven to reparse cleanly.

import { Toml, TomlParseError } from "@beep/toml/Toml";
import { TomlFormat, TomlFormattingOptions, TomlModificationError } from "@beep/toml/TomlFormat";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { TomlPath } from "@beep/toml/TomlEdit";

const CRLF = TomlFormattingOptions.make({ newline: "\r\n" });
const LF = TomlFormattingOptions.make({ newline: "\n" });

/** Modify, apply, and prove the invariant: every modified document reparses cleanly. */
const modified = Effect.fn("modified")(function* (text: string, path: TomlPath, value: unknown) {
  const out = yield* TomlFormat.modifyToString(text, path, value);
  yield* Toml.parse(out);
  return out;
});

/** Flip a failing modify and assert the failure is the typed modification error. */
const modifyError = Effect.fn("modifyError")(function* (text: string, path: TomlPath, value: unknown) {
  const error = yield* Effect.flip(TomlFormat.modify(text, path, value));
  assert.instanceOf(error, TomlModificationError);
  if (!S.is(TomlModificationError)(error)) {
    assert.fail("expected a TomlModificationError");
  }
  return error;
});

const IDEMPOTENCE_DOCS: ReadonlyArray<string> = [
  "a=1\nb  =  2   # c\n",
  '# top\n\n  [t]  # section\nx = "s"\n\n[[arr]]\ny = [1, 2,\n  3]  #tail\n',
  's = """\nkeep  \n"""\nafter=1',
  '\t# indented\n   \nk = {a = 1, b = "x"}\n',
  "[a.b]\nc.d = 1979-05-27T07:32:00Z\n",
  // TOML 1.1: an inline table spanning lines, with inner comments and a trailing comma
  "k = {\n\ta = 1, # one\n\tb = [1, 2],\n}\n",
];

describe("TomlFormat", () => {
  describe("format", () => {
    it("normalizes to exactly one space around =", () => {
      assert.strictEqual(TomlFormat.formatToString("a=1\n"), "a = 1\n");
      assert.strictEqual(TomlFormat.formatToString("b  =  2\n"), "b = 2\n");
    });

    it("strips leading indentation and normalizes the trailing comment gap on a header", () => {
      assert.strictEqual(TomlFormat.formatToString("  [t]  # c\n"), "[t] # c\n");
      assert.strictEqual(TomlFormat.formatToString("\t[[t]]   # c\nx = 1\n"), "[[t]] # c\nx = 1\n");
    });

    it("strips trailing whitespace before the newline", () => {
      assert.strictEqual(TomlFormat.formatToString("a = 1   \n"), "a = 1\n");
    });

    it("puts one space before a trailing comment", () => {
      assert.strictEqual(TomlFormat.formatToString("a = 1# c\n"), "a = 1 # c\n");
      assert.strictEqual(TomlFormat.formatToString("a = 1    # c\n"), "a = 1 # c\n");
    });

    it("inserts one space after # in a non-empty comment", () => {
      assert.strictEqual(TomlFormat.formatToString("#c\n"), "# c\n");
      assert.strictEqual(TomlFormat.formatToString("a = 1 #note\n"), "a = 1 # note\n");
    });

    it("leaves comments already starting with space, tab or ! alone", () => {
      assert.strictEqual(TomlFormat.formatToString("# ok\n"), "# ok\n");
      assert.strictEqual(TomlFormat.formatToString("#!bang\n"), "#!bang\n");
      assert.strictEqual(TomlFormat.formatToString("#\n"), "#\n");
    });

    it("strips indentation from comment lines and whitespace-only lines", () => {
      assert.strictEqual(TomlFormat.formatToString("  # c\n"), "# c\n");
      assert.strictEqual(TomlFormat.formatToString("a = 1\n   \nb = 2\n"), "a = 1\n\nb = 2\n");
    });

    it("adds the single missing final newline", () => {
      assert.strictEqual(TomlFormat.formatToString("a = 1"), "a = 1\n");
      assert.strictEqual(TomlFormat.formatToString(""), "");
    });

    it("normalizes every newline when the option is set", () => {
      assert.strictEqual(TomlFormat.formatToString("a = 1\nb = 2\n", undefined, CRLF), "a = 1\r\nb = 2\r\n");
      assert.strictEqual(TomlFormat.formatToString("a = 1\r\nb = 2\r\n", undefined, LF), "a = 1\nb = 2\n");
    });

    it("leaves an already-clean document untouched — comments and blank lines survive", () => {
      const clean = "# top\n\na = 1\n\n# tail\n";
      assert.deepStrictEqual(TomlFormat.format(clean), []);
      assert.strictEqual(TomlFormat.formatToString(clean), clean);
    });

    it("never collapses consecutive blank lines", () => {
      const doc = "a = 1\n\n\nb = 2\n";
      assert.deepStrictEqual(TomlFormat.format(doc), []);
      assert.strictEqual(TomlFormat.formatToString(doc), doc);
    });

    it("never touches bytes inside a multi-line string value", () => {
      const doc = 's = """\nline one  \nline two\t\n"""\na=1   \n';
      assert.strictEqual(TomlFormat.formatToString(doc), 's = """\nline one  \nline two\t\n"""\na = 1\n');
      const literal = "s = '''\nraw  \n'''\n";
      assert.strictEqual(TomlFormat.formatToString(literal), literal);
    });

    it("newline normalization skips newlines inside multi-line strings", () => {
      const doc = 's = """\nkeep  \nthese\t\n"""\na=1   \n';
      assert.strictEqual(TomlFormat.formatToString(doc, undefined, CRLF), 's = """\nkeep  \nthese\t\n"""\r\na = 1\r\n');
    });

    it("a range starting mid-expression still formats that whole expression", () => {
      const out = TomlFormat.formatToString("a=1\nb=2\nc=3\n", { offset: 1, length: 4 });
      assert.strictEqual(out, "a = 1\nb = 2\nc=3\n");
    });

    it("malformed input yields no edits rather than corrupting the document", () => {
      assert.deepStrictEqual(TomlFormat.format("a = [1"), []);
      assert.strictEqual(TomlFormat.formatToString("a = [1"), "a = [1");
    });

    it("formatToString is idempotent over mixed documents", () => {
      for (const doc of IDEMPOTENCE_DOCS) {
        const once = TomlFormat.formatToString(doc);
        assert.strictEqual(TomlFormat.formatToString(once), once);
        const crlf = TomlFormat.formatToString(doc, undefined, CRLF);
        assert.strictEqual(TomlFormat.formatToString(crlf, undefined, CRLF), crlf);
      }
    });

    it.effect("formatted output still parses to the same value", () =>
      Effect.gen(function* () {
        for (const doc of IDEMPOTENCE_DOCS) {
          const before = yield* Toml.parse(doc);
          const after = yield* Toml.parse(TomlFormat.formatToString(doc));
          assert.deepStrictEqual(after, before);
        }
      })
    );
  });

  describe("modify — replace", () => {
    it.effect("replaces a value and preserves the trailing comment byte-exact", () =>
      Effect.gen(function* () {
        const modified1 = yield* modified("a = 1 # keep\n", ["a"], 2);
        assert.strictEqual(modified1, "a = 2 # keep\n");
      })
    );

    it.effect("replaces inside a [t] section", () =>
      Effect.gen(function* () {
        const modified2 = yield* modified('[t]\nx = "old"\n', ["t", "x"], "new");
        assert.strictEqual(modified2, '[t]\nx = "new"\n');
      })
    );

    it.effect("replaces an array element by index", () =>
      Effect.gen(function* () {
        const modified3 = yield* modified("a = [1, 2, 3]\n", ["a", 1], 42);
        assert.strictEqual(modified3, "a = [1, 42, 3]\n");
      })
    );

    it.effect("replaces a [[t]] element field", () =>
      Effect.gen(function* () {
        const modified4 = yield* modified("[[t]]\nn = 1\n\n[[t]]\nn = 2\n", ["t", 1, "n"], 9);
        assert.strictEqual(modified4, "[[t]]\nn = 1\n\n[[t]]\nn = 9\n");
      })
    );

    it.effect("replaces a scalar with an inline array rendering", () =>
      Effect.gen(function* () {
        const modified5 = yield* modified("a = 1\n", ["a"], [1, 2]);
        assert.strictEqual(modified5, "a = [1, 2]\n");
      })
    );
  });

  describe("modify — delete", () => {
    it.effect("deletes a key-value line including its newline", () =>
      Effect.gen(function* () {
        const modified6 = yield* modified("a = 1\nb = 2\n", ["a"], undefined);
        assert.strictEqual(modified6, "b = 2\n");
        const modified7 = yield* modified("a = 1\nb = 2\n", ["b"], undefined);
        assert.strictEqual(modified7, "a = 1\n");
        const modified8 = yield* modified("a = 1\nb = 2", ["b"], undefined);
        assert.strictEqual(modified8, "a = 1\n");
      })
    );

    it.effect("a trailing comment inside the deleted expression's span goes with it", () =>
      Effect.gen(function* () {
        const modified9 = yield* modified("a = 1 # c\nb = 2\n", ["a"], undefined);
        assert.strictEqual(modified9, "b = 2\n");
      })
    );

    it.effect("splices inline-table separators", () =>
      Effect.gen(function* () {
        const modified10 = yield* modified("t = {a = 1, b = 2}\n", ["t", "a"], undefined);
        assert.strictEqual(modified10, "t = {b = 2}\n");
        const modified11 = yield* modified("t = {a = 1, b = 2}\n", ["t", "b"], undefined);
        assert.strictEqual(modified11, "t = {a = 1}\n");
        const modified12 = yield* modified("t = {a = 1}\n", ["t", "a"], undefined);
        assert.strictEqual(modified12, "t = {}\n");
        const modified13 = yield* modified("t = {a.b = 1, c = 2}\n", ["t", "a", "b"], undefined);
        assert.strictEqual(modified13, "t = {c = 2}\n");
      })
    );

    it.effect("modifies a multi-line inline table in place (TOML 1.1)", () =>
      Effect.gen(function* () {
        const doc = "t = {\n\ta = 1, # one\n\tb = 2,\n}\n";
        // replacing an entry value touches only the value span
        const modified14 = yield* modified(doc, ["t", "b"], 3);
        assert.strictEqual(modified14, "t = {\n\ta = 1, # one\n\tb = 3,\n}\n");
        // deleting a non-last entry takes its trailing gap (comment included)
        const modified15 = yield* modified(doc, ["t", "a"], undefined);
        assert.strictEqual(modified15, "t = {\n\tb = 2,\n}\n");
        // deleting the last entry leaves the (1.1-legal) trailing comma behind
        const modified16 = yield* modified(doc, ["t", "b"], undefined);
        assert.strictEqual(modified16, "t = {\n\ta = 1,\n}\n");
        // deleting the only entry collapses the whole interior
        const modified17 = yield* modified("t = {\n\ta = 1,\n}\n", ["t", "a"], undefined);
        assert.strictEqual(modified17, "t = {}\n");
      })
    );

    it.effect("splices array separators for first, middle, last and only items", () =>
      Effect.gen(function* () {
        const modified18 = yield* modified("a = [1, 2, 3]\n", ["a", 0], undefined);
        assert.strictEqual(modified18, "a = [2, 3]\n");
        const modified19 = yield* modified("a = [1, 2, 3]\n", ["a", 1], undefined);
        assert.strictEqual(modified19, "a = [1, 3]\n");
        const modified20 = yield* modified("a = [1, 2, 3]\n", ["a", 2], undefined);
        assert.strictEqual(modified20, "a = [1, 2]\n");
        const modified21 = yield* modified("a = [7]\n", ["a", 0], undefined);
        assert.strictEqual(modified21, "a = []\n");
      })
    );

    it.effect("deleting a missing key is a no-op", () =>
      Effect.gen(function* () {
        const modified22 = yield* modified("a = 1\n", ["b"], undefined);
        assert.strictEqual(modified22, "a = 1\n");
      })
    );
  });

  describe("modify — insert (the pinned placement rules)", () => {
    it.effect("root: before the first header, after the last root expression", () =>
      Effect.gen(function* () {
        const modified23 = yield* modified("a = 1\n\n[t]\nx = 1\n", ["b"], 2);
        assert.strictEqual(modified23, "a = 1\nb = 2\n\n[t]\nx = 1\n");
      })
    );

    it.effect("root: appends when there are no headers", () =>
      Effect.gen(function* () {
        const modified24 = yield* modified("a = 1\n", ["b"], 2);
        assert.strictEqual(modified24, "a = 1\nb = 2\n");
      })
    );

    it.effect("root: before the first header when only headers exist", () =>
      Effect.gen(function* () {
        const modified25 = yield* modified("[t]\nx = 1\n", ["b"], 2);
        assert.strictEqual(modified25, "b = 2\n[t]\nx = 1\n");
      })
    );

    it.effect("root: at document start when the document is empty or trivia-only", () =>
      Effect.gen(function* () {
        const modified26 = yield* modified("", ["b"], 2);
        assert.strictEqual(modified26, "b = 2\n");
        const modified27 = yield* modified("# note\n", ["b"], 2);
        assert.strictEqual(modified27, "b = 2\n# note\n");
      })
    );

    it.effect("into a [t] section: after its last expression, before the separating trivia", () =>
      Effect.gen(function* () {
        const modified28 = yield* modified("[t]\na = 1\n\n[u]\n", ["t", "b"], 2);
        assert.strictEqual(modified28, "[t]\na = 1\nb = 2\n\n[u]\n");
      })
    );

    it.effect("into [t] when it is the last section", () =>
      Effect.gen(function* () {
        const modified29 = yield* modified("[u]\n\n[t]\na = 1\n", ["t", "b"], 2);
        assert.strictEqual(modified29, "[u]\n\n[t]\na = 1\nb = 2\n");
      })
    );

    it.effect("into [t] when the document lacks a final newline", () =>
      Effect.gen(function* () {
        const modified30 = yield* modified("[t]\na = 1", ["t", "b"], 2);
        assert.strictEqual(modified30, "[t]\na = 1\nb = 2\n");
      })
    );

    it.effect("into an empty [t] section: right after the header", () =>
      Effect.gen(function* () {
        const modified31 = yield* modified("[t]\n[u]\n", ["t", "a"], 1);
        assert.strictEqual(modified31, "[t]\na = 1\n[u]\n");
      })
    );

    it.effect("into a dotted-defined table: a dotted key appended to its defining section", () =>
      Effect.gen(function* () {
        const modified32 = yield* modified("[t]\nx.y = 1\n", ["t", "x", "z"], 2);
        assert.strictEqual(modified32, "[t]\nx.y = 1\nx.z = 2\n");
      })
    );

    it.effect("into the last [[srv]] element", () =>
      Effect.gen(function* () {
        const modified33 = yield* modified("[[srv]]\na = 1\n\n[[srv]]\na = 2\n", ["srv", 1, "b"], 3);
        assert.strictEqual(modified33, "[[srv]]\na = 1\n\n[[srv]]\na = 2\nb = 3\n");
      })
    );

    it.effect("into an earlier [[srv]] element by index", () =>
      Effect.gen(function* () {
        const modified34 = yield* modified("[[srv]]\na = 1\n\n[[srv]]\na = 2\n", ["srv", 0, "b"], 3);
        assert.strictEqual(modified34, "[[srv]]\na = 1\nb = 3\n\n[[srv]]\na = 2\n");
      })
    );

    it.effect("quotes keys that are not bare", () =>
      Effect.gen(function* () {
        const modified35 = yield* modified("", ["my key"], "v");
        assert.strictEqual(modified35, '"my key" = "v"\n');
      })
    );

    it.effect("inherits the document's dominant CRLF newline", () =>
      Effect.gen(function* () {
        const modified36 = yield* modified("a = 1\r\nb = 2\r\n", ["c"], 3);
        assert.strictEqual(modified36, "a = 1\r\nb = 2\r\nc = 3\r\n");
      })
    );
  });

  describe("modify — errors", () => {
    it.effect("a missing intermediate never auto-creates", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("", ["a", "b", "c"], 1);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("inserting into an inline table fails with InlineTableExtended", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("t = {a = 1}\n", ["t", "b"], 2);
        assert.strictEqual(error.diagnostic.code, "InlineTableExtended");
      })
    );

    it.effect("a path through a scalar fails typed", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("a = 1\n", ["a", "b"], 2);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("inserting into an implicitly created table fails typed", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("[a.b]\nx = 1\n", ["a", "y"], 1);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("a table section is not replaceable by a value", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("[t]\n", ["t"], 1);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("a dotted-key group inside an inline table is not a single entry", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("t = {a.b = 1}\n", ["t", "a"], 2);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("an empty path fails typed", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("a = 1\n", [], 2);
        assert.strictEqual(error.diagnostic.code, "DottedKeyConflict");
      })
    );

    it.effect("an unsupported replacement value fails typed", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("a = 1\n", ["a"], null);
        assert.strictEqual(error.diagnostic.code, "UnsupportedValue");
      })
    );

    it.effect("a document that does not parse fails with TomlParseError", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(TomlFormat.modify("a = [1", ["a"], 2));
        assert.instanceOf(error, TomlParseError);
      })
    );

    it.effect("a semantically invalid document fails with its stored diagnostic", () =>
      Effect.gen(function* () {
        const error = yield* modifyError("a = 1\na = 2\n", ["a"], 3);
        assert.strictEqual(error.diagnostic.code, "DuplicateKey");
      })
    );
  });

  describe("modify — depth", () => {
    it.effect("a 300-segment path fails typed instead of overflowing the stack", () =>
      Effect.gen(function* () {
        const segments = Array.from({ length: 300 }, (_, i) => `k${i}`);
        const doc = `${A.join(segments, ".")} = 1\n`;
        const error = yield* modifyError(doc, segments, 2);
        assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
      })
    );
  });
});
