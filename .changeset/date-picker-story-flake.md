---
"@beep/ui": patch
---

Deflake the date-picker Default story: wait for the calendar popover grid to
become visible after the trigger click instead of asserting immediately —
the popover-open animation raced the assertion in the Storybook browser lane.
