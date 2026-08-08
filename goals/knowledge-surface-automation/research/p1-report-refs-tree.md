# P1 report — knowledge refs live census (Workstream A phase 0)

Live-repo run of `bun run beep knowledge refs --json` at HEAD
`2162ebdc8ac02fd0e53ca15578cfea0f185ee81a` (2026-08-06), with a paired verification
run at the frozen inventory baseline
`58318884957ae02237099cc40666d30e3c2d943d`. Host-absolute paths quoted below are
redacted to `<HOME>` placeholders per E4; the command itself emits real paths.

## Headline numbers

- 18,433 observations across 1,736 documents (repo-path bus) plus 332 documents
  with host anchors; 9,322 live / 9,111 archival; 4 skipped tree entries, all
  tracked symlinks (`.agents/agents`, `.agents/skills`, `CLAUDE.md`,
  `explorations/CLAUDE.md`), reported and never followed per ratified A6.
- By bus: 17,198 repo-path, 1,233 host-path, 2 goal-uri.
- Exit status 0; the census gates nothing.

| Classification | Live | Archival | Total |
| --- | ---: | ---: | ---: |
| `verified` | 8,481 | 6,949 | 15,432 |
| `broken-target` | 547 | 1,217 | 1,764 |
| `identity-mismatch` | 0 | 0 | 0 |
| `producer-owned-target` | 0 | 0 | 0 |
| `actionable-host-path` | 122 | 0 | 122 |
| `portable-home-convention` | 19 | 0 | 19 |
| `documented-temp-convention` | 1 | 0 | 1 |
| `external-mirror-reference` | 117 | 0 | 117 |
| `archival-provenance` | 0 | 729 | 729 |
| `audit-pattern-literal` | 34 | 211 | 245 |
| `ambiguous-ref-pairing` | 0 | 0 | 0 |
| `ungoverned-syntax` | 1 | 3 | 4 |

