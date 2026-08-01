import { HTML_ATTRIBUTE_SYNTAXES, inspectConformance } from "@beep/html";
import { Fragment, Img, Link, Picture, Source } from "@beep/html/Html.model";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";

type HtmlRoot = Parameters<typeof inspectConformance>[0];

const issuesAt = (root: HtmlRoot, path: ReadonlyArray<string>) =>
  A.filter(
    inspectConformance(root),
    (issue) => issue.path.length === path.length && A.every(issue.path, (segment, index) => segment === path[index])
  );

const image = (fields: Omit<Parameters<typeof Img.make>[0], "alt"> = {}) =>
  Img.make({ alt: O.some("responsive image"), src: O.some("/fallback.png"), ...fields });

const preload = (fields: Omit<Parameters<typeof Link.make>[0], "as" | "rel">) =>
  Link.make({ as: O.some("image"), rel: O.some("preload"), ...fields });

describe("@beep/html responsive-image conformance", () => {
  it("publishes the exact generator-owned specialized syntax registry", () => {
    expect(HTML_ATTRIBUTE_SYNTAXES).toStrictEqual({
      "img/sizes": "source-size-list",
      "img/srcset": "srcset",
      "link/imagesizes": "source-size-list",
      "link/imagesrcset": "srcset",
      "link/sizes": "icon-sizes",
      "source/sizes": "source-size-list",
      "source/srcset": "srcset",
    });
  });

  it("validates img srcset and sizes syntax at their exact attribute paths", () => {
    expect(
      inspectConformance(
        image({ sizes: O.some("(max-width: 40rem) 100vw, 40rem"), srcset: O.some("small.png 400w, big.png 800w") })
      )
    ).toStrictEqual([]);
    expect(issuesAt(image({ srcset: O.some("a.png 1x, b.png 1x") }), ["attributes.srcset"])).toHaveLength(1);
    expect(
      issuesAt(image({ sizes: O.some("10%"), srcset: O.some("small.png 400w") }), ["attributes.sizes"])
    ).toHaveLength(1);
    expect(issuesAt(image({ srcset: O.some("bad%url 1x") }), ["attributes.srcset"])).toHaveLength(1);
  });

  it("enforces img descriptor pairing and the narrow lazy auto exception", () => {
    expect(issuesAt(image({ srcset: O.some("small.png 400w") }), ["attributes.srcset"])).toHaveLength(1);
    expect(
      issuesAt(image({ sizes: O.some("100vw"), srcset: O.some("small.png 1x") }), ["attributes.sizes"])
    ).toHaveLength(1);
    expect(
      inspectConformance(
        image({ loading: O.some("lazy"), sizes: O.some("auto, 100vw"), srcset: O.some("small.png 400w") })
      )
    ).toStrictEqual([]);
    expect(
      issuesAt(image({ sizes: O.some("auto, 100vw"), srcset: O.some("small.png 400w") }), ["attributes.sizes"])
    ).toHaveLength(1);
    expect(
      inspectConformance(image({ loading: O.some("lazy"), sizes: O.some("AUTO"), srcset: O.none() }))
    ).toStrictEqual([]);
    expect(
      issuesAt(image({ loading: O.some("lazy"), sizes: O.some("auto, 100vw"), srcset: O.none() }), ["attributes.sizes"])
    ).toHaveLength(1);
  });

  it("enforces picture source width and auto relationships against the following img", () => {
    const withoutSizes = Picture.make({
      children: [Source.make({ srcset: O.some("wide.png 800w"), type: O.some("image/webp") }), image()],
    });
    expect(issuesAt(withoutSizes, ["children.0", "attributes.srcset"])).toHaveLength(1);

    const explicitSizes = Picture.make({
      children: [
        Source.make({ sizes: O.some("100vw"), srcset: O.some("wide.png 800w"), type: O.some("image/webp") }),
        image(),
      ],
    });
    expect(inspectConformance(explicitSizes)).toStrictEqual([]);

    const inheritedAuto = Picture.make({
      children: [
        Source.make({ srcset: O.some("wide.png 800w"), type: O.some("image/webp") }),
        image({ loading: O.some("lazy"), sizes: O.some("auto"), srcset: O.some("fallback.png 400w") }),
      ],
    });
    expect(inspectConformance(inheritedAuto)).toStrictEqual([]);

    const explicitAuto = Picture.make({
      children: [
        Source.make({
          sizes: O.some("auto, 100vw"),
          srcset: O.some("wide.png 800w"),
          type: O.some("image/webp"),
        }),
        image({ loading: O.some("lazy"), sizes: O.some("auto"), srcset: O.some("fallback.png 400w") }),
      ],
    });
    expect(inspectConformance(explicitAuto)).toStrictEqual([]);

    const invalidAuto = Picture.make({
      children: [
        Source.make({ sizes: O.some("auto"), srcset: O.some("wide.png 800w"), type: O.some("image/webp") }),
        image(),
      ],
    });
    expect(issuesAt(invalidAuto, ["children.0", "attributes.sizes"])).toHaveLength(1);

    const densityWithSizes = Picture.make({
      children: [
        Source.make({ sizes: O.some("100vw"), srcset: O.some("wide.png 2x"), type: O.some("image/webp") }),
        image(),
      ],
    });
    expect(issuesAt(densityWithSizes, ["children.0", "attributes.sizes"])).toHaveLength(1);
  });

  it("enforces link imagesrcset and imagesizes without conflating icon sizes", () => {
    expect(inspectConformance(preload({ imagesrcset: O.some("small.png 1x, big.png 2x") }))).toStrictEqual([]);
    expect(
      inspectConformance(preload({ imagesizes: O.some("100vw"), imagesrcset: O.some("small.png 400w, big.png 800w") }))
    ).toStrictEqual([]);
    expect(issuesAt(preload({ imagesrcset: O.some("small.png 400w") }), ["attributes.imagesrcset"])).toHaveLength(1);
    expect(
      issuesAt(preload({ imagesizes: O.some("100vw"), imagesrcset: O.some("small.png 1x") }), ["attributes.imagesizes"])
    ).toHaveLength(1);
    expect(
      issuesAt(preload({ href: O.some("/fallback.png"), imagesizes: O.some("100vw") }), ["attributes.imagesizes"])
    ).toHaveLength(1);
    expect(
      issuesAt(preload({ href: O.some("/fallback.png"), imagesizes: O.some("auto") }), ["attributes.imagesizes"])
    ).toHaveLength(1);

    expect(
      inspectConformance(Link.make({ href: O.some("/icon.png"), rel: O.some("icon"), sizes: O.some("ANY 16X16") }))
    ).toStrictEqual([]);
    expect(
      issuesAt(Link.make({ href: O.some("/icon.png"), rel: O.some("icon"), sizes: O.some("any ANY") }), [
        "attributes.sizes",
      ])
    ).toHaveLength(1);
    expect(
      issuesAt(Link.make({ href: O.some("/icon.png"), rel: O.some("icon"), sizes: O.some("16x16 16X16") }), [
        "attributes.sizes",
      ])
    ).toHaveLength(1);
    expect(
      issuesAt(Link.make({ href: O.some("/icon.png"), rel: O.some("icon"), sizes: O.some("016x16") }), [
        "attributes.sizes",
      ])
    ).toHaveLength(1);
    expect(
      issuesAt(Link.make({ href: O.some("/icon.png"), rel: O.some("stylesheet"), sizes: O.some("any") }), [
        "attributes.sizes",
      ])
    ).toHaveLength(1);
  });

  it("preserves exact nested paths through fragments", () => {
    const root = Fragment.make({
      children: [image({ sizes: O.some("100vw"), srcset: O.some("small.png 1x") })],
    });
    expect(issuesAt(root, ["children.0", "attributes.sizes"])).toHaveLength(1);
  });
});
