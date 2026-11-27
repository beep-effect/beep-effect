---
title: "Keep typeahead accessibility and Enter ownership scoped to one editor"
date: 2026-11-26
reversal: "Restore Lexical default menu ids and passive plugin flags, then test simultaneous composers, disappearing triggers and pending mention lookups."
governs:
  - "src/chat/typeahead.tsx#TypeaheadMenuList"
  - "src/chat/typeahead.tsx#MentionLookupNotice"
  - "src/chat/typeahead.tsx#SlashPlugin"
  - "src/chat/typeahead.tsx#MentionPlugin"
  - "src/chat/typeahead.tsx#COMBOBOX_ARIA_ATTRIBUTES"
  - "src/chat/typeahead.tsx#comboboxAriaAtom"
enforcedBy: []
---

Give option rows and controlled listboxes editor-scoped ids. aria-activedescendant resolves document-wide to the first match, so Lexical's shared typeahead-item ids can announce another composer's option.
Opening either menu closes ownership of the other; a missing onClose must not leave aria-expanded or Enter suppression behind the visible menu.
Keep editor-scoped pending and failed mention portals visible instead of presenting them as no matches; the marker owns Enter and supplies a real listbox for the expanded combobox.
Register the root listener from anyMenuOpenAtom, then use a short-lived observer to repair the hardcoded ARIA relations Lexical rewrites from effects and command handlers.
Disconnect the observer when the menu closes. Finalization also clears painted root attributes because the root can outlive the plugin.
Rejected: rely on Lexical's document-wide ids and plugin-reported open flags alone; stale or competing menus then steal screen-reader relations and Enter ownership across composers.
