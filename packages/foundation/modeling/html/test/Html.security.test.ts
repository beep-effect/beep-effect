import {
  ConformantHtml,
  conform,
  conformantRoot,
  enforceSafeHtml,
  HtmlCommentData,
  HtmlFragment,
  inspectConformance,
  inspectSafeHtml,
  SafeHtml,
  SafeHtmlAst,
  SafeImageUrlAttribute,
  SafeUrlAttribute,
  safeHtmlAstRoot,
  safeHtmlValue,
  serialize,
  serializeSafe,
  untrustedHtmlValue,
} from "@beep/html";
import {
  A as Anchor,
  Body,
  Button,
  Caption,
  Colgroup,
  Data,
  Div,
  Document,
  ForeignElement,
  Form,
  Head,
  Html,
  Img,
  Input,
  Ins,
  Li,
  Meta,
  Noscript,
  Ol,
  P,
  Script,
  Table,
  Tbody,
  Tfoot,
  Thead,
  Title,
  Tr,
} from "@beep/html/Html.model";
import { Comment, Doctype, Text } from "@beep/html/Html.nodes";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const text = (value: string): Text => Text.make({ value });
const fragment = (...children: HtmlFragment["children"]): HtmlFragment => HtmlFragment.make({ children });

const conformSync = (root: Parameters<typeof conform>[0]) => Effect.runSync(conform(root));

const safeExit = (root: Parameters<typeof conform>[0]) =>
  Effect.runSyncExit(conform(root).pipe(Effect.flatMap(enforceSafeHtml)));

const serializeSync = (root: Parameters<typeof serialize>[0]): string =>
  pipe(root, serialize, Effect.runSync, untrustedHtmlValue);

describe("@beep/html conformance", () => {
  it("uses transparent ancestor context and registry-driven descendant constraints", () => {
    const transparentBlock = P.make({
      children: [
        Anchor.make({
          href: O.some("/docs"),
          children: [Div.make({ children: [] })],
        }),
      ],
    });
    expect(inspectConformance(transparentBlock).some((issue) => issue.rule === "contentModel")).toBe(true);

    const nestedForm = Form.make({
      children: [Form.make({ children: [] })],
    });
    expect(inspectConformance(nestedForm).some((issue) => issue.rule === "forbiddenDescendant")).toBe(true);
  });

  it("checks document structure and cross-attribute registries", () => {
    const document = Document.make({
      doctype: O.some(Doctype.html()),
      children: [
        Html.make({
          children: [Head.make({ children: [Title.make({ content: "Beep" })] }), Body.make({ children: [] })],
        }),
      ],
    });
    expect(inspectConformance(document)).toStrictEqual([]);

    expect(inspectConformance(Img.make({ src: O.some("/logo.png") }))).toContainEqual(
      expect.objectContaining({ rule: "attributeRelationship" })
    );
    expect(
      inspectConformance(
        Input.make({
          type: O.some("image"),
          src: O.some("/submit.png"),
        })
      )
    ).toContainEqual(expect.objectContaining({ rule: "attributeRelationship" }));
  });

  it("requires foreign integration roots and rejects context-free noscript proofs", () => {
    const circle = ForeignElement.make({
      namespace: "svg",
      name: "circle",
      children: [],
    });
    expect(inspectConformance(fragment(circle))).toContainEqual(
      expect.objectContaining({ rule: "foreignIntegration" })
    );

    const svg = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      children: [circle],
    });
    expect(inspectConformance(fragment(svg))).toStrictEqual([]);
    expect(inspectConformance(Noscript.make({ children: [] }))).toContainEqual(
      expect.objectContaining({ rule: "contentModel" })
    );
  });

  it("enforces table child sequence and cardinality", () => {
    const valid = Table.make({
      children: [
        Caption.make({ children: [] }),
        Colgroup.make({ children: [] }),
        Thead.make({ children: [] }),
        Tbody.make({ children: [] }),
        Tfoot.make({ children: [] }),
      ],
    });
    expect(inspectConformance(valid)).toStrictEqual([]);
    expect(inspectConformance(Table.make({ children: [Tr.make({ children: [] })] }))).toStrictEqual([]);

    const invalidChildren = [
      [Tbody.make({ children: [] }), Caption.make({ children: [] })],
      [Caption.make({ children: [] }), Caption.make({ children: [] })],
      [Tbody.make({ children: [] }), Tr.make({ children: [] })],
      [Thead.make({ children: [] }), Thead.make({ children: [] })],
      [Tfoot.make({ children: [] }), Tbody.make({ children: [] })],
    ];
    for (const children of invalidChildren) {
      expect(inspectConformance(Table.make({ children }))).toContainEqual(
        expect.objectContaining({ rule: "elementOrder" })
      );
    }
  });
});

