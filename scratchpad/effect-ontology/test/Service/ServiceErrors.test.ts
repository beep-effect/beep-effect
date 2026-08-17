import { makeNamedNode } from "@beep/rdf";
import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AssertionError } from "../../Service/Assertion.ts";
import { ContentEnrichmentError } from "../../Service/ContentEnrichmentAgent.ts";
import { ExecutionFailure } from "../../Service/ExecutionDeduplicator.ts";
import { ExtractionRunError } from "../../Service/ExtractionRun.ts";
import { TimeoutError } from "../../Service/LlmControl/StageTimeout.ts";
import { NomicNlpError } from "../../Service/NomicNlp.ts";
import { OntologyAgentError } from "../../Service/OntologyAgent.ts";
import { ProgressStreamingError } from "../../Service/ProgressStreaming.ts";
import { ReasoningError, RuleParseError } from "../../Service/Reasoner.ts";
import { ReconciliationError } from "../../Service/ReconciliationService.ts";
import { SparqlCorrectionError, SparqlGenerationError, SparqlSyntaxError } from "../../Service/SparqlGenerator.ts";
import { GenerationMismatchError } from "../../Service/Storage.ts";
import { ExplanationError } from "../../Service/ViolationExplainer.ts";
import { WikidataApiError, WikidataRateLimitError } from "../../Service/WikidataClient.ts";

describe("schema-backed service errors", () => {
  it.effect("constructs every migrated error through its schema API", Effect.fnUntraced(function* () {
      const cause = AssertionError.make({ operation: "create", message: "No claims were available." });
      const violation = ShaclValidationViolation.make({
        focusNode: "https://example.com/person/ada",
        path: makeNamedNode("https://schema.org/name"),
        message: "A name is required.",
        severity: "violation",
      });

      assert.isTrue(AssertionError.is(cause));
      assert.isTrue(
        ContentEnrichmentError.is(ContentEnrichmentError.make({ message: "Enrichment failed.", cause: O.some(cause) }))
      );
      assert.isTrue(ExecutionFailure.is(ExecutionFailure.make({ message: "Execution failed." })));
      assert.isTrue(ExtractionRunError.is(ExtractionRunError.make({ message: "Run failed." })));
      assert.isTrue(TimeoutError.is(TimeoutError.make({ stage: "grounding", timeout: Duration.seconds(30) })));
      assert.isTrue(NomicNlpError.is(NomicNlpError.make({ message: "Embedding failed." })));
      assert.isTrue(
        OntologyAgentError.is(
          OntologyAgentError.make({ operation: "parseOntology", message: "Ontology parsing failed." })
        )
      );
      assert.isTrue(
        ProgressStreamingError.is(
          ProgressStreamingError.make({ reason: "QueueOverflow", message: "The progress queue is full." })
        )
      );
      assert.isTrue(ReasoningError.is(ReasoningError.make({ message: "Reasoning failed." })));
      assert.isTrue(
        RuleParseError.is(RuleParseError.make({ message: "Rule parsing failed.", rule: "{ ?s ?p ?o } => {}." }))
      );
      assert.isTrue(
        ReconciliationError.is(
          ReconciliationError.make({
            message: "Reconciliation failed.",
            entityIri: "https://example.com/person/ada",
          })
        )
      );
      assert.isTrue(
        SparqlGenerationError.is(SparqlGenerationError.make({ message: "Generation failed.", question: "Who is Ada?" }))
      );
      assert.isTrue(SparqlSyntaxError.is(SparqlSyntaxError.make({ message: "Missing WHERE.", sparql: "SELECT ?s" })));
      assert.isTrue(
        SparqlCorrectionError.is(
          SparqlCorrectionError.make({
            message: "Correction failed.",
            sparql: "SELECT ?s",
            originalError: "Missing WHERE.",
          })
        )
      );
      assert.isTrue(
        GenerationMismatchError.is(GenerationMismatchError.make({ key: "graphs/current", expectedGeneration: "12" }))
      );
      assert.isTrue(
        ExplanationError.is(ExplanationError.make({ message: "Explanation failed.", violation, cause: O.some(cause) }))
      );
      assert.isTrue(WikidataApiError.is(WikidataApiError.make({ message: "Wikidata failed." })));
      assert.isTrue(WikidataRateLimitError.is(WikidataRateLimitError.make({ retryAfter: Duration.seconds(5) })));

      const decoded = yield* S.decodeEffect(ExtractionRunError)({
        _tag: "ExtractionRunError",
        message: "Run metadata is missing.",
        cause: undefined,
      });
      assert.isTrue(O.isNone(decoded.runId));
      assert.isTrue(O.isNone(decoded.cause));
    })
  );
});
