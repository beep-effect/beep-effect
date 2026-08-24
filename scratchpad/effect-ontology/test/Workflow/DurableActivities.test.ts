import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI } from "@beep/rdf";
import { ObjectRef } from "@beep/rdf/Prov";
import { NonNegativeInt } from "@beep/schema";
import { assert, describe, expect, it } from "@effect/vitest";
import { Context, Duration, Effect, Equal, HashMap, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import { WorkflowInstance } from "effect/unstable/workflow/WorkflowEngine";
import { BatchId, GcsUri, Namespace, OntologyName } from "../../Domain/Identity.ts";
import { EntityObservation, EvidenceSpan } from "../../Domain/Model/Entity.ts";
import { PathLayout } from "../../Domain/PathLayout.ts";
import { ClaimId } from "../../Domain/Schema/KnowledgeModel.ts";
import { ClaimPersistenceService, PersistenceResult } from "../../Service/ClaimPersistence.ts";
import { ConfigServiceDefault } from "../../Service/Config.ts";
import {
  CrossBatchEntityResolver,
  CrossBatchResolutionResult,
  ResolutionStats,
} from "../../Service/CrossBatchEntityResolver.ts";
import { RdfBuilder, rdfStoreAddQuad } from "../../Service/Rdf.ts";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";
import { ClaimData, ClaimExtractionArtifact, claimExtractionArtifactToQuads } from "../../Utils/ClaimFactory.ts";
import {
  ClaimPersistenceInput,
  CrossBatchResolutionInput,
  makeClaimPersistenceActivity,
  makeCrossBatchResolutionActivity,
  makeIngestionActivity,
} from "../../Workflow/DurableActivities.ts";

const DurableActivityTestWorkflow = Workflow.make("durable-activity-test", {
  payload: { testName: S.String },
  idempotencyKey: ({ testName }) => testName,
});

const DurableActivityTestLayer = Layer.mergeAll(
  StorageServiceTest,
  RdfBuilder.Default,
  ConfigServiceDefault,
  WorkflowEngine.layerMemory,
  Layer.succeed(WorkflowInstance, WorkflowInstance.initial(DurableActivityTestWorkflow, "durable-activity-test"))
);

class InterruptAttempts extends Context.Service<InterruptAttempts>()(
  "@beep/scratchpad/effect-ontology/test/Workflow/DurableActivities.test/InterruptAttempts",
  {
    make: Ref.make(0),
  }
) {
  static readonly Test = Layer.effect(this, this.make);
}

const InterruptingStorage = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    const attempts = yield* InterruptAttempts;
    return StorageService.of({
      ...storage,
      getOption: Effect.fnUntraced(function* () {
        yield* Ref.update(attempts, (count) => count + 1);
        return yield* Effect.interrupt;
      }),
    });
  })
).pipe(Layer.provide(StorageServiceTest), Layer.provideMerge(InterruptAttempts.Test));

const InterruptRetryTestLayer = Layer.mergeAll(
  InterruptingStorage,
  RdfBuilder.Default,
  ConfigServiceDefault,
  WorkflowEngine.layerMemory,
  Layer.succeed(WorkflowInstance, WorkflowInstance.initial(DurableActivityTestWorkflow, "interrupt-retry-test"))
);

const BatchA = BatchId.make("batch-00000000000a");
const BatchB = BatchId.make("batch-00000000000b");
const Ontology = OntologyName.make("durable_test");

