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

## Refresh the meaning tier nightly (operator only)

`beep graft deep refresh` is the scheduled form of the two sections above: it
pins one owner clone to `origin/main`, rebuilds the meaning tier there, seeds
the siblings, and runs a structural `graft build` in each seeded clone. It
spends model quota, so it is an operator job like the build itself. Agents
never run `refresh` or `install-timer`.

The owner clone exists only for this job; nobody works in it, so the refresh
can assume a clean checkout on `main` and pin it without asking. Bootstrap it
once against an existing clone's object store:

```sh
git clone --reference "$HOME/YeeBois/projects/beep-effect" \
  https://github.com/beep-effect/beep-effect.git "$HOME/YeeBois/projects/beep-effect0"
cd "$HOME/YeeBois/projects/beep-effect0" && bun install --frozen-lockfile && graft build
mise trust "$HOME/YeeBois/projects/beep-effect0/mise.toml"
bun run beep graft cache sync --from "$HOME/YeeBois/projects/beep-effect" --to "$HOME/YeeBois/projects/beep-effect0"
```

The HTTPS remote is load-bearing, not a preference. The systemd user manager
carries no `SSH_AUTH_SOCK`, so a nightly `git fetch` over an SSH remote has no
agent to answer for the key and fails; the repo is public, so an HTTPS remote
fetches with no credentials at all. Both `refresh` and `install-timer` read
`git remote get-url origin` in preflight and refuse anything that is not
`https://`. An owner clone that already exists over SSH is re-pointed in place:

```sh
git -C "$HOME/YeeBois/projects/beep-effect0" remote set-url origin \
  https://github.com/beep-effect/beep-effect.git
```

The `mise trust` line is not optional either: the timer resolves `graft`
through the mise node shim, and an untrusted config makes that shim refuse to
run. `install-timer` runs `mise trust --show` in the owner and fails closed on
every answer but a clean one, so a mise that is missing, broken, or reporting an
untrusted config refuses the install instead of leaving a unit that fails every
night. The first seed is what saves the first night's full build: the refresh
re-summarizes only changed files, so the owner starts from a meaning tier rather
than from nothing.

The provider keys live in `$HOME/.config/beep-graft/env`, which systemd reads as
the unit's `EnvironmentFile`. It holds the same keys as the deep-build
environment files below (`GRAFT_PROVIDER`, `GRAFT_BASE_URL`, `GRAFT_API_KEY`,
`GRAFT_MODEL`, `GRAFT_LLM_RETRIES`). Nothing reads or prints it except systemd;
the CLI only checks that it exists, and the rendered unit references it without
a leading `-`, so a missing file fails the unit loudly instead of starting a
build with no key.

Copy an existing deep-build environment file rather than starting from an
empty one, then set the model the nightly job should spend:

```sh
install -m 600 "$HOME/.cache/beep/graft-deep-grok.env" "$HOME/.config/beep-graft/env"
${EDITOR:-nano} "$HOME/.config/beep-graft/env"   # set GRAFT_MODEL=
bun run beep graft deep install-timer --owner "$HOME/YeeBois/projects/beep-effect0"
```

The nightly job on this workstation runs `GRAFT_MODEL=claude-opus-5` through
the local proxy; `grok-4.6` and `gpt-6-astra` remain valid values, and the
effort suffixes in the build section below apply here too.

That renders `beep-graft-deep-refresh.service` and
`beep-graft-deep-refresh.timer` into `$HOME/.config/systemd/user/`, reloads the
user manager, and enables the timer for `*-*-* 02:30:00` with a ten-minute
randomized delay. The service carries its own `PATH` (the mise shims, then
`$HOME/.local/bin` and `$HOME/.bun/bin`) because a user unit otherwise starts with
almost none, and `CI=true` so the repo CLI never waits on a prompt. Its
`ExecStartPre` install and `ExecStart` refresh invoke Bun through the mise shim
(`$HOME/.local/share/mise/shims/bun`) when it exists, else
`$HOME/.bun/bin/bun`, and only otherwise the Bun that ran the installer: the
shim resolves the repo's `mise.toml` pin on the night the unit fires, whereas
the installer's own binary is one version that a bump leaves behind and a
prune removes; a candidate this user cannot execute is skipped. Pass
`--bun-path` to pin a different executable, `--on-calendar` for a different
schedule, and `--uninstall` to disable and remove both units. A path that
carries a double quote, backslash, percent sign, dollar sign, or control
character is refused before anything is written, because systemd would
reinterpret it inside the unit. The written units are snapshots: after a merge
that changes how they are rendered, `bun run beep graft deep install-timer
--refresh` re-renders them from the owner, environment file, and calendar they
recorded, with a fresh Bun resolution and no other flags (see
`docs/runbooks/systemd-timers.md`).

