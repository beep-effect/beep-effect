# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets.
-->

## Problem

`main` carries 270 goal packets and 100 exploration packets: 29k tracked
files, about 580 MB on disk. 182 goals are `completed-retained` (207 MB,
10.9k files) and 73 explorations are graduated. They bloat `goals/` and
`explorations/`, widen every agent's search scope, and are the only completed
landing state, so the pile regrows after each manual consolidation. Yet the
alpha is real: 344 schema-validated reflections, 107 friction ledgers, 90
unchecked PLAN items, decision files and closeout notes. The last
consolidation (`goals/packet-convention-migration`, 2026-08) fixed manifests,
not footprint. Deleting packets into git history loses addressability: 476
links and the capability graph point into completed packets.

## Appetite

Goal A (archive mechanics and sweep): two weeks of lane time. Goal B
(harvest judgment): one week after the ledger lands. The sweep is sequential
and idempotent, so an overrun leaves merged batches valid and nothing
half-archived.

## Solution Sketch

Two commands in the Goals family over the shared packet core, then a sweep.

```
beep goals harvest --kind goals|explorations
  reads every packet (all statuses; terminal flagged)
  rows: reflection findings[].instruction + todos, friction receipts
        (every OPPORTUNITIES.md section: Doing/Evidence/Recovery/Prevention),
        unchecked PLAN items, manifest statusNote/stopConditions, decisions/
  writes research/harvest/ledger.jsonl   {id, slug, kind, status, source,
        file, line, commit, text}
beep goals archive --kind goals|explorations <slug>... | --batch <n>
  1. push packet dirs to beep-effect/beep-effect-goals-archive (mirrored
     paths), record commit + contentHash
  2. verify the pushed tree hashes against the local one
  3. tombstone on main: keep ops/manifest.json, generated stub README,
     history/reflections/, research/OPPORTUNITIES.md (goals) /
     DECISIONS.md + BRIEF.md (explorations); delete the rest
  4. write manifest archive block {repo, path, commit, contentHash, archivedAt}
  5. rewrite inbound links in docs/, standards/, .claude/, packages/, apps/
     and other packets to blob/main archive URLs
  6. refuse to tombstone when a packet keeps the status without an archive
     block and lacks retentionReason (goals doctor enforces the same)
```

Flow: tooling PR (schema block, both commands, doctor check, INDEX Archived
column, goals/README and explorations/README doctrine) → ledger commit at a
named main SHA → archive repo created → batch PRs of about 50 packets, one
open at a time, each hash-verified before deletion → tag
`archive/packets-2026-11` on the last batch → `beep refs` member for
`.repos/goals-archive`.

Goal B: three separate panel sessions (Opus 5.5 high, Grok 4.7 xhigh, Sol
medium; operator ruling in DECISIONS.md) each emit verdict JSONL keyed by
ledger row id (`status`, `cluster`, `leverage`, `evidence`); a deterministic
merge resolves agreement, flags disagreements, and seeds
a new exploration packet `harvested-alpha-2026-11` at stage `shape`.

Steady state: `beep goals archive <slug>` becomes the closeout step after the
adoption PR; retention in full needs `retentionReason`.

## Rabbit Holes

- Link rewriting across 476 inbound links plus intra-packet links: must ride
  the shared knowledge link parser (`knowledgeLinkDestinations`), not a regex.
- Packets whose `research/` carries `researchReports` projections: the
  projection must regenerate to empty after the move (`goals manifest`).
- Capability graph: `provides` stays on the tombstone manifest; `goals doctor`
  must not treat missing `GOAL.md`/`SPEC.md` as drift for archived packets.
- Hash verification across a push: compare git tree hashes of the mirrored
  paths, not file-by-file reads.
- The 2026-08 lesson: exercise both commands through the public CLI runtime
  (PacketEventStore provided) on one packet before the batch run.
- Explorations use `exploration-manifest/v1`; the archive block needs a
  schema home there too.
- Friction ledgers are not only at `research/OPPORTUNITIES.md`: at least one
  sits under `history/lab-archive/` and one outside packets
  (`infra/r2-cache/research/OPPORTUNITIES.md`). The harvester globs every
  tracked `OPPORTUNITIES.md` in the repo; about 2,156 receipt sections at
  capture.

Scope is computed from manifest status at sweep time (`completed-retained`,
`superseded`, `graduated`, `killed`), never from the capture census, so packets
completed after 2026-11-06 are swept automatically.

## No-Gos

- No new status; `GoalStatus` stays five values.
- No archive branch as the preservation mechanism; the tag is a marker only.
- No workstation or remote-box copies.
- No archiving of `reference`, `paused`, `parked` or `active` packets.
- No exemptions in this sweep.
- No freeform model read of packets; the panel works from the ledger.
- No parallel batch PRs.
