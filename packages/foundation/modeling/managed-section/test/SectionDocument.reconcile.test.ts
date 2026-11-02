import { CommentStyle, SectionDialect as Dialect, SectionId } from "@beep/managed-section";
import { ReconcileInput, ReconcileOutput, reconcile as reconcileCore } from "@beep/managed-section/internal/reconcile";
import { SectionReconciliation as Reconciliation } from "@beep/managed-section/SectionDocument";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { block, crlf, lines, parse, section } from "./fixtures.ts";
import type { Section, SectionDialect, SectionReconciliation, SectionRenderError } from "@beep/managed-section";

const run = (
  text: string,
  sections: ReadonlyArray<Section>,
  dialect: SectionDialect = Dialect.default
): SectionReconciliation => {
  const result = parse(text, dialect).reconcile(sections);
  if (!Result.isSuccess(result)) {
    assert.fail(`expected reconciliation to succeed, got ${result.failure.reason}`);
  }
  return result.success;
};

const runFailure = (text: string, sections: ReadonlyArray<Section>): SectionRenderError => {
  const result = parse(text).reconcile(sections);
  if (!Result.isFailure(result)) {
    assert.fail("expected reconciliation to be refused");
  }
  return result.failure;
};

const tags = (outcome: SectionReconciliation) => A.map(outcome.outcomes, (o) => o._tag);

const sectionA = section("alpha", "a-body");
const sectionB = section("beta", "b-body");

