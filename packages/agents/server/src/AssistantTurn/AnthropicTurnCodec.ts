/**
 * Anthropic provider adaptation for the assistant-turn structured output.
 *
 * `toCodecAnthropic` compiles a stratified schema into an Anthropic-compatible
 * JSON Schema plus a codec that decodes model output back into the domain type.
 * It THROWS at module load if the schema ever grows a construct the provider
 * cannot express (recursion, `Unknown`, `S.optional`, ...), so importing this
 * module doubles as a structural guarantee that the rich md-aligned block scope
 * stays provider-expressible.
 *
 * Provider adaptation belongs in the server slice, never in the domain.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  AssistantContent,
  CodeBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  QuoteBlock,
  TableBlock,
  YouTubeBlock,
} from "@beep/agents-domain/values/AssistantContent";
import { $AgentsServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { thunkFalse } from "@beep/utils";
import { flow, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AnthropicStructuredOutput } from "effect/unstable/ai";

// cspell:words gantt

const $I = $AgentsServerId.create("AssistantTurn/AnthropicTurnCodec");

/**
 * Mermaid diagram declarations accepted by the Anthropic code-block adapter.
 *
 * **Example** (Validate graph type membership)
 *
 * ```ts
 * import { MermaidDiagramType } from "@beep/agents-server/AnthropicTurnCodec"
 *
 * console.log(MermaidDiagramType.is.graph("graph")) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MermaidDiagramType = LiteralKit([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "gitGraph",
  "pie",
  "mindmap",
  "timeline",
  "journey",
  "quadrantChart",
]).pipe(
  $I.annoteSchema("MermaidDiagramType", {
    description: "Mermaid diagram declarations accepted by the Anthropic code-block adapter.",
  })
);

/**
 * Runtime type for {@link MermaidDiagramType}.
 *
 * **Example** (Assign typed diagram value)
 *
 * ```ts
 * import type { MermaidDiagramType } from "@beep/agents-server/AnthropicTurnCodec"
 *
 * const diagramType: MermaidDiagramType = "graph"
 * console.log(diagramType)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export type MermaidDiagramType = typeof MermaidDiagramType.Type;

const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/u;

const firstToken: (source: string) => O.Option<string> = flow(Str.match(/\S+/u), O.flatMap(A.get(0)));
const isMermaidDiagramType = S.is(MermaidDiagramType);

const isValidMermaidCodeBlock = (block: CodeBlock): boolean =>
  block.language !== "mermaid" ||
  pipe(
    firstToken(block.code),
    O.match({
      onNone: thunkFalse,
      onSome: isMermaidDiagramType,
    })
  );

const isValidTableBlock = (block: TableBlock): boolean =>
  pipe(
    block.rows,
    A.head,
    O.map((row) => A.length(row.cells)),
    O.match({
      onNone: thunkFalse,
      onSome: (width) => width > 0 && A.every(block.rows, (row) => A.length(row.cells) === width),
    })
  );

const isValidYouTubeBlock = (block: YouTubeBlock): boolean =>
  pipe(block.videoId, Str.match(youtubeVideoIdPattern), O.isSome);

const CheckedCodeBlock = CodeBlock.check(
  S.makeFilter(isValidMermaidCodeBlock, {
    identifier: $I`CheckedMermaidCodeBlock`,
    title: "Checked Mermaid Code Block",
    description: "Checks mermaid code blocks for a non-empty recognized mermaid diagram declaration.",
    message: `Mermaid code blocks must start with one of: ${A.join(MermaidDiagramType.Options, ", ")}`,
  })
);

const CheckedTableBlock = TableBlock.check(
  S.makeFilter(isValidTableBlock, {
    identifier: $I`CheckedTableBlock`,
    title: "Checked Table Block",
    description: "Checks assistant table blocks for at least one row, one cell, and rectangular row arity.",
    message: "Tables must contain at least one row, at least one cell, and every row must have the same cell count.",
  })
);

const CheckedYouTubeBlock = YouTubeBlock.check(
  S.makeFilter(isValidYouTubeBlock, {
    identifier: $I`CheckedYouTubeBlock`,
    title: "Checked YouTube Block",
    description: "Checks assistant YouTube blocks for a bare 11-character YouTube video id.",
    message: "YouTube blocks must use the bare 11-character video id, not a URL.",
  })
);

const CheckedAssistantBlock = S.Union([
  ParagraphBlock,
  HeadingBlock,
  QuoteBlock,
  ListBlock,
  CheckedCodeBlock,
  CheckedTableBlock,
  CheckedYouTubeBlock,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("CheckedAssistantBlock", {
    description: "A checked assistant block.",
  })
);

/**
 * Per-block Anthropic codec for decoding individually streamed array elements.
 * Used to validate each completed `"blocks"` element slice as it arrives.
 *
 * **Gotchas**
 *
 * The codec includes the server-only provider checks for mermaid declarations,
 * rectangular tables, and bare YouTube video ids. Importing this module can
 * fail fast if `CheckedAssistantBlock` grows a schema feature that Anthropic's
 * structured-output JSON Schema cannot express.
 *
 * **Example** (Decode streamed block JSON)
 *
 * ```ts
 * import { assistantBlockOutput } from "@beep/agents-server/AnthropicTurnCodec"
 * import * as S from "effect/Schema"
 *
 * const decodeBlock = S.decodeUnknownSync(S.fromJsonString(assistantBlockOutput.codec))
 * const block = decodeBlock('{"type":"paragraph","children":[{"type":"text","text":"Hi"}]}')
 * console.log(block.type) // "paragraph"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const assistantBlockOutput = AnthropicStructuredOutput.toCodecAnthropic(CheckedAssistantBlock);

/**
 * Whole-envelope Anthropic codec for the assistant turn. Its `jsonSchema`
 * feeds the forced-tool parameters; its `codec` is the provider's end-of-turn
 * decoder for the complete `AssistantContent` envelope.
 *
 * **Details**
 *
 * Use {@link assistantBlockOutput} for incremental streamed element decoding;
 * use this whole-envelope codec at the provider boundary when validating the
 * completed forced-tool response.
 *
 * **Example** (Decode full content envelope)
 *
 * ```ts
 * import { assistantOutput } from "@beep/agents-server/AnthropicTurnCodec"
 * import * as S from "effect/Schema"
 *
 * const decodeContent = S.decodeUnknownSync(S.fromJsonString(assistantOutput.codec))
 * const content = decodeContent('{"blocks":[{"type":"paragraph","children":[{"type":"text","text":"Done"}]}]}')
 * console.log(content.blocks.length) // 1
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const assistantOutput = AnthropicStructuredOutput.toCodecAnthropic(AssistantContent);
