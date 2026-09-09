# Native local pilot verification

The durable `beep cache pilot` command passes the initial real-lint matrix and
ten varied local shadow decisions on each exact client. This is local evidence
for `@beep/identity#lint`, `turbo-task-result`,
`local-linux-x64-bun1.4.2`, `qualification-v2`. It does not qualify the tuple.
Identity and its types dependency remain cache-disabled and excluded in the
live checkout.

| Client | Observations | Passing checks | Local shadow decisions |
| --- | ---: | ---: | ---: |
| Stable 2.10.12 | 43 | 28 | 10 |
| Canary 2.10.13-canary.1 | 43 | 28 | 10 |

The [stable receipt](./pilot-local-stable.json) and
[canary receipt](./pilot-local-canary.json) bind exact client, Bun 1.4.2 and
Biome 2.5.6 executable hashes. Inputs come from two registered, clean worktrees
at commit `4f96c4b1f87fb7fc6af9f737128b8083df287f48`. Observer implementation
changes are separately bound by the current entrypoint attachment and
[checkpoint](./pilot-local-checkpoint.json); that commit identifies the input
worktrees, not an already committed observer implementation.

The activation input was a private byte-identical copy of the
[reviewed preview](./ignore-repair-activation-preview.json). The checkpoint
includes the public reference so those input bytes remain available. The
runner validates the preview against current source, exact tool hashes and
versions, linked-worktree identity, and native dry-run inputs/configuration.

Each client covers three isolated fresh/fresh pairs, local producer/replay,
concurrent fresh runs and an alternate absolute root. Each shadow case has a
fresh cache-disabled authoritative run, an enabled producer, and a replay in
the second worktree using only that scenario's copied local cache.

| Shadow input | Expected task-hash behavior | Result on both clients |
| --- | --- | --- |
| Baseline | Stable | Pass |
| Comment in an existing source file | Changed | Pass |
| Added source file | Changed | Pass |
| README content | Changed | Pass |
| Declared environment value | Changed | Pass |
| Empty declared environment value versus absence | Changed | Pass |
| Orchestration metadata with a synthetic canary | Stable | Pass |
| Locale | Stable | Pass |
| Timezone | Stable | Pass |
| Alternate absolute root | Stable | Pass |

Successful selected-task logs are exactly 53 bytes. Disabled, producer and
replay captures agree after removing only the first exact native Turbo
progress line. Later progress-like task text is preserved. The syntax-error
control fails twice per client, with both executions fresh and matching
138-byte captures. Failed task results are not credited as successful shadow
decisions. Every observed package source tree remains unchanged.

The [invocation controls](./pilot-pin-negatives.json) reject eight cases for
their intended reasons without creating receipts: wrong Turbo content pin,
wrong Biome binary, Bun 1.4.1 against the 1.4.2 pin, mismatched client channel,
two aliases of one worktree, the caller checkout used as a source, stale
activation evidence, and an older worktree revision. A preceding wrapper
timeout is excluded from these results. The retained diagnostic logs stay
private; the public controls contain only expected messages and hash references.

The runner mounts source, tools and Git metadata read-only and isolates the
network. Task logs/cache and disposable namespace storage are writable.
Native summaries and temporary cache/source overlays are discarded when the
scoped experiment ends; receipts retain decoded observations and digests.
These bounds and source snapshots do not substitute for a complete syscall
read/write inventory or the remaining capture-adversary controls.

The current census has 142 workspaces, 2,840 graph nodes and 1,480 executable
nodes. Its accepted attachment binds 285 source files, six complete snapshots
and one authored review, with six explicit unresolved obligations. Refreshed
CI/Quality, Yeet and workflow snapshots match the previous parsed documents;
the command grouping changes only its census digest. Policy audit reports
zero findings and 928 inherited cached computations still unassessed.

CLI typecheck, schema-first inventory verification and full package audit/
docgen pass. The full package gate records 431.7 seconds for audit and 18.5
seconds for docgen. A final documentation-only correction then passes docgen
again across 239 modules and 1,561 examples.

Still required: remaining root/child configuration, lockfile, generated-alias
and absent-script controls; complete semantic read/write and capture coverage;
accepted signed sibling evidence and direct remote comparisons; dynamic
entrypoint/external-verdict review; adoption handoff; and final Yeet proof,
reviews and same-PR reflection/lifecycle closeout. No live cache activation or
qualification transition is made by this checkpoint.
