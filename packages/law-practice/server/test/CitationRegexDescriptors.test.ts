import { makeCitationRegexDescriptorRegistry } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

// Fixed vectors independently computed with Python 3.11.15 hashlib over a width
// byte and little-endian Python points; no target fingerprint helper is used.
const descriptor = () => ({
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
});
const pattern = () => ({ width: 1, bytes: new TextEncoder().encode("(?P<maybe>a)?(b)") });

it.layer(BunCrypto.layer)("source-bound regex descriptors", (it) => {
  it.effect("rejects incoherent capture names before installing a descriptor", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      for (const names of [{ "": 1 }, { a: 0 }, { a: 3 }, { a: 1, b: 1 }, { "private source": 1 }]) {
        const failed = yield* makeCitationRegexDescriptorRegistry(limits, [
          { ...descriptor(), profile: { ...descriptor().profile, names } },
        ]).pipe(Effect.flip);
        expect(failed).toMatchObject({ reason: "invalid-bindings" });
        expect(failed.message).not.toContain("private source");
      }
    })
  );
  it.effect("retains its captured Clock and total deadline precedence", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const clock = yield* Clock.Clock;
      const immediate: Clock.Clock = { ...clock, sleep: () => Effect.void };
      const disabled: Clock.Clock = { ...clock, sleep: () => Effect.never };
      const registry = yield* makeCitationRegexDescriptorRegistry(
        { ...limits, extractDeadline: Duration.millis(10), operationDeadline: Duration.millis(10) },
        [descriptor()]
      ).pipe(Effect.provideService(Clock.Clock, immediate));
      const citationResult1 = yield* registry
        .bind(pattern(), 0)
        .pipe(Effect.provideService(Clock.Clock, disabled), Effect.flip);
      expect(citationResult1).toMatchObject({ operation: "extract", limit: "operationDeadline" });
    })
  );
  it.effect("owns native pattern bytes across an asynchronous fingerprint and caller mutation", () =>
    Effect.gen(function* () {
      const crypto = yield* Digest.Digest;
      const started = yield* Deferred.make<void>();
      const finish = yield* Deferred.make<void>();
      const gated = Digest.Digest.of({
        ...crypto,
        digestHex: Effect.fn("DescriptorTest.gatedDigest")((algorithm, bytes) =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(finish)),
            Effect.andThen(crypto.digestHex(algorithm, bytes))
          )
        ),
      });
      const citationResult2 = yield* defaultCitationEnginePolicy;
      const registry = yield* makeCitationRegexDescriptorRegistry(citationResult2.limits, [descriptor()]).pipe(
        Effect.provideService(Digest.Digest, gated)
      );
      const input = pattern();
      const running = yield* Effect.forkChild(registry.bind(input, 0));
      yield* Deferred.await(started);
      input.bytes.fill(98);
      yield* Deferred.succeed(finish, undefined);
      const bound = yield* Fiber.join(running);
      expect(bound.prepared.value.storage.bytes).toEqual(pattern().bytes);
      expect(bound.program.groups).toBe(2);
    })
  );
  it.effect("binds native words, flags and fresh compiler facts against owned installed metadata", () =>
    Effect.gen(function* () {
      const source = descriptor();
      const citationResult3 = yield* defaultCitationEnginePolicy;
      const registry = yield* makeCitationRegexDescriptorRegistry(citationResult3.limits, [source]);
      source.profile.groups = 9;
      source.profile.names.maybe = 2;
      const bound = yield* registry.bind(pattern(), 0);
      expect(bound.descriptor.profile).toEqual(descriptor().profile);
      expect(bound.program.groups).toBe(2);
      expect(bound.prepared.value.storage.bytes).toEqual(pattern().bytes);
      const citationResult4 = yield* registry.bind(pattern(), 2).pipe(Effect.flip);
      expect(citationResult4).toMatchObject({ reason: "unknown-pattern" });
      const citationResult5 = yield* registry.bind({ width: 1, bytes: new Uint8Array([98]) }, 0).pipe(Effect.flip);
      expect(citationResult5).toMatchObject({
        reason: "unknown-pattern",
      });
    })
  );

  it.effect("rejects wrong group, name, width and repetition facts for an exact installed pattern", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      for (const profile of [
        { ...descriptor().profile, groups: 3 },
        { ...descriptor().profile, names: { maybe: 2 } },
        { ...descriptor().profile, minimumWidthFloor: 2 },
        { ...descriptor().profile, repeatedCaptures: true },
        { ...descriptor().profile, nullableMultiRepeat: true },
      ]) {
        const registry = yield* makeCitationRegexDescriptorRegistry(limits, [{ ...descriptor(), profile }]);
        const citationResult6 = yield* registry.bind(pattern(), 0).pipe(Effect.flip);
        expect(citationResult6).toMatchObject({ reason: "profile-mismatch" });
      }
    })
  );

  it.effect("distinguishes literal-surrogate and scalar patterns with the same display projection", () =>
    Effect.gen(function* () {
      const citationResult7 = yield* defaultCitationEnginePolicy;
      const registry = yield* makeCitationRegexDescriptorRegistry(citationResult7.limits, [
        {
          patternSha256: "6b0cc71a808904081ff51cc3266650d2eca776b7050405ddc8a93f1f1278212f",
          flags: 0,
          profile: { groups: 0, names: {}, minimumWidthFloor: 2, repeatedCaptures: false, nullableMultiRepeat: false },
        },
      ]);
      const bound = yield* registry.bind({ width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) }, 0);
      expect(bound.program.minimumWidthFloor).toBe(2);
      const citationResult8 = yield* registry
        .bind({ width: 4, bytes: new Uint8Array([0xce, 0xd7, 1, 0]) }, 0)
        .pipe(Effect.flip);
      expect(citationResult8).toMatchObject({ reason: "unknown-pattern" });
    })
  );

  it.effect("rejects duplicate keys and checks installed pattern capacity before decoding bindings", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const citationResult9 = yield* makeCitationRegexDescriptorRegistry(limits, [descriptor(), descriptor()]).pipe(
        Effect.flip
      );
      expect(citationResult9).toMatchObject({ reason: "invalid-bindings" });
      const citationResult10 = yield* makeCitationRegexDescriptorRegistry({ ...limits, patterns: 1 }, [
        descriptor(),
        "malformed",
      ]).pipe(Effect.flip);
      expect(citationResult10).toMatchObject({ limit: "patterns" });
    })
  );

  it.effect("captures the Digest service rather than inheriting a later caller replacement", () =>
    Effect.gen(function* () {
      const citationResult11 = yield* defaultCitationEnginePolicy;
      const registry = yield* makeCitationRegexDescriptorRegistry(citationResult11.limits, [descriptor()]);
      const poisoned = Digest.Digest.of({
        digest: Effect.fn("DescriptorTest.digest")(() => Effect.die("private digest cause")),
        digestHex: Effect.fn("DescriptorTest.digestHex")(() => Effect.die("private digest cause")),
      });
      const citationResult12 = yield* registry.bind(pattern(), 0).pipe(Effect.provideService(Digest.Digest, poisoned));
      expect(citationResult12.program.groups).toBe(2);
      const citationResult13 = yield* defaultCitationEnginePolicy;
      const broken = yield* makeCitationRegexDescriptorRegistry(citationResult13.limits, [descriptor()]).pipe(
        Effect.provideService(Digest.Digest, poisoned)
      );
      const failed = yield* broken.bind(pattern(), 0).pipe(Effect.flip);
      expect(failed).toMatchObject({ reason: "fingerprint-unavailable" });
      expect(failed.message).not.toContain("private digest cause");
    })
  );
});
