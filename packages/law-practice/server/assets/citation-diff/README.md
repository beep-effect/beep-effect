# Pinned citation diff core

This private core reuses the unchanged C++ header in fast-diff-match-patch
2.0.1, the default diff dependency of the pinned eyecite source. The complete
source archive and licenses are retained here. It does not use another diff
algorithm as a substitute. `effect/Differ` supplies a patch abstraction, not
this source-specific text edit sequence.

`kernel.cpp` exposes four-byte source-point input and ordered operation/count
pairs. Operation codes are the original DELETE=0, INSERT=1 and EQUAL=2. Input
lengths count Python points, so surrogate pairs and Unicode scalars remain
distinct. `citation_diff_run` returns 0 for complete output, 1 for step-ceiling
refusal, and 2 for absolute count-bound refusal. Refusal clears the published
result count. Native traps publish no result. `citation_diff_release` releases
the retained output allocation. The ABI uses WebAssembly little-endian words.
`citation_diff_required_steps` reports the complete algorithm result count even
when packed emission is refused. The host clamps emission to both the policy
step quota and the exact success-frame capacity before vector allocation.

The source configuration fixes timeout=0, checklines=false and cleanup="No".
The authored clock shim returns zero because the source's disabled deadline is
the maximum clock value. No host clock is read. C++ exception/unwind support is
linked without modifying the upstream header. Memory is capped at 512 MiB.
The compiler explicitly selects non-legacy WASM exceptions so both Bun and Node
accept the same binary; the default mixed exception model was rejected by Bun.

Rebuild with `goals/citation-extraction-engine/ops/build-diff-kernel.py`, passing
the checksum-verified WASI SDK 34 archive, scratch directory and output directory.
The recipe extracts fresh source and SDK copies, uses a canonical build prefix,
and records source, compiler, configuration and binary digests. Two clean builds
currently agree byte-for-byte. Run `python goals/citation-extraction-engine/ops/verify-diff-kernel.py`
from any directory for the sealed portable exact-step and refusal replay.

This core must run only inside an independently stoppable, parent-owned worker.
The private Effect host authenticates a snapshot, validates native input and
effective combined UTF-16, and releases fresh instance allocations through Scope.
The private diff worker connects this host through the existing Effect RPC,
native admission and physical retirement owner. Both runtimes pass source smoke
and deadline/cancellation/quarantine controls; the complete hosted source replay
is pending. Whole-engine accounting and public composition remain integration
obligations. No parent-thread evaluator or complete engine parity is claimed.
