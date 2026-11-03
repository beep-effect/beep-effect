import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationTokenObjects } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { LiteralKit } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenObjects");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-objects/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("1a1c34b189f09253343c067e3ade86c4822a26ff3d1dc31dba6352dda042856b"),
    constructors: S.Array(
      S.Struct({ id: S.Natural, input: CitationTokenSeedHex, offset: S.Int, expected: CitationTokenSeedHex })
    ).check(S.isBetweenLength(297, 297)),
    merges: S.Array(
      S.Struct({
        id: S.Natural,
        left: CitationTokenSeedHex,
        right: CitationTokenSeedHex,
        outcome: LiteralKit(["left", "none", "error"]),
        truth: S.NullOr(S.Boolean),
      })
    ).check(S.isBetweenLength(216, 216)),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Actual source token construction and return-identity/truth controls." })
);
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "native token objects",
  (it) => {
    it.effect("matches all nine source constructors and distinct merge identity/truth results", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* Digest.Digest;
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-objects.json", import.meta.url))
        );
        expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
          "645cc3474e2d4a53bae472b5c0c19371160db1732224d7ec82145b1a90238383"
        );
        const controls = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
        const objects = yield* makeCitationTokenObjects((yield* defaultCitationEnginePolicy).limits, []);
        for (const row of controls.constructors) {
          const id = yield* objects.fromCapture(row.input, row.offset);
          expect(yield* objects.snapshot(id), `constructor ${row.id}`).toEqual(row.expected);
        }
        const checkMerge = Effect.fn("TokenTest.checkMerge")(function* (row: (typeof controls.merges)[number]) {
          const left = yield* objects.create(row.left);
          const right = yield* objects.create(row.right);
          if (row.outcome === "error")
            expect(yield* objects.merge(left, right).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
          else if (row.outcome === "left") assertSome(yield* objects.merge(left, right), left);
          else assertNone(yield* objects.merge(left, right));
          if (row.truth === null)
            expect(yield* objects.mergeTruthy(left, right).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
          else expect(yield* objects.mergeTruthy(left, right)).toBe(row.truth);
        });
        for (const row of controls.merges) yield* checkMerge(row);
      })
    );
    it.effect("owns native inputs and snapshots and captures aggregate token-store ceilings", () =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, candidates: 2, producedTextUtf16: 2 };
        const objects = yield* makeCitationTokenObjects(limits, []);
        limits.candidates = 100;
        limits.producedTextUtf16 = 100;
        const seed = {
          kind: "Token",
          data: { width: 1, bytes: new Uint8Array([120]) },
          start: 0,
          end: 1,
          groups: {},
          exact: [],
          variation: [],
          short: false,
        };
        const first = yield* objects.create(seed);
        seed.data.bytes[0] = 121;
        const snapshot = yield* objects.snapshot(first);
        expect(snapshot.data?.bytes).toEqual(new Uint8Array([120]));
        if (snapshot.data !== null) snapshot.data.bytes.fill(122);
        expect((yield* objects.snapshot(first)).data?.bytes).toEqual(new Uint8Array([120]));
        yield* objects.create(seed);
        expect(yield* objects.create(seed).pipe(Effect.flip)).toMatchObject({ limit: "candidates" });
        const textBounded = yield* makeCitationTokenObjects({ ...limits, producedTextUtf16: 1 }, []);
        yield* textBounded.create(seed);
        expect(yield* textBounded.create(seed).pipe(Effect.flip)).toMatchObject({ limit: "producedTextUtf16" });
        expect(yield* textBounded.snapshot(1).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
      })
    );
    it.effect("retains the captured object-operation deadline against a disabled caller Clock", () =>
      Effect.gen(function* () {
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const objects = yield* makeCitationTokenObjects(
          { ...(yield* defaultCitationEnginePolicy).limits, extractDeadline: Duration.millis(997) },
          []
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const pending = yield* objects
          .create({
            kind: "Token",
            data: { width: 1, bytes: new Uint8Array(65536).fill(97) },
            start: 0,
            end: 1,
            groups: {},
            exact: [],
            variation: [],
            short: false,
          })
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({ limit: "extractDeadline" });
      })
    );
  }
);
