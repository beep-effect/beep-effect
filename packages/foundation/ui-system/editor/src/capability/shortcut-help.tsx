/** Shortcut reference projected from resolved editor commands.
 * @packageDocumentation \@beep/editor/capability/shortcut-help
 * @since 0.0.0
 */
import { A, O } from "@beep/utils";
import { formatChord, projectShortcutHelp } from "./projection.ts";
import type { JSX } from "react";
import type { Platform, ResolvedEditorProfile } from "./schemas.ts";

/** Renders one definition-list row for every resolved command.
 *
 * **Example** (Reference shortcut help)
 * ```tsx
 * import { ShortcutHelp } from "@beep/editor/capability/shortcut-help"
 * console.log(typeof ShortcutHelp) // "function"
 * ```
 * @category components
 * @since 0.0.0
 */
export function ShortcutHelp({
  resolved,
  platform,
}: {
  readonly resolved: ResolvedEditorProfile;
  readonly platform: Platform;
}): JSX.Element {
  const headingId = `shortcut-help-${resolved.profileId}`;
  return (
    <section aria-labelledby={headingId} className="max-h-32 shrink-0 overflow-y-auto border-t p-3 text-sm">
      <h2 id={headingId} className="font-semibold">
        Keyboard shortcuts
      </h2>
      <dl>
        {A.map(projectShortcutHelp(resolved, platform), (entry) => (
          <div key={entry.commandId} className="flex justify-between gap-4">
            <dt title={entry.helpText}>{entry.label}</dt>
            <dd>
              {O.match(entry.chord, { onNone: () => "No shortcut", onSome: (chord) => formatChord(platform, chord) })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
