# Semantica Atlas Sync Spec

## Objective

Run the D5 verdict lane: write the positive `Verdict` and `Beep counterpart`
values the passed canary unblocked into the Notion `@beep/semantica` atlas,
from a schema-validated verdicts file the repo owns, through exactly the
method the canary's P5 closeout proved — render, diff against a live
33-catalog read, one canary write, apply, SQL read-back — on exactly the rows
the file enumerates and with zero Notion schema. The IR-driven facts lane
stays a gated P2 until semantica 0.6.7+ ships, the firing recorded in a dated
`DECISIONS.md` entry.

Scope is defined by reference, not restated:

- **The split, the scope and the homes** —
  [`MAP.md` §A](../../explorations/semantica-lab/MAP.md#a-semantica-atlas-sync--split-d5-into-a-verdict-lane-and-a-facts-lane)
  (v1.1, ratified 2026-09-03 with amendments applied inline).
- **The ratified sub-decisions** —
  [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) "2026-09-03
  (ratification grill)": R3.a–R3.g; the Current law table's "Atlas writes",
  "Atlas backlog" rows and the Verdict map win over any log entry.
- **The proven method and the rows it declined** —
  [`goals/semantica-canary/history/p5-atlas-sync.md`](../semantica-canary/history/p5-atlas-sync.md)
  §Method and §"Not written, and why".
- **The verdict domain** — D3 (`adopt | adapt | already-have | park | drop`)
  and the Verdict map in the Current law table.

Provenance: graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet A). The O3 atlas-edit need fired on 2026-09-02 when
P5 declined four rows for lack of positive vocabulary; the O3 version trigger
is unverified (the local `danklocal` checkout is 0.6.6) and gates P2 only.

## Non-Goals

Every item of
[`BRIEF.md` §No-Gos](../../explorations/semantica-lab/BRIEF.md#no-gos) holds
as listed in
[`goals/semantica-canary/SPEC.md` §Non-Goals](../semantica-canary/SPEC.md#non-goals).
This lane adds:

- No new Notion rows, properties, views or databases; "zero schema" means
  zero Notion schema (R3.e). Selected winners with no catalog row are not
  created.
- No IR extraction, and no extractor recovery, while the facts lane is gated
  (P0–P1): once semantica 0.6.7+ ships and the firing is recorded, P2 brings
  the extractor and one IR run into scope. Module analyses, template exemplars
  and row-fill stay async codex batches off the critical path in every phase
  (O3, M4).
- No decision about the Python extractor's lawful home before the facts lane
  fires; P2 opens with that decision as a dated `DECISIONS.md` entry (R3.g).
- No family vocabulary in the atlas (`pick-one`, `bundle`,
  `park-pending-canary`), and no positive value for a family whose canary
  stage has not passed (B1).
- No `already-have` on package existence alone (R3.d, D7).
- No `bun run beep` command for the render/diff step: the script's home is
  the lab's `scripts/` beside the `generate-*.ts` files (R3.e).
- No Notion page identifiers, machine paths or session ids in committed data
  (review-loop law, 2026-08-24).

## Source Hierarchy

1. User decisions recorded in the source exploration:
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) Current law
   table (Atlas writes, Atlas backlog, Verdict map), then the 2026-09-03
   ratification grill (R3.a–R3.g).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   yeet, reflect).
