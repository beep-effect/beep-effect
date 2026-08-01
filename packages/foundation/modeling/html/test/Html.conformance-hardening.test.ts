import { conform, ELEMENT_META, inspectConformance, serialize } from "@beep/html";
import {
  MATHML_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ELEMENT_NAME_ADJUSTMENTS,
  XML_FOREIGN_ATTRIBUTE_NAMES,
} from "@beep/html/Html.meta";
import {
  A as Anchor,
  Area,
  Article,
  Audio,
  Base,
  Body,
  Button,
  Col,
  Colgroup,
  Datalist,
  Dd,
  Details,
  Dfn,
  Div,
  Dl,
  Document,
  Dt,
  Fieldset,
  Figcaption,
  Figure,
  Footer,
  ForeignElement,
  Form,
  Fragment,
  H1,
  Head,
  Header,
  Hgroup,
  Html,
  Img,
  Input,
  Label,
  Legend,
  Main,
  MapElement,
  Meter,
  Optgroup,
  Option,
  P,
  Picture,
  Progress,
  Rp,
  Rt,
  Ruby,
  Select,
  Source,
  Span,
  Summary,
  Table,
  Template,
  Title,
  Track,
  Video,
} from "@beep/html/Html.model";
import { Comment, Doctype, Text } from "@beep/html/Html.nodes";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import { FastCheck as fc } from "effect/testing";

const text = (value: string): Text => Text.make({ value });
const hasRule = (root: Parameters<typeof inspectConformance>[0], rule: string): boolean =>
  inspectConformance(root).some((issue) => issue.rule === rule);

describe("@beep/html generated attribute provenance", () => {
  it("reconciles reviewed current gaps and reports obsolete or misplaced attributes", () => {
    for (const name of [
      "onafterprint",
      "onbeforeprint",
      "onbeforeunload",
      "onhashchange",
      "onlanguagechange",
      "onmessage",
      "onmessageerror",
      "onoffline",
      "ononline",
      "onpageswap",
      "onpagehide",
      "onpagereveal",
      "onpageshow",
      "onpopstate",
      "onrejectionhandled",
      "onstorage",
      "onunhandledrejection",
      "onunload",
    ]) {
      expect(ELEMENT_META.body.currentAttributes).toContain(name);
    }
    for (const name of ["popovertarget", "popovertargetaction"]) {
      expect(ELEMENT_META.button.currentAttributes).toContain(name);
      expect(ELEMENT_META.input.currentAttributes).toContain(name);
      expect(ELEMENT_META.div.currentAttributes).not.toContain(name);
    }
    for (const name of ["formaction", "formenctype", "formmethod", "formnovalidate", "formtarget", "height", "width"]) {
      expect(ELEMENT_META.input.currentAttributes).toContain(name);
    }

    expect(inspectConformance(Body.make({ bgcolor: O.some("red"), children: [] }))).toContainEqual(
      expect.objectContaining({ rule: "obsoleteAttribute" })
    );
    expect(inspectConformance(Div.make({ align: O.some("center"), children: [] }))).toContainEqual(
      expect.objectContaining({ rule: "obsoleteAttribute" })
    );

    const forged = {
      ...Div.make({ children: [] }),
      popovertarget: O.some("menu"),
    } as unknown as Div;
    expect(inspectConformance(forged)).toContainEqual(expect.objectContaining({ rule: "misplacedAttribute" }));
    expect(Exit.isFailure(Effect.runSyncExit(conform(forged)))).toBe(true);
  });
});

