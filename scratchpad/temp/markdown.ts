/**
 * Scratch program: build a Markdown AST with `@beep/md` constructors, render it
 * back to canonical Markdown text through the Markdown adapter, and write it to
 * a `.md` file.
 *
 * Run: `bun scratchpad/temp/markdown.ts [output-path]`
 */

import { Md } from "@beep/md/Md";
import type { Document as MdDocument } from "@beep/md/Md.model";
import type { RenderError } from "@beep/md/Md.render";
import type { Markdown } from "@beep/schema";
import * as Effect from "effect/Effect";
import { markdownDocument, runScratch, specFor, writeTextFile } from "./shared.ts";

// Projection + serialization: Md.Document -> Markdown text. `Md.render` returns a
// Result; lift it into Effect so RenderError stays in the typed error channel.
const renderMarkdown = (document: MdDocument): Effect.Effect<Markdown, RenderError> =>
  Effect.fromResult(Md.render(document));

const program = Effect.fn("renderMarkdownText")(function* () {
  const spec = specFor("scratchpad/temp/out/index.md");
  const markdown = yield* renderMarkdown(markdownDocument);
  yield* writeTextFile(spec.outputPath, markdown);
});

runScratch(program());
