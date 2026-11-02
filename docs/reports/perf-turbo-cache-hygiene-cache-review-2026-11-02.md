# Cache baseline review: Turbo input and cache-flag hygiene (2026-11-02)

Branch `claude/perf-turbo-cache-hygiene-ece673`. The re-record covers every subject
`bun run beep cache audit` reported after the four changes below: `//` (six
`unreviewed-expansion` findings) plus all 188 workspace packages (594
`configuration-drift` findings: 186 `build`, 188 `check`, 184 `lint`, 36 `doctest`).
Source: the four-model quality-command performance audit of 2026-11-02 (findings G4,
A2, R8, G10); the reasoning per task is in `docs/runbooks/turbo-cache-inputs.md`.

## What changed

- **`doctest`** (36 drifted subjects, every package with a doctest script): the
  root task adds `!**/node_modules/**` to its inputs. Fixture packages under
  `test/fixtures/*` carry Vitest result caches in `node_modules/.vite/vitest/**` that
  every run rewrites; `@beep/repo-cli#doctest` therefore missed on every rerun
  (27–45 s). With the exclusion the dry-run hash of `@beep/repo-cli#doctest` is
  identical across two consecutive plans while that cache file changes. Command,
  outputs, cache flag and env are unchanged.
- **`lint`, `check`, `build`** (184 / 188 / 186 drifted subjects): the root tasks drop
  the `.env` and `.env.*` inputs. Biome and `tsrs` read no dotenv file, and the globs
  are package-relative, so they only ever hashed a package-local dotenv edit. The
  builds that do load dotenv files themselves (`next build`, `vite build`) keep
  `.env*` through their package overrides: `apps/oip-web` and
  `apps/professional-desktop` already declared it; `apps/todox`,
  `apps/beep-effect-web`, `apps/labs/trustgraph-workbench`, `apps/labs/semantica` and
  `apps/labs/lejeune-bolt-workbench` gain a `turbo.json` override with
  `"inputs": ["$TURBO_EXTENDS$", ".env*"]` (the five `configuration-source-drift`
  rows). Command, outputs, cache flag and env are unchanged for every subject.
- **Six root policy tasks flip `cache: false` → `cache: true`** (the
  `unreviewed-expansion` rows on `//`): `//#lint:markdown-fences`,
  `//#lint:retired-effect-paths`, `//#lint:retired-iri-authorities`,
  `//#lint:schema-tag-idioms`, `//#lint:jsdoc-module-tags`, `//#lint:holds`. Each
  check path was read for purity: they list tracked files with `git ls-files`, read
  working-tree bytes of declared inputs, and read no clock, network, `.beep` state or
  installed dependency manifest (`lint:markdown-fences` spawns the repository's
  `tsrs`, whose identity rides on the root dependency hash). `//#lint:jsdoc-module-tags`
  also excludes generated artifact trees (`node_modules`, `.beep`, `.turbo`, `dist`,
  `coverage`, `.next`, `storybook-static`) and `//#lint:holds` adds the `coverage`,
  `.next` and `storybook-static` exclusions, so build artifacts never enter the hash.
  `//#goals:doctor` stays uncached: it runs `git log --since=<days>` and
  `git log -n 4000`, so its verdict depends on the clock and git history.
- **Not changed by this review:** `@beep/repo-cli` source edits
  (`Quality/Tasks.ts` full-coverage prebuild filter, `GithubChecks.ts` comment) do not
  alter any Turbo task definition; the policy fingerprint was rewritten and is
  byte-identical.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. No remote-cache
authority, qualification tuple or exception inventory changes; no qualification is
granted to the six newly cached root tasks (legacy posture recorded only).

## Reversal

Revert `turbo.json`, the five app `turbo.json` overrides and the test/runbook edits,
then re-record the same subjects.
