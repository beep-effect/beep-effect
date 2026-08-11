---
"@beep/ui": patch
---

Await overlay visibility in Storybook interaction tests instead of asserting it in the microtask after a click.

The DatePicker `Default` story raced the Radix popover enter animation and failed on CI runners with the calendar grid present in the DOM but not yet visible. The same unguarded pattern is corrected in the Drawer stories and the Emoji form field. The `NonDismissible` drawer assertion stays synchronous on purpose, with a comment explaining that a retrying `waitFor` would mask a drawer that closes and reopens.

Story files only — no component behavior changes.
