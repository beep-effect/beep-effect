# Codex Security Findings (2026-09-03)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 12 Codex Cloud security findings captured on
2026-09-03 for `kriegcloud/beep-effect`: 12 Informational.
Ship one Yeet-driven PR to mergeable, merge it, then resolve the exact captured
Codex IDs until no packet-applicable finding remains open.

Read first:

- `goals/codex-security-findings-2026-09-03/README.md`
- `goals/codex-security-findings-2026-09-03/SPEC.md`
- `goals/codex-security-findings-2026-09-03/PLAN.md`
- `goals/codex-security-findings-2026-09-03/ops/manifest.json`
- `goals/codex-security-findings-2026-09-03/ops/triage.json`
- `goals/codex-security-findings-2026-09-03/findings/INDEX.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge Chrome closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

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
6. After merge, close only the exact 12-ID allowlist in Codex as Already fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.
