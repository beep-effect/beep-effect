# Fleet Coordination For Parallel Agent Checkouts

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

~13 clones of this monorepo run on one workstation, each hosting an independent
agent session. Two failure modes recur:

- **Mode A** — several agents independently fix the same broken `main`, burning
  duplicate tokens and colliding at merge time.
- **Mode B** — one agent lands a repo-wide policy change (lint rule, gate,
  schema requiredness) and every other agent's in-flight PR rots.

The operator's framing was a "message board" agents could post to. The research
says build a **mirror**, not a board: derive early, deliver ambiently, enforce
late.

Cross-machine coordination is **out of scope** by operator ruling — all
checkouts share one filesystem, one kernel, one user.

## Next Open Question

**Rung 2 only, and not blocking — but the gate moved.** Claude Code 2.1.224
shipped cross-session messaging, so delivery no longer waits on speed-loop PR-I
landing `AgentBrief.fleet`. The question is now its shape: push reaches only
sessions that bound a messaging socket, and whether a message is delivered,
held, or dropped is decided by the **receiver's** permission mode, which the
sender cannot see. So does rung 2 become *push to the reachable, pull for
everyone*, and does it ride into
[`goals/fleet-mirror`](../../goals/fleet-mirror/README.md) or open its own
packet? See [`T6`](./research/T6-cross-session-messaging.md).

