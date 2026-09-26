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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import { Effect, Exit } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeAnchor = S.decodeUnknownEffect(Anchor);
const decodeForeignElement = S.decodeUnknownEffect(ForeignElement);
const decodeSafeImageUrlAttribute = S.decodeUnknownEffect(SafeImageUrlAttribute);
const decodeSafeUrlAttribute = S.decodeUnknownEffect(SafeUrlAttribute);
const encodeSafeImageUrlAttribute = S.encodeEffect(SafeImageUrlAttribute);
const encodeSafeUrlAttribute = S.encodeEffect(SafeUrlAttribute);
const isConformantHtml = S.is(ConformantHtml);
const isHtmlCommentData = S.is(HtmlCommentData);
const isSafeHtml = S.is(SafeHtml);
const isSafeHtmlAst = S.is(SafeHtmlAst);
const isSafeImageUrlAttribute = S.is(SafeImageUrlAttribute);
const isSafeUrlAttribute = S.is(SafeUrlAttribute);

const SafeImageUrlAttributeArbitrary = Arbitrary.schema(SafeImageUrlAttribute);
const SafeUrlAttributeArbitrary = Arbitrary.schema(SafeUrlAttribute);
const text = (value: string): Text => Text.make({ value });
const fragment = (...children: HtmlFragment["children"]): HtmlFragment => HtmlFragment.make({ children });

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
  it.effect.prop(
    "keeps schema-derived safe URL attributes at their codec fixed points",
    [SafeUrlAttributeArbitrary, SafeImageUrlAttributeArbitrary],
    ([href, src]) =>
      Effect.gen(function* () {
        expect(yield* decodeSafeUrlAttribute(yield* encodeSafeUrlAttribute(href))).toBe(href);
        expect(yield* decodeSafeImageUrlAttribute(yield* encodeSafeImageUrlAttribute(src))).toBe(src);

        return true;
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect("applies element-aware URL policies", () =>
    Effect.gen(function* () {
      for (const href of ["/docs", "#section", "https://example.com", "mailto:user@example.com", "tel:+15551212"]) {
        yield* conform(
          fragment(
            Anchor.make({
              href: O.some(href),
              children: [text("link")],
            })
          )
        ).pipe(Effect.flatMap(enforceSafeHtml));
      }

      for (const href of ["http://example.com", "javascript:alert(1)", "//example.com", String.raw`\evil`]) {
        assertExitFailure(
          Exit.match(
            yield* conform(
              fragment(
                Anchor.make({
                  href: O.some(href),
                  children: [text("link")],
                })
              )
            ).pipe(Effect.flatMap(enforceSafeHtml), Effect.exit),
            {
              onSuccess: Exit.succeed,
              onFailure: (cause) =>
                Exit.failCause(
                  Cause.fromReasons(
                    A.map(cause.reasons, (reason) =>
                      Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                    )
                  )
                ),
            }
          ),
          Cause.fail("HtmlPolicyError")
        );
      }

      expect(isSafeUrlAttribute("tel:+15551212")).toBe(true);
      expect(isSafeUrlAttribute("http://example.com")).toBe(false);
      expect(isSafeImageUrlAttribute("https://example.com/logo.png")).toBe(true);
      expect(isSafeImageUrlAttribute("mailto:user@example.com")).toBe(false);
    })
  );

  it.effect("admits only self targets or protected blank targets", () =>
    Effect.gen(function* () {
      for (const target of ["_blank", "_BLANK", "_Blank", "_bLaNk"]) {
        const unsafe = fragment(
          Anchor.make({
            href: O.some("https://example.com"),
            target: O.some(target),
            children: [text("link")],
          })
        );
        assertExitFailure(
          Exit.match(yield* conform(unsafe).pipe(Effect.flatMap(enforceSafeHtml), Effect.exit), {
            onSuccess: Exit.succeed,
            onFailure: (cause) =>
              Exit.failCause(
                Cause.fromReasons(
                  A.map(cause.reasons, (reason) =>
                    Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                  )
                )
              ),
          }),
          Cause.fail("HtmlPolicyError")
        );
      }

      for (const target of ["report-window", "_parent", "_top", "_unfencedTop", "", " _self"]) {
        const unsafe = fragment(
          Anchor.make({
            href: O.some("https://example.com"),
            target: O.some(target),
            children: [text("link")],
          })
        );
        assertExitFailure(
          Exit.match(yield* conform(unsafe).pipe(Effect.flatMap(enforceSafeHtml), Effect.exit), {
            onSuccess: Exit.succeed,
            onFailure: (cause) =>
              Exit.failCause(
                Cause.fromReasons(
                  A.map(cause.reasons, (reason) =>
                    Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                  )
                )
              ),
          }),
          Cause.fail("HtmlPolicyError")
        );
      }

      for (const target of ["_self", "_SELF"]) {
        const safeSelf = fragment(
          Anchor.make({
            href: O.some("https://example.com"),
            target: O.some(target),
            children: [text("link")],
          })
        );
        yield* conform(safeSelf).pipe(Effect.flatMap(enforceSafeHtml));
      }

      const safe = fragment(
        Anchor.make({
          href: O.some("https://example.com"),
          rel: O.some("noopener noreferrer"),
          target: O.some("_BLANK"),
          children: [text("link")],
        })
      );
      yield* conform(safe).pipe(Effect.flatMap(enforceSafeHtml));
      expect(
        safeHtmlValue(yield* conform(safe).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe)))
      ).toBe('<a href="https://example.com" rel="noopener noreferrer" target="_BLANK">link</a>');
    })
  );

  it.effect("treats HTML ASCII whitespace as rel token separators for protected blank targets", () =>
    Effect.gen(function* () {
      const applyPolicy = (root: HtmlFragment) => conform(root).pipe(Effect.flatMap(enforceSafeHtml));

      for (const separator of [" ", "\t", "\n", "\f", "\r"]) {
        const decoded = yield* decodeAnchor({
          _tag: "a",
          children: [{ _tag: "#text", value: "link" }],
          href: "https://example.com",
          rel: `noopener${separator}noreferrer`,
          target: "_blank",
        });
        yield* applyPolicy(fragment(decoded));
      }
      for (const separator of ["\u00a0", "\u2003", "\u202f"]) {
        const decoded = yield* decodeAnchor({
          _tag: "a",
          children: [{ _tag: "#text", value: "link" }],
          href: "https://example.com",
          rel: `noopener${separator}noreferrer`,
          target: "_blank",
        });
        assertExitFailure(
          Exit.match(yield* Effect.exit(applyPolicy(fragment(decoded))), {
            onSuccess: Exit.succeed,
            onFailure: (cause) =>
              Exit.failCause(
                Cause.fromReasons(
                  A.map(cause.reasons, (reason) =>
                    Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                  )
                )
              ),
          }),
          Cause.fail("HtmlPolicyError")
        );
      }
    })
  );

  it.effect("denies active, foreign, form, data, event, style, and broad global attributes", () =>
    Effect.gen(function* () {
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
        const proof = yield* conform(node);
        expect(inspectSafeHtml(proof).length).toBeGreaterThan(0);
      }
    })
  );

  it.effect("accepts inert insertion semantics with safe cite and datetime attributes", () =>
    Effect.gen(function* () {
      const insertion = fragment(
        Ins.make({
          cite: O.some("https://example.com/change"),
          datetime: O.some("2026-07-29"),
          children: [text("added")],
        })
      );
      yield* conform(insertion).pipe(Effect.flatMap(enforceSafeHtml));

      const unsafeCitation = fragment(
        Ins.make({
          cite: O.some("javascript:alert(1)"),
          children: [text("added")],
        })
      );
      assertExitFailure(
        Exit.match(yield* conform(unsafeCitation).pipe(Effect.flatMap(enforceSafeHtml), Effect.exit), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlPolicyError")
      );
    })
  );

  it.effect("checks element attributes whose names overlap AST structural fields", () =>
    Effect.gen(function* () {
      const safe = fragment(
        Data.make({ value: O.some("42"), children: [text("answer")] }),
        Ol.make({
          children: [Li.make({ value: O.some(-2), children: [text("item")] })],
        })
      );
      yield* conform(safe).pipe(Effect.flatMap(enforceSafeHtml));

      const legacyImageName = Img.make({
        alt: O.some("logo"),
        name: O.some("unsafe-legacy-name"),
        src: O.some("/logo.png"),
      });
      expect(inspectConformance(legacyImageName)).toContainEqual(
        expect.objectContaining({ rule: "obsoleteAttribute" })
      );
      assertExitFailure(
        Exit.match(yield* Effect.exit(conform(legacyImageName)), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlConformanceError")
      );
    })
  );
});

