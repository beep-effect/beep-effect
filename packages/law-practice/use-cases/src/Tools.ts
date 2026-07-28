/**
 * Canonical law-practice toolkit composers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Toolkit } from "effect/unstable/ai";
import {
  CorpusGetDocumentTool,
  CorpusSearchTextTool,
  EmailSearchTool,
  KgApplicationLookupTool,
  KgCandidateClaimsTool,
  KgClientsTool,
  KgDocketFamilyTool,
  KgFindTool,
  KgProvenanceTool,
} from "./PracticeKg.tools.ts";

/**
 * Complete nine-tool read-only practice KG toolkit declaration.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(PracticeKgToolkit.tools).length) // 9
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const PracticeKgToolkit = Toolkit.make(
  KgClientsTool,
  KgDocketFamilyTool,
  KgApplicationLookupTool,
  KgFindTool,
  CorpusSearchTextTool,
  CorpusGetDocumentTool,
  EmailSearchTool,
  KgCandidateClaimsTool,
  KgProvenanceTool
);

/**
 * Type of {@link PracticeKgToolkit}.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 * import type { PracticeKgToolkit as PracticeKgToolkitType } from "@beep/law-practice-use-cases/server"
 *
 * const toolkit: PracticeKgToolkitType = PracticeKgToolkit
 * console.log(Object.keys(toolkit.tools).length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PracticeKgToolkit = typeof PracticeKgToolkit;
