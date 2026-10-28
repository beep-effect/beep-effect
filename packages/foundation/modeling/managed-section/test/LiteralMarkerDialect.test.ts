import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { SectionId } from "@beep/managed-section/Section";
import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
import { SectionDocument } from "@beep/managed-section/SectionDocument";
import { CheckOutcome, SyncOutcome } from "@beep/managed-section/SectionOutcome";
import { assert, describe, it } from "@effect/vitest";
import {
  assertFailure,
  assertFalse,
  assertSuccess,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Immer } from "immer";
import type { SectionParseError } from "@beep/managed-section/SectionDocument";

const statusMarkers = SectionMarkers.make({
  key: "status",
  begin: "BEGIN GENERATED: STATUS",
  end: "END GENERATED: STATUS",
});

const dialect = LiteralMarkerDialect.make({
  phrase: "MANAGED SECTION",
  styles: [CommentStyle.html, CommentStyle.hash],
  markers: [statusMarkers],
});

const status = SectionId.make({ key: "status", commentStyle: CommentStyle.html });
const other = SectionId.make({ key: "other", commentStyle: CommentStyle.html });
const BEGIN = "<!-- BEGIN GENERATED: STATUS -->";
const END = "<!-- END GENERATED: STATUS -->";

const parse = (text: string): SectionDocument => {
  const parsed = SectionDocument.parseResult(text, dialect);
  if (Result.isFailure(parsed)) assert.fail(`expected a parse, got ${parsed.failure.message}`);
  return parsed.success;
};

const parseFailure = (text: string): SectionParseError => {
  const parsed = SectionDocument.parseResult(text, dialect);
  if (Result.isSuccess(parsed)) assert.fail("expected a parse failure");
  return parsed.failure;
};

const reconciled = (text: string, content: string): string => {
  const next = parse(text).reconcile([status.section(content)]);
  if (Result.isFailure(next)) assert.fail(`expected a reconciliation, got ${next.failure.reason}`);
  return next.success.text;
};

describe("CommentStyle.comment", () => {
  it("comments out one line in line and wrapped styles", () => {
    strictEqual(CommentStyle.html.comment("x"), "<!-- x -->");
    strictEqual(CommentStyle.hash.comment("x"), "# x");
    strictEqual(CommentStyle.block.comment("x"), "/* x */");
  });
});

describe("LiteralMarkerDialect rendering", () => {
  it("renders a listed key with its literal markers and any other key in the ruled form", () => {
    assertSuccess(dialect.render(status.section("body")), `${BEGIN}\nbody\n${END}`);
    strictEqual(dialect.endMarker(status), END);
    strictEqual(dialect.beginMarker(other), "<!-- --- BEGIN other MANAGED SECTION --- -->");
    strictEqual(
      dialect.beginMarker(SectionId.make({ key: "status", commentStyle: CommentStyle.hash })),
      "# BEGIN GENERATED: STATUS"
    );
  });

  it("refuses attributes, a literal marker in content and an unknown style", () => {
    const attributed = dialect.render(status.section("body", { origin: "ci" }));
    assertTrue(Result.isFailure(attributed) && attributed.failure.reason === "invalidAttribute");
    const embedded = dialect.render(other.section(`text\n${END}`));
    assertTrue(Result.isFailure(embedded) && embedded.failure.reason === "markerInContent");
    assertFalse(dialect.containsMarker(`a ${BEGIN}`));
    assertTrue(dialect.containsMarker(`a\n${BEGIN}`));
    const unknown = dialect.render(SectionId.make({ key: "status", commentStyle: CommentStyle.slash }).section("x"));
    assertTrue(Result.isFailure(unknown) && unknown.failure.reason === "unknownCommentStyle");
  });
});

describe("LiteralMarkerDialect copies", () => {
  it("scans with a prototype-preserving copy without borrowing the owner's cache", () => {
    const copy = new Immer({ autoFreeze: false }).produce(dialect, (draft) => {
      draft.phrase = "CUSTOM BLOCK";
    });
    assertTrue(S.is(LiteralMarkerDialect)(copy));
    assertTrue(copy !== dialect);
    strictEqual(copy.literalMatchers().length, 2);
    assertTrue(copy.literalMatchers() !== dialect.literalMatchers());
    strictEqual(
      SectionDocument.parseResult(`${BEGIN}\nold\n${END}\n`, copy).pipe(Result.getOrThrow).sections.length,
      1
    );
  });
});

