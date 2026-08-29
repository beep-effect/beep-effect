import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
});
