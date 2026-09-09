# Recover from local Graft configuration drift

Use this runbook when `@beep/ai-sync#check` rejects Graft permissions or the
CLI's Graft hook trust tests fail after Graft initialization. Both failures can
come from local configuration changes even when the committed source is correct.

The repository owns `.claude/helpers/graft-hooks.cjs`,
`.claude/helpers/graft-statusline.cjs`, and their settings. Both shims delegate
to [graft-loader.cjs](../../.claude/helpers/graft-loader.cjs), which resolves a
trusted installation from `PATH` and, before any Graft code runs, records the
running version in the wiring stamp inside the git-ignored Graft cache. That
stamp is what Graft's session upkeep consults; without it, every fresh checkout and every upgrade
would have its tracked wiring rewritten on the first session. Graft
initialization can still replace these shims with generated loaders that
contain an installation path and project fallbacks, and it can broaden the
command permissions in `.claude/settings.json`, which is why `graft init`,
`graft uninstall`, and `graft upgrade` are denied in the checked-in policy.
There is no Graft MCP server in this repository; the CLI and the skill are the
integration (decision log, 2026-09-09).

## Keep the existing integration

Use `graft build` to refresh the index and the named query commands to inspect
code. The checked-in integration is already installed. Do not rerun `graft init`
as an indexing or routine troubleshooting step: it can rewrite tracked hooks
and settings. Review any intentional integration update against the repository
loader and the [configuration policy](../../packages/tooling/library/ai-sync/src/validation.ts).

## Identify the drift

Run these commands from the affected checkout's root:

```sh
git status --short --branch
git diff HEAD -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
bun run ai-sync check
bun run --cwd packages/tooling/tool/cli test -- test/graft-hooks.test.ts
```

The configuration failure names these initializer-added permissions:

```text
Bash(graft:*)
Bash(npx graft:*)
Bash(graft-dev:*)
Bash(node dist/cli.js:*)
```

The hook tests may fail to receive `trusted:session-start`, or receive a Graft
status message where the test expects no output. Confirm that the local shims
were replaced before treating these assertions as defects in the trust loader.

Messages about invalid `ReflectionFrontmatter` can be expected output from
negative tests. Check the test summary: a passing `reflection-lint.test.ts` does
not call for changing real goal reflections.

## Back up and repair the affected files

Preserve the current files outside the repository before editing them:

```sh
mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/beep"
graft_repair_backup=$(mktemp -d "${XDG_CACHE_HOME:-$HOME/.cache}/beep/graft-repair.XXXXXX")
cp -p .claude/settings.json "$graft_repair_backup/settings.json"
cp -p .claude/helpers/graft-hooks.cjs "$graft_repair_backup/graft-hooks.cjs"
cp -p .claude/helpers/graft-statusline.cjs "$graft_repair_backup/graft-statusline.cjs"
git diff --binary --cached -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs > "$graft_repair_backup/staged.patch"
git diff --binary -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs > "$graft_repair_backup/unstaged.patch"
```

Inspect both the staged and unstaged changes. If the shims contain only
initializer-generated drift and `HEAD` contains the repository loader calls,
restore those two working files:

```sh
git diff --cached -- .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
git show HEAD:.claude/helpers/graft-hooks.cjs
git show HEAD:.claude/helpers/graft-statusline.cjs
git restore --source=HEAD --worktree -- .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
```

If either shim has intentional changes, reconcile it manually. Preserve those
hunks and their staged or unstaged state. The restore command above leaves the
index unchanged; the staged repair below is a separate required step.

Edit `.claude/settings.json` selectively:

- Remove the four broad permissions listed above if initialization added them.
  Keep the repository's named Graft command permissions.
- Compare Graft hook timeouts with the committed settings. The repository uses
  `8`, `10`, and `15` seconds; initialization drift has produced `8000`, `10000`,
  and `15000`. Restore the committed values for the affected hooks.
- Preserve unrelated settings, including any intentional footer-link setting,
  and leave local backup files alone.

Do not replace the whole settings file just to remove these additions. Review
the resulting diff, then format the edited JSON:

```sh
bunx biome format --write .claude/settings.json
git diff HEAD -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
git diff --check
```

## Remove confirmed drift from the index

Tests exercise the working files. A clean `git diff HEAD` can therefore hide
initializer drift that remains staged and would return in the next commit.
Inspect the index separately for all three affected files:

```sh
git diff --cached -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
```

If these staged changes contain only confirmed initializer drift, restore their
index entries from `HEAD`. This leaves the repaired working files untouched:

```sh
git restore --source=HEAD --staged -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
git diff --cached --exit-code -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
```

The final command must exit successfully with no diff for this drift-only case.
If intentional changes are also staged, use patch selection to remove only the
confirmed drift hunks:

```sh
git restore --source=HEAD --staged --patch -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
git diff --cached -- .claude/settings.json .claude/helpers/graft-hooks.cjs .claude/helpers/graft-statusline.cjs
git diff --cached --check
```

Every remaining staged hunk must be an intentional change. If a hunk mixes both
kinds of change, split or edit that hunk instead of discarding the intentional
part. Keep the saved patches until both the working files and the index have
been reviewed.

## Verify the repair