**Rung 1 shipped 2026-08-08** as `beep worktree fleet` (#621) — derivation only.
This exploration stays `active` because rung 2 remains unbuilt, and now carries
a bounded **rung 1.5**: adopt the on-disk session registry as the liveness probe
(T6 §4), which converts `unknown → live` on a 99.7%-readable measurement where
rung 1's `/proc` probe reaches 13.2%.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state.
2. [`BRIEF.md`](./BRIEF.md) — the shaped pitch: problem, appetite, sketch, rabbit holes, no-gos.
3. [`MAP.md`](./MAP.md) — the goal packet, sequencing edges, verified capability check, first vertical slice.
4. [`RESEARCH.md`](./RESEARCH.md) — the distilled landscape and what died.
5. [`research/SYNTHESIS.md`](./research/SYNTHESIS.md) — full cross-track synthesis, five options, recommended sequence.
6. Track deliverables only as needed: [`T1`](./research/T1-prior-art.md) prior art · [`T2`](./research/T2-theory.md) blackboard/lease theory · [`T3`](./research/T3-delivery-vector.md) delivery vectors · [`T4`](./research/T4-merge-queue.md) merge queue · [`T5`](./research/T5-derivation.md) derivation surface · [`T6`](./research/T6-cross-session-messaging.md) cross-session messaging (2026-08-09 addendum; kills T3 §4.4).

## Cross-Session Coordination

This packet was produced in `beep-effect5` while the speed-loop campaign ran in
`beep-effect3-pra`. Ownership transfers and schema reservations were negotiated
across the two sessions and ratified as speed-loop grill decisions 34–38:

- [`research/HANDOFF-to-beep-effect3.md`](./research/HANDOFF-to-beep-effect3.md) — what this packet took off the speed-loop plate (#22 design half, #16) and the shapes it reserved (#49, #52, #45).
- [`research/AMENDMENTS-from-beep-effect3.md`](./research/AMENDMENTS-from-beep-effect3.md) — their rulings back, including the decision-37 principle governing this design: *the claim record describes what is claimed; provenance, liveness, and expiry are knowledge about the claim and belong on the wrapper.*

The negotiation had to be relayed by hand through the operator, because the
capability this packet is about does not exist yet.

**Corrected 2026-08-09** — it exists: Claude Code 2.1.224 shipped cross-session
messaging. The sentence is kept because its lesson survives its premise. The
2026-08-08 runner-migration notice *still* came by hand, and
[`T6`](./research/T6-cross-session-messaging.md) §3.1 measures why: that same
`beep-effect3` session is alive, `busy`, and on the current version, yet records
`messagingSocketPath: null` — reachable by the operator, not by a peer. Having
the capability is not the same as the capability covering the fleet.

## Trail

- 2026-08-09: **the delivery gate moved** — Claude Code 2.1.224 shipped
  cross-session messaging (`ListAgents` / `SendMessage`, same-machine over a
  per-session Unix socket, *"never through Anthropic servers"*), which **kills
  [`T3`](./research/T3-delivery-vector.md) §4.4** — "is there a non-hook external
  push? Honestly: no" — and unblocks rung 2 from PR-I.
  [`T6`](./research/T6-cross-session-messaging.md) re-measures the delta and
  finds the sharper result underneath it: **rung 1 built its liveness probe on
  the wrong primitive.** T3 §4.5 had already found the on-disk session registry;
  rung 1 used `/proc` cwd attribution instead and hit the wall that made
  `dormant` unreachable. Measured across the full PID space this host reads
  `/proc/<pid>/stat` for **1430 of 1435** processes and `/proc/<pid>/cwd` for
  **189** — and the registry *supplies* the `cwd`, leaving only a PID-reuse
  check (`procStart` == `stat` field 22, verified exact on all four live
  sessions) against the 99.7%-readable file. That is rung 1.5: a pure
  `unknown → live` conversion with the measured-or-`unknown` law untouched.
  The track's specimen is the reason the mirror survives its own transport:
  `beep-effect3-e3` — the CI/infra session that hand-relayed the runner-migration
  notice the day before — is alive, `busy`, interactive, on 2.1.226, and binds
  **no messaging socket**, so the registry sees it and `ListAgents` does not.
  Deriving liveness from peer reachability would have marked the fleet's busiest
  checkout not-live: a falsely-negative field, which is exactly what the packet's
  binding law forbids. Also applied, from §7: `isolatePeerMachines: true` in user
  settings, because cross-machine replies route through Anthropic servers and
  `~/.claude/rules/oip-confidentiality.md` governs that path.
- 2026-08-06: **rung 1 graduated** into
  [`goals/fleet-mirror`](../../goals/fleet-mirror/README.md) (D6) — derivation
  only; rung 2 stays here until PR-I lands `AgentBrief.fleet`. Same day, PR-E
  landed as #569 and closed the #551 regression with the guard and the regression
  test A6 promised — **which was itself a second Mode B specimen**: `main` moved
  under this clone's in-flight packet, rotting one factual claim and staling a
  capability pin, with no textual conflict and no signal, learned only because
  the operator mentioned the merge in passing.
- 2026-08-05: operator approved `BRIEF.md` → `decompose`. [`MAP.md`](./MAP.md)
  names one goal packet (`fleet-mirror`) and verifies every cited capability
  against `main` at `680a862a8e` rather than against the research. That check
  produced the stage's real finding: `AgentBrief`, `OwnershipClaim`, and `beep
  agent report list` have **zero source references on main**, while `worktree
  doctor`, `merge-tree`, and `/proc` are all present — so the work splits into a
  **derivation rung that is unblocked today** and a **delivery rung gated on
  PR-I**, and the BRIEF's "starts when PR-I merges" is stronger than the evidence
  requires. Awaiting the operator's ruling on that split before graduation.
- 2026-08-05: PR #562 review closed — seven findings, **all seven valid**. Three
  were design defects, now amended: `merge-tree` needs the target *object* and
  `ls-remote` only supplies its SHA (signal 2 was unavailable exactly when main
  moves); the PR→checkout join is **one-to-many**, since Git's checkout
  exclusivity does not span independent clones; and `SessionStart` never implied
  a clean tree, so D4's directive now comes from `git status`. Those last two
  amendments (with D5's) generalize to a binding law: **every field is either
  measured or `unknown`** — nothing inferred from a proxy, nothing defaulting to
  the safe-sounding value. Also fixed: the hook now serializes with `jq`, and two
  refuted claims (the 4-of-5 intra-wave count, the MCP Agent Mail *"No broadcast
  by design"* attribution) are marked refuted in place rather than silently
  dropped.
- 2026-08-05: `BRIEF.md` shaped inside the D1–D5 boundaries; appetite is one
  small goal packet, 1–2 focused days, sequenced behind PR-I. Publishing the
  packet produced a **live Mode B specimen**: #551 broke every `yeet publish`
  without `--monitor` a day earlier from a parallel clone, with no textual
  conflict and no signal to anyone until it was tripped
  ([`CAPTURE.md`](./CAPTURE.md); handed off as item 3 of
  [`HANDOFF-2`](./research/HANDOFF-2-pre-push-and-guard.md)). The `law-pulse.sh`
  fix was confirmed firing in a live session. Speed-loop closed **all three**
  HANDOFF-2 items the same day (A6–A10 in
  [`AMENDMENTS`](./research/AMENDMENTS-from-beep-effect3.md)); the load-bearing
  one is that PR-I now builds on `additionalContext` rather than plain stdout.
  `block/buzz` recorded as considered-and-rejected prior art, then **corrected
  the same day** after the operator ran it: it is harness-agnostic and drives
  Claude Code over ACP, so it owns the *session*, not the *agent*, and the honest
  option is "stop running human-started sessions in your own clones" rather than
  "replace Claude Code". The decisive reason is now the operator's: **a channel
  is not correct use of a channel** — Buzz's own postmortem records its agents
  going too loud, too quiet, and telling the wrong story inside it, two of three
  still open. Its fact-vs-ignorance distinction amended D5 to a **third liveness
  state**, where unreadable renders as silence and never as dormant.
- 2026-08-04: grill #1 closed all nine questions → `shape`. Five locked (D1–D5),
  four disposed. The load-bearing move was a **correction to the synthesis**:
  only one of five live collisions is intra-wave, not four, so `WaveManifest`'s
  shared bucket covers 1 of 4 generated-file collisions and the mirror is doing
  real work rather than duplicating #49. Mandate: repo-wide regeneration rule +
  read-only mirror; **no claim registry, no enforcement**. Q0/Q7 handed to
  speed-loop PR-G rather than fixed here — the fix edits `Yeet/internal/Handler.ts`,
  which PR-E is actively editing and where a sibling worktree already predicts
  conflicts. Applying the packet's own thesis to itself.
- 2026-08-04: opened at `align`. Five research tracks plus adversarial
  verification completed (11 agents, ~1.39M tokens); synthesis landed with nine
  open questions. Two P0 findings verified independently and one fixed in the
  same PR (`law-pulse.sh` had never reached the model — `PostToolUse` plain
  stdout is debug-log-only; a silent no-op since 2026-07-05). The second P0
  (`lefthook.yml` has no `pre-push` stage, so `beep yeet` is a convention rather
  than an engineering control) turned out to be three-quarters built already and
  became Q0 rather than a fix.
