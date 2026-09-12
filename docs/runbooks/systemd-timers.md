# systemd user timers: research and graft

Two repo CLI commands render systemd **user** units into
`$HOME/.config/systemd/user/` on a workstation and enable their timers:

| Command | Units | Schedule |
| --- | --- | --- |
| `bun run beep research install-timers` | `beep-research-daily.{service,timer}`, `beep-research-repo-card.{service,timer}` | daily 21:00, Sunday 20:30 |
| `bun run beep graft deep install-timer --owner <clone>` | `beep-graft-deep-refresh.{service,timer}` | nightly 02:30 |

Both installers share one module, `packages/tooling/tool/cli/src/internal/systemd/`:
the Bun the unit runs is the mise shim (`$HOME/.local/share/mise/shims/bun`)
when this user can execute it, else `$HOME/.bun/bin/bun`, else the Bun that
ran the installer; `--bun-path` pins one explicitly. Every path is validated
as a systemd unit path (no double quote, backslash, `%`, `$`, or control
character) and the `Exec*` arguments are rendered quoted, so a space is fine.

## Why units go stale, and the fix

A unit file is a snapshot of the flags and environment at install time.
Three things rot it:

1. **The Bun path.** Before 2026-09-12 the units ran `process.execPath`, one
   Bun version's binary; a `mise.toml` bump left them on the old version, and a
   prune made them fail on their next tick. The shim resolution fixes this.
2. **The working directory.** `research install-timers` used the current
   directory as `WorkingDirectory`. Run from a disposable worktree, the units
   pointed at a directory that was later deleted and the daily pipeline died
   silently. `--repo-root <clone>` names the durable checkout explicitly and
   the installer refuses a root that does not exist.
3. **The renderer itself.** When a merge changes what the unit says (a new
   `Environment=`, a quoting fix, a different `ExecStartPre`), the installed
   file keeps saying the old thing until someone re-renders it.

`--refresh` is the answer to the third: it re-renders the installed units from
what they recorded — `WorkingDirectory` (repo root / owner), the `--page` in
`ExecStart` (research), `EnvironmentFile` and the timer's `OnCalendar` (graft)
— with a fresh Bun resolution; a flag given alongside `--refresh` still
wins over the recorded value:

```bash
bun run beep research install-timers --refresh
bun run beep graft deep install-timer --refresh
```

Run them from a checkout that already contains the merged renderer change (the
owning clone after `bun run beep yeet sweep --retire`, or any fresh worktree).
`--refresh` fails with "install first" when nothing is installed.

## Who runs this

The agent that shipped the change, as part of post-merge closeout, per
`AGENTS.md`. The permissions are granted to agents on purpose:
`Bash(bun run beep research install-timers:*)`,
`Bash(bun run beep graft deep install-timer --refresh:*)` (the graft
installer's only agent-allowed form, because a first install schedules a
nightly model-spending job), and the read-only
`systemctl --user list-timers`, `systemctl --user status beep-…`, and
`journalctl --user -u beep-…` queries used to verify. The status and journal
grants are scoped to the `beep-` unit namespace on purpose: a unit's status
and journal can carry whatever that unit logged, so an agent gets the Beep
timers' logs and nothing else's. The CLI spawns `systemctl --user` itself;
agents never need a broader `systemctl` grant.

Two agent surfaces cannot do this and must hand it to a Claude session:
a sandboxed `codex exec` lane cannot reach the systemd user bus (its
socket lives under `$XDG_RUNTIME_DIR`, outside the workspace-write sandbox),
and hosted CI has no user manager at all.

## Retiring the lane that ran the closeout

`bun run beep yeet sweep --retire` archive-retires the linked worktree it is
run in. The archive fence refuses a lane that any process still stands in, and
it exempts exactly the invoker's ancestry (the CLI, its shell, the agent
session above them); anything else holding the lane still refuses it and the
error prints the working form. Run it as the last command of the session, from
the lane, with the shell stepping out first:

```bash
cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && bun run beep yeet sweep --retire --lane "$OLDPWD"
```

`--lane <path>` names the lane when the command runs from the owning clone;
without it the command retires the checkout it runs in. `--json` prints one
schema-owned document (`yeet-retire-sweep-plan/v1` with `--plan`,
`yeet-retire-sweep-report/v1` otherwise). `--branch` is refused alongside
`--retire`: the lane's own HEAD is the branch that is retired.

## Verify

```bash
systemctl --user list-timers --no-pager | grep -E "beep-research|beep-graft"
grep -E "^(ExecStart|WorkingDirectory)=" $HOME/.config/systemd/user/beep-research-daily.service
journalctl --user -u beep-research-daily.service -n 20 --no-pager
```

`ExecStart` should name the mise shim in quotes and `WorkingDirectory` the
durable clone. A `Persistent=true` timer whose last run was missed fires once
immediately after `enable --now`; read its journal rather than waiting for the
next tick.

## Related

- `docs/runbooks/graft-local-recovery.md` — what the graft refresh unit does each night.
- `standards/git-worktrees.md` — lane retirement, including `yeet sweep --retire`.
