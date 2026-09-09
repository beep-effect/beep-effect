# Recover from local Graft configuration drift

Use this runbook when `@beep/ai-sync#check` rejects Graft permissions or the
CLI's Graft hook trust tests fail after Graft initialization. Both failures can
come from local configuration changes even when the committed source is correct.

The repository owns `.claude/helpers/graft-hooks.cjs`,
`.claude/helpers/graft-statusline.cjs`, and their settings. Both shims delegate
to [graft-loader.cjs](../../.claude/helpers/graft-loader.cjs), which resolves a
trusted installation from `PATH`. Graft initialization can replace these shims
with generated loaders that contain an installation path and project fallbacks.
It can also broaden the command permissions in `.claude/settings.json`.

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

If either shim has intentional changes, reconcile it manually. Do not overwrite
that work or change the index. The restore command above leaves staged content
unchanged, so staged drift must also be reviewed before a later commit.

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

## Verify the repair

Repeat the configuration and hook checks above for quick feedback. Then run the
complete commands from the affected checkout:

```sh
bun run lint
bun run check
bun run coverage
```

Require a successful exit from each command. The root check includes additional
TypeScript rule, test, and smoke checks after Turbo finishes. Coverage must also
finish its regression check after the test shards pass.

A local repair that restores already-correct committed files does not require
a source PR. If a failure also reproduces from a clean current base, attribute
it and use the [Yeet workflow](../../.claude/skills/yeet/SKILL.md) for the source fix.
