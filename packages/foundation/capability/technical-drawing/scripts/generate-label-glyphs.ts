#!/usr/bin/env bun

/**
 * Generator for `src/internal/LabelGlyphs.ts`, the vendored sheet-label glyph
 * outlines of one sans and one serif face.
 *
 * **Details**
 *
 * Reads two TrueType files, by default the Liberation Sans and Serif 2.1.5
 * files under `/usr/share/fonts/liberation/` (override with
 * `bun run scripts/generate-label-glyphs.ts <sans.ttf> <serif.ttf>`). It
 * outlines the label alphabet through `outlineFontFile`, the function the
 * `fontFile` label route calls, and writes the module with a provenance header
 * (sha256). `bun run generate` writes and
 * formats the file; `bun run generate:check` fails when the committed file
 * differs without rewriting it. Recipe: goals/design-figure-review-loop/research/label-glyphs.md.
 *
 * @since 0.0.0
 */

import { CodegenKit, GeneratedModule } from "@beep/codegen-kit";
import { A, R } from "@beep/utils";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { outlineFontFile } from "../src/internal/LabelOutline.ts";
import type { LabelFace } from "../src/internal/LabelOutline.ts";

const DEFAULT_SANS = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf";
const DEFAULT_SERIF = "/usr/share/fonts/liberation/LiberationSerif-Regular.ttf";

const hexOf = (bytes: ArrayBuffer): string =>
  pipe(
    A.fromIterable(new Uint8Array(bytes)),
    A.map((b) => Str.padStart(2, "0")(b.toString(16))),
    A.join("")
  );

const load = Effect.fnUntraced(function* (fontFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(fontFile);
  const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return {
    face: yield* outlineFontFile(fontFile, bytes),
    sha256: hexOf(digest),
  };
});

const serialize = (face: LabelFace): string => {
  const glyphs = pipe(
    R.toEntries(face.glyphs),
    A.map(([char, glyph]) => {
      const commands = pipe(
        glyph.commands,
        A.map((command) =>
          Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(command), identity)
        ),
        A.join(", ")
      );
      return `    ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(char), identity)}: {\n      advance: ${glyph.advance},\n      ink: ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(glyph.ink), identity)},\n      commands: [${commands}],\n    },`;
    }),
    A.join("\n")
  );
  return `{\n  unitsPerEm: ${face.unitsPerEm},\n  capHeight: ${face.capHeight},\n  glyphs: {\n${glyphs}\n  },\n}`;
};

/**
 * Writes the rendered glyph module, or in check mode compares it against the
 * committed file without writing anything.
 *
 * **Details**
 *
 * Check mode delegates to `CodegenKit.checkModules`, which formats the rendered
 * content, prints the unified drift and fails with `CodegenDriftError` while
 * leaving the target untouched. Write mode replaces the target; `bun run
 * generate` then formats it.
 *
 * @since 0.0.0
 */
export const emitLabelGlyphs = Effect.fn("LabelGlyphGenerator.emit")(function* ({
  check,
  content,
  target,
}: {
  readonly check: boolean;
  readonly target: string;
  readonly content: string;
}) {
  if (check) {
    const kit = yield* CodegenKit;
    yield* kit.checkModules([GeneratedModule.make({ path: target, content })]);
    return yield* Effect.logInfo("Label glyph module is current; no files written.");
  }
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(target, content);
  yield* Effect.logInfo(`wrote ${target}`);
});

const program = Command.make(
  "generate-label-glyphs",
  {
    check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
    sans: Argument.String("sans").pipe(Argument.optional),
    serif: Argument.String("serif").pipe(Argument.optional),
  },
  Effect.fn("LabelGlyphGenerator.generate")(function* ({ check, sans: sansArgument, serif: serifArgument }) {
    const path = yield* Path.Path;
    const sansPath = O.getOrElse(sansArgument, () => DEFAULT_SANS);
    const serifPath = O.getOrElse(serifArgument, () => DEFAULT_SERIF);
    const sans = yield* load(sansPath);
    const serif = yield* load(serifPath);
    const target = path.join(import.meta.dirname, "..", "src", "internal", "LabelGlyphs.ts");
    const content = `/**
 * Generated label glyph outlines: the sheet-label alphabet (\`0\`-\`9\`, \`F\`,
 * \`I\`, \`G\`, \`.\`, \`/\`, space) of one sans and one serif face, in font units.
 *
 * **Details**
 *
 * Generated, do not edit. Generator: scripts/generate-label-glyphs.ts
 * (\`bun run generate\`); recipe: goals/design-figure-review-loop/research/label-glyphs.md.
 * This file is a modified subset of fonts licensed under the SIL Open Font
 * License 1.1 (see ../../licenses/OFL-1.1.txt for the copyright notices and
 * Reserved Font Names); it is distributed under that licence and is not
 * presented under any Reserved Font Name.
 *
 * Sources (sha256):
 * - sans: ${sans.sha256}
 * - serif: ${serif.sha256}
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { LabelFace } from "./LabelOutline.ts";

/**
 * Sans label face, metric-compatible with Arial.
 *
 * @internal
 * @since 0.0.0
 */
export const SANS_FACE = LabelFace.make(${serialize(sans.face)});

/**
 * Serif label face, metric-compatible with Times New Roman.
 *
 * @internal
 * @since 0.0.0
 */
export const SERIF_FACE = LabelFace.make(${serialize(serif.face)});
`;
    yield* emitLabelGlyphs({ check, target, content });
  })
);

const platform = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
const runtime = Layer.merge(platform, CodegenKit.layer().pipe(Layer.provide(platform)));
const main = runtime.pipe(
  Layer.build,
  Effect.flatMap((context) => Command.run(program, { version: "0.0.0" }).pipe(Effect.provide(context))),
  Effect.scoped
);

if (import.meta.main) {
  NodeRuntime.runMain(main);
}
