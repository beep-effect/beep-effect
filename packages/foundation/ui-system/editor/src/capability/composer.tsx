/** Profile-resolved editable Lexical surface.
 * @packageDocumentation \@beep/editor/capability/composer
 * @since 0.0.0
 */
"use client";
import { EditorStateFromJson } from "@beep/lexical-schema";
import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable";
import { A, O } from "@beep/utils";
import { useAtomSet } from "@effect/atom-react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { Result } from "effect";
import * as S from "effect/Schema";
import { logEditorErrorFn } from "../chat/atoms.ts";
import { SlashPlugin } from "../chat/typeahead.tsx";
import { decodeEditorStateForRuntimeResult } from "../runtime.ts";
import { editorTheme } from "../theme.ts";
import { EditorWireViewer } from "../viewer.tsx";
import { editorCapabilityCatalog } from "./catalog.ts";
import { projectSlashItems } from "./projection.ts";
import { resolveEditorProfile } from "./resolver.ts";
import { detectPlatform, KeybindingPlugin, ResolvedExtensions, resolvedNodes, runCommand } from "./runtime.tsx";
import { ShortcutHelp } from "./shortcut-help.tsx";
import { CapabilityToolbar } from "./toolbar.tsx";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { JSX } from "react";
import type { ProfileResolutionError } from "./errors.ts";
import type { CapabilityCatalog, EditorProfile, Platform } from "./schemas.ts";

/** Props for a mount-immutable capability composer.
 * @category models
 * @since 0.0.0
 */
export interface CapabilityComposerProps {
  readonly catalog?: CapabilityCatalog;
  readonly className?: string;
  readonly initialState?: SerializedEditorState;
  readonly onSerializedChange?: (state: SerializedEditorState) => void;
  readonly placeholder?: string;
  readonly platform?: Platform;
  readonly profile: EditorProfile;
}

/** Renders a typed resolution failure without mounting Lexical.
 *
 * **Example** (Reference the notice)
 * ```tsx
 * import { ProfileResolutionNotice } from "@beep/editor/capability/composer"
 * console.log(typeof ProfileResolutionNotice) // "function"
 * ```
 * @category components
 * @since 0.0.0
 */
export function ProfileResolutionNotice({ error }: { readonly error: ProfileResolutionError }): JSX.Element {
  return (
    <div role="alert" className="rounded border border-destructive p-3 text-sm">
      <strong>{error._tag}</strong>: {error.message}
    </div>
  );
}

/** Resolves an app profile and mounts only its projected authoring surfaces.
 *
 * **Gotchas**
 * Profile and initial state are mount-only; change the React key to remount.
 *
 * **Example** (Mount a reference profile)
 * ```tsx
 * import { CapabilityComposer } from "@beep/editor/capability/composer"
 * import { referenceProfiles } from "@beep/editor/capability/profiles"
 * const editor = <CapabilityComposer profile={referenceProfiles.minimal} />
 * console.log(editor.type.name) // "CapabilityComposer"
 * ```
 * @category components
 * @since 0.0.0
 */
export function CapabilityComposer({
  profile,
  catalog = editorCapabilityCatalog,
  initialState,
  onSerializedChange,
  platform = detectPlatform(),
  placeholder,
  className,
}: CapabilityComposerProps): JSX.Element {
  const logEditorError = useAtomSet(logEditorErrorFn);
  return Result.match(resolveEditorProfile(catalog, profile), {
    onFailure: (error) => <ProfileResolutionNotice error={error} />,
    onSuccess: (resolved) => {
      const runtimeInitialState = O.flatMap(O.fromUndefinedOr(initialState), (state) =>
        Result.getSuccess(decodeEditorStateForRuntimeResult(state))
      );
      // D3: content that the live runtime cannot admit stays readable as
      // escaped wire instead of silently mounting an empty editor.
      if (initialState !== undefined && O.isNone(runtimeInitialState)) {
        return (
          <EditorWireViewer input={initialState} {...O.getSomesStruct({ className: O.fromUndefinedOr(className) })} />
        );
      }
      return (
        <LexicalComposer
          initialConfig={{
            namespace: "beep-editor-capability",
            theme: editorTheme,
            nodes: [...resolvedNodes(resolved)],
            ...O.getSomesStruct({ editorState: O.map(runtimeInitialState, S.encodeSync(EditorStateFromJson)) }),
            onError: (error) => logEditorError(error),
          }}
        >
          {/* Box-filling column: the toolbar and help are pinned, the
              editable owns the flexible space and scrolls on its own, so a
              short dock box never collapses the document. */}
          <div className="flex h-full min-h-0 flex-col">
            {A.contains(resolved.registrations.extensions, "ToolbarProjection") ? (
              <CapabilityToolbar resolved={resolved} platform={platform} />
            ) : undefined}
            <div className="relative min-h-0 flex-1 overflow-auto">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    placeholder={placeholder ?? "Start typing ..."}
                    {...O.getSomesStruct({ className: O.fromUndefinedOr(className) })}
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
            {A.contains(resolved.registrations.extensions, "ShortcutHelpProjection") ? (
              <ShortcutHelp resolved={resolved} platform={platform} />
            ) : undefined}
          </div>
          <ResolvedExtensions resolved={resolved} />
          <KeybindingPlugin resolved={resolved} platform={platform} />
          {A.contains(resolved.registrations.extensions, "SlashPickerProjection") ? (
            <SlashPlugin
              items={projectSlashItems(resolved, (commandId) => (editor) => runCommand(editor, commandId))}
            />
          ) : undefined}
          {onSerializedChange === undefined ? undefined : (
            <OnChangePlugin
              ignoreSelectionChange={true}
              onChange={(state) =>
                Result.match(decodeEditorStateForRuntimeResult(state.toJSON()), {
                  onSuccess: onSerializedChange,
                  onFailure: (error) =>
                    logEditorError({ message: "CapabilityComposer produced out-of-schema state", error }),
                })
              }
            />
          )}
        </LexicalComposer>
      );
    },
  });
}