Host-anchor classes are live-only by construction except `audit-pattern-literal`,
which deliberately outranks `archival-provenance` so an archival audit row (this
packet's own inventory tables) classifies as pattern data rather than provenance.

## Baseline agreement

Run against the exact inventory snapshot commit, the census reproduces
`research/surface-inventory.md` with zero unexplained delta:

- Census host-path totals at the baseline tree: **1,158 occurrences / 291 files /
  287 live / 871 archival**; per anchor 630 home-absolute, 382 home-relative,
  122 temp, 24 encoded-home + bare-tree-name (14 + 10).
- The inventory's published 1,741 / 406 / 298 / 1,443 decompose exactly as census
  population (above) plus 583 occurrences in 115 files whose extensions the
  census does not elect: `.log` 484, `.inventory` 38, `.sh` 32, `.txt` 15,
  `.diff` 10, `.tsv` 4 — all archival but 11 occurrences in 4 files.
- Zero elected-extension blobs fail strict UTF-8 at either commit, so `skipped`
  carries no `malformed-utf8` rows on the real corpus.

The committed baseline-agreement test (`test/knowledge-refs.test.ts`) re-derives
both sides on every run: an independent in-test anchor counter over all scoped
tracked blobs must reproduce the six published inventory numbers, and the census
must equal that counter restricted to its elected population.

At HEAD the host bus reads 1,233 occurrences / 332 files (293 live / 940
archival); the +75 / +41 drift over the baseline is tree growth since
2026-07-31 (new packet research and history landed by merged PRs), not extractor
drift.

## Highest-density documents

252 `goals/repo-codegraph-jsdoc/history/outputs/compiled_sources/Semantic Code
Graph – an information model to facilitate software comprehension.md` (converted
paper, archival), 242 `standards/jsdoc-documentation.inventory.md`, 161
`explorations/ontology-agent-surface/RESEARCH.md`, 160 `explorations/ATLAS.md`,
130 `goals/goal-portfolio-driver/research/dependency-sweep-2.md`, 124
`goals/INDEX.md`. Density concentrates in generated/converted corpora and
portfolio indexes, as expected.

## Sampled false-positive annotations

**`broken-target` (1,764; the judgment-bearing bucket).** The census deliberately
does not distinguish broken from speculative (no oracle for intent; ratified A1:
prose paths must resolve, speculative trees belong in fences). Hand-annotating
the 547 live rows (245 distinct targets):

- Speculative or renamed packet references dominate: `goals/ip-law-knowledge-graph`
  (31), `goals/ontology-modeling-foundation` (18), `goals/trustgraph-port` (17) —
  design prose citing packets that were never created or were renamed. This is
  the split-brain motivation for Workstream A, observed live.
- True retirements: `standards/repo-exports.catalog.md` (10) — live docs still
  cite the retired catalog that repo law says must never be consulted.
- **Genuine false-positive class found:** MCP JSON-RPC method names `tools/call`
  (22) and `tools/list` (13) read as repo paths because `tools` is a governed
  bare root. Same shape: upstream-repo file paths quoted in research prose
  (`scripts/generate.ts`, 25) that exist in the surveyed repository, not this
  one. Neither is a broken reference in intent; both are exactly what the
  phase-0 eyeball exists to catch before any gate wiring.
- The archival 1,217 concentrate in converted papers and captured surveys whose
  citation-style links never referenced this repository at all.

**`audit-pattern-literal` (245).** The v1 lexical rule (line carries a table
delimiter, regex group `(?`, regex class `[^`, `--glob`, or a word-bounded
`rg`/`grep` invocation) fires correctly on security-finding regexes
(`<HOME-USER>|YeeBois|/tmp/|/Users/|beep-effect2` in
`goals/codex-security-findings-2026-07-08/findings/CSF-016.md`), on
`research/surface-inventory.md`'s own rows, and on hook-pulse glob lines. Known
coarseness: in table-heavy archival research, provenance rows inside Markdown
tables absorb into this class instead of `archival-provenance` (e.g.
`goals/ontology-workbench/research/ontosphere-survey-report.md` table rows).
Both dispositions are "not a defect", so the coarseness costs triage precision,
not correctness.

**`portable-home-convention` (19).** All rows carry the four ratified prefixes
(`~/.claude`, `~/.codex`, `~/.config`, `~/.bun`): CI cache paths in
`.github/actions/setup-monorepo-ci/action.yml`, plan files under
`~/.claude/plans/`, OBS config in the qa-session-ops skill. No mislabels found.

**`documented-temp-convention` (1).** Exactly `/tmp/portless` in the portless
skill. The set is deliberately minimal; see the eyeball ask.

**`external-mirror-reference` (117).** Home paths outside any beep checkout:
`<HOME>/YeeBois/dev/trustgraph/`, `<HOME>/YeeBois/dev/firecrawl`,
`<HOME>/YeeBois/projects/effect-lexical-chat/`. Two annotated edges:
`~/.openclaw/` (a product config-directory convention lexically indistinguishable
from a mirror — a convention-set candidate) and `~/Downloads/...` (session
provenance in a live doc, not a mirror; remediation "canonical URL" does not
apply).

**`actionable-host-path` (122).** The P3 rewrite target set: worktree paths in
`standards/git-worktrees.md`, absolute checkout paths in
`standards/effect-first-development.md` (`.repos/effect-v4` cited absolutely),
executable worktree commands retained in `goals/ai-metrics-stack/ops/manifest.json`,
and non-convention temp outputs (`/tmp/beep-jsdoc-quality-…json`,
`/tmp/codex-security-findings-2026-06`). Fenced host paths are counted here by
design (contract item 8): a fenced `cd <HOME>/…` is precisely what breaks a
fresh clone.

**`ungoverned-syntax` (4).** All absolute-repo-path spellings: `/docs`,
`/docs/`, `/plugins`, `/packages/lexical-headless` (the last is an upstream
monorepo's package quoted absolutely). Correctly outside the governed grammar.

**`encoded-home` (17) / `bare-tree-name` (14).** Encoded session-directory
literals (`/tmp/claude-1000/-home-…-beep-effect5/…`, `~/.claude/projects/-home-…`)
split from plain bare tree names; the two sum to the inventory's combined bucket
at the baseline (24), as required.

## Goal-URI bus and identity-mismatch detection

The live corpus carries exactly two `repo://goal/*` / `beep:ref` observations —
this packet's own doctrine examples — and both verify: the design doc's bare URI,
and the P2 grill record's A1 example, which pairs same-line with display path
`goals/knowledge-surface-automation/PLAN.md`. Dual-write does not exist yet, so
identity-mismatch detection is proven by the committed fixture matrix instead:
manifest-id-agrees → `verified`, manifest present with a different
`initiative.id` → `identity-mismatch` carrying `declaredId`, manifest absent →
`broken-target`/`missing`, two refs on one line and orphan refs →
`ambiguous-ref-pairing`, heading-scope pairing → `verified`. A tracked manifest
that fails JSON parse or schema decode fails the run closed rather than
downgrading to `missing` — the census may not silently convert an undecodable
identity source into an absence.

## v1 scope notes

- Extension election (`.md`, `.json`, `.jsonc`, `.jsonl`, `.toml`, `.yml`,
  `.yaml`) excludes 583 baseline occurrences (dominated by captured `.log`
  proofs, all archival but 11); the baseline-agreement test pins this
  attribution.
- Repo paths are read from inline-code spans (Stage-1 grammar) and inline
  Markdown link destinations (document-relative semantics); reference-style link
  definitions are not read in v1.
- JSON/JSONC is scanned line-wise as text (ratified A2); goal URIs are read from
  Markdown only. Fragments are stripped, not validated (A4). `upstream://` stays
  reserved (A5).
- One placement deviation from the design doc: `knowledgeRefsCommand` registers
  in `Knowledge.command.ts` beside the semantic-delta command (family
  convention) because the design's refs-module placement would create an import
  cycle — `Knowledge.refs.ts` is the shared-parser home the service imports
  from, so it cannot also import the service tag back.

## Eyeball ask

Benjamin — the P3 unlock for Workstream A hangs on your verdict over the rule
table, not the individual rows:

1. `broken-target` disposition: confirm the ratified fence-decoy rule as the
   only speculative-path mechanism, with the MCP-method (`tools/call`,
   `tools/list`) and upstream-repo-path shapes accepted as known lexical FPs to
   burn down in P3 (options: an extension requirement for bare `tools/…` and
   `scripts/…` spellings, or leaving them to fences) — or send the question back
   to a mini-grill.
2. `audit-pattern-literal` lexical rule: accept the v1 signal set (and its
   known table-absorption coarseness in archival research), or name the signals
   you want added/removed before any gate consumes the class.
3. Convention sets: `~/.openclaw` (and any other product config-dir prefixes)
   into `portable-home-convention`? Additional documented `/tmp/…` prefixes into
   `documented-temp-convention`? Widening is a deliberate CLI PR per A3.
4. `external-mirror-reference` remediation text promises a canonical URL;
   confirm that stands for mirror-shaped rows and that provenance-shaped rows
   (`~/Downloads/…`) just ride along until P3 rewrites live surfaces.
5. Confirm the live `actionable-host-path` set (122 rows, headlined by
   `standards/git-worktrees.md` and the two manifests carrying absolute
   commands) as the P3 mechanical-rewrite target list.
