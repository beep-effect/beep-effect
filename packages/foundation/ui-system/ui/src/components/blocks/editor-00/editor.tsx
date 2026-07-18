/**
 * Lexical rich-text editor shell wiring the plugin stack and emitting serialized-state change callbacks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { TooltipProvider } from "@beep/ui/components/ui/tooltip";
import * as O from "@beep/utils/Option";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { editorTheme } from "../../editor/themes/editor-theme.ts";
import { nodes } from "./nodes.ts";
import { Plugins } from "./plugins.ts";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorState, SerializedEditorState } from "lexical";

const editorConfig: InitialConfigType = {
  namespace: "Editor",
  theme: editorTheme,
  nodes,
  onError: (error: Error) => {
    Effect.runSync(Effect.logError(error));
  },
};

/**
 * Lexical rich-text editor shell with serialized-state change callbacks.
 *
 * @example
 * ```tsx
 * import { Editor } from "@beep/ui/components/blocks/editor-00/editor"
 *
 * export function NotesEditor() {
 *   return <Editor onSerializedChange={(state) => state.root.children.length} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Editor({
  editorState,
  editorSerializedState,
  onChange,
  onSerializedChange,
}: {
  editorState?: EditorState;
  editorSerializedState?: SerializedEditorState;
  onChange?: (editorState: EditorState) => void;
  onSerializedChange?: (editorSerializedState: SerializedEditorState) => void;
}) {
  return (
    <div className="bg-background overflow-hidden rounded-lg border shadow">
      <LexicalComposer
        initialConfig={{
          ...editorConfig,
          ...O.getSomesStruct({ editorState: O.fromUndefinedOr(editorState) }),
          // TODO(effect-native-migration): model schema
          ...O.getSomesStruct({
            editorState: O.map(O.fromUndefinedOr(editorSerializedState), (editorSerializedState) =>
              S.encodeUnknownSync(S.UnknownFromJsonString)(editorSerializedState)
            ),
          }),
        }}
      >
        <TooltipProvider>
          <Plugins />

          <OnChangePlugin
            ignoreSelectionChange={true}
            onChange={(nextEditorState) => {
              onChange?.(nextEditorState);
              onSerializedChange?.(nextEditorState.toJSON());
            }}
          />
        </TooltipProvider>
      </LexicalComposer>
    </div>
  );
}
