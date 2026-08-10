# Nightly Research Routine — PLAN

Phase status truth is [`ops/manifest.json`](./ops/manifest.json). Checklists
here are the working decomposition; keep both in sync on phase flips.

## P0 — Docs & Governance (this PR)

- [x] `standards/architecture/DECISIONS.md` 2026-08-08 entry (layout + governance).
- [x] `docs/README.md` amendment (research/ vs explorations/ boundary).
- [x] `AGENTS.md` Docs & Knowledge law line.
- [x] `research/README.md` conventions authority.
- [x] This goal packet (README / SPEC / PLAN / GOAL / manifest).
- [x] `_typos.toml` path exemption for `research/**`.

## P1 — v0 Pipeline

- [ ] Schemas in `Research.schemas.ts`: `NightlyRunOptions`, `NightlyRunSummary`,
      `FindingRecord` (sanitized-at-encode), `RunStatus` LiteralKit
      (`success | partial | timed-out`), ledger record schemas.
- [ ] `beep research nightly run` — prelude (window from stamp, exclusion
      digest, watchlist, repo-replay brief) → blinded search/synthesis
      (claudeg workflow launcher, scrubbed env) → Fable writer call →
      publisher (packet write, ledger append, red-first PR via yeet,
      failure attribution, RUN.json, OTEL export).
- [ ] `beep research nightly install-timer` extending `internal/Timers.ts`
      (boot/login + daily tick, ≥24h stamp guard, weekly consolidation timer
      stub disabled until P2).
- [ ] `beep research nightly digest` — rebuild derived indexes from committed
      truth (never committed).
- [ ] Dedicated clone bootstrap doc/script (`~/YeeBois/projects/beep-effect-nightly`).
- [ ] Grok CLI fallback lane (`grok -p … --output-format streaming-json`)
      behind a flag.
- [ ] First supervised run end-to-end; then first unattended boot-triggered run.

## P2 — v1 Enrichment

- [ ] Repo-replay query generation (merged diffs + open goal frontmatter → query set).
- [ ] `research/ledger/WATCHLIST.md` as schema-fronted data the run proposes
      diffs to (add-with-evidence, retire-after-N-dry-runs).
- [ ] Refutation quota wired into search stage.
- [ ] Demurrage/tombstone reaper + tombstone resurrection rule.
- [ ] Weekly Sunday consolidation run (trends, reaper sweep, weekly digest).
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
