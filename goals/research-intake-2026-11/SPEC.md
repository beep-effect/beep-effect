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

### Hop 0 takes the Box nightly series as listed at snapshot time; aliases are versions, not new dates, 2026-11-07

The Box root now lists 36 nightly files against the 34 surveyed: a 2026-11-06 report and a misnamed alias of 2026-11-04 with the same SHA-1. The snapshot includes 2026-11-06 because Box is authoritative for the series and freezing an older listing would drop a source; the alias shares the 2026-11-04 object. Local 11-05 (3) is byte-identical to Box 2026-10-21 and attaches to that identity, not to 11-05. Rejected: filename-keyed identity, which files three different reports under 11-05.

Lane `feat/research-intake-2026-11`

Reverse: Exclude the 2026-11-06 nightly from the snapshot by re-inventorying with a date filter; objects and receipts are additive

### Unfetchable hop-1 identities get rule-classified reviewed dispositions, one rule per evidence class, 2026-11-07

891 November hop-1 identities were not fetchable: 449 internal and 423 unresolved kinds (mostly paths and tokens inside the private archive's repo snapshot) and 19 X posts. Each got a reviewed disposition whose evidence binds every inventoried occurrence (document snapshot hash, position, context hash). Rules: relative and repository paths, Effect/@beep module specifiers and in-bundle document anchors are internal when the source is internally owned and non-reference otherwise (the importer admits internal only for internal ownership); slash tokens with no scheme or host and truncated URLs are non-reference; X posts are incomplete (SPEC non-goal); two Hugging Face dataset ids cited without a host are tool-blocked because reference resolution admits only GitHub proofs. 90 owner/name-shaped tokens were read individually before the rule applied. Rejected: leaving them missing (fails the readable-or-disposed criterion) and resolving them through web search (no authentic proof object).

Lane `feat/research-intake-2026-11`

Reverse: Delete the 891 reviewed-disposition captures by their review ids and re-run the generator with different rules; the sources and occurrences are untouched

### Hop 2 admits the 400 most cross-site-cited routed identities; page chrome and fragments are refused, 2026-11-07

With routed findings in place, the routed-parent gate with a 25-per-domain cap admitted 15,597 hop-2 identities. Nearly every hop-1 parent carried live topics, and the top of the list was site navigation, social profiles, privacy pages, image assets and extraction fragments such as https://arxiv/ and doi.org/10. That exceeded the remaining Firecrawl plan credits (about 6,600 of 8,000) and the mining budget with no purchase allowed. The gate now refuses non-content (reserved hosts, IP literals, static assets, dotless or wildcard hosts, bare site roots, empty query values, suffixless DOIs, social or consent hosts, X profiles other than posts, YouTube channel pages, legal and administration paths), counts in-degree only from routed parents on a different site than the child, and admits a global budget of 400 by that in-degree with a canonical-URL tie-break. Result on the real library: 75,918 hop-2 identities catalogued, 400 admitted, 9,481 non-content, 43,863 over budget, 15,611 unrouted, 4,607 GitHub not transitive, 1,544 arXiv catalogue-only. Residual portal pages among the 400 are left to T1, which skips them. Rejected: a relevance-score threshold (model opinion, as the routes goal already decided) and acquiring the 15,597.

Lane `feat/research-intake-2026-11`

Reverse: Raise --hop2-limit or clear the chrome lists in LibraryHopPolicy and re-run hops and acquire; refused identities stay catalogued

### The legal-ontology pile is its own private intake; off-topic strays are dispositioned by reviewed T1 skips, 2026-11-07

The 449 IP_LAW_ONTOLOGY_RESEARCH PDFs were downloaded by explicit Box file id (449 readable, 0 byte-identical duplicates, 337.6 MB), staged under the library and inventoried as a separate intake from a private root, so they stay out of rendered views and Junie or Cursor lanes. T1 on gpt-6-luna: 379 select, 69 skip, 1 unreadable PDF (no text). The 69 skips are off-topic strays (pharmacology, hardware design, energy economics); the orchestrator reviewed the skip reasons. The library's non-reference disposition admits only unresolved or internal sources and these are captured docs sources, so the reviewed T1 skip record is the disposition and nothing is deleted. No T2 reads (SPEC non-goal; re-entry is the exploration's legal-ontology-pile-deep-read candidate).

