import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import { renderToStaticMarkup } from "react-dom/server";

describe("VerifiedSourceTextViewer", () => {
  it("marks the exact UTF-16 range intersecting the current page", () => {
    const markup = renderToStaticMarkup(
      <VerifiedSourceTextViewer
        pageText="prefix 😀 cited suffix"
        pageStartOffset={10}
        anchorStartOffset={17}
        anchorEndOffset={25}
        autoScrollToAnchor={false}
      />
    );

    expect(markup).toContain("<mark");
    expect(markup).toContain(">😀 cited</mark>");
    expect(markup).toContain("box-decoration-clone");
    expect(markup).toContain('data-anchor-visible="true"');
  });

  it("renders a page without a mark when the anchor does not intersect it", () => {
    const markup = renderToStaticMarkup(
      <VerifiedSourceTextViewer
        pageText="unrelated page"
        pageStartOffset={100}
        anchorStartOffset={10}
        anchorEndOffset={20}
      />
    );

    expect(markup).not.toContain("<mark");
    expect(markup).toContain('data-anchor-visible="false"');
  });

  it("marks only the visible portion of an anchor spanning page boundaries", () => {
    const markup = renderToStaticMarkup(
      <VerifiedSourceTextViewer
        pageText="second page"
        pageStartOffset={20}
        anchorStartOffset={17}
        anchorEndOffset={26}
        autoScrollToAnchor={false}
      />
    );

    expect(markup).toContain(">second</mark>");
  });
  it.prop(
    "marks exactly the half-open UTF-16 intersection for generated valid ranges",
    [
      Arbitrary.schema(S.String),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 100, maximum: 1000 }))),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: -100, maximum: 100 }))),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 200 }))),
    ],
    ([pageText, pageStartOffset, delta, width]) => {
      const anchorStartOffset = pageStartOffset + delta;
      const anchorEndOffset = anchorStartOffset + width;
      const start = Math.max(pageStartOffset, anchorStartOffset);
      const end = Math.min(pageStartOffset + pageText.length, anchorEndOffset);
      const visible = start < end;
      const markup = renderToStaticMarkup(
        <VerifiedSourceTextViewer
          pageText={pageText}
          pageStartOffset={pageStartOffset}
          anchorStartOffset={anchorStartOffset}
          anchorEndOffset={anchorEndOffset}
          autoScrollToAnchor={false}
        />
      );
      expect(markup.includes("<mark")).toBe(visible);
      expect(markup).toContain(`data-anchor-visible="${visible}"`);
      if (visible) {
        const expected = pageText.slice(start - pageStartOffset, end - pageStartOffset);
        expect(markup).toContain(`>${renderToStaticMarkup(<>{expected}</>)}</mark>`);
      }
    },
    { arbitrary: fcRuns(100) }
  );

  it("omits marks for exactly touching boundaries and empty ranges", () => {
    for (const { anchorStartOffset, anchorEndOffset } of [
      { anchorStartOffset: 0, anchorEndOffset: 10 },
      { anchorStartOffset: 13, anchorEndOffset: 20 },
      { anchorStartOffset: 11, anchorEndOffset: 11 },
    ]) {
      const markup = renderToStaticMarkup(
        <VerifiedSourceTextViewer
          pageText="😀x"
          pageStartOffset={10}
          anchorStartOffset={anchorStartOffset}
          anchorEndOffset={anchorEndOffset}
          autoScrollToAnchor={false}
        />
      );
      expect(markup).not.toContain("<mark");
      expect(markup).toContain('data-anchor-visible="false"');
    }
  });
});
