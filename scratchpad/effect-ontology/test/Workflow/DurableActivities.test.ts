import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import { WorkflowInstance } from "effect/unstable/workflow/WorkflowEngine";
import { BatchId, GcsUri, Namespace, OntologyName } from "../../Domain/Identity.ts";
import { PathLayout } from "../../Domain/PathLayout.ts";
import { ConfigServiceDefault } from "../../Service/Config.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";
import {
  CrossBatchResolutionInput,
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
  });
});
