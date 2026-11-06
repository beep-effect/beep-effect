import { CitationAuthorityIdentityInput } from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import {
  CitationResourceIdentity,
  makeCitationResourceAuthorityId,
} from "@beep/law-practice-server/internal/Citation/ResourceIdentity";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import fixture from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";

const a = Sha256Hex.make(Str.repeat(64)("a"));
const b = Sha256Hex.make(Str.repeat(64)("b"));
const expected = "ca1:5acc85a268eb93b214b7de9d7db57f3cde49b77d59efe04e6c2582ca5bb9c90b";
const external = () => CitationResourceIdentity.cases.External.make({ scope: a, key: b });

it.layer(BunCrypto.layer)("trusted resource identity descriptors", (it) => {
  it.effect("preserves every existing canonical fallback protocol vector", () =>
    Effect.gen(function* () {
      expect(A.length(fixture.cases)).toBe(13);
      for (const row of fixture.cases) {
        const authority = yield* S.decodeUnknownEffect(CitationAuthorityIdentityInput)(row.input);
        const identity = CitationResourceIdentity.cases.Canonical.make({ authority });
        const citationResult1 = yield* makeCitationResourceAuthorityId(identity);
        expect(citationResult1, row.name).toBe(row.expectedId);
      }
    })
  );

  it.effect("matches independent external protocol vectors and separates adapter scopes", () =>
    Effect.gen(function* () {
      const citationResult2 = yield* makeCitationResourceAuthorityId(external());
      expect(citationResult2).toBe(expected);
      const citationResult3 = yield* makeCitationResourceAuthorityId(external());
      expect(citationResult3).toBe(expected);
      const citationResult4 = yield* makeCitationResourceAuthorityId(
        CitationResourceIdentity.cases.External.make({ scope: b, key: a })
      );
      expect(citationResult4).toBe("ca1:e1df0e52299f97791ddd0bb524ad1bc790a980be12948c305acd2b39a16eb258");
    })
  );

  it.effect("snapshots descriptors before hashing instead of retaining mutable adapter data", () =>
    Effect.gen(function* () {
      const input = external();
      const crypto = yield* Digest.Digest;
      const id = yield* makeCitationResourceAuthorityId(input).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest((algorithm, bytes) =>
            Effect.suspend(() => {
              Reflect.set(input, "scope", b);
              return crypto.digest(algorithm, bytes);
            })
          )
        )
      );
      expect(id).toBe(expected);
    })
  );

  it.effect("redacts invalid descriptor and digest failures", () =>
    Effect.gen(function* () {
      const bad = yield* Effect.flip(
        makeCitationResourceAuthorityId({ _tag: "External", scope: "private-text", key: b })
      );
      expect(bad.reason).toBe("invalid-input");
      expect("cause" in bad).toBe(false);
      const failed = yield* Effect.flip(
        makeCitationResourceAuthorityId(external()).pipe(
          Effect.provideService(
            Digest.Digest,
            makeTestCitationDigest(() =>
              Effect.die(
                PlatformError.systemError({
                  module: "Crypto",
                  method: "digest",
                  _tag: "Unknown",
                  cause: "private-text",
                })
              )
            )
          )
        )
      );
      expect(failed.reason).toBe("digest-failed");
      expect("cause" in failed).toBe(false);
    })
  );
  it.effect("rejects malformed digest bytes without exposing input or nested causes", () =>
    Effect.gen(function* () {
      const failure = yield* makeCitationResourceAuthorityId(external()).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest(() => Effect.succeed(new Uint8Array(1)))
        ),
        Effect.flip
      );
      expect(failure).toMatchObject({ reason: "digest-failed" });
      expect("cause" in failure).toBe(false);
    })
  );
});
