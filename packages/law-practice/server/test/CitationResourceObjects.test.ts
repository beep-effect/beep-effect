import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  Citation,
  CitationGroupMember,
  CitationMention,
  CitationMentionId,
  FullCaseCitation,
} from "@beep/law-practice-domain/values";
import {
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
} from "@beep/law-practice-server/internal/Citation/CallbackSession";
import {
  CitationFrozenEditionFailure,
  CitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObject,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "@beep/law-practice-server/internal/Citation/ResourceObjects";
import {
  CitationRuntimeDictionaryComparison,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
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
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationResourceObjects");
class MissingReporterOutcome extends S.Opaque<MissingReporterOutcome, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("error"), field: S.tag("reporter") }).pipe(
    $I.annoteSchema("MissingReporterOutcome", {
      description: "Frozen source missing-reporter outcome used to select the expected failure direction.",
    })
  )
) {}

// These histories have no selected edition; any artifact lookup is a regression.
const unusedEditions = CitationFrozenEditions.of({
  source: Effect.fn("CaseOnlyTest.unusedEditionSource")(() =>
    Effect.fail(CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
  ),
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
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/live-case-resources.json", import.meta.url)
        )
      );
      const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult1).toBe("ec5e5887236e755082f1c2e56f87f6f0f4de68e815f471fda20505977597b791");
      const data = yield* S.decodeEffect(CorpusJson)(raw);
      expect(data.cases).toHaveLength(5);
      let events = 0;
      yield* Effect.forEach(
        data.cases,
        Effect.fnUntraced(function* (row) {
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
            step: work.step.pipe(
              Effect.mapError(() => CitationResourceObjectFailure.make({ reason: "limit-exceeded" }))
            ),
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
                const keyedOperation = Effect.fnUntraced(function* (
                  operation: Extract<typeof Operation.Type, { readonly resource: number }>,
                  expected: S.Json
                ) {
                  const resource = A.getUnsafe(resources, operation.resource);
                  if (S.is(MissingReporterOutcome)(expected)) {
                    const failure = yield* Effect.flip(objects.key(resource));
                    expect(operation.kind).toBe("hash");
                    expect(failure.reason).toBe("missing-reporter");
                    return { status: "error", field: "reporter" };
                  }
                  const key = yield* objects.key(resource);
                  let result: S.Json = null;
                  if (operation.kind === "hash") result = yield* S.encodeEffect(S.BigIntFromString)(key.hash);
                  else if (operation.kind === "set") yield* table.set(key, operation.value);
                  else {
                    const hit = yield* operation.kind === "get" ? table.get(key) : table.remove(key);
                    result = O.getOrElse(
                      O.map(hit, (entry) => entry.value),
                      () => null
                    );
                  }
                  return { status: "value", result };
                });
                yield* Effect.forEach(
                  row.events,
                  Effect.fnUntraced(function* (event) {
                    comparisons = [];
                    const operation = event.operation;
                    let result: S.Json = null;
                    let keyedOutcome = O.none<S.Json>();
                    if (operation.kind === "create") {
                      const resource = yield* objects.create(reference(operation.reference));
                      resources = A.append(resources, resource);
                      result = resource.slot;
                    } else if (operation.kind === "change") {
                      const ref = reference(operation.reference);
                      const citationResult2 = yield* owner.citationOf(ref);
                      const wire = yield* S.encodeEffect(Citation)(citationResult2);
                      const citation = yield* S.decodeEffect(Citation)({
                        ...wire,
                        components: { ...wire.components, [operation.field]: operation.value },
                      });
                      yield* owner.writeCitation(ref, citation);
                    } else if (operation.kind === "equal")
                      result = yield* comparison.equal(operation.left, operation.right);
                    else if (operation.kind === "clear") yield* table.clear;
                    else {
                      const citationResult3 = yield* keyedOperation(operation, event.outcome);
                      keyedOutcome = O.some(citationResult3);
                    }
                    const outcome = O.getOrElse(keyedOutcome, () => ({ status: "value", result }));
                    expect(outcome, row.name).toEqual(event.outcome);
                    const citationResult4 = yield* table.read;
                    expect(
                      A.map(citationResult4, (entry) => ({ objectId: entry.objectId, value: entry.value })),
                      row.name
                    ).toEqual(event.entries);
                    expect(comparisons, row.name).toEqual(event.comparisons);
                    events += 1;
                  }),
                  { concurrency: 1, discard: true }
                );
                const citationResult5 = yield* Effect.flip(objects.key(CitationResourceObject.make({ slot: 0 })));
                expect(citationResult5.reason).toBe("unknown-object");
              }),
            () => objects.close.pipe(Effect.andThen(owner.close))
          );
          const citationResult6 = yield* Effect.flip(objects.key(A.getUnsafe(resources, 0)));
          expect(citationResult6.reason).toBe("closed");
        }),
        { concurrency: 1, discard: true }
      );
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
        const citationResult7 = yield* Effect.flip(objects.create(ref));
        expect(citationResult7.reason).toBe("limit-exceeded");
        denied = false;
        const second = yield* objects.create(ref);
        expect(second.slot).toBe(1);
        const citationResult8 = yield* Effect.flip(objects.create(ref));
        expect(citationResult8.reason).toBe("limit-exceeded");
        const citationResult9 = yield* objects.referenceOf(first);
        expect(citationResult9).toEqual(ref);
        const citationResult10 = yield* foreign.create(ref);
        const citationResult11 = yield* Effect.flip(objects.key(citationResult10));
        expect(citationResult11.reason).toBe("unknown-object");
        const citationResult12 = yield* Effect.flip(objects.key(CitationResourceObject.make({ slot: first.slot })));
        expect(citationResult12.reason).toBe("unknown-object");
        const citationResult13 = yield* Effect.flip(objects.key(first));
        expect(citationResult13.reason).toBe("model-failed");
        expect(reads).toBe(1);
        const citationResult14 = yield* Effect.flip(objects.comparison.equal(0, 99));
        expect(citationResult14.reason).toBe("comparison-failed");
        const unknownSlot = yield* objects.comparison.equal(99, 0).pipe(Effect.flip);
        expect(unknownSlot.reason).toBe("comparison-failed");
        Reflect.set(first, "slot", -1);
        const malformedHandle = yield* objects.key(first).pipe(Effect.flip);
        expect(malformedHandle.reason).toBe("invalid-input");
        Reflect.set(first, "slot", 0);
        const malformedReference = CitationGroupMember.cases.Mention.make({ mentionId: ref.mentionId });
        Reflect.set(malformedReference, "mentionId", "private-invalid-reference");
        const rejectedReference = yield* foreign.create(malformedReference).pipe(Effect.flip);
        expect(rejectedReference.reason).toBe("invalid-input");
        expect("cause" in rejectedReference).toBe(false);
        yield* objects.close;
        const citationResult15 = yield* Effect.flip(objects.referenceOf(first));
        expect(citationResult15.reason).toBe("closed");
        yield* foreign.close;
        const citationResult16 = yield* Effect.flip(
          makeCitationResourceObjects({}).pipe(
            Effect.provideService(CitationResourceModels, models),
            Effect.provideService(CitationFrozenEditions, unusedEditions)
          )
        );
        expect(citationResult16.reason).toBe("invalid-input");
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
      expect(O.getOrThrow(failure).failure.reason).toBe("limit-exceeded");
      yield* objects.close;
    })
  );
});