Two `ExecStartPre` lines pull the owner clone and reinstall its dependencies
before the CLI boots, so each night runs main's current `beep graft deep
refresh` rather than whatever the clone held the day the timer was installed.
That is also why the first scheduled run after this lands needs no manual pull:
the unit updates the clone itself. The CLI repeats both steps once it starts;
on an already-current clone they are no-ops.

`TimeoutStartSec=8h` bounds the run above the sum of its own phase timeouts
(a five-hour build plus fetch, install, and per-clone rebuilds).
`KillMode=mixed` with `TimeoutStopSec=90` is what makes a stop legible:
`systemctl --user stop` sends `SIGTERM` to the CLI alone, the runtime turns
that into a fiber interrupt, and the run has time to write `outcome: failed`
with an `interrupted` message and release its lock before systemd escalates.

Read the last run back with:

```sh
bun run beep graft deep status            # human summary
bun run beep graft deep status --json     # the schema-encoded status document
```

State lives under `$HOME/.local/state/beep-graft`: `status.json` is rewritten
atomically at every phase transition, `refresh.lock` fences concurrent runs,
and `runs/<timestamp>.log` holds the captured output of every command that run
executed, including the deep build. Because the status file is written on entry
to each phase, `status` shows an in-flight run as `phase: build` with no
outcome; a lock held by a live process refuses a second run and leaves the
first run's status untouched.

The outcome is the part worth reading. `ok` means the build finished at or
above the coverage target and the seed applied with no refusals. `degraded`
means the night is usable but imperfect: coverage below `--min-coverage`
(0.95 by default), a seed the sync refused, or a sibling whose structural
rebuild exited non-zero. `degraded` exits zero on purpose, so a 94% night does
not page anyone. `failed` means a step refused or exited non-zero; the run
exits non-zero and sends a critical desktop notification naming the failure.

Run it by hand the same way the timer does, which is also how to test a change
to the schedule before trusting it overnight:

```sh
bun run beep graft deep refresh --owner "$HOME/YeeBois/projects/beep-effect0" --jobs 16
bun run beep graft deep refresh --owner "$HOME/YeeBois/projects/beep-effect0" --no-seed --no-rebuild
```

`--model` overrides `GRAFT_MODEL` for the build; leaving it off keeps the
environment file in charge. `--no-seed` stops after the build, and
`--no-rebuild` seeds without spending time on each clone's structural pass.

## Build the meaning tier (operator only)

The meaning tier (`graft build --deep`) adds the concept map and the per-symbol
summary and crux. It spends model quota through the local proxy, so it is an
operator batch job, never something an agent runs. It has three model-backed
passes: per-file summaries (one request per file, content-hash cached, cheap
to repeat), concept synthesis (143 sequential batches on this repo; the time
goes to writing nodes, so effort barely changes it), and the per-symbol crux
pass (one batched request per file, checkpointed every 15 s). Run each pass
as a systemd user service so a closed terminal cannot kill it and the proxy
token stays in an environment file rather than on a command line. The first
full build of this repo (2026-09-09) measured:

| Pass | Model | Concurrency | Measured |
| --- | --- | --- | --- |
| Summaries + synthesis | `gpt-6-astra(high)` then `grok-4.6` | sequential batches | 105 to 125 s per batch at high effort, about 150 s on grok; 7 of 143 grok batches came back empty and were refilled by a retry |
| Crux pass | `grok-4.6` (default effort) | `-j 8` | 10 files/min, 23 s mean request latency |
| Crux pass | `grok-4.6(low)` | `-j 8` | 25 files/min, 10 s mean latency |
| Crux pass | `grok-4.6(low)` | `-j 16` | 40 to 80 files/min, no rate limiting across 15,000 requests |

Whole run: 5,216 files, 39,115 symbols, 143 synthesis batches, about 10 h of
wall clock including two restarts and one full crux re-pass; the final crux
pass over 4,138 files took 80 min. Coverage ended at 98% (38,520 symbols);
the remainder is one 800 KB generated file whose single request cannot finish
inside the proxy's 5 min limit.

Prerequisite: the installed Graft must carry the repo's dist patches (the
crux id normalization is what keeps grok's crux pass above 31% coverage):

```sh
scripts/graft/apply-dist-patches.sh --check   # every line must read "applied"
```

Run the build in two phases with two environment files. Phase A covers the
summary and synthesis passes at the model's default effort (an unsuffixed
grok request reasons at roughly the xhigh rate; `gpt-6-astra(high)` is the
equivalent on the Codex pool) because the concept map is what every later
query ranks on. Phase B runs the crux pass at `(low)`. The switch happens the
moment the log shows `summarizing 1/…`, before any crux file has completed,
so nothing is lost; do not switch later (see the restart rule below).

```sh
install -m 600 /dev/null "${XDG_CACHE_HOME:-$HOME/.cache}/beep/graft-deep-grok.env"
# GRAFT_PROVIDER=openai, GRAFT_BASE_URL=http://127.0.0.1:8317/v1, GRAFT_API_KEY=<proxy client token>,
# GRAFT_MODEL=grok-4.6, GRAFT_LLM_RETRIES=12, DO_NOT_TRACK=1
# graft-deep-grok-low.env: the same file with GRAFT_MODEL=grok-4.6(low) and GRAFT_CRUX_EMPTY_RETRIES=2
systemd-run --user --unit graft-deep-A --working-directory="$PWD" --collect \
  -p EnvironmentFile="${XDG_CACHE_HOME:-$HOME/.cache}/beep/graft-deep-grok.env" \
  -p StandardOutput=append:"$HOME/data-home/graft-cache/deep-build.log" -p StandardError=inherit \
  graft build --deep -j 16
