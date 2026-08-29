# /goal — Nightly Research Routine

Mission: unattended ~daily research runs that land delta-first, sanitized,
novelty-gated intel packets under top-level `research/<YYYY-MM-DD>/` as
mergeable PRs. Machine proposes; the human admits and merges.

Read first (in order):

1. `goals/nightly-research-routine/SPEC.md` — normative contract.
2. `research/README.md` — output-surface laws (binding).
3. `goals/nightly-research-routine/PLAN.md` — phase checklists; status truth
   in `ops/manifest.json`.

Current phase: check `ops/manifest.json.phases` — first pending phase is the
active one. Work only that phase's PLAN.md checklist.

Hard laws (never weaken for convenience):

- Sanitize-at-write: token-shaped/high-entropy strings redacted in the
  FindingRecord encode path; scraped text only as fenced quotes in
  SOURCES.md. gitleaks stays fail-closed; only typos is path-exempt.
- Blinding by process separation: search/synthesis stages get NO repo
  checkout — input files in scratch, structured records out. Only the
  publisher touches the clone (new packet dir + `research/ledger/` only).
- Writer stage (single Fable call) receives structured records, never raw
  scraped bytes.
- Ledger is single-writer (the routine); packets are immutable after merge.
- PR-only from the dedicated `beep-effect-nightly` clone (machine-local);
  red-first PR (`nightly-not-finished` status cleared last); failure
  attribution (introduced vs inherited) then stop-with-note — no repair
  thrashing. Never auto-merge.
- Never write to `explorations/INBOX.md` or `goals/` from research output.
- Quota routing: grok-4.5 orchestrator/search (xAI pool), Sol/Luna verify
  (OpenAI pool), exactly ONE Fable call (writer seat). Scrubbed env for
  headless proxy calls (`env -i … ANTHROPIC_BASE_URL=http://127.0.0.1:8317`).

Proven primitives (2026-08-08, see packet README): grok CLI headless XSearch
(`grok -p … --output-format streaming-json --no-auto-update`; `--tools`
allowlist silently kills XSearch); CLIProxyAPI `xai.inject-x-search: true`
gives claudeg sessions and `grok-4.5` Workflow children native X search.

Design order: schema → Context.Service → impl. v1 schemas live in
`Research.schemas.ts`; `beep research nightly` subcommands beside the
existing family internals; `install-timer` extends `internal/Timers.ts`.

Gates: the claim-tuple thymus (P3) opens only if the backfill go/no-go
passes; trend-futures capped at ~20 open contracts, 90% hit rate = defect.

Completion gate: every phase ships via /yeet
(`bun run beep yeet repair → verify → publish --pr → monitor`) to
`merge-ready: yes`. Same-PR packet-state flips on close. Record frictions in
RUN.json (runtime) or the packet ledger (build time) as they happen.
