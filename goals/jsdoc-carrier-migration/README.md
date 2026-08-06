# JSDoc Legacy Carrier Migration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Retire `@example` and `@remarks` across the repo so the `Check / JSDoc Ratchet` gate stops
detonating on unrelated PRs, and so the corpus stops teaching agents a carrier the law forbids.

## Why this exists

`Check / JSDoc Ratchet` fails on most source-touching PRs, and not for the reason it looks like.
The totals ratchet passes; `enforceTouchedFileCleanup` fails. It rejects any changed source file
that contains a legacy carrier **anywhere in the file**, and 77% of source files contain one.

Since the JSDoc law is agent-facing, the same corpus that trips the gate also trains agents to
reproduce the pattern that trips it.

## State

Active. P0 in progress. Nothing has landed.

| phase | what | PR |
| --- | --- | --- |
| P0 | Law contradiction fix + this packet | docs-only |
| P1 | `beep quality jsdoc-migrate` codemod | own PR |
| P2 | Generator templates for the 18 generated files | own PR |
| P3 | The 1,965-file migration + gate swap + baseline | mega-PR |
| P4 | Close | with P3 |

## Read in this order

1. `SPEC.md` — the anchor. Problem, contracts, definition of done, verification matrix.
2. `research/corpus-census.md` — every measurement, with reproduction commands.
3. `research/decisions-locked.md` — nine locked decisions and what was rejected.
4. `PLAN.md` — phase-by-phase execution.
5. `research/SOURCES.md` — file:line citations for every claim.

## The three things most likely to be forgotten

**The P3 branch is regenerated, never rebased.** It must stay
`f(main, codemod, titles.jsonl, overrides.jsonl)`. One hand-edit forfeits that and returns you to
rebasing a 1,965-file diff against a moving `main`. Residue fixes go in `overrides.jsonl`, not the
working tree.

**Conservation runs on post-format bytes.** Biome first, then verify. Otherwise reflow reads as
content mutation and the proof fails for the wrong reason.

**Grok returns data, never files.** It is reached through `http://127.0.0.1:8317`, which is what
bills the Grok plan instead of API credits.

## Resuming

Check `ops/progress.json` for phase and core-item status, then `tasks/tasks.jsonc` for the ranked
task graph. `ops/progress.json` also carries the measured corpus numbers, including
`residueCount`, which stays `null` until P1's dry run produces it.
