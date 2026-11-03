import { fileURLToPath } from "node:url";
import { Citation, CitationGroupMember, CitationMention } from "@beep/law-practice-domain/values";
import {
  CitationCallbackRuntimeIndexFactory,
  CitationMissingPageIdentities,
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
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";

const Corpus = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        name: S.String,
        input: S.Struct({
          citation: Citation,
          missingPageIdentityHash: S.BigIntFromString.pipe(S.NullOr, S.optionalKey),
        }),
        expected: S.Struct({ resourceHash: S.optionalKey(S.String) }),
      })
    ),
  })
);
const load = Effect.fn("CanonicalDescriptorsTest.load")(function* (file: string, digest: string) {
  const text = yield* (yield* FileSystem.FileSystem).readFileString(
    fileURLToPath(new URL(`../../use-cases/test/fixtures/eyecite/${file}`, import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text))).toBe(digest);
  return (yield* S.decodeEffect(Corpus)(text)).cases;
});
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("default registered session descriptors", (it) => {
  it.effect("carries source-controlled null-page identities through dispatch and sealed projection", () =>
    Effect.gen(function* () {
      const rows = A.filter(
        yield* load("case-resource-hashes.json", "b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4"),
        (row) =>
          row.name === "null-page" ||
          row.name === "null-page-same-identity" ||
          row.name === "null-page-other-identity" ||
          row.name === "null-page-lazy-edition"
      );
      expect(rows).toHaveLength(4);
      const input = yield* prepareCallbackObservation(
        CitationCallbackObservation.make({
          name: "controlled-null-identities",
          kinds: ["case", "case", "case", "case"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      const prepared = yield* prepareCitationResolution({
        ...input,
        mentions: A.map(input.mentions, (mention, i) =>
          CitationMention.make({ ...mention, citation: A.getUnsafe(rows, i).input.citation })
        ),
      });
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      let builds = 0;
      let reads = 0;
      const identities = CitationMissingPageIdentityFactory.of({
        build: Effect.sync(() => {
          builds++;
          return CitationMissingPageIdentities.of({
            read: Effect.fn("NullPageTest.read")(function* (reference: CitationGroupMember) {
              reads++;
              const index = A.findFirstIndex(
                prepared.mentions,
                (mention) => reference._tag === "Mention" && mention.id === reference.mentionId
              );
              if (O.isNone(index)) return yield* CitationCallbackFailure.make({ reason: "identity-failed" });
              return yield* Effect.fromOption(
                O.fromNullishOr(A.getUnsafe(rows, index.value).input.missingPageIdentityHash),
                () => CitationCallbackFailure.make({ reason: "identity-failed" })
              );
            }),
          });
        }),
      });
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(CitationMissingPageIdentityFactory, identities)
      );
      const work = yield* makeCitationResolutionWork(prepared.limits);
      const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
      );
      const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, owner)
      );
      const observing = CitationResolutionCallbacks.of({
        ...callbacks,
        full: Effect.fn("NullPageTest.alias")(function* (mention: CitationMention) {
          const resource = yield* callbacks.full(mention);
          const alias = yield* owner.canonicalResource(
            CitationGroupMember.cases.Mention.make({ mentionId: mention.id })
          );
          expect(yield* owner.uniqueResourceCount([resource, alias])).toBe(1);
          return resource;
        }),
      });
      const state = yield* runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionWork, work),
        Effect.provideService(CitationCallbackDictionary, owner),
        Effect.provideService(CitationResolutionCallbacks, observing)
      );
      expect(builds).toBe(1);
      expect(reads).toBe(4);
      const indices = HashMap.fromIterable(A.map(prepared.mentions, (mention, i) => [mention.id, i] as const));
      expect(
        A.map(state.groups, (group) =>
          A.map(group.members, (reference) =>
            reference._tag === "Mention" ? O.getOrElse(HashMap.get(indices, reference.mentionId), () => -1) : -1
          )
        )
      ).toEqual([[0, 1, 3], [2]]);
      const descriptors = yield* makeCitationRegisteredSessionDescriptors(state).pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      yield* Effect.forEach(
        A.map(state.decisions, (decision, i) => [decision, i] as const),
        Effect.fnUntraced(function* ([decision, i]) {
          const descriptor = yield* descriptors.describe(decision.resource);
          if (descriptor._tag !== "External") return yield* Effect.die("expected canonical descriptor");
          expect(descriptor.key).toBe(
            yield* S.decodeEffect(Sha256HexFromBytes)(
              new TextEncoder().encode(
                `["eyecite-resource-current-hash/v1","${A.getUnsafe(rows, i).expected.resourceHash}"]`
              )
            )
          );
        }),
        { concurrency: 1, discard: true }
      );
      const projector = yield* makeCitationSessionDocumentProjector().pipe(
        Effect.provideService(CitationSessionResourceDescriptors, descriptors)
      );
      expect((yield* projector.project(state)).document.groups).toHaveLength(2);
      expect(reads).toBe(4);
    })
  );
  it.effect("uses source-observed current hashes for real frozen case, law and journal models", () =>
    Effect.gen(function* () {
      const cases = yield* load(
        "case-resource-hashes.json",
        "b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4"
      );
      const publications = yield* load(
        "publication-resource-hashes.json",
        "57962d12465617aca8f4f483329ac1c0ef94b2f2c866e7f836edc0a29a7e8599"
      );
      const rows = [
        ...A.filter(cases, (row) => row.name === "page-1" || row.name === "page-2" || row.name === "page-20"),
        ...A.filter(publications, (row) => row.name === "law" || row.name === "journal"),
      ];
      expect(rows).toHaveLength(5);
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      const factory = yield* makeCitationCallbackRuntimeIndexFactory().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const scope = yield* S.decodeEffect(Sha256HexFromBytes)(
        new TextEncoder().encode(
          '["citation-canonical-resource-descriptor/v1","eyecite/2.7.6","04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"]'
        )
      );
      yield* Effect.forEach(
        rows,
        Effect.fnUntraced(function* (row) {
          if (row.expected.resourceHash === undefined) return yield* Effect.die("selected source row has no hash");
          const kind = row.input.citation.type;
          if (kind !== "case" && kind !== "law" && kind !== "journal")
            return yield* Effect.die("unexpected source family");
          const input = yield* prepareCallbackObservation(
            CitationCallbackObservation.make({
              name: row.name,
              kinds: [kind],
              pages: {},
              bindings: {},
              events: [],
              outcome: { status: "value", groups: [] },
            })
          );
          const prepared = yield* prepareCitationResolution({
            ...input,
            mentions: A.map(input.mentions, (mention) =>
              CitationMention.make({ ...mention, citation: row.input.citation })
            ),
          });
          const work = yield* makeCitationResolutionWork(prepared.limits);
          const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackRuntimeIndexFactory, factory)
          );
          const defaults = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackDictionary, owner)
          );
          let alias: CitationCallbackResource = CitationCallbackResource.cases.None.make({});
          let unusedNull: CitationCallbackResource = CitationCallbackResource.cases.None.make({});
          const callbacks = CitationResolutionCallbacks.of({
            ...defaults,
            full: Effect.fn("CanonicalDescriptorsTest.full")(
              function* (mention: CitationMention) {
                const result = yield* defaults.full(mention);
                alias = yield* owner.canonicalResource(
                  CitationGroupMember.cases.Mention.make({ mentionId: mention.id })
                );
                if (row.name === "page-1") {
                  const wire = yield* S.encodeEffect(Citation)(mention.citation);
                  const citation = yield* S.decodeEffect(Citation)({
                    ...wire,
                    components: { ...wire.components, page: null },
                  });
                  unusedNull = yield* owner.canonicalResource(yield* owner.registerDetached(citation));
                }
                return result;
              },
              Effect.mapError(() => CitationCallbackFailure.make({ reason: "invalid-input" }))
            ),
          });
          const state = yield* runPreparedCitationCallbackSession(prepared).pipe(
            Effect.provideService(CitationResolutionWork, work),
            Effect.provideService(CitationCallbackDictionary, owner),
            Effect.provideService(CitationResolutionCallbacks, callbacks)
          );
          const descriptors = yield* makeCitationRegisteredSessionDescriptors(state).pipe(
            Effect.provideService(CitationFrozenEditions, frozen)
          );
          const descriptor = yield* descriptors.describe(A.getUnsafe(state.groups, 0).resource);
          expect(descriptor._tag).toBe("External");
          if (descriptor._tag !== "External") return yield* Effect.die("unexpected descriptor family");
          const expectedKey = yield* S.decodeEffect(Sha256HexFromBytes)(
            new TextEncoder().encode(`["eyecite-resource-current-hash/v1","${row.expected.resourceHash}"]`)
          );
          expect(descriptor.scope, row.name).toBe(scope);
          expect(descriptor.key, row.name).toBe(expectedKey);
          expect(yield* descriptors.describe(alias), row.name).toEqual(descriptor);
          if (row.name === "page-1")
            expect((yield* Effect.flip(descriptors.describe(unusedNull))).reason).toBe("identity-failed");
          const projector = yield* makeCitationSessionDocumentProjector().pipe(
            Effect.provideService(CitationSessionResourceDescriptors, descriptors)
          );
          expect((yield* projector.project(state)).document.groups).toHaveLength(1);
        }),
        { concurrency: 1, discard: true }
      );
    })
  );
});
