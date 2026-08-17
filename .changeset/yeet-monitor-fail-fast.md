---
"@beep/repo-cli": patch
---

Plan the yeet monitor check watch as `gh pr checks --watch --fail-fast`, so the first failed
check ends the watch immediately instead of being withheld until the last pending lane
finishes — this repo's lane tails run 20-30 minutes, so a T0 red previously reached the
operator up to half an hour late. First A1 slice of goals/ship-velocity (research/c2 §1
identified the missing flag); the registration backoff and rerun triage are unchanged.
