import { assert, describe, it } from "@effect/vitest";
import { assertSome, assertNone, assertSuccess, assertFailure } from "@effect/vitest/utils";
import * as Data from "effect/Data";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";
import { CheckOutcome, SyncOutcome } from "../../effected/templates/SectionOutcome.ts";
import { SectionReconciliation, SectionParseError } from "../../effected/templates/SectionDocument.ts";
import { Eol } from "../../effected/templates/SectionDialect.ts";
import { ReconcileInput, ReconcileOutput } from "../../effected/templates/internal/reconcile.ts";
import {
  SCAN_FAILURE_REASONS,
  ScanFailureReason,
  ScanFailure,
  ScanResult,
  scan,
} from "../../effected/templates/internal/scan.ts";
import { begin, block, crlf, end, id, lines, parse, parseFailure, section } from "./fixtures.ts";

describe("SectionDocument.parseResult", () => {
  describe("locating sections", () => {
    it("finds nothing in a document with no markers", () => {
      const doc = parse("just some user text\n");
      assert.lengthOf(doc.sections, 0);
    });

    it("finds a section and captures its content exactly", () => {
      const doc = parse(lines("header", block("example-tool", "echo hi"), "footer", ""));
      assert.lengthOf(doc.sections, 1);
      assert.strictEqual(doc.sections[0]?.section.content, "echo hi");
      assert.strictEqual(doc.sections[0]?.section.key, "example-tool");
    });

    it("reports the span so the block can be sliced back out verbatim", () => {
      const text = lines("header", block("example-tool", "body"), "footer", "");
      const doc = parse(text);
      const placed = doc.sections[0];
      assert.isDefined(placed);
      assert.strictEqual(text.slice(placed.start, placed.end), block("example-tool", "body"));
    });

    it("reports a 1-based line for the begin marker", () => {
      const doc = parse(lines("one", "two", block("example-tool", "body"), ""));
      assert.strictEqual(doc.sections[0]?.line, 3);
    });

    it("finds sections in document order, across comment styles", () => {
      const text = lines(
        block("first", "a"),
        "",
        "<!-- --- BEGIN second MANAGED SECTION --- -->",
        "b",
        "<!-- --- END second MANAGED SECTION --- -->",
        ""
      );
      const doc = parse(text);
      assert.deepStrictEqual(
        doc.sections.map((placed) => placed.section.key),
        ["first", "second"]
      );
    });

    it("preserves empty content through a round trip", () => {
      const doc = parse(block("example-tool", ""));
      assert.strictEqual(doc.sections[0]?.section.content, "");
    });

    it("keeps interior blank lines, stripping only the boundary line breaks", () => {
      const doc = parse(block("example-tool", "a\n\nb"));
      assert.strictEqual(doc.sections[0]?.section.content, "a\n\nb");
    });

    it("does not treat prose mentioning the phrase as a marker", () => {
      const doc = parse("this MANAGED SECTION is prose\n");
      assert.lengthOf(doc.sections, 0);
    });

    it("ignores a marker whose comment style the dialect does not recognize", () => {
      const narrow = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.slash] });
      const doc = parse(block("example-tool", "body"), narrow);
      assert.lengthOf(doc.sections, 0);
    });
  });

  describe("line endings", () => {
    it("detects LF", () => {
      assert.strictEqual(parse("a\nb\n").eol, "\n");
    });

    it("detects CRLF", () => {
      assert.strictEqual(parse(crlf("a\nb\n")).eol, "\r\n");
    });

    it("finds sections in a CRLF document, which the v3 scanner could not", () => {
      const doc = parse(crlf(lines("header", block("example-tool", "echo hi"), "")));
      assert.lengthOf(doc.sections, 1);
    });

    it("normalizes parsed content to LF so comparison is honest", () => {
      const doc = parse(crlf(lines(block("example-tool", "a\nb"), "")));
      assert.strictEqual(doc.sections[0]?.section.content, "a\nb");
    });
  });

  describe("ambiguity fails typed", () => {
    it("rejects a begin marker with no end", () => {
      const error = parseFailure(lines("header", begin("example-tool"), "body", ""));
      assert.strictEqual(error._tag, "SectionParseError");
      assert.strictEqual(error.reason, "unterminatedSection");
      assert.strictEqual(error.line, 2);
      assert.strictEqual(error.key, "example-tool");
    });

    it("rejects an end marker with no begin", () => {
      const error = parseFailure(lines("header", end("example-tool"), ""));
      assert.strictEqual(error.reason, "orphanedEnd");
      assert.strictEqual(error.line, 2);
    });

    it("rejects an end marker that does not close what is open", () => {
      const error = parseFailure(lines(begin("a"), "body", end("b"), ""));
      assert.strictEqual(error.reason, "orphanedEnd");
      assert.strictEqual(error.key, "b");
    });

    it("rejects a begin marker inside another section", () => {
      const error = parseFailure(lines(begin("a"), begin("b"), end("b"), end("a"), ""));
      assert.strictEqual(error.reason, "overlappingSections");
      assert.strictEqual(error.line, 2);
      assert.strictEqual(error.key, "b");
    });

    it("rejects two sections with the same identity", () => {
      const error = parseFailure(lines(block("dup", "one"), block("dup", "two"), ""));
      assert.strictEqual(error.reason, "duplicateSection");
      assert.strictEqual(error.key, "dup");
      assert.strictEqual(error.line, 4, "points at the second occurrence");
    });

    it("allows the same key under two different comment styles", () => {
      const text = lines(
        block("shared", "hash"),
        "// --- BEGIN shared MANAGED SECTION ---",
        "slash",
        "// --- END shared MANAGED SECTION ---",
        ""
      );
      assert.lengthOf(parse(text).sections, 2);
    });
  });

  describe("parse — the Effect twin", () => {
    it.effect("succeeds with the same document the primitive returns", () =>
      Effect.gen(function* () {
        const text = lines(block("example-tool", "body"), "");
        const viaEffect = yield* SectionDocument.parse(text);
        assert.isTrue(Equal.equals(viaEffect, parse(text)));
      })
    );

    it.effect("fails through the typed channel, never as a defect", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(SectionDocument.parse(begin("example-tool")));
        assert.strictEqual(error._tag, "SectionParseError");
        assert.strictEqual(error.reason, "unterminatedSection");
      })
    );
  });

  describe("read / has", () => {
    const doc = parse(lines(block("example-tool", "echo hi"), ""));

    it("reads a present section", () => {
      const found = doc.read(id("example-tool"));
      assertSome(found, O.getOrThrow(found));
      assert.strictEqual(O.getOrThrow(found).content, "echo hi");
    });

    it("answers none for an absent section", () => {
      assertNone(doc.read(id("other")));
    });

    it("does not match a different comment style", () => {
      const slash = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.slash });
      assertNone(doc.read(slash));
    });

    it("is case-sensitive", () => {
      assertNone(doc.read(id("EXAMPLE-TOOL")));
    });

    it("has answers the same question as read", () => {
      assert.isTrue(doc.has(id("example-tool")));
      assert.isFalse(doc.has(id("other")));
    });
  });

  describe("check", () => {
    const doc = parse(lines(block("example-tool", "echo hi"), ""));

    it("reports Absent for a section that is not there", () => {
      const outcome = doc.check(section("other", "x"));
      assert.strictEqual(outcome._tag, "Absent");
    });

    it("reports UpToDate for identical content", () => {
      assert.strictEqual(doc.check(section("example-tool", "echo hi"))._tag, "UpToDate");
    });

    it("reports Drifted with both sides for changed content", () => {
      const outcome = doc.check(section("example-tool", "echo bye"));
      assert.strictEqual(outcome._tag, "Drifted");
      if (outcome._tag !== "Drifted") {
        return;
      }
      assert.strictEqual(outcome.onDisk.content, "echo hi");
      assert.strictEqual(outcome.expected.content, "echo bye");
    });

    it("reports drift for a whitespace-only change, which v3 swallowed", () => {
      assert.strictEqual(doc.check(section("example-tool", "  echo hi"))._tag, "Drifted");
    });

    it("is line-ending agnostic, so a CRLF document does not drift forever", () => {
      const crlfDoc = parse(crlf(lines(block("example-tool", "echo hi"), "")));
      assert.strictEqual(crlfDoc.check(section("example-tool", "echo hi"))._tag, "UpToDate");
    });

    it("normalizes the DECLARED side too, so CRLF content does not drift against an LF document", () => {
      // The other direction: the document is LF (or was normalized at parse)
      // and the caller hands over content carrying CRLF. Without normalizing
      // the declared side, this reports drift forever and rewrites on every run.
      const lfDoc = parse(lines(block("example-tool", "a\nb"), ""));
      assert.strictEqual(lfDoc.check(section("example-tool", "a\r\nb"))._tag, "UpToDate");
    });
  });

  describe("remove", () => {
    it("answers none when the section is not present", () => {
      assertNone(parse("nothing here\n").remove(id("example-tool")));
    });

    it("drops the block and collapses the surrounding blank lines", () => {
      const doc = parse(lines("header", "", block("example-tool", "body"), "", "footer", ""));
      const next = O.getOrThrow(doc.remove(id("example-tool")));
      assert.strictEqual(next, lines("header", "", "footer", ""));
    });

    it("does not accumulate gaps across repeated removals", () => {
      const doc = parse(lines("header", "", block("a", "1"), "", block("b", "2"), "", "footer", ""));
      const once = O.getOrThrow(doc.remove(id("a")));
      const twice = O.getOrThrow(parse(once).remove(id("b")));
      assert.strictEqual(twice, lines("header", "", "footer", ""));
    });

    it("leaves a lone section's file empty rather than newline-littered", () => {
      const doc = parse(`${block("only", "body")}\n`);
      assert.strictEqual(O.getOrThrow(doc.remove(id("only"))), "");
    });

    it("preserves the document's line endings", () => {
      const doc = parse(crlf(lines("header", "", block("example-tool", "body"), "", "footer", "")));
      const next = O.getOrThrow(doc.remove(id("example-tool")));
      assert.strictEqual(next, crlf(lines("header", "", "footer", "")));
    });
  });
});

