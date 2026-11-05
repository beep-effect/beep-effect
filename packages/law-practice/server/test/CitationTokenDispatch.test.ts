import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditionFailure,
  CitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationTokenDispatch } from "@beep/law-practice-server/internal/Citation/TokenDispatch";
import { CitationTokenSeed } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { LiteralKit } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenDispatch");
const Expected = LiteralKit([
  "FullCaseCitation",
  "FullLawCitation",
  "FullJournalCitation",
  "ShortCaseCitation",
  "IdCitation",
  "SupraCitation",
  "UnknownCitation",
  "Skip",
]);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-dispatch/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("ebfacb0bde36e1dbd582c86f670ad90c2704095869d76eeb9ccdd36a832c5e9e"),
    bindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef, source: S.String })).check(
      S.isBetweenLength(4, 4)
    ),
    columns: S.Tuple([
      S.tag("kind"),
      S.tag("exact"),
      S.tag("variation"),
      S.tag("short"),
      S.tag("expected"),
      S.tag("failure"),
      S.tag("lookups"),
    ]),
    tokenTemplate: S.Struct({
      data: CitationTokenSeedHex.fields.data,
      start: S.Int,
      end: S.Int,
      groups: CitationTokenSeedHex.fields.groups,
    }),
    cases: S.Array(
      S.Tuple([
        CitationTokenSeed.fields.kind,
        S.Array(S.Natural),
        S.Array(S.Natural),
        S.Boolean,
        S.NullOr(Expected),
        S.NullOr(S.Literal("unknown-source")),
        S.Array(S.Natural),
      ])
    ).check(S.isBetweenLength(7318, 7318)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual isolated source branch and source-lookup order observations, encoded one vector per line.",
  })
);
const unavailable = Effect.fn("DispatchTest.unavailable")(() =>
  Effect.fail(CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
);
const load = Effect.fn("DispatchTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-dispatch.json", import.meta.url))
  );
  const hash = yield* digest.digestHex(Digest.sha256, bytes);
  expect(hash).toBe("3a865e3d1bf47f08eb97a092c2ae5743232f1adbad3feea9537ba5907386fd47");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "extraction token dispatch",
  (it) => {
    it.effect(
      "matches all source branches, exact/variation precedence and every ordered source read",
      () =>
        Effect.gen(function* () {
          const corpus = yield* load();
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const values = HashMap.fromIterable(A.map(corpus.bindings, (row) => Tuple.make(row.ref, row)));
          let lookups = A.empty<number>();
          const owner = CitationFrozenEditions.of({
            source: Effect.fn("DispatchTest.source")(function* (ref: CitationEditionRef) {
              const row = yield* Effect.fromOption(HashMap.get(values, ref)).pipe(
                Effect.mapError(() => CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
              );
              lookups = A.append(lookups, row.id);
              return row.source;
            }),
            lookup: unavailable,
            lookupMany: unavailable,
          });
          const dispatch = yield* makeCitationTokenDispatch(limits, corpus.bindings).pipe(
            Effect.provideService(CitationFrozenEditions, owner)
          );
          for (const [kind, exact, variation, short, expected, failure, reads] of corpus.cases) {
            lookups = [];
            const seed = { ...corpus.tokenTemplate, kind, exact, variation, short };
            if (failure !== null) {
              const failed = yield* dispatch.classify(seed).pipe(Effect.flip);
              expect(failed).toMatchObject({ reason: failure });
            } else {
              const actual = yield* dispatch.classify(seed);
              expect(actual).toBe(expected);
            }
            expect(lookups).toEqual(reads);
          }
          const short = yield* dispatch.classify({
            ...corpus.tokenTemplate,
            kind: "CitationToken",
            exact: [999],
            variation: [],
            short: true,
          });
          expect(short).toBe("ShortCaseCitation");
          const preferred = yield* dispatch.classify({
            ...corpus.tokenTemplate,
            kind: "CitationToken",
            exact: [0],
            variation: [999],
            short: false,
          });
          expect(preferred).toBe("FullCaseCitation");
          const missing = yield* dispatch
            .classify({ ...corpus.tokenTemplate, kind: "CitationToken", exact: [0, 999], variation: [], short: false })
            .pipe(Effect.flip);
          expect(missing).toMatchObject({ reason: "missing-edition" });
        }),
      { timeout: 60000 }
    );
    it.effect("preserves mixed-output indices and rejects incoherent token references without partial plans", () =>
      Effect.gen(function* () {
        const corpus = yield* load();
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const dispatch = yield* makeCitationTokenDispatch(limits, corpus.bindings).pipe(
          Effect.provideService(CitationFrozenEditions, {
            source: unavailable,
            lookup: unavailable,
            lookupMany: unavailable,
          })
        );
        const seed = {
          kind: "IdToken",
          data: { width: 1, bytes: new TextEncoder().encode("Id.") },
          start: 1,
          end: 4,
          groups: {},
          exact: [],
          variation: [],
          short: false,
        };
        const input = {
          source: { width: 1, bytes: new TextEncoder().encode(" Id.") },
          assembly: {
            items: [
              { _tag: "Text", start: 0, end: 1 },
              { _tag: "Token", id: 7 },
            ],
            citations: [[1, 7]],
          },
          tokens: [{ id: 7, seed }],
        };
        const plan = yield* dispatch.plan(input);
        expect(plan.decisions).toEqual([{ index: 1, id: 7, action: "IdCitation" }]);
        for (const value of [
          { ...input, assembly: { ...input.assembly, citations: [[0, 7]] } },
          { ...input, tokens: [] },
          { ...input, tokens: [...input.tokens, ...input.tokens] },
        ]) {
          const failed = yield* dispatch.plan(value).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-input" });
        }
        const duplicates = yield* makeCitationTokenDispatch(limits, [...corpus.bindings, ...corpus.bindings]).pipe(
          Effect.provideService(CitationFrozenEditions, {
            source: unavailable,
            lookup: unavailable,
            lookupMany: unavailable,
          }),
          Effect.flip
        );
        expect(duplicates).toMatchObject({ reason: "invalid-bindings" });
      })
    );
  }
);
