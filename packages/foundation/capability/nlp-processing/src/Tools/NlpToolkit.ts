/**
 * Driver-neutral NLP toolkit contract.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { Toolkit } from "effect/unstable/ai";
import { Analyze } from "./Analyze.ts";
import { BagOfWords } from "./BagOfWords.ts";
import { BowCosineSimilarity } from "./BowCosineSimilarity.ts";
import { ChunkBySentences } from "./ChunkBySentences.ts";
import { CorpusStats } from "./CorpusStats.ts";
import { CreateCorpus } from "./CreateCorpus.ts";
import { DeleteCorpus } from "./DeleteCorpus.ts";
import { DocumentStats } from "./DocumentStats.ts";
import { ExtractEntities } from "./ExtractEntities.ts";
import { ExtractKeywords } from "./ExtractKeywords.ts";
import { LearnCorpus } from "./LearnCorpus.ts";
import { LearnCustomEntities } from "./LearnCustomEntities.ts";
import { NGrams } from "./NGrams.ts";
import { Paragraphize } from "./Paragraphize.ts";
import { PhoneticMatch } from "./PhoneticMatch.ts";
import { QueryCorpus } from "./QueryCorpus.ts";
import { RankByRelevance } from "./RankByRelevance.ts";
import { RemoveStopWords } from "./RemoveStopWords.ts";
import { Sentences } from "./Sentences.ts";
import { Stem } from "./Stem.ts";
import { TextSimilarity } from "./TextSimilarity.ts";
import { Tokenize } from "./Tokenize.ts";
import { TransformText } from "./TransformText.ts";
import { TverskySimilarity } from "./TverskySimilarity.ts";
import { WordCount } from "./WordCount.ts";

type NlpToolList = readonly [
  typeof Analyze,
  typeof BagOfWords,
  typeof BowCosineSimilarity,
  typeof ChunkBySentences,
  typeof CorpusStats,
  typeof CreateCorpus,
  typeof DeleteCorpus,
  typeof DocumentStats,
  typeof ExtractEntities,
  typeof ExtractKeywords,
  typeof LearnCorpus,
  typeof LearnCustomEntities,
  typeof NGrams,
  typeof Paragraphize,
  typeof PhoneticMatch,
  typeof QueryCorpus,
  typeof RankByRelevance,
  typeof RemoveStopWords,
  typeof Sentences,
  typeof Stem,
  typeof TextSimilarity,
  typeof Tokenize,
  typeof TransformText,
  typeof TverskySimilarity,
  typeof WordCount,
];

type NlpToolkitTools = Toolkit.ToolsByName<NlpToolList>;

/**
 * Canonical ordered NLP tool list used to build the toolkit and export
 * adapters.
 *
 * **Details**
 *
 * The order is stable for export adapters that present tools to non-Effect
 * runtimes and for agents that need to inspect the available NLP surface.
 *
 * **Example** (Summarize available tool names)
 *
 * ```ts
 * import { NlpTools } from "@beep/nlp-processing/Tools/NlpToolkit"
 *
 * const toolNames = NlpTools.map((tool) => tool.name)
 * const summary = {
 *   count: toolNames.length,
 *   hasTokenize: toolNames.includes("Tokenize")
 * }
 *
 * console.log(summary)
 * // { count: 25, hasTokenize: true }
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NlpTools: NlpToolList = [
  Analyze,
  BagOfWords,
  BowCosineSimilarity,
  ChunkBySentences,
  CorpusStats,
  CreateCorpus,
  DeleteCorpus,
  DocumentStats,
  ExtractEntities,
  ExtractKeywords,
  LearnCorpus,
  LearnCustomEntities,
  NGrams,
  Paragraphize,
  PhoneticMatch,
  QueryCorpus,
  RankByRelevance,
  RemoveStopWords,
  Sentences,
  Stem,
  TextSimilarity,
  Tokenize,
  TransformText,
  TverskySimilarity,
  WordCount,
] as const;

/**
 * Effect AI toolkit definition containing the full NLP tool surface.
 *
 * **Details**
 *
 * Drivers provide the handler layer for this contract. For example,
 * `@beep/wink` provides a wink-backed implementation.
 *
 * **Example** (Compare toolkit tool counts)
 *
 * ```ts
 * import { NlpToolkit, NlpTools } from "@beep/nlp-processing/Tools/NlpToolkit"
 *
 * const toolkitToolNames = Object.keys(NlpToolkit.tools)
 * const summary = {
 *   hasTokenize: toolkitToolNames.includes("Tokenize"),
 *   sameToolCount: toolkitToolNames.length === NlpTools.length
 * }
 *
 * console.log(summary)
 * // { hasTokenize: true, sameToolCount: true }
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NlpToolkit: Toolkit.Toolkit<NlpToolkitTools> = Toolkit.make(...NlpTools);
