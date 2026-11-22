---
title: "The delta's scope differs when the unit sets differ; a green run shows only its fixed count"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Render the full delta phrase as the green verdict suffix again and drop scopeDiffers from RunDelta."
---

RunDelta gains scopeDiffers (default false), set when the two runs' checked unit sets are not equal; only units both checked are counted. An item skipped or warned now is not fixed, since it neither passed nor is absent; an item skipped or warned before that fails now counts as new, because the earlier run did not see it fail. The red delta line ends with (scope differs) then. Core rendered a green run's delta as '; since last run: F fixed, 0 still failing, 0 new'; the SPEC asks for '(F fixed since last run)' and only when F > 0, so the plain-text projection now renders that suffix, with ', scope differs' inside the parentheses when the scopes differ, and nothing when a green run fixed nothing.
