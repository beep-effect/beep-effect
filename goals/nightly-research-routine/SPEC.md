# Nightly Research Routine — SPEC

Normative contract for the unattended nightly research routine. Decisions
here were closed in the 2026-08-08 grill session; the repo-layout decision is
recorded in `standards/architecture/DECISIONS.md` (2026-08-08). Output-surface
laws live in [`research/README.md`](../../research/README.md) and are not
restated — they bind this SPEC.

## 1. Product

Every ~24h an unattended run researches the beep-effect frontier — X/Twitter
(native Grok x_search), GitHub, arXiv, and the open web — across three
mandated topic axes (IP-law tech + legal-AI competitors; Effect-TS/schema-first
/local-first engineering; AI coding agents, MCP/skills, ontologies,
neural-symbolic) with an explicit bias to intersections and the new/rising
edge, and lands one dated packet under `research/<YYYY-MM-DD>/` as a
mergeable PR a human can click-merge in the morning.

## 2. Pipeline architecture (process-separated stages)

1. **Prelude (deterministic, CLI):** compute research window
   (`last-successful-run stamp → now`, explicit dates), build the derived
   exclusion digest + watchlist + repo-replay brief (merged diffs since last
   run, open goal packet frontmatter). No model involved.
2. **Search/synthesis (blinded):** a headless claudeg (`grok-4.5`) session on
   CLIProxyAPI running a dynamic Workflow — `grok-4.5` children for native
   X search (server-side `x_search`, injected by the proxy), plus web/GitHub/
   arXiv sweeps; Sol/Luna children for synthesis and adversarial
   cross-provider verify (Grok finds, Sol refutes; survivors land). Children
   receive input files (digest, watchlist, brief) in a scratch dir and
   return structured, sanitized findings records. **No repo checkout at this
   stage.** Includes the refutation quota (attempt to refute N standing
   claims from the digest each run).
3. **Writer (single Fable seat):** exactly one Anthropic-direct headless call
   composes `REPORT.md` (delta-first), `SUGGESTED_ACTIONS.md` (each item
   carries an executable capture command), and `PROMPT.md` from structured
   records only — never raw scraped bytes.
4. **Publisher (deterministic, CLI):** writes the packet + ledger updates in
   the dedicated clone, opens the PR red-first (failing
   `nightly-not-finished` status cleared as the final step), drives
   /yeet to mergeable, attributes any failure (introduced vs inherited) and
   stops with a note rather than repair-thrashing. Emits RUN.json and OTEL
   metrics.

## 3. Ownership & CLI surface

- Command family: `beep research nightly …` sub-namespace of the existing
  Research command (`packages/tooling/tool/cli/src/commands/Research/`):
  `run`, `digest` (rebuild derived indexes), `install-timer` (extends the
  Timers.ts systemd pattern), `status`.
- v1 schemas co-located in `Research.schemas.ts` + internals under
  `internal/Nightly*.ts`, schema → Context.Service → impl order.
- v2 claim tuples promote to `@beep/epistemic-domain` (reusing
  `EdgeRelation`, `EvidenceSpan`, `Contradiction`, `LogicalEdgeIdentity`)
  only after the backfill go/no-go (§7).

## 4. Scheduler

systemd **user** units installed by `beep research nightly install-timer`:
trigger at boot/login plus `OnUnitActiveSec` daily tick; the wrapper proceeds
only when the last-successful-run stamp is ≥24h old; `Persistent=true`.
Machine stays off overnight — the run rides the morning boot. In v1, the
single Sunday daily run also performs weekly consolidation; there is no second
timer, branch, or packet competing for that date.

## 5. Model & quota routing

- Orchestrator + search children: xAI pool (claudeg / grok-4.5; grok CLI
  shell-out `grok -p … --output-format streaming-json --no-auto-update` as
  fallback X-search primitive).
- Verify/synthesis children: OpenAI pool (`gpt-5.6-sol(medium)` /
  `gpt-5.6-luna`).
- Fable: exactly one instance, writer seat only.
- Headless proxy invocations use a scrubbed env
  (`env -i … ANTHROPIC_BASE_URL=http://127.0.0.1:8317`); parent-env leakage
  causes 401s.
- Pre-committed cost envelope per run; exhaustion is a normal terminal state
  landing a valid `status: partial` packet with a resume cursor in RUN.json.

## 6. Novelty (v1)

Append-only naive ledger: per-packet `claims.jsonl` (truth) + derived
exclusion digest injected into every search child's prompt; self-reject gate
(>40% collision → re-search under a widened frame); demurrage — suggested
actions unactioned for N runs tombstone into `research/ledger/tombstones`
and join the exclusion digest; a tombstoned idea returns only with evidence
that post-dates its death.

## 7. v2 experiments (both gated)

- **Claim-tuple thymus:** gated on the backfill experiment — decode findings
  from ≥5 existing packets/reports into tuples; if known duplicates fail to
  collide or real findings fail to decode, the vocabulary is not ready and
  the gate stays closed.
- **Trend-futures contracts:** capped at ~20 open positions; mechanical-first
  settlement; a ~90% hit rate is a defect signal (target 60–70%); cold-start
  by retro-dating contracts mined from existing research artifacts.

## 8. Telemetry

RUN.json is truth for the run; the publisher exports
`beep.research.nightly.*` metrics (sources seen, claims emitted, collision
rate, per-pool usage, wall time, status) to the dankserver OTLP endpoint.
Novelty-rate-over-time is the routine's health metric.

## 9. Environment & checkout

Dedicated full clone named `beep-effect-nightly` (machine-local, outside this checkout) owned
exclusively by the routine. Before resetting, the publisher checks for an open
PR from an earlier `research/<date>` branch; while one exists, the next run is
blocked without advancing the last-successful-run stamp. Otherwise it fetches
and resets to `origin/main`, runs `bun install` when the lockfile moved, and
creates branch `research/<date>`. Never a worktree of the working clone (shared
turbo cache). CLIProxyAPI `xai.inject-x-search: true` is a standing
prerequisite.

## 10. Scanner gates

Sanitize-at-write (token-shaped/high-entropy redaction) in the record
schema's encode path; `research/**` exempted in `_typos.toml` only; gitleaks
fully authoritative, fail-closed backstop.

## 11. Out of scope / forbidden

Auto-merge; writing to `explorations/INBOX.md` or `goals/`; raw scraped
bytes reaching the writer stage; attention-throttling feedback loops
(explicitly rejected 2026-08-08 — merge is archival, not engagement);
Anthropic-pool fan-out; touching the OIP corpus or private internal docs.
