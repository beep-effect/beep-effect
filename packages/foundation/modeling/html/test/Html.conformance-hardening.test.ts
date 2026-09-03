import { conform, ELEMENT_META, inspectConformance, inspectSafeHtml, serialize } from "@beep/html";
import {
  HtmlIdReferenceList,
  HtmlRelationList,
  LinkRelationList,
  makeAsciiCaseInsensitiveEnumerated,
  makeSpaceSeparatedTokenList,
  stripHtmlAsciiWhitespace,
} from "@beep/html/Html.attributes";
import {
  HtmlElementMeta,
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
  Link,
  Main,
  MapElement,
  Meta,
  Meter,
  Optgroup,
  Option,
  Output,
  P,
  Picture,
  Progress,
  Rp,
  Rt,
  Ruby,
  Script,
  Select,
  Source,
  Span,
  Style,
  Summary,
  Table,
  Tbody,
  Td,
  Template,
  Textarea,
  Th,
  Title,
  Tr,
  Track,
  Video,
} from "@beep/html/Html.model";
import { Comment, Doctype, Text } from "@beep/html/Html.nodes";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { isValidURLString, parseURL } from "whatwg-url";

const LinkRelationListArbitrary = S.toArbitrary(LinkRelationList)(fc);
const htmlUrlValidationBase = pipe(parseURL("https://html.invalid/"), O.fromNullOr);
const text = (value: string): Text => Text.make({ value });
const hasRule = (root: Parameters<typeof inspectConformance>[0], rule: string): boolean =>
  inspectConformance(root).some((issue) => issue.rule === rule);
const issuesAtPath = (
  root: Parameters<typeof inspectConformance>[0],
  path: ReadonlyArray<string>
): ReadonlyArray<ReturnType<typeof inspectConformance>[number]> =>
  A.filter(
    inspectConformance(root),
    (issue) => issue.path.length === path.length && A.every(issue.path, (segment, index) => path[index] === segment)
  );

const isOracleValidHtmlUrl = (value: string): boolean => {
  const candidate = stripHtmlAsciiWhitespace(value);
  return (
    Str.isNonEmpty(candidate) &&
    pipe(
      htmlUrlValidationBase,
      O.exists((baseURL) => isValidURLString(candidate, { baseURL }))
    )
  );
};