describe("SectionDocument review regressions", () => {
  it("reads a first-line BEGIN after the BOM and preserves its bytes on reconciliation", () => {
    for (const eol of Eol.literals) {
      const text = "\uFEFF" + [begin("tool"), "old", end("tool"), "footer", ""].join(eol);
      const doc = parse(text);
      assert.strictEqual(doc.text, text);
      assert.strictEqual(doc.eol, eol);
      assert.strictEqual(doc.sections[0]?.start, 1);
      assert.strictEqual(doc.sections[0]?.line, 1);
      assert.strictEqual(O.getOrThrow(doc.read(id("tool"))).content, "old");
      const same = doc.reconcile([section("tool", "old")]);
      if (!Result.isSuccess(same)) assert.fail("BOM document must reconcile");
      assert.strictEqual(same.success.text, text);
      assert.isFalse(same.success.changed);
      const updated = doc.reconcile([section("tool", "new")]);
      if (!Result.isSuccess(updated)) assert.fail("BOM document must update");
      assert.strictEqual(updated.success.text, "\uFEFF" + [begin("tool"), "new", end("tool"), "footer", ""].join(eol));
    }
  });

  it.effect("parses a BOM-prefixed section through the Effect primitive", () =>
    Effect.gen(function* () {
      const doc = yield* SectionDocument.parse("\uFEFF" + block("tool", "body"));
      assert.strictEqual(O.getOrThrow(doc.read(id("tool"))).content, "body");
      assert.strictEqual(doc.check(section("tool", "body"))._tag, "UpToDate");
    })
  );

  it("does not treat an interior BOM as a first-line BOM", () => {
    const error = parseFailure("header\n\uFEFF" + block("tool", "body"));
    assert.strictEqual(error.reason, "orphanedEnd");
  });

  it("checks CRLF declarations against their render without immediate drift", () => {
    const expected = section("tool", "a\r\nb");
    for (const eol of Eol.literals) {
      const rendered = SectionDialect.default.render(expected, eol);
      if (!Result.isSuccess(rendered)) assert.fail("CRLF content must render");
      const doc = parse(rendered.success);
      assert.strictEqual(O.getOrThrow(doc.read(expected.id)).content, "a\nb");
      assert.strictEqual(doc.check(expected)._tag, "UpToDate");
      const reconciled = doc.reconcile([expected]);
      if (!Result.isSuccess(reconciled)) assert.fail("rendered document must reconcile");
      assert.strictEqual(reconciled.success.text, rendered.success);
      assert.isFalse(reconciled.success.changed);
    }
  });

  it("shares reconciliation schema authority and retains plain required fields", () => {
    assert.strictEqual(SectionReconciliation, ReconcileOutput);
    const doc = parse(block("tool", "body"));
    const input = {
      text: doc.text,
      placed: doc.sections,
      declared: [section("tool", "body")],
      dialect: doc.dialect,
      eol: doc.eol,
    };
    assert.isTrue(S.is(ReconcileInput)(input));
    for (const key of Object.keys(input)) {
      const incomplete = Object.fromEntries(Object.entries(input).filter(([name]) => name !== key));
      assert.isFalse(S.is(ReconcileInput)(incomplete));
    }
    assert.isFalse(S.is(ReconcileInput)({ ...input, eol: "\r" }));
    const result = doc.reconcile(input.declared);
    if (!Result.isSuccess(result)) assert.fail("valid input must reconcile");
    assert.strictEqual(Object.getPrototypeOf(result.success), Object.prototype);
    assert.isTrue(S.is(SectionReconciliation)(result.success));
    for (const value of [
      { text: "", outcomes: [] },
      { text: "", changed: false },
      { outcomes: [], changed: false },
    ]) {
      assert.isFalse(S.is(SectionReconciliation)(value));
    }
    for (const eol of Eol.literals) {
      assert.isTrue(S.is(SectionDocument)(SectionDocument.make({ ...doc, eol })));
      assertSuccess(
        S.decodeResult(SectionDocument)({ ...doc, eol }),
        Result.getOrThrow(S.decodeResult(SectionDocument)({ ...doc, eol }))
      );
    }
    assertFailure(
      S.decodeUnknownResult(SectionDocument)({ ...doc, eol: "\r" }),
      S.decodeUnknownResult(SectionDocument)({ ...doc, eol: "\r" }).pipe(Result.getFailure, O.getOrThrow)
    );
  });

  it("retains scan result discriminants and the required undefined-capable failure key", () => {
    assert.strictEqual(SCAN_FAILURE_REASONS, ScanFailureReason.literals);
    for (const reason of SCAN_FAILURE_REASONS) {
      const failure = { reason, line: 1, key: undefined };
      assert.isTrue(S.is(ScanFailure)(failure));
      assert.isTrue(S.is(ScanResult)({ ok: false, failure }));
      assert.isTrue(S.is(SectionParseError.fields.reason)(reason));
      assert.isFalse(S.is(ScanFailure)({ reason, line: 1 }));
    }
    assert.isFalse(S.is(ScanFailureReason)("unknown"));
    assert.isFalse(S.is(ScanResult)({ ok: true }));
    assert.isFalse(S.is(ScanResult)({ ok: false }));
    assert.isFalse(S.is(ScanResult)({ ok: "true", sections: [] }));
    for (const text of ["", block("tool", "body"), begin("tool"), end("tool")]) {
      const result = scan(text, SectionDialect.default);
      assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
      assert.isTrue(S.is(ScanResult)(result));
      if (!result.ok) assert.strictEqual(Object.getPrototypeOf(result.failure), Object.prototype);
    }
  });

  it("preserves all outcome Data constructors, payloads, equality and matcher APIs", () => {
    const before = section("tool", "old");
    const after = section("tool", "new");
    const syncOracle = Data.taggedEnum<SyncOutcome>();
    const checkOracle = Data.taggedEnum<CheckOutcome>();
    const syncPairs = [
      [SyncOutcome.Created({ section: after }), syncOracle.Created({ section: after })],
      [SyncOutcome.Updated({ before, after }), syncOracle.Updated({ before, after })],
      [SyncOutcome.Unchanged({ section: after }), syncOracle.Unchanged({ section: after })],
    ] as const;
    const checkPairs = [
      [CheckOutcome.Absent({ id: before.id }), checkOracle.Absent({ id: before.id })],
      [CheckOutcome.UpToDate({ section: after }), checkOracle.UpToDate({ section: after })],
      [
        CheckOutcome.Drifted({ onDisk: before, expected: after }),
        checkOracle.Drifted({ onDisk: before, expected: after }),
      ],
    ] as const;
    assert.isTrue(S.isSchema(SyncOutcome));
    assert.isTrue(S.isSchema(CheckOutcome));
    for (const [actual, oracle] of syncPairs) {
      assert.deepStrictEqual(actual, oracle);
      assert.strictEqual(Object.getPrototypeOf(actual), Object.getPrototypeOf(oracle));
      assert.isTrue(Equal.equals(actual, oracle));
      assert.isTrue(S.is(SyncOutcome)(actual));
      assert.isTrue(SyncOutcome.$is(actual._tag)(actual));
      const cases = {
        Created: (value: Extract<SyncOutcome, { _tag: "Created" }>) => value.section,
        Updated: (value: Extract<SyncOutcome, { _tag: "Updated" }>) => value.after,
        Unchanged: (value: Extract<SyncOutcome, { _tag: "Unchanged" }>) => value.section,
      };
      assert.strictEqual(SyncOutcome.$match(actual, cases), after);
      assert.strictEqual(SyncOutcome.$match(cases)(actual), after);
    }
    for (const [actual, oracle] of checkPairs) {
      assert.deepStrictEqual(actual, oracle);
      assert.strictEqual(Object.getPrototypeOf(actual), Object.getPrototypeOf(oracle));
      assert.isTrue(Equal.equals(actual, oracle));
      assert.isTrue(S.is(CheckOutcome)(actual));
      assert.isTrue(CheckOutcome.$is(actual._tag)(actual));
      const cases = {
        Absent: (value: Extract<CheckOutcome, { _tag: "Absent" }>) => value.id.key,
        UpToDate: (value: Extract<CheckOutcome, { _tag: "UpToDate" }>) => value.section.key,
        Drifted: (value: Extract<CheckOutcome, { _tag: "Drifted" }>) => value.expected.key,
      };
      assert.strictEqual(CheckOutcome.$match(actual, cases), "tool");
      assert.strictEqual(CheckOutcome.$match(cases)(actual), "tool");
    }
    assert.isFalse(SyncOutcome.$is("Updated")(syncPairs[0][0]));
    assert.isFalse(CheckOutcome.$is("Drifted")(checkPairs[0][0]));
    assert.isFalse(S.is(SyncOutcome)({ _tag: "Updated", before }));
    assert.isFalse(S.is(CheckOutcome)({ _tag: "Drifted", onDisk: before }));
  });
});
