/**
 * Scratch program: build a Markdown AST with `@beep/md` constructors, project it
 * onto the `@beep/html` model, prove the projected content against the safe
 * output policy, wrap it in a full page shell, canonically serialize the shell,
 * and write the result to an `.html` file.
 *
 * The safe policy (`enforceSafeHtml`) is deny-by-default for injectable
 * fragments, so it rejects `<html>`, `<head>`, `<meta>`, `<title>` and `<body>`.
 * The content fragment is therefore proven on its own, and the page shell is
 * serialized through `conform -> serializeConformant`.
 *
 * Run: `bun scratchpad/temp/index.ts [output-path]`
 */

import { conform, enforceSafeHtml, serializeConformant, untrustedHtmlValue } from "@beep/html";
import type { HtmlConformanceError, HtmlPolicyError, HtmlSerializeError, SafeHtmlAst, UntrustedHtml } from "@beep/html";
import * as HtmlModel from "@beep/html/Html.model";
import { Doctype } from "@beep/html/Html.nodes";
import { Document as MdDocument } from "@beep/md/Md.model";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import { markdownDocument, type PageSpec, runScratch, specFor, writeTextFile } from "./shared.ts";

// ---------------------------------------------------------------------------
// Projection: Md.Document -> proven Html fragment -> Html.model Document shell.
// ---------------------------------------------------------------------------

const proveContent: (
  fragment: HtmlModel.Fragment
) => Effect.Effect<SafeHtmlAst, HtmlConformanceError | HtmlPolicyError> = flow(conform, Effect.flatMap(enforceSafeHtml));

const wrapInPageShell = (spec: PageSpec, content: HtmlModel.Fragment): HtmlModel.Document =>
  HtmlModel.Document.make({
    doctype: O.some(Doctype.html()),
    children: [
      HtmlModel.Html.make({
        lang: O.some(spec.lang),
        children: [
          HtmlModel.Head.make({
            children: [
              HtmlModel.Meta.make({ charset: O.some("utf-8") }),
              HtmlModel.Title.make({ content: spec.title }),
            ],
          }),
          HtmlModel.Body.make({
            children: [HtmlModel.Main.make({ children: content.children })],
          }),
        ],
      }),
    ],
  });

const projectToHtmlDocument = Effect.fn("projectToHtmlDocument")(function* (spec: PageSpec, document: MdDocument) {
  const content = MdDocument.toHtml(document);
  yield* proveContent(content);
  return wrapInPageShell(spec, content);
});

// ---------------------------------------------------------------------------
// Serialization of the page shell: conform -> serializeConformant.
// ---------------------------------------------------------------------------

const serializeDocument: (
  root: HtmlModel.Document
) => Effect.Effect<UntrustedHtml, HtmlConformanceError | HtmlSerializeError> = flow(
  conform,
  Effect.flatMap(serializeConformant)
);

// ---------------------------------------------------------------------------
// Program.
// ---------------------------------------------------------------------------

const program = Effect.fn("renderHtmlPage")(function* () {
  const spec = specFor("scratchpad/temp/out/index.html");
  const htmlDocument = yield* projectToHtmlDocument(spec, markdownDocument);
  const html = yield* serializeDocument(htmlDocument);
  yield* writeTextFile(spec.outputPath, untrustedHtmlValue(html));
});

runScratch(program());
