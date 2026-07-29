import { Md } from "@beep/md";
import { blockquote, h1 } from "@beep/md/Md";
import { escapeMarkdownText } from "@beep/md/Md.escape";
import { renderSafeHtml, safeHtmlValue } from "@beep/md/Md.html";
import { MarkdownAdapter, PlainTextAdapter, renderEffectWith, renderPlainText, renderWith } from "@beep/md/Md.render";
import { refineSafeDocument } from "@beep/md/Md.safe";
import { Effect, Result } from "effect";
import { describe, expect, it } from "tstyche";
import type { SafeHtml } from "@beep/html";
import type { Block, Document, Heading } from "@beep/md/Md.model";
import type { RenderError } from "@beep/md/Md.render";
import type { DocumentSafetyViolation, SafeDocument } from "@beep/md/Md.safe";
import type { Markdown } from "@beep/schema";

describe("@beep/md package exports", () => {
  it("resolves root and explicit subpath exports through the package map", () => {
    const document = Md.make([h1`Hello`, blockquote`${Md.h2("Nested")}`]);
    const effectAdapter = {
      name: "bytes",
      render: () => Effect.succeed(new Uint8Array()),
    };

    expect(document).type.toBe<Document>();
    expect(h1`Hello`).type.toBe<Heading>();
    expect(blockquote`${Md.h2("Nested")}`).type.toBeAssignableTo<Block>();
    expect(renderWith(MarkdownAdapter, document)).type.toBe<Result.Result<Markdown, RenderError>>();
    expect(renderWith(PlainTextAdapter, document)).type.toBe<Result.Result<string, RenderError>>();
    expect(renderPlainText(document)).type.toBe<Result.Result<string, RenderError>>();
    expect(renderEffectWith(effectAdapter, document)).type.toBeAssignableTo<
      Effect.Effect<Uint8Array, RenderError, never>
    >();
    expect(escapeMarkdownText("#")).type.toBe<string>();
    expect(refineSafeDocument(document)).type.toBe<
      Result.Result<SafeDocument, ReadonlyArray<DocumentSafetyViolation>>
    >();
    const safeDocument = Result.getOrThrow(refineSafeDocument(document));
    expect(renderSafeHtml(safeDocument)).type.toBe<SafeHtml>();
    expect(safeHtmlValue(renderSafeHtml(safeDocument))).type.toBe<string>();
  });
});
