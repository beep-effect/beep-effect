import {
  conform,
  conformantRoot,
  enforceSafeHtml,
  inspectConformance,
  inspectSafeHtml,
  safeHtmlAstConformant,
  safeHtmlValue,
  serialize,
  serializeConformant,
  serializeSafe,
  untrustedHtmlValue,
} from "@beep/html";
import {
  Acronym,
  A as Anchor,
  Body,
  Button,
  Datalist,
  Dd,
  Div,
  Dl,
  Document,
  Dt,
  ForeignElement,
  Head,
  Hr,
  Html,
  Img,
  Li,
  Optgroup,
  Option,
  P,
  Picture,
  Plaintext,
  Ruby,
  Script,
  Select,
  Span,
  Style,
  Summary,
  Table,
  Textarea,
  Title,
} from "@beep/html/Html.model";
import { Comment, Doctype, Text } from "@beep/html/Html.nodes";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import type { ConformantHtml, SafeHtml, SafeHtmlAst } from "@beep/html";

const text = Text.fromValue;
const comment = Comment.fromValue;
const hasRule = (root: Parameters<typeof inspectConformance>[0], rule: string): boolean =>
  inspectConformance(root).some((issue) => issue.rule === rule);
const inspectSafe = (root: Parameters<typeof conform>[0]) =>
  pipe(root, conform, Effect.map(inspectSafeHtml), Effect.runSync);
const serializeExit = (root: Parameters<typeof serialize>[0]) => Effect.runSyncExit(serialize(root));

