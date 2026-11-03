import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAssemblyView,
  CitationTokenAssemblyFailure,
  CitationTokenAssemblyHost,
  makeCitationTokenAssembly,
} from "@beep/law-practice-server/internal/Citation/TokenAssembly";
import { CitationTokenEditionBinding } from "@beep/law-practice-server/internal/Citation/TokenEditions";
import { makeCitationTokenObjects } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { makeCitationTokenText } from "@beep/law-practice-server/internal/Citation/TokenText";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { LiteralKit } from "@beep/schema";
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
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenAssembly");
const Decision = LiteralKit(["merge", "nominative", "text"]);
const Trace = S.Struct({
  kind: Decision,
  left: S.optionalKey(S.Natural),
  right: S.optionalKey(S.Natural),
  result: S.optionalKey(S.Boolean),
  text: S.optionalKey(S.String),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-assembly/v2"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("2efe2dc607f1e038a4412ff4bf28df49a2fe0a90ba57e0938ca3e0f261535a54"),
    tokenSeeds: S.Array(CitationTokenSeedHex).check(S.isBetweenLength(8, 8)),
    editionBindings: S.Array(S.Struct({ ...CitationTokenEditionBinding.fields, hash: S.BigIntFromString })).check(
      S.isBetweenLength(14, 14)
    ),
    editionProfileSha256: S.tag("b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: S.String,
        ids: S.Array(S.Natural),
        views: CitationAssemblyView.pipe(S.toType, S.Array),
        trace: S.Array(Trace),
        items: S.Array(
          S.Struct({ kind: LiteralKit(["text", "token"]), text: S.optionalKey(S.String), id: S.optionalKey(S.Natural) })
        ),
        citations: S.Array(S.Tuple([S.Natural, S.Natural])),
      })
    ).check(S.isBetweenLength(407, 407)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual source assembly outputs and callback decision traces; target host merge remains separate.",
  })
);
const failure = () => CitationTokenAssemblyFailure.make({ reason: "host-failed" });
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "token assembly",
  (it) => {
    it.effect("matches source mixed outputs and decisions using actual target token/edition merging", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* Digest.Digest;
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-assembly.json", import.meta.url))
        );
        expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
          "654a826469d27b64ba6530a763f85a5f7926029f386e25511825472c74d01cd1"
        );
        const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const text = yield* makeCitationTokenText(limits);
        for (const row of corpus.cases) {
          const objects = yield* makeCitationTokenObjects(limits, corpus.editionBindings);
          const created = yield* Effect.forEach(corpus.tokenSeeds, objects.create, { concurrency: 1 });
          expect(created).toEqual(A.range(0, 7));
          let cursor = 0;
          const next = (kind: typeof Decision.Type) => {
            const event = A.getUnsafe(row.trace, cursor++);
            expect(event.kind, `case ${row.id}`).toBe(kind);
            return event;
          };
          const host = CitationTokenAssemblyHost.of({
            read: objects.read,
            merge: Effect.fn("AssemblyTest.merge")((left: number, right: number) =>
              Effect.gen(function* () {
                const actual = yield* objects.mergeTruthy(left, right);
                const event = next("merge");
                expect([left, right]).toEqual([event.left, event.right]);
                expect(actual).toBe(event.result);
                return actual;
              })
            ),
            nominative: Effect.fn("AssemblyTest.nominative")((id: number) =>
              Effect.gen(function* () {
                const actual = yield* objects.nominative(id);
                const event = next("nominative");
                expect(id).toBe(event.left);
                expect(actual).toBe(event.result);
                return actual;
              })
            ),
            text: Effect.fn("AssemblyTest.text")((start: number, end: number) =>
              Effect.gen(function* () {
                const source = Str.slice(start, end)(row.source);
                expect(source).toBe(next("text").text);
                const plan = yield* text
                  .plan({ width: 1, bytes: new TextEncoder().encode(source) })
                  .pipe(Effect.mapError(failure));
                return A.map(plan.spans, ([a, b]) => Tuple.make(start + a, start + b));
              })
            ),
          });
          const assembler = yield* makeCitationTokenAssembly(limits).pipe(
            Effect.provideService(CitationTokenAssemblyHost, host)
          );
          const result = yield* assembler.assemble({ length: Str.length(row.source), ids: row.ids });
          expect(
            A.map(result.items, (item) =>
              item._tag === "Text"
                ? { kind: "text", text: Str.slice(item.start, item.end)(row.source) }
                : { kind: "token", id: item.id }
            ),
            `case ${row.id}`
          ).toEqual(row.items);
          expect(result.citations).toEqual(row.citations);
          expect(cursor).toBe(row.trace.length);
        }
      })
    );
    it.effect("counts discarded candidates, enforces total output and propagates closed host failure", () =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, tokens: 1, candidates: 1 };
        const host = CitationTokenAssemblyHost.of({
          read: Effect.fn("AssemblyTest.fixedRead")(() =>
            Effect.succeed(
              CitationAssemblyView.make({ start: 1, end: 2, hasData: true, truthy: true, citation: false })
            )
          ),
          merge: Effect.fn("AssemblyTest.failedMerge")(() => Effect.fail(failure())),
          nominative: Effect.fn("AssemblyTest.failedNominative")(() => Effect.fail(failure())),
          text: Effect.fn("AssemblyTest.fixedText")((start: number, end: number) =>
            Effect.succeed([Tuple.make(start, end)])
          ),
        });
        const assembler = yield* makeCitationTokenAssembly(limits).pipe(
          Effect.provideService(CitationTokenAssemblyHost, host)
        );
        expect(yield* assembler.assemble({ length: 3, ids: [0, 0] }).pipe(Effect.flip)).toMatchObject({
          limit: "candidates",
        });
        expect(yield* assembler.assemble({ length: 3, ids: [0] }).pipe(Effect.flip)).toMatchObject({ limit: "tokens" });
        const failed = yield* makeCitationTokenAssembly({ ...limits, candidates: 3, tokens: 10 }).pipe(
          Effect.provideService(CitationTokenAssemblyHost, host)
        );
        expect(yield* failed.assemble({ length: 3, ids: [0, 0] }).pipe(Effect.flip)).toMatchObject({
          reason: "host-failed",
        });
      })
    );
  }
);
