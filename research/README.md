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
  handed to them — search/synthesis stages receive no repo checkout; only the
  writer/publisher stage touches this tree, scoped to the new packet dir plus
  `research/ledger/`.
- **Machine proposes, human admits:** nothing here auto-appends to
  `explorations/INBOX.md` or `goals/`. Actions graduate when a human fires a
  capture command from `SUGGESTED_ACTIONS.md`.
- **No explorations ceremony:** no `ops/manifest.json`, no ATLAS sync, no
  reflections requirement. `RUN.json.frictions[]` is the friction-receipt
  surface; the weekly consolidation rolls recurring frictions up for a human.
- **Delivery is PR-only** from the routine's dedicated clone; a human merges.
