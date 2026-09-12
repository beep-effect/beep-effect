---
"@beep/repo-cli": patch
---

Stop `beep goals index --check` and `beep explore atlas --check` from failing on
a stale git-ignored local projection. `goals/INDEX.md` and `explorations/ATLAS.md`
are workstation state that every fast-forward landing a manifest change leaves
behind and that no hosted lane carries, so the red could only ever appear in a
local `bun run lint`; both checks still prove generation and now report the
stale copy as an advisory, while drift in the tracked README status regions
still fails the atlas check.
