import { assert, describe, it, vi } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Equal from "effect/Equal";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Immer } from "immer";
import * as AttributeParsing from "../../effected/templates/internal/attributes.ts";
import type { SectionRenderError } from "../../effected/templates/index.ts";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";

import { Eol } from "../../effected/templates/SectionDialect.ts";
import { ATTRIBUTE_NAME_PATTERN, AttributeName, AttributeValue } from "../../effected/templates/internal/attributes.ts";

const hashId = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
const htmlId = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.html });

const expectSuccess = (result: Result.Result<string, SectionRenderError>): string => {
  if (!Result.isSuccess(result)) {
    assert.fail(`expected a rendered section, got ${result.failure.reason}`);
  }
  return result.success;
};

const expectFailure = (result: Result.Result<string, SectionRenderError>): SectionRenderError => {
  if (!Result.isFailure(result)) {
    assert.fail("expected a render failure");
  }
  return result.failure;
};

describe("SectionDialect", () => {
  describe("default", () => {
    it("uses the domain-free marker phrase", () => {
      assert.strictEqual(SectionDialect.default.phrase, "MANAGED SECTION");
    });

    it("recognizes every preset comment style", () => {
      for (const style of CommentStyle.presets) {
        assert.isTrue(SectionDialect.default.recognizes(style));
      }
    });

    it("does not recognize a style outside its set", () => {
      assert.isFalse(SectionDialect.default.recognizes(CommentStyle.make({ prefix: "%" })));
    });
  });

  describe("markers", () => {
    it("renders a line style in the v3-compatible shape", () => {
      assert.strictEqual(SectionDialect.default.beginMarker(hashId), "# --- BEGIN example-tool MANAGED SECTION ---");
      assert.strictEqual(SectionDialect.default.endMarker(hashId), "# --- END example-tool MANAGED SECTION ---");
    });

    it("closes a wrapped style, which is what makes Markdown and HTML representable", () => {
      assert.strictEqual(
        SectionDialect.default.beginMarker(htmlId),
        "<!-- --- BEGIN example-tool MANAGED SECTION --- -->"
      );
      assert.strictEqual(SectionDialect.default.endMarker(htmlId), "<!-- --- END example-tool MANAGED SECTION --- -->");
    });

    it("renders the key verbatim — keys are case-sensitive", () => {
      const upper = SectionId.make({ key: "SAVVY-LINT", commentStyle: CommentStyle.hash });
      assert.include(SectionDialect.default.beginMarker(upper), "BEGIN SAVVY-LINT MANAGED");
      const lower = SectionId.make({ key: "savvy-lint", commentStyle: CommentStyle.hash });
      assert.include(SectionDialect.default.beginMarker(lower), "BEGIN savvy-lint MANAGED");
    });

    it("honors a custom phrase", () => {
      const dialect = SectionDialect.make({ phrase: "GENERATED BLOCK", styles: CommentStyle.presets });
      assert.strictEqual(dialect.beginMarker(hashId), "# --- BEGIN example-tool GENERATED BLOCK ---");
    });
  });

  describe("render", () => {
    it("wraps content in markers, one line break each side", () => {
      const text = expectSuccess(SectionDialect.default.render(hashId.section("echo hi")));
      assert.strictEqual(
        text,
        ["# --- BEGIN example-tool MANAGED SECTION ---", "echo hi", "# --- END example-tool MANAGED SECTION ---"].join(
          "\n"
        )
      );
    });

    it("renders empty content as two adjacent markers", () => {
      const text = expectSuccess(SectionDialect.default.render(hashId.section("")));
      assert.strictEqual(
        text,
        ["# --- BEGIN example-tool MANAGED SECTION ---", "", "# --- END example-tool MANAGED SECTION ---"].join("\n")
      );
    });

    it("emits the requested line ending throughout", () => {
      const text = expectSuccess(SectionDialect.default.render(hashId.section("a\nb"), "\r\n"));
      assert.strictEqual(text.split("\r\n").length, 4);
      assert.isFalse(/[^\r]\n/.test(text), "every LF must be preceded by a CR");
    });

    it("refuses content carrying a marker, which would move the block boundary", () => {
      const hostile = hashId.section("ok\n# --- END example-tool MANAGED SECTION ---\nsmuggled");
      const error = expectFailure(SectionDialect.default.render(hostile));
      assert.strictEqual(error._tag, "SectionRenderError");
      assert.strictEqual(error.reason, "markerInContent");
      assert.strictEqual(error.key, "example-tool");
    });

    it("refuses a begin marker for any recognized style, not just its own", () => {
      const hostile = hashId.section("<!-- --- BEGIN other MANAGED SECTION --- -->");
      assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
    });

    it("refuses the same hostile content every time it is asked", () => {
      // The scanners carry the `g` flag; a `regex.test` implementation would
      // advance `lastIndex` and let the second call through.
      const hostile = hashId.section("# --- END example-tool MANAGED SECTION ---");
      assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
      assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
      assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
    });

    it("allows content that merely mentions the phrase without forming a marker", () => {
      const benign = hashId.section("# this MANAGED SECTION comment is prose, not a marker");
      assertSuccess(SectionDialect.default.render(benign), Result.getOrThrow(SectionDialect.default.render(benign)));
    });

    it("refuses a section whose style the dialect cannot scan back", () => {
      const narrow = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
      const error = expectFailure(
        narrow.render(SectionId.make({ key: "k", commentStyle: CommentStyle.slash }).section("x"))
      );
      assert.strictEqual(error.reason, "unknownCommentStyle");
    });
  });

  describe("construction", () => {
    it("refuses a phrase that could collide with the marker rule", () => {
      for (const phrase of ["", " ", "---", "BEGIN-ISH-", "has\nnewline"]) {
        assert.throws(
          () => SectionDialect.make({ phrase, styles: CommentStyle.presets }),
          undefined,
          undefined,
          phrase
        );
      }
    });

    it("refuses an empty style set, which would make every section unrenderable", () => {
      assert.throws(() => SectionDialect.make({ phrase: "MANAGED SECTION", styles: [] }));
    });
  });

  describe("JSON Schema export", () => {
    it("phrase exports its pattern", () => {
      assert.nestedPropertyVal(
        S.toJsonSchemaDocument(SectionDialect),
        "definitions.@beep/scratchpad/effected/templates/SectionDialect/SectionDialectEncoded.properties.phrase.pattern",
        "^[A-Za-z0-9][A-Za-z0-9 _]*$"
      );
    });
  });
});

