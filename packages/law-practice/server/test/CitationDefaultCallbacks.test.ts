import { fileURLToPath } from "node:url";
import { citationAuthorityMentionIds, citationGroupMembers } from "@beep/law-practice-domain/values";
import {
  CitationCallbackRuntimeIndexFactory,
  CitationMissingPageIdentities,
  CitationMissingPageIdentityFactory,
  makeCitationCallbackRuntimeIndexFactory,
} from "@beep/law-practice-server/_test/Citation/CallbackRuntimeIndex";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import {
  makeDefaultCitationResolutionCallbacks,
  runDefaultCitationCallbackSession,
  runPreparedDefaultCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { restoreCitationDocument } from "@beep/law-practice-server/_test/Citation/Document";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/_test/Citation/FrozenEditions";
import { makeCitationRegisteredResolver } from "@beep/law-practice-server/_test/Citation/RegisteredResolver";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import { resolveCitationMentions } from "@beep/law-practice-server/_test/Citation/Resolve";
import { makeCitationRegisteredSessionDescriptors } from "@beep/law-practice-server/_test/Citation/SessionDescriptors";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { CitationResolutionContext, prepareCitationResolutionContext as prepare } from "./CitationResolve.fixtures.ts";
import { loadResolutionOperationContexts } from "./CitationResolve.operations.ts";

const cases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "89d86c6aefecc02a30e6d719af9277050d8023949d4fba69912e2b9295d20e05"
  );
  return yield* S.decodeEffect(S.fromJsonString(S.Struct({ cases: S.Array(CitationResolutionContext) })))(raw);
});
const selected = Effect.gen(function* () {
  return yield* Effect.fromOption(A.findFirst((yield* cases).cases, (row) => row.name === "short-unique"));
});

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("production default callback sessions", (it) => {
  it.effect(
    "runs all 76 source contexts through the registered resolver and restores exact group memberships",
    () =>
      Effect.gen(function* () {
        const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
        let builds = 0;
        const identityFactory = CitationMissingPageIdentityFactory.of({
          build: Effect.sync(() => {
            builds++;
            let hashes = HashMap.empty<string, bigint>();
            return CitationMissingPageIdentities.of({
              read: Effect.fn("RegisteredResolverTest.controlledIdentity")(function* (reference) {
                const key =
                  reference._tag === "Mention" ? `Mention:${reference.mentionId}` : `Detached:${reference.detachedId}`;
                const existing = HashMap.get(hashes, key);
                if (O.isSome(existing)) return existing.value;
                const hash = BigInt("4294967296") + BigInt(HashMap.size(hashes)) * BigInt("16");
                hashes = HashMap.set(hashes, key, hash);
                return hash;
              }),
            });
          }),
        });
        const resolver = yield* makeCitationRegisteredResolver().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(CitationMissingPageIdentityFactory, identityFactory)
        );
        const contexts = [
          ...(yield* cases).cases,
          ...A.map((yield* loadResolutionOperationContexts).contexts, (row) => row.context),
        ];
        expect(contexts).toHaveLength(76);
        for (const row of contexts) {
          const input = yield* prepare(row);
          if (row.outcome.status === "error") {
            const failure = yield* Effect.flip(resolver.resolve(input));
            expect(["invalid-input", "identity-failed", "callback-failed"], row.name).toContain(failure.reason);
          } else {
            const captured = resolver.resolve(input) satisfies Effect.Effect<unknown, CitationCallbackFailure>;
            const result = yield* captured;
            const indices = HashMap.fromIterable(
              A.map(input.mentions, (mention, index) => [mention.id, index] as const)
            );
            const members = A.map(result.document.groups, (group) =>
              A.map(citationGroupMembers(result.document, group.id), (reference) =>
                reference._tag === "Mention" ? O.getOrElse(HashMap.get(indices, reference.mentionId), () => -1) : -1
              )
            );
            expect(members, row.name).toEqual(row.outcome.groups);
            const restored = yield* restoreCitationDocument({
              receipt: result.receipt,
              editions: [],
              resourceBindings: result.resourceBindings,
              expectedSource: input.verifiedSource.source,
              expectedEngineArtifact: input.engineArtifact,
              sourceText: row.text,
            });
            expect(restored.groups, row.name).toEqual(result.document.groups);
            expect(restored.memberLists, row.name).toEqual(result.document.memberLists);
          }
        }
        expect(builds).toBe(76);
        const input = yield* prepare(yield* selected);
        const [left, right] = yield* Effect.all([resolver.resolve(input), resolver.resolve(input)], { concurrency: 2 });
        expect(left.receipt).toEqual(right.receipt);
        expect(left.resourceBindings).toEqual(right.resourceBindings);
        expect(builds).toBe(78);
        const limited = yield* Effect.flip(
          resolver.resolve({ ...input, limits: { ...input.limits, resolutionIterations: 1 } })
        );
        expect(limited.reason).toBe("limit-exceeded");
        expect((yield* resolver.resolve(input)).receipt).toEqual(left.receipt);
        const absent = yield* makeCitationRegisteredResolver().pipe(
          Effect.provideService(CitationFrozenEditions, frozen)
        );
        const nullCase = yield* Effect.fromOption(
          A.findFirst(contexts, (row) => row.name === "missing-page"),
          () => CitationCallbackFailure.make({ reason: "invalid-input" })
        );
        expect((yield* Effect.flip(absent.resolve(yield* prepare(nullCase)))).reason).toBe("identity-failed");
      }),
    { timeout: 30_000 }
  );

  it.effect("spends one shared operation budget across dispatch and descriptor hashing", () =>
    Effect.gen(function* () {
      const original = yield* prepare(yield* selected);
      const input = { ...original, mentions: A.take(original.mentions, 1) };
      const prepared = yield* prepareCitationResolution(input);
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const counter = yield* makeCitationResolutionWork(prepared.limits);
      let spent = 0;
      const measured = CitationResolutionWork.of({
        ...counter,
        step: counter.step.pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              spent++;
            })
          )
        ),
      });
      const session = yield* runPreparedDefaultCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, measured),
        Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
      );
      const dispatchSpent = spent;
      expect(dispatchSpent).toBeGreaterThan(0);
      const descriptors = yield* makeCitationRegisteredSessionDescriptors(session).pipe(
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(CitationResolutionWork, measured)
      );
      yield* descriptors.describe(A.getUnsafe(session.groups, 0).resource);
      expect(spent).toBeGreaterThan(dispatchSpent);
      const resolver = yield* makeCitationRegisteredResolver().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      expect(
        (yield* Effect.flip(
          resolver.resolve({ ...input, limits: { ...input.limits, resolutionIterations: dispatchSpent } })
        )).reason
      ).toBe("limit-exceeded");
      expect((yield* resolver.resolve(input)).document.groups).toHaveLength(1);
    })
  );

  it.effect("matches all 46 focused source scenes and the existing default document memberships", () =>
    Effect.gen(function* () {
      const data = yield* cases;
      expect(A.length(data.cases)).toBe(46);
      for (const row of data.cases) {
        const input = yield* prepare(row);
        if (row.outcome.status === "error") {
          const failed = yield* Effect.flip(runDefaultCitationCallbackSession(input));
          expect(["invalid-input", "identity-failed", "callback-failed"]).toContain(failed.reason);
          expect("cause" in failed).toBe(false);
        } else {
          const result = yield* runDefaultCitationCallbackSession(input);
          const indices = HashMap.fromIterable(
            A.map(result.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(result.groups, (group) =>
            A.map(group.members, (reference) =>
              reference._tag === "Mention" ? O.getOrElse(HashMap.get(indices, reference.mentionId), () => -1) : -1
            )
          );
          expect(groups, row.name).toEqual(row.outcome.groups);
          const document = yield* resolveCitationMentions(input);
          expect(
            A.map(document.authorities, (authority) =>
              A.map(citationAuthorityMentionIds(document, authority.id), (id) =>
                O.getOrElse(HashMap.get(indices, id), () => -1)
              )
            ),
            row.name
          ).toEqual(groups);
        }
      }
    })
  );

  it.effect(
    "matches every committed default operation observation through production callbacks",
    () =>
      Effect.gen(function* () {
        const data = yield* loadResolutionOperationContexts;
        expect(data.corpusSha256).toBe("ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
        expect(A.length(data.contexts)).toBe(30);
        expect(A.reduce(data.contexts, 0, (count, row) => count + A.length(row.context.mentions))).toBe(94);
        for (const row of data.contexts) {
          const result = yield* runDefaultCitationCallbackSession(yield* prepare(row.context));
          const indices = HashMap.fromIterable(
            A.map(result.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(result.groups, (group) =>
            A.map(group.members, (reference) =>
              reference._tag === "Mention" ? O.getOrElse(HashMap.get(indices, reference.mentionId), () => -1) : -1
            )
          );
          if (row.context.outcome.status !== "value") return yield* Effect.die("Expected source groups");
          expect(groups, row.context.name).toEqual(row.context.outcome.groups);
        }
      }),
    { timeout: 30_000 }
  );

  it.effect("shares the work budget between dispatch and matching while isolating concurrent operations", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const two = {
        ...input,
        mentions: A.take(input.mentions, 2),
        limits: { ...input.limits, resolutionIterations: 6 },
      };
      const results = yield* Effect.all(
        [runDefaultCitationCallbackSession(two), runDefaultCitationCallbackSession(two)],
        { concurrency: 2 }
      );
      expect(A.map(results, (result) => A.length(A.getUnsafe(result.groups, 0).members))).toEqual([2, 2]);
      const failed = yield* Effect.flip(
        runDefaultCitationCallbackSession({ ...two, limits: { ...two.limits, resolutionIterations: 4 } })
      );
      expect(failed.reason).toBe("limit-exceeded");
    })
  );

  it.effect("captures the budget ceiling and rejects a counter from a different operation policy", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const limits = { ...input.limits, resolutionIterations: 2 };
      const work = yield* makeCitationResolutionWork(limits);
      Reflect.set(limits, "resolutionIterations", 99);
      yield* work.step;
      yield* work.step;
      expect((yield* Effect.flip(work.step)).reason).toBe("limit-exceeded");
      expect(work.maximum).toBe(2);
      const prepared = yield* prepareCitationResolution(input);
      const mismatch = yield* makeCitationResolutionWork({
        ...prepared.limits,
        resolutionIterations: prepared.limits.resolutionIterations - 1,
      });
      const goodWork = yield* makeCitationResolutionWork(prepared.limits);
      const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, goodWork)
      );
      const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationCallbackDictionary, dictionary),
        Effect.provideService(CitationResolutionWork, goodWork)
      );
      const failed = yield* Effect.flip(
        runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, mismatch),
          Effect.provideService(CitationCallbackDictionary, dictionary),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )
      );
      expect(failed.reason).toBe("invalid-input");
    })
  );

  it.effect("prepares each occurrence once before constructing its default resource", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const result = yield* runDefaultCitationCallbackSession({ ...input, mentions: A.take(input.mentions, 1) }).pipe(
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      expect(A.length(result.groups)).toBe(1);
      expect(hashes).toBe(2);
    })
  );
});
