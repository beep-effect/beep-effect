# Friction receipts

## 2026-09-24: scheduler status example omits a required flag

While inspecting proof admission, the Yeet skill's scheduler status example
failed with "Missing required flag: --json". Live help requires that flag.

Resolution: rerun the read-only status command with --json. Retain this as a
concrete future audit case; the planning PR does not change the skill.
Command-parser probes would detect this guidance drift deterministically.

## 2026-09-24: detached proof environment

The first detached verify launch reported "Detached proof jobs require an active
systemd user manager." A read-only probe confirmed that the existing user manager
was available when the workstation's documented runtime and D-Bus environment
were supplied.

Resolution: use that existing user-session environment for detached jobs.
Do not start or restart services to repair a missing inherited environment.
Distinguishing an unreachable session bus from an absent manager would make the
diagnostic more actionable.

## 2026-09-24: broad repair rewrites unrelated source

The canonical Yeet repair pass rewrote terser helper callbacks and import
ordering in three unchanged CLI source files while preparing this docs-only
packet. The lane started clean; no worker was assigned code edits.

Resolution: preserve the generated diff locally, inspect it, and restore only
those three repair-produced changes to the lane's HEAD. Keep this PR scoped to
the approved docs delivery and prove that scope afterward. A docs-only repair
plan that avoids inherited source formatting would prevent this detour.

## 2026-09-24: docs-only artifact boundary

While designing persistent inventories, inspection of HeavyAdmission.ts showed
that goal-local research JSON/JSONL and template .gitkeep entries do not satisfy
docs-only classification. Markdown and the goal manifest do.

Resolution: use authored Markdown contracts/specimens in the planning PR and
defer executable fixtures/full ledgers to implementation. A packet scaffold that
reports delivery classification would prevent this surprise. Do not broaden
CI exemptions to accommodate this packet.

## 2026-09-24: overlapping initiative and partial bootstrap

The active knowledge-surface-automation packet already ratifies much of this
audit's infrastructure, while some prose describes bootstrap as absent. Live
help exposes a plan-only compiler; no supported materializer exists.

Resolution: link a bounded campaign, inherit decisions, and use the standard
manual template. Capability receipts should distinguish planned, report-only,
and write-capable commands. This observation is audit input, not permission to
rewrite the parent initiative's history.

## 2026-09-24: ADHD concurrency and context limits

The skill defaults to five fresh parallel generator branches. This session had
three child slots, and a fresh spawn returned "agent thread limit reached."

Resolution: disclose a three-frame run using the existing isolated explorer
contexts, with no idea sharing during divergence. A concurrency-aware skill
variant could preserve an honest provenance statement without pretending the
default experiment ran.

## 2026-09-24: documentation retrieval format

Some TypeSafe Markdown endpoints returned "Unsupported content-type" or
inaccessible responses through the web reader while direct HTTPS retrieval
succeeded.

Resolution: read the public Markdown over HTTPS and retain source URLs and
observation date. Retrieval failure must stay distinct from a negative claim
judgment. An alternate public-text fetch avoids treating reader limitations as
missing evidence.

## Repeated proof cost for packet closeout

- Work: publish a docs-only goal packet, address review, and record delivery.
- Evidence: the review-fix publication selected CLI coverage, which passed in
  about 11 minutes, then ran merged-preview CI parity with another JSDoc scan.
  Proof reuse requires the exact commit and diff fingerprint, so a later
  lifecycle receipt cannot reuse the preceding full proof unchanged.
- Prevention candidate: evaluate a documented packet-closeout proof contract
  with explicit goal-schema, content, and dependency obligations. Preserve
  current gates until that contract is implemented and reviewed; this packet
  does not authorize bypassing them.
