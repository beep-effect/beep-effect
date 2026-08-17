/**
 * Service: Extraction Workflow Interface
 *
 * **Details**
 *
 * Defines the contract for the high-level extraction workflow.
 * Allows services to depend on the interface without depending on calculations/implementations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { Effect } from "effect";
import { Context } from "effect";
import type { ExtractionError } from "../Domain/Error/Extraction.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import type { RunConfig } from "../Domain/Model/ExtractionRun.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionWorkflow");

// Define the interface
/**
 * Describes the extraction workflow methods data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExtractionWorkflowMethods {
  readonly extract: (text: string, config: RunConfig) => Effect.Effect<KnowledgeGraph, ExtractionError>;
}

// Define the Tag
/**
 * Provides the extraction workflow service capability.
 *
 * **Example** (Inspect extraction workflow)
 *
 * ```ts
 * import { ExtractionWorkflow } from "@effect-ontology/Service/ExtractionWorkflow"
 *
 * console.log(ExtractionWorkflow)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ExtractionWorkflow extends Context.Service<ExtractionWorkflow, ExtractionWorkflowMethods>()(
  $I`ExtractionWorkflow`
) {}
