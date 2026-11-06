# Friction receipts

## P4 local skill metadata blocked by unrelated upstream fetch, 2026-11-06

- Work: verify the local atom service guidance after changed-path review.
- Evidence: the broad skills update check failed on an unrelated held import's
  upstream HTTP 504 before completing its local checks. No retry or provenance
  acceptance followed.
- Impact: the broad check is failed, not passed; remote failure did not establish
  local content drift. No external service impact was measured.
- Workaround: use the existing local-entry hash service and canonical lock
  serializer for the one changed local skill, preserve every other entry, then
  run its scoped materialization check. Both installed targets match.
- Prevention: a local-only update/check mode could avoid coupling local metadata
  verification to unrelated floating imports. This delivery adds no new CLI mode
  and leaves the held import and existing Skills owner unchanged.

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

## P4 reference context and coverage accounting, 2026-11-06

- Work: reconcile the frozen audit census with the current tracked tree and
  review reference candidates before changing audited content.
- Evidence: the read-only Knowledge doctor reported 948 blocking reference
  candidates. Eleven selected cases were historical, normative, illustrative,
  package-relative or skill-relative references, not validated content defects.
  See the dated P4 reconciliation report under `history/`.
- Impact: raw candidate totals cannot measure accepted defects or semantic
  coverage. Explicit entry records also repeat paths and do not establish whole
  reads. No downstream content damage was observed because the candidates were
  reviewed before mutation.
- Prevention: retain source context, frozen blob identity, per-entry outcomes and
  separate accepted-review records. Keep the remaining candidates unresolved; do
  not suppress a class or assign zero claims from a mechanical count. This audit
  owns the review; existing gate and content owners retain their code.

## P4 effective-tree hash omitted after main integration, 2026-11-06

- Work: verify the skill reconciliation boundary after integrating newer main.
- Evidence: `bun run beep skills update --check` reported one stale file,
  `skills-lock.json`. Canonical regeneration changed only Yeet's
  `installedTreeHash`; the same check then passed.
- Attribution: newer main changed Yeet reference content. The generated local
  hash had not followed that content change. All other skill entries, ADHD
  provenance and skill source files were preserved.
- Impact: one stale effective-tree receipt; no runtime or user impact measured.
- Prevention: run the existing canonical update/check after skill edits and
  base integration. The audit repaired the generated field in this delivery;
  no duplicate content fix, manual hash or new gate was introduced.

## P4 future-use notes outlived their model policy, 2026-11-06

- Work: review current-use instructions separately from completed execution
  provenance and scanner reference candidates.
- Evidence: seventeen completed-packet headers still prescribed the September
  Codex route for future work. Current root Volume pools assigns a different
  substantive route. The old root anchor in those headers also no longer names
  a current heading. See the dated P4 future-routing qualification report.
- Impact: conflicting reuse guidance in seventeen headers. No incorrect model
  launch or resulting user impact was established.
- Workaround and prevention: preserve the old date/model/effort as history and
  link new work to the current root policy. Verify every byte outside those
  header blocks remains unchanged. Avoid duplicating another live model pin.
- Ownership: the audit owns these completed-packet qualifications. The retired
  Glob example is routed separately to the active DECISIONS owner in PR #2780;
  no competing source edit or unverified repair claim is included here.

## P4 memory context and checkout setup ordering, 2026-11-06

- Work: distinguish dated research from current memory configuration while
  preserving the original assessments and decisions.
- Evidence: T8 K2 compares an explicitly dated July 8 pending condition with a
  July 25 retirement decision. Automatic contradiction is rejected; current
  orientation is supplied without rewriting either historical statement.
- Impact: reader ambiguity established; no incorrect service deployment or
  runtime impact established. Current root policy remains authoritative.
- Setup friction: dependency setup began before the new checkout completed.
  It failed because a lockfile workspace was not yet on disk. The failed setup
  log was retained privately; preparation had not run. After checkout completion,
  frozen installation and canonical preparation passed, without manifest edits.
- Attribution: local operation ordering, high confidence. The measured impact
  is one failed setup attempt; total delay is unknown.
- Prevention and ownership: wait for successful checkout completion before
  dependency setup. This audit owns the two reading notes only. Other owners,
  PM recovery and ADHD provenance remain separate.
