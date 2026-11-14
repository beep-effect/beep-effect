# Fleet roots and registry

Where the beep CLI looks for "the fleet", what the fleet registry records,
and the three `beep worktree fleet` views. Contract:
[`goals/fleet-root-registry/SPEC.md`](../../goals/fleet-root-registry/SPEC.md).

## Discovery roots

Every path-dependent surface reads one ordered list of discovery roots:

- `beep worktree fleet` (mirror, `--join`, `describe`, `register`)
- `beep quality residue-reap --fleet` (it asks the fleet mirror for its
  checkouts)
- `beep yeet economics --fleet` (and `--fleet-hosts`, which adds the
  [fleet hosts](#fleet-hosts) read over SSH)

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
projects directory and `<home>` for the absolute home directory:

```json
{
  "schemaVersion": "fleet-roots/v1",
  "roots": [
    { "path": "<projects>", "namePrefix": "beep-effect" },
    { "path": "<projects>/beep/seats" },
    { "path": "<projects>/beep/lanes" },
    { "path": "<home>/.t3/worktrees/beep-effect" }
  ]
}
```

The last row is the T3 Code worktree root of the `beep-effect` clone (see
[T3 Code lanes](#t3-code-lanes)).

Every root must be an absolute path. A relative entry, such as a path starting with an unexpanded
`~` in a timer unit's environment file, is refused instead of
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

## T3 Code lanes

T3 Code creates each of its lanes as a linked worktree of the clone it was
opened on, under `<home>/.t3/worktrees/<clone name>/<lane>`, outside the
projects directory.

- `beep worktree fleet` and `beep quality residue-reap --fleet` already see
  them without a root: the mirror lists every linked worktree of each
  origin-matched clone through `git worktree list`, wherever it lives.
- `beep yeet economics --fleet` reads the filesystem without git, so it counts
  a T3 lane only through the `<home>/.t3/worktrees/beep-effect` row. Each lane
  passes the origin rule through its `.git` file, which names the clone. In
  derived mode (no `roots.json`, no `BEEP_FLEET_ROOTS`) T3 lanes are not
  counted. A checkout that two roots reach, such as a lane under a symlinked
  alias of the T3 root, or a nested lane listed under its clone and again under
  a root at the clone's Claude Code worktrees directory, is read once.
- Writing the list switches economics from the derived root to configured
  mode, which admits only checkouts whose clone shares the invoking clone's
  origin. Two kinds of checkout that the derived root counted then leave the
  census: a sibling clone of another repository named `beep-effect*` (such as
  `beep-effect-private`), and an orphaned lane whose clone was deleted, since
  its `.git` file names a clone that no longer exists.
- Removal knows the T3 root. The removal fence behind `beep worktree remove`,
  `beep yeet sweep --retire` and `beep worktree reap` admits a lane directly under any of its
  clone's worktree roots: the sibling `-worktrees` directory, the worktrees
  Claude Code nests inside the clone, `<home>/.t3/worktrees/<clone name>`
  (from `HOME`, with or without a roots list), and each root that
  `BEEP_FLEET_ROOTS` or `roots.json` lists, honoring its `namePrefix`. A root
  only says where a lane may sit: the target must still be an exact
  registered worktree of the same Git common directory and never the clone
  itself, and archive export, residue capture, the holder refusal and the
  invoker and `CLAUDE_PID` exemptions apply unchanged. A `roots.json` that
  does not decode adds no roots to the fence and never widens it.
  `beep worktree remove <name>` looks the name up under every root and refuses
  a name registered under two of them. `beep worktree reap` archives merged
  lanes through the same fence but only from the sibling and nested roots: a
  T3 thread stays bound to its worktree with no process standing in it, so the
  reap liveness probe cannot see it, and removing the lane kills the thread.
  Reap therefore reports a lane under the T3 root or another fleet root as
  `self-retire-only` instead of retiring it (before this change the fence
  refused it and reap reported `retirement-failed`). Such a lane is retired by
  its own session with `beep yeet sweep --retire`, or by an explicit
  `beep worktree remove <name> --archive` once its thread is gone. A lane T3 removes itself with `git
  worktree remove` still skips the attempt-journal store, so retire T3 lanes
  through the fence to keep their journals.

## Fleet hosts

`beep yeet economics --fleet-hosts` (it implies `--fleet`) also reads the
attempt journals of other machines, read-only, over the ordinary SSH wrappers
the [host profiles](../../.claude/skills/remote-development-agents/references/hosts.md)
already name. The hosts are listed in
`<state>/beep/fleet/<repo-key>/hosts.json`, next to `roots.json`
(`BEEP_FLEET_STATE_ROOT` relocates it):

```json
{
  "schemaVersion": "fleet-hosts/v1",
  "hosts": [
    {
      "host": "beep-worker",
      "route": "ssh-beep-worker-yubi",
      "roots": ["projects", ".local/state/beep/yeet/attempts"]
    }
  ]
}
```

- `route` is one of `ssh-beep-worker-yubi`, `ssh-tbk-worker`,
  `ssh-dankserver-worker`, `ssh-tom-pc-1-wsl` or `ssh-grok-bot`, always
  without `--admin`. Any other value, a raw `ssh` or an administrative
  wrapper does not decode, so the read never opens a new route or needs a new
  credential.
- `roots` are relative to the remote login's home directory, made of plain
  segments (letters, digits, `.`, `_`, `-`) with no `.` or `..`. A
  remote checkout is admitted by root, not by origin: reading a remote
  `.git/config` would be a read beyond the journals, so list only
  directories that hold this repository's checkouts. The host's own
  attempt-journal store (`.local/state/beep/yeet/attempts`) is read only for
  this fleet's `<repo-key>` partition.
- Each host runs exactly one remote command (sent with every token
  single-quoted, so the remote shell expands nothing):
  `find <roots> -maxdepth 8 ( -name node_modules -o -name .git ) -prune -o
  -type f -path */runs/*/attempts.ndjson -exec tail -v -c +1 -- {} +`.
  It lists and prints run journals and creates nothing on the host: no
  temporary file, directory or lock. The shell refuses any other command
  line before starting the wrapper, and standard input is closed.
- Hosts are read one at a time, because each wrapper may ask for a touch of
  the same YubiKey; a read has two minutes. A host that times out, cannot be
  reached (`ssh` exit 255), whose wrapper refuses (any other status), whose
  wrapper is not installed, or whose output passes 64 MiB is reported as
  `unreachable` with that reason, and the other hosts are still read. `find`
  exiting 1 (a missing root) is `partial`: what it printed is still read.
- The printed journals are folded in memory, labelled `<host>:<checkout>`
  and `<host>:(retained)`, and dropped. The report gets one receipt per host
  in `scope.hosts` (status, reason, exit code, journal, attempt and
  skipped-file counts) and the attempts' `hostMix` and `seatMix`. No raw
  row is written to disk, printed, or kept in any report.

New attempt-started rows carry `host` (the writer's short host label) and
`seat` (`codex`, `claude-code` or `unknown`, the harness whose shell
started the attempt). Rows written before those keys decode with them absent
and count as `unrecorded`; readers that predate them ignore them.

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
