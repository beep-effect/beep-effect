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

## Follow-up 2026-08-26: CI gates and a challenge-page gap

The head that resolved the threads was red on two required lanes, and a probe exposed one
behaviour gap. All three are fixed in the same follow-up commit.

- `Heavy / Lint Policy` failed on `knowledge refs --check`: three machine-local paths in
  `CAPTURE.md:36`, `DECISIONS.md:74`, and `MAP.md:85` classified as gated external-mirror
  references. Reworded without the home-relative paths (landed concurrently in `433d499c27`).
- `Fallow Advisory Envelopes` failed on `ops/mine-site.ts`: an unused-file finding (the script is
  a `bun run` executable, never imported) and eight complexity findings (`main` cyclomatic 49,
  `fetchOne` 40, `parseRobots` 16, five more above the uncovered-code CRAP ceiling).
  `433d499c27` excludes the packet's `ops/**` from Fallow as packet tooling; independently, the
  miner is now split into phase, robots, and response-outcome functions that each stay under
  cyclomatic 4, cognitive 8, and 60 lines, so it passes the audit with the script registered as
  an entry as well (verified locally before the exclusion landed). Behaviour is unchanged except
  for the two items below.
- Challenge pages: a single honest-identity probe on 2026-08-26 received HTTP `202` with the
  host's captcha challenge markup from all three seed hosts. The previous script stored any 2xx
  body with an HTML content type, so its preflight would have passed and the challenge page
  would have entered the corpus. The miner now stores exactly HTTP `200`, treats any other
  non-redirect, non-missing status as a block (exit 3), and stops when a textual body carries a
  challenge marker.
- Off-scope redirects: skipped and recorded (status row without an artifact) instead of
  aborting the whole run, matching how off-scope sitemap entries and links are handled.
- Robots patterns (`PRRT_kwDOPbO_N86cWE1g`): rules are compiled at parse time with `*` as a
  wildcard and a trailing `$` as an end anchor, and `decide()` matches the compiled pattern with
  longest-pattern precedence instead of a literal `startsWith`. Fixture: `Disallow: /wild*`
  blocks `/wild-x/`, `Disallow: /end/$` blocks `/end/` but not `/end/sub/`.
- Body ceiling (`PRRT_kwDOPbO_N86cV8sj`): responses are streamed through a per-kind byte limit
  (robots 512 KiB, sitemaps 16 MiB, pages 8 MiB, files 64 MiB or `LEJEUNE_MAX_FILE_BYTES`), with
  the declared `Content-Length` checked first; an oversized body is cancelled, recorded as a
  skipped row, and never written. Fixture: a 3 MiB PDF under a 2 MiB cap is skipped while the
  small PDF is stored.

Proof against a local fixture site (robots with `Disallow: /private/` and a longer
`Allow: /private/allowed/`, a sitemap index with an off-host child, page locs including an
off-host entry, a `404`, an in-scope and an off-scope `302`, a PDF, an image, a `www.` alias
link, and modes that return a `202` challenge, a `403`, or a changed `robots.txt`):

- normal run publishes 8 pages and 1 file; `/private/x/` is never requested, the longer Allow
  wins, the `404` and both off-scope destinations leave no artifact, the `www.` link is
  discovered, and every request carries `beep-explorations-site-miner/0.1`;
- a second run reuses every page and file record and re-requests only robots, preflight,
  sitemaps, and the previously missing URLs;
- the challenge mode stops at preflight with exit 3 and publishes nothing; the `403` mode stops
  with exit 3; a `robots.txt` that newly prohibits a queued URL stops with exit 4;
- `--root` inside the checkout exits 2; `--dry-run` prints the bootstrap URLs and creates
  nothing.

Gates on the follow-up head: `bunx tsc --ignoreConfig --noEmit --strict ... mine-site.ts` exit
0; `bun run beep quality fallow audit --base origin/main --check` verdict pass with zero
introduced findings; `bun run beep knowledge refs --check` and `knowledge semantic-delta` exit 0.