describe("@beep/html safe policy", () => {
  it("applies element-aware URL policies", () => {
    for (const href of ["/docs", "#section", "https://example.com", "mailto:user@example.com", "tel:+15551212"]) {
      expect(
        Exit.isSuccess(
          safeExit(
            fragment(
              Anchor.make({
                href: O.some(href),
                children: [text("link")],
              })
            )
          )
        )
      ).toBe(true);
    }

    for (const href of ["http://example.com", "javascript:alert(1)", "//example.com", String.raw`\evil`]) {
      expect(
        Exit.isFailure(
          safeExit(
            fragment(
              Anchor.make({
                href: O.some(href),
                children: [text("link")],
              })
            )
          )
        )
      ).toBe(true);
    }

    expect(S.is(SafeUrlAttribute)("tel:+15551212")).toBe(true);
    expect(S.is(SafeUrlAttribute)("http://example.com")).toBe(false);
    expect(S.is(SafeImageUrlAttribute)("https://example.com/logo.png")).toBe(true);
    expect(S.is(SafeImageUrlAttribute)("mailto:user@example.com")).toBe(false);
  });

  it('requires noopener and noreferrer for target="_blank"', () => {
    for (const target of ["_blank", "_BLANK", "_Blank", "_bLaNk"]) {
      const unsafe = fragment(
        Anchor.make({
          href: O.some("https://example.com"),
          target: O.some(target),
          children: [text("link")],
        })
      );
      expect(Exit.isFailure(safeExit(unsafe))).toBe(true);
    }

    const safe = fragment(
      Anchor.make({
        href: O.some("https://example.com"),
        rel: O.some("noopener noreferrer"),
        target: O.some("_BLANK"),
        children: [text("link")],
      })
    );
    expect(Exit.isSuccess(safeExit(safe))).toBe(true);
    expect(
      safeHtmlValue(Effect.runSync(conform(safe).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe))))
    ).toBe('<a href="https://example.com" rel="noopener noreferrer" target="_BLANK">link</a>');
  });

  it("denies active, foreign, form, data, event, style, and broad global attributes", () => {
    const denied = [
      Form.make({ children: [] }),
      Script.make({ content: "alert(1)" }),
      ForeignElement.make({ namespace: "svg", name: "svg", children: [] }),
      Div.make({ dataset: O.some({ testid: "x" }), children: [] }),
      Div.make({ onclick: O.some("alert(1)"), children: [] }),
      Div.make({ style: O.some("display:none"), children: [] }),
      Div.make({ autofocus: O.some(true), children: [] }),
      P.make({ "aria-label": O.some("paragraph"), children: [] }),
    ];

    for (const node of denied) {
      const proof = conformSync(node);
      expect(inspectSafeHtml(proof).length).toBeGreaterThan(0);
    }
  });

  it("accepts inert insertion semantics with safe cite and datetime attributes", () => {
    const insertion = fragment(
      Ins.make({
        cite: O.some("https://example.com/change"),
        datetime: O.some("2026-07-29"),
        children: [text("added")],
      })
    );
    expect(Exit.isSuccess(safeExit(insertion))).toBe(true);

    const unsafeCitation = fragment(
      Ins.make({
        cite: O.some("javascript:alert(1)"),
        children: [text("added")],
      })
    );
    expect(Exit.isFailure(safeExit(unsafeCitation))).toBe(true);
  });

  it("checks element attributes whose names overlap AST structural fields", () => {
    const safe = fragment(
      Data.make({ value: O.some("42"), children: [text("answer")] }),
      Ol.make({
        children: [Li.make({ value: O.some(-2), children: [text("item")] })],
      })
    );
    expect(Exit.isSuccess(safeExit(safe))).toBe(true);

    const legacyImageName = Img.make({
      alt: O.some("logo"),
      name: O.some("unsafe-legacy-name"),
      src: O.some("/logo.png"),
    });
    expect(inspectConformance(legacyImageName)).toContainEqual(expect.objectContaining({ rule: "obsoleteAttribute" }));
    expect(Exit.isFailure(Effect.runSyncExit(conform(legacyImageName)))).toBe(true);
  });
});

