# Codex Security Findings (2026-08-13)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 13 Codex Cloud security findings captured on
2026-08-13 for `kriegcloud/beep-effect`: 6 High, 4 Medium, 1 Low, 2 Informational.
Ship one Yeet-driven PR to mergeable, merge it, then resolve the exact captured
Codex IDs until no packet-applicable finding remains open.

Read first:

- `goals/codex-security-findings-2026-08-13/README.md`
- `goals/codex-security-findings-2026-08-13/SPEC.md`
- `goals/codex-security-findings-2026-08-13/PLAN.md`
- `goals/codex-security-findings-2026-08-13/ops/manifest.json`
- `goals/codex-security-findings-2026-08-13/ops/triage.json`
- `goals/codex-security-findings-2026-08-13/findings/INDEX.md`
- `goals/codex-security-findings-2026-08-13/research/QUALITY_REVIEW.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge Chrome closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Current position: P2/P3 are complete. CSF-002, CSF-007, CSF-009, CSF-010,
CSF-012, and CSF-013 are locally complete. CSF-011 was already fixed.
The quality ledger contains 42 reviewer and gate items, all fixed with the
commit pending. Post-merge baseline regeneration and the 15-lane aggregate
audit are green. The final refresh used `origin/main` `642331b86c` and merge
HEAD `8337a21710`; two compatibility reviewers returned literal
`0 changes suggested`. Further review rounds are closed, and narrow publication
is executing for `CSF-002` then `CSF-007` then `CSF-010`.
CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 remain confirmed
`remediate` items blocked on runner admission/workload-identity architecture
and external GitHub organization runner-group/AWS deployment proof.

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
6. After merge, close only the exact 13-ID allowlist in Codex as Already fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.
7. Execute publication only for the ordered `CSF-002` then `CSF-007` then
   `CSF-010` sequence; do not publish any other finding without new
   authorization.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.