describe("SectionDialect review regressions", () => {
  it("normalizes CRLF content before emitting either supported EOL", () => {
    const section = hashId.section("a\r\nb\nc\r\n");
    for (const eol of Eol.literals) {
      const text = expectSuccess(SectionDialect.default.render(section, eol));
      assert.strictEqual(
        text,
        [SectionDialect.default.beginMarker(hashId), "a", "b", "c", "", SectionDialect.default.endMarker(hashId)].join(
          eol
        )
      );
      assert.isFalse(text.includes("\r\r\n"));
      const parsed = SectionDocument.parseResult(text);
      if (!Result.isSuccess(parsed)) assert.fail("rendered content must parse");
      assert.strictEqual(parsed.success.check(section)._tag, "UpToDate");
    }
  });

  it("accepts exactly LF and CRLF through the Eol schema", () => {
    assert.deepStrictEqual(Eol.literals, ["\n", "\r\n"]);
    for (const eol of Eol.literals) assert.isTrue(S.is(Eol)(eol));
    for (const eol of ["", "\r", "\n\n", "LF"]) assert.isFalse(S.is(Eol)(eol));
  });

  it("owns reusable matchers separately for equal dialect instances", () => {
    const left = SectionDialect.make({ phrase: "MANAGED SECTION", styles: CommentStyle.presets });
    const right = SectionDialect.make({ phrase: "MANAGED SECTION", styles: CommentStyle.presets });
    assert.isTrue(Equal.equals(left, right));
    assert.strictEqual(left.matchers(), left.matchers());
    assert.notStrictEqual(left.matchers(), right.matchers());
    for (const [index, matcher] of left.matchers().entries()) {
      assert.notStrictEqual(matcher.regex, right.matchers()[index]?.regex);
      assert.strictEqual(matcher.style, left.styles[index]);
    }
    const text = expectSuccess(left.render(hashId.section("body")));
    for (let count = 0; count < 3; count += 1) {
      assert.isTrue(left.containsMarker(text));
      const parsed = SectionDocument.parseResult(text, left);
      if (!Result.isSuccess(parsed)) assert.fail("repeated scans must succeed");
      assert.lengthOf(parsed.success.sections, 1);
      for (const matcher of left.matchers()) assert.strictEqual(matcher.regex.lastIndex, 0);
    }
    const narrow = SectionDialect.make({ phrase: "CUSTOM BLOCK", styles: [CommentStyle.slash] });
    assert.isFalse(narrow.containsMarker(text));
  });

  it.effect("keeps owned matcher state out of the encoded dialect", () =>
    Effect.gen(function* () {
      const dialect = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
      dialect.matchers();
      const encoded = yield* S.encodeEffect(SectionDialect)(dialect);
      assert.deepStrictEqual(encoded, { phrase: "MANAGED SECTION", styles: [{ prefix: "#" }] });
      assert.deepStrictEqual(Object.keys(dialect), ["phrase", "styles"]);
    })
  );

  it("derives attribute refusal from schemas while retaining dollar-anchor behavior", () => {
    for (const name of ["a", "A0_-", "a\n", "a\r", "a\r\n", "a\u2028", "a\u2029", "a\n\n", "", "0a", "_a", "a b"]) {
      const accepted = ATTRIBUTE_NAME_PATTERN.test(name);
      assert.strictEqual(S.is(AttributeName)(name), accepted, JSON.stringify(name));
      const result = SectionDialect.default.render(hashId.section("body", { [name]: "value" }));
      assert.strictEqual(Result.isSuccess(result), accepted, JSON.stringify(name));
      if (Result.isFailure(result)) {
        assert.strictEqual(result.failure.reason, "invalidAttribute");
        assert.strictEqual(result.failure.attribute, name);
      }
    }
    for (const value of ["", "hello", "\u2028", "\u2029", 'a"b', "a\n", "a\r", "a\r\n"]) {
      const accepted = !value.includes('"') && !value.includes("\n") && !value.includes("\r");
      assert.strictEqual(S.is(AttributeValue)(value), accepted);
      const result = SectionDialect.default.render(hashId.section("body", { name: value }));
      assert.strictEqual(Result.isSuccess(result), accepted);
      if (Result.isFailure(result)) assert.strictEqual(result.failure.reason, "invalidAttribute");
    }
  });
});


