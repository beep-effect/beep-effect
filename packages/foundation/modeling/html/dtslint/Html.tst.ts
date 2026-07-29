import {
  conform,
  ELEMENT_META,
  enforceSafeHtml,
  Html,
  HtmlDocument,
  HtmlFragment,
  serialize,
  serializeSafe,
} from "@beep/html";
import { AutocompleteAttribute as SubpathAutocompleteAttribute } from "@beep/html/Html.attributes";
import { ConformantHtml as SubpathConformantHtml } from "@beep/html/Html.conformance";
import { HtmlFragment as SubpathHtmlFragment } from "@beep/html/Html.contract";
import { HtmlTag as SubpathHtmlTag } from "@beep/html/Html.meta";
import { Html as HtmlElement, Li } from "@beep/html/Html.model";
import { Comment } from "@beep/html/Html.nodes";
import { SafeHtmlAst as SubpathSafeHtmlAst } from "@beep/html/Html.policy";
import { SafeHtml as SubpathSafeHtml } from "@beep/html/Html.serialize";
import { Effect } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  ConformantHtmlNode,
  HtmlChildNode,
  HtmlConformanceError,
  HtmlDocumentChild,
  HtmlElementMeta,
  HtmlPolicyError,
  HtmlSerializeError,
  HtmlTag,
  SafeHtml,
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
  });

  it("exposes canonical child and root role names", () => {
    const fragment = HtmlFragment.make({ children: [] });
    const document = HtmlDocument.make({ children: [] });
    const documentElement = HtmlElement.make({ children: [] });
    const comment = Comment.make({ value: "note" });

    expect(fragment).type.toBe<HtmlFragment>();
    expect(document).type.toBe<HtmlDocument>();
    expect(documentElement).type.toBeAssignableTo<HtmlDocumentChild>();
    expect(comment).type.toBeAssignableTo<HtmlDocumentChild>();
    expect(comment).type.toBeAssignableTo<HtmlChildNode>();
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
  });

  it("publishes the signed integer li value domain", () => {
    const item = Li.make({ children: [], value: O.some(-2) });
    expect(item.value).type.toBe<O.Option<number>>();
  });

  it("does not allow plain strings to satisfy opaque safe HTML", () => {
    // @ts-expect-error!
    const unsafe: SafeHtml = "<p>unsafe</p>";
    expect(unsafe).type.toBe<SafeHtml>();
  });
});
