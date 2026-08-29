# GOAL: eradicate boolean creep from the beep-effect corpus

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every confirmed boolean-creep instance in `data/inventory.jsonl` is
refactored to its ratified target shape (LiteralKit literal, tagged union, or
Option-of-literal) with the guards it made necessary deleted, landed via yeet
in risk-tiered PRs.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/boolean-creep/README.md`
- `goals/boolean-creep/SPEC.md`
- `goals/boolean-creep/DECISIONS.md` (binding decisions)
- `goals/boolean-creep/PLAN.md`
- `goals/boolean-creep/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the
schema-first-development skill. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/**/src` + `apps/**/src` instances listed `confirmed` in
  `data/inventory.jsonl`; their tests; packet artifacts (`data/`, `designs/`,
  `PLAN.md`, `README.md`).
- Out: test files as scan sources, generated surfaces, `apps/labs`,
  `scratchpad/`, `.repos/`, function flag parameters, driver wire shapes
  (D2 census only), disqualified records.

Workflow:

1. Check `PLAN.md` for the current phase and `data/inventory.jsonl` for
   instance statuses (validate with
   `bun goals/boolean-creep/ops/validate-inventory.ts`).
2. Respect the two hard gates: no design before Benjamin ratifies the
   inventory (GATE 1); no apply before Benjamin ratifies the designs (GATE 2).
3. Designs live at `designs/<inventory-id>.md` and must include
   guard-deletion accounting and encoded-side impact.
4. Apply by landing tier (SPEC "Landing"); advance each instance's inventory
   `status` as it lands; `bun run beep yeet` repair/verify per batch.
5. Preserve unrelated user/worktree changes; never merge PRs — Benjamin
   merges.
6. At close, write a reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Inventory validates and every status change is evidence-backed.
- [ ] Gates were held; no unrelated refactors or formatting churn.

Verification:

```sh
bun goals/boolean-creep/ops/validate-inventory.ts
test "$(wc -m < goals/boolean-creep/GOAL.md)" -le 4000
jq . goals/boolean-creep/ops/manifest.json
git diff --check -- goals/boolean-creep
```

Stop and report before changing public API, persisted/wire encoded schemas,
data migration, dependencies, lockfiles, or generated files unless the
instance's ratified design explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
