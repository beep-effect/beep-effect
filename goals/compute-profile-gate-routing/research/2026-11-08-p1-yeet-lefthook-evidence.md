# P1 evidence: lefthook catalog skip on DankStation

Recorded 2026-11-08 on DankStation (125 GiB installed) from the
`goals/compute-profile-gate-routing-p1` lane, before commit, with lefthook 2.2.2.

## Method

Both catalog commands in `lefthook.yml` now carry
`skip: - run: bun run beep compute profile --is worker`. lefthook skips a
command when that probe exits 0.

The verification ran `bunx lefthook run pre-commit --command <name> --file
packages/tooling/tool/cli/src/commands/Compute/Compute.command.ts --no-tty
--no-auto-install --colors off` twice per command. The first run used the
uncapped user session. The second ran under
`systemd-run --user --scope -q -p MemoryHigh=2G`. `--file` replaced the
`files:` template; `--files-from-stdin` did not, because the `files:` command
(staged diff) still ran and found no files.

The lane may not write the git index. A temporary, uncommitted
`lefthook-local.yml` therefore replaced each command's `run` with its
check-only form, dropping `--write --stage`. The `skip` condition is unchanged
by the override. The file was deleted after the runs. Both checks reported
stale shards because the lane's new schemas and spans were not yet in the
catalogs; the shards were regenerated afterwards with `--write` and no
`--stage`.

## Probe exit codes

| Scope | `beep compute profile --is worker` |
| --- | --- |
| user session (uncapped) | exit 1 (workstation) |
| `MemoryHigh=2G` scope | exit 0 (worker) |

## schema-catalog

Uncapped session (command runs):

```text
┃  schema-catalog ❯
$ bun run packages/tooling/tool/cli/src/bin.ts -- lint schema-catalog packages/tooling/tool/cli/src/commands/Compute/Compute.command.ts
[schema-catalog] stale standards/schema-catalog/@beep/repo-cli.generated.jsonc
error: script "beep" exited with code 1
summary: (done in 10.91 seconds)
✗ schema-catalog (10.91 seconds)
```

`MemoryHigh=2G` scope (command skipped):

```text
│  schema-catalog (skip) by condition
Error: failed to run the hook: no job matching schema-catalog found in hook "pre-commit"
```

## instrumentation-catalog

Uncapped session (command runs):

```text
[observability-catalog] attributes=26 declared-instruments=17 declaration-files=6
[observability-catalog] non-literal span names=6 (reported, not failing)
error: script "beep" exited with code 1
summary: (done in 5.40 seconds)
✗ instrumentation-catalog (5.40 seconds)
```

`MemoryHigh=2G` scope (command skipped):

```text
│  instrumentation-catalog (skip) by condition
Error: failed to run the hook: no job matching instrumentation-catalog found in hook "pre-commit"
```

The trailing `no job matching` line is how lefthook 2.2.2 reports that a
`--command` filter left nothing to run after the skip. A real `git commit`
on a worker host skips the two writers and runs the rest of the hook.
