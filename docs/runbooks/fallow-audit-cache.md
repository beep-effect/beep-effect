# Fallow audit cache

`fallow audit` attributes findings as introduced or inherited by materializing
the base commit as a private Git checkout. Fallow 3.31 calls this the
reusable audit base snapshot and stores it under its `TMPDIR` as

```
fallow-audit-base-cache-<key>-root-<key>/   # ~570-780 MB checkout of the base commit
fallow-audit-base-cache-<key>-root-<key>.last-used   # recorded owner root (one absolute path)
fallow-audit-base-cache-<key>-root-<key>.lock
fallow-audit-base-cache-<key>-root-<key>.sha         # base SHA the snapshot holds
```

The key is a hash of the project root, so each lane owns exactly one snapshot.
Fallow reuses it across runs and rebuilds it in place when the base SHA moves.
Two lanes auditing the same base commit do not share a snapshot; that would
need an upstream key change.

## Where it lives

| Path | When |
| --- | --- |
| `~/.cache/beep/fallow/` | Every `bun run beep quality fallow <lane>` (so `yeet` cheap gates, `beep ci lane fallow`, and the `fallow:*:check` root scripts). Respects `XDG_CACHE_HOME`; `BEEP_FALLOW_CACHE_ROOT=<absolute dir>` overrides the whole root. |
| `$TMPDIR` or `/tmp` | A bare `bun run fallow audit` or `bun run fallow:audit` invoked by hand, because only the repo-cli wrapper exports the cache root to the child. |

The wrapper sets the child's `TMPDIR` to the cache root and forwards
`FALLOW_AUDIT_CACHE_MAX_AGE_DAYS=2` (set the variable yourself to change the
age). The parent process environment is untouched. On this workstation `/tmp`
is zram-backed tmpfs, so a snapshot left there is swap, not disk; the repo law
that tool clones never go under `/tmp` applies to this cache too.

## Who reclaims it

Three independent collectors, from most to least targeted:

1. **Fallow's own GC**, silently on every `fallow audit` run and on demand with
   `bun run fallow -- audit-cache prune [--dry-run] [--max-age-days N]`. It
   removes the invoking root's own snapshot once it is older than the age
   threshold, and every snapshot whose recorded owner root no longer exists.
   Snapshots owned by other live roots are never touched. It scans only the
   `TMPDIR` of the invocation, so run it with
   `TMPDIR=~/.cache/beep/fallow` to see the shared root.
2. **Lane retirement.** `bun run beep yeet sweep --retire` runs
   `fallow audit-cache remove --root <lane>` before the worktree is removed.
   `bun run beep quality fallow audit --discard-base-cache` does the same for
   the current checkout after a passing audit, for a lane that will not audit
   again but is not being retired yet.
3. **The janitor.** `bun run beep quality tmpfs-reap [--apply]` classifies the
   snapshots under `/tmp`, a distinct `TMPDIR`, and `~/.cache/beep/fallow` as
   `fallow-cache`. A snapshot with a live `/proc` cwd or fd reference or a held
   `.lock` flock is skipped. Otherwise it is reaped immediately when its
   recorded owner root is gone (`ownerRoot` in the report) and after one idle
   hour when the owner still exists; the sidecars go with it.

## Inspect or purge by hand

```bash
TMPDIR=~/.cache/beep/fallow bun run fallow -- audit-cache prune --dry-run --format json --pretty
```

```bash
bun run beep quality tmpfs-reap --json | jq '.candidates[] | select(.reapClass == "fallow-cache")'
```

```bash
bun run fallow -- audit-cache remove --root "$PWD" --dry-run
```

Legacy snapshots that predate the move still sit in `/tmp`. The janitor reaps
them under the same rules, and any `fallow audit` run with `TMPDIR` unset
reclaims the ones whose lanes are gone. Do not `rm -rf` a snapshot whose
`.lock` is held: that is an audit in flight.
