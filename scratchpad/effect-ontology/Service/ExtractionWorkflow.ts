/**
 * Service: Extraction Workflow Interface
 *
 * Defines the contract for the high-level extraction workflow.
 * Allows services to depend on the interface without depending on calculations/implementations.
 *
 * @since 2.0.0
 * @module Service/ExtractionWorkflow
 */

import type { Effect } from "effect"
import { Context } from "effect"
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts"
import type { RunConfig } from "../Domain/Model/ExtractionRun.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionWorkflow");

// Define the interface
export interface ExtractionWorkflow {
  readonly extract: (
    text: string,
    config: RunConfig
  ) => Effect.Effect<KnowledgeGraph, unknown, never> // Error type is unknown for now, usually causes are logged
}

// Define the Tag
export const ExtractionWorkflow = Context.Service<ExtractionWorkflow>($I`ExtractionWorkflow`)