describe("@beep/html canonical serialization", () => {
  it("escapes text and attributes and emits deterministic attribute order", () => {
    const node = Anchor.make({
      class: O.some('a"b'),
      href: O.some("/docs?a=1&b=2"),
      id: O.some("link"),
      rel: O.some("noopener noreferrer"),
      target: O.some("_blank"),
      children: [text("<go>")],
    });
    expect(serializeSync(node)).toBe(
      '<a class="a&quot;b" href="/docs?a=1&amp;b=2" id="link" rel="noopener noreferrer" target="_blank">&lt;go&gt;</a>'
    );
    expect(serializeSync(Input.make({ disabled: O.some("") }))).toBe("<input disabled>");
    expect(
      serializeSync(
        Div.make({
          autofocus: O.some(""),
          headingreset: O.some(""),
          inert: O.some(""),
          itemscope: O.some(""),
          children: [],
        })
      )
    ).toBe("<div autofocus headingreset inert itemscope></div>");
  });

  it("serializes real content, name, and value attributes without structural-field loss", () => {
    const root = fragment(
      Data.make({ value: O.some("42"), children: [text("answer")] }),
      Ol.make({
        children: [Li.make({ value: O.some(-2), children: [text("item")] })],
      }),
      Meta.make({ content: O.some("text/html") }),
      Input.make({ name: O.some("query"), value: O.some("beep") }),
      Button.make({ name: O.some("action"), value: O.some("save"), children: [text("Save")] })
    );

    expect(serializeSync(root)).toBe(
      '<data value="42">answer</data><ol><li value="-2">item</li></ol><meta content="text/html"><input name="query" value="beep"><button name="action" value="save">Save</button>'
    );

    const safeRoot = fragment(
      Data.make({ value: O.some("42"), children: [text("answer")] }),
      Ol.make({
        children: [Li.make({ value: O.some(-2), children: [text("item")] })],
      })
    );
    const html = Effect.runSync(conform(safeRoot).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe)));
    expect(safeHtmlValue(html)).toBe('<data value="42">answer</data><ol><li value="-2">item</li></ol>');
  });

  it("sorts dataset and losslessly preserves escaped foreign attributes", () => {
    expect(
      serializeSync(
        Div.make({
          dataset: O.some({ zed: "2", alpha: "1" }),
          children: [],
        })
      )
    ).toBe('<div data-alpha="1" data-zed="2"></div>');

    const foreign = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      attributes: O.some({ viewBox: "0 0 1 1", fill: "none" }),
      children: [],
    });
    expect(serializeSync(foreign)).toBe('<svg fill="none" viewBox="0 0 1 1"></svg>');

    const active = ForeignElement.make({
      namespace: "svg",
      name: "svg",
      attributes: O.some({
        href: "javascript:alert(1)",
        onload: 'alert("x")',
        style: "fill:red",
        "xlink:href": "data:image/svg+xml?a=1&b=2",
      }),
      children: [],
    });
    expect(serializeSync(active)).toBe(
      '<svg href="javascript:alert(1)" onload="alert(&quot;x&quot;)" style="fill:red" xlink:href="data:image/svg+xml?a=1&amp;b=2"></svg>'
    );
    expect(() =>
      S.decodeUnknownSync(ForeignElement)({
        _tag: "#foreign",
        namespace: "svg",
        name: 'svg onload="x"',
        children: [],
      })
    ).toThrow();
  });

  it("rejects scalar hazards, ambiguous comments, raw end tags, and plaintext", () => {
    expect(Exit.isFailure(Effect.runSyncExit(serialize(text("\u0000"))))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(serialize(text("\uD800"))))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(serialize(Div.make({ id: O.some("\u0000"), children: [] }))))).toBe(true);
    expect(S.is(HtmlCommentData)("safe note")).toBe(true);
    expect(S.is(HtmlCommentData)("-->")).toBe(false);
    expect(() => Comment.make({ value: "<!--" })).toThrow();
    expect(Exit.isFailure(Effect.runSyncExit(serialize(Script.make({ content: "</script><img src=x>" }))))).toBe(true);
  });
});

