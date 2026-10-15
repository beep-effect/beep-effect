# Cache baseline review: practice-gateway merge with main

Reviewed 2026-10-14 when merging `origin/main` into `feat/practice-gateway`.
The committed baseline conflicted (main re-recorded other subjects), so the
merge takes main's baseline and re-records this lane's subjects once.

Subjects and basis, unchanged from their earlier reviews in this lane:

- `@beep/windows-secrets`, `@beep/practice-gateway`, `@beep/mcpb-kit`: new
  workspaces with the standard generated tasks
  (`cache-baseline-review.md`).
- `@beep/practice-setup`: new workspace with the standard generated tasks
  (`cache-baseline-review-practice-setup.md`).
- `@beep/practice-gateway` dependency and manifest drift
  (`cache-baseline-review-units-a.md`,
  `cache-baseline-review-onboarding-wiring.md`).
- `@beep/practice-kg-mcp`: dependency-digest drift only, from moving its
  host resources into `@beep/law-practice-server` and its packaging into
  `@beep/mcpb-kit`; commands, inputs, outputs, env and cache flags unchanged.

- `//` (root): the workspace registrations for the four new packages in the
  root `package.json`; root task commands and turbo configuration unchanged.

No qualification is granted and no other subject changes.
