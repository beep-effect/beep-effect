# P1 sealed engine-failure diagnosis — 2026-10-10

Attribution: engine defect in attachment second-pass reuse, rather than corrupt
input or an unavailable sandbox. The sealed run is retained unchanged.

The failed attempt recorded 33 attachment dispositions: 11 repaired and 22
unsupported, with 11 repair copies and 11 Tika children retained. The next
attachment in the runner's sorted traversal has SHA-256
`b2787c050ad43d05ded4f72d8ce4c7bf49ace11b8b766baccf6cd5c82899cf52`
and 246,088 bytes. Its repair copy and Tika evidence already exist from a
previous occurrence of the same digest. No twelfth copy was written.

Two read-only invocations using the runner's exact Tika sandbox both exited 0.
Their normalized output measured 42,805 and 42,813 bytes, with digests
`2e0c851282e1f929ebd9d25cb2711c95953d2187ce184ff2ffb9b1a6e9761708`
and `6450a54fa0738f197552bebf352427140bd216645466934a8196d2da83c1053c`.
Neither matched the retained evidence. The only differing JSON field was
parser duration; extracted content was identical. No corpus content or metadata
values were printed or stored by the diagnostic script.

`repairDetectedAttachment` reused the content-addressed repair copy but invoked
Tika again. `persistAttachmentText` then required the second JSON result to equal
previously retained bytes, although Tika includes volatile parser-time metadata.
The exception boundary deliberately replaces the underlying error with a generic
`engine-failure`, which accounts for the sealed ledger's limited explanation.
The root cause is reproduced by a synthetic duplicate-attachment fixture whose
parser output varies on each invocation: the unmodified runner seals an
unapproved failure. With reuse of the first retained evidence, it passes with two
repair occurrences and one Tika child.

The fix retains the first successful second pass for each attachment digest in
one attempt. Reuse checks canonical containment and rejects empty evidence;
existing repair-copy digest verification, cumulative capacity limits, final
child hashing, and family acceptance remain enforced. It does not alter Tika
output, widen a path schema, approve an exception, or mutate an old run.

Reversal: close the engine-fix PR and revert the fix; retain both immutable run
directories. The fresh ledger is authorized by the orchestrator's run-4 ruling
and must use the same source and ceilings. P1 remains in-progress until that
fresh slice reconciles and seals successfully.
