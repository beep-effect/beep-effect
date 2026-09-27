import { decodePandocJsonString, encodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec";
import { documentToPandoc, pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

const fixture = Effect.fn("PandocIntegrationTest.fixture")((name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(new URL(`../fixtures/${name}`, import.meta.url).pathname);
  })
);

describe("Pandoc integration", () => {
  it.layer(BunFileSystem.layer)("maps a committed fixture through Pandoc, Md, and JSON boundaries", (it) => {
    it.effect("maps a committed fixture through Pandoc, Md, and JSON boundaries", () =>
      Effect.gen(function* () {
        const source = yield* fixture("green-core.pandoc.json");
        const pandoc = yield* decodePandocJsonString(source);
        const mapped = yield* pandocToDocument(pandoc);
        const projected = yield* documentToPandoc(mapped.document);
        const encoded = yield* encodePandocJsonString(projected.pandoc);
        const roundTripped = yield* decodePandocJsonString(encoded);

        expect(mapped.report.profile).toBe("supported");
        expect(projected.report.profile).toBe("supported");
        expect(roundTripped.blocks.length).toBe(projected.pandoc.blocks.length);
      })
    );
  });
});
