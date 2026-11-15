// Recorded replay for scripts/extract-gfm-corpora.ts. The synthetic spec's expected corpora were
// produced by upstream cmark-gfm `test/spec_tests.py --dump-tests` (0.29.0.gfm.13), reshaped as
// the former Python extractor did. The spec covers a disabled example, a header with an inner
// `#`, the `→` tab marker, a case-insensitive section filter and non-ASCII (BMP and astral)
// escapes. The committed corpora must also re-render to their exact bytes.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { filterSections, GfmExample, getTests, renderCorpus } from "../scripts/extract-gfm-corpora.ts";

const fixtures = "test/fixtures/gfm-extractor";
const decodeCorpus = S.decodeUnknownEffect(S.fromJsonString(S.Array(GfmExample)));

const readText = (path: string) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(path));

layer(NodeServices.layer)("extract-gfm-corpora", (it) => {
  describe("recorded upstream replay", () => {
    it.effect("scans every enabled example as spec_tests.py does", () =>
      Effect.gen(function* () {
        const spec = yield* readText(`${fixtures}/synthetic-spec.txt`);
        const expected = yield* readText(`${fixtures}/synthetic-all.json`);
        const rendered = yield* renderCorpus(getTests(spec));
        expect(rendered).toBe(expected);
      })
    );

    it.effect("filters sections with the case-insensitive extension pattern", () =>
      Effect.gen(function* () {
        const spec = yield* readText(`${fixtures}/synthetic-spec.txt`);
        const expected = yield* readText(`${fixtures}/synthetic-extension.json`);
        const rendered = yield* renderCorpus(filterSections("\\(extension\\)$")(getTests(spec)));
        expect(rendered).toBe(expected);
      })
    );
  });

  it.effect("re-renders the committed GFM corpora byte for byte", () =>
    Effect.forEach(["spec-extensions.json", "extensions.json"], (name) =>
      Effect.gen(function* () {
        const committed = yield* readText(`data/conformance/gfm/${name}`);
        const examples = yield* decodeCorpus(committed);
        const rendered = yield* renderCorpus(examples);
        expect(rendered).toBe(committed);
      })
    )
  );
});
