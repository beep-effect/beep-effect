/**
 * Scratch program: build a Markdown AST with `@beep/md` constructors, project it
 * onto the `@beep/pandoc-ast` document model, encode that model to Pandoc's
 * JSON wire format, and write it to a `.json` file.
 *
 * Run: `bun scratchpad/temp/pandoc.ts [output-path]`
 */

import { encodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec";
import { documentToPandoc } from "@beep/pandoc-ast/Pandoc.mapping";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { markdownDocument, runScratch, specFor, writeTextFile } from "./shared.ts";

// Projection: Md.Document -> Pandoc document plus a compatibility report.
const projectToPandoc = documentToPandoc;

// Serialization: Pandoc document -> Pandoc JSON string (codec-owned).
const serializePandoc = encodePandocJsonString;

const program = Effect.fn("renderPandocJson")(function* () {
  const spec = specFor("scratchpad/temp/out/index.pandoc.json");
  const { pandoc, report } = yield* projectToPandoc(markdownDocument);
  yield* Effect.log(`pandoc mapping profile: ${report.profile} (${report.issues.length} issues)`);
  yield* Effect.forEach(report.issues, (issue) => Effect.logWarning(`${issue.severity}: ${issue.message}`), {
    discard: true,
  });
  yield* Effect.log(`pandoc document has ${A.length(pandoc.blocks)} blocks`);
  const json = yield* serializePandoc(pandoc);
  yield* writeTextFile(spec.outputPath, json);
});

runScratch(program());
