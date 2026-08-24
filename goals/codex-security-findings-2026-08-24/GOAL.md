# Codex Security Findings (2026-08-24)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: account for the 19 Codex Cloud security findings captured on 2026-08-24
for `kriegcloud/beep-effect`: 5 High, 4 Medium, 5 Low, 5 Informational. Ship PR
#783, close 13 exact IDs as Already fixed, and transfer the six runner-boundary
IDs to `goals/runner-trust-boundary` under its explicit proof gates.

Read first:

- `goals/codex-security-findings-2026-08-24/README.md`
- `goals/codex-security-findings-2026-08-24/SPEC.md`
- `goals/codex-security-findings-2026-08-24/PLAN.md`
- `goals/codex-security-findings-2026-08-24/ops/manifest.json`
- `goals/codex-security-findings-2026-08-24/ops/triage.json`
- `goals/codex-security-findings-2026-08-24/ops/closures.json`
- `goals/codex-security-findings-2026-08-24/findings/INDEX.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, 13 post-merge dashboard closures, and the six-ID handoff.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Current position: `completed-retained`. All 19 findings were validated. PR #783
contains the 15 repo-side remediations. Thirteen dashboard IDs were closed as
Already fixed on 2026-08-24. CSF-003 and CSF-009 remain open pending
`goals/runner-trust-boundary` P1 deployment proof. CSF-001, CSF-004, CSF-005,
and CSF-006 are transferred to that packet. This packet does not own further
remediation or claim closure for those six IDs.

Rules:

1. Default every item to `remediate`; use `already-fixed` or `false-positive`
   only with strict current-HEAD proof in the finding and triage ledger.
2. Apply Effect-first and schema-first repo law. Search live source and barrels
   before adding helpers; reuse canonical path-safety and bounds primitives.
3. Fix shared causes once. Add one focused regression check per executable-code
   finding, merging tests only where the same root cause is exercised.
4. Keep raw report bodies ignored under `raw/`. Tracked records may contain only
   sanitized metadata, summaries, decisions, changed files, and proof.
5. Treat PR #783 as the repository remediation evidence for this retained
   packet. Do not reopen its source scope for receiving-packet work.
6. Preserve the 13 exact-ID closures in `ops/closures.json`; that ledger must
   remain the exact complement of `runner-trust-boundary`'s six-open table.
   Close CSF-003 and CSF-009 only after that packet's P1 deployment proof and
   post-merge dashboard-closure gate.
7. Keep CSF-001, CSF-004, CSF-005, and CSF-006 with
   `goals/runner-trust-boundary` until it records the admission,
   workload-identity, deployment, and dashboard evidence. The handoff is not
   accepted risk or closure.

Stop if tracked evidence contains secret or raw-path material, a proposed edit
reopens this packet's completed source scope, or a dashboard action would close
one of the six handed-off IDs without the receiving packet's required proof.
