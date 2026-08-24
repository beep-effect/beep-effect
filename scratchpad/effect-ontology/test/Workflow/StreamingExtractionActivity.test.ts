import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { assert, describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import { WorkflowInstance } from "effect/unstable/workflow/WorkflowEngine";
import { BatchId, DocumentId, GcsUri, Namespace, OntologyName } from "../../Domain/Identity.ts";
import { defaultChunkingParams } from "../../Domain/Schema/DocumentMetadata.ts";
import { ConfigServiceDefault } from "../../Service/Config.ts";
import { ExtractionWorkflow } from "../../Service/ExtractionWorkflow.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";
import { StorageServiceTest } from "../../Service/Storage.ts";
import { makeStreamingExtractionActivity } from "../../Workflow/StreamingExtractionActivity.ts";

const UnusedExtractionWorkflow = Layer.succeed(
  ExtractionWorkflow,
  ExtractionWorkflow.of({
    extract: Effect.fnUntraced(function* () {
      return yield* Effect.die("Extraction workflow must not run when the source document is absent");
    }),
  })
);

const StreamingExtractionActivityTestWorkflow = Workflow.make("streaming-extraction-activity-test", {
  payload: { testName: S.String },
  idempotencyKey: ({ testName }) => testName,
});

const StreamingExtractionActivityTestLayer = Layer.mergeAll(
  StorageServiceTest,
  ConfigServiceDefault,
  RdfBuilder.Default,
  UnusedExtractionWorkflow,
  BunCrypto.layer,
  WorkflowEngine.layerMemory,
  Layer.succeed(
    WorkflowInstance,
    WorkflowInstance.initial(StreamingExtractionActivityTestWorkflow, "streaming-extraction-activity-test")
  )
);

describe("streaming extraction activity boundaries", () => {
  it.layer(StreamingExtractionActivityTestLayer)("with a missing source document", (it) => {
    it.effect(
      "preserves the typed failure without applying interruption retries",
      Effect.fnUntraced(function* () {
        const fiber = yield* makeStreamingExtractionActivity({
          batchId: BatchId.make("batch-00000000000a"),
          documentId: DocumentId.make("doc-00000000000a"),
          sourceUri: GcsUri.fromUnknown("gs://test-bucket/missing.txt"),
          ontologyUri: GcsUri.fromUnknown("gs://test-bucket/ontology.ttl"),
          ontologyId: OntologyName.make("test_ontology"),
          targetNamespace: Namespace.make("test-ontology"),
          ontologyEmbeddingsUri: O.none(),
          chunking: defaultChunkingParams.standard,
          eventTime: O.none(),
          publishedAt: O.none(),
          title: O.none(),
          language: O.none(),
        }).execute.pipe(Effect.flip, Effect.forkChild);

        yield* TestClock.adjust(Duration.zero);

        assert.isTrue(O.isSome(O.fromUndefinedOr(fiber.pollUnsafe())));
        const error = yield* Fiber.join(fiber);
        expect(error._tag).toBe("ActivityNotFound");
      })
    );
  });
});
