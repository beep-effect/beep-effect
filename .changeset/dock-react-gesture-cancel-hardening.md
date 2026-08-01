---
"@beep/dock-react": patch
---

Recorded-QA follow-up hardening for gesture cancellation and drop geometry:
promoted tab drags conclude (Escape or commit) and keep their record until the
release's trailing click is swallowed or the next press heals it, so cancelled
and committed drags can no longer activate the source tab or re-point focus;
Escape hands focus back to the group's active tab; pointer cancellation
releases the pointer capture recorded at the press (synthetic pointercancel
events neither release implicitly nor carry the captured pointerId); the
root-split edge band shrinks to 8px so it stops shadowing edge-adjacent
groups' drop quadrants; and the drag ghost ellipsis-caps its label with an
exact edge flip so it never clips outside the container.