Lane `feat/research-intake-2026-11`

Reverse: Re-inventory the staged PDFs with --input to make the intake public, or import explicit dispositions if the validator later admits captured docs sources

### Restore the library from the pre-intake backup after the hop-scope defect, then re-run hop 0, 2026-11-07

The first hop-0 inventory wrote hop-1 and hop-2 derivations against the four October intake ids (0 before, about 90k each after), which the SPEC forbids as an edit to October accounting. A reflink backup of the library was taken before the intake's first write, and only this goal's Box acquisition and inventory had written since, so the library was restored from that backup rather than pruned edge by edge. Box acquisition, staging and inventory were then re-run on code that derives hops only for the recorded intake. Rejected: deleting the October-keyed edges in place (no tested prune path, and the catalog history would still carry them).

Lane `feat/research-intake-2026-11`

Reverse: The tainted library is kept at ~/.cache/beep/library-tainted-hop0-2026-11-07; swap it back into place to undo the restore

### MAP gated candidates re-evaluated against the intake catalog: both stay gated, one trigger re-pointed, 2026-11-07

epistemic-library-model-promotion (move the finding and evidence model into packages/epistemic/domain once a second consumer exists): no second code consumer of LibraryFinding exists outside packages/tooling/tool/cli, and every epistemic goal the routed findings name (epistemic-claim-lifecycle-gate, provenance-shared-claim-kernel and five siblings) is completed-retained. Stays gated; the trigger is unchanged. legal-ontology-pile-deep-read (T2 reads of the 449-PDF pile): its trigger packets legal-ontology-landscape, lynx-lkg-ontology-grounding and legal-patent-kg-deepening have all graduated, so the trigger as written can never fire. T1 on the pile selected 379 PDFs; their topic ids name legal-ontology-landscape 127 times, legal-patent-kg-deepening 91, the completed patent-document-schema 71 and the active legal-document-intake 66. Stays gated, with the trigger re-pointed: fire when goals/legal-document-intake, or a live successor of the graduated legal ontology explorations, names the pile in its plan. The 379 T1 selections are the ready worklist.

Lane `feat/research-intake-2026-11`

Reverse: Restore the original trigger text in the exploration MAP; nothing was implemented

### mine runs tiers as spawned runners with output schemas, span-checked findings and argv on ModelRun, 2026-11-07

Port of the academia T1/T2/T3 scripts (codex exec with an output schema per job) into research library mine: mine triage (T1, gpt-6-luna), mine read (T2, Junie claude-opus-5-5 while JetBrains credits remain, then claude-opus-5-5), mine synthesize (T3, imports session-authored synthesis). Each job spawns a configured runner, validates the JSON result against a schema, rejects any finding whose span is not verbatim in the bound capture text, and records a LibraryModelRun carrying model, effort, route and the exact launch argv (new additive field, decoding default empty so existing catalogs decode). Private-partition artifacts never route to Junie or Cursor runners. Rejected: keeping the runners as packet scripts (the academia packet lost them) and an MCP-driven runner (not reproducible from argv).

Lane `feat/research-intake-2026-11`

Reverse: Drop the mine command group and the additive ModelRun argv field (decoding default empty); recorded findings stay valid

### Private-partition guard: message ids repo-wide, participant handle on goal-added lines, 2026-11-07

The acceptance check named a git grep on the archive's message ids and participant handle. The 50 message ids must match nothing anywhere in the tree. The one non-operator participant handle is also a public GitHub owner already cited in 9 tracked exploration and goal files that predate this goal, so a whole-tree grep can never pass. The guard therefore checks message ids against the whole tree and the handle against lines this goal adds (origin/main...HEAD plus uncommitted). Identifiers live only in an out-of-repo pattern file and the guard prints counts, never values. First run 2026-11-07: 0 and 0. Rejected: rewriting the pre-existing public references, an unrelated change.

