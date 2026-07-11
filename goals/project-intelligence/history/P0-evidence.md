# P0 Evidence Note — Research Phase Exit

Date: 2026-07-11. Branch: `docs/project-intelligence-p0` (base `main` at
`c63d23c1b4`). This note is the deterministic P0 evidence artifact required by
PLAN.md "Phase evidence conventions"; it is linked from README "Latest
Evidence" and never registered in `researchReports[]`.

## Exit summary

Seven research artifacts exist and are registered in the manifest
(`researchReports[]`): [`recon-report.md`](../research/recon-report.md),
[`interest-taxonomy-watchlist.md`](../research/interest-taxonomy-watchlist.md),
[`product-definition.md`](../research/product-definition.md),
[`architecture-proposal.md`](../research/architecture-proposal.md),
[`technology-adr.md`](../research/technology-adr.md),
[`prototype-disposition.md`](../research/prototype-disposition.md), and
[`threat-model.md`](../research/threat-model.md). The architecture proposal
and technology ADR are additionally listed in `currentSourceOfTruth[]` as the
normative surfaces that name P2+ target topology.

Gate outcomes, each a dated SPEC decision-table entry citing its artifact:

| Gate | State | SPEC entry | Owning artifact |
| --- | --- | --- | --- |
| G1 ownership | accepted | D9 | architecture-proposal.md |
| G2 technology ADR | accepted | D10 | technology-adr.md |
| G3 prototype fate | accepted | D11 | prototype-disposition.md |
| G4 source identity & lifecycle | accepted | D12 | architecture-proposal.md |
| G5 fixture ownership & catalog | accepted | D13 | architecture-proposal.md |
| G6 watchlist entry | accepted | D14 | architecture-proposal.md |
| G7 projections | deferred-nonblocking | D15 | architecture-proposal.md |
| D7 threat baseline | discharged for P0 | D16 | threat-model.md |
| First-source swap clause | evaluated, declined | D17 | interest-taxonomy-watchlist.md |

G1 declines epistemic mechanism consumption, so the SPEC Exception Ledger
remains `None`. The freshness re-check ran on 2026-07-11 with **no drift**
against the recorded baselines (recorded in
[`recon-report.md`](../research/recon-report.md)).

Corpus reconnaissance preflight: the operator granted a session-only,
read-only allowlist in-session covering two locations (named in the packet
only by sanitized category: the operator projects collection and the operator
knowledge vault with its prototype catalog). The allowlist was not committed;
sampling stayed within it; committed conclusions are coarsened aggregates.

## Process provenance

- Five research artifacts were drafted by delegated coding agents under
  written single-file contracts; the recon report and taxonomy/watchlist were
  authored in-session from the corpus-sweep aggregates.
- The corpus sweep itself was delegated to a read-only agent bound to the
  allowlist and metadata-only sampling caps; only sanitized aggregates left
  the session (provenance row `corpus-sweep-2026-07-11` in
  [`SOURCES.md`](../research/SOURCES.md)).
- External ADR facts (licenses, vendor behavior) were checked by a dedicated
  web-verification pass on 2026-07-11: nine claims checked, eight verified as
  drafted, one precision correction folded in (mem0 "Graph Memory" is
  hosted-platform-only; the open-source analog is entity-linking retrieval).
  The verification record lives in
  [`technology-adr.md`](../research/technology-adr.md); external sources are
  mirrored in SOURCES.md sections 2–3.
- Watchlist seeds: twenty candidate public repositories verified against the
  GitHub API (existence, machine-readable license, archived state); one
  unresolved name dropped; one provider-side rename observed and recorded as
  live G4 evidence.
- Adversarial review, round 1 (working-tree scope): six findings — operator
  corpus specifics (coarsened to non-identifying magnitudes), incomplete gate
  bookkeeping (completed: D9–D17, manifest, PLAN, README, INDEX), ADR/G1
  authority contradiction (ADR now classifies observations/assessments as
  rebuildable intermediates), redaction/hash ambiguity (resolved by the G4
  two-digest contract: `acquisitionDigest` for change detection,
  `contentHash` over accepted post-safety bytes for payload dedup and
  evidence anchoring, `safetyPolicyVersion` in the `SnapshotId` tuple),
  product-census claim row (aligned to accepted G1), and non-reproducible
  external verification (verification record + SOURCES sections added).
