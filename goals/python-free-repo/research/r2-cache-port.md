# infra/r2-cache Python port

Lane: `chore/python-free-repo`, 2026-11-13. The SPEC listed `infra/r2-cache` as a
non-goal because `infra-alchemy-rebuild` deletes the directory at its P6. Parts are
live (a CLI subprocess, the Cache Warm probe, an installed fleet tool), and P6 is far
off, so this lane ports or deletes all six Python files now.

## Disposition

| File | Consumer found | Disposition |
| --- | --- | --- |
| `policy_runtime.py` (371) | `Cache.adapter.ts` spawned `/usr/bin/python3 -I -B policy_runtime.py owned-host` for producer uploads; `policy-lab.py` imported it | Ported in-process: `packages/tooling/tool/cli/src/commands/Cache/Cache.adapter.host.ts` |
| `probe.py` (112) | `.github/workflows/cache-warm.yml` (`r2_probe` dispatch); README seed/restore steps | Ported: `bun run beep cache r2 probe seed\|ci\|restore --marker <hex16>` (`Cache.r2.ts`, `Cache.r2.command.ts`) |
| `fleet.py` (68) | Copied by `workstation.sh install` into `~/.local/share/beep/r2-cache/`; README enrollment step | Ported: `bun run beep cache r2 fleet <roots...> [--apply] [--output <path>]`; install step no longer copies it |
| `trial-grants.py` (267, boto3) | README operator step only; trial expires 2026-11-28; owning goal `turborepo-cache-trust-observability` is paused | Deleted. Result retained: `goals/turborepo-cache-trust-observability/research/saved-storage-grants-checkpoint-2026-11-03.json` |
| `policy-lab.py` (1035) + `policy-lab-requirements.txt` | README "optional" lab only | Deleted. Results retained: `research/adapter-policy-lab.json`, `adapter-runtime-lab.json`, `adapter-runtime-checkpoint.json` under the trust packet |
| `policy-build-requirements.txt` | `.github/workflows/heavy.yml` producer build (`pip install --require-hashes`), `ci-runner-security.test.ts` | Kept. It pins the `cargo-zigbuild`/`ziglang` wheels for the Rust musl build; it is a lockfile for a build tool, not Python source, and has a live consumer |

Recovery for every deleted file: `git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:infra/r2-cache/<file>`.

Not in scope here: the inline `python3 - <<'PY'` heredocs in `adapter.sh`, `workstation.sh`,
`turbo.sh`, `policy.sh` and `check.sh`, and the inline Python in `heavy.yml`'s producer
build steps. They are not tracked `*.py` files, so the `no-tracked-python` law does not
see them, and shell scripts belong to `scripts-to-beep-cli`.

## Design calls

1. **Owned host runs in-process.** The subprocess bought three things: `python -I`
   (no environment-driven code in the host), a host environment cleared to
   `PATH`/`HOME`, and a 30-second force kill of the host. In-process, the host code is
   the CLI itself (no new injection surface), every child gets an explicit environment
   (`extendEnv: false`), and the scope finalizer stops units and kills the
   `systemd-run` client (SIGTERM, SIGKILL after 10 s). One property is lost: if the
   Bun process is SIGKILLed, nothing stops the unit early, because the Python host used to
   notice stdin EOF and clean up. The unit's own `RuntimeMaxSec=600` and
   `KillMode=control-group` still bound it to ten minutes.
2. **Launcher without Python.** The unit used to run `python3 -I -c <launcher>` to
   read the config from the anonymous pipe and `execve` the adapter. It now runs
   `/usr/bin/env -i <bun|node> [--no-env-file] -e <launcher>`, which uses
   `process.execve` (Bun 1.4.4 and Node 26 both have it). `env -i` takes over from
   `-I`: the user manager's `BUN_OPTIONS`/`NODE_OPTIONS`/preload variables never
   reach the launcher. The test proves the adapter's environment is exactly the piped
   one even with those variables set on the parent.
3. **Service boundary.** `CacheOwnedAdapterHost` is a `Context.Reference` whose
   default is the live systemd host, so `producer-run` needs no new layer. Tests
   provide an inert host. The pipe frame protocol (`CacheAdapterHostEvent`) is
   retired. The parent now decodes typed observations (`CacheAdapterWriterReady`,
   `CacheAdapterWriterAfterLoad`). The pipe-only faults (bad JSON, oversized frame,
   trailing frames) no longer exist.
4. **Observation is pure over a snapshot.** `observeCacheAdapterSnapshot` judges a
   `CacheAdapterProcessSnapshot` (raw systemd properties, `/proc/<pid>` and cgroup
   text), runs the checks in the Python order, and uses the Python refusal messages.
5. **Probe receipts keep Python field names** (`elapsed_s`, `uploaded_duration_ms`,
   `reader_write_rejected`, ...). A receipt written to the bucket by one mode can be read
   by a later mode, possibly from a Python-era seed. Payload bytes are the same
   (`sha256(marker+label)` repeated), so either implementation verifies the other's
   payloads. Three small differences: PUT bodies are sent as
   `application/octet-stream`, where `urllib` defaulted to form-encoding; stored
   receipts are compact schema JSON; the reader readiness poll sleeps 100 ms after any
   non-ready answer.
6. **Fleet** keeps the Python path ordering (component-wise), statuses, mode rule
   and `0600` receipt. It always enrolls through the invoking checkout's
   `infra/r2-cache/workstation.sh` (README usage). `recorded_utc` is ISO-8601 from
   `DateTime.formatIso` (`...Z`, millisecond precision) instead of Python's
   `+00:00` microseconds.

## Evidence

- `bunx --bun vitest run test/cache-producer-adapter.test.ts`: 44 passed (also 44 under
  Node). Covers the parent lifecycle against an inert host, the recorded writer
  readiness row from the runtime lab (3 actix, 2 tokio, 6 threads, 5890048 peak
  bytes), 14 negative snapshots, 8 startup-input refusals before a unit exists, the
  real launcher's exact environment, and its 32 KiB input bound (exit 78).
- `bunx --bun vitest run test/cache-r2.test.ts`: 12 passed. Payload digests replay
  values recorded from the Python `fixture()` for marker `0123456789abcdef`
  (`2f791abf…`, `889cccc9…`, `a6b505eb…`, `c679d16d…`). The seed→ci→restore chain runs
  against an in-memory artifact API. Four failure receipts, and fleet plan/apply/blocked
  against real git clones and worktrees, are covered too.
- Live smoke on this workstation (systemd user manager): a single-binary loopback
  server was started through the real `systemd-run` path. Every check passed through
  the cgroup identity, executable digest, owned loopback listener, exact environment
  names, cgroup caps and lifetime/stop properties. It was then refused at the
  worker-thread envelope, as expected (no actix threads). No `beep-cache-owned-*`
  unit and no listener remained afterwards.