describe("SectionDialect round-2 regressions", () => {
  it("renders BOM-prefixed marker-shaped content without treating it as a document-leading marker", () => {
    for (const style of CommentStyle.presets) {
      const id = SectionId.make({ key: "tool", commentStyle: style });
      for (const marker of [SectionDialect.default.beginMarker(id), SectionDialect.default.endMarker(id)]) {
        const section = id.section("\uFEFF" + marker);
        assert.isFalse(SectionDialect.default.containsMarker(section.content));
        assert.isTrue(SectionDialect.default.containsMarker(marker));
        for (const eol of Eol.literals) {
          const rendered = expectSuccess(SectionDialect.default.render(section, eol));
          const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered));
          assert.strictEqual(parsed.sections[0]?.section.content, section.content);
          assert.strictEqual(parsed.check(section)._tag, "UpToDate");
          const repeated = Result.getOrThrow(parsed.reconcile([section]));
          assert.strictEqual(repeated.text, rendered);
          assert.isFalse(repeated.changed);
          const bomDocument = Result.getOrThrow(SectionDocument.parseResult("\uFEFF" + rendered));
          assert.strictEqual(bomDocument.sections[0]?.start, 1);
          assert.strictEqual(bomDocument.sections[0]?.section.content, section.content);
        }
      }
    }
  });

  it("refuses a trailing bare CR under LF but preserves it faithfully under CRLF", () => {
    for (const content of ["\r", "a\r", "a\r\nb\r", "a\r\r"]) {
      const section = hashId.section(content);
      const error = expectFailure(SectionDialect.default.render(section, "\n"));
      assert.strictEqual(error.reason, "trailingCarriageReturn");
      assert.strictEqual(error.key, hashId.key);
      assert.strictEqual(error.message, 'Section "example-tool" ends in a bare carriage return that LF rendering cannot preserve');
      const rendered = expectSuccess(SectionDialect.default.render(section, "\r\n"));
      const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered));
      assert.strictEqual(parsed.sections[0]?.section.content, content.replace(/\r\n/g, "\n"));
      assert.strictEqual(parsed.check(section)._tag, "UpToDate");
      assert.strictEqual(expectSuccess(SectionDialect.default.render(parsed.sections[0]?.section ?? section, "\r\n")), rendered);
    }
  });

  it("supports prototype-preserving dialect copies without borrowing the owner's cache", () => {
    const owner = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
    const copy = new Immer({ autoFreeze: false }).produce(owner, (draft) => {
      draft.phrase = "CUSTOM BLOCK";
    });
    assert.instanceOf(copy, SectionDialect);
    assert.notStrictEqual(copy, owner);
    assert.strictEqual(owner.matchers(), owner.matchers());
    const rendered = expectSuccess(copy.render(hashId.section("body")));
    assert.include(rendered, "CUSTOM BLOCK");
    assert.isTrue(copy.containsMarker(rendered));
    assert.isFalse(owner.containsMarker(rendered));
    assert.strictEqual(Result.getOrThrow(SectionDocument.parseResult(rendered, copy)).sections[0]?.section.content, "body");
  });

  it("bounds adversarial whitespace work and parses each extracted attribute run only once", () => {
    const parseRun = vi.spyOn(AttributeParsing, "parseAttributeRun");
    try {
      for (const size of [4096, 16384, 65536, 262144]) {
        const gap = " ".repeat(size);
        for (const style of [CommentStyle.hash, CommentStyle.html]) {
          const id = SectionId.make({ key: "tool", commentStyle: style });
          const prefix = `${style.prefix} --- BEGIN tool MANAGED SECTION`;
          const suffix = style.suffix === undefined ? "" : ` ${style.suffix}`;
          parseRun.mockClear();
          assert.isFalse(SectionDialect.default.containsMarker(`${prefix} x${gap}!`));
          assert.strictEqual(parseRun.mock.calls.length, 0);
          assert.isTrue(SectionDialect.default.containsMarker(`${prefix} note="--- quoted ---"${gap}---${suffix}${gap}`));
          assert.strictEqual(parseRun.mock.calls.length, 1);
          assert.deepStrictEqual(parseRun.mock.calls[0], ['note="--- quoted ---"']);
          assert.isFalse(SectionDialect.default.containsMarker(`${prefix} note="unterminated${gap}---${suffix}`));
          assert.isFalse(SectionDialect.default.containsMarker(`${style.prefix} --- END ${id.key} MANAGED SECTION note="x" ---${suffix}`));
        }
      }
    } finally {
      parseRun.mockRestore();
    }
  });

  it("recognizes exact closing rules and custom suffix whitespace while keeping malformed markers as content", () => {
    for (const suffix of [undefined, "-->", " --- ", "  "]) {
      const style = CommentStyle.make({ prefix: "%", ...(suffix === undefined ? {} : { suffix }) });
      const dialect = SectionDialect.make({ phrase: "CUSTOM BLOCK", styles: [style] });
      const id = SectionId.make({ key: "tool", commentStyle: style });
      const section = id.section("body", { note: "--- quoted ---" });
      const rendered = expectSuccess(dialect.render(section));
      assert.isTrue(dialect.containsMarker(rendered));
      const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered, dialect));
      assert.deepStrictEqual(parsed.sections[0]?.section.attributes, section.attributes);
      assert.strictEqual(parsed.sections[0]?.section.content, "body");
      assert.isFalse(dialect.containsMarker(dialect.beginMarker(id) + "!"));
    }
    for (const tail of [' ---!', ' x ---', ' note="unterminated ---', ' note="ok"note="bad" ---', ' note="a" note="b" ---', '---']) {
      assert.isFalse(SectionDialect.default.containsMarker("# --- BEGIN tool MANAGED SECTION" + tail));
    }
  });
});


