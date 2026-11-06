import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  Yaml,
  YamlAlias,
  YamlDirective,
  YamlDocument,
  YamlMap,
  YamlParseError,
  YamlScalar,
  YamlSeq,
  YamlStringifyError,
  YamlStringifyOptions,
} from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("YamlDocument", () => {
  describe("parse", () => {
    it.effect("keeps the AST, directives and framing flags", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("%YAML 1.2\n---\nname: Alice\n...\n");
        assert.instanceOf(doc.contents, YamlMap);
        assert.deepStrictEqual(
          A.map(doc.directives, (d) => ({ name: d.name, parameters: [...d.parameters] })),
          [{ name: "YAML", parameters: ["1.2"] }]
        );
        assert.isTrue(doc.hasDocumentStart);
        assert.isTrue(doc.hasDocumentEnd);
        assert.deepStrictEqual(doc.errors, []);
      })
    );

    it.effect("surfaces recoverable issues as warnings-as-data instead of failing", () =>
      Effect.gen(function* () {
        // A duplicate mapping key is recorded as a warning on the document;
        // only the value-level Yaml.parse promotes it under uniqueKeys.
        const doc = yield* YamlDocument.parse("a: 1\na: 2");
        assert.isTrue(A.some(doc.warnings, (w) => w.code === "DuplicateKey"));
        assert.isAbove(doc.warnings[0]?.line ?? -1, -1);
      })
    );

    it.effect("fails with YamlParseError on fatal diagnostics", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(YamlDocument.parse("a: *missing"));
        assert.instanceOf(error, YamlParseError);
        assert.isTrue(A.some(error.diagnostics, (d) => d.code === "UndefinedAlias"));
      })
    );

    it.effect("returns an empty document for empty input", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("");
        assert.isNull(doc.contents);
        assert.deepStrictEqual(doc.errors, []);
      })
    );
  });

  describe("parseAll", () => {
    it.effect("parses documents in order with per-document framing", () =>
      Effect.gen(function* () {
        const docs = yield* YamlDocument.parseAll("a: 1\n---\nb: 2");
        assert.strictEqual(docs.length, 2);
        assert.deepStrictEqual(docs[0]?.toValue(), { a: 1 });
        assert.deepStrictEqual(docs[1]?.toValue(), { b: 2 });
        assert.isFalse(docs[0]?.hasDocumentStart ?? true);
        assert.isTrue(docs[1]?.hasDocumentStart);
      })
    );
  });

  describe("stringify", () => {
    it.effect("round-trips a parsed document", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("name: Alice\nage: 30\n");
        const text = yield* doc.stringify();
        const again = yield* YamlDocument.parse(text);
        assert.deepStrictEqual(again.toValue(), { name: "Alice", age: 30 });
      })
    );

    it.effect("a synthetic AST deeper than the cap fails typed, never a stack-overflow defect", () =>
      Effect.gen(function* () {
        // The node-path stringifier (stringifyNodeLines &co.) is mutually
        // recursive with no natural bound. Parsed ASTs are composer-bounded to
        // MAX_NESTING_DEPTH (256), but a hand-built tree nested past it would
        // overflow the stack as a RangeError defect on this public boundary.
        // Nest 300 YamlSeq nodes around a scalar leaf — beyond the 256 cap.
        let contents: YamlSeq | YamlScalar = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 0 });
        for (let i = 0; i < 300; i++) {
          contents = YamlSeq.make({ items: [contents], style: "block", offset: 0, length: 0 });
        }
        const doc = YamlDocument.make({ contents, errors: [], warnings: [], directives: [] });

        const result = yield* Effect.result(doc.stringify());
        if (!Result.isFailure(result)) {
          assert.fail("a 300-deep synthetic AST must fail, not overflow the stack");
        }
        assert.instanceOf(result.failure, YamlStringifyError);
        assert.strictEqual(result.failure.diagnostics[0]?.code, "NestingDepthExceeded");
      })
    );

    it.effect("spills a >1024-char rendered key to explicit-key form on the node path (#323)", () =>
      Effect.gen(function* () {
        // Our parser accepts an over-long IMPLICIT key (the 1024-char limit
        // is a strict-parser restriction we do not enforce on read), but
        // re-emitting it implicitly would produce output strict parsers
        // reject — the node path must spill exactly like the value path.
        const key = `pkg-a@1.0.0(${Str.repeat(1100)("a")})`;
        const doc = yield* YamlDocument.parse(`${key}: value-one\n`);
        const text = yield* doc.stringify();
        assert.isTrue(Str.startsWith(`? ${key}\n: value-one`)(text), "node path must spill to explicit form");
        const again = yield* YamlDocument.parse(text);
        assert.deepStrictEqual(again.toValue(), { [key]: "value-one" });
      })
    );

    it.effect("node-path compact continuation alignment is structural — indent: 4 must still roundtrip", () =>
      Effect.gen(function* () {
        // Same structural-pad contract as the value path: continuation
        // lines after `: ` align at column 2 regardless of ctx.indent.
        const key = `pkg-a@1.0.0(${Str.repeat(1100)("a")})`;
        const seqDoc = yield* YamlDocument.parse(`${key}:\n  - first\n  - second\n`);
        const seqText = yield* seqDoc.stringify(YamlStringifyOptions.make({ indent: 4 }));
        assert.include(seqText, ": - first\n  - second");
        const seqAgain = yield* YamlDocument.parse(seqText);
        assert.deepStrictEqual(seqAgain.toValue(), { [key]: ["first", "second"] });

        const mapDoc = yield* YamlDocument.parse(`${key}:\n  dep-one: 1.2.3\n  dep-two: 4.5.6\n`);
        const mapText = yield* mapDoc.stringify(YamlStringifyOptions.make({ indent: 4 }));
        assert.include(mapText, ": dep-one: 1.2.3\n  dep-two: 4.5.6");
        const mapAgain = yield* YamlDocument.parse(mapText);
        assert.deepStrictEqual(mapAgain.toValue(), { [key]: { "dep-one": "1.2.3", "dep-two": "4.5.6" } });
      })
    );

    it.effect("roundtrips the pnpm snapshots explicit-key shape through the node path (#322/#323)", () =>
      Effect.gen(function* () {
        const key = `pkg-b@2.0.0(${Str.repeat(1100)("b")})`;
        const source = A.join(["snapshots:", `  ? ${key}`, "  : dependencies:", "      dep-one: 1.2.3", ""], "\n");
        const doc = yield* YamlDocument.parse(source);
        const text = yield* doc.stringify();
        // The explicit form survives re-emission (the key is still >1024).
        assert.include(text, `? ${key}`);
        const again = yield* YamlDocument.parse(text);
        assert.deepStrictEqual(again.toValue(), {
          snapshots: { [key]: { dependencies: { "dep-one": "1.2.3" } } },
        });
      })
    );

    it.effect("lineWidth is inert on the node path — pins the gap documented for #105", () =>
      Effect.gen(function* () {
        // Column-based folding exists only on the value path; the node path
        // threads lineWidth into its render context and never reads it. That
        // gap is documented on YamlDocument#stringify (with the
        // Yaml.stringify(doc.toValue(), options) workaround) and on
        // YamlStringifyOptions.lineWidth. If node-path folding ever lands,
        // this test MUST fail so those docs are rewritten with it rather
        // than silently drifting.
        const long = "the quick brown fox jumps over the lazy dog and keeps running far away into the sunset";
        const doc = yield* YamlDocument.parse(`text: ${long}\n`);

        const viaNodePath = yield* doc.stringify(YamlStringifyOptions.make({ lineWidth: 30 }));
        // Inert: the long scalar stays on one physical line, far past column 30.
        assert.isTrue(A.some(Str.split("\n")(viaNodePath), (line) => line.length > 40));

        // The documented workaround folds: render the plain value instead.
        const viaValuePath = yield* Yaml.stringify(doc.toValue(), YamlStringifyOptions.make({ lineWidth: 30 }));
        const foldedLines = Str.split("\n")(Str.trimEnd(viaValuePath));
        assert.isAbove(foldedLines.length, 1);
        for (const line of foldedLines) assert.isAtMost(line.length, 40);
        // The fold is semantically transparent: both spellings re-parse alike.
        const parsed1 = yield* Yaml.parse(viaValuePath);
        assert.deepStrictEqual(parsed1, doc.toValue());
      })
    );
  });

  describe("toValue", () => {
    it.effect("resolves anchors and aliases", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("base: &x 1\nref: *x");
        assert.deepStrictEqual(doc.toValue(), { base: 1, ref: 1 });
      })
    );

    it.effect("returns null for empty documents", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("");
        assert.isNull(doc.toValue());
      })
    );
  });

  describe("schema", () => {
    it.effect("decodes text into a document and encodes it back", () =>
      Effect.gen(function* () {
        const codec = YamlDocument.schema();
        const doc = yield* S.decodeEffect(codec)("key: value\n");
        assert.instanceOf(doc, YamlDocument);
        assert.deepStrictEqual(doc.toValue(), { key: "value" });
        const text = yield* S.encodeUnknownEffect(codec)(doc);
        assert.strictEqual(text, "key: value\n");
      })
    );

    it.effect("decode failures surface as SchemaError carrying the aggregate message", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(S.decodeEffect(YamlDocument.schema())("a: *missing"));
        assert.strictEqual(error._tag, "SchemaError");
        assert.include(String(error), "YAML parse failed");
      })
    );
  });

  describe("source spans", () => {
    it.effect("alias node spans include the * sigil so findAtOffset resolves the last name character", () =>
      Effect.gen(function* () {
        const text = "a: &anc 1\nb: *anc\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const alias = root.items[1]?.value;
        if (!S.is(YamlAlias)(alias)) {
          return assert.fail("expected an alias value");
        }
        assert.strictEqual(Str.slice(alias.offset, alias.offset + alias.length)(text), "*anc");
        const lastNameChar = O.getOrElse(constant(-1))(Str.indexOf("*anc")(text)) + "*anc".length - 1;
        const found = root.findAtOffset(lastNameChar);
        if (O.isNone(found)) {
          return assert.fail("findAtOffset missed the last character of the alias");
        }
        assert.strictEqual(found.value, alias);
      })
    );

    it.effect("a folded plain scalar in block-map value position spans the full scalar and keeps sourceMultiline", () =>
      Effect.gen(function* () {
        const text = "key: first line\n  second line\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const scalar = root.items[0]?.value;
        if (!S.is(YamlScalar)(scalar)) {
          return assert.fail("expected a scalar value");
        }
        assert.strictEqual(scalar.value, "first line second line");
        assert.strictEqual(scalar.offset, O.getOrElse(constant(-1))(Str.indexOf("first")(text)));
        assert.strictEqual(
          scalar.offset + scalar.length,
          O.getOrElse(constant(-1))(Str.indexOf("second line")(text)) + "second line".length
        );
        assert.strictEqual(scalar.sourceMultiline, true);
        const found = root.findAtOffset(O.getOrElse(constant(-1))(Str.indexOf("second")(text)));
        if (O.isNone(found)) {
          return assert.fail("findAtOffset missed the second line of the folded scalar");
        }
        assert.strictEqual(found.value, scalar);
      })
    );

    it.effect("a folded plain scalar in a block-seq entry spans the full scalar and keeps sourceMultiline", () =>
      Effect.gen(function* () {
        const text = "- first\n  second\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlSeq)(root)) {
          return assert.fail("expected a sequence root");
        }
        const scalar = root.items[0];
        if (!S.is(YamlScalar)(scalar)) {
          return assert.fail("expected a scalar item");
        }
        assert.strictEqual(scalar.value, "first second");
        assert.strictEqual(scalar.offset, O.getOrElse(constant(-1))(Str.indexOf("first")(text)));
        assert.strictEqual(
          scalar.offset + scalar.length,
          O.getOrElse(constant(-1))(Str.indexOf("second")(text)) + "second".length
        );
        assert.strictEqual(scalar.sourceMultiline, true);
        const found = root.findAtOffset(O.getOrElse(constant(-1))(Str.indexOf("second")(text)));
        if (O.isNone(found)) {
          return assert.fail("findAtOffset missed the second line of the folded scalar");
        }
        assert.strictEqual(found.value, scalar);
      })
    );

    it.effect("a folded plain scalar inside a flow collection spans the full scalar and keeps sourceMultiline", () =>
      Effect.gen(function* () {
        const text = "[ first\n  second ]\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlSeq)(root)) {
          return assert.fail("expected a flow sequence root");
        }
        const scalar = root.items[0];
        if (!S.is(YamlScalar)(scalar)) {
          return assert.fail("expected a scalar item");
        }
        assert.strictEqual(scalar.value, "first second");
        assert.strictEqual(scalar.offset, O.getOrElse(constant(-1))(Str.indexOf("first")(text)));
        assert.strictEqual(
          scalar.offset + scalar.length,
          O.getOrElse(constant(-1))(Str.indexOf("second")(text)) + "second".length
        );
        assert.strictEqual(scalar.sourceMultiline, true);
        const found = root.findAtOffset(O.getOrElse(constant(-1))(Str.indexOf("second")(text)));
        if (O.isNone(found)) {
          return assert.fail("findAtOffset missed the second line of the folded scalar");
        }
        assert.strictEqual(found.value, scalar);
      })
    );

    it.effect("a single-line plain scalar keeps its exact span and no sourceMultiline", () =>
      Effect.gen(function* () {
        const text = "key: value\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const scalar = root.items[0]?.value;
        if (!S.is(YamlScalar)(scalar)) {
          return assert.fail("expected a scalar value");
        }
        assert.strictEqual(scalar.offset, O.getOrElse(constant(-1))(Str.indexOf("value")(text)));
        assert.strictEqual(scalar.length, "value".length);
        assert.strictEqual(scalar.sourceMultiline, undefined);
      })
    );

    it.effect("round-trip of a folded multi-line plain scalar keeps the folded plain style", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("key: first line\n  second line\n");
        const out = yield* doc.stringify();
        assert.strictEqual(out, "key: first line second line\n");
        const again = yield* YamlDocument.parse(out);
        assert.deepStrictEqual(again.toValue(), { key: "first line second line" });
      })
    );

    // #643. The block composers already DISOWN a terminal comment sitting at
    // a column shallower than the collection's content — it escapes to the
    // outer scope and leads the following key. The raw CST span disagreed,
    // ending after the comment line, so a caller splicing at the end of the
    // collection inserted after a comment the collection does not own.
    it.effect("a shallower trailing comment ends the block-seq span rather than joining the last item", () =>
      Effect.gen(function* () {
        const text =
          "verified:\n  - by: human:spencer\n    at: 2026-09-01T00:00:00Z\n# reviewed before release\nstatus: stable\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const seq = root.items[0]?.value;
        if (!S.is(YamlSeq)(seq)) {
          return assert.fail("expected a sequence value");
        }
        const commentStart = O.getOrElse(constant(-1))(Str.indexOf("# reviewed before release")(text));
        // The span ends where the last item's line ends — at the comment
        // line's first character, never past it.
        assert.strictEqual(seq.offset + seq.length, commentStart);
        assert.strictEqual(
          Str.slice(seq.offset, seq.offset + seq.length)(text),
          "- by: human:spencer\n    at: 2026-09-01T00:00:00Z\n"
        );
        // The last item — the mapping the comment was swallowed into —
        // ends there too.
        const item = seq.items[0];
        if (!S.is(YamlMap)(item)) {
          return assert.fail("expected a mapping item");
        }
        assert.strictEqual(item.offset + item.length, commentStart);
        // Splicing a new item at the seq's end lands BEFORE the comment.
        const spliced = `${Str.slice(0, seq.offset + seq.length)(text)}  - by: human:other\n${Str.slice(seq.offset + seq.length)(text)}`;
        assert.deepStrictEqual((yield* YamlDocument.parse(spliced)).toValue(), {
          verified: [{ by: "human:spencer", at: "2026-09-01T00:00:00Z" }, { by: "human:other" }],
          status: "stable",
        });
        // Attribution is unchanged: the comment still leads the next key.
        const statusKey = root.items[1]?.key;
        if (!S.is(YamlScalar)(statusKey)) {
          return assert.fail("expected a scalar key");
        }
        assert.strictEqual(statusKey.commentBefore, " reviewed before release");
      })
    );

    it.effect("a trailing comment at or beyond the collection's own column stays inside its span", () =>
      Effect.gen(function* () {
        // The mirror of the case above: `  # kept` sits at the sequence's
        // own column, so the seq owns it and the span must still cover it
        // — the trim keys on the comment model's partition, not on
        // "ends in a comment line".
        const text = "verified:\n  - by: a\n  # kept\nstatus: stable\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const seq = root.items[0]?.value;
        if (!S.is(YamlSeq)(seq)) {
          return assert.fail("expected a sequence value");
        }
        assert.strictEqual(seq.offset + seq.length, O.getOrElse(constant(-1))(Str.indexOf("status")(text)));
        // The nested mapping's content column IS deeper than the comment,
        // so the item disowns it and its span stops at the comment line.
        const item = seq.items[0];
        if (!S.is(YamlMap)(item)) {
          return assert.fail("expected a mapping item");
        }
        assert.strictEqual(item.offset + item.length, O.getOrElse(constant(-1))(Str.indexOf("  # kept")(text)));
      })
    );

    it.effect("a shallower trailing comment ends a nested block-map span too", () =>
      Effect.gen(function* () {
        const text = "outer:\n  inner: 1\n# tail\nstatus: stable\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const inner = root.items[0]?.value;
        if (!S.is(YamlMap)(inner)) {
          return assert.fail("expected a mapping value");
        }
        assert.strictEqual(inner.offset + inner.length, O.getOrElse(constant(-1))(Str.indexOf("# tail")(text)));
        // The ROOT map's own column is 0, so a column-0 comment is not
        // shallower than its content and the root span is untouched.
        assert.strictEqual(root.offset + root.length, text.length);
      })
    );

    it.effect("a blank line above a disowned comment run leaves the collection with it", () =>
      Effect.gen(function* () {
        const text = "verified:\n  - by: a\n\n# tail\nstatus: s\n";
        const doc = yield* YamlDocument.parse(text);
        const root = doc.contents;
        if (!S.is(YamlMap)(root)) {
          return assert.fail("expected a mapping root");
        }
        const seq = root.items[0]?.value;
        if (!S.is(YamlSeq)(seq)) {
          return assert.fail("expected a sequence value");
        }
        // End of `  - by: a\n` — the blank line separating the entry from
        // the disowned comment goes with the comment, not the entry.
        assert.strictEqual(
          seq.offset + seq.length,
          O.getOrElse(constant(-1))(Str.indexOf("by: a")(text)) + "by: a\n".length
        );
      })
    );
  });
});

describe("YamlDirective schema property", () => {
  it.effect.prop(
    "YamlDirective decodes its encoding and preserves schema equivalence",
    [Arbitrary.schema(YamlDirective)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(YamlDirective)(value);
        const decoded = yield* S.decodeEffect(YamlDirective)(encoded);
        assert.isTrue(S.toEquivalence(YamlDirective)(decoded, value));
      }),
    { arbitrary: fcRuns(100) }
  );
});
