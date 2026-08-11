/**
 * Service: Extraction Workflow Interface
 *
 * Defines the contract for the high-level extraction workflow.
 * Allows services to depend on the interface without depending on calculations/implementations.
 *
 * @since 2.0.0
 * @module Service/ExtractionWorkflow
 */

import { $ScratchpadId } from "@beep/identity";
import type { Effect } from "effect";
import { Context } from "effect";
import type { ExtractionError } from "../Domain/Error/Extraction.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import type { RunConfig } from "../Domain/Model/ExtractionRun.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionWorkflow");

// Define the interface
export interface ExtractionWorkflowMethods {
  readonly extract: (text: string, config: RunConfig) => Effect.Effect<KnowledgeGraph, ExtractionError>;
}

// Define the Tag
export class ExtractionWorkflow extends Context.Service<ExtractionWorkflow, ExtractionWorkflowMethods>()(
  $I`ExtractionWorkflow`
) {}
