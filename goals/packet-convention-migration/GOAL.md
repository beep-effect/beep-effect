# GOAL: packet convention migration

Repo root is the current `beep-effect` checkout. Do not assume an absolute
path; several checkouts exist. All paths below are repo-relative.

Outcome: prove a staged single-packet fork repair, then migrate every legacy
goal manifest to the canonical v2 convention with explicit reports, honest
genesis events, fleet lint, and zero `beep explore --check` findings.

Read first:

- `goals/packet-convention-migration/{README,SPEC,DESIGN,PLAN}.md`
- `goals/packet-convention-migration/ops/manifest.json`
- `explorations/packet-system-redesign/{MAP,DECISIONS}.md` D17–D26
- `AGENTS.md`, schema-first, effect-first, JSDoc, explore, and Yeet guidance

Scope:

- In: the existing Goals/Explore CLI command trees, focused tests, the packet
  core fork fixture, deterministic goal-manifest/event/trace migration output,
  and this goal plus its parent exploration.
- Out: exploration-manifest migration, generated ATLAS/README regions,
  candidates 2–5, Amendment J implementation, signing, and fabricated history.

Workflow:

1. Keep `PLAN.md` current and preserve unrelated worktree changes.
2. Implement schemas before services. Reuse PacketCore's fold, digest, store,
   and projector; do not create a parallel event format.
3. Land the repair applier proof before the translator/seeder slice.
4. Preview the fleet. Any violation blocks apply; warnings and assumptions are
   explicit. Preserve unknown manifest keys.
5. Apply once, prove a second preview is empty, and run
   `bun run beep explore --check` to zero findings.
6. Publish through Yeet. At P4 use `/reflect`, flip packet state in this PR,
   and re-prove the final head.

Acceptance is exactly `SPEC.md`. Stop instead of improvising if translation
would invent meaning, repair would lose a branch, seeding would overwrite a
stream, or requested proof needs unnamed credentials, cost, or destructive
state.
