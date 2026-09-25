# Utils Wave B reconciliation

The saved 59 actionable findings remain represented. Source review credits 25
already-landed rows to `b1aa7e320cde926e7e80a98073ba8b0d517d7c8c` (PR #1200):
23 FileSystem runtime boundaries, one Glob runtime boundary, and the Glob
canonical Vitest import. These are inherited fixes, not Wave B migration credit.

A scoped comparison against the current utils ratchet adds four rows: explicit
layer-hook timeouts in FileSystem, Glob and HostProcess, and the HostProcess
native-service boundary. The native child-process test is an exception because
its subject is evaluating the barrel in a fresh runtime without `process`.
The three layer timeouts are now explicit, but remain open in the ledger until
a fix commit can be cited. No repository-wide census refresh was performed.

## Current proof

- The utils baseline shrinks from 29 entries to six reasoned exceptions. All
  unrelated package entries retain their contents and relative order.
- `bun run beep lint effect-vitest` passes: 1,159 files, 8,653 findings,
  zero introduced findings. Its four other resolved findings are not removed
  as part of this scoped update.
- Full `bun run beep quality package-verify @beep/utils` passes after the
  HostProcess edit: audit 5.5 seconds; docgen 2.5 seconds.
- All 117 utils ledger rows across five files decode with the canonical strict
  finding decoder, including no-findings rows.

The 63 actionable rows currently comprise 25 landed fixes, eight reasoned
exceptions and 30 open rows. The open rows include locally implemented work;
publication, fix-commit references, runner adoption, final timings and hosted
proof remain outstanding. This is not a Wave B completion receipt.

## Pre-integration timing sample

The same Node Vitest JSON-report command now passes 189 tests in 16 files,
compared with 178 tests in 15 files in the saved baseline. Reporter elapsed
span is 604.17 ms versus the historical 1,710.85 ms; whole-command time is
0.981 seconds versus 2.320 seconds. These are not a causal speedup comparison:
the historical sample used Node 22/Vitest 4, and current evidence uses Node 24/
Vitest 5 with changed tests. The source hashes were stable across this run.
CPU, memory and I/O pressure and process limits are retained in the timing
context. Refresh or confirm these hashes after prerequisite integration before
using the sample as final publication evidence.

## Publication checkpoint

PR #1245 publishes implementation commit
`e58f992d4919667cdec08b8f0825a31dd0dcf2a6`. All 30 locally repaired actionable
rows now cite that commit. The complete 63-row actionable ledger has 55 fixed
rows (25 inherited, 30 in this implementation) and eight reasoned exceptions;
no actionable utils rows remain open. No-findings coverage rows remain intact.

All 15 cheap-gate lanes passed before publication. Main was merged to
`220d9426da` before the implementation commit; every recorded timing source hash
remained identical after that merge. The PR was pushed early while prerequisite
heavy jobs were queued. Its own hosted checks and review closure remain pending.
The shared-worker runner prerequisite in PR #1241 still needs to land before
claiming the wider runner topology repaired. Benjamin retains merge authority.
