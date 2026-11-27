---
title: "Anchor typeahead portals to the live caret in viewport space"
date: 2026-11-26
reversal: "Restore anchor-element positioning and synchronous scroll updates, then recheck bottom-docked, scrolled and vanished-trigger menus."
governs:
  - "src/chat/typeahead.tsx#viewportTickAtom"
  - "src/chat/typeahead.tsx#MENU_MAX_HEIGHT_PX"
  - "src/chat/typeahead.tsx#MENU_WIDTH_PX"
  - "src/chat/typeahead.tsx#caretViewportRect"
  - "src/chat/typeahead.tsx#TypeaheadMenuList"
enforcedBy: []
---

Use a fixed-position listbox portal, measured from the live DOM selection before falling back to the Lexical anchor rectangle.
Lexical positions its anchor in an effect after render; a degenerate anchor with no locatable caret means the trigger is gone, so render nothing rather than strand a menu at the viewport origin.
Keep the menu below the caret when space permits and flip above otherwise; fixed positioning prevents a bottom-docked composer from growing page scroll area.
The height allowance is max-h-72 (288px) plus the 4px caret gap; w-64 supplies the 256px horizontal clamp.
Subscribe only while the menu is mounted. Capture ancestor scroll as well as window movement, coalesce repositioning to one animation frame, and make listeners passive to avoid delaying scrolling.
Rejected: position solely from the effect-updated anchor and update synchronously for every scroll event; that detaches menus from the caret and makes scroll handlers re-render the menu on the scrolling thread.
Option rows retain role=option, selected state, editor-scoped ids and setRefElement for scroll-into-view; cancelling mousedown preserves editor focus.
