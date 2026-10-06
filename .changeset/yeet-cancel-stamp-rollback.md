---
"@beep/repo-cli": patch
---

`yeet job cancel` no longer strands a readiness monitor after a failed
`systemctl --user stop`: when the unit is still loaded (`stop-failed`) the
launcher clears the cancel stamp it wrote, so the monitor reads as live again
and the next `yeet publish` reuses it instead of submitting a second monitor
for the same pull request. `stop-requested` and `unit-absent` keep the stamp.
