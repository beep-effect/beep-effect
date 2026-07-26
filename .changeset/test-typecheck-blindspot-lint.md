---
"@beep/repo-cli": patch
---

New `beep lint package-test-typecheck` ratchet: flags packages whose `test/`
directory is invisible to their own `check` script, with a shrink-only
baseline at `standards/test-typecheck.blindspot-baseline.jsonc` (71 current
findings, rationale notes preserved across `--write-baseline`). Wired into the
root lint policy lane.
