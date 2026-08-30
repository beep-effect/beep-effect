# GOAL: packet convention migration (retained)

Repo root is the current `beep-effect` checkout. Do not assume an absolute
path; several checkouts exist. All paths below are repo-relative.

This packet is closed evidence, not an active migration launcher. PR #855
shipped the fork-repair applier, v2 translator, genesis seeder, and fleet lint.
D27 authorized one later recovery PR because #855 merged before its promised
same-PR reflection and lifecycle flip and without a strict final-head Yeet
verdict.

Read:

- `README.md`, `SPEC.md`, `PLAN.md`, and `ops/manifest.json`
- `history/fleet-migration-report.md` and `history/reflections/`
- `research/OPPORTUNITIES.md`
- `explorations/packet-system-redesign/DECISIONS.md` D17–D27

Do not resume, amend, or reapply the merged #855 branch. For regression work,
run the public preview and fleet checks read-only:

1. `bun run beep goals set-status --migrate` must plan zero edits.
2. `bun run beep goals migrate-conventions --preview` must report zero
   translations, seeds, issues, assumptions, and fleet findings.
3. `bun run beep explore --check` must report `findings=0`.
4. `bun run beep goals doctor` must report zero blockers and advisories.

Any new finding is drift to repair in its owning packet or Goals command, not
authorization to recreate legacy manifests or fabricate event history.
Candidates 2–5 remain gated work in the parent exploration; they are outside
this retained goal.
