# Durable `environment.d` cache source applied — 2026-11-02

Refs #1873 (criterion 2). Operator ruling 2026-11-02: native `~/.config/environment.d/`
write scope is granted for the backed-up apply, including its drift-refusal test;
backup first, reverse by restoring the backup.

## Drift-refusal test

The unchanged packet script [`stage-5-cache-environment.sh`](./stage-5-cache-environment.sh)
was run against four isolated `HOME` fixtures before the real apply. No real home
file was touched by these runs.

| Fixture | Result |
| --- | --- |
| Target absent | `--dry-run` printed the target and owned field and changed nothing; `--apply` wrote the file, recorded `absent` in a backup directory and printed `rollback: rm -- <target>`; a second `--apply` reported `already applied` and wrote no second backup. |
| Target holds an unowned field (`OTHER=1` beside `TURBO_CACHE_DIR`) | `--apply` exited 1 with `refusing to replace unowned fields`; the file and the absence of any backup were verified afterwards. |
| Target is a symlink | `--apply` exited 1 with `refusing symlink`; the link was left in place. |
| Target holds only a comment and an older owned value | `--apply` copied the prior bytes with `cp -p` into the backup directory, printed `rollback: cp -p -- <backup> <target>`, and replaced the file; the backup bytes equal the prior content. |

## Real apply

```
$ bash goals/repository-simplification-confidence/history/receipts/stage-5-cache-environment.sh --dry-run
target: ~/.config/environment.d/90-beep-turbo-cache.conf
expected owned field: TURBO_CACHE_DIR=${TURBO_CACHE_DIR:-~/.cache/beep/turbo}
dry run; no files changed
$ bash … --apply
rollback: rm -- ~/.config/environment.d/90-beep-turbo-cache.conf
owned-field drift check passed; re-login to load the durable manager source
$ bash … --apply
already applied: ~/.config/environment.d/90-beep-turbo-cache.conf
```

- Owned file written: `~/.config/environment.d/90-beep-turbo-cache.conf` (mode 0644, one
  line, `TURBO_CACHE_DIR=${TURBO_CACHE_DIR:-/home/<user>/.cache/beep/turbo}`; the script
  expands `$HOME`, so the live file carries the absolute home path). The pre-existing
  `50-mcp-gateway.conf` was not read or changed.
- Backup: `~/.config-backups/rsc-g-cache-environment.20261102T032959Z/` holding
  `original-state` = `absent`.
- Restore: `rm -- ~/.config/environment.d/90-beep-turbo-cache.conf` (the file did not
  exist before; the backup directory records that).
- The systemd user manager reads `environment.d` at login; sessions started before the
  re-login keep their inherited `TURBO_CACHE_DIR`. Explicit overrides survive because the
  owned field uses `${TURBO_CACHE_DIR:-…}`.

## Left open (#1873)

- Criterion 1: the Cursor child-posture probe after Cursor's usage reset (2026-11-11),
  with no model substitution. The issue stays open for it.
