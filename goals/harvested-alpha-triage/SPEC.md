# Harvested Alpha Triage Spec

## Objective

Judge the harvest ledger with three separate provider sessions (Opus 5.5 high, Grok 4.7 xhigh, GPT-6.1 Sol medium) into row-keyed verdict JSONL, merge deterministically, and seed a new exploration packet `harvested-alpha-2026-11` at stage `shape` so its MAP graduates the still-open alpha into concrete goals.

## Non-Goals

- No freeform read of packets; every judgment cites a ledger row id.
- No goal packets opened directly from clusters; the seeded exploration's MAP does that.
- No archive mechanics (that is `packet-archive-mechanics`).
- No narrative-only reports.

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

- `packages/tooling/tool/cli/src/commands/Goals/**`: verdict schema and `beep goals harvest merge` (or equivalent) if the merge is tooling, else a packet-local script under `research/`.
- the exploration's `research/harvest/` directory (verdict files, merge output).
- New a new exploration packet `harvested-alpha-2026-11` scaffolded from `_template`.
- `docs/runbooks/agent-pools.md` only if a route recipe is missing.

## Constraints

- Verdict row schema (`S.Class`): `rowId`, `status` (`open` | `landed` | `obsolete` | `duplicate-of <id>`), `cluster`, `leverage` 1–5, `evidence` (one pointer into live source), `model`, `effort`.
- Three separate sessions on the approved routes: Opus 5.5 `high` (Agent tool child, operator ruling), Grok 4.7 `xhigh` (proxy route), GPT-6.1 Sol `medium` (Codex); launch argv retained as effort evidence.
- Deterministic merge: unanimous rows resolve; disagreements are listed for the operator with all three verdicts; output is the cluster list with row ids.
- `landed` requires an evidence pointer into current `main` source; `open` rows keep their ledger provenance.
- The seeded exploration starts at stage `shape` with the merged clusters as `CAPTURE.md` and `RESEARCH.md` inputs and the operator-flagged disagreements as `openQuestions`.

## Acceptance Criteria

- [ ] Three schema-valid verdict JSONL files, one per model, each covering every ledger row.
- [ ] A merge output with agreement counts, a disagreement list, and clusters ranked by leverage, committed beside the ledger.
- [ ] a new exploration packet `harvested-alpha-2026-11` exists at stage `shape`, passes the atlas regeneration and stage check below, and lists the clusters as candidate work.
- [ ] Decision file with the three launch argv lines and the Opus `high` ruling.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/harvested-alpha-triage/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/harvested-alpha-triage/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/harvested-alpha-triage` | Passes |
| Verdict coverage | every ledger `id` appears once per model's verdict file | 3 × ledger row count |
| Seeded packet | `bun run beep explore atlas --write && jq -e '.exploration.stage == "shape"' the harvested-alpha-2026-11 exploration/ops/manifest.json` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add harvested-alpha-triage --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug harvested-alpha-triage`; add a `kind: decision` file there, never edit this block._

### Panel pins: Opus 5.5 high, Grok 4.7 xhigh, GPT-6.1 Sol medium for ledger judging, 2026-11-06

Operator ruling from the 2026-11-06 `/grill-with-docs` session (exploration
`packet-archive-and-alpha-harvest`, DECISIONS.md "panel pins"): the three verdict
sessions run as Opus 5.5 `high` (Agent tool child), Grok 4.7 `xhigh` (proxy route)
and GPT-6.1 Sol `medium` (Codex). The Opus pin is lifted from the doctrine `medium`
to `high` for this judging task only; launch argv is retained as effort evidence
when P1 runs. Reviewer separation holds: no session sees another's verdicts before
the deterministic merge.

Reverse: Drop the Opus child back to the doctrine medium pin by rerunning the Opus verdict session at medium and re-merging; no other artifact depends on the effort

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
