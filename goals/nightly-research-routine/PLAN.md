# Nightly Research Routine — PLAN

Phase status truth is [`ops/manifest.json`](./ops/manifest.json). Checklists
here are the working decomposition; keep both in sync on phase flips.

**Amendment 2026-09-03:** only P0 is complete. The nightly CLI, hosted routine,
handoff receiver, local verifier, publisher, and timers are planned, not
shipped. P1 must either implement the promised CLI surface or remove it from
the SPEC before this goal can complete.

## P0 — Docs & Governance (complete)

- [x] `standards/architecture/DECISIONS.md` 2026-08-08 entry (layout + governance).
- [x] `docs/README.md` amendment (research/ vs explorations/ boundary).
- [x] `AGENTS.md` Docs & Knowledge law line.
- [x] `research/README.md` conventions authority.
- [x] This goal packet (README / SPEC / PLAN / GOAL / manifest).
- [x] `_typos.toml` path exemption for `research/**`.

## P1 — Hybrid v0 Pipeline

- [ ] Add schema-first run, source-capability, handoff-envelope, disposition,
      and receipt models to the existing Research command family. Preserve
      `partial` as a terminal status.
- [ ] Implement the planned nightly run, digest, timer-install, and status
      operations, or remove those promises from the SPEC before completion.
- [ ] Configure the hosted Grok Bot search/writer front half only after the X
      and GitHub plugin preflights pass; keep provider OAuth as its sole
      credential surface.
- [ ] Implement the public-safe GitHub-issue envelope with numbered JSONL
      parts, counts, SHA-256 digests, a completion marker, and fail-closed local
      verification. Keep private records in a content-addressed local store.
- [ ] Add blinded Sol/Luna verification through the local proxy. Require it for
      `success`, and emit explicit capability partials otherwise.
- [ ] Add the deterministic local publisher: dedicated clone, `gh` preflight
      under least-privileged 1Password injection, packet and ledger writes,
      red-first PR through Yeet, failure attribution, `RUN.json`, and OTEL.
- [ ] Reuse the `@beep/skill-contract` evidence, digest, ladder, and recovery
      receipt models for success, no-op, partial, and failure.
- [ ] Add the local user timer with boot catch-up under the same idempotency key;
      settle trigger coordinates and late-hosted-run arbitration at shape time.
- [ ] Prove no-change, real-change, incomplete-handoff, and duplicate-delivery
      fixtures in a supervised run before the first unattended run.

## P2 — v1 Enrichment

- [ ] Repo-replay query generation (merged diffs + open goal frontmatter → query set).
- [ ] Append-only single-writer suggested-action dispositions outside immutable
      packets, with derived indexes rebuilt from packet truth plus the ledger.
- [ ] `research/ledger/WATCHLIST.md` as schema-fronted data the run proposes
      diffs to (add-with-evidence, retire-after-N-dry-runs).
- [ ] Refutation quota wired into search stage.
- [ ] Demurrage/tombstone reaper + tombstone resurrection rule.
- [ ] Extend the single Sunday daily run with consolidation (trends, reaper
      sweep, weekly digest); do not create a second packet or branch.
- [ ] Novelty-rate Grafana panel on dankserver.

## P3 — v2 Experiments (gated)

- [ ] Backfill go/no-go: decode ≥5 packets' findings into claim tuples;
      measure decode-failure and duplicate-collision rates. Gate decision
      recorded here.
- [ ] (go) Promote tuples to `@beep/epistemic-domain`; thymus stage +
      corroboration edges + contradiction lane.
- [ ] Trend-futures contracts (cap ~20, mechanical-first settlement,
      retro-dated cold start, hit-rate telemetry with 90% defect alarm).

## P4 — Close

- [ ] Reflection via `/reflect nightly-research-routine`.
- [ ] Lifecycle flip + INDEX regen in the final PR (same-PR packet-state law).
