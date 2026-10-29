# Codex Security Findings (2026-10-20)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 8 Codex security findings captured on
2026-10-20 for `kriegcloud/beep-effect`: 3 Low, 5 Informational.
Ship one Yeet-driven PR to mergeable, merge it, then resolve the exact captured
Codex IDs until no packet-applicable finding remains open.

The operator expanded this same single-PR goal to include all 123 captured GitHub
Dependabot alerts captured in `ops/dependabot.json` (63 unique advisories after the post-publication refresh).
Keep this separate from the exact eight Cloud identities. Every captured alert
requires a source-backed disposition and merged-revision closure evidence;
fixture location alone does not establish an invalid alert.

Read first:

- `goals/codex-security-findings-2026-10-20/README.md`
- `goals/codex-security-findings-2026-10-20/SPEC.md`
- `goals/codex-security-findings-2026-10-20/PLAN.md`
- `goals/codex-security-findings-2026-10-20/ops/manifest.json`
- `goals/codex-security-findings-2026-10-20/ops/triage.json`
- `goals/codex-security-findings-2026-10-20/findings/INDEX.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge authenticated findings closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Rules:

1. Default every item to `remediate`; use `already-fixed` or `false-positive`
   only with strict current-HEAD proof in the finding and triage ledger.
   Before verdicts, enrich each CSV Summary with Validation, Evidence, and Attack-path analysis; record gaps and hold unsupported decisions.
2. Apply Effect-first and schema-first repo law. Search live source and barrels
   before adding helpers; reuse canonical path-safety and bounds primitives.
3. Fix shared causes once. Add one focused regression check per executable-code
   finding, merging tests only where the same root cause is exercised.
4. Keep raw report bodies ignored under `raw/`. Tracked records may contain only
   sanitized metadata, summaries, decisions, changed files, and proof.
5. Run focused tests, affected package checks, packet validation, then Yeet
   repair/verify. Publish one intentional PR and monitor through mergeable.
6. After merge, close only the exact 8-ID allowlist in Codex as Fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.

The manifest proposes closeout for PR #1930. Resume its outstanding gates rather
than treating that proposal as completion. After merge, merged proof and exact-ID
closure, retain the genuine final-head merge-ready Yeet verdict and run
`bun run beep goals completion refresh --slug codex-security-findings-2026-10-20`.

## Supplemental scope — 2026-10-28

The user added the current Cloud batch. Read
`research/2026-10-28-cloud-refresh.md` and the linked
`../codex-security-findings-2026-10-28/GOAL.md`. Complete both inventories.
PR #1930 is already merged; retain its proof and deliver the supplemental
fixes through a new Yeet PR with exact-ID post-merge closure.
