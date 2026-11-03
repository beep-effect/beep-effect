import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationExtractorOrderingBinding,
  makeCitationExtractorOrdering,
} from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import {
  CitationExtractorSelectionBinding,
  makeCitationExtractorSelection,
} from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { loadCitationExtractorSelectionControls } from "../CitationExtractorSelection.fixtures.ts";

const $I = $LawPracticeServerId.create("test/integration/CitationExtractorSelection");
const Operations = S.fromJsonString(S.Struct({ artifacts: S.Record(S.String, S.Unknown) })).pipe(
  $I.annoteSchema("Operations", { description: "Hash-bound captured oracle artifact index." })
);
const Artifact = S.Struct({ kind: S.tag("tokenizer-extractors"), payload: S.String }).pipe(
  $I.annoteSchema("Artifact", { description: "Exact captured extractor configuration payload." })
);
const Extractors = S.fromJsonString(
  S.Array(
    S.Struct({
      pythonType: S.tag("eyecite.models.TokenExtractor"),
      fields: S.Struct({ flags: CitationExtractorSelectionBinding.fields.flags, strings: S.Array(S.String) }),
    })
  ).check(S.isBetweenLength(6805, 6805))
).pipe(
  $I.annoteSchema("Extractors", {
    description: "Every required string and flag in the complete default source configuration.",
  })
);

// Full source configuration installation/replay stays in hosted integration.
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "source extractor selection",
  (it) => {
    it.effect(
      "installs all 6805 source extractors and reproduces every independent membership vector",
      () =>
        Effect.gen(function* () {
          const controls = yield* loadCitationExtractorSelectionControls();
          const fs = yield* FileSystem.FileSystem;
          const digest = yield* Digest.Digest;
          const raw = yield* fs.readFile(
            NodeURL.fileURLToPath(
              new URL("../../../use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url)
            )
          );
          expect(yield* digest.digestHex(Digest.sha256, raw)).toBe(
            "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
          );
          const corpus = yield* S.decodeEffect(Operations)(new TextDecoder().decode(raw));
          const captured = yield* Effect.fromOption(R.get(corpus.artifacts, controls.canonical.extractorsSha256));
          const artifact = yield* S.decodeUnknownEffect(Artifact)(captured);
          expect(yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(artifact.payload))).toBe(
            controls.canonical.extractorsSha256
          );
          const extractors = yield* S.decodeEffect(Extractors)(artifact.payload);
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const unicode = yield* makeCitationPythonUnicode(limits);
          const bindings = yield* Effect.forEach(
            extractors,
            (entry, id) =>
              Effect.gen(function* () {
                const strings = yield* Effect.forEach(
                  entry.fields.strings,
                  (text) => unicode.fromText(text).pipe(Effect.map((value) => value.storage)),
                  { concurrency: 1 }
                );
                return CitationExtractorSelectionBinding.make({ id, flags: entry.fields.flags, strings });
              }),
            { concurrency: 1 }
          );
          const selector = yield* makeCitationExtractorSelection(limits, bindings);
          expect(bindings).toHaveLength(6805);
          const orderingBindings = A.map(bindings, (binding, index) => {
            const [hash, equalityClass] = A.getUnsafe(controls.canonical.hashes, index);
            return CitationExtractorOrderingBinding.make({ ...binding, hash, equalityClass });
          });
          const ordering = yield* makeCitationExtractorOrdering(limits, orderingBindings);
          for (const row of controls.canonical.cases) {
            const selected = yield* selector.select(row.source);
            expect(selected.indices, `case ${row.id}`).toEqual(row.selected);
            expect(selected.insertions, `case ${row.id}`).toEqual(row.insertions);
            expect((yield* ordering.ordered(row.source)).indices, `case ${row.id}`).toEqual(row.ordered);
          }
        }),
      { timeout: 120_000 }
    );
  }
);