describe("durable activity boundaries", () => {
  it.layer(DurableActivityTestLayer)("with memory persistence", (it) => {
    it.effect(
      "uses a create-only generation when concurrent ingestion initializes a namespace",
      Effect.fnUntraced(function* () {
        const storage = yield* StorageService;
        const namespace = Namespace.make("durable-race");
        const firstPath = "validated/first.ttl";
        const secondPath = "validated/second.ttl";
        yield* storage.set(firstPath, "<urn:entity:first> <urn:predicate> <urn:value:first> .");
        yield* storage.set(secondPath, "<urn:entity:second> <urn:predicate> <urn:value:second> .");

        yield* Effect.all(
          [
            makeIngestionActivity({
              batchId: BatchA,
              validatedGraphUri: GcsUri.fromUnknown(`gs://test-bucket/${firstPath}`),
              targetNamespace: namespace,
            }).execute,
            makeIngestionActivity({
              batchId: BatchB,
              validatedGraphUri: GcsUri.fromUnknown(`gs://test-bucket/${secondPath}`),
              targetNamespace: namespace,
            }).execute,
          ],
          { concurrency: "unbounded" }
        );

        const canonical = yield* storage.getOption(PathLayout.canonical(namespace).entities);
        assert(canonical.pipe(O.isSome));
        canonical.pipe(O.getOrThrow, (content) => {
          expect(content).toContain("urn:entity:first");
          expect(content).toContain("urn:entity:second");
        });
      })
    );

    it.effect(
      "skips disabled cross-batch resolution without requiring a resolver",
      Effect.fnUntraced(function* () {
        const output = yield* makeCrossBatchResolutionActivity(
          CrossBatchResolutionInput.make({
            batchId: BatchA,
            resolvedGraphUri: GcsUri.fromUnknown("gs://test-bucket/resolved.ttl"),
            enabled: false,
            ontologyId: Ontology,
          })
        ).execute;

        expect(output.entitiesTotal).toBe(0);
        expect(output.matchedToExisting).toBe(0);
        expect(output.newCanonicals).toBe(0);
      })
    );

    it.effect(
      "fails enabled cross-batch resolution when its resolver layer is absent",
      Effect.fnUntraced(function* () {
        const error = yield* makeCrossBatchResolutionActivity(
          CrossBatchResolutionInput.make({
            batchId: BatchA,
            resolvedGraphUri: GcsUri.fromUnknown("gs://test-bucket/resolved.ttl"),
            enabled: true,
            ontologyId: Ontology,
          })
        ).execute.pipe(Effect.flip);

        expect(error._tag).toBe("ActivityServiceFailure");
        if (error._tag === "ActivityServiceFailure") {
          expect(error.service).toBe("CrossBatchEntityResolver");
        }
      })
    );

    it.effect(
      "reads a stored claim artifact and passes the exact claims to persistence",
      Effect.fnUntraced(function* () {
        const storage = yield* StorageService;
        const rdf = yield* RdfBuilder;
        const activity = yield* S.decodeEffect(ObjectRef)("urn:beep:test:activity:persistence");
        const source = yield* S.decodeEffect(ObjectRef)("urn:beep:test:source:persistence");
        const provenance = yield* S.decodeEffect(ObjectRef)("urn:beep:test:artifact:persistence");
        const observationId = yield* S.decodeEffect(ObjectRef)("urn:beep:test:observation:persistence");
        const evidence = yield* S.decodeEffect(EvidenceSpan)({ text: "Ada", startChar: 4, endChar: 7 });
        const claim = ClaimData.make({
          claimId: ClaimId.make("claim-abc123def456"),
          subjectIri: "https://example.test/entity/ada",
          predicateIri: "https://schema.org/name",
          objectValue: "Ada",
          objectType: "literal",
          articleId: "document-1",
          ontologyId: "ontology-1",
          confidence: Confidence.make(0.92),
          evidence: {
            text: "Ada",
            startOffset: NonNegativeInt.make(4),
            endOffset: NonNegativeInt.make(7),
          },
        });
        const artifact = ClaimExtractionArtifact.make({
          claims: [claim],
          entityObservations: [
            EntityObservation.make({
              id: observationId,
              provenance,
              activity,
              source,
              evidence: [evidence],
            }),
          ],
          relationObservations: [],
        });
        const quads = yield* claimExtractionArtifactToQuads(artifact, "urn:beep:test:graph:persistence");
        const store = yield* rdf.createStore;
        for (const quad of quads) {
          rdfStoreAddQuad(store, quad);
        }
        const graph = yield* rdf.toTriG(store);
        const graphPath = "documents/document-1/graph.trig";
        const graphUri = `gs://test-bucket/${graphPath}`;
        yield* storage.set(graphPath, graph);

        const persistedClaims = yield* Ref.make<ReadonlyArray<ClaimData>>([]);
        const claimPersistence = ClaimPersistenceService.of({
          persistClaims: Effect.fnUntraced(function* (claims) {
            yield* Ref.set(persistedClaims, claims);
            return PersistenceResult.make({
              articleId: "article-1",
              claimsInserted: NonNegativeInt.make(claims.length),
              claimsTotal: NonNegativeInt.make(claims.length),
            });
          }),
        });
        const input = yield* S.decodeEffect(ClaimPersistenceInput)({
          batchId: BatchA,
          ontologyId: "ontology-1",
          documentGraphUris: [graphUri],
          targetNamespace: "test",
        });
        const output = yield* makeClaimPersistenceActivity(input).execute.pipe(
          Effect.provideService(ClaimPersistenceService, claimPersistence)
        );

        assert.strictEqual(output.claimsPersisted, 1);
        assert.isTrue(Equal.equals(yield* Ref.get(persistedClaims), artifact.claims));
      })
    );

    it.effect(
      "executes enabled cross-batch resolution through the resolver service",
      Effect.fnUntraced(function* () {
        const storage = yield* StorageService;
        const graphPath = "resolved/enabled.ttl";
        yield* storage.set(graphPath, "");
        const resolveCalls = yield* Ref.make(0);
        const resolver = CrossBatchEntityResolver.of({
          loadCandidates: Effect.fn("DurableActivitiesTest.loadCandidates")(() => Effect.succeed(HashMap.empty())),
          resolve: Effect.fnUntraced(function* () {
            yield* Ref.update(resolveCalls, (count) => count + 1);
            return CrossBatchResolutionResult.make({
              canonicalMap: {},
              newCanonicals: [IRI.make("https://example.test/entity/canonical")],
              mergedEntities: [],
              stats: ResolutionStats.make({
                totalEntities: NonNegativeInt.make(1),
                matchedToExisting: NonNegativeInt.make(0),
                createdNew: NonNegativeInt.make(1),
                candidatesEvaluated: NonNegativeInt.make(0),
              }),
            });
          }),
          isEmpty: Effect.fn("DurableActivitiesTest.isEmpty")(() =>
            Effect.die("CrossBatchEntityResolver.isEmpty is unused")
          ),
          getStats: Effect.fn("DurableActivitiesTest.getStats")(() =>
            Effect.die("CrossBatchEntityResolver.getStats is unused")
          ),
        });
        const output = yield* makeCrossBatchResolutionActivity(
          CrossBatchResolutionInput.make({
            batchId: BatchA,
            resolvedGraphUri: GcsUri.fromUnknown(`gs://test-bucket/${graphPath}`),
            enabled: true,
            ontologyId: Ontology,
          })
        ).execute.pipe(Effect.provideService(CrossBatchEntityResolver, resolver));

        assert.strictEqual(yield* Ref.get(resolveCalls), 1);
        assert.strictEqual(output.newCanonicals, 1);
      })
    );
  });

  it.layer(InterruptRetryTestLayer)("with an interrupting storage dependency", (it) => {
    it.effect(
      "stops interruption retries at the configured bound",
      Effect.fnUntraced(function* () {
        const attempts = yield* InterruptAttempts;
        const fiber = yield* makeIngestionActivity({
          batchId: BatchA,
          validatedGraphUri: GcsUri.fromUnknown("gs://test-bucket/interrupted.ttl"),
          targetNamespace: Namespace.make("interrupt-retry"),
        }).execute.pipe(Effect.forkChild);

        yield* TestClock.adjust(Duration.seconds(30));

        assert.strictEqual(yield* Ref.get(attempts), 4);
        assert.isTrue(O.isSome(O.fromUndefinedOr(fiber.pollUnsafe())));
      })
    );
  });
});
