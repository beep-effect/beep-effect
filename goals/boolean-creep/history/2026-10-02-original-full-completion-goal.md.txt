# GOAL: eradicate boolean creep from the beep-effect corpus

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every current-corpus E1-E4 instance in `data/inventory.jsonl` is
refactored to its reviewed target shape with the guards it made necessary
deleted, every implementation and closeout PR is merged, two final exact-main
rounds add no qualified record, and the packet is `completed-retained` on
merged `main`.

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

- In: the current `packages/**/src` + `apps/**/src` corpus, every qualified
  inventory record, their tests, and packet artifacts.
- Out: test files as scan sources, generated surfaces, `apps/labs`,
  `scratchpad/`, `.repos/`, function flag parameters, driver wire shapes
  (D2 census only), disqualified records.

Workflow:

1. Check `PLAN.md` for the current phase and `data/inventory.jsonl` for
   instance statuses (validate with
   `bun goals/boolean-creep/ops/validate-inventory.ts`).
2. GATE 1 passed. Under Benjamin's 2026-09-03 bounded mandate, GATE 2 passes
   only after the refreshed inventory, corrected designs, and replacement
   exact-source zero-finding review receipt are complete; no further user
   decision is required for that transition.
3. Designs live at `designs/<inventory-id>.md` and must include
   guard-deletion accounting and encoded-side impact.
4. Merge live `origin/main` forward before each review/publish. Apply serially
   by landing tier; set an instance `applied` in its implementation PR; use
   Yeet repair, full verify, publish, and monitor to exact-head merge-ready.
5. Preserve unrelated work. The 2026-09-28 decision authorizes agent merge
   through the ChatGPT Chrome extension; use one successor PR to merged #1328 for all remaining work.
6. Include implementation, final candidate rounds, reflection and lifecycle
   change in that PR. After merge, run two exact-main dry rounds and verify
   completion. Follow the 2026-09-28 decision for consolidated landing.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Inventory validates and every status change is evidence-backed.
- [ ] The delegated GATE 2 evidence exists; no unrelated refactors or
  formatting churn.
- [ ] Every required PR is merged and the completed packet is verified from
  the resulting `main` tree.

Verification:

```sh
bun goals/boolean-creep/ops/validate-inventory.ts
bun goals/boolean-creep/ops/validate-designs.ts
test "$(wc -m < goals/boolean-creep/GOAL.md)" -le 4000
jq . goals/boolean-creep/ops/manifest.json
git diff --check -- goals/boolean-creep
```

Atomic decoded TypeScript migrations and reviewed Tier 2 compatibility codecs
are authorized. Stop before changing encoded property names/values/defaults,
accepted legitimate payloads, dependencies, lockfiles, or generated files
unless reviewed design requires it or delegated judgment under the 2026-09-28
amendment authorizes the necessary change with evidence.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.

PR #1388 merged before completion. Benjamin approved one successor PR on
`codex/boolean-creep-r54-remainder-2026-10-01`. Preserve R54's pending review
and all remaining gates; verify the exact-source rebind before application.
