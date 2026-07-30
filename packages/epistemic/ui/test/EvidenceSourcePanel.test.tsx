import { EvidenceSourcePanel } from "@beep/epistemic-ui";
import { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const digest = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const source = {
  extractor: { name: "utf8", version: "1" },
  locator: "documents/agreement.txt",
  normalizationVersion: "1",
  scopeRef: "workspace:1",
  sourceDigest: digest,
  sourceRef: "agreement",
  textDigest: digest,
};

describe("EvidenceSourcePanel", () => {
  it("renders immutable source metadata and the exact verified anchor", () => {
    const page = Result.getOrThrow(
      S.decodeUnknownResult(ContradictionTriage.EvidenceSourcePage.fields.page)({
        endOffset: 29,
        hasNextPage: false,
        hasPreviousPage: false,
        identity: source,
        pageCount: 1,
        pageIndex: 0,
        pageSizeCodeUnits: 65_536,
        startOffset: 0,
        text: "The agreement expires Friday.",
        totalCodeUnits: 29,
      })
    );
    const highlight = Result.getOrThrow(
      S.decodeUnknownResult(ContradictionTriage.EvidenceSourceHighlight)({
        endChar: 13,
        source,
        startChar: 4,
      })
    );

    const markup = renderToStaticMarkup(
      <EvidenceSourcePanel highlight={highlight} page={page} onPageChange={() => undefined} />
    );

    expect(markup).toContain("Verified source");
    expect(markup).toContain("documents/agreement.txt");
    expect(markup).toContain(">agreement</mark>");
    expect(markup).toContain("Page 1 of 1");
  });
});
