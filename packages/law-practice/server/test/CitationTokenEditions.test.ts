import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationTokenEditionBinding,
  makeCitationTokenEditions,
} from "@beep/law-practice-server/internal/Citation/TokenEditions";
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
  expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
    "b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c"
  );
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "token editions",
  (it) => {
    it.effect("performs actual target set deduplication and source nominative choice in every captured case", () =>
      Effect.gen(function* () {
        const controls = yield* load();
        const editions = yield* makeCitationTokenEditions(
          (yield* defaultCitationEnginePolicy).limits,
          controls.bindings
        );
        for (const row of controls.cases) {
          const exact = yield* editions.deduplicate(row.exactInput);
          const variation = yield* editions.deduplicate(row.variationInput);
          expect(exact, `case ${row.id}`).toEqual(row.exact);
          expect(variation, `case ${row.id}`).toEqual(row.variation);
          if (row.nominative === null)
            expect(yield* editions.nominative(exact, variation).pipe(Effect.flip)).toMatchObject({
              reason: "host-failed",
            });
          else expect(yield* editions.nominative(exact, variation)).toBe(row.nominative);
        }
        for (const row of controls.choices)
          expect(yield* editions.nominative(row.exact, row.variation)).toBe(row.result);
        expect(yield* editions.nominative([9], [0])).toBe(false);
        expect(yield* editions.nominative([], [0])).toBe(true);
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
          expect(yield* editions.nominative([0], [])).toBe(true);
          expect(yield* editions.deduplicate([0, 0])).toEqual([0]);
          expect(yield* editions.deduplicate([0, 0, 0]).pipe(Effect.flip)).toMatchObject({ limit: "candidates" });
          expect(yield* editions.deduplicate([1]).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
          expect(yield* makeCitationTokenEditions(limits, [row, row]).pipe(Effect.flip)).toMatchObject({
            reason: "host-failed",
          });
        })
    );
  }
);