Lane `feat/research-intake-2026-11`

Reverse: Return to a literal whole-tree git grep on the handle after removing the pre-existing public references, or widen the guard's diff base

### Codex is exhausted until about 2026-11-13; the remaining T2 reads run on Opus 5.5 through the local proxy, 2026-11-07

After 463 T2 readings, the signed-in Codex account and then every proxy credential for gpt-6.1-sol reported usage_limit_reached (proxy reset in about 142 hours). Remaining pools: Cursor's API pool shows 0% and refuses private artifacts anyway, and Grok has no mine profile. claude-opus-5-5 is the Claude chain's step 1 and its rate limit had cleared, so the remaining ~724 reads (public and private) run on a new proxy-opus profile. It launches claude -p against CLIProxyAPI with a scrubbed environment, so the batch draws on every admitted Claude login instead of the 12%-left account the CLI is signed in to. The runner pauses on quota errors. Rejected: waiting six days for the Codex reset, and buying credits (operator-only spend).

Lane `feat/research-intake-2026-11`

Reverse: Re-run any partition with --profile codex-sol after the Codex reset; per-artifact records keep completed reads

### Junie ran out of quota mid-T2; the public partition moves to Codex gpt-6.1-sol as well, 2026-11-07

Junie's JetBrains quota returned 477 Out of quota on 2026-11-07 after a handful of reads (the runner recorded 239 failed launches before the batch stopped making progress; the quota signal appeared only in Junie's log file, now detected and treated as a pause). The next pool is claude-opus-5-5 children, which recovered from this morning's rate limit, but 784 Opus reads would draw the scarce Anthropic weekly pool that also runs the orchestrating session, and that pool already tripped a rate limit today. The public partition therefore runs on the chain's step 2, Codex gpt-6.1-sol medium (codex-sol profile), beside the private partition. Every reading records its ModelRun, so pool provenance stays per finding. Rejected: buying JetBrains credits (operator-only spend).

Lane `feat/research-intake-2026-11`

Reverse: Re-run remaining public jobs with --profile claude or junie once quota returns; per-artifact records keep completed reads

### T2 runs Junie on public artifacts and Codex gpt-6.1-sol on private ones; Claude children are rate limited, 2026-11-07

T1 selected 1187 of 1434 November artifacts (241 skip, 6 defer). The pool doctrine puts T2 on Junie claude-opus-5-5 while JetBrains credits remain, then claude-opus-5-5 children. Private artifacts may not go to Junie (enforced by the runner), and two Claude Opus children failed on 2026-11-07 with a confirmed API rate limit, so the private 400 run on the Claude chain's next step, Codex gpt-6.1-sol medium, through a new codex-sol profile. --only-private and --exclude-private keep the two runs disjoint, and the writer lock now serializes their catalog writes. Both routes were qualified by one live read each before the batch (Junie 6 findings, codex-sol 12).

Lane `feat/research-intake-2026-11`

Reverse: Re-run the private partition with --profile claude once the Claude limit resets; records are keyed per artifact so a re-read replaces nothing silently

### verify acceptance counts this intake's sources; the October missing=5 baseline is reported, not repaired, 2026-11-07

Before any November work, research library verify on the untouched library reports source/version coverage missing=5 and 7 integrity lines, all from the 2026-10-06 and 2026-10-14 intakes, with SHACL conforming. A reflink copy mined with one real T1 and one real T2 job produced byte-identical verify output, so mining adds no failures. The SPEC forbids editing the October intakes or their accounting, so this goal's zero-missing and zero-integrity checks apply to sources whose derivation roots are November or legal-ontology intakes, and COVERAGE.md reports the October baseline beside them. Rejected: writing dispositions onto October sources from this goal.

Lane `feat/research-intake-2026-11`

Reverse: Give the five October sources reviewed dispositions in a separate packet and tighten the acceptance to library-wide zero

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
