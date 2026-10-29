import { fileURLToPath } from "node:url";
import {
  Citation,
  CitationEditionRef,
  CitationGroupMember,
  CitationMention,
  FullCitation,
} from "@beep/law-practice-domain/values";
import {
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/_test/Citation/FrozenEditions";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "@beep/law-practice-server/_test/Citation/ResourceObjects";
import {
  CitationRuntimeDictionaryComparison,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/_test/Citation/RuntimeDictionary";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type { CitationResourceObject } from "@beep/law-practice-server/_test/Citation/ResourceObjects";

const Operation = S.Union([
  S.Struct({ kind: S.tag("create"), reference: S.Natural }),
  S.Struct({ kind: S.tag("change"), reference: S.Natural, field: S.String, value: S.String }),
  S.Struct({ kind: S.tag("editions"), reference: S.Natural, values: S.Array(CitationEditionRef) }),
  S.Struct({ kind: S.tag("set"), resource: S.Natural, value: S.Natural }),
  S.Struct({ kind: S.Literals(["get", "hash", "remove"]), resource: S.Natural }),
  S.Struct({ kind: S.tag("equal"), left: S.Natural, right: S.Natural }),
  S.Struct({ kind: S.tag("clear") }),
]);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.Literal("citation-live-resources/v1"),
    cases: S.Array(
      S.Struct({
        name: S.String,
        identityMode: S.Literals(["content", "controlled-source-id-hook"]),
        initial: S.Array(CitationResourceModelInput),
        events: S.Array(
          S.Struct({
            operation: Operation,
            outcome: S.Json,
            entries: S.Array(S.Struct({ objectId: S.Natural, value: S.Natural })),
            comparisons: S.Array(S.Tuple([S.Natural, S.Natural])),
            publications: S.Array(
              S.Struct({ editions: S.Array(CitationEditionRef), selectedEdition: S.NullOr(CitationEditionRef) })
            ),
          })
        ),
      })
    ),
  })
);
const modelFailure = () => CitationResourceObjectFailure.make({ reason: "model-failed" });

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("mixed live resource objects", (it) => {
  it.effect("matches all 89 source events in one table using the real semantic owner and authenticated editions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/live-resources.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "92a6dd9e59d5808536a4a83b92f3a099713f690cca781dcd5cde1439e75e8b1f"
      );
      const data = yield* S.decodeEffect(Corpus)(raw);
      const frozen = yield* makeCitationFrozenEditions((yield* loadCitationFrozenEditionFixtures()).bundle);
      expect(data.cases).toHaveLength(6);
      let count = 0;
      for (const row of data.cases) {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: row.name,
            kinds: A.map(row.initial, (model) => model.citation.type),
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const mentions = A.map(input.mentions, (mention, index) =>
          CitationMention.make({ ...mention, citation: A.getUnsafe(row.initial, index).citation })
        );
        const prepared = yield* prepareCitationResolution({ ...input, mentions });
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        const reference = (index: number) =>
          CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, index).id });
        const models = CitationResourceModels.of({
          read: Effect.fn("MixedResourceTest.read")(function* (ref: CitationGroupMember) {
            const index =
              ref._tag === "Mention"
                ? A.findFirstIndex(prepared.mentions, (mention) => mention.id === ref.mentionId)
                : O.none();
            const position = yield* Effect.fromOption(index, modelFailure);
            const citation = yield* owner.citationOf(ref).pipe(Effect.mapError(modelFailure));
            if (!S.is(FullCitation)(citation)) return yield* modelFailure();
            return CitationResourceModelInput.make({
              citation,
              missingPageIdentityHash: A.getUnsafe(row.initial, position).missingPageIdentityHash,
            });
          }),
          step: work.step.pipe(Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))),
        });
        const objects = yield* makeCitationResourceObjects(prepared.limits).pipe(
          Effect.provideService(CitationResourceModels, models),
          Effect.provideService(CitationFrozenEditions, frozen)
        );
        let comparisons = A.empty<readonly [number, number]>();
        const comparison = CitationRuntimeDictionaryComparison.of({
          ...objects.comparison,
          equal: Effect.fn("MixedResourceTest.equal")((left: number, right: number) =>
            Effect.sync(() => {
              comparisons = A.append(comparisons, [left, right]);
            }).pipe(Effect.andThen(objects.comparison.equal(left, right)))
          ),
        });
        const table = yield* makeCitationRuntimeDictionary({
          entries: prepared.limits.authorities,
          iterations: prepared.limits.resolutionIterations,
        }).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
        let resources = A.empty<CitationResourceObject>();
        yield* Effect.acquireUseRelease(
          owner.start,
          () =>
            Effect.gen(function* () {
              for (const event of row.events) {
                comparisons = [];
                const operation = event.operation;
                let result: S.Json = null;
                if (operation.kind === "create") {
                  const resource = yield* objects.create(reference(operation.reference));
                  resources = A.append(resources, resource);
                  result = resource.slot;
                } else if (operation.kind === "change" || operation.kind === "editions") {
                  const ref = reference(operation.reference);
                  const wire = yield* S.encodeEffect(Citation)(yield* owner.citationOf(ref));
                  let value: Citation;
                  if (operation.kind === "change")
                    value = yield* S.decodeEffect(Citation)({
                      ...wire,
                      components: { ...wire.components, [operation.field]: operation.value },
                    });
                  else {
                    if (wire.type === "case") {
                      const initial = A.getUnsafe(row.initial, operation.reference).citation;
                      if (initial.type !== "case") return yield* modelFailure();
                      const editions = yield* Effect.forEach(operation.values, (ref) =>
                        Effect.fromOption(
                          A.findFirst(initial.publication.editions, (edition) => edition.edition === ref),
                          modelFailure
                        )
                      );
                      value = yield* S.decodeEffect(Citation)({
                        ...wire,
                        publication: { ...wire.publication, editions },
                      });
                    } else {
                      if (wire.type !== "law" && wire.type !== "journal") return yield* modelFailure();
                      value = yield* S.decodeEffect(Citation)({
                        ...wire,
                        publication: { ...wire.publication, editions: operation.values },
                      });
                    }
                  }
                  yield* owner.writeCitation(ref, value);
                } else if (operation.kind === "equal")
                  result = yield* comparison.equal(operation.left, operation.right);
                else if (operation.kind === "clear") yield* table.clear;
                else {
                  const key = yield* objects.key(A.getUnsafe(resources, operation.resource));
                  if (operation.kind === "hash") result = yield* S.encodeEffect(S.BigIntFromString)(key.hash);
                  else if (operation.kind === "set") yield* table.set(key, operation.value);
                  else
                    result = O.getOrElse(
                      O.map(
                        yield* operation.kind === "get" ? table.get(key) : table.remove(key),
                        (entry) => entry.value
                      ),
                      () => null
                    );
                }
                expect(result, `${row.name}:${count}`).toEqual(event.outcome);
                expect(
                  A.map(yield* table.read, (entry) => ({ objectId: entry.objectId, value: entry.value })),
                  row.name
                ).toEqual(event.entries);
                expect(comparisons, row.name).toEqual(event.comparisons);
                const publications = yield* Effect.forEach(
                  prepared.mentions,
                  (mention) =>
                    owner.citationOf(CitationGroupMember.cases.Mention.make({ mentionId: mention.id })).pipe(
                      Effect.flatMap((citation) => {
                        if (!S.is(FullCitation)(citation)) return Effect.fail(modelFailure());
                        return Effect.succeed({
                          editions:
                            citation.type === "case"
                              ? A.map(citation.publication.editions, (edition) => edition.edition)
                              : citation.publication.editions,
                          selectedEdition: O.getOrNull(citation.publication.selectedEdition),
                        });
                      })
                    ),
                  { concurrency: 1 }
                );
                expect(publications, row.name).toEqual(event.publications);
                count += 1;
              }
            }),
          () => objects.close.pipe(Effect.andThen(owner.close))
        );
      }
      expect(count).toBe(89);
    })
  );
});
