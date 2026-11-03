import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationTokenEditionBinding,
  makeCitationTokenEditions,
} from "@beep/law-practice-server/internal/Citation/TokenEditions";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationTokenEditions");
const Binding = S.Struct({ ...CitationTokenEditionBinding.fields, hash: S.BigIntFromString });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-editions/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    hashProfile: S.tag("captured-source-runtime"),
    producerSha256: S.tag("93b10f22675e44e7f1a20871dec7d8ecac31e0e3168734285c236fc79ddeae1a"),
    choices: S.Array(S.Struct({ exact: S.Array(S.Natural), variation: S.Array(S.Natural), result: S.Boolean })).check(
      S.isBetweenLength(42, 42)
    ),
    bindings: S.Array(Binding).check(S.isBetweenLength(14, 14)),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        exactInput: S.Array(S.Natural),
        variationInput: S.Array(S.Natural),
        exact: S.Array(S.Natural),
        variation: S.Array(S.Natural),
        nominative: S.NullOr(S.Boolean),
      })
    ).check(S.isBetweenLength(89, 89)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual source edition merging under authenticated captured runtime hash facts.",
  })
);
const load = Effect.fn("EditionTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-editions.json", import.meta.url))
  );
  const citationResult1 = yield* digest.digestHex(Digest.sha256, bytes);
  expect(citationResult1).toBe("b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "token editions",
  (it) => {
    it.effect("performs actual target set deduplication and source nominative choice in every captured case", () =>
      Effect.gen(function* () {
        const controls = yield* load();
        const citationResult2 = yield* defaultCitationEnginePolicy;
        const editions = yield* makeCitationTokenEditions(citationResult2.limits, controls.bindings);
        for (const row of controls.cases) {
          const exact = yield* editions.deduplicate(row.exactInput);
          const variation = yield* editions.deduplicate(row.variationInput);
          expect(exact, `case ${row.id}`).toEqual(row.exact);
          expect(variation, `case ${row.id}`).toEqual(row.variation);
          if (row.nominative === null) {
            const citationResult10 = yield* editions.nominative(exact, variation).pipe(Effect.flip);
            expect(citationResult10).toMatchObject({
              reason: "host-failed",
            });
          } else {
            const citationResult11 = yield* editions.nominative(exact, variation);
            expect(citationResult11).toBe(row.nominative);
          }
        }
        for (const row of controls.choices) {
          const citationResult12 = yield* editions.nominative(row.exact, row.variation);
          expect(citationResult12).toBe(row.result);
        }
        const citationResult3 = yield* editions.nominative([9], [0]);
        expect(citationResult3).toBe(false);
        const citationResult4 = yield* editions.nominative([], [0]);
        expect(citationResult4).toBe(true);
      })
    );
    it.effect(
      "captures immutable facts, rejects unknown/duplicate identities and bounds occurrences before deduplication",
      () =>
        Effect.gen(function* () {
          const controls = yield* load();
          const limits = { ...(yield* defaultCitationEnginePolicy).limits, candidates: 2 };
          const row = { ...A.getUnsafe(controls.bindings, 0), id: 0 };
          const editions = yield* makeCitationTokenEditions(limits, [row]);
          row.reporterShortName = "U.S.";
          row.equalityClass = 100;
          limits.candidates = 100;
          const citationResult5 = yield* editions.nominative([0], []);
          expect(citationResult5).toBe(true);
          const citationResult6 = yield* editions.deduplicate([0, 0]);
          expect(citationResult6).toEqual([0]);
          const citationResult7 = yield* editions.deduplicate([0, 0, 0]).pipe(Effect.flip);
          expect(citationResult7).toMatchObject({ limit: "candidates" });
          const citationResult8 = yield* editions.deduplicate([1]).pipe(Effect.flip);
          expect(citationResult8).toMatchObject({ reason: "host-failed" });
          const citationResult9 = yield* makeCitationTokenEditions(limits, [row, row]).pipe(Effect.flip);
          expect(citationResult9).toMatchObject({
            reason: "host-failed",
          });
        })
    );
  }
);
