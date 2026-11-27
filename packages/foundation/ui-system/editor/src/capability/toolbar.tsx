/** Resolved command toolbar for capability composers.
 * @packageDocumentation \@beep/editor/capability/toolbar
 * @since 0.0.0
 */
"use client";
import { Button } from "@beep/ui/components/button";
import { A, O } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Match from "effect/Match";
import { toolbarSelectionAtom } from "../chat/toolbar.tsx";
import { ariaKeyShortcuts, formatChord, projectCommands } from "./projection.ts";
import { runCommand } from "./runtime.tsx";
import type { JSX } from "react";
import type { Platform, ResolvedEditorProfile } from "./schemas.ts";

/** Renders every resolved toolbar command with text and shortcut metadata.
 *
 * **Gotchas**
 *
 * Only format toggles carry aria-pressed; false on heading or undo buttons would misannounce them as toggles.
 *
 * Keep the closed O.none thunk in the pressed-state match: a direct generic O.none reference widens the result to `Option<unknown>` under docgen TypeScript.
 *
 * **Example** (Reference the toolbar)
 * ```tsx
 * import { CapabilityToolbar } from "@beep/editor/capability/toolbar"
 * console.log(typeof CapabilityToolbar) // "function"
 * ```
 * @category components
 * @since 0.0.0
 */
export function CapabilityToolbar({
  resolved,
  platform,
}: {
  readonly resolved: ResolvedEditorProfile;
  readonly platform: Platform;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const selection = useAtomValue(toolbarSelectionAtom(editor));
  const pressed = Match.type<string>().pipe(
    Match.when("format.bold", () => O.some(selection.bold)),
    Match.when("format.italic", () => O.some(selection.italic)),
    Match.when("format.strikethrough", () => O.some(selection.strikethrough)),
    Match.when("format.inline-code", () => O.some(selection.code)),
    Match.orElse(() => O.none())
  );
  return (
    <div role="toolbar" aria-label="Editing commands" className="flex shrink-0 flex-wrap gap-1 border-b p-2">
      {A.map(projectCommands(resolved, "toolbar"), (command) => {
        const binding = A.findFirst(command.keybindings, (candidate) => candidate.platform === platform);
        const chord = O.map(binding, (found) => formatChord(platform, found.chord));
        const ariaChord = O.map(binding, (found) => ariaKeyShortcuts(found.chord));
        return (
          <Button
            key={command.id}
            type="button"
            size="sm"
            variant="ghost"
            title={O.match(chord, {
              onNone: () => command.helpText,
              onSome: (label) => `${command.helpText} (${label})`,
            })}
            aria-keyshortcuts={O.getOrUndefined(ariaChord)}
            aria-pressed={O.getOrUndefined(pressed(command.id))}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(editor, command.id)}
          >
            {command.label}
          </Button>
        );
      })}
    </div>
  );
}
