# research

Machine-generated research intelligence from the nightly research routine.
Distinct from [`explorations/`](../explorations/README.md) (the human fuzzy
front end) and from the private out-of-repo knowledge vault managed by the
`beep research` vault subcommands. Decision record:
`standards/architecture/DECISIONS.md` (2026-08-08). Build packet:
[`goals/nightly-research-routine`](../goals/nightly-research-routine/README.md).

## Layout

| Path | Purpose |
| --- | --- |
| `research/<YYYY-MM-DD>/` | One immutable packet per run (ISO dates: lexicographic order is chronological). |
| `research/<date>/REPORT.md` | Delta-first report — leads with what changed since the last run (new / moved / contradicted / settled); topical narrative is the appendix. |
| `research/<date>/SOURCES.md` | Quarantined evidence: short, fenced, quoted, sanitized excerpts with canonical links (x.com posts, GitHub repos, arXiv, web). |
| `research/<date>/SUGGESTED_ACTIONS.md` | Proposed actions, each carrying an executable capture command. Proposals only — see Laws. |
| `research/<date>/PROMPT.md` | Ready-to-fire kickoff prompt(s) for actioning items immediately. |
| `research/<date>/claims.jsonl` | Schema-validated structured findings — the packet's truth. |
| `research/<date>/RUN.json` | Run status (`success` / `partial` / `timed-out`), research window, usage per quota pool, novelty metrics, `frictions[]`. |
| `research/ledger/` | Cross-run state written ONLY by the routine (single writer): tombstones, watchlist, last-successful-run stamp. |

## Laws

- **Packets are immutable after merge.** Corrections land as later packets,
  never as edits to shipped ones.
- **Truth vs derived:** per-packet `claims.jsonl` plus `research/ledger/` are
  the source of truth; every index/digest (exclusion digest, DuckDB catalog)
  is derived at run start, rebuildable, and never committed.
- **Sanitize at write:** scraped content is redacted (token-shaped /
  high-entropy strings) before touching disk and appears only as fenced,
  quoted evidence in `SOURCES.md`. gitleaks stays fully authoritative over
  `research/**`; only the typos gate is path-exempted here.
- **Blinding:** research runs are blinded to `research/**` except the digest
  handed to them — search/synthesis stages receive no repo checkout. The
  writer composes from structured records without a checkout; only the
  publisher touches this tree, scoped to the new packet dir plus
  `research/ledger/`.
- **Machine proposes, human admits:** nothing here auto-appends to
  `explorations/INBOX.md` or `goals/`. Actions graduate when a human fires a
  capture command from `SUGGESTED_ACTIONS.md`.
- **No explorations ceremony:** no `ops/manifest.json`, no ATLAS sync, no
  reflections requirement. `RUN.json.frictions[]` is the friction-receipt
  surface; the weekly consolidation rolls recurring frictions up for a human.
- **Delivery is PR-only** from the routine's dedicated clone; a human merges.

## Vault pipeline credentials

`bun run beep research install-timers` installs the systemd user units
`beep-research-daily` (nightly `research daily --commit`) and
`beep-research-repo-card` (weekly). Both declare
`EnvironmentFile=-$HOME/.config/beep-research/env`; the unit runs without it,
but every step that needs a secret then skips or fails. The file is plain
`KEY=value` lines read by systemd itself, so `op://` references do not resolve
there: keep it mode `0600` and render it from 1Password (for example `op
inject`) rather than pasting values into the repo or a transcript.

| Variable | Needed by | When unset |
| --- | --- | --- |
| `COGNEE_API_URL` | daily `cognify` step, `research cognify` | daily skips cognify with `no Cognee credentials configured; set COGNEE_API_URL in $HOME/.config/beep-research/env`; explicit cognify fails with the same message |
| `COGNEE_API_EMAIL` | Cognee login | Cognee's default user email |
| `COGNEE_API_PASSWORD` | Cognee login | Cognee's default user password |
| `NOTION_API_KEY` | daily `notion-pull` step (`--page`), `research notion-pull` | notion-pull fails |
| `FIRECRAWL_API_KEY` | `research capture` | capture fails |
| `BEEP_KNOWLEDGE_VAULT` | every vault command | vault defaults to `$HOME/YeeBois/knowledge` |

A configured `COGNEE_API_URL` whose server is down is reported as a failed
step (`Cognee login request to <url> failed: ...`), not a skip: remove the
variable to turn cognify off deliberately.
