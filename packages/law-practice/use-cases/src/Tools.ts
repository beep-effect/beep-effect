/**
 * Canonical law-practice toolkit composers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Toolkit from "effect/ai/Toolkit";
import { ClaimSelfCheckTool } from "./ClaimSelfCheck.tools.ts";
import {
  CorpusGetDocumentTool,
  CorpusSearchTextTool,
  EmailSearchTool,
  KgApplicationLookupTool,
  KgCandidateClaimsTool,
  KgClientsTool,
  KgCorrespondentLookupTool,
  KgDocketFamilyTool,
  KgFindTool,
  KgMatterLookupTool,
  KgProvenanceTool,
} from "./PracticeKg.tools.ts";

/**
 * Complete twelve-tool read-only practice toolkit declaration.
 *
 * **Example** (Count toolkit tools)
 *
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(PracticeKgToolkit.tools).length) // 12
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
  ClaimSelfCheckTool,
  KgProvenanceTool,
  KgMatterLookupTool,
  KgCorrespondentLookupTool
);

/**
 * Type of {@link PracticeKgToolkit}.
 *
 * **Example** (Assign typed toolkit value)
 *
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
