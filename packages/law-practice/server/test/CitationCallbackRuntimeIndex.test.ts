import * as NodeURL from "node:url";
import {
  Citation,
  CitationDocumentReceipt,
  CitationGroupMember,
  CitationMention,
  CitationMentionId,
  citationAuthorityMembers,
  citationGroupMembers,
} from "@beep/law-practice-domain/values";
import {
  CitationCallbackRuntimeIndexFactory,
  CitationMissingPageIdentityFactory,
  makeCitationCallbackRuntimeIndexFactory,
} from "@beep/law-practice-server/internal/Citation/CallbackRuntimeIndex";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/internal/Citation/CallbackSession";
import { makeDefaultCitationResolutionCallbacks } from "@beep/law-practice-server/internal/Citation/DefaultCallbacks";
import { restoreCitationDocument } from "@beep/law-practice-server/internal/Citation/Document";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import { makeCitationRegisteredSessionDescriptors } from "@beep/law-practice-server/internal/Citation/SessionDescriptors";
import {
  CitationSessionResourceDescriptors,
  makeCitationSessionDocumentProjector,
} from "@beep/law-practice-server/internal/Citation/SessionDocument";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  CitationCallbackObservation,
  callbackResourcePresentation,
  normalizeCallbackFixtureResource,
  prepareCallbackObservation,
} from "./CitationCallbackSession.fixtures.ts";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type {
  CitationFullsCallbackInput,
  CitationIdCallbackInput,
} from "@beep/law-practice-server/internal/Citation/CallbackSession";

const JsonMetadata = S.Record(S.String, S.Json);

