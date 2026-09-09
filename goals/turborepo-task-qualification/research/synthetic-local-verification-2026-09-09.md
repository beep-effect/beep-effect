# Synthetic local experiment checkpoint: 2026-09-09

`bun run beep cache synthetic --request <contained-request.json> --output <receipt.json>`
runs the Cache-owned local fixture. The request pins a native client by exact
version and SHA-256, selects stable or canary, and names its isolated namespace.
No local fixture result promotes a qualification tuple.

## Runtime boundary

The runner allocates exclusive temporary fixture directories beneath
`.beep/cache/experiments/` and removes them on success, failure, and interruption.
They contain a generated dependency-free Bun workspace, not a checkout or
package installation. The existing one-token admission lane owns subprocesses.
Each process runs through the shared StepExec timeout and capture machinery,
with a 30-second deadline and a 64-KiB character capture cap plus an encoded-byte
overflow check. Original task logs have a bounded 256-KiB read ceiling; captures
over 64 KiB are rejected for comparison. Summaries are capped at 1 MiB.

The Linux bubblewrap sandbox exposes read-only system tools and the two pinned
executables, a private proc/dev/tmp environment, and one writable fixture root.
Its network namespace is isolated. Request JSON is limited to 64 KiB and
contained regular files. Each native executable read is limited to 128 MiB
through the shared no-follow byte reader, which rejects non-regular files. Environment variables come from an explicit
non-secret map; it never receives Turbo API, token, team, or signing credentials.
The raw generated task logs and local artifacts disappear with the fixture scope.
Only versioned digests and derived outcomes leave it.

## Observed local matrix

Exact stable `2.10.12` and exact canary `2.10.13-canary.1` each completed
16 executions and passed 12 assertions:

- Independent fresh roots, using different guest paths, produced equal results.
- A local hit restored the deleted output tree and task log.
- A passed-through orchestration variable preserved the hash and local hit.
- Declared semantic environment and file changes invalidated the result.
- Root and child configuration changes independently invalidated the result.
- Two concurrently executing isolated roots matched the fresh reference.
- Synthetic secret and absolute task-path captures were rejected.
- An oversized capture was rejected even though the task exited successfully.
- A failed task executed again and could not pass output comparison.

Output comparison binds the checked two-file tree, relative paths, permission
bits, and contents. The task stream is compared separately without text
normalization. Only the exact Turbo summary-location line is removed from
orchestration capture before the path probe; task diagnostics are retained.
Normal failure diagnostics also exposed a guest path and were rejected.

The compact [stable](./synthetic-local-stable.json) and
[canary](./synthetic-local-canary.json) JSON receipts contain no home paths or
raw logs. The [checkpoint](./synthetic-local-checkpoint.json) binds the current
source files and both receipts by SHA-256. Final hardening reruns passed for
both clients after scheduler admission.
The fixture digest identifies the generated manifest, lockfile, configuration,
shell wrapper, task script, input, and ignore bytes. Native binaries are checked
before and after the experiment.

## Verification and remaining obligations

Focused comparison/capture tests passed (5 tests). Direct CLI probes rejected
oversized, invalid-UTF-8, and symlinked request files before admission.
Docgen passed all 1,535 examples after repair; source type checking is included
in that proof and in the final full package rerun.
The first full CLI package audit passed (352.2 seconds), while docgen
failed on two newly introduced malformed alias comments. Those comments
were corrected and the inbox item was acknowledged to this task. The final
full package rerun passed after the hardening edits: audit 357.0 seconds,
docgen 17.9 seconds. No synthetic temporary directories remained after
completion. The final check is the package proof for this checkpoint.

This proves a bounded local synthetic subset. It supplies no signed remote
replay, real-pilot comparison, shadow decision, or promotion credit. The real
identity lint tuple remains excluded at ledger revision 1. Missing-script
execution, lockfile/runtime perturbations, the real-pilot repair and full matrix,
and accepted sibling conformance/trust integration remain work in progress.
The existing census tests already reject absent and blank executable scripts;
those tests do not replace the missing synthetic runtime case.

The read-only policy audit remains at zero blocking findings and 927 legacy
unassessed cached computations. Goal doctor has zero blocking findings and
four inherited advisories; exploration checks have zero findings. The launcher
is 2,755 characters, and the checkout passes `git diff --check`.
