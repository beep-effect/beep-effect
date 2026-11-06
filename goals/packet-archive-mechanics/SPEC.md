# Packet Archive Mechanics Spec

## Objective

Ship `beep goals harvest` and `beep goals archive` (Goals family, `--kind goals|explorations`), the manifest `archive` block and `retentionReason`, doctor and INDEX support, the public archive repo, then sweep every terminal packet off `main` in sequential hash-verified batches of about 50; the harvest ledger is committed before batch 1.

## Non-Goals

- No new `GoalStatus` value; the 5-state domain stays.
- No archive branch as the preservation mechanism (a tag marks the last batch only); no workstation or remote-box copies.
- No archiving of `reference`, `paused`, `parked` or `active` packets; no exemptions in this sweep.
- No judging of the harvest ledger (that is `harvested-alpha-triage`).
- No parallel batch PRs.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Goals/**` (new `Archive.*`, `Harvest.*`, schema additions in `Goals.schemas.ts`, doctor and index changes).
- Exploration manifest schema under `commands/Explore/**` for the `archive` block.
- `scripts/references.json` (`.repos/goals-archive` member).
- `goals/README.md`, `explorations/README.md` (archive operation, `retentionReason`, closeout step); `.claude/skills/closeout/**` (archive step).
- Every tombstoned packet under `goals/` and `explorations/`, and every file holding an inbound link to a moved file.
- the exploration's `research/harvest/ledger.jsonl`.
- The new public repo `beep-effect/beep-effect-goals-archive`.

## Constraints

- Schema first: `ArchiveRecord` (`repo`, `path`, `commit`, `contentHash`, `archivedAt`), `retentionReason`, and the harvest row (`id`, `slug`, `kind`, `status`, `source`, `file`, `line`, `commit`, `text`) are `S.Class` models before any command code.
- Tombstone keeps, for goals: `ops/manifest.json`, generated stub `README.md` (closeout receipt, `provides`, headline findings, archive URL), `history/reflections/`, `research/OPPORTUNITIES.md`; for explorations: `ops/manifest.json`, stub `README.md`, `DECISIONS.md`, `BRIEF.md`.
- Archive-first invariant: a packet is deleted from `main` only after its mirrored tree is pushed and its git tree hash verified; the hash is recorded in the `archive` block.
- Link rewriting rides the shared knowledge link parser (`knowledgeLinkDestinations`), never a regex; targets are `blob/main` URLs in the archive repo.
- `goals doctor`, `goals catalog`, `goals index --check`, `goals manifest --check` and the knowledge link lints stay green after every batch; archived packets are not drift.
- Harvest reads every goal and exploration of every status (terminal flagged) and every tracked `OPPORTUNITIES.md` in the repo, including nested and non-packet ledgers; the ledger is committed at a named `main` SHA before batch 1.
- Batches of about 50 packets, one PR open at a time, goals before explorations.
- Public CLI runtime smoke (`PacketEventStore` provided) on one packet before the first batch.

## Acceptance Criteria

- [ ] `beep goals harvest --kind goals|explorations` writes a schema-valid provenance ledger covering reflections, friction receipts, unchecked PLAN items, `statusNote`/`stopConditions` and decision files; committed under the exploration's `research/harvest/`.
- [ ] `beep goals archive --kind goals|explorations <slug>...|--batch <n>` pushes, verifies, tombstones, writes the `archive` block and rewrites inbound links, and refuses a full-retention packet lacking `retentionReason`.
- [ ] `goals doctor` flags a `completed-retained` packet that has neither an `archive` block nor a `retentionReason`.
- [ ] INDEX shows an Archived column; `goals catalog` providers from archived packets are unchanged.
- [ ] Every `completed-retained` and `superseded` goal and every `graduated` and `killed` exploration on `main` is tombstoned; `main` carries the tag `archive/packets-2026-11`; `.repos/goals-archive` provisions via `beep refs`.
- [ ] `goals/README.md` and `explorations/README.md` document the archive operation, `retentionReason`, and the closeout step; the closeout skill runs `beep goals archive` after the adoption PR.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/packet-archive-mechanics/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/packet-archive-mechanics/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/packet-archive-mechanics` | Passes |
| Packet graph | `bun run beep goals doctor && bun run beep goals catalog` | No new findings; provider set unchanged |
| Projections | `bun run beep goals manifest --check && bun run beep goals index --check` | Passes |
| Package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Archive integrity | per batch: recorded `contentHash` equals `git rev-parse <commit>:<path>` in the archive repo | Equal for every packet |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add packet-archive-mechanics --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug packet-archive-mechanics`; add a `kind: decision` file there, never edit this block._

### Adopt the exploration's 19 locked decisions as this packet's design contract, 2026-11-06

The exploration `packet-archive-and-alpha-harvest` settled nineteen decisions on
2026-11-06 (archive home, tombstone contents, harvest-before-delete ordering,
status model, batch shape, exemptions, command ownership, appetite). This packet
executes them as written; `research/P0-DESIGN.md` is their schema and service
projection. Reopening any of them is a dated superseding entry in the
exploration's DECISIONS.md first, never an in-place edit here.

Reverse: Reopen the specific decision in explorations/packet-archive-and-alpha-harvest/DECISIONS.md with a dated superseding entry and amend research/P0-DESIGN.md accordingly

### Archive is recorded in the manifest archive block, not as a packet event, 2026-11-06

`beep goals archive --write` records the operation only in `ops/manifest.json`
(`archive: ArchiveRecord`). Adding an `archived` packet event is more than a new
literal: it needs an event body, a fold branch, a SetStatus body switch case, a
transition-writer request type and a decision on derived state and trace. That is
a change to the packet event vocabulary and gets its own reviewed PR; the 65
packets with event streams are untouched by the sweep. Doctor, INDEX and the
capability graph read the manifest, so nothing observable depends on the event.

Reverse: Add an archived event type to the packet event vocabulary (body, fold branch, SetStatus switch, transition writer) in its own reviewed PR and have TombstoneWriter append it; existing archive blocks stay valid

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
