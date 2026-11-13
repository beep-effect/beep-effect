# Model-First Slices

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `shape`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

If `@alchemy.run/domain` and Effect Cluster had existed when the repo began, how would the
architecture standard have been designed, for a codebase where agents write, call and operate the
system alongside people?

## Next Open Question

The D15 rework is under way in `scratchpad/model-first-slices/`, in the worktree
`beep-effect-worktrees/model-first-slices` on branch `explore/model-first-slices`; its `FINDINGS.md` records what each
decision looked like against the real library. Next: verify phase 1 (`bun run check`, `bun run
test`, findings), then phases 2 to 4, then the Postgres swarm host (needs `docker swarm init`).
[`BRIEF.md`](./BRIEF.md) has not been confirmed in words by the operator. The authority context's
name is still open (D18).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's brief and ground rules.
3. [`RESEARCH.md`](./RESEARCH.md) - the proposal, the prototype, the outside reviews.
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log, D1 to D36.
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch, awaiting the operator's confirmation.

## Trail

- 2026-11-13: phase 3 verified (13 packages type-check, 98 tests pass); notes in `research/10`.
  D32 to D36 settled. Committed locally. Phase 4 (web package, proof inventory, deployment
  descriptors as data) launched.
- 2026-11-13: phase 2 verified (13 packages type-check, 68 tests pass); notes in `research/09`.
  D29 to D31 settled. Work committed locally on `explore/model-first-slices`, not pushed. Phase 3
  (a second product context, an integration fact, projection rebuild, stored-format compatibility)
  launched.
- 2026-11-13: another session stashed the shared checkout (untracked files included) and switched
  it to `main` while phase 2 was running. The packet and the prototype were restored from that
  stash, byte for byte, into a dedicated worktree on branch `explore/model-first-slices`; the stash
  was left untouched. Phase 2 resumed there. Still uncommitted.
- 2026-11-13: phase 1 of the rework verified (ten packages type-check, 38 tests pass); findings in
  `research/08`. Its questions settled as D24 to D28. Phase 2 (runs context, AgentRun, approval
  command, re-admission at each hop) launched.
- 2026-11-13: operator said to start the D15 rework. Phase 1 (file grammar, contract package,
  authority context, invocation relay) launched on the standalone prototype; phases 2 to 4 follow
  (agent run and approval; second context, integration fact, rebuild and compatibility; web and
  proof inventory). The fourth draft is filed as text in `research/07`.
- 2026-11-13: grill rounds two to four settled D6 to D23; Grok deep research filed
  (`research/05`), which added D21 to D23 and contradicted none of the rest. Packet moved to shape: `BRIEF.md` written and the
  fourth draft of the artifact published. Stopped at the shape review. Nothing committed.
- 2026-11-13: packet opened from a design artifact, a standalone prototype
  (`scratchpad/model-first-slices/`), an ADHD pass and two outside reviews. Grill round one
  settled D1 to D5.
