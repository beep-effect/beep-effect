# Codex Security Findings (2026-06-17)

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Supersedes `goals/codex-security-findings-2026-06` (scan `5138…`, 52 findings)
which stalled at 12/52 captures and never reached triage. That packet is retained
as `reference`; this packet is a new, larger batch: scan `f4128216…`, 71
findings, on branch `security/6-17-2026`.

## Mission

Triage, remediate-by-default, and close all 71 Codex Cloud security findings from
scan `f4128216e9c08191b0431ea2a05322bb` in a single, mergeable PR on
`security/6-17-2026`. Every finding ends Closed in Codex with the correct reason
(`False positive` / `Won't fix` / `Already fixed`).

## Launch

Start from `GOAL.md` in execution-capable sessions. It is only a compact
launcher; `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan (P0-P8 + two gates).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`ops/triage.json`](./ops/triage.json) - per-finding run-state ledger.
6. [`findings/INDEX.md`](./findings/INDEX.md) - finding catalog index.

## Current Phase

`P0 bootstrap` - packet scaffolded on `security/6-17-2026`; manifest/triage/index
stubs valid. Next: `P1 extract` - capture all 71 OPEN findings (Report + Patch)
from the authenticated Codex tab into the private raw capture root.

## Latest Evidence

`2026-06-17` - packet scaffolded; branch verified equal to `origin/main` with
zero unique commits (PR diff will contain only this work).

## Notes

- Two human approval gates: GATE 1 after triage (disposition matrix), GATE 2
  before merge. Do not start Codex closures or remediation before GATE 1.
- Raw captures stay untracked in a machine-local scratch directory outside the repo;
  commit only sanitized markdown + (post-fix) patches.
- The user-provided `openai.com_cookies.txt` lives only in the raw capture root
  and must never enter the repo (`*cookies*.txt` is gitignored).
- Unremediated findings keep exploit detail, specific evidence paths, source
  commits, and patch material redacted from public tracking until their fixes
  land atomically with verification. Tracked ledgers carry title + severity +
  disposition + justification.
- The packet is tracking metadata, not package source or generated public API
  input; it is excluded from repo-export, docgen, and JSDoc inventory surfaces.
- `.repos/` is gitignored, reference-only (effect-v4); any finding rooted there
  is out-of-scope and closes as `False positive`.
