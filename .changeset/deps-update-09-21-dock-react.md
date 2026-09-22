---
"@beep/dock-react": patch
---

The `Drop Quadrants` story waits for the pinned 960×640 geometry before its first pointer
probe. The old wait only required the target group to be wider than 100px, which the pre-pin
layout under vitest's default 414px viewport already satisfied, so the first probe could race
the ResizeObserver re-layout and record a root-relative pointer inside the source group, which
compiles to no drop preview. The component is unchanged.