describe("LiteralMarkerDialect scanning", () => {
  it("reads a literal section and rewrites only its body, byte for byte", () => {
    const text = `# T\n\n${BEGIN}\nold\n${END}\n\nrest\n`;
    deepStrictEqual(
      A.map(parse(text).sections, (placed) => [placed.section.key, placed.section.content, placed.line]),
      [["status", "old", 3]]
    );
    strictEqual(reconciled(text, "new"), `# T\n\n${BEGIN}\nnew\n${END}\n\nrest\n`);
    strictEqual(reconciled(text, "old"), text);
  });

  it("keeps CRLF, a leading BOM and an empty body", () => {
    strictEqual(reconciled(`a\r\n${BEGIN}\r\nold\r\n${END}\r\nz`, "x\ny"), `a\r\n${BEGIN}\r\nx\r\ny\r\n${END}\r\nz`);
    strictEqual(reconciled(`﻿${BEGIN}\nold\n${END}\n`, "new"), `﻿${BEGIN}\nnew\n${END}\n`);
    strictEqual(parse(`${BEGIN}\n${END}\n`).sections[0]?.section.content, "");
  });

  it("tolerates hand-edited whitespace and normalizes it on rewrite", () => {
    const text = `<!--   BEGIN  GENERATED:\tSTATUS   -->  \nold\n${END}\t\n`;
    strictEqual(parse(text).sections[0]?.section.content, "old");
    strictEqual(reconciled(text, "new"), `${BEGIN}\nnew\n${END}\n`);
  });

  it("does not read a literal marker that does not own its line", () => {
    strictEqual(parse(`x ${BEGIN}\nold\ny ${END}\n`).sections.length, 0);
    strictEqual(parseFailure(`x ${BEGIN}\nold\n${END}\n`).reason, "orphanedEnd");
    strictEqual(parse(`${BEGIN} trailing\nold\n${END} trailing\n`).sections.length, 0);
    strictEqual(parse(`<!-- BEGIN GENERATED: STATUSES -->\n`).sections.length, 0);
  });

  it("reads ruled sections of other keys and ignores a ruled marker naming a listed key", () => {
    const ruledOther = `${dialect.beginMarker(other)}\nkept\n${dialect.endMarker(other)}`;
    const ruledStatus =
      "<!-- --- BEGIN status MANAGED SECTION --- -->\nprose\n<!-- --- END status MANAGED SECTION --- -->";
    const document = parse(`${ruledOther}\n${ruledStatus}\n${BEGIN}\nold\n${END}\n`);
    deepStrictEqual(
      A.map(document.sections, (placed) => [placed.section.key, placed.section.content]),
      [
        ["other", "kept"],
        ["status", "old"],
      ]
    );
  });

  it("refuses duplicate, orphaned, overlapping and unterminated literal sections", () => {
    strictEqual(parseFailure(`${BEGIN}\na\n${END}\n${BEGIN}\nb\n${END}\n`).reason, "duplicateSection");
    strictEqual(parseFailure(`${END}\n${BEGIN}\n`).reason, "orphanedEnd");
    strictEqual(parseFailure(`${BEGIN}\n${BEGIN}\n`).reason, "overlappingSections");
    strictEqual(parseFailure(`${BEGIN}\nold\n`).reason, "unterminatedSection");
  });

  it("checks and syncs a literal section like a ruled one", () => {
    const document = parse(`${BEGIN}\nold\n${END}\n`);
    assertTrue(CheckOutcome.$is("Drifted")(document.check(status.section("new"))));
    assertTrue(CheckOutcome.$is("UpToDate")(document.check(status.section("old"))));
    const next = document.reconcile([status.section("old")]);
    if (Result.isFailure(next)) assert.fail("expected a reconciliation");
    assertTrue(A.every(next.success.outcomes, SyncOutcome.$is("Unchanged")));
    assertFailure(
      Result.mapError(SectionDocument.parseResult(`${END}\n`, dialect), (error) => error.reason),
      "orphanedEnd"
    );
  });
});
