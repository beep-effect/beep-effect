# Fleet Mirror Plan

## Status

Status: `pending`

Appetite: **1–2 focused days.** Budget-busting looks like the derivation scan not
producing a correct fleet snapshot inside day one. The cut is signal 3 — ship
signals 1 and 2, which need zero calibration, and let the policy surface land
later. **Never** cut the measured-or-`unknown` law or the read-only posture to
make the budget.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm the `Worktree` schema family and **measure** the policy surface against recent first-parent `main` commits. | The surface is a measured list with per-path frequencies recorded in `research/`; `FleetCheckout`'s home is decided. |
| P1 Implement | pending | Schema → `Context.Service` → subcommand, in that order. | Acceptance criteria in `SPEC.md` are met. |
| P2 Verify | pending | The #551-shape proof test plus the two `unknown`-path tests; full repo proof. | The proof test fails before signal 3 and passes after; `beep yeet verify` green. |
| P3 Close | pending | PR to mergeable via yeet, review response, closeout reflection. | Packet status and evidence updated; a closeout reflection exists. |

## P1 Implementation Order

Design order is law: **schema → `Context.Service` contract → implementation.**

1. **`FleetCheckout` schema** — one row per checkout: path, branch, head SHA,
   dirty count (`status --porcelain -uall`), liveness as a three-member
   `LiteralKit` domain, conflict prediction, policy-path movement. Every derived
   field must be expressible as `unknown`. Plus a snapshot wrapper carrying scan
   coverage, so a partial scan is legible as partial.
2. **The derivation `Context.Service` contract** — enumerate → classify liveness
   → materialize epoch target → predict → evaluate policy movement. Contract
   before implementation.
3. **Implementation**, one signal at a time, each with its test:
   - Signal 1: live dirty/diff overlap across checkouts (Mode A). No calibration.
   - Signal 2: `merge-tree` vs ground-truth `main` (stale checkouts). No
     calibration. **Requires the scanner ODB first** — `ls-remote` gives a SHA,
     not the object.
   - Signal 3: `main` moved onto a **measured** policy path (Mode B). This is the
     only Mode B detector; signals 1 and 2 are structurally blind to it.
4. **`beep worktree fleet`** renders it read-only.

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**,
   the **implementation**, and the **goal/prompt**. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Flip the exploration packet's manifest if this closes it out — the exploration
   stays `active` while rung 2 remains unbuilt.

## Execution Notes

- Preserve unrelated worktree changes. Other agents edit sibling checkouts
  constantly; never `git add -A`.
- Keep `SPEC.md` normative and update it only when the contract changes.
- **The scan is read-only.** It writes nothing into any checkout other than its
  own scanner ODB cache. A derived view that mutates the fleet it observes is a
  different and much worse thing.
- Do not let the mirror become a gate. The moment a derived view starts blocking,
  it inherits every calibration failure the research already killed.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/fleet-mirror/GOAL.md)" -le 4000
jq . goals/fleet-mirror/ops/manifest.json
rg -n "fleet-mirror|GOAL.md|agentLaunchers|packetAnchorDocument" goals/fleet-mirror
git diff --check -- goals/fleet-mirror
```
