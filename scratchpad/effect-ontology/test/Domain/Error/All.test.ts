import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as Activity from "../../../Domain/Error/Activity.ts";
import * as Auth from "../../../Domain/Error/Auth.ts";
import * as Base from "../../../Domain/Error/Base.ts";
import * as Circuit from "../../../Domain/Error/Circuit.ts";
import * as Embedding from "../../../Domain/Error/Embedding.ts";
import * as EventBus from "../../../Domain/Error/EventBus.ts";
import * as Extraction from "../../../Domain/Error/Extraction.ts";
import * as Image from "../../../Domain/Error/Image.ts";
import * as Errors from "../../../Domain/Error/index.ts";
import * as Jina from "../../../Domain/Error/Jina.ts";
import * as Llm from "../../../Domain/Error/Llm.ts";
import * as Ontology from "../../../Domain/Error/Ontology.ts";
import * as Rdf from "../../../Domain/Error/Rdf.ts";
import * as Shacl from "../../../Domain/Error/Shacl.ts";
import * as Sparql from "../../../Domain/Error/Sparql.ts";
import * as Workflow from "../../../Domain/Error/Workflow.ts";

const publicSchemas: ReadonlyArray<S.Constraint> = [
  Base.ErrorMessage,
  Base.ErrorUrl,
  Base.OptionalErrorUrl,
  Base.ErrorIri,
  Base.OptionalErrorIri,
  Base.ErrorUri,
  Base.ErrorFilePath,
  Base.OptionalErrorCause,
  Base.OptionalErrorMessage,
  Base.OptionalNonNegativeInt,
  Base.HttpStatusCode,
  Base.OptionalHttpStatusCode,
  Base.Milliseconds,
  Base.OptionalMilliseconds,
  Base.BaseError,
  Base.NotImplemented,
  Base.BaseDomainError,
  Activity.ActivityTimeoutError,
  Activity.ActivityServiceError,
  Activity.ActivityNotFoundError,
  Activity.ActivityValidationError,
  Activity.ActivityGenericError,
  Activity.ActivityError,
  Auth.AuthenticationReason,
  Auth.TicketExpiredError,
  Auth.TicketNotFoundError,
  Auth.AuthenticationError,
  Auth.InvalidApiKeyError,
  Auth.AuthError,
  Circuit.RateLimitReason,
  Circuit.CircuitOpenError,
  Circuit.RateLimitError,
  Circuit.CircuitError,
  Embedding.EmbeddingError,
  Embedding.EmbeddingRateLimitError,
  Embedding.EmbeddingTimeoutError,
  Embedding.EmbeddingInvalidResponseError,
  Embedding.EmbeddingDimensionMismatchError,
  Embedding.EmbeddingTokenLimitError,
  Embedding.AnyEmbeddingError,
  EventBus.EventBusError,
  EventBus.PubSubError,
  EventBus.DeadLetterError,
  EventBus.AnyEventBusError,
  Extraction.ExtractionError,
  Extraction.MentionExtractionFailed,
  Extraction.EntityExtractionFailed,
  Extraction.RelationExtractionFailed,
  Extraction.SchemaGenerationFailed,
  Extraction.ValidationFailed,
  Extraction.EntityValidationFailed,
  Extraction.RelationValidationFailed,
  Extraction.AnyExtractionError,
  Image.ImageFetchError,
  Image.ImageTimeoutError,
  Image.ImageTooLargeError,
  Image.ImageInvalidTypeError,
  Image.ImageError,
  Jina.JinaApiError,
  Jina.JinaRateLimitError,
  Jina.JinaParseError,
  Jina.JinaTimeoutError,
  Jina.JinaError,
  Llm.LlmError,
  Llm.LlmTimeout,
  Llm.LlmRateLimit,
  Llm.LlmInvalidResponse,
  Llm.AnyLlmError,
  Ontology.OntologyError,
  Ontology.ClassNotFound,
  Ontology.PropertyNotFound,
  Ontology.OntologyFileNotFound,
  Ontology.OntologyParsingFailed,
  Ontology.EmbeddingsNotFound,
  Ontology.EmbeddingsVersionMismatch,
  Ontology.AnyOntologyError,
  Rdf.RdfError,
  Rdf.SerializationFailed,
  Rdf.ParsingFailed,
  Rdf.AnyRdfError,
  Shacl.ValidationPolicySeverity,
  Shacl.ShaclValidationError,
  Shacl.ShapesLoadError,
  Shacl.ValidationReportError,
  Shacl.ValidationPolicyError,
  Shacl.ShaclError,
  Sparql.SparqlExecutionError,
  Sparql.SparqlLoadError,
  Sparql.SparqlError,
  Workflow.WorkflowError,
  Workflow.WorkflowNotFoundError,
  Workflow.WorkflowSuspendedError,
  Workflow.AnyWorkflowError,
];

describe("effect-ontology domain errors", () => {
  it("derives schema-valid values for every public error schema", () => {
    for (const schema of publicSchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 16 }
      );
    }
  });

  it("normalizes omitted metadata and applies safe schema defaults", () => {
    const base = Base.BaseError.make({ message: "Unexpected failure." });
    const nullCause = S.decodeUnknownSync(Base.BaseError)({
      _tag: "BaseError",
      message: "Nullish failure metadata.",
      cause: null,
    });
    const service = Activity.ActivityServiceError.make({
      service: "Store",
      operation: "put",
      message: "Unavailable.",
    });
    const suspended = Workflow.WorkflowSuspendedError.make({
      message: "Paused.",
    });
    const timeout = Image.ImageTimeoutError.make({
      url: Base.ErrorUrl.fromUnknown("https://example.com/image.png"),
      timeoutMs: Base.Milliseconds.make(250),
    });

    expect(O.isNone(base.cause)).toBe(true);
    expect(O.isNone(nullCause.cause)).toBe(true);
    expect(service.retryable).toBe(false);
    expect(suspended.isResumable).toBe(false);
    expect(timeout.message).toBe("Image fetch timed out");
  });

  it("keeps derived timing messages and durations faithful to schema values", () => {
    const circuit = Circuit.CircuitOpenError.make({
      resetTimeoutMs: Base.Milliseconds.make(5_000),
      retryAfterMs: O.some(Base.Milliseconds.make(0)),
    });
    const limited = Circuit.RateLimitError.make({
      reason: "requests",
      retryAfterMs: O.some(Base.Milliseconds.make(0)),
    });
    const jina = Jina.JinaRateLimitError.make({
      retryAfterMs: Base.Milliseconds.make(250),
    });

    expect(circuit.message).toContain("0ms");
    expect(limited.message).toContain("0ms");
    expect(Duration.toMillis(jina.retryAfter)).toBe(250);
  });

  it("centralizes activity conversion and construction on the union schema", () => {
    const generic = Activity.ActivityError.fromUnknown(new Error("boom"));
    const service = Activity.ActivityError.serviceFailure("Store", "put", new Error("offline"), true);
    const missing = Activity.ActivityError.notFound("Document", "doc-42");

    expect(Activity.ActivityError.guards.ActivityGeneric(generic)).toBe(true);
    expect(Activity.ActivityError.guards.ActivityServiceFailure(service)).toBe(true);
    expect(service.retryable).toBe(true);
    expect(missing.message).toBe("Document not found: doc-42");
  });

  it("exports every error family through the public barrel", () => {
    expect(Errors.ActivityError).toBe(Activity.ActivityError);
    expect(Errors.EventBusError).toBe(EventBus.EventBusError);
    expect(Errors.ShaclError).toBe(Shacl.ShaclError);
  });
});
