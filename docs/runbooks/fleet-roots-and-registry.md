# Fleet roots and registry

Where the beep CLI looks for "the fleet", what the fleet registry records,
and the three `beep worktree fleet` views. Contract:
[`goals/fleet-root-registry/SPEC.md`](../../goals/fleet-root-registry/SPEC.md).

## Discovery roots

Every path-dependent surface reads one ordered list of discovery roots:

- `beep worktree fleet` (mirror, `--join`, `describe`, `register`)
- `beep quality residue-reap --fleet` (it asks the fleet mirror for its
  checkouts)
- `beep yeet economics --fleet`

Each root is a directory whose immediate children are candidates. Discovery
reads one level, never recurses and never follows symlinks. A child counts when
its `origin` matches the invoking checkout's (`git@host:o/r.git` and
`https://host/o/r` are the same origin). A root with a name prefix admits only
children whose names start with it.

Resolution order, first match wins:

1. `BEEP_FLEET_ROOTS`: a `:`-separated path list for tests and timer units. An
   entry whose last segment ends in `*` is a prefix root: `/p/beep-effect*`
   means root `/p`, children named `beep-effect…`.
2. `~/.local/state/beep/fleet/<repo-key>/roots.json`. `<repo-key>` is the
   session ledger's key, `host__owner__name`
   (`github.com__beep-effect__beep-effect`), so `beep-effect-private` keeps its
   own fleet. `BEEP_FLEET_STATE_ROOT` relocates the `fleet/` directory.
3. Unset: the single root derived from the invoking checkout (the git common
   dir's grandparent, normally `$HOME/YeeBois/projects`). In this mode
   `beep worktree fleet --json` is byte-identical to its output before the list
   existed.

The workstation's intended list, with `<projects>` standing for the absolute
projects directory:

```json
{
  "schemaVersion": "fleet-roots/v1",
  "roots": [
    { "path": "<projects>", "namePrefix": "beep-effect" },
    { "path": "<projects>/beep/seats" },
    { "path": "<projects>/beep/lanes" }
  ]
}
```

Every root must be an absolute path. A relative entry, such as an unexpanded
`~/projects` in a timer unit's environment file, is refused instead of
resolving against the working directory. With a configured list, a root that does not exist yet contributes nothing
instead of failing. A linked worktree directly under a root (a `beep/lanes`
lane) brings in the clone that owns its `.git`. `roots.json` that does not
decode makes `worktree fleet` fail, and makes `yeet economics --fleet` warn and
fall back to the derived root. Economics reads each candidate's origin from its
clone's `.git/config` and admits only checkouts that share the invoking
clone's origin, the same membership rule the mirror applies.

Check what a scan will read:

```sh
BEEP_FLEET_ROOTS="$HOME/YeeBois/projects/beep-effect*:$HOME/YeeBois/projects/beep/seats" \
  bun run beep worktree fleet --join | head -2
```

The first line prints the roots and their source (`option`, `env`, `file` or
`derived`).

## Registry

`~/.local/state/beep/fleet/<repo-key>/registry.json` holds one row per
checkout path and authors only what git cannot derive:

| Field | Values | Written by |
| --- | --- | --- |
| `seatRole` | `main`, `ops`, `review`, `research`, `impl`, `legacy`, `adopted` | `fleet register`; the scan for `legacy` and `adopted` |
| `owningSeat` | path of the clone whose `.git` holds the lane, or `null` | the scan (`git rev-parse --git-common-dir`), `register --owning-seat` |
| `drainStatus` | `active`, `draining`, `retired` (default `active`) | `legacy-drain` |
| `retentionExempt` | boolean (default `false`) | `register --retention-exempt` |

Every write (adoption and `register`) holds `registry.json.lock` across its
re-read, change and atomic publish, so a concurrent `register` and `--join`
never drop each other's rows. The file is rewritten only when it changed.

Lane, branch, PR and session state are never stored here; the views read them
from the newest session-ledger row for the checkout
(`~/.local/state/beep/sessions/<repo-key>.jsonl`).

### Adoption

`fleet --join` and `fleet describe` adopt every checkout the scan sees without
a row: an origin-matched clone whose parent is a legacy root (a prefix root,
or the derived root) becomes `legacy`, and everything else becomes `adopted`.
Adoption only adds rows. It never changes or deletes an existing row, so a
`register` survives every rescan, and a checkout that disappeared keeps its row
until `legacy-drain` retires it. Plain `fleet` and `fleet --json` never write.

## Views

| Command | Shows |
| --- | --- |
| `beep worktree fleet [--json]` | The derived mirror, unchanged: liveness, conflict prediction, policy movement. |
| `beep worktree fleet --join [--json]` | One compact row per checkout: kind, branch, liveness, dirty count, then `role`, `seat`, `drain`, then the ledger's `lane`, `pr`, `state`. |
| `beep worktree fleet describe <checkout> [--ledger-rows N] [--json]` | One row expanded: the full mirror record, the registry row, and the newest N (default 5) ledger rows. |
| `beep worktree fleet register <checkout> --role <role> [--owning-seat <path>] [--retention-exempt]` | Writes one registry row. The checkout must be one the fleet discovers. Without `--owning-seat` it keeps the row's seat, else derives it. `--retention-exempt` only sets the flag; omitting it keeps the current value. |

The split follows LCM's summary, pointer and expand pattern (Ehrlich and
Blackman, arXiv 2605.04050): sessions read the compact `--join` view, keyed by
path, and pull detail with `describe` only when they need it.

## Troubleshooting

- A clone and its lanes are missing from the mirror: compare
  `git -C <clone> remote get-url origin` with the invoking checkout's origin.
  Before the origin canonicalization fix, an HTTPS clone among SCP clones
  dropped out with every lane it owns; that was the cause of the
  `beep-effect0-worktrees` undercount (1 of 34 attributed).
- A lane is listed under the wrong clone's sibling directory: the mirror groups
  by owning `.git`, not by directory name. `fleet describe <lane>` prints the
  `owningSeat` the lane's `.git` file points to.
- `register` refuses a path: run `fleet --join` and copy the path exactly; the
  registry keys rows by the absolute path git reports.
