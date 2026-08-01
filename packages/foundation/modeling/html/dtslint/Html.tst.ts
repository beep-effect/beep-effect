import {
  conform,
  ELEMENT_META,
  enforceSafeHtml,
  HTML_ATTRIBUTE_SYNTAXES,
  Html,
  HtmlDocument,
  HtmlFiniteNumber,
  HtmlFragment,
  HtmlIdValue,
  HtmlNonNegativeNumber,
  HtmlPositiveNumber,
  serialize,
  serializeSafe,
} from "@beep/html";
import { AutocompleteAttribute as SubpathAutocompleteAttribute } from "@beep/html/Html.attributes";
import { ConformantHtml as SubpathConformantHtml } from "@beep/html/Html.conformance";
import { HtmlFragment as SubpathHtmlFragment } from "@beep/html/Html.contract";
import { HtmlTag as SubpathHtmlTag } from "@beep/html/Html.meta";
import {
  Button,
  Div,
  Html as HtmlElement,
  Input,
  Li,
  Link,
  Document as LosslessDocument,
  Meter,
  Ol,
  Progress,
  Track,
} from "@beep/html/Html.model";
import { Comment } from "@beep/html/Html.nodes";
import { SafeHtmlAst as SubpathSafeHtmlAst } from "@beep/html/Html.policy";
import { SafeHtml as SubpathSafeHtml } from "@beep/html/Html.serialize";
import { Effect } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  ConformantHtml,
  ConformantHtmlNode,
  HtmlAttributeSyntax,
  HtmlChildNode,
  HtmlConformanceError,
  HtmlDocumentChild,
  HtmlElementMeta,
  HtmlPolicyError,
  HtmlSerializeError,
  HtmlTag,
  SafeHtml,
  SafeHtmlAst,
  SafeHtmlNode,
  UntrustedHtml,
} from "@beep/html";