# when the log shows `summarizing 1/…`: systemctl --user stop graft-deep-A, then the same
# command as graft-deep-B with graft-deep-grok-low.env; it resumes from the cache and runs
# the crux pass to completion
```

Rules learned from that run:

- The proxy's `model(effort)` suffix works for grok as well as astra; the
  registry lists `low|medium|high|xhigh` for grok-4.6 and an unsuffixed
  request reasons at roughly the xhigh rate. Use `(low)` for the crux pass;
  it is mechanical and the tool call is what matters.
- grok-4.6 returns the whole target row (`id | kind | lines Lx-Ly`) as the
  entry id instead of the id verbatim, which drops every symbol of the file
  and reports `no usable symbol summaries [empty-parsed, finish_reason=null]`.
  The first crux pass ended at 31% coverage because of it. The repo records
  the fix and its companions as unified diffs under
  `scripts/graft/patches/<graft version>/`: `ai-crux` keeps the segment before
  the separator (352 of 352 fixture ids match after it, 84 before) and retries
  a prose answer a bounded number of times; `context-build` retries an empty
  synthesis batch and checkpoints the synthesis cache after every batch;
  `ai-llm-openai` adds the `GRAFT_DUMP_DIR` response dump used below.
  `scripts/graft/apply-dist-patches.sh` applies whatever is missing and is
  safe to rerun; astra honors the id contract without the crux patch.
- Never restart the crux pass to tune it. A file is skipped on resume only
  when every symbol in it is already ready; one omitted symbol keeps the whole
  file dirty, so a restart re-requests most finished files (909 reported, 239
  skipped). Read the end-of-run `computed / cached / pending` line instead and
  run `graft build --deep` again, which touches only dirty files.
- Leave `--allow-partial` off so an incomplete meaning tier fails loudly. `-j`
  reaches the crux pass only; the concept pass runs sequentially regardless.
- Diagnose a bad pass on a copy, not the real graph: copy a failing directory
  into a throwaway repo, `git init`, `graft build`, then `graft build --deep`
  with `GRAFT_DUMP_DIR=<dir>` set (local patch in `dist/ai/llm/openai.js`)
  and read `responses.jsonl` for what the model actually returned.
- After seeding, `graft check` in a clone at a different commit reports
  `STALE` with the changed files listed. That is the concept layer's snapshot
  digest disagreeing with the tree, not a broken graph; queries keep working
  with the old summaries as hints. Refresh by running `graft build --deep` in
  one clone (it re-summarizes only changed files and re-synthesizes only the
  batches they belong to) and seeding again.

## After a Graft upgrade

The installed package is pinned under the user-local prefix, off any Node
version manager tree, and `graft telemetry disable` has been run once on the
workstation:

```sh
npm install -g --prefix "$HOME/.local" @nanonets/graft@0.16.0
graft --version
```
The deep build depends on three workstation-local patches to the installed
`dist/` (`ai/crux.js`, `ai/llm/openai.js`, `context/build.js`), recorded as
unified diffs under `scripts/graft/patches/<graft version>/`. A reinstall or
upgrade removes them, and a new Graft version needs them ported into a new
version directory first. After the install, apply and verify them, then run
the two focused checks above:

```sh
scripts/graft/apply-dist-patches.sh          # applies what is missing, keeps *.orig-<version> backups
scripts/graft/apply-dist-patches.sh --check  # exit 0 only when every recorded patch is present
```

The loader's stamp guard keeps upkeep quiet across upgrades, so an upgrade
needs no `graft init`.
