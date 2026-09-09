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