const SourceView = S.Struct({
  groups: S.Record(S.String, S.String),
  metadata: S.Struct({
    plaintiff: S.NullOr(S.String),
    antecedent_guess: S.NullOr(S.String),
    pin_cite: S.NullOr(S.String),
  }),
});
const Corpus = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        name: S.String,
        family: S.String,
        kinds: S.Array(S.Literals(["case", "supra", "short", "id"])),
        initialObjects: S.Array(SourceView),
        events: S.Array(S.Json),
        outcome: S.Json,
        objects: S.Array(S.Json),
      })
    ),
  })
);
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });
const Presentation = S.Struct({ mentionId: CitationMentionId });

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("registered callback runtime dictionary", (it) => {
  it.effect("bounds issued slots, exposes canonical equality keys and rejects absent host ownership", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(bundle);
      const input = yield* prepareCallbackObservation(
        CitationCallbackObservation.make({
          name: "bounded-runtime-slots",
          kinds: ["case"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      const mention = A.getUnsafe(input.mentions, 0);
      const wire = yield* S.encodeEffect(Citation)(mention.citation);
      const citation = yield* S.decodeEffect(Citation)({
        ...wire,
        components: { ...wire.components, page: "1", reporter: "U.S." },
      });
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const index = yield* factory.build({
        limits: { ...input.limits, resolutionIterations: 1 },
        step: Effect.void,
        read: Effect.fn("RuntimeSlotTest.read")(() => Effect.succeed(citation)),
      });
      const absent = yield* index.createHost({ token: "host-without-adapter" }).pipe(Effect.flip);
      expect(absent.reason).toBe("identity-failed");
      const reference = CitationGroupMember.cases.Mention.make({ mentionId: mention.id });
      const resource = yield* index.create(reference);
      const key = yield* index.equalityKey(resource);
      const repeated = yield* index.equalityKey(resource);
      expect(repeated).toBe(key);
      const hash = yield* S.decodeEffect(S.BigIntFromString)(key);
      expect(hash).toBeGreaterThanOrEqual(BigInt(0));
      const falsy = yield* normalizeCallbackFixtureResource(false);
      const isFalsy = yield* index.isTruthy(falsy);
      expect(isFalsy).toBe(false);
      const unhashable = CitationCallbackResource.cases.Unhashable.make({ truthy: true, value: [] });
      const isTruthy = yield* index.isTruthy(unhashable);
      expect(isTruthy).toBe(true);
      const exhausted = yield* index.create(reference).pipe(Effect.flip);
      expect(exhausted.reason).toBe("limit-exceeded");
      const entries = yield* index.read;
      expect(entries).toEqual([]);
      yield* index.close;
      const closed = yield* index.create(reference).pipe(Effect.flip);
      expect(closed.reason).toBe("identity-failed");
    })
  );

  it.effect("refuses failed live models and missing-page identity providers without publishing entries", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(bundle);
      const input = yield* prepareCallbackObservation(
        CitationCallbackObservation.make({
          name: "runtime-model-failure",
          kinds: ["case", "id"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      const first = A.getUnsafe(input.mentions, 0);
      const ref = CitationGroupMember.cases.Mention.make({ mentionId: first.id });
      const encoded = yield* S.encodeEffect(Citation)(first.citation);
      const missingPage = yield* S.decodeEffect(Citation)({
        ...encoded,
        components: { ...encoded.components, page: null },
      });
      const malformed = yield* S.decodeEffect(Citation)(encoded);
      Reflect.set(malformed.components, "page", 42);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(CitationMissingPageIdentityFactory, {
          build: Effect.succeed({ read: () => Effect.fail(invalid()) }),
        })
      );
      for (const read of [
        Effect.fail(invalid()),
        Effect.succeed(A.getUnsafe(input.mentions, 1).citation),
        Effect.succeed(malformed),
        Effect.succeed(missingPage),
      ]) {
        const index = yield* factory.build({ limits: input.limits, step: Effect.void, read: () => read });
        const resource = yield* index.create(ref);
        const failure = yield* index.get(resource).pipe(Effect.flip);
        expect(failure.reason).toBe("identity-failed");
        const entries = yield* index.read;
        expect(entries).toEqual([]);
        yield* index.close;
        const closed = yield* index.uniqueCount([]).pipe(Effect.flip);
        expect(closed.reason).toBe("identity-failed");
      }
    })
  );

  it.effect("executes all three mutable default-key source scenes with complete callback events and final groups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/model-mutation-observations.json", import.meta.url)
        )
      );
      const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult1).toBe("dca8b55d551d50c6ca0a2917ebce372b20894d4001b7a9738053c7d96d3cf841");
      const citationResult2 = yield* S.decodeEffect(Corpus)(raw);
      const rows = A.filter(citationResult2.cases, (row) => row.family === "mutable-key");
      expect(rows).toHaveLength(3);
      const citationResult3 = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(citationResult3.bundle);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      yield* Effect.forEach(
        rows,
        Effect.fnUntraced(function* (row) {
          const input = yield* prepareCallbackObservation(
            CitationCallbackObservation.make({
              name: row.name,
              kinds: row.kinds,
              pages: {},
              bindings: {},
              events: [],
              outcome: { status: "value", groups: [] },
            })
          );
          const mentions = yield* Effect.forEach(input.mentions, (mention, index) =>
            Effect.gen(function* () {
              const wire = yield* S.encodeEffect(Citation)(mention.citation);
              const source = A.getUnsafe(row.initialObjects, index);
              const citation = yield* S.decodeUnknownEffect(Citation)({
                ...wire,
                components: source.groups,
                metadata: {
                  ...wire.metadata,
                  ...(wire.type === "case" ? { plaintiff: source.metadata.plaintiff } : {}),
                  ...(wire.type === "supra" || wire.type === "shortFormCase"
                    ? { antecedentGuess: source.metadata.antecedent_guess }
                    : {}),
                  pinCite: source.metadata.pin_cite,
                },
              });
              return CitationMention.make({ ...mention, citation });
            })
          );
          const prepared = yield* prepareCitationResolution({ ...input, mentions });
          const work = yield* makeCitationResolutionWork(prepared.limits);
          const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
          );
          const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackDictionary, owner)
          );
          const ref = (mention: CitationMention) => CitationGroupMember.cases.Mention.make({ mentionId: mention.id });
          const indexOf = (id: CitationMentionId) =>
            O.getOrElse(
              A.findFirstIndex(prepared.mentions, (mention) => mention.id === id),
              () => -1
            );
          const referenceView = (reference: CitationGroupMember) =>
            reference._tag === "Mention"
              ? { kind: "input", index: indexOf(reference.mentionId) }
              : { kind: "detached", slot: 0 };
          const semanticView = Effect.fn("RuntimeCallbackTest.semanticView")(function* (
            reference: CitationGroupMember,
            citation: Citation
          ) {
            const wire = yield* S.encodeEffect(Citation)(citation);
            const metadata = yield* S.decodeEffect(JsonMetadata)(wire.metadata);
            return {
              reference: referenceView(reference),
              groups: wire.components,
              metadata: {
                plaintiff: O.getOrElse(R.get(metadata, "plaintiff"), () => null),
                antecedent_guess: O.getOrElse(R.get(metadata, "antecedentGuess"), () => null),
                pin_cite: O.getOrElse(R.get(metadata, "pinCite"), () => null),
              },
            };
          }, Effect.mapError(invalid));
          const view = Effect.fn("RuntimeCallbackTest.view")((reference: CitationGroupMember) =>
            owner.citationOf(reference).pipe(Effect.flatMap((citation) => semanticView(reference, citation)))
          );
          const objects = Effect.forEach(prepared.mentions, (mention) => view(ref(mention)), { concurrency: 1 });
          const present = Effect.fn("RuntimeCallbackTest.present")(function* (
            resource: CitationCallbackResource,
            final?: ReadonlyArray<CitationMention>
          ) {
            if (resource._tag === "None") return callbackResourcePresentation(resource);
            if (resource._tag !== "Registered") return yield* invalid();
            const data = yield* S.decodeUnknownEffect(Presentation)(resource.value);
            const reference = CitationGroupMember.cases.Mention.make({ mentionId: data.mentionId });
            const citation =
              final === undefined
                ? yield* owner.citationOf(reference)
                : A.getUnsafe(final, indexOf(data.mentionId)).citation;
            return { kind: "default", slot: resource.slot, citation: yield* semanticView(reference, citation) };
          }, Effect.mapError(invalid));
          const change = Effect.fn("RuntimeCallbackTest.change")(function* (
            reference: CitationGroupMember,
            page: string
          ) {
            const citationResult4 = yield* owner.citationOf(reference);
            const wire = yield* S.encodeEffect(Citation)(citationResult4);
            const citationResult5 = yield* S.decodeEffect(Citation)({
              ...wire,
              components: { ...wire.components, page },
            });
            yield* owner.writeCitation(reference, citationResult5);
          }, Effect.mapError(invalid));
          let events = A.empty<S.Json>();
          const callbacks = CitationResolutionCallbacks.of({
            ...defaults,
            full: Effect.fn("RuntimeCallbackTest.full")(function* (mention: CitationMention) {
              const before = yield* objects;
              const resource = yield* defaults.full(mention);
              if (row.name === "default-page-before-insertion") yield* change(ref(mention), "2");
              const citationResult6 = yield* objects;
              const citationResult7 = yield* present(resource);
              events = A.append(events, {
                slot: "full",
                mention: indexOf(mention.id),
                before,
                after: citationResult6,
                result: citationResult7,
              });
              return resource;
            }),
            supra: Effect.fn("RuntimeCallbackTest.supra")(function* (arg: CitationFullsCallbackInput) {
              const before = yield* Effect.forEach(arg.fulls, (entry) => view(entry.citation), { concurrency: 1 });
              yield* change(
                A.getUnsafe(arg.fulls, 0).citation,
                row.name === "default-page-after-insertion-two" ? "2" : "20"
              );
              const output = yield* defaults.supra(arg);
              const citationResult8 = yield* owner.readFulls;
              const citationResult9 = yield* Effect.forEach(citationResult8, (entry) => view(entry.citation), {
                concurrency: 1,
              });
              const citationResult10 = yield* view(ref(arg.mention));
              const citationResult11 = yield* present(output.resource);
              events = A.append(events, {
                slot: "supra",
                mention: indexOf(arg.mention.id),
                before,
                after: citationResult9,
                current: citationResult10,
                result: citationResult11,
              });
              return output;
            }),
            id: Effect.fn("RuntimeCallbackTest.id")(function* (arg: CitationIdCallbackInput) {
              const before = yield* Effect.forEach(
                A.flatMap(arg.groups, (group) => group.members),
                view,
                { concurrency: 1 }
              );
              const output = yield* defaults.id(arg);
              const citationResult12 = yield* owner.read;
              const citationResult13 = yield* Effect.forEach(
                A.flatMap(citationResult12, (group) => group.members),
                view,
                { concurrency: 1 }
              );
              const citationResult14 = yield* view(ref(arg.mention));
              const citationResult15 = yield* present(output.resource);
              events = A.append(events, {
                slot: "id",
                mention: indexOf(arg.mention.id),
                before,
                after: citationResult13,
                current: citationResult14,
                result: citationResult15,
              });
              return output;
            }),
          });
          const result = yield* runPreparedCitationCallbackSession(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackDictionary, owner),
            Effect.provideService(CitationResolutionCallbacks, callbacks)
          );
          expect(events, row.name).toEqual(row.events);
          const groups = yield* Effect.forEach(result.groups, (group) =>
            present(group.resource, result.mentions).pipe(
              Effect.map((resource) => ({ resource, members: A.map(group.members, referenceView) }))
            )
          );
          expect({ status: "value", groups }, row.name).toEqual(row.outcome);
          const citationResult16 = yield* Effect.forEach(result.mentions, (mention) =>
            semanticView(ref(mention), mention.citation)
          );
          expect(citationResult16, row.name).toEqual(row.objects);
          const descriptors = yield* makeCitationRegisteredSessionDescriptors(result).pipe(
            Effect.provideService(CitationFrozenEditions, frozen)
          );
          const projector = yield* makeCitationSessionDocumentProjector().pipe(
            Effect.provideService(CitationSessionResourceDescriptors, descriptors)
          );
          const { document, receipt, resourceBindings } = yield* projector.project(result);
          const authorityId = A.getUnsafe(document.authorities, 0).id;
          expect(A.map(result.decisions, (decision) => decision.mentionId)).toEqual(
            A.map(result.mentions, (mention) => mention.id)
          );
          expect(
            A.map(result.decisions, (decision) =>
              O.getOrElse(
                O.map(decision.assignment, (assignment) => assignment.entrySlot),
                () => -1
              )
            ),
            row.name
          ).toEqual(row.name === "default-page-after-insertion" ? [0, 1, 1] : A.map(result.mentions, () => 0));
          const codec = S.fromJsonString(CitationDocumentReceipt);
          const citationResult17 = yield* S.encodeEffect(codec)(receipt);
          const persisted = yield* S.decodeEffect(codec)(citationResult17);
          const restored = yield* restoreCitationDocument({
            receipt: persisted,
            editions: [],
            resourceBindings,
            expectedSource: prepared.source,
            expectedEngineArtifact: prepared.engineArtifact,
            sourceText: A.join("")(A.map(prepared.mentions, (_, index) => `witness-${index}; `)),
          });
          expect(restored.groups, row.name).toEqual(document.groups);
          expect(restored.memberLists, row.name).toEqual(document.memberLists);
          expect(
            A.map(restored.groups, (entry) => A.map(citationGroupMembers(restored, entry.id), referenceView)),
            row.name
          ).toEqual(A.map(result.groups, (group) => A.map(group.members, referenceView)));
          expect(citationAuthorityMembers(restored, authorityId)).toEqual(
            A.flatMap(result.groups, (group) => group.members)
          );
          if (A.length(restored.groups) === 2) {
            expect(A.getUnsafe(restored.groups, 0).authorityId).toBe(A.getUnsafe(restored.groups, 1).authorityId);
            expect(A.getUnsafe(restored.groups, 0).id).not.toBe(A.getUnsafe(restored.groups, 1).id);
          }
          if (row.name === "default-page-before-insertion") {
            const replayWork = yield* makeCitationResolutionWork(prepared.limits);
            const replayOwner = yield* makeCitationCallbackDictionary(prepared).pipe(
              Effect.provideService(CitationResolutionWork, replayWork),
              Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
            );
            const replayDefaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
              Effect.provideService(CitationResolutionWork, replayWork),
              Effect.provideService(CitationCallbackDictionary, replayOwner)
            );
            const replayCallbacks = CitationResolutionCallbacks.of({
              ...replayDefaults,
              full: Effect.fn("RuntimeSessionProjector.replayFull")(function* (mention: CitationMention) {
                const resource = yield* replayDefaults.full(mention);
                const reference = ref(mention);
                const citationResult18 = yield* replayOwner.citationOf(reference);
                const wire = yield* S.encodeEffect(Citation)(citationResult18).pipe(Effect.mapError(invalid));
                const citationResult19 = yield* S.decodeEffect(Citation)({
                  ...wire,
                  components: { ...wire.components, page: "2" },
                }).pipe(Effect.mapError(invalid));
                yield* replayOwner.writeCitation(reference, citationResult19);
                return resource;
              }),
            });
            const replay = yield* runPreparedCitationCallbackSession(prepared).pipe(
              Effect.provideService(CitationResolutionWork, replayWork),
              Effect.provideService(CitationCallbackDictionary, replayOwner),
              Effect.provideService(CitationResolutionCallbacks, replayCallbacks)
            );
            const firstResource = A.getUnsafe(result.decisions, 0).resource;
            const secondResource = A.getUnsafe(replay.decisions, 0).resource;
            expect(
              firstResource._tag === "Registered" &&
                secondResource._tag === "Registered" &&
                firstResource.scope !== secondResource.scope
            ).toBe(true);
            const replayDescriptors = yield* makeCitationRegisteredSessionDescriptors(replay).pipe(
              Effect.provideService(CitationFrozenEditions, frozen)
            );
            const replayProjector = yield* makeCitationSessionDocumentProjector().pipe(
              Effect.provideService(CitationSessionResourceDescriptors, replayDescriptors)
            );
            const projectedReplay = yield* replayProjector.project(replay);
            expect(projectedReplay.receipt).toEqual(receipt);
            expect(projectedReplay.resourceBindings).toEqual(resourceBindings);
          }
          for (const [index, mention] of A.map(result.mentions, (mention, index) => [index, mention] as const)) {
            expect(mention.id).toBe(A.getUnsafe(prepared.mentions, index).id);
            expect(mention.anchor).toBe(A.getUnsafe(prepared.mentions, index).anchor);
          }
        }),
        { concurrency: 1, discard: true }
      );
    })
  );
  it.effect("preserves runtime list aliases and rejects forged/foreign references without corrupting entries", () =>
    Effect.gen(function* () {
      const citationResult20 = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(citationResult20.bundle);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const input = yield* prepareCallbackObservation(
        CitationCallbackObservation.make({
          name: "runtime-owner-controls",
          kinds: ["case", "case"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      const prepared = yield* prepareCitationResolution({ ...input, limits: { ...input.limits, authorities: 1 } });
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
      );
      const ref = CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, 0).id });
      const other = CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, 1).id });
      yield* Effect.acquireUseRelease(
        owner.start,
        () =>
          Effect.gen(function* () {
            const citationResult21 = yield* owner.readListNodes;
            expect(citationResult21).toEqual([]);
            const first = yield* owner.canonicalResource(ref);
            const alias = yield* owner.canonicalResource(ref);
            const list = yield* owner.allocate([ref]);
            yield* owner.set(first, list);
            const citationResult22 = yield* owner.get(alias);
            expect(citationResult22.slot).toBe(list.slot);
            yield* owner.write(list, [other, ref]);
            const citationResult23 = yield* owner.get(first);
            const citationResult24 = yield* owner.readList(citationResult23);
            expect(citationResult24).toEqual([other, ref]);
            const before = yield* owner.read;
            if (first._tag !== "Registered") return yield* invalid();
            const citationResult25 = yield* Effect.flip(owner.get({ ...first, slot: 999 }));
            expect(citationResult25.reason).toBe("identity-failed");
            const citationResult26 = yield* normalizeCallbackFixtureResource("base");
            const citationResult27 = yield* Effect.flip(owner.get(citationResult26));
            expect(citationResult27.reason).toBe("identity-failed");
            const citationResult28 = yield* Effect.flip(
              owner.resourceKey(CitationCallbackResource.cases.Unhashable.make({ truthy: false, value: [] }))
            );
            expect(citationResult28.reason).toBe("unhashable-resource");
            const citationResult29 = yield* owner.read;
            expect(citationResult29).toEqual(before);
            const foreignWork = yield* makeCitationResolutionWork(prepared.limits);
            const foreign = yield* makeCitationCallbackDictionary(prepared).pipe(
              Effect.provideService(CitationResolutionWork, foreignWork),
              Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
            );
            yield* Effect.acquireUseRelease(
              foreign.start,
              () =>
                Effect.gen(function* () {
                  const resource = yield* foreign.canonicalResource(ref);
                  const citationResult30 = yield* Effect.flip(owner.validateResource(resource));
                  expect(citationResult30.reason).toBe("identity-failed");
                }),
              () => foreign.close
            );
            const citationResult31 = yield* Effect.flip(
              owner.validateResource({ ...first, value: "forged canonical presentation" })
            );
            expect(citationResult31.reason).toBe("identity-failed");
            yield* owner.clear;
            const citationResult32 = yield* owner.read;
            expect(citationResult32).toEqual([]);
            yield* owner.write(list, []);
            yield* owner.set(first, list);
            const citationResult33 = yield* owner.read;
            expect(citationResult33[0]?.members).toEqual([]);
            const citationResult34 = yield* owner.remove(first);
            assertSome(
              O.map(citationResult34, (handle) => handle.slot),
              list.slot
            );
            const citationResult35 = yield* owner.read;
            expect(citationResult35).toEqual([]);
            const citationResult36 = yield* owner.readList(list);
            expect(citationResult36).toEqual([]);
          }),
        () => owner.close
      );
      const citationResult37 = yield* Effect.flip(owner.read);
      expect(citationResult37.reason).toBe("invalid-input");
    })
  );
  it.effect("refuses index issuance when captured entropy or hashing fails", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(bundle);
      const random = yield* SecureRandom.SecureRandom;
      const digest = yield* Digest.Digest;
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const owner = { limits, read: () => Effect.fail(invalid()), step: Effect.void };
      const cases = [
        { random: { ...random, randomBytes: () => Effect.die("synthetic entropy failure") }, digest },
        { random, digest: makeTestCitationDigest(() => Effect.die("synthetic digest failure")) },
        { random, digest: makeTestCitationDigest(() => Effect.succeed(new Uint8Array(1))) },
      ];
      for (const row of cases) {
        const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(SecureRandom.SecureRandom, row.random),
          Effect.provideService(Digest.Digest, row.digest)
        );
        const failure = yield* factory.build(owner).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "identity-failed" });
        expect("cause" in failure).toBe(false);
      }
    })
  );
});
