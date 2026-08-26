import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";

const DEFAULT_OUTPUT_DIRECTORY = "fixtures/f1/documents";

const unicodeDocument = A.join(
  [
    "# Unicode Span Fidelity Notes",
    "",
    "## Abstract",
    "",
    "Lina Orre, affiliated with the fictional Blueglass Archive, proposed the Paired Glyph Method.",
    "The method compares Café in NFC with Cafe\u0301 in NFD inside the invented Twin Accent Dataset.",
    "",
    "## Boundary probes",
    "",
    "Emoji sequence: 🧑🏽‍🔬 observes 🛰️.",
    "Right-to-left run: مرحبا بالعالم داخل السجل.",
    "Zero-width joiner sequence: field‍station.",
    "",
    "Lina Orre authored the Paired Glyph Method; Blueglass Archive maintains the Twin Accent Dataset.",
    "",
  ],
  "\r\n"
);

const invalidPrefix = new TextEncoder().encode(
  "# Invalid UTF-8 Relation Note\n\nAven Dusk, affiliated with the fictional Keelstone Center, proposed the Split Byte Method.\n\nInjected byte pair: "
);
const invalidSequence = new Uint8Array([0xc3, 0x28]);
const invalidSuffix = new TextEncoder().encode(
  "\n\nKeelstone Center maintains the invented Broken Rune Dataset used by Aven Dusk.\n"
);
const invalidDocument = Uint8Array.from(
  A.flatten([A.fromIterable(invalidPrefix), A.fromIterable(invalidSequence), A.fromIterable(invalidSuffix)])
);

/**
 * Writes the CRLF Unicode fixture and the deliberately invalid UTF-8 Markdown bytes.
 *
 * **Example** (Build a generator effect)
 *
 * ```ts
 * import { generateF1TextFixtures } from "../scripts/generate-f1-text"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(generateF1TextFixtures("/tmp/f1"))) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const generateF1TextFixtures = Effect.fn("generateF1TextFixtures")(function* (outputDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(outputDirectory, { recursive: true });
  yield* fs.writeFile(path.join(outputDirectory, "md-unicode.md"), new TextEncoder().encode(unicodeDocument));
  yield* fs.writeFile(path.join(outputDirectory, "md-invalid-utf8.md"), invalidDocument);
});

if (import.meta.main) {
  BunRuntime.runMain(
    Effect.scoped(
      Layer.build(BunServices.layer).pipe(
        Effect.flatMap((context) => generateF1TextFixtures(DEFAULT_OUTPUT_DIRECTORY).pipe(Effect.provide(context)))
      )
    )
  );
}