describe("SectionDocument.reconcile", () => {
  describe("the v3 scenario floor", () => {
    it("scenario 1: writes [A, B] in declared order into an empty file", () => {
      const result = run("", [sectionA, sectionB]);
      assert.deepStrictEqual(tags(result), ["Created", "Created"]);
      assert.strictEqual(result.text, lines(block("alpha", "a-body"), "", block("beta", "b-body"), ""));
      assert.isTrue(result.changed);
    });

    it("scenario 2: inserts a missing block immediately before its declared sibling", () => {
      const before = lines("header", block("beta", "b-body"), "");
      const result = run(before, [sectionA, sectionB]);
      assert.deepStrictEqual(tags(result), ["Created", "Unchanged"]);
      assert.strictEqual(result.text, lines("header", block("alpha", "a-body"), "", block("beta", "b-body"), ""));
    });

    it("scenario 3: updates in place, preserving intervening user content", () => {
      const before = lines(block("alpha", "old"), "user text", block("beta", "b-body"), "");
      const result = run(before, [sectionA, sectionB]);
      assert.deepStrictEqual(tags(result), ["Updated", "Unchanged"]);
      assert.strictEqual(result.text, lines(block("alpha", "a-body"), "user text", block("beta", "b-body"), ""));
    });

    it("scenario 4: normalizes an out-of-order document to declared order", () => {
      const before = lines(block("beta", "b-body"), "", block("alpha", "a-body"), "");
      const result = run(before, [sectionA, sectionB]);
      assert.deepStrictEqual(tags(result), ["Unchanged", "Unchanged"]);
      assert.strictEqual(result.text, lines(block("alpha", "a-body"), "", block("beta", "b-body"), ""));
      assert.isTrue(result.changed, "the text moved even though no content changed");
    });

    it("scenario 5: preserves an unrelated section while managing its own", () => {
      const before = lines(block("foreign", "not ours"), "", block("alpha", "a-body"), "");
      const result = run(before, [sectionA]);
      assert.deepStrictEqual(tags(result), ["Unchanged"]);
      assert.include(result.text, block("foreign", "not ours"));
      assert.isFalse(result.changed);
    });

    it("scenario 6: a second identical call is idempotent and rewrites nothing", () => {
      const first = run("", [sectionA, sectionB]);
      const second = run(first.text, [sectionA, sectionB]);
      assert.deepStrictEqual(tags(second), ["Unchanged", "Unchanged"]);
      assert.strictEqual(second.text, first.text);
      assert.isFalse(second.changed);
    });

    it("appends a missing block after its present predecessor when no later sibling exists", () => {
      const before = lines("header", block("alpha", "a-body"), "");
      const result = run(before, [sectionA, sectionB]);
      assert.deepStrictEqual(tags(result), ["Unchanged", "Created"]);
      assert.strictEqual(result.text, lines("header", block("alpha", "a-body"), "", block("beta", "b-body"), ""));
    });

    it("reorders its own sections around an unrelated one left in place", () => {
      const before = lines(block("beta", "b-body"), block("foreign", "x"), block("alpha", "a-body"), "");
      const result = run(before, [sectionA, sectionB]);
      // The foreign block does not move; the two managed slots swap contents.
      assert.strictEqual(
        result.text,
        lines(block("alpha", "a-body"), block("foreign", "x"), block("beta", "b-body"), "")
      );
    });

    it("reports Updated carrying both sides", () => {
      const before = lines(block("alpha", "drifted"), "");
      const outcome = run(before, [sectionA]).outcomes[0];
      assert.strictEqual(outcome?._tag, "Updated");
      if (outcome?._tag !== "Updated") {
        return;
      }
      assert.strictEqual(outcome.before.content, "drifted");
      assert.strictEqual(outcome.after.content, "a-body");
    });
  });

  describe("outcome ordering", () => {
    it("returns one outcome per declared section, in declared order", () => {
      const before = lines(block("beta", "b-body"), "");
      const result = run(before, [sectionA, sectionB]);
      assert.lengthOf(result.outcomes, 2);
      assert.deepStrictEqual(tags(result), ["Created", "Unchanged"]);
    });
  });

  describe("text preservation", () => {
    it("leaves every byte outside a managed span untouched", () => {
      const before = lines("# a user comment", "", block("alpha", "old"), "", "trailing prose", "");
      const result = run(before, [sectionA]);
      assert.include(result.text, "# a user comment");
      assert.include(result.text, "trailing prose");
      assert.strictEqual(
        O.getOrElse(Str.indexOf("# a user comment")(result.text), constant(-1)),
        O.getOrElse(Str.indexOf("# a user comment")(before), constant(-1))
      );
    });

    it("preserves a byte-order mark", () => {
      const before = `﻿${lines("header", block("alpha", "old"), "")}`;
      assert.isTrue(Str.startsWith("﻿")(run(before, [sectionA]).text));
    });

    it("leaves a file with no trailing newline without one", () => {
      const before = lines("header", block("alpha", "old"));
      assert.isFalse(Str.endsWith("\n")(run(before, [sectionA]).text));
    });
  });

  describe("line endings", () => {
    it("renders into a CRLF document with CRLF markers", () => {
      const before = crlf(lines("header", ""));
      const result = run(before, [sectionA]);
      assert.include(result.text, "\r\n");
      assert.isFalse(/[^\r]\n/.test(result.text), "every LF must be preceded by a CR");
    });

    it("does not drift when the CALLER supplies CRLF content", () => {
      // The declared side is normalized as well as the parsed side; without
      // that, a caller whose template literal carries CRLF rewrites the file
      // on every single run while reporting Updated each time.
      const before = lines(block("alpha", "a\nb"), "");
      const result = run(before, [section("alpha", "a\r\nb")]);
      assert.deepStrictEqual(tags(result), ["Unchanged"]);
      assert.isFalse(result.changed);
    });

    it("is idempotent on a CRLF document", () => {
      const first = run(crlf(lines("header", "")), [sectionA]);
      const second = run(first.text, [sectionA]);
      assert.deepStrictEqual(tags(second), ["Unchanged"]);
      assert.isFalse(second.changed);
      assert.strictEqual(second.text, first.text);
    });
  });

  describe("refusals leave the document alone", () => {
    it("refuses content carrying a marker, before writing anything", () => {
      const hostile = section("alpha", `${lines("ok", "# --- END alpha MANAGED SECTION ---")}`);
      const error = runFailure(lines("header", ""), [hostile]);
      assert.strictEqual(error.reason, "markerInContent");
      assert.strictEqual(error.key, "alpha");
    });

    it("refuses a style the dialect cannot scan back", () => {
      const narrow = Dialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
      const slashSection = SectionId.make({ key: "alpha", commentStyle: CommentStyle.slash }).section("x");
      const result = parse("header\n", narrow).reconcile([slashSection]);
      if (!Result.isFailure(result)) {
        assert.fail("expected a refusal");
      }
      assert.strictEqual(result.failure.reason, "unknownCommentStyle");
    });

    it("refuses one identity declared twice, rather than picking an intention", () => {
      const error = runFailure(lines("header", ""), [sectionA, section("alpha", "a different body")]);
      assert.strictEqual(error.reason, "duplicateDeclaration");
      assert.strictEqual(error.key, "alpha");
    });

    it("refuses the whole batch when one section is unrenderable", () => {
      const hostile = section("beta", "# --- BEGIN beta MANAGED SECTION ---");
      const error = runFailure(lines("header", ""), [sectionA, hostile]);
      assert.strictEqual(error.key, "beta");
    });
  });
});