describe("@beep/html proof provenance", () => {
  it("snapshots and freezes the proven tree before safe serialization", () => {
    const anchor = Anchor.make({
      href: O.some("/safe"),
      children: [text("safe")],
    });
    const paragraph = P.make({ children: [text("nested")] });
    const source = fragment(anchor, paragraph);
    const conformant = conformSync(source);
    const safeAst = Effect.runSync(enforceSafeHtml(conformant));
    const issuedRoot = conformantRoot(conformant);
    const safeRoot = safeHtmlAstRoot(safeAst);
    const injected = Script.make({ content: "alert(1)" });

    expect(Reflect.set(source.children, `${source.children.length}`, injected)).toBe(true);
    expect(Reflect.set(paragraph.children, "0", injected)).toBe(true);
    expect(Reflect.set(anchor, "href", O.some("javascript:alert(1)"))).toBe(true);
    expect(Reflect.set(anchor, "style", O.some("display:none"))).toBe(true);
    expect(Reflect.set(anchor, "onclick", O.some("alert(1)"))).toBe(true);

    expect(Object.isFrozen(issuedRoot)).toBe(true);
    expect(safeRoot).toBe(issuedRoot);
    if (issuedRoot._tag === "#fragment") {
      expect(Object.isFrozen(issuedRoot.children)).toBe(true);
      const issuedAnchor = issuedRoot.children[0];
      expect(Object.isFrozen(issuedAnchor)).toBe(true);
      expect(Reflect.set(issuedRoot.children, "0", injected)).toBe(false);
      expect(Reflect.set(issuedAnchor, "href", O.some("javascript:alert(1)"))).toBe(false);
      expect(Reflect.set(issuedAnchor, "style", O.some("display:none"))).toBe(false);
      expect(Reflect.set(issuedAnchor, "onclick", O.some("alert(1)"))).toBe(false);
    }

    const safeHtml = Effect.runSync(serializeSafe(safeAst));
    expect(safeHtmlValue(safeHtml)).toBe('<a href="/safe">safe</a><p>nested</p>');
  });

  it("rejects prototype, spread, JSON, and plain-object proof forgeries", () => {
    const conformant = conformSync(fragment(P.make({ children: [text("safe")] })));
    const safeAst = Effect.runSync(enforceSafeHtml(conformant));
    const safeHtml = Effect.runSync(serializeSafe(safeAst));

    expect(S.is(ConformantHtml)(conformant)).toBe(true);
    expect(S.is(SafeHtmlAst)(safeAst)).toBe(true);
    expect(S.is(SafeHtml)(safeHtml)).toBe(true);
    expect(safeHtmlValue(safeHtml)).toBe("<p>safe</p>");

    for (const [schema, value] of [
      [ConformantHtml, conformant],
      [SafeHtmlAst, safeAst],
      [SafeHtml, safeHtml],
    ] as const) {
      expect(Object.getPrototypeOf(value)).toBeNull();
      expect(Reflect.get(value, "constructor")).toBeUndefined();
      expect(Object.keys(value)).toStrictEqual([]);
      expect(JSON.stringify(value)).toBe("{}");
      expect(S.is(schema)({ ...value })).toBe(false);
      expect(S.is(schema)(JSON.parse(JSON.stringify(value)))).toBe(false);
      expect(S.is(schema)(Object.create(Object.getPrototypeOf(value)))).toBe(false);
      expect(S.is(schema)({})).toBe(false);
    }
  });
});