describe("@beep/html conformance branch matrix", () => {
  it("locates every document doctype and root-placement failure", () => {
    const html = Html.make({
      children: [Head.make({ children: [Title.make({ content: "Beep" })] }), Body.make({ children: [] })],
    });
    const canonical = Document.make({
      doctype: O.some(Doctype.html()),
      children: [comment("before root"), html],
    });
    expect(inspectConformance(canonical)).toStrictEqual([]);

    const doctypes = [
      Doctype.make({}),
      Doctype.make({ name: O.some("HTML") }),
      Doctype.make({ name: O.some("html"), publicId: O.some("legacy") }),
      Doctype.make({ name: O.some("html"), systemId: O.some("legacy") }),
    ];
    for (const doctype of doctypes) {
      expect(hasRule(Document.make({ doctype: O.some(doctype), children: [html] }), "documentDoctype")).toBe(true);
    }

    for (const children of [[], [html, html], [html, Div.make({ children: [] })]]) {
      expect(hasRule(Document.make({ doctype: O.some(Doctype.html()), children }), "documentRoot")).toBe(true);
    }
    expect(hasRule(Document.make({ children: [html] }), "documentDoctype")).toBe(true);
  });

  it("covers direct and wrapped description-list alternatives", () => {
    const validWrapped = Dl.make({
      children: [
        Div.make({
          children: [
            comment("group"),
            text(" "),
            Dt.make({ children: [text("term")] }),
            Script.make({ content: "void 0" }),
            Dd.make({ children: [text("definition")] }),
          ],
        }),
      ],
    });
    expect(hasRule(validWrapped, "elementOrder")).toBe(false);

    const invalidNestedChildren = [
      ForeignElement.make({ namespace: "svg", name: "svg", children: [] }),
      text("not whitespace"),
      Span.make({ children: [] }),
    ];
    for (const child of invalidNestedChildren) {
      const root = Dl.make({
        children: [
          Div.make({
            children: [Dt.make({ children: [] }), Dd.make({ children: [] }), child],
          }),
        ],
      });
      expect(hasRule(root, "elementOrder")).toBe(true);
    }
  });

  it("covers picture, datalist, select, ruby, and obsolete-element alternatives", () => {
    expect(hasRule(Picture.make({ children: [] }), "elementOrder")).toBe(true);
    for (const child of [
      ForeignElement.make({ namespace: "svg", name: "svg", children: [] }),
      text("mixed"),
      Span.make({ children: [] }),
    ]) {
      expect(
        hasRule(
          Datalist.make({
            children: [Option.make({ children: [text("one")] }), child],
          }),
          "elementOrder"
        )
      ).toBe(true);
    }
    expect(
      hasRule(
        Datalist.make({
          children: [Option.make({ children: [text("one")] }), comment("not significant")],
        }),
        "elementOrder"
      )
    ).toBe(false);

    for (const child of [
      Option.make({ children: [] }),
      Optgroup.make({ children: [] }),
      Hr.make({}),
      Div.make({ children: [] }),
    ]) {
      expect(hasRule(Select.make({ children: [Button.make({ children: [] }), child] }), "elementOrder")).toBe(false);
    }
    expect(
      hasRule(Select.make({ children: [Button.make({ children: [] }), Span.make({ children: [] })] }), "elementOrder")
    ).toBe(true);

    expect(
      hasRule(
        Ruby.make({
          children: [text("base"), ForeignElement.make({ namespace: "svg", name: "svg", children: [] })],
        }),
        "elementOrder"
      )
    ).toBe(true);
    expect(hasRule(Acronym.make({ children: [] }), "obsoleteElement")).toBe(true);
    expect(hasRule(Div.make({ children: [] }), "obsoleteElement")).toBe(false);
  });

  it("allows and rejects foreign/text children according to the generated content tokens", () => {
    const svg = ForeignElement.make({ namespace: "svg", name: "svg", children: [] });
    expect(hasRule(P.make({ children: [svg] }), "contentModel")).toBe(false);
    expect(hasRule(Select.make({ children: [svg] }), "contentModel")).toBe(true);
    expect(hasRule(Table.make({ children: [text("not whitespace")] }), "contentModel")).toBe(true);
  });

  it("covers every opaque foreign child boundary", () => {
    const sameNamespace = ForeignElement.make({ namespace: "svg", name: "path", children: [] });
    const otherNamespace = ForeignElement.make({ namespace: "mathml", name: "math", children: [] });
    const root = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [text("label"), comment("shape"), sameNamespace, otherNamespace, Span.make({ children: [] })],
    });
    const issues = inspectConformance(root);
    expect(issues.filter((issue) => issue.rule === "foreignIntegration")).toHaveLength(2);

    const foreignWithoutTabIndex = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      attributes: O.some({ fill: "none" }),
      children: [],
    });
    expect(hasRule(Button.make({ children: [foreignWithoutTabIndex] }), "forbiddenDescendant")).toBe(false);
  });

  it("fails malformed JavaScript callers at the schema snapshot boundary", () => {
    const rawHref = {
      ...Anchor.make({ children: [text("link")] }),
      href: "/docs",
    } as unknown as Anchor;
    const buttonWithRawHref = {
      ...Button.make({ children: [] }),
      children: [rawHref],
    } as unknown as Button;
    expect(hasRule(buttonWithRawHref, "forbiddenDescendant")).toBe(true);

    const malformedText = { _tag: "#text", value: 42 };
    const malformedParagraph = {
      ...P.make({ children: [] }),
      children: [malformedText],
    } as unknown as P;
    expect(Exit.isFailure(Effect.runSyncExit(conform(malformedParagraph)))).toBe(true);

    const malformedForeign = {
      _tag: "#foreign",
      namespace: "future",
      name: 42,
      children: [],
    } as unknown as Parameters<typeof inspectConformance>[0];
    expect(inspectConformance(malformedForeign)).toContainEqual(
      expect.objectContaining({ rule: "foreignIntegration" })
    );

    const unknownNode = {
      _tag: "future-element",
      children: [],
    } as unknown as Parameters<typeof inspectConformance>[0];
    expect(inspectConformance(unknownNode)).toStrictEqual([]);
    expect(Exit.isFailure(Effect.runSyncExit(conform(unknownNode)))).toBe(true);
  });
});

describe("@beep/html safe-policy branch matrix", () => {
  it("applies role compatibility across matching, mismatching, and absent roles", () => {
    const safe = [
      Anchor.make({ href: O.some("/docs"), role: O.some("link"), children: [text("docs")] }),
      Table.make({ role: O.some("table"), children: [] }),
      Div.make({ children: [] }),
    ];
    for (const root of safe) {
      expect(inspectSafe(root)).toStrictEqual([]);
    }

    const issues = inspectSafe(Anchor.make({ href: O.some("/docs"), role: O.some("table"), children: [text("docs")] }));
    expect(issues).toContainEqual(expect.objectContaining({ rule: "deniedAttribute" }));
  });

  it("applies each element-aware ARIA compatibility rule", () => {
    const safe = [
      Anchor.make({ href: O.some("/docs"), "aria-current": O.some("page"), children: [text("docs")] }),
      Li.make({ "aria-current": O.some("step"), children: [text("step")] }),
      Div.make({ "aria-hidden": O.some("true"), children: [] }),
      Anchor.make({ href: O.some("/docs"), "aria-label": O.some("Docs"), children: [] }),
      Img.make({ alt: O.some("logo"), src: O.some("/logo.png") }),
    ];
    for (const root of safe) {
      expect(inspectSafe(root)).toStrictEqual([]);
    }

    const denied = [
      [Div.make({ "aria-current": O.some("page"), children: [] }), "deniedAttribute"],
      [
        Anchor.make({ href: O.some("/docs"), "aria-hidden": O.some("true"), children: [text("docs")] }),
        "deniedAttribute",
      ],
      [Summary.make({ "aria-hidden": O.some("true"), children: [] }), "deniedAttribute"],
      [P.make({ "aria-label": O.some("paragraph"), children: [] }), "deniedAttribute"],
      [Img.make({ alt: O.some("logo"), src: O.some("javascript:alert(1)") }), "unsafeUrl"],
    ] as const;
    for (const [root, rule] of denied) {
      expect(inspectSafe(root)).toContainEqual(expect.objectContaining({ rule }));
    }
  });
});