A drift repair restores already-committed files, so the two focused checks are
the proof; the full lint, check, and coverage lanes are for source changes and
run hosted:

```sh
bun run --cwd packages/tooling/library/ai-sync ai-sync check
bun run --cwd packages/tooling/tool/cli test -- test/graft-hooks.test.ts
git diff --exit-code HEAD -- .claude/settings.json .claude/helpers .mcp.json AGENTS.md .ignore
```

A local repair that restores already-correct committed files does not require
a source PR. If a failure also reproduces from a clean current base, attribute
it and use the [Yeet workflow](../../.claude/skills/yeet/SKILL.md) for the source fix.

## Seed the meaning tier into other clones

Copy the paid-for meaning tier from a clone that already has
`graft/.cache/summaries.json`. Preview every destination first:

```sh
bun run beep graft cache sync --from ../beep-effect --siblings --dry-run --json
bun run beep graft cache sync --from ../beep-effect --siblings
```

For selected clones, repeat `--to` instead of `--siblings`:

```sh
bun run beep graft cache sync --from ../beep-effect --to ../beep-effect2 --to ../beep-effect6
```

Sibling discovery uses the source basename with trailing digits removed, so
`beep-effect6` selects sibling `beep-effect*` directories containing `.git`.
The source is excluded. Exactly one of `--to` or `--siblings` is required.
`--siblings` now plans all discovered clones in one process. The planner caches
directory and path checks for each plan and deduplicates entries without
quadratic comparisons.

Sync atomically replaces the summaries cache, root-level concept Markdown
(including `INDEX.md`), `.graph/wiring.json`, and `graft/manifest.json` when
present. The manifest is the deep-layer index Graft needs to recognize and use
the copied meaning tier. Sync also removes root-level concept nodes the target
still has but the source no longer does, so the target's concept set matches
the source. Missing source files, including the manifest, are
reported as skipped; a missing summaries cache fails the command. Per-file
cards in nested directories are left for each target's own structural rebuild.
All writes stay under the target's `graft/`; overlapping clones, redirected
artifact paths, and targets without `.git` are refused, and a plan with any
refusal is applied to nothing: the plan is printed and the command exits
non-zero with no files written. `--json` emits a plan for dry runs and refused
runs, and a report with copied, removed, skipped, refused, and byte counts for
writes. The command runs neither Git nor Graft. A dangling or unreadable
sibling entry is skipped by `--siblings` rather than aborting discovery.

## Build the meaning tier (operator only)

The meaning tier (`graft build --deep`) adds the concept map and the per-symbol
summary and crux. It spends model quota through the local proxy, so it is an
operator batch job, never something an agent runs. It has three model-backed
passes: per-file summaries (one request per file, content-hash cached, cheap
to repeat), concept synthesis (142 sequential batches on this repo; effort
barely changes their duration because the time goes to writing nodes), and the
per-symbol crux pass (one batched request per file, checkpointed every 15 s).
Run it as two systemd user services so a closed terminal cannot kill it and
the proxy token stays in an environment file rather than on a command line:
phase A at medium effort until the crux pass starts (the synthesis quality is
what every later query ranks on), then phase B at low effort to completion
(synthesis replays from cache; the crux pass is mechanical).

```sh
install -m 600 /dev/null "${XDG_CACHE_HOME:-$HOME/.cache}/beep/graft-deep-medium.env"
# GRAFT_PROVIDER=openai, GRAFT_BASE_URL=http://127.0.0.1:8317/v1, GRAFT_API_KEY=<proxy client token>,
# GRAFT_MODEL=gpt-6-astra(medium), GRAFT_LLM_RETRIES=12, DO_NOT_TRACK=1; same file with (low) for phase B
systemd-run --user --unit graft-deep-A --working-directory="$PWD" --collect \
  -p EnvironmentFile="${XDG_CACHE_HOME:-$HOME/.cache}/beep/graft-deep-medium.env" \
  -p StandardOutput=append:"$HOME/data-home/graft-cache/deep-build.log" -p StandardError=inherit \
  graft build --deep -j 4
# when the log shows `summarizing 1/…`: systemctl --user stop graft-deep-A, then the same
# command as graft-deep-B with the (low) environment file; it runs to completion
```

Leave `--allow-partial` off so an incomplete meaning tier fails loudly; rerun
the same command to retry only the failed files. `-j` reaches the crux pass
only; the concept pass runs eight summaries in parallel regardless. The
synthesis checkpoint patch described below must be present before phase A, or
a provider error discards every finished batch.

## After a Graft upgrade

The installed package is pinned under the user-local prefix, off any Node
version manager tree, and `graft telemetry disable` has been run once on the
workstation:

```sh
npm install -g --prefix "$HOME/.local" @nanonets/graft@0.16.0
graft --version
```
 The workstation also carries a local patch to the installed
`dist/context/build.js` that checkpoints the synthesis cache after every batch
(the original is kept beside it as `build.js.orig-<version>`); a reinstall or
upgrade removes it, so re-apply it before the next deep build. The loader's
stamp guard keeps upkeep quiet across upgrades, so an upgrade needs no
`graft init`: run `graft --version`, re-apply the patch, and run the two
focused checks above.
