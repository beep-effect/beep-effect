# GOAL: land the packet-core first vertical slice

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths below are repo-relative.

Outcome: the Goals CLI contains a single colocated packet-core that writes
and folds one versioned CAS event stream, with a guarded transition
preview/write, a read-only explore check, and a projection that reports
derived stages, a visible fork, and a stale `sourceTip` — self-hosted on this
goal's own stream in advisory mode.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/packet-control-plane-core/README.md`
- `goals/packet-control-plane-core/SPEC.md`
- `goals/packet-control-plane-core/PLAN.md`
- `goals/packet-control-plane-core/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md`
names. Repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Goals/` extensions, a colocated
  PacketCore internal module and a minimal read-only Explore command family
  (files inside the existing CLI package — no new workspace package), focused
  CLI tests.
- Out: design/approval gate, fleet projection migration, generated
  ATLAS/README regions, evidence receipts, flow metrics, any UI, any
  `beep packets` vocabulary.

Non-negotiable constraints:

1. Schema first, then `Context.Service`, then implementation. Effect v4
   validated against `.repos/effect`, never training-data priors.
2. Git Markdown packets + the event chain are the sole system of record;
   projections are read-only and derived.
3. Versioned events, upcasters, golden replay, explicit fork repair. No
   merge-driver-dependent JSONL.
4. The D5 significant-symbol ledger in `SPEC.md` bounds the design surface;
   amend only through the parent MAP's amendment path.
5. Reuse the Yeet publish-time index-guard pattern for the guarded writer.

Workflow:

1. Start at `PLAN.md` P1. Make the smallest change satisfying `SPEC.md`.
2. Preserve unrelated worktree changes; never `git add -A`.
3. Prove with the three fixtures: golden linear stream, deliberate fork,
   stale projection.
4. P2: self-host on this goal's own stream in advisory mode.
5. At P4 Close, write a reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance boxes all check.
- [ ] `bun run beep yeet verify` is green.
- [ ] Shipped as a PR driven to mergeable via `/yeet`.

Stop and report instead of improvising when:

- The fold cannot express a real packet history without loss.
- The slice starts needing candidate-2/3/4 machinery to pass its own proof.
- Verification needs unnamed credentials, cost, or destructive effects.
- The same blocker repeats after reasonable investigation.
