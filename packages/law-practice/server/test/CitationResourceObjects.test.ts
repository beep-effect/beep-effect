import { fileURLToPath } from "node:url";
import {
  Citation,
  CitationGroupMember,
  CitationMention,
  CitationMentionId,
  FullCaseCitation,
} from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
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
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
} from "../src/internal/Citation/CallbackSession.ts";
import { CitationFrozenEditionFailure, CitationFrozenEditions } from "../src/internal/Citation/FrozenEditions.ts";
import { prepareCitationResolution } from "../src/internal/Citation/ResolutionInput.ts";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObject,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "../src/internal/Citation/ResourceObjects.ts";
import {
  CitationRuntimeDictionaryComparison,
  makeCitationRuntimeDictionary,
} from "../src/internal/Citation/RuntimeDictionary.ts";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";

// These histories have no selected edition; any artifact lookup is a regression.
const unusedEditions = CitationFrozenEditions.of({
  lookup: Effect.fn("CaseOnlyTest.unusedEdition")(() =>
    Effect.fail(CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
  ),
  lookupMany: Effect.fn("CaseOnlyTest.unusedEditions")(() =>
    Effect.fail(CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
  ),
});
const Operation = S.Union([
  S.Struct({ kind: S.tag("create"), reference: S.Natural }),
  S.Struct({ kind: S.tag("change"), reference: S.Natural, field: S.Literals(["page", "reporter"]), value: S.String }),
  S.Struct({ kind: S.tag("set"), resource: S.Natural, value: S.Natural }),
  S.Struct({ kind: S.Literals(["get", "hash", "remove"]), resource: S.Natural }),
  S.Struct({ kind: S.tag("equal"), left: S.Natural, right: S.Natural }),
  S.Struct({ kind: S.tag("clear") }),
]);
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-live-case-resources/v1"),
  cases: S.Array(
    S.Struct({
      name: S.String,
      initial: S.Array(S.Record(S.String, S.String)),
      events: S.Array(
        S.Struct({
          operation: Operation,
          outcome: S.Json,
          entries: S.Array(S.Struct({ objectId: S.Natural, value: S.Natural })),
          comparisons: S.Array(S.Tuple([S.Natural, S.Natural])),
        })
      ),
    })
  ),
});
const CorpusJson = S.fromJsonString(Corpus);