describe("@beep/html canonical serialization", () => {
  it.effect("escapes text and attributes and emits deterministic attribute order", () =>
    Effect.gen(function* () {
      const node = Anchor.make({
        class: O.some('a"b'),
        href: O.some("/docs?a=1&b=2"),
        id: O.some("link"),
        rel: O.some("noopener noreferrer"),
        target: O.some("_blank"),
        children: [text("<go>")],
      });
      expect(yield* serialize(node).pipe(Effect.map(untrustedHtmlValue))).toBe(
        '<a class="a&quot;b" href="/docs?a=1&amp;b=2" id="link" rel="noopener noreferrer" target="_blank">&lt;go&gt;</a>'
      );
      expect(yield* serialize(Input.make({ disabled: O.some("") })).pipe(Effect.map(untrustedHtmlValue))).toBe(
        "<input disabled>"
      );
      expect(
        yield* serialize(
          Div.make({
            autofocus: O.some(""),
            headingreset: O.some(""),
            inert: O.some(""),
            itemscope: O.some(""),
            children: [],
          })
        ).pipe(Effect.map(untrustedHtmlValue))
      ).toBe("<div autofocus headingreset inert itemscope></div>");
    })
  );

  it.effect("serializes real content, name, and value attributes without structural-field loss", () =>
    Effect.gen(function* () {
      const root = fragment(
        Data.make({ value: O.some("42"), children: [text("answer")] }),
        Ol.make({
          children: [Li.make({ value: O.some(-2), children: [text("item")] })],
        }),
        Meta.make({ content: O.some("text/html") }),
        Input.make({ name: O.some("query"), value: O.some("beep") }),
        Button.make({ name: O.some("action"), value: O.some("save"), children: [text("Save")] })
      );

      expect(yield* serialize(root).pipe(Effect.map(untrustedHtmlValue))).toBe(
        '<data value="42">answer</data><ol><li value="-2">item</li></ol><meta content="text/html"><input name="query" value="beep"><button name="action" value="save">Save</button>'
      );

      const safeRoot = fragment(
        Data.make({ value: O.some("42"), children: [text("answer")] }),
        Ol.make({
          children: [Li.make({ value: O.some(-2), children: [text("item")] })],
        })
      );
      const html = yield* conform(safeRoot).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe));
      expect(safeHtmlValue(html)).toBe('<data value="42">answer</data><ol><li value="-2">item</li></ol>');
    })
  );

  it.effect("sorts dataset and losslessly preserves escaped foreign attributes", () =>
    Effect.gen(function* () {
      expect(
        yield* serialize(
          Div.make({
            dataset: O.some({ zed: "2", alpha: "1" }),
            children: [],
          })
        ).pipe(Effect.map(untrustedHtmlValue))
      ).toBe('<div data-alpha="1" data-zed="2"></div>');

      const foreign = ForeignElement.make({
        namespace: "svg",
        name: "svg",
        attributes: O.some({ viewBox: "0 0 1 1", fill: "none" }),
        children: [text("<label>"), Comment.make({ value: "foreign note" })],
      });
      expect(yield* serialize(foreign).pipe(Effect.map(untrustedHtmlValue))).toBe(
        '<svg fill="none" viewBox="0 0 1 1">&lt;label&gt;<!--foreign note--></svg>'
      );

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
      expect(yield* serialize(active).pipe(Effect.map(untrustedHtmlValue))).toBe(
        '<svg href="javascript:alert(1)" onload="alert(&quot;x&quot;)" style="fill:red" xlink:href="data:image/svg+xml?a=1&amp;b=2"></svg>'
      );
    })
  );

  it.effect("rejects hostile foreign element names at decode time", () =>
    Effect.gen(function* () {
      const hostile = yield* Effect.exit(
        decodeForeignElement({
          _tag: "#foreign",
          namespace: "svg",
          name: 'svg onload="x"',
          children: [],
        })
      );
      assertExitFailure(
        Exit.match(hostile, {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("SchemaError")
      );
    })
  );

  it.effect("rejects scalar hazards, ambiguous comments, raw end tags, and plaintext", () =>
    Effect.gen(function* () {
      assertExitFailure(
        Exit.match(yield* Effect.exit(serialize(text("\u0000"))), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlSerializeError")
      );
      assertExitFailure(
        Exit.match(yield* Effect.exit(serialize(text("\uD800"))), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlSerializeError")
      );
      assertExitFailure(
        Exit.match(yield* Effect.exit(serialize(Div.make({ id: O.some("\u0000"), children: [] }))), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlSerializeError")
      );
      expect(isHtmlCommentData("safe note")).toBe(true);
      expect(isHtmlCommentData("-->")).toBe(false);
      expect(() => Comment.make({ value: "<!--" })).toThrow();
      assertExitFailure(
        Exit.match(yield* Effect.exit(serialize(Script.make({ content: "</script><img src=x>" }))), {
          onSuccess: Exit.succeed,
          onFailure: (cause) =>
            Exit.failCause(
              Cause.fromReasons(
                A.map(cause.reasons, (reason) =>
                  Cause.isFailReason(reason) ? Cause.makeFailReason(reason.error._tag) : reason
                )
              )
            ),
        }),
        Cause.fail("HtmlSerializeError")
      );
    })
  );
});

describe("@beep/html proof provenance", () => {
  it.effect("snapshots and freezes the proven tree before safe serialization", () =>
    Effect.gen(function* () {
      const anchor = Anchor.make({
        href: O.some("/safe"),
        children: [text("safe")],
      });
      const paragraph = P.make({ children: [text("nested")] });
      const source = fragment(anchor, paragraph);
      const conformant = yield* conform(source);
      const safeAst = yield* enforceSafeHtml(conformant);
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
      expect(issuedRoot._tag).toBe("#fragment");
      if (issuedRoot._tag === "#fragment") {
        expect(Object.isFrozen(issuedRoot.children)).toBe(true);
        const issuedAnchor = O.getOrThrow(A.head(issuedRoot.children));
        expect(Object.isFrozen(issuedAnchor)).toBe(true);
        expect(Reflect.set(issuedRoot.children, "0", injected)).toBe(false);
        expect(Reflect.set(issuedAnchor, "href", O.some("javascript:alert(1)"))).toBe(false);
        expect(Reflect.set(issuedAnchor, "style", O.some("display:none"))).toBe(false);
        expect(Reflect.set(issuedAnchor, "onclick", O.some("alert(1)"))).toBe(false);
      }

      const safeHtml = yield* serializeSafe(safeAst);
      expect(safeHtmlValue(safeHtml)).toBe('<a href="/safe">safe</a><p>nested</p>');
    })
  );

  it.effect("rejects prototype, spread, JSON, and plain-object proof forgeries", () =>
    Effect.gen(function* () {
      const conformant = yield* conform(fragment(P.make({ children: [text("safe")] })));
      const safeAst = yield* enforceSafeHtml(conformant);
      const safeHtml = yield* serializeSafe(safeAst);

      expect(isConformantHtml(conformant)).toBe(true);
      expect(isSafeHtmlAst(safeAst)).toBe(true);
      expect(isSafeHtml(safeHtml)).toBe(true);
      expect(ConformantHtml.is(conformant)).toBe(true);
      expect(SafeHtmlAst.is(safeAst)).toBe(true);
      expect(SafeHtml.is(safeHtml)).toBe(true);
      expect(ConformantHtml.is({ ...conformant })).toBe(false);
      expect(SafeHtmlAst.is({ ...safeAst })).toBe(false);
      expect(SafeHtml.is({ ...safeHtml })).toBe(false);
      expect(safeHtmlValue(safeHtml)).toBe("<p>safe</p>");

      for (const [schema, value] of [
        [ConformantHtml, conformant],
        [SafeHtmlAst, safeAst],
        [SafeHtml, safeHtml],
      ] as const) {
        expect(Object.getPrototypeOf(value)).toBeNull();
        expect(Reflect.get(value, "constructor")).toBeUndefined();
        expect(Object.keys(value)).toStrictEqual([]);
        const serialized = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(value);
        expect(serialized).toBe("{}");
        expect(S.is(schema)({ ...value })).toBe(false);
        expect(S.is(schema)(yield* S.decodeEffect(S.fromJsonString(S.Unknown))(serialized))).toBe(false);
        expect(S.is(schema)(Object.create(Object.getPrototypeOf(value)))).toBe(false);
        expect(S.is(schema)({})).toBe(false);
      }
    })
  );
});