describe("@beep/html numeric and id conformance", () => {
  it("enforces generated base, map, and track attribute laws", () => {
    for (const root of [Base.make({}), MapElement.make({ children: [] }), Track.make({})]) {
      expect(hasRule(root, "attributeRelationship")).toBe(true);
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    for (const root of [
      Base.make({ href: O.some("/docs") }),
      Base.make({ target: O.some("_self") }),
      MapElement.make({ children: [], id: O.some("map-one"), name: O.some("map-one") }),
      Track.make({ src: O.some("/captions.vtt") }),
    ]) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const duplicateMaps = Fragment.make({
      children: [
        MapElement.make({ children: [], name: O.some("duplicate") }),
        MapElement.make({ children: [], name: O.some("duplicate") }),
      ],
    });
    expect(inspectConformance(duplicateMaps).filter((issue) => issue.rule === "duplicateAttribute")).toStrictEqual([
      expect.objectContaining({ path: ["children.0", "attributes.name"] }),
      expect.objectContaining({ path: ["children.1", "attributes.name"] }),
    ]);
    expect(Exit.isFailure(Effect.runSyncExit(conform(duplicateMaps)))).toBe(true);

    const mismatchedMapIdentity = MapElement.make({
      children: [],
      id: O.some("map-id"),
      name: O.some("map-name"),
    });
    expect(inspectConformance(mismatchedMapIdentity)).toContainEqual(
      expect.objectContaining({ path: ["attributes.id"], rule: "attributeRelationship" })
    );
    expect(Exit.isFailure(Effect.runSyncExit(conform(mismatchedMapIdentity)))).toBe(true);

    expect(() => MapElement.make({ children: [], name: O.some("") })).toThrow();
    expect(() => MapElement.make({ children: [], name: O.some("two maps") })).toThrow();
    expect(() => MapElement.make({ children: [], name: O.some("two\tmaps") })).toThrow();
  });

  it("enforces generated meter and progress domains and relationships", () => {
    expect(
      inspectConformance(
        Meter.make({
          children: [],
          high: O.some(0.8),
          low: O.some(0.2),
          max: O.some(1),
          min: O.some(0),
          optimum: O.some(0.5),
          value: O.some(0.5),
        })
      )
    ).toStrictEqual([]);
    expect(inspectConformance(Progress.make({ children: [], max: O.some(2), value: O.some(1) }))).toStrictEqual([]);

    const invalid = [
      Meter.make({ children: [] }),
      Meter.make({ children: [], max: O.some(1), min: O.some(2), value: O.some(1) }),
      Meter.make({ children: [], max: O.some(1), min: O.some(0), value: O.some(2) }),
      Meter.make({ children: [], high: O.some(0.2), low: O.some(0.8), value: O.some(0.5) }),
      Meter.make({ children: [], optimum: O.some(2), value: O.some(0.5) }),
      Progress.make({ children: [], value: O.some(2) }),
      Progress.make({ children: [], max: O.some(2), value: O.some(3) }),
    ];
    for (const root of invalid) {
      expect(hasRule(root, "attributeRelationship")).toBe(true);
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    expect(() => Progress.make({ children: [], max: O.some(0) })).toThrow();
    expect(() => Progress.make({ children: [], value: O.some(-1) })).toThrow();
    expect(() => Meter.make({ children: [], value: O.some(Number.NaN) })).toThrow();
  });

  it("keeps generated numeric relationships equivalent to their ordering laws", () =>
    fc.assert(
      fc.property(
        fc.integer({ max: 1000, min: -1000 }).map((value) => value / 10),
        fc.integer({ max: 1000, min: -1000 }).map((value) => value / 10),
        fc.integer({ max: 1000, min: -1000 }).map((value) => value / 10),
        (minimum, maximum, value) => {
          const root = Meter.make({
            children: [],
            max: O.some(maximum),
            min: O.some(minimum),
            value: O.some(value),
          });
          const expected = minimum <= maximum && minimum <= value && value <= maximum;
          expect(hasRule(root, "attributeRelationship")).toBe(!expected);
        }
      ),
      fcRuns(100)
    ));

  it("reports every duplicate id occurrence at its root-relative attribute path", () => {
    const element = Div.make({
      children: [Span.make({ children: [], id: O.some("dup") })],
      id: O.some("dup"),
    });
    expect(inspectConformance(element).filter((issue) => issue.rule === "duplicateId")).toStrictEqual([
      expect.objectContaining({ path: ["attributes.id"] }),
      expect.objectContaining({ path: ["children.0", "attributes.id"] }),
    ]);

    const fragment = Fragment.make({
      children: [Div.make({ children: [], id: O.some("dup") }), Span.make({ children: [], id: O.some("dup") })],
    });
    expect(inspectConformance(fragment).filter((issue) => issue.rule === "duplicateId")).toStrictEqual([
      expect.objectContaining({ path: ["children.0", "attributes.id"] }),
      expect.objectContaining({ path: ["children.1", "attributes.id"] }),
    ]);

    const mixedNamespace = Fragment.make({
      children: [
        Div.make({ children: [], id: O.some("dup") }),
        ForeignElement.make({
          attributes: O.some({ id: "dup" }),
          children: [],
          name: "svg",
          namespace: "svg",
        }),
      ],
    });
    expect(inspectConformance(mixedNamespace).filter((issue) => issue.rule === "duplicateId")).toStrictEqual([
      expect.objectContaining({ path: ["children.0", "attributes.id"] }),
      expect.objectContaining({ path: ["children.1", "attributes.id"] }),
    ]);

    const document = Document.make({
      doctype: O.some(Doctype.html()),
      children: [
        Html.make({
          children: [
            Head.make({ children: [Title.make({ content: "IDs" })] }),
            Body.make({
              children: [Div.make({ children: [], id: O.some("dup") }), Span.make({ children: [], id: O.some("dup") })],
            }),
          ],
        }),
      ],
    });
    expect(inspectConformance(document).filter((issue) => issue.rule === "duplicateId")).toStrictEqual([
      expect.objectContaining({ path: ["children.0", "children.1", "children.0", "attributes.id"] }),
      expect.objectContaining({ path: ["children.0", "children.1", "children.1", "attributes.id"] }),
    ]);

    expect(inspectConformance(Div.make({ children: [], id: O.some("unique") }))).toStrictEqual([]);
    expect(() => Div.make({ children: [], id: O.some("two ids") })).toThrow();
  });
});

describe("@beep/html generated special-child grammars", () => {
  it("enforces description-list and head cardinality", () => {
    expect(hasRule(Dl.make({ children: [Dd.make({ children: [] })] }), "elementOrder")).toBe(true);
    expect(hasRule(Dl.make({ children: [Div.make({ children: [] })] }), "elementOrder")).toBe(true);
    expect(
      inspectConformance(
        Dl.make({
          children: [Dt.make({ children: [text("term")] }), Dd.make({ children: [text("definition")] })],
        })
      )
    ).toStrictEqual([]);

    expect(hasRule(Head.make({ children: [] }), "elementOrder")).toBe(true);
    expect(
      hasRule(
        Head.make({
          children: [Title.make({ content: "one" }), Title.make({ content: "two" })],
        }),
        "elementOrder"
      )
    ).toBe(true);
    expect(inspectConformance(Head.make({ children: [Title.make({ content: "one" })] }))).toStrictEqual([]);
  });

  it("composes mixed transparent child alternatives with inherited fallback content", () => {
    const mixedTransparent = Object.values(ELEMENT_META).filter(
      (meta) => meta.children.includes("transparent") && meta.children.length > 1
    );
    expect(mixedTransparent).toHaveLength(3);
    expect(mixedTransparent.map((meta) => meta.tag)).toEqual(expect.arrayContaining(["audio", "map", "video"]));

    const valid = [
      Div.make({
        children: [
          Audio.make({
            children: [
              Source.make({ src: O.some("/sound.mp3") }),
              Track.make({ src: O.some("/captions.vtt") }),
              Anchor.make({ children: [text("fallback")] }),
            ],
          }),
        ],
      }),
      P.make({
        children: [
          Video.make({
            children: [
              Source.make({ src: O.some("/movie.mp4") }),
              Track.make({ src: O.some("/captions.vtt") }),
              Anchor.make({ children: [text("fallback")] }),
            ],
          }),
        ],
      }),
      MapElement.make({ children: [Area.make({})], name: O.some("image-map") }),
    ];
    for (const root of valid) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }
  });

  it("requires exactly one first significant summary while keeping other edge grammars optional", () => {
    const invalid = [
      Details.make({ children: [] }),
      Details.make({ children: [Div.make({ children: [] })] }),
      Details.make({
        children: [text("before"), Summary.make({ children: [] })],
      }),
      Details.make({
        children: [
          ForeignElement.make({ namespace: "svg", name: "svg", children: [] }),
          Summary.make({ children: [] }),
        ],
      }),
      Details.make({
        children: [Summary.make({ children: [] }), Summary.make({ children: [] })],
      }),
      Details.make({
        children: [Div.make({ children: [] }), Summary.make({ children: [] })],
      }),
    ];
    for (const root of invalid) {
      expect(hasRule(root, "elementOrder")).toBe(true);
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const validDetails = Details.make({
      children: [
        Comment.make({ value: "comments are not content" }),
        text(" \n\t "),
        Summary.make({ children: [text("summary")] }),
        Div.make({ children: [] }),
        ForeignElement.make({ namespace: "svg", name: "svg", children: [] }),
      ],
    });
    expect(inspectConformance(validDetails)).toStrictEqual([]);
    expect(Exit.isSuccess(Effect.runSyncExit(conform(validDetails)))).toBe(true);

    for (const root of [
      Fieldset.make({ children: [] }),
      Figure.make({ children: [] }),
      Optgroup.make({ children: [] }),
    ]) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }
  });

  it("enforces edge, conditional, media, and alternative grammars", () => {
    const invalid = [
      Fieldset.make({
        children: [Div.make({ children: [] }), Legend.make({ children: [] })],
      }),
      Fieldset.make({
        children: [text("before"), Legend.make({ children: [] })],
      }),
      Figure.make({
        children: [Figcaption.make({ children: [] }), Div.make({ children: [] }), Figcaption.make({ children: [] })],
      }),
      Figure.make({
        children: [text("before"), Figcaption.make({ children: [] }), Div.make({ children: [] })],
      }),
      Figure.make({
        children: [Div.make({ children: [] }), Figcaption.make({ children: [] }), text("after")],
      }),
      Html.make({
        children: [Body.make({ children: [] }), Head.make({ children: [Title.make({ content: "title" })] })],
      }),
      Colgroup.make({ span: O.some(2), children: [Col.make({})] }),
      Colgroup.make({ span: O.some(2), children: [Template.make({ children: [] })] }),
      Audio.make({
        src: O.some("/sound.mp3"),
        children: [Source.make({ src: O.some("/fallback.mp3") })],
      }),
      Audio.make({
        children: [text("fallback"), Source.make({ src: O.some("/late.mp3") })],
      }),
      Video.make({
        children: [Track.make({ src: O.some("/captions.vtt") }), Source.make({ src: O.some("/movie.mp4") })],
      }),
      Video.make({
        children: [Anchor.make({ children: [text("fallback")] }), Track.make({ src: O.some("/captions.vtt") })],
      }),
      Datalist.make({
        children: [Option.make({ children: [text("one")] }), text("mixed")],
      }),
      Select.make({
        children: [Option.make({ children: [text("one")] }), Button.make({ children: [] })],
      }),
      Optgroup.make({
        children: [Option.make({ children: [text("one")] }), Legend.make({ children: [text("late")] })],
      }),
      Picture.make({ children: [Source.make({ srcset: O.some("/image.webp") })] }),
      Ruby.make({ children: [Rt.make({ children: [text("annotation")] })] }),
      Summary.make({
        children: [H1.make({ children: [text("heading")] }), text("mixed")],
      }),
      Hgroup.make({ children: [] }),
    ];
    for (const root of invalid) {
      expect(hasRule(root, "elementOrder")).toBe(true);
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const valid = [
      Fieldset.make({
        children: [
          Comment.make({ value: "comments are not content" }),
          text(" \n\t "),
          Legend.make({ children: [text("legend")] }),
          Div.make({ children: [] }),
        ],
      }),
      Figure.make({
        children: [
          Comment.make({ value: "comments are not content" }),
          text(" \n\t "),
          Figcaption.make({ children: [text("caption")] }),
          Div.make({ children: [] }),
        ],
      }),
      Figure.make({
        children: [
          Div.make({ children: [] }),
          Figcaption.make({ children: [text("caption")] }),
          text(" \n\t "),
          Comment.make({ value: "comments are not content" }),
        ],
      }),
      Colgroup.make({ children: [Col.make({})] }),
      Optgroup.make({
        children: [Legend.make({ children: [text("group")] }), Option.make({ children: [text("one")] })],
      }),
      Audio.make({
        children: [
          Source.make({ src: O.some("/sound.mp3") }),
          Track.make({ src: O.some("/captions.vtt") }),
          Anchor.make({ children: [text("fallback")] }),
        ],
      }),
      Picture.make({
        children: [
          Source.make({ srcset: O.some("/image.webp") }),
          Img.make({ alt: O.some("image"), src: O.some("/image.png") }),
        ],
      }),
      Ruby.make({
        children: [
          text("base"),
          Rp.make({ children: [text("(")] }),
          Rt.make({ children: [text("annotation")] }),
          Rp.make({ children: [text(")")] }),
        ],
      }),
      Hgroup.make({ children: [H1.make({ children: [text("heading")] })] }),
      Table.make({ children: [] }),
    ];
    for (const root of valid) {
      expect(hasRule(root, "elementOrder")).toBe(false);
    }
  });

  it("enforces generated parent-context requirements for source attributes", () => {
    for (const root of [
      Audio.make({ children: [Source.make({})] }),
      Video.make({ children: [Source.make({})] }),
      Audio.make({
        children: [Source.make({ src: O.some("/sound.mp3"), srcset: O.some("/sound-2x.mp3 2x") })],
      }),
      Video.make({
        children: [Source.make({ sizes: O.some("100vw"), src: O.some("/movie.mp4") })],
      }),
      Audio.make({
        children: [Source.make({ height: O.some(320), src: O.some("/sound.mp3") })],
      }),
      Video.make({
        children: [Source.make({ src: O.some("/movie.mp4"), width: O.some(640) })],
      }),
      Picture.make({
        children: [Source.make({}), Img.make({ alt: O.some("image"), src: O.some("/image.png") })],
      }),
      Picture.make({
        children: [
          Source.make({ src: O.some("/image.webp"), srcset: O.some("/image.webp") }),
          Img.make({ alt: O.some("image"), src: O.some("/image.png") }),
        ],
      }),
    ]) {
      expect(inspectConformance(root)).toContainEqual(
        expect.objectContaining({ path: ["children.0", "attributes"], rule: "attributeRelationship" })
      );
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    for (const root of [
      Audio.make({ children: [Source.make({ src: O.some("/sound.mp3") })] }),
      Video.make({ children: [Source.make({ src: O.some("/movie.mp4") })] }),
      Picture.make({
        children: [
          Source.make({ srcset: O.some("/image.webp") }),
          Img.make({ alt: O.some("image"), src: O.some("/image.png") }),
        ],
      }),
    ]) {
      expect(hasRule(root, "attributeRelationship")).toBe(false);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }
  });

  it("evaluates conditional interactive categories from attributes", () => {
    expect(
      hasRule(
        Button.make({
          children: [Anchor.make({ children: [text("inert anchor")] })],
        }),
        "forbiddenDescendant"
      )
    ).toBe(false);
    expect(
      hasRule(
        Button.make({
          children: [Anchor.make({ href: O.some("/docs"), children: [text("link")] })],
        }),
        "forbiddenDescendant"
      )
    ).toBe(true);
    expect(hasRule(Button.make({ children: [Audio.make({ children: [] })] }), "forbiddenDescendant")).toBe(false);
    expect(
      hasRule(Button.make({ children: [Audio.make({ controls: O.some(true), children: [] })] }), "forbiddenDescendant")
    ).toBe(true);
    expect(hasRule(Button.make({ children: [Input.make({ type: O.some("hidden") })] }), "forbiddenDescendant")).toBe(
      false
    );
    expect(hasRule(Button.make({ children: [Input.make({ type: O.some("text") })] }), "forbiddenDescendant")).toBe(
      true
    );
  });

  it("enforces every generated descendant exclusion through nested fallback content", () => {
    const cases = [
      [
        Dfn.make({ children: [Span.make({ children: [Dfn.make({ children: [text("nested")] })] })] }),
        ["children.0", "children.0"],
      ],
      [
        Header.make({ children: [Div.make({ children: [Footer.make({ children: [] })] })] }),
        ["children.0", "children.0"],
      ],
      [
        Footer.make({ children: [Div.make({ children: [Header.make({ children: [] })] })] }),
        ["children.0", "children.0"],
      ],
      [
        Video.make({ children: [Div.make({ children: [Audio.make({ children: [] })] })] }),
        ["children.0", "children.0"],
      ],
      [
        Audio.make({ children: [Div.make({ children: [Video.make({ children: [] })] })] }),
        ["children.0", "children.0"],
      ],
    ] as const;

    for (const [root, path] of cases) {
      expect(inspectConformance(root)).toContainEqual(expect.objectContaining({ path, rule: "forbiddenDescendant" }));
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }
  });

  it("enforces generated main ancestry and document-visible cardinality", () => {
    const nestedMain = Article.make({
      children: [Div.make({ children: [Main.make({ children: [] })] })],
    });
    expect(inspectConformance(nestedMain)).toContainEqual(
      expect.objectContaining({ path: ["children.0", "children.0"], rule: "forbiddenDescendant" })
    );

    const documentWith = (...children: ReadonlyArray<Main>) =>
      Document.make({
        doctype: O.some(Doctype.html()),
        children: [
          Html.make({
            children: [Head.make({ children: [Title.make({ content: "Main conformance" })] }), Body.make({ children })],
          }),
        ],
      });
    const twoVisible = documentWith(Main.make({ children: [] }), Main.make({ children: [] }));
    expect(inspectConformance(twoVisible).filter((issue) => issue.rule === "documentCardinality")).toStrictEqual([
      expect.objectContaining({ path: ["children.0", "children.1", "children.0"] }),
      expect.objectContaining({ path: ["children.0", "children.1", "children.1"] }),
    ]);
    expect(Exit.isFailure(Effect.runSyncExit(conform(twoVisible)))).toBe(true);

    const hiddenAware = documentWith(
      Main.make({ children: [] }),
      Main.make({ children: [], hidden: O.some("hidden") }),
      Main.make({ children: [], hidden: O.some("until-found") })
    );
    expect(inspectConformance(hiddenAware)).toStrictEqual([]);
    expect(
      inspectConformance(Fragment.make({ children: [Main.make({ children: [] }), Main.make({ children: [] })] }))
    ).toStrictEqual([]);
    expect(inspectConformance(Body.make({ children: [Main.make({ children: [] })] }))).toStrictEqual([]);
    expect(inspectConformance(Div.make({ children: [Main.make({ children: [] })] }))).toStrictEqual([]);
  });

  it("rejects main beneath forms with author-provided accessible names", () => {
    const cases = [
      [Form.make({ "aria-label": O.some("Named form"), children: [Main.make({ children: [] })] }), ["children.0"]],
      [
        Form.make({
          "aria-labelledby": O.some("form-name"),
          children: [
            Span.make({ id: O.some("form-name"), children: [text("Named form")] }),
            Main.make({ children: [] }),
          ],
        }),
        ["children.1"],
      ],
      [Form.make({ title: O.some("Named form"), children: [Main.make({ children: [] })] }), ["children.0"]],
    ] as const;

    for (const [root, path] of cases) {
      expect(inspectConformance(root)).toContainEqual(expect.objectContaining({ path, rule: "forbiddenDescendant" }));
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    expect(inspectConformance(Form.make({ children: [Main.make({ children: [] })] }))).toStrictEqual([]);
    expect(
      inspectConformance(Form.make({ "aria-label": O.some(" \n\t "), children: [Main.make({ children: [] })] }))
    ).toStrictEqual([]);
  });

  it("uses the generated contextual div grammar instead of the lossy index union", () => {
    const invalidStandalone = Div.make({ children: [Optgroup.make({ children: [] })] });
    expect(inspectConformance(invalidStandalone)).toContainEqual(
      expect.objectContaining({ path: ["children.0"], rule: "contentModel" })
    );
    expect(Exit.isFailure(Effect.runSyncExit(conform(invalidStandalone)))).toBe(true);

    const validDescriptionGroup = Dl.make({
      children: [
        Div.make({
          children: [Dt.make({ children: [text("term")] }), Dd.make({ children: [text("definition")] })],
        }),
      ],
    });
    expect(inspectConformance(validDescriptionGroup)).toStrictEqual([]);

    const twoGroupsInOneWrapper = Dl.make({
      children: [
        Div.make({
          children: [
            Dt.make({ children: [] }),
            Dd.make({ children: [] }),
            Dt.make({ children: [] }),
            Dd.make({ children: [] }),
          ],
        }),
      ],
    });
    expect(inspectConformance(twoGroupsInOneWrapper)).toContainEqual(
      expect.objectContaining({ path: ["children.0"], rule: "elementOrder" })
    );
  });

  it("rejects tabindex descendants beneath anchors and buttons", () => {
    const svg = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      attributes: O.some({ tabindex: "0" }),
      children: [],
    });
    const math = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      attributes: O.some({ tabindex: "-1" }),
      children: [],
    });

    expect(
      hasRule(
        Anchor.make({
          href: O.some("/docs"),
          children: [Span.make({ children: [Span.make({ tabindex: O.some(0), children: [] })] })],
        }),
        "forbiddenDescendant"
      )
    ).toBe(true);
    expect(
      hasRule(
        Button.make({
          children: [Span.make({ tabindex: O.some(-1), children: [] })],
        }),
        "forbiddenDescendant"
      )
    ).toBe(true);
    expect(
      hasRule(
        Anchor.make({
          href: O.some("/docs"),
          children: [svg],
        }),
        "forbiddenDescendant"
      )
    ).toBe(true);
    expect(hasRule(Button.make({ children: [math] }), "forbiddenDescendant")).toBe(true);
    expect(
      hasRule(
        Anchor.make({
          href: O.some("/docs"),
          children: [Span.make({ children: [Span.make({ children: [] })] })],
        }),
        "forbiddenDescendant"
      )
    ).toBe(false);
  });

  it("allows at most one labelable descendant per label", () => {
    const valid = Label.make({
      children: [text("Name"), Span.make({ children: [Input.make({ type: O.some("text") })] })],
    });
    const validWithHiddenInput = Label.make({
      children: [Input.make({ type: O.some("text") }), Input.make({ type: O.some("hidden") })],
    });
    const invalid = Label.make({
      children: [Input.make({ type: O.some("text") }), Span.make({ children: [Input.make({ type: O.some("text") })] })],
    });

    expect(inspectConformance(valid)).toStrictEqual([]);
    expect(inspectConformance(validWithHiddenInput)).toStrictEqual([]);
    expect(hasRule(invalid, "forbiddenDescendant")).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(conform(invalid)))).toBe(true);
  });

  it("keeps schema-generated valid grammar fixtures free of grammar issues", () =>
    fc.assert(
      fc.property(
        fc.constantFrom(
          Head.make({ children: [Title.make({ content: "title" })] }),
          Dl.make({ children: [] }),
          Details.make({ children: [Summary.make({ children: [] })] }),
          Fieldset.make({ children: [] }),
          Figure.make({ children: [] }),
          Colgroup.make({ children: [] }),
          Audio.make({ children: [] }),
          Datalist.make({ children: [] }),
          Select.make({ children: [] }),
          Optgroup.make({ children: [] }),
          Hgroup.make({ children: [H1.make({ children: [] })] }),
          Table.make({ children: [] })
        ),
        (root) => {
          expect(hasRule(root, "elementOrder")).toBe(false);
        }
      ),
      fcRuns(50)
    ));
});

