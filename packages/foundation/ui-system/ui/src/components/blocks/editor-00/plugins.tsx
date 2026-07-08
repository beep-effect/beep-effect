/**
 * Rich-text plugin stack composed for the editor-00 block.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "../../editor/editor-ui/content-editable.js";

/**
 * Rich-text plugin stack for the editor block.
 *
 * @remarks
 * Render this inside a `LexicalComposer`. The higher-level {@link Editor}
 * component wires that provider for normal use.
 *
 * @example
 * ```tsx
 * import { LexicalComposer } from "@lexical/react/LexicalComposer"
 * import { Plugins } from "@beep/ui/components/blocks/editor-00/plugins"
 * import { editorTheme } from "@beep/ui/components/editor/themes/editor-theme"
 * import { nodes } from "@beep/ui/components/blocks/editor-00/nodes"
 *
 * export function BareEditorPlugins() {
 *   return (
 *     <LexicalComposer initialConfig={{ namespace: "Docs", theme: editorTheme, nodes, onError: (error) => { throw error } }}>
 *       <Plugins />
 *     </LexicalComposer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Plugins() {
  return (
    <div className="relative">
      {/* toolbar plugins */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div>
              <div>
                <ContentEditable placeholder={"Start typing ..."} />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {/* editor plugins */}
      </div>
      {/* actions plugins */}
    </div>
  );
}
