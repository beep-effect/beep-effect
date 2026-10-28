/**
 * Shared pieces for the scratch projection programs: the source Markdown AST
 * built with `@beep/md` constructors, the file sink, and the entry-point runner.
 */

import { Md } from "@beep/md/Md";
import type { Document as MdDocument } from "@beep/md/Md.model";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

// ---------------------------------------------------------------------------
// Input schema shared by every projection program.
// ---------------------------------------------------------------------------

export class PageSpec extends S.Class<PageSpec, { readonly brand: unique symbol }>("PageSpec")({
  title: S.NonEmptyString,
  lang: S.NonEmptyString,
  outputPath: S.NonEmptyString,
}) {}

/**
 * Builds the spec for one program: `argv[2]` overrides the default output path.
 */
export const specFor = (defaultOutputPath: string): PageSpec =>
  PageSpec.make({
    title: "Schema-first Markdown projections",
    lang: "en",
    outputPath: A.get(process.argv, 2).pipe(O.getOrElse(() => defaultOutputPath)),
  });

// ---------------------------------------------------------------------------
// Source document, built only with @beep/md constructors.
// ---------------------------------------------------------------------------

export const markdownDocument: MdDocument = Md.make(
  [
    Md.h1("Schema-first Markdown projections"),
    Md.p([
      "This document was built as a ",
      Md.strong("Markdown AST"),
      " with ",
      Md.code("@beep/md"),
      " and projected onto a target model before serialization.",
    ]),
    Md.h2("Targets"),
    Md.ol([
      Md.li([Md.code("@beep/html"), " via ", Md.code("Document.toHtml")]),
      Md.li([Md.code("@beep/lexical-schema"), " via ", Md.code("documentToEditorState")]),
      Md.li([Md.code("@beep/pandoc-ast"), " via ", Md.code("documentToPandoc")]),
      Md.li(["Markdown text via ", Md.code("Md.render")]),
    ]),
    Md.h2("Stages"),
    Md.table(
      [
        ["Stage", "Package", "Output"],
        ["Model", "@beep/md", "Document"],
        ["Projection", "target package", "target model"],
        ["Serialization", "target package", "text"],
      ],
      { headerRow: true, align: ["left", "left", "left"] }
    ),
    Md.h2("Example"),
    Md.pre(
      A.join(
        ['import { Md } from "@beep/md/Md"', "", 'const doc = Md.make([Md.p(["Hello, ", Md.em("world")])])'],
        "\n"
      ),
      { language: "ts" }
    ),
    Md.admonition("tip", [Md.p("Raw HTML and raw Markdown nodes never enter a safe projection.")], {
      title: "Safety",
    }),
    Md.blockquote([Md.p(["Each target owns its own ", Md.em("conformance"), " and serialization rules."])]),
    Md.hr,
    Md.p(["Source: ", Md.a("https://github.com/beep-effect/beep-effect", "beep-effect"), "."]),
  ],
  { frontmatter: { generator: "scratchpad/temp" } }
);

// ---------------------------------------------------------------------------
// File sink.
// ---------------------------------------------------------------------------

export const writeTextFile = Effect.fn("writeTextFile")(function* (outputPath: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.resolve(outputPath);
  yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
  yield* fs.writeFileString(absolute, text);
  yield* Effect.log(`wrote ${absolute} (${text.length} chars)`);
  return absolute;
});

// ---------------------------------------------------------------------------
// Entry point: compose the platform layer once and run inside its scope.
// ---------------------------------------------------------------------------

export const runScratch = <E>(program: Effect.Effect<unknown, E, FileSystem.FileSystem | Path.Path>): void =>
  BunRuntime.runMain(
    program.pipe(Layer.effectDiscard, Layer.provide(BunServices.layer), Layer.build, Effect.scoped)
  );
