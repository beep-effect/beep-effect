# Worker Graft resource guards — 2026-10-14

## Installed behavior

The operator requested persistent guards after the aggregate reference check
filled worker RAM/swap. Ordinary PATH-based `graft` now resolves to
`~/.local/bin/graft`, a wrapper around the intact native Graft 0.21.1 CLI.
The vendor entrypoint is recorded in the mode-0600 file
`~/.config/beep/graft-guard/vendor-path`; it currently points into the Node
24.21.0 installation. Reconcile that path when changing the Node installation.

Every graph command runs in its own collected user scope under the shared
`beep-graft.slice`. Concurrent Graft commands share the following combined
budget rather than each receiving an independent allowance:

| Shared slice setting | Effective value |
| --- | --- |
| MemoryHigh | 6 GiB |
| MemoryMax | 8 GiB |
| MemorySwapMax | 256 MiB |
| CPUQuota | 200%, up to two CPU cores across the slice |
| TasksMax | 128 |

Each command scope also has MemoryMax=8G, MemorySwapMax=256M and OOMPolicy=kill.
Finite commands have a ten-minute scope deadline, 15-second stop timeout and an
outer timeout backstop. MCP/viz retain their server lifetime under the shared
resource ceiling. Simple help/version forms directly invoke the native CLI.
The wrapper removes SSH_AUTH_SOCK and applies a process-local 6 GiB Node heap
limit without changing the global shell or vendor installation.

The guard derives the user runtime/bus address when maintenance subprocesses
receive only HOME/PATH. If the user bus or slice configuration is unavailable,
graph execution refuses with exit 69. There is no unbounded fallback.

## Reproducible assets and deployment

- [Wrapper source](../ops/graft-worker-wrapper.sh), installed mode 0755 at
  `~/.local/bin/graft`.
- [Slice source](../ops/beep-graft.slice), installed mode 0644 at
  `~/.config/systemd/user/beep-graft.slice`.
- Captured the original native entrypoint before installing the wrapper;
  both destinations were absent. Reloaded the user manager. No root action,
  recurring timer, vendor patch or service restart was needed.

## Verification

1. Bash syntax and whitespace checks pass. PATH resolves the wrapper; native
   version output remains 0.21.1 and build help succeeds.
2. `env -i HOME="$HOME" PATH="$PATH" graft check .repos/effect --json`
   succeeds from the worker checkout. This tests the canonical maintenance
   environment, bus derivation and guarded native execution. The graph is fresh.
3. While that command was active, user-systemd reported the intended shared
   slice, RuntimeMax=10min, TimeoutStop=15s and OOMPolicy=kill. Kernel cgroup
   files independently reported scope and slice memory.max=8589934592,
   memory.swap.max=268435456, scope memory.oom.group=1, slice
   cpu.max=200000/100000 and pids.max=128.
4. A graph command with an unavailable XDG runtime directory refuses with
   exit 69 and the bounded-execution diagnostic. Version output still succeeds.
   Changing DBUS_SESSION_BUS_ADDRESS alone did not make systemctl unavailable;
   the initial test used that ineffective condition and is not refusal proof.
5. An owned `graft mcp` scope starts with the memory ceiling and infinite
   RuntimeMax, validating the long-lived branch. Stopped that exact scope and
   confirmed the owned process exited. MCP protocol/tool requests remain a
   separate qualification; an active scope alone does not prove them.

The initial probe rejected MemoryOOMGroup before Graft execution. Installed
systemd scope documentation and a small probe established OOMPolicy=kill as the
supported route; the deployed wrapper uses it. No deliberate OOM stress test
was needed to verify the installed kernel limits.

## Boundaries and rollback

The guard protects PATH-based Graft entrypoints, including repo maintenance
commands. Explicit native-binary calls bypass the wrapper; inventory any such
configured MCP/hook entrypoints during their separate qualification. The shared
budget constrains Graft, not all worker processes. It does not fix Alchemy's
generated-file parsing failure or establish full aggregate/deep coverage.

For rollback, first wait for or stop only owned Graft scopes. Preserve the
wrapper, vendor-path file and slice if later edits need recovery, then remove
the managed wrapper and slice and reload the user manager. PATH will resolve
the original nvm-installed CLI again. Do not stop the shared slice while another
owner has an active command. No reference clone or graph needs deletion.
