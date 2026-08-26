import { canonicalJson } from "@/corpus/Canonical";
import { sha256TextSync } from "@/schema/Digest";
import type { GoldFile } from "@/schema/Gold";

/**
 * Versioned instructions shared by every C0 gold-proposal request.
 *
 * **Details**
 *
 * The response is a single JSON object with a `labels` array. Every label uses
 * exact UTF-16 half-open offsets and the exact source slice as `quote`.
 *
 * @category configuration
 * @since 0.0.0
 */
const GOLD_PROMPT_TEMPLATE = `semantica-gold/v1
Return one JSON object and no Markdown fence or commentary.
The object must have exactly one top-level field named "labels".
Every label must be supported verbatim by SOURCE_TEXT.
startChar is the inclusive UTF-16 code-unit offset.
endChar is the exclusive UTF-16 code-unit offset.
quote must equal SOURCE_TEXT.slice(startChar, endChar).
Never invent or normalize quote text.

For SUBSET=structure, each label is:
{"role":"title"|"abstract"|"section"|"reference","depth":non-negative integer,"startChar":integer,"endChar":integer,"quote":"exact source slice"}

For SUBSET=entity, each label is:
{"label":"exact entity surface","entityType":"concise type","cluster":"document-local coreference cluster","startChar":integer,"endChar":integer,"quote":"exact source slice"}
Reuse cluster exactly for mentions of the same entity. Use a distinct cluster when no other mention corefers.

For SUBSET=relation, each label is:
{"predicate":"concise relation","subject":"exact subject surface","object":"exact object surface","startChar":integer,"endChar":integer,"quote":"exact evidence slice"}`;

/**
 * Provider options pinned alongside the prompt template.
 *
 * **Details**
 *
 * C0 uses the xAI adapter defaults, so the explicit option object is empty and
 * still participates in the artifact hash.
 *
 * @category configuration
 * @since 0.0.0
 */
const GOLD_PROPOSER_OPTIONS = {};

/**
 * Stable hash of the pinned gold prompt template and provider options.
 *
 * **Example** (Inspect the artifact digest width)
 *
 * ```ts
 * import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts"
 * import * as Str from "effect/String"
 *
 * console.log(Str.length(GOLD_PROMPT_ARTIFACT_HASH)) // 64
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOLD_PROMPT_ARTIFACT_HASH = sha256TextSync(
  canonicalJson({ options: GOLD_PROPOSER_OPTIONS, template: GOLD_PROMPT_TEMPLATE })
);

/**
 * Renders one paper/subset request for the independent proposer.
 *
 * **Example** (Render an entity request)
 *
 * ```ts
 * import { makeGoldPrompt } from "@/gold/Prompts"
 * import * as Str from "effect/String"
 *
 * const prompt = makeGoldPrompt({ paperId: "paper-20260826", subset: "entity", text: "Alpha" })
 * console.log(Str.includes("SUBSET=entity")(prompt)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGoldPrompt = (input: {
  readonly paperId: string;
  readonly subset: GoldFile["subset"];
  readonly text: string;
}): string => `${GOLD_PROMPT_TEMPLATE}

PAPER_ID=${input.paperId}
SUBSET=${input.subset}
SOURCE_TEXT_BEGIN
${input.text}
SOURCE_TEXT_END`;