it("reserves the marker separator after phrases with trailing whitespace", () => {
  for (const phrase of ["CUSTOM ", "CUSTOM   ", "CUSTOM  BLOCK  "]) {
    const dialect = SectionDialect.make({ phrase, styles: [CommentStyle.hash] });
    for (const attributes of [{}, { note: "--- quoted ---" }]) {
      const section = hashId.section("body", attributes);
      const rendered = expectSuccess(dialect.render(section));
      assert.isTrue(dialect.containsMarker(rendered));
      const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered, dialect));
      assert.strictEqual(parsed.sections[0]?.section.content, "body");
      assert.deepStrictEqual(parsed.sections[0]?.section.attributes, attributes);
    }
  }
});


it("preserves Unicode multiline boundaries and Unicode inside quoted attribute captures", () => {
  const dialect = SectionDialect.default;
  for (const separator of ["\u2028", "\u2029"]) {
    const begin = dialect.beginMarker(hashId);
    const end = dialect.endMarker(hashId);
    assert.isTrue(dialect.containsMarker(begin + separator + "ordinary content"));
    const text = begin + separator + "body" + separator + end;
    const markers = [...dialect.markerMatches(text)];
    assert.strictEqual(markers[0]?.[1][0], begin);
    assert.strictEqual(markers[0]?.[1][1], "BEGIN");
    assert.strictEqual(markers[0]?.[1][2], hashId.key);
    assert.strictEqual(markers[0]?.[1][3], undefined);
    assert.strictEqual(markers[1]?.[1].index, begin.length + separator.length + "body".length + separator.length);
    const doc = Result.getOrThrow(SectionDocument.parseResult(text));
    assert.strictEqual(doc.sections[0]?.section.content, separator + "body" + separator);
    const expected = hashId.section("body", { note: "a" + separator + "b --- quoted ---" });
    const rendered = expectSuccess(dialect.render(expected));
    const captured = [...dialect.markerMatches(rendered)];
    assert.strictEqual(captured[0]?.[1][3], `note="a${separator}b --- quoted ---"`);
    const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered));
    assert.deepStrictEqual(parsed.sections[0]?.section.attributes, expected.attributes);
    assert.strictEqual(parsed.check(expected)._tag, "UpToDate");
    const invalid = '# --- BEGIN invalid MANAGED SECTION note="unterminated ---' + separator + begin;
    const recovered = [...dialect.markerMatches(invalid)];
    assert.strictEqual(recovered.length, 1);
    assert.strictEqual(recovered[0]?.[1][2], hashId.key);
  }
});

it("rejects a wrapped closing rule without whitespace before its suffix", () => {
  const malformed = "<!-- --- BEGIN example-tool MANAGED SECTION ----->";
  assert.isFalse(SectionDialect.default.containsMarker(malformed));
  assert.deepStrictEqual([...SectionDialect.default.markerMatches(malformed)], []);
});

it("keeps marker-shaped Unicode attribute text inside its owning marker span", () => {
  const section = hashId.section("body", {
    note: "before\u2028# --- BEGIN nested MANAGED SECTION text\u2029after",
  });
  const rendered = expectSuccess(SectionDialect.default.render(section));
  const markers = [...SectionDialect.default.markerMatches(rendered)];
  assert.strictEqual(markers.length, 2);
  assert.deepStrictEqual(markers.map(([, match]) => [match[1], match[2]]), [
    ["BEGIN", hashId.key],
    ["END", hashId.key],
  ]);
  const parsed = Result.getOrThrow(SectionDocument.parseResult(rendered));
  assert.deepStrictEqual(parsed.sections[0]?.section.attributes, section.attributes);
  assert.strictEqual(parsed.check(section)._tag, "UpToDate");
});
