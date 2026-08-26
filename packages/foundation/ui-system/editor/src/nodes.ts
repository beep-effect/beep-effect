/**
 * Node registration for the `@beep/lexical-schema` v1 vocabulary.
 *
 * `CodeHighlightNode` is intentionally NOT registered: without the prism
 * highlight extension, code blocks keep plain text/tab/linebreak children,
 * which is exactly the wire profile `@beep/lexical-schema` persists.
 *
 * cspell:ignore Klass
 *
 * @packageDocumentation \@beep/editor/nodes
 * @since 0.0.0
 */

import { Result } from "effect";
import { editorCapabilityCatalog } from "./capability/catalog.ts";
import { compatibilityProfile } from "./capability/profiles.ts";
import { resolveEditorProfile } from "./capability/resolver.ts";
import { resolvedNodes } from "./capability/runtime.tsx";
import type { Klass, LexicalNode, LexicalNodeReplacement } from "lexical";

const catalogBaseline = Result.getOrThrow(resolveEditorProfile(editorCapabilityCatalog, compatibilityProfile));

/**
 * The Lexical node classes matching the `@beep/lexical-schema` v1 union.
 *
 * **Example** (Import and length check)
 *
 * ```ts
 * import { editorNodes } from "@beep/editor/nodes"
 *
 * console.log(editorNodes.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const editorNodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = resolvedNodes(catalogBaseline);
