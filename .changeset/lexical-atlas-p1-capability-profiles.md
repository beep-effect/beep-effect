---
"@beep/editor": patch
"@beep/professional-desktop": patch
---

`@beep/editor` gains the schema-backed capability contract that
`lexical-playground-capability-atlas` P1 ratified: `@beep/editor/capability`
exports LiteralKit domains, `CapabilityDescriptor`/`CapabilityCatalog`/
`EditorProfile`/`ResolvedEditorProfile` schemas, typed
`ProfileResolutionError` classes, a deterministic resolver (unknown ids,
development-only gating, explicit dependencies, `effect/Graph` cycle
detection, conflicts, registration compatibility, keybinding overrides and
collisions, guarded chords), pure command/help/slash projections, the runtime
bindings and `KeybindingPlugin`, a text-labeled `CapabilityToolbar`, generated
`ShortcutHelp`, and `CapabilityComposer`, which renders a typed resolution
notice instead of mounting when a profile is invalid and falls back to the
read-only wire viewer for undecodable initial state. `editorNodes` and
`EditorComposer` now derive from the compatibility profile with an unchanged
plugin set and node order; `ChatComposer` is untouched.

`@beep/professional-desktop` registers the closed-by-default `editor-proof`
shell panel that proves the `minimal` and `document-proof` reference profiles
over one canonical `@beep/md` document with a remount transaction on profile
switch and canonical-JSON import, no persistence, and no network egress; the
session notice wraps inside narrow panes and `react-grab` is gated behind
`VITE_REACT_GRAB` for recorded QA runs.
