import {
  conform,
  conformantRoot,
  enforceSafeHtml,
  HtmlDocument,
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
  Fragment,
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
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ConformantHtml, SafeHtml, SafeHtmlAst } from "@beep/html";

const isHtmlDocument = S.is(HtmlDocument);

const text = Text.fromValue;
const comment = Comment.fromValue;
const hasRule = (root: Parameters<typeof inspectConformance>[0], rule: string): boolean =>
  inspectConformance(root).some((issue) => issue.rule === rule);

describe("@beep/html conformance branch matrix", () => {
  it("rejects a structurally invalid recursive conformance view", () => {
    const issues = Reflect.apply(inspectConformance, undefined, [
      { _tag: "#fragment", children: [{ _tag: "div", children: [null] }] },
    ]);

    expect(issues).toStrictEqual([
      expect.objectContaining({
        path: [],
        rule: "encodingFailure",
      }),
    ]);
  });

  it("constructs recursive conformance views with canonical Option doctypes", () => {
    const fragment = Fragment.make({
      children: [Div.make({ children: [Span.make({ children: [text("nested")] })] })],
    });

    expect(inspectConformance(fragment)).toStrictEqual([]);

    const html = Html.make({
      children: [Head.make({ children: [Title.make({ content: "Beep" })] }), Body.make({ children: [] })],
    });
    const document = Document.make({ doctype: O.some(Doctype.html()), children: [html] });

    expect(inspectConformance(document)).toStrictEqual([]);
  });

  it("locates every document doctype and root-placement failure", () => {
    const html = Html.make({
      children: [Head.make({ children: [Title.make({ content: "Beep" })] }), Body.make({ children: [] })],
    });
    const canonical = HtmlDocument.make({
      doctype: O.some(Doctype.html()),
      children: [comment("before root"), html],
    });
    expect(isHtmlDocument(canonical)).toBe(true);
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

  it("rejects obsolete elements at the inspectConformance boundary", () => {
    expect(hasRule(Acronym.make({ children: [] }), "obsoleteElement")).toBe(true);
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

  it.effect("fails malformed JavaScript callers at the schema snapshot boundary", () =>
    Effect.gen(function* () {
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
      assertTrue(Exit.isFailure(yield* Effect.exit(conform(malformedParagraph))));

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
      assertTrue(Exit.isFailure(yield* Effect.exit(conform(unknownNode))));
    })
  );
});

describe("@beep/html safe-policy branch matrix", () => {
  it.effect("applies role compatibility across matching, mismatching, and absent roles", () =>
    Effect.gen(function* () {
      const safe = [
        Anchor.make({ href: O.some("/docs"), role: O.some("link"), children: [text("docs")] }),
        Table.make({ role: O.some("table"), children: [] }),
        Div.make({ children: [] }),
      ];
      for (const root of safe) {
        expect(yield* conform(root).pipe(Effect.map(inspectSafeHtml))).toStrictEqual([]);
      }

      const issues = yield* conform(
        Anchor.make({ href: O.some("/docs"), role: O.some("table"), children: [text("docs")] })
      ).pipe(Effect.map(inspectSafeHtml));
      expect(issues).toContainEqual(expect.objectContaining({ rule: "deniedAttribute" }));
    })
  );

  it.effect("applies each element-aware ARIA compatibility rule", () =>
    Effect.gen(function* () {
      const safe = [
        Anchor.make({ href: O.some("/docs"), "aria-current": O.some("page"), children: [text("docs")] }),
        Li.make({ "aria-current": O.some("step"), children: [text("step")] }),
        Div.make({ "aria-hidden": O.some("true"), children: [] }),
        Anchor.make({ href: O.some("/docs"), "aria-label": O.some("Docs"), children: [] }),
        Img.make({ alt: O.some("logo"), src: O.some("/logo.png") }),
      ];
      for (const root of safe) {
        expect(yield* conform(root).pipe(Effect.map(inspectSafeHtml))).toStrictEqual([]);
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
        expect(yield* conform(root).pipe(Effect.map(inspectSafeHtml))).toContainEqual(
          expect.objectContaining({ rule })
        );
      }
    })
  );
});

describe("@beep/html serialization branch matrix", () => {
  it.effect("serializes text/comment factories and each text-content mode", () =>
    Effect.gen(function* () {
      expect(text("value")).toEqual(Text.make({ value: "value" }));
      expect(comment("note")).toEqual(Comment.make({ value: "note" }));
      expect(yield* pipe(comment("note"), serialize, Effect.map(untrustedHtmlValue))).toBe("<!--note-->");
      expect(yield* pipe(Title.make({ content: "<title>" }), serialize, Effect.map(untrustedHtmlValue))).toBe(
        "<title>&lt;title&gt;</title>"
      );
      expect(yield* pipe(Textarea.make({ content: "a & b" }), serialize, Effect.map(untrustedHtmlValue))).toBe(
        "<textarea>a &amp; b</textarea>"
      );
      expect(
        yield* pipe(Style.make({ content: "body > p { color: red; }" }), serialize, Effect.map(untrustedHtmlValue))
      ).toBe("<style>body > p { color: red; }</style>");
      assertTrue(Exit.isFailure(yield* Effect.exit(serialize(Plaintext.make({ content: "remainder" })))));
    })
  );

  it.effect("serializes optional and canonical doctypes and rejects every noncanonical component", () =>
    Effect.gen(function* () {
      expect(yield* pipe(Document.make({ children: [] }), serialize, Effect.map(untrustedHtmlValue))).toBe("");
      expect(
        yield* pipe(
          Document.make({ doctype: O.some(Doctype.html()), children: [] }),
          serialize,
          Effect.map(untrustedHtmlValue)
        )
      ).toBe("<!doctype html>");

      for (const doctype of [
        Doctype.make({}),
        Doctype.make({ name: O.some("HTML") }),
        Doctype.make({ name: O.some("html"), publicId: O.some("legacy") }),
        Doctype.make({ name: O.some("html"), systemId: O.some("legacy") }),
      ]) {
        assertTrue(
          Exit.isFailure(yield* Effect.exit(serialize(Document.make({ doctype: O.some(doctype), children: [] }))))
        );
      }
    })
  );

  it.effect("accepts namespace-matching qualified foreign names and rejects mismatches", () =>
    Effect.gen(function* () {
      const svg = ForeignElement.make({ namespace: "svg", name: "svg:path", children: [] });
      const math = ForeignElement.make({ namespace: "mathml", name: "mathml:math", children: [] });
      expect(yield* pipe(svg, serialize, Effect.map(untrustedHtmlValue))).toBe("<svg:path></svg:path>");
      expect(yield* pipe(math, serialize, Effect.map(untrustedHtmlValue))).toBe("<mathml:math></mathml:math>");

      const mismatched = ForeignElement.make({ namespace: "svg", name: "mathml:path", children: [] });
      assertTrue(Exit.isFailure(yield* Effect.exit(serialize(mismatched))));
      const badAttribute = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        attributes: O.some({ viewbox: "0 0 1 1" }),
        children: [],
      });
      assertTrue(Exit.isFailure(yield* Effect.exit(serialize(badAttribute))));
    })
  );

  it.effect("exercises conformant and safe serializer entrypoints", () =>
    Effect.gen(function* () {
      const root = Div.make({ children: [text("safe")] });
      const conformant = yield* conform(root);
      expect(yield* pipe(conformant, serializeConformant, Effect.map(untrustedHtmlValue))).toBe("<div>safe</div>");
      yield* enforceSafeHtml(conformant);
    })
  );

  it.effect("rejects forged opaque proof values at every public unwrapping boundary", () =>
    Effect.gen(function* () {
      expect(() => conformantRoot({} as ConformantHtml)).toThrow();
      expect(() => safeHtmlAstConformant({} as SafeHtmlAst)).toThrow();
      expect(() => safeHtmlValue({} as SafeHtml)).toThrow();
      assertTrue(Exit.isFailure(yield* Effect.exit(serialize({} as Parameters<typeof serialize>[0]))));
      assertTrue(Exit.isFailure(yield* Effect.exit(serializeSafe({} as SafeHtmlAst))));
    })
  );
});
