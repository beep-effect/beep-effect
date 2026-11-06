# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-06 — archive home

**Question:** Where do the evidence-heavy parts of archived packets
(`research/`, `history/`, `data/`; about 200 MB and 10k files for the 182
completed goals) live once they leave `main`?

**Answer:** A separate public repo, `beep-effect/beep-effect-goals-archive`,
provisioned into the gitignored `.repos/goals-archive` through the existing
`beep refs` manifest (`scripts/references.json`). A tag on `main` marks the
removing commit.

**Rationale:** Git history already preserves every byte; the real need is
addressability (476 inbound links, capability-graph providers). A separate
repo is browsable on GitHub, amendable by PR, and invisible to default agent
sessions. Rejected: archive branch plus tag only (not browsable in-tree, links
pin to one commit, rots against main tooling); a physical `_archive/` directory under `goals/` on `main`
(file count and clone size do not drop); workstation and remote-box copies
(strictly worse than git, which already holds the bytes publicly and in the
private duplicate).

## 2026-11-06 — tombstone contents

**Question:** What stays on `main` for each archived packet?

**Answer:** `ops/manifest.json`, a generated stub `README.md` (closeout
receipt, `provides`, headline findings, archive URL), `history/reflections/`,
and `research/OPPORTUNITIES.md`. Everything else moves.

**Rationale:** The manifest keeps the capability graph and INDEX intact
(active packets `requires` providers declared by completed ones). Reflections
and ledgers are the alpha and total 3.4 MB across all completed goals. Per
packet about 60 files becomes about 5. Rejected: manifest and stub only (the
alpha becomes reachable only through the ledger and archive); a single
a single archive index JSON under `goals/` with no per-packet dirs (breaks the capability
graph unless the index becomes a second provider source).

## 2026-11-06 — harvest order

**Question:** How is the alpha extracted: model panel reading packets, or a
deterministic projection first?

**Answer:** Deterministic harvester first: a `beep goals harvest` command
writes one provenance ledger (JSONL rows with slug, file, line, commit) from
reflection `findings[].instruction` and `todos`, every friction receipt in
the `research/OPPORTUNITIES.md` ledgers (Doing / Evidence / Recovery /
Prevention), unchecked PLAN items, manifest `statusNote` and `stopConditions`, and decision
files. The model panel then dedupes, clusters, and judges still-open versus
landed against live source, working from the ledger.

**Rationale:** 344 reflections already carry schema-validated frontmatter; a
freeform read of 182 packets is expensive, unauditable, anchors each model on
what it happened to open, and cannot be rerun. The harvester is reusable for
every future sweep. Rejected: panel reads packets directly; harvester only
with no panel (the judgment step is the part worth spending model effort on).

## 2026-11-06 — vehicle

**Question:** Which packet carries this work and holds these decisions?

**Answer:** This exploration, graduating into two goals: (A) harvester plus
archive mechanics; (B) harvested-alpha triage that spawns concrete goals.

**Rationale:** The alpha-triage half is the fuzzy part and needs the align and
shape stages. Rejected: one goal packet directly (skips shaping the triage);
two explorations (they share the harvester and an ordering dependency, so two
packets coordinate for no gain).

## 2026-11-06 — sweep scope

**Question:** Which packets are archived in this sweep?

**Answer:** Every terminal packet: goals `completed-retained` and
`superseded`; explorations `graduated` and `killed`. `reference`, `paused`,
`parked`, and `active` stay.

**Rationale:** Removes roughly 400 MB and 20k files. Reference packets exist
to be read as precedent. Rejected: goals first and explorations in a second
wave (the mechanics are the same, so one plan); including the four reference
packets.

## 2026-11-06 — steady state

**Question:** What keeps the pile from regrowing?

**Answer:** Archive at closeout by default. `beep goals archive <slug>` runs
after the adoption PR; a packet that stays `completed-retained` in full needs
a `retentionReason` in its manifest, checked by `goals doctor`.

