---
"@beep/professional-desktop": patch
---

Fix the unreachable edit-as-branch version-selector affordance: branch-point detection now runs
against the full thread timeline (rendering stays restricted to active-branch turns), so a single
edit renders the versions affordance on its branched turn.
