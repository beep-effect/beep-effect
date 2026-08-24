# Codex Security Findings (2026-08-24)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 19 Codex Cloud security findings captured on
2026-08-24 for `kriegcloud/beep-effect`: 5 High, 4 Medium, 5 Low, 5 Informational.
Ship one Yeet-driven PR to mergeable, merge it, then resolve the exact captured
Codex IDs until no packet-applicable finding remains open.

Read first:

- `goals/codex-security-findings-2026-08-24/README.md`
- `goals/codex-security-findings-2026-08-24/SPEC.md`
- `goals/codex-security-findings-2026-08-24/PLAN.md`
- `goals/codex-security-findings-2026-08-24/ops/manifest.json`
- `goals/codex-security-findings-2026-08-24/ops/triage.json`
- `goals/codex-security-findings-2026-08-24/findings/INDEX.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge Chrome closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Current position: `active`. P2 validation and repo-side P3 remediation happened
in this capture PR. Fifteen findings have repo-side fixes with focused proof.
CSF-001, CSF-004, CSF-005, and CSF-006 remain confirmed `remediate` items
handed to the runner-admission/workload-identity arc for external GitHub
organization runner-group and AWS deployment proof. Post-merge dashboard
closure remains pending for the exact 19 captured IDs.

Rules:

1. Default every item to `remediate`; use `already-fixed` or `false-positive`
   only with strict current-HEAD proof in the finding and triage ledger.
2. Apply Effect-first and schema-first repo law. Search live source and barrels
   before adding helpers; reuse canonical path-safety and bounds primitives.
3. Fix shared causes once. Add one focused regression check per executable-code
   finding, merging tests only where the same root cause is exercised.
4. Keep raw report bodies ignored under `raw/`. Tracked records may contain only
   sanitized metadata, summaries, decisions, changed files, and proof.
5. Run focused tests, affected package checks, packet validation, then Yeet
   repair/verify. Publish one intentional PR and monitor through mergeable.
6. After merge, close only the exact 19-ID allowlist in Codex as Already fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.
7. Keep the four runner findings with the receiving architecture arc until it
   records the required external proof. Do not treat the handoff as accepted
   risk or as dashboard closure.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.