describe("reconciliation anchor review regressions", () => {
  it("prefers successors through mixed anchors and preserves foreign spans and text", () => {
    const declarations = A.map(["first", "alpha", "between1", "between2", "beta", "last1", "last2"], (key) =>
      section(key, key)
    );
    const foreign =
      "<!-- --- BEGIN foreign MANAGED SECTION --- -->\nuntouched  \n<!-- --- END foreign MANAGED SECTION --- -->";
    const source = lines(
      "header  ",
      block("beta", "beta"),
      "middle text",
      foreign,
      "more text",
      block("alpha", "alpha"),
      "footer",
      ""
    );
    const result = run(source, declarations);
    assert.strictEqual(
      result.text,
      lines(
        "header  ",
        block("first", "first"),
        "",
        block("alpha", "alpha"),
        "middle text",
        foreign,
        "more text",
        block("between1", "between1"),
        "",
        block("between2", "between2"),
        "",
        block("beta", "beta"),
        "",
        block("last1", "last1"),
        "",
        block("last2", "last2"),
        "footer",
        ""
      )
    );
    assert.deepStrictEqual(tags(result), [
      "Created",
      "Unchanged",
      "Created",
      "Created",
      "Unchanged",
      "Created",
      "Created",
    ]);
    const repeated = run(result.text, declarations);
    assert.strictEqual(repeated.text, result.text);
    assert.isFalse(repeated.changed);
  });

  it("appends all unanchored declarations in order after exact preserved spans", () => {
    const declarations = A.map(["one", "two", "three", "four"], (key) => section(key, key));
    const foreign = block("foreign", "  unchanged  ");
    for (const source of ["", lines("header  ", foreign, "footer", "")]) {
      const expected = `${A.join(
        A.map(declarations, (value) => block(value.key, value.content)),
        "\n\n"
      )}\n`;
      const result = run(source, declarations);
      assert.strictEqual(result.text, source === "" ? expected : lines("header  ", foreign, "footer", "", expected));
      assert.deepStrictEqual(tags(result), ["Created", "Created", "Created", "Created"]);
      assert.strictEqual(run(result.text, declarations).text, result.text);
    }
  });

  it("validates core contracts with the same schema as public plain outputs", () => {
    const doc = parse(block("alpha", "a-body"));
    const input = {
      text: doc.text,
      placed: doc.sections,
      declared: [sectionA, sectionB],
      dialect: doc.dialect,
      eol: doc.eol,
    };
    assert.isTrue(S.is(ReconcileInput)(input));
    const result = reconcileCore(ReconcileInput.make(input));
    if (!Result.isSuccess(result)) assert.fail("valid core input must reconcile");
    assert.strictEqual(ReconcileOutput, Reconciliation);
    assert.isTrue(S.is(ReconcileOutput)(result.success));
    assert.strictEqual(Object.getPrototypeOf(result.success), Object.prototype);
    assert.deepStrictEqual(R.keys(result.success), ["text", "outcomes", "changed"]);
    assert.isFalse(S.is(ReconcileOutput)({ ...result.success, outcomes: [{ _tag: "Created" }] }));
  });
});

describe("blank-prefix insertion regressions", () => {
  it("preserves empty, BOM-only, BOM-plus-whitespace and whitespace-only prefixes and reaches a fixed point", () => {
    for (const prefix of [
      "",
      "\uFEFF",
      "\uFEFF\n",
      "\uFEFF \t\n",
      "\uFEFF\r\n\r\n",
      " \t",
      " \t\n",
      "\n\n\n",
      " \t\r\n",
      "\uFEFF\r\n \t\n",
      "\r\n\n",
    ]) {
      const doc = parse(prefix);
      const eol = doc.eol;
      const separator =
        prefix === "" || /(?:\r?\n){2}$/.test(prefix) ? "" : Str.endsWith("\n")(prefix) ? eol : eol + eol;
      const rendered = Result.getOrThrow(Dialect.default.render(sectionA, eol));
      const first = run(prefix, [sectionA]);
      assert.strictEqual(first.text, prefix + separator + rendered + eol);
      assert.isTrue(Str.startsWith(prefix)(first.text));
      assert.deepStrictEqual(tags(first), ["Created"]);
      const second = run(first.text, [sectionA]);
      assert.strictEqual(second.text, first.text);
      assert.isFalse(second.changed);
      assert.deepStrictEqual(tags(second), ["Unchanged"]);
    }
  });
});