describe("@beep/html foreign browser fixed points", () => {
  const svgRoot = (name: string, attributes: Readonly<Record<string, string>> = {}): ForeignElement =>
    ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [
        ForeignElement.make({
          namespace: "svg",
          name,
          attributes: O.some(attributes),
          children: [],
        }),
      ],
    });

  it("covers every standard SVG and MathML adjustment entry", () => {
    for (const [lowercase, canonical] of Object.entries(SVG_ELEMENT_NAME_ADJUSTMENTS)) {
      expect(hasRule(svgRoot(canonical), "foreignIntegration")).toBe(false);
      expect(hasRule(svgRoot(lowercase), "foreignIntegration")).toBe(true);
    }
    for (const [lowercase, canonical] of Object.entries(SVG_ATTRIBUTE_NAME_ADJUSTMENTS)) {
      expect(hasRule(svgRoot("path", { [canonical]: "value" }), "foreignIntegration")).toBe(false);
      expect(hasRule(svgRoot("path", { [lowercase]: "value" }), "foreignIntegration")).toBe(true);
    }
    for (const [lowercase, canonical] of Object.entries(MATHML_ATTRIBUTE_NAME_ADJUSTMENTS)) {
      const valid = ForeignElement.make({
        namespace: "mathml",
        name: "math",
        attributes: O.some({ [canonical]: "value" }),
        children: [],
      });
      const invalid = ForeignElement.make({
        namespace: "mathml",
        name: "math",
        attributes: O.some({ [lowercase]: "value" }),
        children: [],
      });
      expect(hasRule(valid, "foreignIntegration")).toBe(false);
      expect(hasRule(invalid, "foreignIntegration")).toBe(true);
    }
  });

  it("accepts registered XML names and lowercase custom names, but rejects mixed-case drift", () => {
    for (const name of XML_FOREIGN_ATTRIBUTE_NAMES) {
      expect(hasRule(svgRoot("path", { [name]: "value" }), "foreignIntegration")).toBe(false);
    }
    expect(hasRule(svgRoot("custom-element", { "custom-attr": "value" }), "foreignIntegration")).toBe(false);
    expect(hasRule(svgRoot("customÉ"), "foreignIntegration")).toBe(false);
    expect(hasRule(svgRoot("customElement"), "foreignIntegration")).toBe(true);
    expect(hasRule(svgRoot("path", { customAttr: "value" }), "foreignIntegration")).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(serialize(svgRoot("lineargradient"))))).toBe(true);

    const mismatchedPrefix = ForeignElement.make({
      namespace: "mathml",
      name: "math",
      children: [ForeignElement.make({ namespace: "mathml", name: "svg:path", children: [] })],
    });
    expect(hasRule(mismatchedPrefix, "foreignIntegration")).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(serialize(mismatchedPrefix)))).toBe(true);
  });
});
