# Exact default diff core

Historical core receipt: the binary below was initially qualified under Node.
The subsequent [Effect-host receipt](2026-11-05-diff-host.md) records a Bun
exception-model finding, the corrected current binary and both-runtime replay.

The pinned source SpanUpdater.get_diff_steps uses fast-diff-match-patch 2.0.1
with timelimit=0, checklines=False and cleanup="No". Its CPython 3.11.15 Linux
wrapper converts Unicode to four-byte std::wstring and returns each original
operation and text length. The PyPI source archive includes the exact C++ header;
the target compiles that header unchanged instead of recreating the algorithm.
The bundled archive SHA-256 is
ec335bbd9780d2182c351b5c486e5c80d8975ea91772eaf02014dfe9e9907a5d.

The authored ABI preserves NULs, non-BMP scalars and literal surrogate points.
The source deadline is disabled; a zero native clock shim cannot expire its
maximum clock value. No OS clock is consulted. WASI exception support requires
both -fwasm-exceptions and libunwind; failed initial link attempts are retained
locally. The final build uses the same authenticated WASI SDK 34 archive as the
HTML kernel, a canonical prefix and a 512 MiB memory maximum. Two independently
extracted clean builds produce identical binaries and receipts. WASM SHA-256:
f6075c21cd7bd6a88c66af53eb07a665b941d7ae6cbc2adaed6f64019d493918;
size 873,066 bytes. Complete upstream source and runtime license texts accompany
the asset; no source-header changes or algorithm approximation are involved.

probe-diff-kernel.py invokes only the original source for expected results.
Its 1,005 cases cover all 225 pairs of binary strings through length three,
768 deterministic independent/edit cases across eight alphabets, and twelve
long ambiguous cases. The alphabets include whitespace, markup punctuation,
embedded NULs, combining/fullwidth text, non-BMP scalars, unpaired surrogates and
literal paired surrogates. A second Python hash seed produces identical bytes.
The fixture SHA-256 is
24470daeb7bbc4b8166867e8071d3a2a85b9a35b4e595c0a0b7c3429a67b0dda;
the producer SHA-256 is
bf50ad197844b344e70de692d8b0bfb142e76e56b28c98b09e20cc6c91927d6a.

The portable verifier authenticates the source/producer/asset/fixture bytes,
checks the closed import inventory, and compares every edit step against both
the new corpus and all 47 default-diff maps in span-offsets.json. All 1,052 maps
and 9,978 steps compare exactly. Each nonempty result is followed by a refusal
at one fewer permitted step, proving no partial/prior result is exposed. Absolute
input/step refusals are checked before reading invalid pointers. The verifier's
60-second process bound is evidence tooling, not production worker lifecycle.

This is default diff-core evidence, not exhaustive annotation or worker proof.
Builtin difflib production, the Effect host/worker integration, effective UTF-16
preflight, message accounting, interruption/deadline and cleanup qualification,
placeholder/emphasis discovery and complete HTML case-name extraction remain
open. Existing Effect RPC, admission and physical retirement ownership must be
reused when connecting this core. No public service or parent-thread invocation
is introduced here. All full-goal accounting, safety and closeout duties remain.
