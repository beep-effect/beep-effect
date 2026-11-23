# Scanner replay and parity, 2026-11-22

Measured on branch `goals/comment-law-gate` over origin/main `809947c2a5c`. Aggregates only; no
per-comment rows are committed (S31). The replay script and raw output stayed in the session
scratchpad.

## Host parity

The `beep/no-comments` oxlint rule (one-rule config) and `beep laws comments --list` over the same
4,511 comment-bearing in-scope files under `apps`, `packages`, `infra` and `tools`:

| Host | Findings |
| --- | ---: |
| oxlint rule | 57,854 |
| scanner (`oxc-parser` 0.148.0) | 57,854 |
| differences by file and line | 0 |

Scanner kinds over that tree: prose 51,694, local JSDoc 6,159, bad suppression 1. The exploration
census had 51,953 prose comments and about 6,428 truly local JSDoc blocks; the gap is the exact-token
grammar and live-tag exemptions.

## Last 100 first-parent main commits

Each commit was judged as a PR against its first parent with `commentDelta`:

| Measure | Value |
| --- | ---: |
| commits touching in-scope files | 72 |
| commits that would fail | 67 |
| banned comments introduced | 2,943 (prose 2,616, local JSDoc 327) |
| banned comments removed | 113 |
| median introduced per failing commit | 15 |
| findings that are a directive, licence or decision pointer | 0 |
| local-JSDoc findings whose next code line is an `export` | 0 of 327 |
| delta time per commit, p50 / max | 39 ms / 3.96 s |

A spot check of 25 local-JSDoc findings found one false class, file headers above an import without
`@packageDocumentation`; the grammar now counts those as module headers (decision file
`2026-11-22-count-a-leading-jsdoc-block-above-an-import-as-the-module-header.md`), and the numbers
above are after that change.

## Seed

`beep laws comments --write` seeded 218 pending shards; `beep laws comments --base origin/main` on the
branch reports `introduced=0 findings=0`.