describe("@beep/html serialization branch matrix", () => {
  it("serializes text/comment factories and each text-content mode", () => {
    expect(text("value")).toEqual(Text.make({ value: "value" }));
    expect(comment("note")).toEqual(Comment.make({ value: "note" }));
    expect(pipe(comment("note"), serialize, Effect.runSync, untrustedHtmlValue)).toBe("<!--note-->");
    expect(pipe(Title.make({ content: "<title>" }), serialize, Effect.runSync, untrustedHtmlValue)).toBe(
      "<title>&lt;title&gt;</title>"
    );
    expect(pipe(Textarea.make({ content: "a & b" }), serialize, Effect.runSync, untrustedHtmlValue)).toBe(
      "<textarea>a &amp; b</textarea>"
    );
    expect(
      pipe(Style.make({ content: "body > p { color: red; }" }), serialize, Effect.runSync, untrustedHtmlValue)
    ).toBe("<style>body > p { color: red; }</style>");
    expect(Exit.isFailure(serializeExit(Plaintext.make({ content: "remainder" })))).toBe(true);
  });

  it("serializes optional and canonical doctypes and rejects every noncanonical component", () => {
    expect(pipe(Document.make({ children: [] }), serialize, Effect.runSync, untrustedHtmlValue)).toBe("");
    expect(
      pipe(
        Document.make({ doctype: O.some(Doctype.html()), children: [] }),
        serialize,
        Effect.runSync,
        untrustedHtmlValue
      )
    ).toBe("<!doctype html>");

    for (const doctype of [
      Doctype.make({}),
      Doctype.make({ name: O.some("HTML") }),
      Doctype.make({ name: O.some("html"), publicId: O.some("legacy") }),
      Doctype.make({ name: O.some("html"), systemId: O.some("legacy") }),
    ]) {
      expect(Exit.isFailure(serializeExit(Document.make({ doctype: O.some(doctype), children: [] })))).toBe(true);
    }
  });

  it("accepts namespace-matching qualified foreign names and rejects mismatches", () => {
    const svg = ForeignElement.make({ namespace: "svg", name: "svg:path", children: [] });
    const math = ForeignElement.make({ namespace: "mathml", name: "mathml:math", children: [] });
    expect(pipe(svg, serialize, Effect.runSync, untrustedHtmlValue)).toBe("<svg:path></svg:path>");
    expect(pipe(math, serialize, Effect.runSync, untrustedHtmlValue)).toBe("<mathml:math></mathml:math>");

    const mismatched = ForeignElement.make({ namespace: "svg", name: "mathml:path", children: [] });
    expect(Exit.isFailure(serializeExit(mismatched))).toBe(true);
    const badAttribute = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      attributes: O.some({ viewbox: "0 0 1 1" }),
      children: [],
    });
    expect(Exit.isFailure(serializeExit(badAttribute))).toBe(true);
  });

  it("exercises conformant and safe serializer entrypoints", () => {
    const root = Div.make({ children: [text("safe")] });
    const conformant = Effect.runSync(conform(root));
    expect(pipe(conformant, serializeConformant, Effect.runSync, untrustedHtmlValue)).toBe("<div>safe</div>");
    expect(Exit.isSuccess(Effect.runSyncExit(enforceSafeHtml(conformant)))).toBe(true);
  });

  it("rejects forged opaque proof values at every public unwrapping boundary", () => {
    expect(() => conformantRoot({} as ConformantHtml)).toThrow();
    expect(() => safeHtmlAstConformant({} as SafeHtmlAst)).toThrow();
    expect(() => safeHtmlValue({} as SafeHtml)).toThrow();
    expect(Exit.isFailure(Effect.runSyncExit(serializeSafe({} as SafeHtmlAst)))).toBe(true);
  });
});
