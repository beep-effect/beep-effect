# Identity IRI fibered friction receipts

## 2026-08-25 — Vitest forks worker startup timeout inside Codex sandbox lanes

- **Work:** Codex implementation lanes (GPT-5.6 Sol, `codex exec -s workspace-write`)
  running the canonical package Vitest commands for `@beep/identity`,
  `@beep/repo-utils`, `@beep/semantic-web`, and `@beep/epistemic-server`.
- **Evidence:** inside the sandbox every run exited before importing a test
  file with `[vitest-pool]: Failed to start forks worker` and
  `Timeout waiting for worker to respond` after 60 seconds. Both lanes
  self-patched the package-local `vitest.config.ts` to `pool: "threads"` to get
  green. Outside the sandbox the unchanged fork pool passes every one of those
  packages first try (identity 103/103, repo-utils 221/221, semantic-web 15/15,
  epistemic-server 32/32), so the operator reverted all three config edits
  before verification — the failure is environment-only (sandbox process
  model), not a repo defect.
- **What would have prevented it:** a documented lane rule that Codex sandbox
  lanes pass `--pool=threads` on the command line instead of editing
  committed Vitest config, plus an early worker-startup probe in the shared
  Vitest config that names the remediation instead of timing out after 60 s.
