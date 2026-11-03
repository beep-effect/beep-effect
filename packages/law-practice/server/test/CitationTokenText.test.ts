import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationTokenText } from "@beep/law-practice-server/internal/Citation/TokenText";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenText");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-text/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("c1ff04ea89ad4c471556bf229c94963eaa93cfcb74343aa48abf0bc3a49894b6"),
    python: S.tag("3.11.15"),
    cases: S.Array(S.Struct({ id: S.Natural, source: Native, spans: S.Array(S.Tuple([S.Natural, S.Natural])) })).check(
      S.isBetweenLength(1561, 1561)
    ),
  })
).pipe($I.annoteSchema("Corpus", { description: "Independent literal-space append_text observations." }));
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })("token text", (it) => {
  it.effect("matches every independent source boundary and retains native storage identity", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const digest = yield* Digest.Digest;
      const bytes = yield* fs.readFile(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-text.json", import.meta.url))
      );
      expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
        "76cfb8e56b7aa6aecf6c42420d06fae86e2c6a754ad6ffb0ffd2efcef36b53bf"
      );
      const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
      const tokenizer = yield* makeCitationTokenText((yield* defaultCitationEnginePolicy).limits);
      for (const row of corpus.cases) {
        const result = yield* tokenizer.plan(row.source);
        expect(result.spans, `case ${row.id}`).toEqual(row.spans);
        expect(result.source).toEqual(row.source);
      }
    })
  );
  it.effect("captures ceilings, allows equality, rejects the next token and owns source bytes", () =>
    Effect.gen(function* () {
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, tokens: 3, sourceUtf16: 4 };
      const tokenizer = yield* makeCitationTokenText(limits);
      limits.tokens = 100;
      limits.sourceUtf16 = 100;
      const input = native("a b");
      const result = yield* tokenizer.plan(input);
      expect(result.spans).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
      ]);
      input.bytes.fill(32);
      expect(result.source.bytes).toEqual(new TextEncoder().encode("a b"));
      expect(yield* tokenizer.plan(native("a b ")).pipe(Effect.flip)).toMatchObject({ limit: "tokens" });
      expect(yield* tokenizer.plan(native("12345")).pipe(Effect.flip)).toMatchObject({ limit: "sourceUtf16" });
      expect((yield* tokenizer.plan(native("1234"))).spans).toEqual([[0, 4]]);
    })
  );
  it.effect("retains its captured deadline when invoked with a disabled caller Clock", () =>
    Effect.gen(function* () {
      const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
      const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
      const planner = yield* makeCitationTokenText({
        ...(yield* defaultCitationEnginePolicy).limits,
        extractDeadline: Duration.millis(997),
      }).pipe(Effect.provideService(Clock.Clock, timer.clock));
      const pending = yield* planner
        .plan({ width: 1, bytes: new Uint8Array(65_536).fill(97) })
        .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
      yield* timer.trigger;
      expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "extractDeadline",
      });
    })
  );
});