const modelFailure = () => CitationResourceObjectFailure.make({ reason: "model-failed" });

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("live case-resource objects", (it) => {
  it.effect("composes current semantic owner fields and exact hashes with the source table in all 38 events", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/live-case-resources.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "ec5e5887236e755082f1c2e56f87f6f0f4de68e815f471fda20505977597b791"
      );
      const data = yield* S.decodeEffect(CorpusJson)(raw);
      expect(data.cases).toHaveLength(5);
      let events = 0;
      for (const row of data.cases) {
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: row.name,
            kinds: A.map(row.initial, () => "case"),
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const mentions = yield* Effect.forEach(input.mentions, (mention, index) =>
          Effect.gen(function* () {
            const wire = yield* S.encodeEffect(Citation)(mention.citation);
            if (wire.type !== "case") return yield* modelFailure();
            const citation = yield* S.decodeEffect(FullCaseCitation)({
              ...wire,
              components: A.getUnsafe(row.initial, index),
              publication: { ...wire.publication, selectedEdition: null },
            });
            return CitationMention.make({ ...mention, citation });
          })
        );
        const prepared = yield* prepareCitationResolution({ ...input, mentions });
        const work = yield* makeCitationResolutionWork(prepared.limits);
        const owner = yield* makeCitationCallbackDictionary(prepared).pipe(
          Effect.provideService(CitationResolutionWork, work)
        );
        const reference = (index: number) =>
          CitationGroupMember.cases.Mention.make({ mentionId: A.getUnsafe(prepared.mentions, index).id });
        const models = CitationResourceModels.of({
          read: Effect.fn("LiveCaseTest.read")(function* (ref: CitationGroupMember) {
            const citation = yield* owner.citationOf(ref).pipe(Effect.mapError(modelFailure));
            if (citation.type !== "case") return yield* modelFailure();
            return CitationResourceModelInput.make({
              citation,
              missingPageIdentityHash: O.none(),
            });
          }),
          step: work.step.pipe(Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))),
        });
        const objects = yield* makeCitationResourceObjects(prepared.limits).pipe(
          Effect.provideService(CitationResourceModels, models),
          Effect.provideService(CitationFrozenEditions, unusedEditions)
        );
        let comparisons = A.empty<readonly [number, number]>();
        const comparison = CitationRuntimeDictionaryComparison.of({
          ...objects.comparison,
          equal: Effect.fn("LiveCaseTest.equal")((left: number, right: number) =>
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
                let outcome: S.Json;
                if (operation.kind === "create") {
                  const resource = yield* objects.create(reference(operation.reference));
                  resources = A.append(resources, resource);
                  result = resource.slot;
                } else if (operation.kind === "change") {
                  const ref = reference(operation.reference);
                  const wire = yield* S.encodeEffect(Citation)(yield* owner.citationOf(ref));
                  const citation = yield* S.decodeEffect(Citation)({
                    ...wire,
                    components: { ...wire.components, [operation.field]: operation.value },
                  });
                  yield* owner.writeCitation(ref, citation);
                } else if (operation.kind === "equal")
                  result = yield* comparison.equal(operation.left, operation.right);
                else if (operation.kind === "clear") yield* table.clear;
                else {
                  const resource = A.getUnsafe(resources, operation.resource);
                  const current = yield* Effect.result(objects.key(resource));
                  if (current._tag === "Failure") {
                    expect(operation.kind).toBe("hash");
                    expect(current.failure.reason).toBe("missing-reporter");
                    outcome = { status: "error", field: "reporter" };
                    expect(outcome, row.name).toEqual(event.outcome);
                    expect(
                      A.map(yield* table.read, (entry) => ({ objectId: entry.objectId, value: entry.value }))
                    ).toEqual(event.entries);
                    expect(comparisons).toEqual(event.comparisons);
                    events += 1;
                    continue;
                  }
                  const key = current.success;
                  if (operation.kind === "hash") result = yield* S.encodeEffect(S.BigIntFromString)(key.hash);
                  else if (operation.kind === "set") yield* table.set(key, operation.value);
                  else {
                    const hit = yield* operation.kind === "get" ? table.get(key) : table.remove(key);
                    result = O.getOrElse(
                      O.map(hit, (entry) => entry.value),
                      () => null
                    );
                  }
                }
                outcome = { status: "value", result };
                expect(outcome, row.name).toEqual(event.outcome);
                expect(
                  A.map(yield* table.read, (entry) => ({ objectId: entry.objectId, value: entry.value })),
                  row.name
                ).toEqual(event.entries);
                expect(comparisons, row.name).toEqual(event.comparisons);
                events += 1;
              }
              expect((yield* Effect.flip(objects.key(CitationResourceObject.make({ slot: 0 })))).reason).toBe(
                "unknown-object"
              );
            }),
          () => objects.close.pipe(Effect.andThen(owner.close))
        );
        expect((yield* Effect.flip(objects.key(A.getUnsafe(resources, 0)))).reason).toBe("closed");
      }
      expect(events).toBe(38);
    })
  );
  it.effect(
    "bounds allocations, captures services, rejects foreign handles and preserves state after work failure",
    () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const limits = CitationEngineLimits.make({ ...policy.limits, resolutionIterations: 2 });
        const ref = CitationGroupMember.cases.Mention.make({
          mentionId: CitationMentionId.make(`cm1:${Str.repeat(64)("0")}`),
        });
        let reads = 0;
        let denied = false;
        const models = CitationResourceModels.of({
          read: Effect.fn("LiveCaseControls.read")(() =>
            Effect.sync(() => {
              reads += 1;
            }).pipe(Effect.andThen(Effect.fail(modelFailure())))
          ),
          step: Effect.suspend(() =>
            denied ? Effect.fail(CitationResourceObjectFailure.make({ reason: "limit-exceeded" })) : Effect.void
          ),
        });
        const objects = yield* makeCitationResourceObjects(limits).pipe(
          Effect.provideService(CitationResourceModels, models),
          Effect.provideService(CitationFrozenEditions, unusedEditions)
        );
        const foreign = yield* makeCitationResourceObjects(limits).pipe(
          Effect.provideService(CitationResourceModels, models),
          Effect.provideService(CitationFrozenEditions, unusedEditions)
        );
        const first = yield* objects.create(ref);
        expect(first.slot).toBe(0);
        expect(reads).toBe(0);
        denied = true;
        expect((yield* Effect.flip(objects.create(ref))).reason).toBe("limit-exceeded");
        denied = false;
        const second = yield* objects.create(ref);
        expect(second.slot).toBe(1);
        expect((yield* Effect.flip(objects.create(ref))).reason).toBe("limit-exceeded");
        expect(yield* objects.referenceOf(first)).toEqual(ref);
        expect((yield* Effect.flip(objects.key(yield* foreign.create(ref)))).reason).toBe("unknown-object");
        expect((yield* Effect.flip(objects.key(CitationResourceObject.make({ slot: first.slot })))).reason).toBe(
          "unknown-object"
        );
        expect((yield* Effect.flip(objects.key(first))).reason).toBe("model-failed");
        expect(reads).toBe(1);
        expect((yield* Effect.flip(objects.comparison.equal(0, 99))).reason).toBe("comparison-failed");
        yield* objects.close;
        expect((yield* Effect.flip(objects.referenceOf(first))).reason).toBe("closed");
        yield* foreign.close;
        expect(
          (yield* Effect.flip(
            makeCitationResourceObjects({}).pipe(
              Effect.provideService(CitationResourceModels, models),
              Effect.provideService(CitationFrozenEditions, unusedEditions)
            )
          )).reason
        ).toBe("invalid-input");
      })
  );

  it.effect("serializes concurrent object allocation at the schema-owned ceiling", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      const limits = CitationEngineLimits.make({ ...policy.limits, resolutionIterations: 1 });
      const ref = CitationGroupMember.cases.Mention.make({
        mentionId: CitationMentionId.make(`cm1:${Str.repeat(64)("0")}`),
      });
      const models = CitationResourceModels.of({
        read: Effect.fn("LiveCaseConcurrentControls.read")(() => Effect.fail(modelFailure())),
        step: Effect.void,
      });
      const objects = yield* makeCitationResourceObjects(limits).pipe(
        Effect.provideService(CitationResourceModels, models),
        Effect.provideService(CitationFrozenEditions, unusedEditions)
      );
      const results = yield* Effect.all([Effect.result(objects.create(ref)), Effect.result(objects.create(ref))], {
        concurrency: "unbounded",
      });
      expect(A.filter(results, Result.isSuccess)).toHaveLength(1);
      expect(A.filter(results, Result.isFailure)).toHaveLength(1);
      const failure = A.findFirst(results, Result.isFailure);
      expect(O.isSome(failure) && failure.value.failure.reason).toBe("limit-exceeded");
      yield* objects.close;
    })
  );
});
