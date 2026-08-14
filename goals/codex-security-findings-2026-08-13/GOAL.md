# Codex Security Findings (2026-08-13)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 19 Codex Cloud security findings captured on
2026-08-13 for `kriegcloud/beep-effect`: 7 High, 6 Medium, 2 Low, 4 Informational.
Ship the remaining fixes through Yeet-driven mergeable PRs, merge them, then
resolve the exact captured Codex IDs until no packet-applicable finding remains
open.

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

Current position: P2/P3 are complete for all 19 findings. CSF-002, CSF-007,
CSF-009, CSF-010, CSF-013, and CSF-014 are merged; CSF-011 was already fixed.
CSF-012, CSF-015, CSF-016, CSF-017, CSF-018, and CSF-019 have focused local
proof and are being consolidated into PR #712; merged-tree full Yeet proof and
publication remain pending. The prior quality ledger contains 42 repaired
reviewer and gate items, and the only known #712 review thread has a proved
local documentation fix awaiting the combined push.
CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 remain confirmed
`remediate` items blocked on runner admission/workload-identity architecture
and external GitHub organization runner-group/AWS deployment proof.

Rules:

<!-- codex-findings-refresh:start -->
Refresh triage: all 19 records are validated and assigned to remediation lanes.
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
   repair/verify. Publish intentional narrow PRs and monitor through mergeable.
6. After merge, close only the exact 19-ID allowlist in Codex as Already fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.
7. Treat CSF-002, CSF-007, CSF-009, CSF-010, CSF-013, and CSF-014 as merged.
   Consolidate the six remaining repository-fixable findings into PR #712;
   never merge it, and do not publish the six externally blocked findings.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.