- Adversarial review, round 2: three findings — projects-collection
  technology attributions (removed; item-level composition and project
  identities excluded under D2), "raw payload" retention wording (all payload
  storage language normalized to accepted post-safety bytes with an explicit
  never-persist-pre-redaction invariant), and a threat-model decision-number
  collision (aligned to D16).
- Adversarial review, round 3 (confirmation): pass — all round-2 findings
  verified resolved, no new material findings; the review loop ended dry.

## Verification battery (recorded before publication)

Commands per SPEC/PLAN, run after staging the full P0 change set; results
recorded in the "Battery results" list below.

- `test "$(wc -m < goals/project-intelligence/GOAL.md)" -le 4000`
- `jq . goals/project-intelligence/ops/manifest.json`
- manifest assertions (`jq -e` initiative id/anchor/launcher/lifecycle)
- indexed paths exist (`currentSourceOfTruth[]`, `researchReports[]`)
- `git diff HEAD --check -- goals/project-intelligence`
- `bun run beep lint reflection-artifacts`
- the canonical D2 mechanical tri-state check (SPEC "Public-repo
  sanitization")
- `bun run beep goals doctor`
- `bun run beep goals index --check`

Battery results (2026-07-11, after staging the full change set): all
commands passed — GOAL size, manifest JSON and assertions, indexed paths,
whitespace check, the D2 mechanical tri-state check (zero hits), the coarse
packet-reference grep, `bun run beep lint reflection-artifacts` (pass; only
pre-existing advisory warnings on unrelated packets), `bun run beep goals
doctor` (no new blocking findings), and `bun run beep goals index --check`
(INDEX matches manifests).

## Manual sanitization review (SPEC D2 semantic layer)

Reviewed on 2026-07-11 by the session agent, covering all files touched by
P0: the seven research artifacts, SOURCES.md, SPEC.md (D9–D17), PLAN.md,
README.md, `ops/manifest.json`, `goals/INDEX.md`, and this note.

- The corpus allowlist is not committed anywhere; corpus locations appear
  only as sanitized categories ("operator projects collection", "operator
  knowledge vault", "prototype catalog").
- No personal names, email-formatted strings, usernames, or handles; x-post
  material appears only as a coarse count.
- No absolute local paths and no tilde paths; all evidence citations are
  repo-relative.
- The adversarial loop twice escalated the semantic bar, and both
  escalations were applied: precise corpus inventory, activity timestamps,
  and per-domain tallies were coarsened to non-identifying magnitudes
  (round 1), and projects-collection technology attributions plus a local
  project description were removed outright because a distinctive
  combination can fingerprint private local activity even without names
  (round 2). Named technologies in committed artifacts are now sourced only
  from vault-capture material and public-repository verification.
- Adversarial payload sketches in the threat model describe email-formatted
  or path-shaped payloads verbally instead of literally, so example strings
  cannot trip the mechanical patterns or leak plausible secrets.
- The mechanical tri-state check passed after every remediation (final run
  recorded in the battery results above).

## Phase-Exit Audit — pass 1 (excluding the status flip and hosted-PR conditions)

1. Required artifacts exist at their named paths — yes (seven `research/`
   artifacts plus this note at its deterministic path).
2. README (status, Current Phase, Latest Evidence), PLAN top-level Status
   line and P0 row, and manifest phase statuses agree — yes (all state P0
   complete; the packet lifecycle is `paused`, parked by the cross-portfolio
   roadmap that landed on `main` during this phase, with P1 as the on-resume
   next action; hosted-PR agreement is a pass-2 condition).
3. Every gate closed by P0 has a dated D8+ SPEC entry citing evidence — yes
   (D9–D17).
4. New `research/` artifacts registered in `researchReports[]` (and
   `currentSourceOfTruth[]` where normative); this history note is NOT
   registered there and is linked from README "Latest Evidence" — yes.
5. The manifest P0 `exit` oracle is satisfied excluding the flip and
   hosted-PR conditions: allowlist-bounded recon with recorded freshness
   check — yes; seven artifacts registered — yes; this evidence note with
   manual sanitization review — yes; G1–G6 accepted, G7
   deferred-nonblocking — yes; sanitization mechanical + manual — yes; "P0
   PR driven to mergeable via yeet" — pass-2 condition.
6. Sanitization: mechanical zero-hits plus the recorded manual review above —
   yes.