const isConformantLinkUrl = (value: string): boolean =>
  !A.isReadonlyArrayNonEmpty(inspectConformance(Link.make({ href: O.some(value), rel: O.some("canonical") })));

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
      Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
    ]) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const subtitlesWithoutLanguage = Video.make({
      children: [Track.make({ kind: O.some("subtitles"), src: O.some("/captions.vtt") })],
    });
    expect(issuesAtPath(subtitlesWithoutLanguage, ["children.0", "attributes.srclang"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
    expect(Exit.isFailure(Effect.runSyncExit(conform(subtitlesWithoutLanguage)))).toBe(true);
    const omittedKindWithoutLanguage = Track.make({ src: O.some("/captions.vtt") });
    expect(issuesAtPath(omittedKindWithoutLanguage, ["attributes.srclang"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
    expect(Exit.isFailure(Effect.runSyncExit(conform(omittedKindWithoutLanguage)))).toBe(true);
    expect(
      inspectConformance(
        Video.make({
          children: [Track.make({ kind: O.some("subtitles"), src: O.some("/captions.vtt"), srclang: O.some("en") })],
        })
      )
    ).toStrictEqual([]);

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

describe("@beep/html track language conformance", () => {
  const grandfathered = [
    "art-lojban",
    "cel-gaulish",
    "en-GB-oed",
    "i-ami",
    "i-bnn",
    "i-default",
    "i-enochian",
    "i-hak",
    "i-klingon",
    "i-lux",
    "i-mingo",
    "i-navajo",
    "i-pwn",
    "i-tao",
    "i-tay",
    "i-tsu",
    "no-bok",
    "no-nyn",
    "sgn-BE-FR",
    "sgn-BE-NL",
    "sgn-CH-DE",
    "zh-guoyu",
    "zh-hakka",
    "zh-min",
    "zh-min-nan",
    "zh-xiang",
  ];

  const languageIssues = (language: string, kind: Track["kind"]) =>
    issuesAtPath(Track.make({ kind, src: O.some("/captions.vtt"), srclang: O.some(language) }), ["attributes.srclang"]);

  it("accepts registered, grandfathered, private-use, extension, and deprecated tags", () => {
    for (const language of [
      "en",
      "EN-us",
      "zh-Hant-TW",
      "sl-rozaj-biske-1994",
      "en-a-myext-b-another",
      "en-x-private",
      "x-private",
      "x-a-b",
      "qaa-Qaaa-QM",
      "qtz-Qabx-XZ",
      "iw",
      "en-Latn",
      ...grandfathered,
    ]) {
      expect(languageIssues(language, O.some("captions"))).toStrictEqual([]);
    }
  });

  it("rejects malformed, unregistered, repeated, and incomplete tags at srclang", () => {
    const invalid = [
      "",
      " en",
      "en ",
      "en_US",
      "en--US",
      "a",
      "123",
      "abcdefghi",
      "zz",
      "abcde",
      "en-foobar",
      "zh-cmn-yue",
      "de-1901-1901",
      "en-a-foo-A-bar",
      "en-a",
      "en-a-b",
      "en-x",
      "x-abcdefghi",
      "i-madeup",
    ];
    const kinds = [undefined, "subtitles", "captions", "descriptions", "chapters", "metadata"] as const;
    for (const language of invalid) {
      for (const kind of kinds) {
        const issues = kind === undefined ? languageIssues(language, O.none()) : languageIssues(language, O.some(kind));
        expect(issues).toContainEqual(expect.objectContaining({ rule: "attributeRelationship" }));
      }
    }
  });

  it("requires every registered extlang to follow its IANA primary-language prefix", () => {
    for (const language of ["ar-aao", "sgn-ads", "ms-bjn", "zh-cmn"]) {
      expect(languageIssues(language, O.some("captions"))).toStrictEqual([]);
    }
    for (const language of ["en-aao", "en-ads", "en-bjn", "en-cmn"]) {
      expect(languageIssues(language, O.some("captions"))).toContainEqual(
        expect.objectContaining({ rule: "attributeRelationship" })
      );
    }
  });

  it("keeps non-subtitle kinds exempt from the conditional srclang requirement", () => {
    for (const kind of ["captions", "descriptions", "chapters", "metadata"] as const) {
      expect(inspectConformance(Track.make({ kind: O.some(kind), src: O.some("/captions.vtt") }))).toStrictEqual([]);
    }
  });

  it("accepts generated registered language/script/region combinations and rejects separator corruption", () => {
    const registeredTag = fc
      .tuple(
        fc.constantFrom("en", "fr", "zh", "qaa", "qtz", "iw"),
        fc.constantFrom("Latn", "Cyrl", "Hant", "Qaaa", "Qabx"),
        fc.constantFrom("US", "FR", "TW", "QM", "XZ")
      )
      .map(([language, script, region]) => `${language}-${script}-${region}`);
    fc.assert(
      fc.property(registeredTag, (language) => {
        expect(languageIssues(language, O.some("captions"))).toStrictEqual([]);
        expect(languageIssues(language.replaceAll("-", "_"), O.some("captions"))).toContainEqual(
          expect.objectContaining({ rule: "attributeRelationship" })
        );
      }),
      fcRuns(100)
    );
  });
});

describe("@beep/html missing-attribute issue paths", () => {
  it("reports the one actually missing singleton from a multi-group requirement", () => {
    expect(issuesAtPath(Img.make({ src: O.some("/image.png") }), ["attributes.alt"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
    expect(
      issuesAtPath(Input.make({ src: O.some("/submit.png"), type: O.some("image") }), ["attributes.alt"])
    ).toContainEqual(expect.objectContaining({ rule: "attributeRelationship" }));
    expect(
      issuesAtPath(Input.make({ alt: O.some("Submit"), type: O.some("image") }), ["attributes.src"])
    ).toContainEqual(expect.objectContaining({ rule: "attributeRelationship" }));
    expect(issuesAtPath(Meta.make({ name: O.some("description") }), ["attributes.content"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
  });

  it("keeps ambiguous alternative and multiple-group misses at the attribute bag", () => {
    expect(issuesAtPath(Img.make({}), ["attributes"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
    expect(issuesAtPath(Meta.make({}), ["attributes"])).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
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
              Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
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
              Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
              Anchor.make({ children: [text("fallback")] }),
            ],
          }),
        ],
      }),
      MapElement.make({ children: [Area.make({ shape: O.some("default") })], name: O.some("image-map") }),
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
        children: [
          Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
          Source.make({ src: O.some("/movie.mp4") }),
        ],
      }),
      Video.make({
        children: [
          Anchor.make({ children: [text("fallback")] }),
          Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
        ],
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
          Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en") }),
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
    const invalid = [
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
    ];
    const paths = [
      ["children.0", "attributes.src"],
      ["children.0", "attributes.src"],
      ["children.0", "attributes"],
      ["children.0", "attributes"],
      ["children.0", "attributes"],
      ["children.0", "attributes"],
      ["children.0", "attributes.srcset"],
      ["children.0", "attributes"],
    ];
    for (const [root, path] of A.zip(invalid, paths)) {
      expect(inspectConformance(root)).toContainEqual(expect.objectContaining({ path, rule: "attributeRelationship" }));
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

  it("evaluates contextual area, link, and meta placement from generated rules", () => {
    const bodyOkLinkTypes = [
      "dns-prefetch",
      "modulepreload",
      "pingback",
      "preconnect",
      "prefetch",
      "preload",
      "stylesheet",
    ];
    for (const rel of bodyOkLinkTypes) {
      const root = P.make({
        children: [
          Link.make({
            as: rel === "preload" ? O.some("image") : O.none(),
            href: O.some("/resource"),
            rel: O.some(rel),
          }),
        ],
      });
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }
    const allBodyOk = P.make({
      children: [
        Link.make({ as: O.some("script"), href: O.some("/resource"), rel: O.some(bodyOkLinkTypes.join(" ")) }),
      ],
    });
    expect(inspectConformance(allBodyOk)).toStrictEqual([]);
    expect(Exit.isSuccess(Effect.runSyncExit(conform(allBodyOk)))).toBe(true);

    for (const rel of ["", "canonical", "canonical stylesheet", "expect"]) {
      const root = P.make({ children: [Link.make({ href: O.some("/resource"), rel: O.some(rel) })] });
      expect(inspectConformance(root)).toContainEqual(
        expect.objectContaining({ path: ["children.0"], rule: "contentModel" })
      );
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const valid = [
      P.make({
        children: [Link.make({ href: O.some("/item"), itemprop: O.some("url") })],
      }),
      P.make({ children: [Meta.make({ content: O.some("Beep"), itemprop: O.some("name") })] }),
      P.make({
        children: [
          MapElement.make({ children: [Area.make({ shape: O.some("default") })], name: O.some("nested-map") }),
        ],
      }),
    ];
    for (const root of valid) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const invalid = [
      P.make({ children: [Area.make({ shape: O.some("default") })] }),
      P.make({ children: [Meta.make({ content: O.some("Beep"), name: O.some("description") })] }),
      P.make({
        children: [Link.make({ href: O.some("/item"), itemprop: O.some("url"), rel: O.some("canonical") })],
      }),
      P.make({
        children: [Meta.make({ content: O.some("Beep"), itemprop: O.some("name"), name: O.some("description") })],
      }),
    ];
    for (const root of invalid) {
      expect(inspectConformance(root).length).toBeGreaterThan(0);
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }
  });

  it("enforces link addresses and the meta charset mode", () => {
    const valid = [
      Link.make({ href: O.some("https://example.com/resource"), rel: O.some("canonical") }),
      Link.make({ href: O.some("resource"), rel: O.some("canonical") }),
      Link.make({ href: O.some("/resource"), rel: O.some("canonical") }),
      Link.make({ href: O.some("?resource=1"), rel: O.some("canonical") }),
      Link.make({ href: O.some("#resource"), rel: O.some("canonical") }),
      Link.make({ href: O.some("\t /resource \r\n"), rel: O.some("canonical") }),
      Link.make({ href: O.some("\u00a0"), rel: O.some("canonical") }),
      Link.make({ as: O.some("image"), imagesrcset: O.some("/resource.png 1x"), rel: O.some("preload") }),
      Link.make({ as: O.some("image"), href: O.some("/resource"), rel: O.some("preload") }),
      Link.make({ href: O.some("/module.js"), rel: O.some("modulepreload") }),
      Link.make({ as: O.some("json"), href: O.some("/module.json"), rel: O.some("modulepreload") }),
      Link.make({
        as: O.some("image"),
        href: O.some("/resource"),
        imagesizes: O.some("100vw"),
        imagesrcset: O.some("/resource.png 400w"),
        rel: O.some("preload"),
      }),
      Link.make({ href: O.some("/item"), itemprop: O.some("url") }),
      Meta.make({ charset: O.some("utf-8") }),
    ];
    for (const root of valid) {
      expect(inspectConformance(root)).toStrictEqual([]);
      expect(Exit.isSuccess(Effect.runSyncExit(conform(root)))).toBe(true);
    }

    const invalid = [
      Link.make({ rel: O.some("canonical") }),
      Link.make({ itemprop: O.some("url") }),
      Link.make({ href: O.some(""), rel: O.some("canonical") }),
      Link.make({ href: O.some(" "), rel: O.some("canonical") }),
      Link.make({ href: O.some("not a url"), rel: O.some("canonical") }),
      Link.make({ href: O.some("bad%url"), rel: O.some("canonical") }),
      Link.make({ href: O.some("bad\turl"), rel: O.some("canonical") }),
      Link.make({ href: O.some("https:example.com"), rel: O.some("canonical") }),
      Link.make({ href: O.some("https://127.1/"), rel: O.some("canonical") }),
      Link.make({ href: O.some("https://exam%70le.org/"), rel: O.some("canonical") }),
      Link.make({ href: O.some("https://[::1"), rel: O.some("canonical") }),
      Link.make({ href: O.some("https://example.com:70000/"), rel: O.some("canonical") }),
      Link.make({ as: O.some("image"), imagesrcset: O.some(""), rel: O.some("preload") }),
      Link.make({
        as: O.some("image"),
        href: O.some(""),
        imagesrcset: O.some("/resource.png 1x"),
        rel: O.some("preload"),
      }),
      Link.make({ imagesrcset: O.some("/resource.png 1x"), rel: O.some("preload") }),
      Link.make({ as: O.some("script"), imagesrcset: O.some("/resource.png 1x"), rel: O.some("preload") }),
      Link.make({ as: O.some("image"), imagesrcset: O.some("/resource.png 1x"), rel: O.some("stylesheet") }),
      Link.make({ href: O.some("/resource"), rel: O.some("preload") }),
      Link.make({ as: O.some("image"), href: O.some("/module.js"), rel: O.some("modulepreload") }),
      Link.make({ as: O.some("image"), href: O.some("/resource"), rel: O.some("stylesheet") }),
      Link.make({ href: O.some("/resource"), imagesizes: O.some("100vw"), rel: O.some("stylesheet") }),
      Link.make({ href: O.some("/resource"), imagesizes: O.some("100vw"), rel: O.some("preload") }),
      Link.make({
        as: O.some("script"),
        href: O.some("/resource"),
        imagesizes: O.some("100vw"),
        rel: O.some("preload"),
      }),
      Meta.make({ charset: O.some("utf-8"), content: O.some("must-be-omitted") }),
    ];
    for (const root of invalid) {
      expect(inspectConformance(root)).toContainEqual(expect.objectContaining({ rule: "attributeRelationship" }));
      expect(Exit.isFailure(Effect.runSyncExit(conform(root)))).toBe(true);
    }
    expect(() => S.decodeSync(Link)({ _tag: "link", as: "video", href: "/resource", rel: "preload" })).toThrow();
    const uppercaseCharset = S.decodeResult(Meta)({ _tag: "meta", charset: "UTF-8" });
    expect(Result.isSuccess(uppercaseCharset) && O.contains(uppercaseCharset.success.charset, "utf-8")).toBe(true);
    expect(Result.isFailure(S.decodeResult(Meta)({ _tag: "meta", charset: "iso-8859-1" }))).toBe(true);
    expect(() => Link.make({ as: O.some("image"), href: O.some("/resource"), rel: O.some("PreLoad") })).toThrow();
    expect(
      inspectConformance(
        Link.make({ as: O.some("image"), href: O.some("/resource"), rel: O.some("preload\u00a0stylesheet") })
      )
    ).toContainEqual(expect.objectContaining({ path: ["attributes"], rule: "attributeRelationship" }));
  });

  it("keeps browser-safe production URL validation aligned with the WHATWG oracle", () => {
    const representative = [
      "/relative/path",
      "#fragment",
      "https://example.com/resource",
      "mailto:reader@example.com",
      "\u00a0",
      "not a url",
      "bad%url",
      "bad\turl",
      "https:example.com",
      "https://127.1/",
      "https://exam%70le.org/",
      "https://[::1",
      "https://example.com:70000/",
    ];
    for (const value of representative) {
      expect(isConformantLinkUrl(value), value).toBe(isOracleValidHtmlUrl(value));
    }

    const candidate = fc.oneof(
      fc.string({ unit: "binary", maxLength: 96 }),
      fc
        .tuple(
          fc.constantFrom("/", "./", "../", "//", "#", "?", "https://", "mailto:", "data:"),
          fc.string({ unit: "binary", maxLength: 64 })
        )
        .map(([prefix, suffix]) => `${prefix}${suffix}`)
    );

    fc.assert(
      fc.property(candidate, (value) => {
        expect(isConformantLinkUrl(value), value).toBe(isOracleValidHtmlUrl(value));
      }),
      fcRuns(500)
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

describe("@beep/html exact attribute domains", () => {
  it("keeps schema-derived open relation lists at their canonical fixed point", () =>
    fc.assert(
      fc.property(LinkRelationListArbitrary, (relation) => {
        expect(S.encodeSync(LinkRelationList)(relation)).toBe(relation);
        expect(S.decodeSync(LinkRelationList)(relation)).toBe(relation);
      }),
      fcRuns(100)
    ));

  it("rejects ambiguous factories and uses HTML ASCII case folding", () => {
    expect(() => makeAsciiCaseInsensitiveEnumerated(["foo", "FOO"])).toThrow();
    expect(() => makeSpaceSeparatedTokenList([""])).toThrow();
    expect(() => makeSpaceSeparatedTokenList(["foo", "FOO"])).toThrow();

    const AsciiK = makeAsciiCaseInsensitiveEnumerated(["k"]);
    expect(Result.isSuccess(S.decodeResult(AsciiK)("K"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(AsciiK)("K"))).toBe(true);
  });

  it("keeps link relations open while enforcing shortcut-icon and token-list laws", () => {
    for (const relation of ["shortcut icon", "SHORTCUT ICON", "apple-touch-icon", "mask-icon", "x-beep"]) {
      expect(Result.isSuccess(S.decodeResult(LinkRelationList)(relation))).toBe(true);
    }
    for (const relation of [
      "shortcut\ticon",
      "shortcut  icon",
      "icon shortcut",
      "shortcut icon preload",
      "x-beep x-beep",
    ]) {
      expect(Result.isFailure(S.decodeResult(LinkRelationList)(relation))).toBe(true);
    }

    const idReferences = S.decodeResult(HtmlIdReferenceList)("First\tsecond");
    expect(Result.isSuccess(idReferences) && idReferences.success === "First second").toBe(true);
    expect(Result.isSuccess(S.decodeResult(HtmlIdReferenceList)("First first"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(HtmlIdReferenceList)("First First"))).toBe(true);
  });

  it("keeps extension relations structural and conformant but narrows SafeHtml", () => {
    const relations = S.decodeResult(HtmlRelationList)("X-BEEP me");
    expect(Result.isSuccess(relations) && relations.success === "me x-beep").toBe(true);
    const linkRelations = S.decodeResult(LinkRelationList)("noreferrer NOOPENER");
    expect(Result.isSuccess(linkRelations) && linkRelations.success === "noopener noreferrer").toBe(true);
    for (const [schema, encoded] of [
      [Anchor, { _tag: "a", children: [], href: "/profile", rel: "me" }],
      [Area, { _tag: "area", href: "/profile", rel: "me" }],
      [Form, { _tag: "form", children: [], rel: "me" }],
    ] as const) {
      expect(Result.isSuccess(S.decodeResult(schema)(encoded))).toBe(true);
    }

    for (const relation of ["me", "opener", "x-beep"]) {
      const root = Fragment.make({
        children: [Anchor.make({ children: [], href: O.some("/profile"), rel: O.some(relation) })],
      });
      expect(inspectConformance(root)).toStrictEqual([]);
      const issues = inspectSafeHtml(Effect.runSync(conform(root)));
      expect(issues).toContainEqual(
        expect.objectContaining({ path: ["children.0", "attributes.rel"], rule: "deniedAttribute" })
      );
    }

    for (const relation of ["nofollow", "noopener", "noreferrer", "nofollow noopener noreferrer"]) {
      const root = Fragment.make({
        children: [Anchor.make({ children: [], href: O.some("/docs"), rel: O.some(relation) })],
      });
      expect(inspectSafeHtml(Effect.runSync(conform(root)))).toStrictEqual([]);
    }
    const protectedBlank = Fragment.make({
      children: [
        Anchor.make({
          children: [],
          href: O.some("/docs"),
          rel: O.some("noopener noreferrer"),
          target: O.some("_blank"),
        }),
      ],
    });
    expect(inspectSafeHtml(Effect.runSync(conform(protectedBlank)))).toStrictEqual([]);
  });

  it("decodes presence booleans, blocking tokens, and exact enumerations", () => {
    for (const value of ["", true]) {
      expect(
        Result.isSuccess(
          S.decodeUnknownResult(Template)({
            _tag: "template",
            children: [],
            shadowrootcustomelementregistry: value,
          })
        )
      ).toBe(true);
    }
    expect(
      Result.isFailure(
        S.decodeUnknownResult(Template)({
          _tag: "template",
          children: [],
          shadowrootcustomelementregistry: false,
        })
      )
    ).toBe(true);

    for (const [schema, encoded] of [
      [Link, { _tag: "link", blocking: "RENDER", href: "/style.css", rel: "stylesheet" }],
      [Script, { _tag: "script", blocking: "RENDER", content: "" }],
      [Style, { _tag: "style", blocking: "RENDER", content: "" }],
    ] as const) {
      expect(Result.isSuccess(S.decodeResult(schema)(encoded))).toBe(true);
      expect(Result.isFailure(S.decodeResult(schema)({ ...encoded, blocking: "render render" }))).toBe(true);
      expect(Result.isFailure(S.decodeResult(schema)({ ...encoded, blocking: "paint" }))).toBe(true);
    }

    const link = S.decodeResult(Link)({
      _tag: "link",
      crossorigin: "",
      href: "/style.css",
      referrerpolicy: "STRICT-ORIGIN",
      rel: "stylesheet",
    });
    expect(
      Result.isSuccess(link) &&
        O.contains(link.success.crossorigin, "anonymous") &&
        O.contains(link.success.referrerpolicy, "strict-origin")
    ).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(Link)({ _tag: "link", href: "/style.css", referrerpolicy: "private", rel: "stylesheet" })
      )
    ).toBe(true);
  });

  it("normalizes current metadata and form-control microsyntaxes", () => {
    const globals = S.decodeResult(Div)({
      _tag: "div",
      autocorrect: "",
      children: [],
      writingsuggestions: "",
    });
    expect(
      Result.isSuccess(globals) &&
        O.contains(globals.success.autocorrect, "on") &&
        O.contains(globals.success.writingsuggestions, "true")
    ).toBe(true);

    expect(Result.isSuccess(S.decodeResult(Form)({ _tag: "form", "accept-charset": "UTF-8", children: [] }))).toBe(
      true
    );
    expect(Result.isFailure(S.decodeResult(Form)({ _tag: "form", "accept-charset": "iso-8859-1", children: [] }))).toBe(
      true
    );
    expect(Result.isSuccess(S.decodeResult(Meta)({ _tag: "meta", name: "X-Beep" }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(Meta)({ _tag: "meta", name: "x beep" }))).toBe(true);
    expect(Result.isSuccess(S.decodeResult(Meta)({ _tag: "meta", "http-equiv": "REFRESH" }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(Meta)({ _tag: "meta", "http-equiv": "expires" }))).toBe(true);

    for (const command of ["toggle-popover", "TOGGLE-POPOVER", "--", "--Beep\nCommand"]) {
      expect(
        Result.isSuccess(S.decodeResult(Button)({ _tag: "button", children: [], command, commandfor: "target" }))
      ).toBe(true);
    }
    for (const command of ["", "rotate", "-beep"]) {
      expect(
        Result.isFailure(S.decodeResult(Button)({ _tag: "button", children: [], command, commandfor: "target" }))
      ).toBe(true);
    }

    for (const step of ["any", "ANY", 0.25]) {
      expect(Result.isSuccess(S.decodeResult(Input)({ _tag: "input", step }))).toBe(true);
    }
    for (const step of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "sometimes"]) {
      expect(Result.isFailure(S.decodeResult(Input)({ _tag: "input", step }))).toBe(true);
    }
  });
});

describe("@beep/html exact attribute conformance", () => {
  it("enforces autocomplete mantle and control compatibility", () => {
    expect(
      issuesAtPath(Input.make({ autocomplete: O.some("off"), type: O.some("hidden") }), ["attributes.autocomplete"])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Input.make({ autocomplete: O.some("email"), type: O.some("password") }), ["attributes.autocomplete"])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Select.make({ autocomplete: O.some("username webauthn"), children: [] }), [
        "attributes.autocomplete",
      ])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Input.make({ autocomplete: O.some("home name"), type: O.some("text") }), ["attributes.autocomplete"])
    ).toHaveLength(1);
    expect(inspectConformance(Input.make({ autocomplete: O.some("off"), type: O.some("text") }))).toStrictEqual([]);
    expect(inspectConformance(Input.make({ autocomplete: O.some("email"), type: O.some("email") }))).toStrictEqual([]);
  });

  it("enforces state-specific input and effective-submit button attributes", () => {
    expect(
      issuesAtPath(Input.make({ checked: O.some(true), type: O.some("color") }), ["attributes.checked"])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Input.make({ accept: O.some("image/*"), type: O.some("text") }), ["attributes.accept"])
    ).toHaveLength(1);
    expect(inspectConformance(Input.make({ alpha: O.some(true), type: O.some("color") }))).toStrictEqual([]);

    expect(inspectConformance(Button.make({ children: [], formaction: O.some("/submit") }))).toStrictEqual([]);
    expect(
      issuesAtPath(Button.make({ children: [], formaction: O.some("/submit"), type: O.some("button") }), [
        "attributes.formaction",
      ])
    ).toHaveLength(1);
    expect(
      issuesAtPath(
        Button.make({
          children: [],
          command: O.some("show-modal"),
          commandfor: O.some("target"),
          formaction: O.some("/submit"),
        }),
        ["attributes.formaction"]
      )
    ).toHaveLength(1);
  });

  it("uses exact integer area coordinates without IEEE-754 collapse", () => {
    expect(
      issuesAtPath(Area.make({ coords: O.some("nope"), shape: O.some("rect") }), ["attributes.coords"])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Area.make({ coords: O.some("0,0,1,1"), shape: O.some("default") }), ["attributes.coords"])
    ).toHaveLength(1);
    expect(inspectConformance(Area.make({ coords: O.some("0,0,0"), shape: O.some("circle") }))).toContainEqual(
      expect.objectContaining({ rule: "contentModel" })
    );

    const hugeRect = Area.make({
      coords: O.some("9007199254740992,0,9007199254740993,1"),
      shape: O.some("rect"),
    });
    expect(issuesAtPath(hugeRect, ["attributes.coords"])).toStrictEqual([]);
    expect(issuesAtPath(Area.make({ coords: O.some("0,0,1,1") }), ["attributes.coords"])).toStrictEqual([]);
    expect(
      issuesAtPath(Area.make({ coords: O.some("-10,0,-1,10"), shape: O.some("rect") }), ["attributes.coords"])
    ).toStrictEqual([]);
    expect(
      issuesAtPath(Area.make({ coords: O.some("-1,-1,1,1"), shape: O.some("rect") }), ["attributes.coords"])
    ).toStrictEqual([]);
    expect(
      issuesAtPath(Area.make({ coords: O.some("9007199254740993,0,9007199254740992,1"), shape: O.some("rect") }), [
        "attributes.coords",
      ])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Area.make({ coords: O.some("0,0,1,0,1,1"), shape: O.some("poly") }), ["attributes.coords"])
    ).toStrictEqual([]);
  });

  it("validates media queries, MIME types, and mask-icon colors at exact paths", () => {
    const link = (fields: Omit<Parameters<typeof Link.make>[0], "href" | "rel"> = {}) =>
      Link.make({ href: O.some("/resource"), rel: O.some("stylesheet"), ...fields });
    expect(issuesAtPath(link({ media: O.some("(") }), ["attributes.media"])).toHaveLength(1);
    expect(issuesAtPath(link({ type: O.some("") }), ["attributes.type"])).toHaveLength(1);
    expect(
      inspectConformance(link({ media: O.some("screen and (min-width: 1px)"), type: O.some("text/css") }))
    ).toStrictEqual([]);

    for (const type of [" text/css", "text/css ", "text/\u0100", 'text/css; p="bad\nvalue"']) {
      expect(issuesAtPath(link({ type: O.some(type) }), ["attributes.type"])).toHaveLength(1);
    }
    expect(
      inspectConformance(
        Link.make({ color: O.some("oklch(70% 0.15 30)"), href: O.some("/mask.svg"), rel: O.some("mask-icon") })
      )
    ).toStrictEqual([]);
    for (const color of ["not-a-color", "rgb("]) {
      expect(
        issuesAtPath(Link.make({ color: O.some(color), href: O.some("/mask.svg"), rel: O.some("mask-icon") }), [
          "attributes.color",
        ])
      ).toHaveLength(1);
    }
  });

  it("resolves case-sensitive id references in the same root and nearest table", () => {
    const valid = Fragment.make({
      children: [
        Input.make({ id: O.some("First") }),
        Output.make({ children: [], for: O.some("First") }),
        Button.make({ children: [], command: O.some("--beep"), commandfor: O.some("First") }),
      ],
    });
    expect(issuesAtPath(valid, ["children.1", "attributes.for"])).toStrictEqual([]);
    expect(issuesAtPath(valid, ["children.2", "attributes.commandfor"])).toStrictEqual([]);

    const invalid = Fragment.make({
      children: [Input.make({ id: O.some("First") }), Output.make({ children: [], for: O.some("first Missing") })],
    });
    expect(issuesAtPath(invalid, ["children.1", "attributes.for"])).toHaveLength(1);

    const table = Table.make({
      children: [
        Tbody.make({
          children: [
            Tr.make({
              children: [
                Th.make({ id: O.some("Heading"), children: [] }),
                Td.make({ headers: O.some("Heading"), children: [] }),
                Td.make({ id: O.some("Cell"), children: [] }),
                Td.make({ headers: O.some("Cell"), children: [] }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(issuesAtPath(table, ["children.0", "children.0", "children.1", "attributes.headers"])).toStrictEqual([]);
    expect(issuesAtPath(table, ["children.0", "children.0", "children.3", "attributes.headers"])).toHaveLength(1);

    const nestedTable = Table.make({
      children: [
        Tbody.make({
          children: [
            Tr.make({
              children: [
                Th.make({ id: O.some("Outer"), children: [] }),
                Td.make({
                  headers: O.some("Outer"),
                  children: [
                    Table.make({
                      children: [
                        Tbody.make({
                          children: [
                            Tr.make({
                              children: [
                                Th.make({ id: O.some("Inner"), children: [] }),
                                Td.make({ headers: O.some("Inner"), children: [] }),
                                Td.make({ headers: O.some("Outer"), children: [] }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(
      issuesAtPath(nestedTable, [
        "children.0",
        "children.0",
        "children.1",
        "children.0",
        "children.0",
        "children.0",
        "children.1",
        "attributes.headers",
      ])
    ).toStrictEqual([]);
    expect(
      issuesAtPath(nestedTable, [
        "children.0",
        "children.0",
        "children.1",
        "children.0",
        "children.0",
        "children.0",
        "children.2",
        "attributes.headers",
      ])
    ).toHaveLength(1);
  });

  it("enforces generated minlength relationships and schema-backed metadata", () => {
    expect(
      issuesAtPath(Input.make({ maxlength: O.some(2), minlength: O.some(3), type: O.some("text") }), [
        "attributes.minlength",
      ])
    ).toHaveLength(1);
    expect(
      issuesAtPath(Textarea.make({ content: "", maxlength: O.some(2), minlength: O.some(3) }), ["attributes.minlength"])
    ).toHaveLength(1);

    for (const meta of R.values(ELEMENT_META)) {
      expect(S.is(HtmlElementMeta)(meta)).toBe(true);
      const encoded = S.encodeResult(HtmlElementMeta)(meta);
      expect(Result.isSuccess(encoded)).toBe(true);
      if (Result.isFailure(encoded)) continue;
      expect(Result.isSuccess(S.decodeResult(HtmlElementMeta)(encoded.success))).toBe(true);
    }
  });
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
