# Research intake 2026-11 Spec

## Objective

Run the library's third intake and mine it: the Box nightly series
(2026-09-13 to 2026-11-05), the Nov-5 research aggregation (nightlies, three
papers, `OTHER_ALPHA.md`, 38 VidBee video bundles, the private DM archive)
and the Box spike paper at hop 0; hop 1 in full; hop 2 under the routed-finding
gate; T1/T2/T3 mining into CiTO-typed, SKOS-routed findings with spans;
`/deep-research` per evidence-gap cluster; routing amendments to live
packets; per-hop coverage. Separately: download, dedupe and T1-triage the Box
`IP_LAW_ONTOLOGY_RESEARCH` pile as its own intake snapshot. Graduated from
[explorations/research-library-ontology](../../explorations/research-library-ontology/README.md).

## Non-Goals

- No implementation of findings routed to other packets; routing and
  amendments are the deliverable.
- No deep reads (T2) of the 449-PDF Box pile; T1 only, deep reads are a gated
  re-entry.
- No chasing X post bodies; `incomplete` dispositions stand.
- No video files in `objects/`; `.mkv` referenced by hash.
- No edits to the October intakes or their accounting (143 files, 461
  findings); this intake has its own denominators.
- Nothing from the private DM archive, client material or secrets enters
  the repo, a PR body, an alphaXiv library folder, or a Cursor/Junie lane.
