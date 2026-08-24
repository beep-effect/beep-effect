# GOAL: preserve the salvage, then restore the bounded estate

Repo root: the current working directory, the `beep-effect` checkout you are
running in. All paths below are repo-relative. The corpus and its ledgers stay
outside this public repo.

Outcome: close the independent preservation gate for the current T7 salvage
state, then close the bounded mail, recycle, and legacy-Word transformation
gates without changing the live practice-kg v1 front.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/oppold-corpus-salvage-restoration/README.md`
- `goals/oppold-corpus-salvage-restoration/SPEC.md`
- `goals/oppold-corpus-salvage-restoration/PLAN.md`
- `goals/oppold-corpus-salvage-restoration/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: schema-first archive objects and append-only ledgers; a streaming
  copy-while-hashing archive runner with resume-by-hash and independent
  verification; a public source-path libpff `-m all` lane; store/child
  reconciliation; attachment type repair and second-pass extraction; all
  three recycle volumes; distinct-digest legacy-Word conversion with retained
  originals and declared fidelity measures.
- Out: pipeline v2, semantic ingestion v2, enrichment v2, practice-kg bundle
  v2, multi-firm productization, destructive corpus cleanup, and changes to
  the live v1 front.

Workflow:

1. P0 this week. Model archive objects, loss rows, terminal rows, and
   verification records as schemas. Define services next, then implement the
   streaming hasher and archive runner. Do not rerun the current `corpus
   salvage` command as the preservation operation.
2. Copy each source once while feeding a streaming SHA-256, promote atomic
   destinations under `raw/t7-salvage-2026-08-10/`, apply the ratified
   truncate-and-resume-by-hash policy, then independently reparse and verify
   the destination manifest. Archive `oppold-corpus.zip` verbatim as its own
   object and seed the inherited-loss opening balance.
3. P1 proves one metadata-selected non-stub PST occurrence from a recycle
   surface end to end at concurrency one. Exercise corrupt, password, and
   codepage outcomes only with synthetic fixtures. Expand only after zero
   unaccounted children and measured disk/time amplification.
4. P2 restores the full mail estate store by store, reconciles all three
   recycle volumes with the four-class join and directory-tree rules, then
   converts distinct legacy-Word digests. Retain every original.
5. P3 reconciles all ledgers, writes the closeout reflection, publishes the
   final work through Yeet to a mergeable PR, and flips packet state in that
   same PR.

Acceptance:

- [ ] P0 independently proves the current T7 state is preserved under bar v2.
- [ ] P1 has zero unaccounted children and records disk/time amplification.
- [ ] P2 closes the mail, recycle, and DOC family gates with terminal ledgers.
- [ ] P3 leaves no unapproved terminal row and records the closeout evidence.

Stop and report instead of improvising when:

- P0 has an unapproved terminal ledger row.
- P1 has an unaccounted child.
- Capacity or disk/time preflight exceeds the approved ceiling.
- The work requires a gated parent-MAP candidate or destructive original
  mutation.

Never put corpus content or client filenames in the repo or agent evidence.
Use aggregate metadata only.
