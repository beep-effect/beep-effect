import {
  extractClassifications,
  extractPatentAbstract,
  extractPatentFigures,
  getOffice,
  getPatentDisplay,
  parsePatentMetadata,
  parsePatentReference,
  parsePatentSections,
} from "@beep/law-practice-domain";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const abstract =
  "A solar controller coordinates panel input, battery output and load balancing for portable field systems.";
const content = `**Patent Number:** US 7,654,321 B2
**Publication Date:** 2026/1/2
**Application Number:** 10/2014/000345678
**Filing Date:** 2025-2-3
**Priority Date:** 2024/3/4
**Number of Claims:** 4
### Assignees
- **Example Corp** (Example City)
## Abstract
${abstract}
## Description
A controller connects a panel and a battery.
## Description of Drawings
FIG. 1 shows the controller.
## Citations
An example reference.
## Claims
1. A controller.
2. The controller of claim 1.

IPC: A01B 1/00

CPC: Y02E 10/50`;

describe("patent content metadata", () => {
  it("normalizes explicit publication fields and keeps the labelled claim count authoritative", () => {
    const metadata = parsePatentMetadata(content);
    assertSome(metadata.country, "US");
    assertSome<string>(metadata.patentNumber, "7654321");
    assertSome(metadata.kindCode, "B2");
    assertSome<string>(metadata.applicationNumber, "102014000345678");
    assertNone(parsePatentMetadata("**Application Number:** 12/345,678").applicationNumber);
    assertSome(metadata.publicationDate, "2026-01-02");
    assertSome(metadata.filingDate, "2025-02-03");
    assertSome(metadata.priorityDate, "2024-03-04");
    assertSome(metadata.claimsCount, 4);
    const assignees = metadata.assignees.pipe(O.getOrThrow);
    const assignee = A.head(assignees).pipe(O.getOrThrow);
    assert.strictEqual(assignee.name, "Example Corp");
    assertSome(assignee.location, "Example City");
    assertSome(metadata.ipc, ["A01B 1/00"]);
    assertSome(metadata.cpc, ["Y02E 10/50"]);
    assertSome(parsePatentMetadata("## Claims\n1. A plate.\n2. A cover.").claimsCount, 2);
    assertNone(parsePatentMetadata("").claimsCount);
    assertNone(parsePatentMetadata("").assignees);
  });
  it("selects requested sections and preserves an explicit abstract without neighboring headings", () => {
    assert.strictEqual(extractPatentAbstract(content), abstract);
    const all = parsePatentSections({ content, requestedSections: ["all"] });
    assertSome(all.abstract, abstract);
    assertTrue(all.description.pipe(O.isSome));
    assertTrue(all.drawings.pipe(O.isSome));
    assertTrue(all.citations.pipe(O.isSome));
    const claims = parsePatentSections({ content, requestedSections: ["claims"], maxCharsPerSection: 20 });
    assertNone(claims.abstract);
    assertNone(claims.description);
    assertNone(claims.citations);
    const claimText = claims.claims.pipe(O.getOrThrow);
    assert.isTrue(Str.startsWith("1. A controller.")(claimText));
    assert.isTrue(Str.includes("[truncated")(claimText));
    assert.strictEqual(extractPatentAbstract(""), "");
    assert.strictEqual(extractPatentAbstract("A short note."), "A short note....");
  });
  it("admits HTTP figures, deduplicates canonical URLs and refuses local or executable schemes", () => {
    const figures = extractPatentFigures({
      imageUrls: {
        img01: "https://example.com/fig1.png",
        local: "file:///tmp/not-read.png",
        script: "javascript:alert(1)",
      },
      content: "![same figure](https://example.com/fig1.png)\n![second](https://example.com/fig2.png)",
    });
    assert.strictEqual(figures.length, 2);
    assert.deepStrictEqual(
      A.map(figures, (figure) => figure.url.href),
      ["https://example.com/fig1.png", "https://example.com/fig2.png"]
    );
    assertSome(O.getOrThrow(A.head(figures)).label, "FIG. 1");
    assert.deepStrictEqual(extractPatentFigures(), []);
    assert.deepStrictEqual(extractClassifications("IPC: A01B 1/00 A01B 1/00\n\nCPC: Y02E 10/50").ipc, ["A01B 1/00"]);
  });
  it("keeps unknown references absent while using the declared office fallback for display", () => {
    const unknown = parsePatentReference("not a publication reference");
    assertNone(unknown.number);
    assertNone(unknown.country);
    assertNone(unknown.kindCode);
    assert.strictEqual(getOffice("unknown").code, "US");
    assert.strictEqual(getOffice().code, "US");
    const display = getPatentDisplay({ metadata: { patentNumber: "US 7,654,321 B2" } });
    assertSome<string>(display.number, "7654321");
    assert.strictEqual(display.office.code, "US");
  });
});
