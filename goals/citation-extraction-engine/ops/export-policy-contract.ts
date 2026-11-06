/** Retain the frozen schema ceilings and decoded default fixture for review. */
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineEffectivePolicy,
  CitationEngineLimits,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const program = Effect.gen(function* () {
  const fixture = yield* defaultCitationEnginePolicy;
  const maxima = R.fromEntries(
    A.map(
      R.toEntries(CitationEngineAbsoluteMaxima),
      ([key, value]) => [Str.replace(/Millis$/, "")(key), value] as const
    )
  );
  const decodedMaxima = yield* S.decodeUnknownEffect(CitationEngineLimits)(maxima);
  const absoluteCeilings = yield* S.encodeEffect(CitationEngineLimits)(decodedMaxima);
  const defaultPolicy = yield* S.encodeEffect(CitationEngineEffectivePolicy)(fixture);
  const hash = (value: Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
  const schemaSourceSha256 = hash(
    yield* Effect.tryPromise(() =>
      Bun.file(
        new URL("../../../packages/law-practice/use-cases/src/CitationEngine/CitationEngine.limits.ts", import.meta.url)
      ).bytes()
    )
  );
  const fixtureSourceSha256 = hash(
    yield* Effect.tryPromise(() =>
      Bun.file(
        new URL("../../../packages/law-practice/use-cases/src/internal/citationEnginePolicyFixture.ts", import.meta.url)
      ).bytes()
    )
  );
  const text = yield* S.encodeUnknownEffect(S.fromJsonString(S.JsonObject))({
    schemaVersion: "citation-policy-contract-proof/v1",
    durationEncoding: "whole-milliseconds",
    schemaSourceSha256,
    fixtureSourceSha256,
    absoluteCeilings,
    defaultPolicy,
  });
  yield* Effect.tryPromise(() => Bun.write(process.argv[2]!, text));
});
Effect.runPromise(program);
