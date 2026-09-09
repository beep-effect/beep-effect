# Codex Security Findings (2026-09-08)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 12 Codex Cloud security findings captured on
2026-09-08 for `kriegcloud/beep-effect`: 1 Medium, 3 Low, 8 Informational.
Ship the Yeet-driven remediation PRs to mergeable, merge them, then resolve the exact captured
Codex IDs until no packet-applicable finding remains open.

Read first:

- `goals/codex-security-findings-2026-09-08/README.md`
- `goals/codex-security-findings-2026-09-08/SPEC.md`
- `goals/codex-security-findings-2026-09-08/PLAN.md`
- `goals/codex-security-findings-2026-09-08/ops/manifest.json`
- `goals/codex-security-findings-2026-09-08/ops/triage.json`
- `goals/codex-security-findings-2026-09-08/findings/INDEX.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge Chrome closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Rules:

<!-- codex-findings-refresh:start -->
Eleven findings merged in PR #1026. CSF-012 is implemented for the operator-authorized follow-up PR; proof, publication, and exact-ID closure remain in progress.
<!-- codex-findings-refresh:end -->

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

The operator explicitly authorized resolving all current security findings in one
PR, including the work needed to unblock it. Earlier archived-packet scope and
approval gates are superseded. Refresh the live findings before final publication
and reconcile any additions into this same PR. Keep raw evidence private and
resolve routine implementation or environment issues within this authorization.

The operator authorized a follow-up PR on September 9 because PR #1026 merged
while the newly surfaced CSF-012 fix was being finalized. That authorization
supersedes the original one-PR limit. Prior findings remain covered by #1026;
CSF-012 must merge before its Codex finding is closed.
