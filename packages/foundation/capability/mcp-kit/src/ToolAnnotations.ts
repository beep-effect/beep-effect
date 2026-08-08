/**
 * Four-hint annotation helper.
 *
 * A terse combinator applying the four MCP tool-behavior hints —
 * `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`, emitted
 * from `Tool.Readonly`/`Tool.Destructive`/`Tool.Idempotent`/`Tool.OpenWorld` —
 * in one call, in place of four chained `.annotate(...)` calls (precedent:
 * `packages/drivers/m365-mcp/src/M365Tools.ts`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as AiTool from "effect/unstable/ai/Tool";

const $I = $McpKitId.create("ToolAnnotations");

/**
 * The four MCP tool-behavior hints as a single record.
 *
 * @example
 * ```ts
 * import { FourHintAnnotations } from "@beep/mcp-kit"
 *
 * const hints = FourHintAnnotations.make({
 *   destructive: false,
 *   idempotent: true,
 *   openWorld: true,
 *   readOnly: true
 * })
 * console.log(hints.readOnly)
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FourHintAnnotations extends S.Class<FourHintAnnotations>($I`FourHintAnnotations`)(
  {
    destructive: S.Boolean.annotateKey({
      description: "Emitted as the MCP destructiveHint.",
    }),
    idempotent: S.Boolean.annotateKey({
      description: "Emitted as the MCP idempotentHint.",
    }),
    openWorld: S.Boolean.annotateKey({
      description: "Emitted as the MCP openWorldHint.",
    }),
    readOnly: S.Boolean.annotateKey({
      description: "Emitted as the MCP readOnlyHint.",
    }),
  },
  $I.annote("FourHintAnnotations", {
    description: "The four MCP tool-behavior hints as a single record.",
  })
) {
  static readonly readOnly: FourHintAnnotations = FourHintAnnotations.make({
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: true,
  });

  static readonly destructiveWrite: FourHintAnnotations = FourHintAnnotations.make({
    readOnly: false,
    destructive: true,
    idempotent: false,
    openWorld: true,
  });
}

/**
 * The tool a hint combinator hands back: the caller's own tool type, kept
 * deferred rather than widened.
 *
 * **Details**
 *
 * `Tool#annotate` returns the widened `Tool<Name, Config, Requirements>`
 * shape rather than the specific tool it was called on, so every annotation
 * combinator in this kit re-narrows to the caller's `T`. Spelling that
 * result through this alias keeps a combinator's pipeable and data-first
 * overloads relatable to one another while preserving the caller's exact
 * tool type at both call sites.
 *
 * **Example** (Reference the AnnotatedTool alias)
 *
 * ```ts
 * import type { AnnotatedTool } from "@beep/mcp-kit"
 * import type * as AiTool from "effect/unstable/ai/Tool"
 *
 * type Annotated = AnnotatedTool<AiTool.Any>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AnnotatedTool<T extends AiTool.Any> = T extends unknown ? T : never;

/**
 * Applies all four MCP tool-behavior hints to a tool in one call.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 * import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit"
 *
 * const searchTool = annotateFourHints(Tool.make("search_patents"), readOnlyToolHints)
 * console.log(searchTool.name)
 * // "search_patents"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const annotateFourHints: {
  (hints: FourHintAnnotations): <T extends AiTool.Any>(tool: T) => AnnotatedTool<T>;
  <T extends AiTool.Any>(tool: T, hints: FourHintAnnotations): AnnotatedTool<T>;
} = dual(
  2,
  <T extends AiTool.Any>(tool: T, hints: FourHintAnnotations): AnnotatedTool<T> =>
    // `Tool#annotate` returns the widened `Tool<Name, Config, Requirements>`
    // shape rather than the caller's specific `T`; the annotation chain does
    // not change `Name`/`Config`/`Requirements`, so re-narrowing here is sound.
    tool
      .annotate(AiTool.Readonly, hints.readOnly)
      .annotate(AiTool.Destructive, hints.destructive)
      .annotate(AiTool.Idempotent, hints.idempotent)
      .annotate(AiTool.OpenWorld, hints.openWorld) as T
);

/**
 * Hints for a safe, read-only, idempotent tool that may reach external data
 * (the common case for read-side MCP tools; precedent:
 * `packages/drivers/m365-mcp/src/M365Tools.ts`).
 *
 * @example
 * ```ts
 * import { readOnlyToolHints } from "@beep/mcp-kit"
 *
 * console.log(readOnlyToolHints)
 * // { readOnly: true, destructive: false, idempotent: true, openWorld: true }
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const readOnlyToolHints: FourHintAnnotations = FourHintAnnotations.readOnly;

/**
 * Hints for a destructive, non-idempotent write tool that may reach external
 * systems.
 *
 * @example
 * ```ts
 * import { destructiveWriteToolHints } from "@beep/mcp-kit"
 *
 * console.log(destructiveWriteToolHints)
 * // { readOnly: false, destructive: true, idempotent: false, openWorld: true }
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const destructiveWriteToolHints: FourHintAnnotations = FourHintAnnotations.destructiveWrite;
