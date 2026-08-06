---
{}
---

Add a feature-flagged, schema-first + atom-first Lexical chat composer to `@beep/editor` (fixed formatting toolbar, `/` slash commands, `@` mentions, attachment capture, plain-Enter send, live character count, send/stop, WAI-ARIA combobox a11y) over the `@beep/lexical-schema` v1 vocabulary, with config/items modeled as `S.Class` (`DOMReactNode`/`Fn`/`ImageMimeType`) and all per-composer state + Lexical bindings + handlers driven through `@effect/atom` (`Atom.family` keyed by the editor, `runtime.fn`, no React hook state, no `Effect.runSync`). Adds an app-local green "workbench" theme to `@beep/professional-desktop` (OS-following `system` default + persisted toggle, green-dark / parchment-light, reused `@beep/ui` `OrbBackground tone="green"`) and fixes the placeholder/cursor alignment in `@beep/ui`'s editor `ContentEditable`. No package releases required.