- No new paid endpoints, credits or quota top-ups.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing standards and the volume-pool doctrine in `AGENTS.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the
   exploration packet's `BRIEF.md`, `DECISIONS.md` and `MAP.md`, and the
   October packet's `CONTRADICTIONS.md`, `COVERAGE.md` and `ROUTING.md` as
   the format precedent.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The out-of-repo library root: a new intake snapshot for the November
  corpus and a separate one for the Box legal-ontology pile; acquired
  objects, receipts, generated ontology and views.
- `packages/tooling/tool/cli/src/commands/Research/Library/*`: `mine`
  commands (T1 triage, T2 deep read, T3 synthesis runners as library
  commands with receipts; replaces the academia packet's out-of-repo scripts).
- `goals/research-intake-2026-11/research/`: `COVERAGE.md` (per hop and per
  intake), `ROUTING.md` + `routing.jsonl`, `CONTRADICTIONS.md`,
  `SOURCES.md`, `OPPORTUNITIES.md`; routing amendments land in the owning
  packets' files, never copied.
- Live packets that receive routed findings (amendments through their own
  conventions; one decision file per amendment where a goal packet is
  touched).

## Constraints

- Requires `research-library-ontology-core` and `research-library-routes`
  merged; the intake runs on the new models and routes only.
- Hop 0 census first, frozen as an immutable intake snapshot with hashes
  before any acquisition. The Box nightly series is authoritative for
  nightlies; local copies and the five 11-05 variants attach as versions of
  the same identities (`nearDuplicateOf`), never dropped. Byte-identical files
  share one object.
- The private DM archive imports with `accessClass: private`: mineable,
  excluded from rendered views by default, reported separately in `status`.
- Acquisition order: hop 1 fully (web via Firecrawl, GitHub cited objects,
  arXiv via alphaXiv full text, YouTube via yt-dlp then VidBee import, X via
  `research.web` Grok with `incomplete` dispositions) → reconciliation as its
  own phase with its own receipts → T1/T2 → hop-2 gate → hop-2 acquisition →
  second T1/T2 pass. Every hop has its own denominator in `COVERAGE.md`.
- Mining pools per `AGENTS.md`: T1 triage on `gpt-6-luna`
  (`child.lightweight`); T2 deep reads on Junie `claude-opus-5-5` while
  `bun run beep accounts` shows JetBrains credits, then `claude-opus-5-5`
  children; T3 synthesis by the orchestrating session. Every run records its
  `ModelRun` agent (model id, effort, launch argv) on the finding.
- Findings are CiTO-typed edges from a reading to a source span
  (`citesAsEvidence`, `citesAsRelated`, `citesForInformation`,
  `disagreesWith`), each with `skos:related` to zero or more live packet
  concepts. An unread or incomplete source supports no affirmative finding.
- `/deep-research` runs once per cluster that `CONTRADICTIONS.md` marks as an
  evidence gap, sequentially, at most six per intake; its confirmed and
  refuted claims import as session-owned results with the harness receipt.
- `/adhd` runs once on the routed finding catalog for the graduation
  portfolio of follow-on candidates.
- Box legal-ontology pile: Box route download, hash dedupe, own intake
  snapshot and denominator, T1 only; off-topic strays get a reviewed
  `non-reference`-class disposition, not deletion.
- Friction receipts go to `research/OPPORTUNITIES.md` as they happen.

## Acceptance Criteria

- [ ] Intake snapshot for the November corpus exists with a hash manifest;
      `research library status` shows hop-0, hop-1 and hop-2 denominators
      separately, plus the private partition count.
- [ ] Every hop-0 and hop-1 source has a readable capture or an explicit
      reviewed disposition; `verify` reports zero missing references and zero
      integrity failures.
- [ ] Hop-2 admissions are listed with their admitting finding and domain cap
      state; no GitHub transitive capture and no ungated hop-2 capture exists.
- [ ] Every readable hop-0/hop-1 artifact has a T1 triage record; every
      T1-selected artifact has a T2 reading with CiTO-typed findings and
      spans; `routing.jsonl` gives every finding a disposition (routed to a
      live packet, parked with trigger, or rejected with reason).
- [ ] Routing amendments landed in the owning packets (or their decision
      files) with back-links; no finding is "tracked" as a bare follow-up.
- [ ] `/deep-research` receipts exist for each gap cluster run (≤ 6), with
      confirmed/refuted claims imported and attributed.
- [ ] The Box legal-ontology intake snapshot exists with dedupe counts and T1
      records; no T2 reads.
- [ ] `COVERAGE.md`, `ROUTING.md`, `CONTRADICTIONS.md`, `OPPORTUNITIES.md`
      are complete; the exploration's `MAP.md` gated candidates are
      re-evaluated against the catalog in a decision file.
- [ ] Nothing from the private archive, client material or secrets appears in
      the repo, PR bodies or external lanes (`git grep` on the archive's
      message ids and participant handle returns nothing).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/research-intake-2026-11/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/research-intake-2026-11/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/research-intake-2026-11` | Passes |
| Library integrity | `bun run beep research library verify` | Zero missing, zero integrity failures |
| Coverage | `bun run beep research library status` | Per-hop denominators present |
| Mining receipts | `mine` command receipts under the library `ops/` | Every finding carries a `ModelRun` |
| Private partition | `git grep` for archive identifiers in the repo | No matches |
| Package proof | `bun run beep quality package-verify @beep/repo-cli` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add research-intake-2026-11 --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug research-intake-2026-11`; add a `kind: decision` file there, never edit this block._

### Box IP_LAW_ONTOLOGY_RESEARCH gets its own intake with T1 triage only, 2026-11-06

449 PDFs from 2026-06-02, a different corpus from the Nov-5 aggregation and from academia-2026-07. Download through the Box route, hash-dedupe, inventory as a separate snapshot with its own denominator, T1 triage on gpt-6-luna. Full mining would double deep-read volume and mix two topical catalogs; leaving it in Box repeats the academia PDF loss.

Lane `explore/research-library-ontology`

Reverse: Fire the legal-ontology-pile-deep-read re-entry in the exploration MAP; T2 reads run against the already-retained objects

### Box is the authoritative nightly series; near-duplicates are versions of one identity, 2026-11-06

The 34 Box nightlies (2026-09-13 to 2026-11-05) are hop 0 for the nightly series; 18 dates exist only there. Local copies and the five 11-05 variants attach as versions of the same identity linked by nearDuplicateOf; byte-identical files share one object; nothing is dropped (October D10).

Lane `explore/research-library-ontology`

Reverse: Re-inventory with the local directory as primary; identities and versions are additive so no bytes or receipts are lost

### Mining tiers and pools, 2026-11-06

T1 triage of every readable artifact on gpt-6-luna (child.lightweight); T2 deep reads on Junie claude-opus-5-5 while JetBrains credits remain (5 of 10 cycle on 2026-11-06), then claude-opus-5-5 children; T3 synthesis by the orchestrating session. /deep-research once per evidence-gap cluster, sequential, at most six (memory: parallel runs trip the server rate limit). /adhd once on the routed catalog for the graduation portfolio. Precedent: academia-corpus-mining T1/T2/T3.

Lane `explore/research-library-ontology`

Reverse: Change the pool order in the mine command config; ModelRun agents on every finding keep provenance intact

### The private DM archive enters the library under a private access class, 2026-11-06

Research-11-5-26 imports with accessClass private: mineable with hosted models (the OIP hygiene rule constrains what moves into the repo, not product architecture), excluded from rendered views by default, reported separately in status, never committed, never in a PR body, alphaXiv folder, Cursor or Junie lane.

Lane `explore/research-library-ontology`

Reverse: Remove the partition's objects from the library; the repo never held them

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