describe("@beep/html contract", () => {
  it("resolves every curated contract subpath", () => {
    expect(SubpathAutocompleteAttribute).type.toBe<typeof SubpathAutocompleteAttribute>();
    expect(SubpathConformantHtml).type.toBe<typeof SubpathConformantHtml>();
    expect(SubpathHtmlFragment).type.toBe<typeof SubpathHtmlFragment>();
    expect(SubpathHtmlTag).type.toBe<typeof SubpathHtmlTag>();
    expect(HtmlElement).type.toBe<typeof HtmlElement>();
    expect(Comment).type.toBe<typeof Comment>();
    expect(SubpathSafeHtmlAst).type.toBe<typeof SubpathSafeHtmlAst>();
    expect(SubpathSafeHtml).type.toBe<typeof SubpathSafeHtml>();
    expect(HtmlFiniteNumber).type.toBe<typeof HtmlFiniteNumber>();
    expect(HtmlNonNegativeNumber).type.toBe<typeof HtmlNonNegativeNumber>();
    expect(HtmlPositiveNumber).type.toBe<typeof HtmlPositiveNumber>();
    expect(HtmlIdValue).type.toBe<typeof HtmlIdValue>();
  });

  it("exposes canonical child and root role names", () => {
    const fragment = HtmlFragment.make({ children: [] });
    const documentElement = HtmlElement.make({ children: [] });
    const comment = Comment.make({ value: "note" });
    const document = HtmlDocument.make({ children: [comment, documentElement] });
    const diagnosticDocument = LosslessDocument.make({ children: [Div.make({ children: [] })] });

    expect(fragment).type.toBe<HtmlFragment>();
    expect(document).type.toBe<HtmlDocument>();
    expect(document.children).type.toBe<ReadonlyArray<HtmlDocumentChild>>();
    expect(diagnosticDocument).type.toBe<LosslessDocument>();
    expect(documentElement).type.toBeAssignableTo<HtmlDocumentChild>();
    expect(comment).type.toBeAssignableTo<HtmlDocumentChild>();
    expect(comment).type.toBeAssignableTo<HtmlChildNode>();

    HtmlDocument.make({
      children: [
        // @ts-expect-error!
        Div.make({ children: [] }),
      ],
    });
  });

  it("keeps proof and serializer error channels explicit", () => {
    const fragment = HtmlFragment.make({ children: [] });
    const conformant = conform(fragment);

    expect(Html.Conformant.decode(fragment)).type.toBe<typeof conformant>();
    expect(conformant).type.toBe<Effect.Effect<ConformantHtmlNode, HtmlConformanceError>>();
    expect(conformant.pipe(Effect.flatMap(Html.Safe.decode))).type.toBe<
      Effect.Effect<SafeHtmlNode, HtmlConformanceError | HtmlPolicyError>
    >();
    expect(conformant.pipe(Effect.flatMap(enforceSafeHtml))).type.toBe<
      Effect.Effect<SafeHtmlNode, HtmlConformanceError | HtmlPolicyError>
    >();
    expect(serialize(fragment)).type.toBe<Effect.Effect<UntrustedHtml, HtmlSerializeError>>();
    expect(conformant.pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe))).type.toBe<
      Effect.Effect<SafeHtml, HtmlConformanceError | HtmlPolicyError | HtmlSerializeError>
    >();
  });

  it("publishes metadata as the exact record contract", () => {
    expect(ELEMENT_META).type.toBe<Readonly<Record<HtmlTag, HtmlElementMeta>>>();
    expect(HTML_ATTRIBUTE_SYNTAXES).type.toBe<Readonly<Record<string, HtmlAttributeSyntax>>>();
  });

  it("publishes the signed integer li value domain", () => {
    const item = Li.make({ children: [], value: O.some(-2) });
    expect(item.value).type.toBe<O.Option<number>>();
  });

  it("separates encoded enumerated keywords from canonical semantic values", () => {
    const encodedLink: Link.Encoded = { _tag: "link", as: "IMAGE" };
    const link = Link.make({ as: O.some("image") });
    const encodedList: Ol.Encoded = { _tag: "ol", children: [], type: "A" };
    const list = Ol.make({ children: [], type: O.some("A") });

    expect(encodedLink.as).type.toBe<string | undefined>();
    expect(link.as).type.toBe<
      O.Option<
        | "audioworklet"
        | "fetch"
        | "font"
        | "image"
        | "json"
        | "paintworklet"
        | "script"
        | "serviceworker"
        | "sharedworker"
        | "style"
        | "text"
        | "track"
        | "worker"
      >
    >();
    expect(encodedList.type).type.toBe<"1" | "a" | "A" | "i" | "I" | undefined>();
    expect(list.type).type.toBe<O.Option<"1" | "a" | "A" | "i" | "I">>();
  });

  it("publishes finite numeric meter and progress fields", () => {
    const meter = Meter.make({ children: [], max: O.some(1.5), min: O.some(-1), value: O.some(0.25) });
    const progress = Progress.make({ children: [], max: O.some(2.5), value: O.some(1.25) });
    const encodedMeter: Meter.Encoded = { _tag: "meter", children: [], value: 0.25 };
    const encodedProgress: Progress.Encoded = { _tag: "progress", children: [], max: 2.5 };

    expect(meter.value).type.toBe<O.Option<number>>();
    expect(progress.max).type.toBe<O.Option<number>>();
    expect(encodedMeter.value).type.toBe<number | undefined>();
    expect(encodedProgress.max).type.toBe<number | undefined>();
  });

  it("keeps track srclang lossless while publishing its conformance syntax", () => {
    const encoded: Track.Encoded = { _tag: "track", src: "/captions.vtt", srclang: "i-klingon" };
    const decoded = Track.make({ src: O.some("/captions.vtt"), srclang: O.some("en-US") });

    expect(encoded.srclang).type.toBe<string | undefined>();
    expect(decoded.srclang).type.toBe<O.Option<string>>();
    expect(HTML_ATTRIBUTE_SYNTAXES["track/srclang"]).type.toBe<HtmlAttributeSyntax | undefined>();
  });

  it("scopes popover invoker attributes to button and input elements", () => {
    const button = Button.make({ children: [], popovertarget: O.some("menu") });
    const input = Input.make({ popovertargetaction: O.some("show") });
    expect(button.popovertarget).type.toBe<O.Option<string>>();
    expect(input.popovertargetaction).type.toBe<O.Option<"toggle" | "show" | "hide">>();

    Div.make({
      children: [],
      // @ts-expect-error!
      popovertarget: O.some("menu"),
    });
  });

  it("does not allow plain strings to satisfy opaque safe HTML", () => {
    // @ts-expect-error!
    const unsafe: SafeHtml = "<p>unsafe</p>";
    expect(unsafe).type.toBe<SafeHtml>();
  });

  it("rejects structural and cross-proof forgery", () => {
    // @ts-expect-error!
    const forgedConformant: ConformantHtml = {};
    // @ts-expect-error!
    const forgedSafeAst: SafeHtmlAst = {};
    // @ts-expect-error!
    const forgedSafeHtml: SafeHtml = {};

    // @ts-expect-error!
    const safeAstFromConformant: SafeHtmlAst = forgedConformant;
    // @ts-expect-error!
    const safeHtmlFromSafeAst: SafeHtml = forgedSafeAst;
    // @ts-expect-error!
    const conformantFromSafeHtml: ConformantHtml = forgedSafeHtml;

    // @ts-expect-error!
    const spreadConformant: ConformantHtml = { ...forgedConformant };
    // @ts-expect-error!
    const spreadSafeAst: SafeHtmlAst = { ...forgedSafeAst };
    // @ts-expect-error!
    const spreadSafeHtml: SafeHtml = { ...forgedSafeHtml };

    expect(forgedConformant).type.toBe<ConformantHtml>();
    expect(forgedSafeAst).type.toBe<SafeHtmlAst>();
    expect(forgedSafeHtml).type.toBe<SafeHtml>();
    expect(safeAstFromConformant).type.toBe<SafeHtmlAst>();
    expect(safeHtmlFromSafeAst).type.toBe<SafeHtml>();
    expect(conformantFromSafeHtml).type.toBe<ConformantHtml>();
    expect(spreadConformant).type.toBe<ConformantHtml>();
    expect(spreadSafeAst).type.toBe<SafeHtmlAst>();
    expect(spreadSafeHtml).type.toBe<SafeHtml>();
  });
});
