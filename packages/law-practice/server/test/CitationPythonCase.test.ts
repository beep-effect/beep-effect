import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationPythonLower } from "@beep/law-practice-server/internal/Citation/PythonCase";
import {
  CitationPythonCaseData,
  citationPythonCaseData,
} from "@beep/law-practice-server/internal/Citation/PythonCaseData";
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

const $I = $LawPracticeServerId.create("test/CitationPythonCase");
const Native = S.Struct({
  width: S.Literals([1, 2, 4]),
  bytes: S.Uint8ArrayFromBase64,
  points: S.Natural,
  utf16: S.Natural,
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-python-lower-observations/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("df0a758aad222b33ee3a043486ba25e5e176b3edb5a5f5cdd98e5126ac8cfb6a"),
    dataSha256: S.tag("2867105c95497978ca380fe5d57ae4cf1ea82f06f04d4ea205f5caebc02bb71c"),
    data: CitationPythonCaseData,
    allPoints: S.tag(0x110000),
    casedPoints: S.tag(4453),
    caseIgnorablePoints: S.tag(2602),
    cases: S.Array(S.Struct({ id: S.Natural, source: Native, lower: Native })).check(S.isBetweenLength(1453, 1453)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Pinned independent Python lowercase observations and full character facts.",
  })
);

it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "Python lowercase",
  (it) => {
    it.effect("matches all changed points and contextual/native-layout controls from pinned Python", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* Digest.Digest;
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/python-lower.json", import.meta.url))
        );
        const citationResult1 = yield* digest.digestHex(Digest.sha256, bytes);
        expect(citationResult1).toBe("9e33744b1f9c8ca860058bfaad677f2ef932abec1c333df93a4c7a2c3b911848");
        const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
        expect(S.toEquivalence(CitationPythonCaseData)(corpus.data, citationPythonCaseData)).toBe(true);
        const citationResult2 = yield* defaultCitationEnginePolicy;
        const { lower } = yield* makeCitationPythonLower(citationResult2.limits);
        for (const row of corpus.cases) {
          const output = yield* lower({ width: row.source.width, bytes: row.source.bytes });
          expect(output, `case ${row.id}`).toEqual({ width: row.lower.width, bytes: row.lower.bytes });
        }
      })
    );
    it.effect("checks expanded output before allocation and retains its captured policy", () =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 1 };
        const { lower } = yield* makeCitationPythonLower(limits);
        limits.producedTextUtf16 = 10;
        const citationResult3 = yield* lower({ width: 2, bytes: new Uint8Array([0x30, 1]) }).pipe(Effect.flip);
        expect(citationResult3).toMatchObject({
          _tag: "CitationPythonUnicodeFailure",
          reason: "limit-exceeded",
        });
        const citationResult4 = yield* lower({ width: 1, bytes: new Uint8Array([65]) });
        expect(citationResult4).toEqual({
          width: 1,
          bytes: new Uint8Array([97]),
        });
      })
    );
    it.effect("uses its captured deadline despite a caller Clock override", () =>
      Effect.gen(function* () {
        const deadline = Duration.millis(997);
        const timer = yield* makeCitationNativeManualClock(deadline);
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const citationResult5 = yield* defaultCitationEnginePolicy;
        const { lower } = yield* makeCitationPythonLower({
          ...citationResult5.limits,
          cleanDeadline: deadline,
        }).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const pending = yield* lower({ width: 1, bytes: new Uint8Array(65_536).fill(65) }).pipe(
          Effect.provideService(Clock.Clock, disabled),
          Effect.forkChild
        );
        yield* timer.trigger;
        const citationResult6 = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(citationResult6).toMatchObject({ reason: "deadline-exceeded" });
      })
    );
  }
);