**Rationale:** 182 of 270 goals landed in `completed-retained` because it is
the only completed status, although the README limits retention to packets
that still serve as evidence, reference design, or launch context. Rejected:
periodic sweep only (the pile regrows between sweeps); age-based archiving
(usefulness as precedent is not a function of age).

## 2026-11-06 — status model

**Question:** How does a tombstoned packet declare that it is archived?

**Answer:** Status is unchanged (`completed-retained` or `superseded`). The
manifest gains an optional `archive` block (`repo`, `path`, `commit`,
`contentHash`, `archivedAt`) and, for packets kept in full, a
`retentionReason`. INDEX gains an Archived column.

**Rationale:** `goals/README.md` already rules that removal is an operation,
not a status; the 5-state `GoalStatus` domain is enumerated by doctor,
set-status, INDEX, lifecycle and the completion gate. Rejected: a sixth
`archived` status (conflates lifecycle outcome with storage location and
touches every consumer); removing archived manifests from INDEX and the
capability graph (needs a second provider source).

## 2026-11-06 — panel pins

**Question:** Which models and efforts judge the harvest ledger?

**Answer:** As the operator named them: Opus 5.5 `high` (Agent tool child),
Grok 4.7 `xhigh` (proxy route), GPT-6.1 Sol `medium` (Codex). This entry is
the operator ruling that lifts the Opus child pin from `medium` to `high` for
this judging task only; goal B records it as a decision file with argv
evidence.

**Rationale:** The ledger is a few thousand rows, so effort cost is modest and
the task is judgment-heavy. Rejected: unchanged doctrine pins (operator chose
otherwise); the formal review.panel (Astra/Fable/Grok xhigh is for
independent review, not triage).

## 2026-11-06 — sweep PR shape

**Question:** How are the deletions landed on `main`?

**Answer:** Sequential batches of about 50 packets, one PR open at a time.
Each PR is pure `beep goals archive` output for its batch plus the link
rewrites for that batch, opened only after the batch content is pushed to the
archive repo and hash-verified.

**Rationale:** 256 packets and about 20k deletions; GitHub stops rendering
diffs past 3,000 files and review bots degrade; each deletion must follow a
verified archive push. Rejected: two waves (goals, then explorations) and a
single PR, both unreviewable with one revert point for 400 MB.

## 2026-11-06 — archive repo creation and layout

**Question:** Who creates `beep-effect/beep-effect-goals-archive`, and how is
it laid out?

**Answer:** The agent creates the public repo when goal A reaches its first
archive PR, not during the exploration. Paths mirror `main`
(`goals/<slug>/...`, `explorations/<slug>/...`); a generated
`ARCHIVE-INDEX.md`; a README stating the repo is a projection written only by
`beep goals archive`. Inbound links on `main` are rewritten to `blob/main`
URLs so later amendments stay reachable.

**Rationale:** The operator's login is an org admin, creation is free, and
the mirror layout makes link rewriting a prefix swap. Rejected: operator
creates it by hand (blocking step for no gain); private repo (content is
already public in `main`'s history and private breaks links for Cursor and
Junie lanes).

## 2026-11-06 — harvest scope and ledger home

**Question:** Which packets does the harvester read, and where does the
ledger live?

**Answer:** Every goal and exploration packet of every status, with terminal
packets flagged. The JSONL ledger and the panel verdicts live on `main` under
this packet's `research/harvest/`; goal B inherits a copy.

**Rationale:** Active and paused packets also carry stale todos and friction
receipts; reflections stay on `main` after archiving so the harvester keeps
working post-sweep. Rejected: terminal packets only (misses active-packet
alpha, needs a second mode later); ledger in the archive repo (the panel and
goal B would depend on a provisioned `.repos` checkout for their own input).

## 2026-11-06 — panel output shape

**Question:** What does each panel model produce so the three can be merged?

**Answer:** Schema-validated verdict JSONL keyed by ledger row id. Per row:
`status` (`open` | `landed` | `obsolete` | `duplicate-of <id>`), cluster
label, leverage 1–5, one evidence pointer into live source. A deterministic
merge resolves agreement, flags disagreements for the operator, and emits the
cluster list that becomes goal candidates.

