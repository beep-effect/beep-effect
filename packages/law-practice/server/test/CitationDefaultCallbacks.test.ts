import { fileURLToPath } from "node:url";
import { citationAuthorityMentionIds, citationGroupMembers } from "@beep/law-practice-domain/values";
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
import { readCitationDefaultObservation } from "../src/internal/Citation/CallbackObservations.ts";
import {
  CitationCallbackRuntimeIndexFactory,
  CitationMissingPageIdentities,
  CitationMissingPageIdentityFactory,
  makeCitationCallbackRuntimeIndexFactory,
} from "../src/internal/Citation/CallbackRuntimeIndex.ts";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "../src/internal/Citation/CallbackSession.ts";
import {
  makeDefaultCitationResolutionCallbacks,
  runDefaultCitationCallbackSession,
  runPreparedDefaultCitationCallbackSession,
} from "../src/internal/Citation/DefaultCallbacks.ts";
import { restoreCitationDocument } from "../src/internal/Citation/Document.ts";
import { CitationFrozenEditions, makeCitationFrozenEditions } from "../src/internal/Citation/FrozenEditions.ts";
import { makeCitationRegisteredResolver } from "../src/internal/Citation/RegisteredResolver.ts";
import { prepareCitationResolution } from "../src/internal/Citation/ResolutionInput.ts";
import { resolveCitationMentions } from "../src/internal/Citation/Resolve.ts";
import { CitationResourceIdentity } from "../src/internal/Citation/ResourceIdentity.ts";
import { makeCitationRegisteredSessionDescriptors } from "../src/internal/Citation/SessionDescriptors.ts";
import {
  CitationSessionResourceDescriptors,
  makeCitationSessionDocumentProjector,
} from "../src/internal/Citation/SessionDocument.ts";
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
        const observationsText = yield* (yield* FileSystem.FileSystem).readFileString(
          fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-observations.json", import.meta.url))
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(observationsText))).toBe(
          "34bf392659ed8699115311a9f04377b7366b691e91e5171145b7cafdec6d1592"
        );
        const observed = yield* S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              cases: S.Array(
                S.Struct({
                  name: S.String,
                  decisions: S.Array(
                    S.Struct({
                      index: S.Natural,
                      status: S.Literals(["Resolved", "Unresolved", "Ambiguous"]),
                      reason: S.optionalKey(S.String),
                      distinctCount: S.optionalKey(S.Natural),
                      candidateIndices: S.Natural.pipe(S.Array, S.optionalKey),
                    })
                  ),
                })
              ),
            })
          )
        )(observationsText);
        const branches = HashMap.fromIterable(A.map(observed.cases, (row) => [row.name, row.decisions] as const));
        let checked = 0;
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
            const expectations = HashMap.get(branches, row.name);
            if (O.isSome(expectations)) {
              expect(result.document.resolutions, row.name).toHaveLength(A.length(expectations.value));
              for (const expected of expectations.value) {
                checked++;
                const resolution = A.getUnsafe(result.document.resolutions, expected.index);
                expect(resolution.status, row.name).toBe(expected.status);
                if (resolution.status === "Unresolved") expect(resolution.reason, row.name).toBe(expected.reason);
                if (resolution.status === "Ambiguous") {
                  expect(resolution.candidateAuthorityIds, row.name).toHaveLength(
                    O.getOrElse(O.fromUndefinedOr(expected.distinctCount), () => 0)
                  );
                  const indices = expected.candidateIndices;
                  if (indices === undefined) return yield* Effect.die("source candidate indices missing");
                  const authorities = yield* Effect.forEach(indices, (index) =>
                    Effect.gen(function* () {
                      const prior = A.getUnsafe(result.document.resolutions, index);
                      if (prior.status !== "Resolved")
                        return yield* Effect.die("source candidate is not a resolved full");
                      return prior.authorityId;
                    })
                  );
                  expect(resolution.candidateAuthorityIds, row.name).toEqual(expect.arrayContaining(authorities));
                }
              }
            }
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
            if (row.name === "short-ambiguous") {
              const tampered = {
                ...result.receipt,
                resolutions: A.map(result.receipt.resolutions, (resolution) =>
                  resolution.status === "Ambiguous"
                    ? { ...resolution, candidateAuthorityIds: A.reverse(resolution.candidateAuthorityIds) }
                    : resolution
                ),
              };
              expect(
                (yield* Effect.flip(
                  restoreCitationDocument({
                    receipt: tampered,
                    editions: [],
                    resourceBindings: result.resourceBindings,
                    expectedSource: input.verifiedSource.source,
                    expectedEngineArtifact: input.engineArtifact,
                    sourceText: row.text,
                  })
                )).reason
              ).toBe("stale-authority");
              const missing = A.map(result.resourceBindings, (binding) => ({ ...binding, candidates: [] }));
              expect(
                (yield* Effect.flip(
                  restoreCitationDocument({
                    receipt: result.receipt,
                    editions: [],
                    resourceBindings: missing,
                    expectedSource: input.verifiedSource.source,
                    expectedEngineArtifact: input.engineArtifact,
                    sourceText: row.text,
                  })
                )).reason
              ).toBe("stale-authority");
            }
          }
        }
        expect(checked).toBe(108);
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
        const ambiguousCase = yield* Effect.fromOption(A.findFirst(contexts, (row) => row.name === "short-ambiguous"));
        const ambiguousInput = yield* prepare(ambiguousCase);
        expect(
          (yield* Effect.flip(
            absent.resolve({ ...ambiguousInput, limits: { ...ambiguousInput.limits, resolutionEdges: 3 } })
          )).reason
        ).toBe("limit-exceeded");
        expect(
          A.getUnsafe(
            (yield* absent.resolve({ ...ambiguousInput, limits: { ...ambiguousInput.limits, resolutionEdges: 4 } }))
              .document.resolutions,
            2
          ).status
        ).toBe("Ambiguous");
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

  it.effect("keeps branch evidence on the issued callback result and occurrence only", () =>
    Effect.gen(function* () {
      const prepared = yield* prepareCitationResolution(yield* prepare(yield* selected));
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work)
      );
      const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, owner)
      );
      yield* owner.start;
      const mention = A.getUnsafe(prepared.mentions, 1);
      const result = yield* callbacks.shortCase({ mention, fulls: [] });
      const evidence = yield* readCitationDefaultObservation(result, mention.id);
      expect(O.isSome(evidence)).toBe(true);
      if (O.isSome(evidence))
        expect(evidence.value).toEqual({ _tag: "Unresolved", mentionId: mention.id, reason: "no-matching-authority" });
      expect(O.isNone(yield* readCitationDefaultObservation({ ...result }, mention.id))).toBe(true);
      expect(O.isNone(yield* readCitationDefaultObservation(result, A.getUnsafe(prepared.mentions, 0).id))).toBe(true);
      yield* owner.close;
    })
  );

  it.effect("rejects an ambiguity projection when trusted descriptors collapse all candidate labels", () =>
    Effect.gen(function* () {
      const row = yield* Effect.fromOption(A.findFirst((yield* cases).cases, (row) => row.name === "short-ambiguous"));
      const input = yield* prepare(row);
      const session = yield* runDefaultCitationCallbackSession(input);
      const identity = CitationResourceIdentity.cases.External.make({
        scope: input.engineArtifact,
        key: input.engineArtifact,
      });
      const projector = yield* makeCitationSessionDocumentProjector().pipe(
        Effect.provideService(
          CitationSessionResourceDescriptors,
          CitationSessionResourceDescriptors.of({
            describe: Effect.fn("BranchTest.collapsedLabels")(() => Effect.succeed(identity)),
          })
        )
      );
      expect((yield* Effect.flip(projector.project(session))).reason).toBe("identity-failed");
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
