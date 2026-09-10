# Installed lint executable mappings

One fresh installed identity lint command passes with its ordinary launcher
chain intact. A pinned strace observer records `execve`, `mmap` and `mprotect`
events with descriptor paths. The 185,160-byte trace stays below its 8 MiB
bound, and every unfinished syscall has a corresponding completion. The
admitted wrapper verifies the retained installed tree and current observed
toolchain before and after execution. This is local runtime inventory, with
no cache-replay, signed-remote or qualification authority.

The [machine-readable review](./installed-executable-mappings-review.json)
binds the raw receipt, trace, observer, wrapper and verification log. Nine
successful exec events reproduce the Bun, Bash, installed Biome launcher,
Node, shell, `ldd` and installed native Biome chain. Failed PATH attempts
receive no successful-execution credit.

## File-backed executable mappings

Eight files have successful `mmap` events with `PROT_EXEC`. Their current
backing-file hashes are retained as post-run observations:

| Guest path | Mapping events |
| --- | ---: |
| `/usr/lib/libc.so.6` | 9 |
| `/usr/lib/libdl.so.2` | 4 |
| `/usr/lib/libgcc_s.so.1` | 2 |
| `/usr/lib/libm.so.6` | 4 |
| `/usr/lib/libncursesw.so.6.6` | 4 |
| `/usr/lib/libpthread.so.0` | 4 |
| `/usr/lib/libreadline.so.8.3` | 4 |
| `/usr/lib/libstdc++.so.6.0.36` | 1 |

The current toolchain snapshot binds executable and installed-tree bytes,
the shell/helper sources and a libc version observation. It does not bind
these eight system backing files by content. Their post-run hashes identify
the inspected files but do not prove unchanged bytes throughout execution.
The next runtime identity change must resolve the actual loaded targets,
bind their bytes before execution and verify them afterward. Kernel-created
executable/interpreter mappings remain outside the traced mmap inventory.

## Executable memory and asynchronous I/O

Two successful executable `mprotect` ranges fall inside a prior anonymous
reservation made by the same Node thread. The review retains the correlated
trace lines and sizes without publishing process ids or memory addresses.
The trace omits other memory-transition operations, so this correlation does
not establish a complete memory history or explain generated code semantics.

Ten successful mappings reference `anon_inode:[io_uring]`. They establish
mapped ring presence; they do not prove submissions, reads, writes, network
activity or successful I/O outcomes. A read/write audit of the installed
command must observe actual asynchronous operations, alongside ordinary
syscalls. Earlier source-fixture traces without the installed Node launcher
cannot supply that coverage.

The stable/canary v5 matrices remain valid local comparisons under their
recorded toolchain identity. This additional inventory grants no live reuse
or tuple promotion. System-file binding, complete runtime/read/write/capture
evidence, ordinary entrypoint enforcement and signed sibling integration
remain required.