**Rationale:** Review doctrine requires separate sessions, source-bound
evidence and carried findings; narrative reports cannot be diffed or merged
and lose row-level provenance. Rejected: narrative report per model; a single
model doing the whole triage.

## 2026-11-06 — sequencing

**Question:** Must the harvest ledger exist before the first archive PR?

**Answer:** Yes. Goal A's first phase ships `beep goals harvest` and commits
`research/harvest/ledger.jsonl` at a named `main` SHA; archive batch 1 opens
only after that commit merges.

**Rationale:** The harvest is the safety net the operator asked for, so it
precedes any deletion; rows cite `main` paths, not archive paths. Rejected:
parallel (harvester would read moved packets from a provisioned checkout);
harvest after the sweep (loses the safety-net ordering).

## 2026-11-06 — goal B output

**Question:** Where do the merged panel clusters land to become goals?

**Answer:** Goal B scaffolds a new exploration,
a new exploration packet `harvested-alpha-2026-11`, at stage `shape`, with the merged
verdict as capture and research. Its MAP graduates into concrete goals. This
packet's MAP covers only goals A and B.

**Rationale:** Matches the operator's original intent (one new exploration
that graduates into goals) and keeps goal A from waiting on the panel.
Rejected: folding clusters into this packet's MAP; opening goal packets
directly from clusters (skips align and decompose, which the clusters need).

## 2026-11-06 — exemptions

**Question:** Does any completed packet stay in full with a `retentionReason`
in this sweep?

**Answer:** No exemptions. Every inbound link into a moved file is rewritten
to the archive `blob/main` URL, `goals/README.md`'s history link included.
Retention is earned only in future closeouts, when the owner writes the
reason.

**Rationale:** Zero judgment calls in the sweep. Rejected: exempting packets
linked from `standards/` or `AGENTS.md` (rewards doctrine docs for linking
deep into evidence); hand-picking from 184 INDEX rows.

## 2026-11-06 — command ownership

**Question:** Which command family owns archive and harvest?

**Answer:** The Goals family: `beep goals archive` and `beep goals harvest`
with `--kind goals|explorations`, built over the shared packet-core modules.
Explore stays read-only plus graduate.

**Rationale:** `goals index` already spans the portfolio; one implementation
of push, hash, tombstone and link rewrite. Rejected: parallel commands per
family (duplicated mechanics); a new `beep packets` family for two commands.

## 2026-11-06 — appetite

**Question:** What is the appetite for the two goals?

**Answer:** Goal A: two weeks of lane time (one tooling PR, then five or six
sequential batch PRs behind their review windows). Goal B: one week after the
ledger lands.

**Rationale:** Batches already merged stay valid if A overruns; nothing is
half-archived. Rejected: one week total (needs parallel batch PRs, forbidden
by the one-at-a-time decision and the three-open-PR cap); no appetite (loses
the signal that the mechanics are too heavy).

## 2026-11-06 — exploration tombstone

**Question:** What stays on `main` for an archived exploration packet?

**Answer:** `ops/manifest.json`, a generated stub `README.md`, `DECISIONS.md`
and `BRIEF.md`. `CAPTURE.md`, `RESEARCH.md`, `MAP.md`, `research/` and
`reviews/` move to the archive repo.

**Rationale:** Decisions (with rejected options) and the shaped pitch are the
reusable prose; capture and research are the bulk and the least reusable.
Parallel to the goal tombstone. Rejected: manifest and stub only; keeping all
top-level markdown.

## 2026-11-06 — graduation

**Question:** Shared understanding reached; graduate?

**Answer:** Yes. Graduate `packet-archive-mechanics` and
`harvested-alpha-triage` from MAP.md and publish one draft PR for the packet
work. No tooling code, archive repo or deletions in that PR.

**Rationale:** Seventeen decisions settled across three rounds with no open
frontier. Rejected: holding the PR after a local graduation; further rounds.