3. `standards/ARCHITECTURE.md` with
   [`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md)
   (the script lives in a lab and exports nothing).
4. The exploration contracts in force:
   [`MAP.md`](../../explorations/semantica-lab/MAP.md) v1.1 §A;
   [`goals/semantica-canary/history/p5-atlas-sync.md`](../semantica-canary/history/p5-atlas-sync.md).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. Where this SPEC and
the exploration's Current law table disagree, the table wins until a dated
DECISIONS entry amends it.

## Target Surfaces

- `explorations/semantica-lab/research/atlas/verdicts.json` — the NET-NEW
  `atlas-verdicts/v1` data file (catalog, row title, `Verdict` from the D3
  `LiteralKit`, `Beep counterpart` text, evidence = the dated `DECISIONS.md`
  entry plus the sheet section), and its schema beside it or in the lab.
- `apps/labs/semantica/scripts/` — a small TypeScript render/diff script
  beside `generate-*.ts`: reads the file, renders the intended atlas state,
  diffs it against a Notion read across the 33 catalogs, and prints the apply
  plan. Writes go through the Notion connection of the operating session, one
  canary row first.
- The Notion `@beep/semantica` atlas — `Verdict` and `Beep counterpart`
  values on the enumerated rows only.
- `goals/semantica-atlas-sync/` — proposal, inventory, canary receipt,
  read-back, the closeout reflection.
- `explorations/semantica-lab/DECISIONS.md` — a dated row-specific entry for
  every `already-have` row before it is written (R3.d).
- No other package changes.

## Constraints

Each line cites the sub-decision or law it inherits.

1. **The repo is the single writer of decision facts** (A9); the atlas is
   rendered from `verdicts.json`, never edited by hand first.
2. **Exact rows, listed first.** `verdicts.json` enumerates every row the lane
   will touch before the lane is called bounded; the park baseline comes from
   a live read across the 33 catalogs, not from either dated observation (six
   P5 parks; thirteen 2026-08-24 D10 auto-parks) (R3.b).
3. **Scope ceiling.** Positive rows are at most the four P5 declined
   (`Oxigraph (embedded)`, embedding-model `OpenAI`, `pattern`, `llm`) plus
   `already-have` rows that each have a dated, row-specific `DECISIONS.md`
   entry naming the shipped `@beep/*` counterpart (R3.b, R3.d).
4. **Counterpart rides with the verdict.** Every positive `Verdict` carries
   its `Beep counterpart` in the same write (R3.c).
5. **The P5 method, exactly:** proposal → inventory (live read) → one canary
   write → read-back → apply → SQL read-back across the 33 catalogs; the
   read-back must return exactly the file's rows and no other non-empty
   `Verdict` (P5 §Method).
6. **Access is re-checked before the canary write.** Notion access was not
   live-verified on 2026-09-03; a one-catalog read precedes any write, and a
   failed read stops the lane (Close paragraph, 2026-09-03).
7. **Homes.** Script: `apps/labs/semantica/scripts/`; data:
   `explorations/semantica-lab/research/atlas/`; schema: `atlas-verdicts/v1`
   with `Verdict` a `@beep/schema` `LiteralKit` (R3.e).
8. **Verdict map.** Atlas rows take only `adopt | adapt | already-have | park
   | drop`; `adopt` = wrap as-is, `adapt` = wrap with changes; positive
   values only after the matching canary stage passed (B1, R3.f).
9. **Facts lane gate.** P2 starts only when semantica 0.6.7+ ships, the firing recorded
   in a dated `DECISIONS.md` entry; the extractor survives in git history at
   `fd560ca8e5` and its home is decided then, defaulting to a pinned
   out-of-repo clone under the cache root (R3.g).
10. **Public-repo hygiene.** No Notion ids, home paths or session ids in
    `verdicts.json`, receipts or prose; rollback is each row's Notion page
    history.
11. **Cross-cutting laws for the script:** `LiteralKit` for the verdict
    domain; decode at the Notion boundary; `HashMap`/`HashSet`, never native;
    `Effect.fn` for generators; no reusable export from the lab.

## Decision Log

Binding decisions live in
[`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md).
The rows below are the ones this lane executes against, one line each.

| Id | Holds for this lane |
| --- | --- |
| D2 | Notion owns component/module facts; the repo owns decisions and research. |
| D3 | Wheat/chaff verdicts are columns with a closed domain, never prose. |
| D5 | Atlas accuracy is a sync problem; render/diff, never a one-time audit. |
| D7 | Quality over incumbency: a shipped package is never a verdict by itself. |
| A9 | The repo is the single writer of decision facts. |
| B1 | Positive atlas values only after the matching canary stage passed. |
| O3, M4 | Atlas backlog is async codex work; the re-entry trigger is 0.6.7+ or an atlas-edit need. |
| Atlas writes (2026-09-02) | Six `park` rows written; positive row values unblocked and assigned to this packet. |
| R3.a | D5 split: verdict lane now, facts lane gated. |
| R3.b | Exact rows enumerated first; live 33-catalog baseline. |
| R3.c | `Beep counterpart` in the same write as every positive `Verdict`. |
| R3.d | `already-have` needs a dated, row-specific `DECISIONS.md` entry. |
| R3.e | Script in the lab's `scripts/`; data in the packet's `research/atlas/`; zero Notion schema. |
| R3.f | Verdict map cell amended: positive values written by this packet. |
| R3.g | Facts lane queued; extractor home deferred to it; verdict lane first. |

## Acceptance Criteria

- [ ] **P0** — a one-catalog Notion read succeeds from the operating session;
      the live read across the 33 catalogs is recorded under `history/` with
      per-catalog counts of non-empty `Verdict` values; every unexplained
      non-empty value is listed with a disposition before P1 writes.
- [ ] **Schema and data** — `atlas-verdicts/v1` decodes `verdicts.json`;
      every record carries catalog, row title, `Verdict`, `Beep counterpart`
      (required when the verdict is positive), and evidence (a dated
      `DECISIONS.md` entry plus a sheet section); every `already-have` record
      cites a dated, row-specific entry.
- [ ] **Render/diff** — the lab script renders the intended state and diffs it
      against the live read; the diff touches only rows the file enumerates;
      the apply plan is archived under `history/` before any write.
- [ ] **Canary write** — one row written and read back before the rest.
- [ ] **Apply and read-back** — the SQL read-back across the 33 catalogs
      returns exactly the file's rows and no other non-empty `Verdict`; the
      receipt (rows, before/after, evidence) is archived as
      `history/p1-verdict-lane.md` with no Notion ids.
- [ ] **Facts lane** — P2 remains `pending` with its gate stated in `PLAN.md`
      until the trigger fires; when it fires, the extractor's home is decided
      in a dated `DECISIONS.md` entry before any IR run.
- [ ] The verdict-lane PR is driven to mergeable with the packet set `paused`
      in that same PR while P2 is gated (same-PR state flip); the packet
      reaches `completed-retained` at P3 either after P2 has run (facts rows
      synced and read back) or after a dated `DECISIONS.md` entry retires the
      facts lane.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/semantica-atlas-sync/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantica-atlas-sync/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantica-atlas-sync\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/semantica-atlas-sync` | Required surfaces present |
| Whitespace | `git diff --check -- goals/semantica-atlas-sync explorations/semantica-lab` | Passes |
| Portfolio index | `bun run beep goals index --check` | Generated index current |
| Goal contracts | `bun run beep goals doctor` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Verdicts file | the lab script's decode step over `research/atlas/verdicts.json` | Decodes under `atlas-verdicts/v1`; every positive row has a counterpart and evidence |
| Diff bound | the lab script's diff against the live read | Only enumerated rows differ |
| Read-back | SQL read across the 33 catalogs after apply | Exactly the file's rows; no other non-empty `Verdict` |
| Hygiene | `rg -n "notion.so\|/home/" goals/semantica-atlas-sync explorations/semantica-lab/research/atlas` (the second path exists once P1 creates it) | No matches |
| Hosted completion | `bun run beep yeet monitor` after publication | `merge-ready: yes`; zero unresolved threads |

## Stop Conditions

- Notion access is not live-verified: re-check with a one-catalog read before
  the canary write; a failed read stops the lane before any write.
- A write to any row not enumerated in `verdicts.json`; any new Notion row,
  property or schema; a positive `Verdict` without its `Beep counterpart` in
  the same write.
- An `already-have` record without a dated, row-specific `DECISIONS.md`
  entry naming its shipped `@beep/*` counterpart.
- Family vocabulary reaching the atlas, or a positive value for a family whose
  canary stage has not passed.
- The facts lane starting before its trigger, or the extractor's home decided
  outside that lane.
- Notion page identifiers, machine paths, or session ids in committed data.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named here (the Notion connection is the operating
  session's own; no new integration is created).
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
