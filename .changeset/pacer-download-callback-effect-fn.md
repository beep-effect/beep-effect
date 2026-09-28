---
"@beep/pacer": patch
---

Build the `downloadCases` acquire-use-release callback with `Effect.fnUntraced` instead of
returning `Effect.gen` directly, satisfying the repo's effect-fn law.
