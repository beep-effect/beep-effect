# PR 831 review-fixes report

Date: 2026-08-26

## Thread disposition

- `PRRT_kwDOPbO_N86cVZ5j`
  Added one HTTPS host allowlist for sitemap locations, discovered links, and manual redirect
  targets. Off-scope values are logged and never fetched. See `ops/mine-site.ts:16`,
  `ops/mine-site.ts:56`, and `ops/mine-site.ts:204`.

- `PRRT_kwDOPbO_N86cVZ5l`
  Non-2xx bodies are discarded. Only validated 2xx artifacts reach their destination, and cache
  reuse requires a validated 2xx manifest row plus a matching size and hash. See
  `ops/mine-site.ts:172`, `ops/mine-site.ts:195`, and `ops/mine-site.ts:215`.

- `PRRT_kwDOPbO_N86cVZ5q`
  Replaced the zsh glob pipeline with TypeScript iteration over successful page results, so an
  empty page set is valid. See `ops/mine-site.ts:268`.

- `PRRT_kwDOPbO_N86cVc7q`
  Failed and partial fetches cannot become cache hits. Resume verifies the prior 2xx row, byte
  count, and SHA-256 before copying through a temporary file. See `ops/mine-site.ts:172` and
  `ops/mine-site.ts:215`.

- `PRRT_kwDOPbO_N86cVc7t`
  Removed the Chrome identity. The script always sends the named research-miner identity and
  stops without retry on `401`, `403`, or `429`. See `ops/mine-site.ts:13` and
  `ops/mine-site.ts:195`.

- `PRRT_kwDOPbO_N86cVc7u`
  Recursive sitemap entries and every redirect target pass through the same HTTPS allowlist.
  Redirect handling is manual and capped at three hops. See `ops/mine-site.ts:56`,
  `ops/mine-site.ts:189`, and `ops/mine-site.ts:204`.

- `PRRT_kwDOPbO_N86cVeGc`
  Sitemap indexes now use a recursive queue. Child files receive hash-derived `.xml` names, so
  line endings cannot alter the extension. See `ops/mine-site.ts:170`, `ops/mine-site.ts:245`, and
  `ops/mine-site.ts:257`.

- `PRRT_kwDOPbO_N86cVeGf`
  HTTP error bodies are canceled and recorded without an artifact. A 2xx response must pass its
  content-type check before Bun writes a temporary file. See `ops/mine-site.ts:215` and
  `ops/mine-site.ts:221`.

- `PRRT_kwDOPbO_N86cVeGh`
  `README.md` now asks one first question: whether to license the TypeScript port under MIT or
  Apache-2.0. It points the remaining queue to the manifest and decision log. See `README.md:19`.

- `PRRT_kwDOPbO_N86cVeGi`
  The only User-Agent is `beep-explorations-site-miner/0.1`; refusal stops the run. The research
  sketch and constraints now reject browser-profile workarounds. See `ops/mine-site.ts:13`,
  `research/08-demo-options.md:249`, and `RESEARCH.md:238`.

- `PRRT_kwDOPbO_N86cVeGm`
  The script parses applicable wildcard and named-agent groups, longest-prefix Allow/Disallow
  rules, and Crawl-delay. It records skips and stops if a stored policy changes to prohibit a
  queued URL. See `ops/mine-site.ts:68`, `ops/mine-site.ts:148`, and `ops/mine-site.ts:239`.

- `PRRT_kwDOPbO_N86cVeGp`
  The allowlist includes both bare and `www` TightenRight hosts, plus `www` variants of the other
  allowed hosts. Link closure uses that shared allowlist. See `ops/mine-site.ts:16` and
  `ops/mine-site.ts:268`.

- `PRRT_kwDOPbO_N86cVeGr`
  The root is resolved through `realpath`. The script exits 2 for a root inside the checkout or
  any path containing `/beep-effect`. See `ops/mine-site.ts:49` and `ops/mine-site.ts:111`.

- `PRRT_kwDOPbO_N86cVeGu`
  Populated all 46 blank PDF Source URL cells from the corresponding machine-local record
  headers. All 148 ledger rows now match their retained headers. See
  `research/raw/site/pdf/INDEX.md:34` and the mechanically updated rows that follow.

- `PRRT_kwDOPbO_N86cVeGz`
  Sitemap locations are normalized before queueing and rejected unless they use HTTPS and an
  allowed hostname. See `ops/mine-site.ts:56` and `ops/mine-site.ts:257`.

- `PRRT_kwDOPbO_N86cVeG3`
  Runs remain under a timestamped `.staging` directory until every manifest line and 2xx
  artifact validates. Publication renames the run, then atomically replaces `current`. See
  `ops/mine-site.ts:123`, `ops/mine-site.ts:282`, and `ops/mine-site.ts:292`.
  The `current` pointer update is at `ops/mine-site.ts:294`.

- `PRRT_kwDOPbO_N86cVeG5`
  The raw-corpus pointer now reports the ledger-derived totals: 390 pages, 148 PDFs, and 12
  attachments. It also links the TypeScript miner. See `research/raw/README.md:3` and
  `research/raw/README.md:9`.

All 17 threads required changes; none were waived.

## Proof

Help, exit 0:

```sh
bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts --help
```

Fixture-free dry-run, exit 0. It printed two stdout lines and did not create the root:

```sh
bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts \
  --dry-run --root /tmp/pr831-empty-corpus-root
test ! -e /tmp/pr831-empty-corpus-root
```

Strict typecheck, exit 0:

```sh
bunx tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --types node,bun \
  explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts
```

The prompt's invocation without `--ignoreConfig` exited 1 with TypeScript 6 `TS5112`. The
working invocation above adds `--ignoreConfig` and the installed `node,bun` ambient types.

Expected repo-root refusal, exit 2 with one stderr line and no stack trace:

```sh
bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts \
  --dry-run --root explorations/lejeune-bolt-agentic-demo
```

Ledger counts, exit 0:

```sh
pages=$(rg -c '^\| `~/data-home/lejeune-bolt-corpus/site/' \
  explorations/lejeune-bolt-agentic-demo/research/raw/site/INDEX.md)
pdfs=$(rg -c '^\| `~/data-home/lejeune-bolt-corpus/site/pdf/' \
  explorations/lejeune-bolt-agentic-demo/research/raw/site/pdf/INDEX.md)
attachments=$(rg -c '^\| `~/data-home/lejeune-bolt-corpus/site/attachments/' \
  explorations/lejeune-bolt-agentic-demo/research/raw/site/attachments/INDEX.md)
test "$pages:$pdfs:$attachments" = "390:148:12"
```

Stale shell references and blank PDF cells, exit 0:

```sh
test -z "$(rg -l 'mine-site\.sh|\| <> \|' \
  explorations/lejeune-bolt-agentic-demo || true)"
```

A read-only Bun comparison checked every PDF ledger row against its machine-local record header:
`{"rows":148,"missing":0,"mismatches":0}` (exit 0).

The CLI stdout limit is met: help uses four lines, dry-run uses two, and successful publication
uses one. Failures write one concise line to stderr.
