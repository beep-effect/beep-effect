import { decodePandocJsonString, encodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec";
import { documentToPandoc, pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const PandocDocumentEquivalence = S.toEquivalence(PandocDocument);

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
        assertTrue(PandocDocumentEquivalence(roundTripped, projected.pandoc));
      })
    );
  });
});
