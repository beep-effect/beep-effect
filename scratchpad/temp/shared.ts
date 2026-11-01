/**
 * Shared pieces for the scratch projection programs: the source Markdown AST
 * built with `@beep/md` constructors, the file sink, and the entry-point runner.
 *
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";

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

const $I = $ScratchpadId.create("temp/shared");

// ---------------------------------------------------------------------------
// Input schema shared by every projection program.
// ---------------------------------------------------------------------------

/**
 * Page metadata and output location every projection program writes against.
 *
 * **Example** (Describe an HTML page)
 *
 * ```ts
 * import { PageSpec } from "@beep/scratchpad/temp/shared"
 *
 * const spec = PageSpec.make({ title: "Release notes", lang: "en", outputPath: "out/index.html" })
 * console.log(spec.outputPath) // "out/index.html"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageSpec extends S.Class<PageSpec, { readonly brand: unique symbol }>($I`PageSpec`)(
  {
    title: S.NonEmptyString,
    lang: S.NonEmptyString,
    outputPath: S.NonEmptyString,
  },
  $I.annote("PageSpec", {
    description: "Page metadata and output location every projection program writes against.",
  })
) {}

/**
 * Builds the spec for one program: `argv[2]` overrides the default output path.
 *
 * **Example** (Resolve the output path for the HTML projection)
 *
 * ```ts
 * import { specFor } from "@beep/scratchpad/temp/shared"
 *
 * // `bun scratchpad/temp/index.ts` with no argument keeps the default path.
 * const spec = specFor("scratchpad/temp/out/index.html")
 * console.log(spec.title) // "Schema-first Markdown projections"
 * ```
 *
 * @category constructors
 * @since 0.0.0
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

/**
 * The source Markdown AST every projection program serializes.
 *
 * **Details**
 *
 * It covers headings, inline marks, an ordered list, an aligned table, a code
 * block, an admonition, a blockquote, a rule and a link, so each target's
 * projection exercises its common node kinds.
 *
 * **Example** (Render the source document back to Markdown)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
 * import { markdownDocument } from "@beep/scratchpad/temp/shared"
 *
 * const rendered = Md.render(markdownDocument)
 * console.log(rendered._tag) // "Success"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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

/**
 * Write text to a file, creating its parent directories first.
 *
 * **Details**
 *
 * The path resolves against the current working directory, and the effect
 * logs and returns the absolute path it wrote.
 *
 * **Example** (Write a rendered page)
 *
 * ```ts
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { writeTextFile } from "@beep/scratchpad/temp/shared"
 * import * as Effect from "effect/Effect"
 *
 * const program = writeTextFile("scratchpad/temp/out/index.md", "# Hello\n").pipe(
 *   Effect.provide(BunServices.layer)
 * )
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
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

/**
 * Run a scratch program as the process entry point with the Bun platform services.
 *
 * **Details**
 *
 * The program runs inside a scoped layer built over `BunServices.layer`, so
 * its file system and path requirements are satisfied once, and
 * `BunRuntime.runMain` owns exit codes and interruption.
 *
 * **Example** (Run a projection program)
 *
 * ```ts
 * import { markdownDocument, runScratch, specFor, writeTextFile } from "@beep/scratchpad/temp/shared"
 * import { Md } from "@beep/md/Md"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const spec = specFor("scratchpad/temp/out/index.md")
 *   const markdown = yield* Effect.fromResult(Md.render(markdownDocument))
 *   yield* writeTextFile(spec.outputPath, markdown)
 * })
 *
 * runScratch(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runScratch = <E>(program: Effect.Effect<unknown, E, FileSystem.FileSystem | Path.Path>): void =>
  BunRuntime.runMain(
    program.pipe(Layer.effectDiscard, Layer.provide(BunServices.layer), Layer.build, Effect.scoped)
  );
