# GOAL: sync the ratified verdicts into the Semantica atlas

Repo root: the current working directory. All paths are repo-relative.

Outcome: the positive `Verdict` + `Beep counterpart` values the passed canary
unblocked are written into the Notion `@beep/semantica` atlas from a
schema-validated `verdicts.json` the repo owns, through the P5 method (render,
diff against a live 33-catalog read, one canary write, apply, SQL read-back),
on exactly the enumerated rows, with zero Notion schema; the IR facts lane
stays gated.

Read these as the contract:

- `goals/semantica-atlas-sync/{README,SPEC,PLAN}.md`
- `goals/semantica-atlas-sync/ops/manifest.json`
- `goals/semantica-atlas-sync/research/SOURCES.md`
- `explorations/semantica-lab/MAP.md` §A (v1.1) and `DECISIONS.md` (Current
  law table: Atlas writes, Atlas backlog, Verdict map; then the 2026-09-03
  ratification grill R3.a–R3.g; the table wins over prose)
- `goals/semantica-canary/history/p5-atlas-sync.md` (the proven method and
  the four rows it declined)

Then `AGENTS.md`, `CLAUDE.md`, `standards/architecture/15-lab-apps.md`, and
the skills `SPEC.md` names.

Scope:

- In: `explorations/semantica-lab/research/atlas/verdicts.json` and its
  `atlas-verdicts/v1` schema; a render/diff script in
  `apps/labs/semantica/scripts/`; `Verdict` and `Beep counterpart` on the
  enumerated atlas rows; this packet's receipts; dated row-specific
  `DECISIONS.md` entries proposed for `already-have` rows.
- Out: every `SPEC.md` non-goal — new Notion rows/properties/schema, family
  vocabulary in the atlas, `already-have` on package existence, a
  `bun run beep` command, Notion ids or machine paths in tracked files; the
  IR extractor and its home while P2 is gated (P2 brings them in once
  semantica 0.6.7+ ships).

Execution:

1. P0: one-catalog Notion read from this session's own connection (a failed
   read stops the lane); read `Verdict` across the 33 catalogs; archive
   per-catalog counts; reconcile against the six P5 parks and the thirteen
   2026-08-24 D10 auto-parks; enumerate every row to touch in
   `verdicts.json` — the live parks, the four P5-declined rows
   (`Oxigraph (embedded)`, embedding-model `OpenAI`, `pattern`, `llm`), and
   only those `already-have` rows with a dated, row-specific entry.
2. P1: schema (`Verdict` as a `LiteralKit`), then the data file, then the
   lab script (decode → render → diff → apply plan, archived before any
   write); one canary write and read-back; apply; SQL read-back must return
   exactly the file's rows and no other non-empty `Verdict`. Receipt as
   `history/p1-verdict-lane.md` without Notion ids. In the same PR set the
   packet `paused` with the resume condition "semantica 0.6.7+ ships,
   recorded in a dated entry" (same-PR state flip), then Yeet to
   `merge-ready: yes`.
3. P2 only when the gate fires and a dated entry decides the extractor's
   home; P3 `/reflect` and state flip.

Non-negotiable:

- The repo is the single writer of decision facts; the atlas is rendered
  from the file, never hand-edited first.
- Every positive verdict carries its counterpart in the same write.
- Positive values only for families whose canary stage passed; family
  vocabulary never reaches the atlas.
- Decode at the Notion boundary; `HashMap`/`HashSet`; `Effect.fn`; no
  reusable export from the lab.

Acceptance: every `SPEC.md` criterion, all `ops/manifest.json`
`verificationCommands` green, no unrelated churn.

Stop on a failed access read; on any write outside the enumerated rows; on a
positive verdict without a counterpart; on an `already-have` without its
dated entry; on the facts lane before its trigger.
