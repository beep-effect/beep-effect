# P0f round 1 input acceptance

Status: input assembly accepted; adversarial verdict pending.

The Codex CLI corpus assembler completed successfully. Root independently
checked all 282 copied snapshots against their manifest and live source, all
132 references, 13 generated artifacts, exactly 20 unique test samples across
17 owners, and the five upstream helper files recovered at the exact rc.112
commit. The five missing-input paths match the supplement exactly; no missing
mandatory body remains. No test or adversarial verdict is inferred from hashes.

The corpus manifest SHA256 is
`eac5a3b2770af59ae3abcea745e284d936b56e460f5a5b311e511e6d36b8b39c`.
The five-file reference supplement manifest SHA256 is
`1124b9beabfa4f339cf4cc2c9c9bdf1a5bc71c845a436314ef1e776870ef807a`.
Both input sets remain read-only under the private goal cache.

Root corrected stale README/PLAN/manifest progress prose after accepting the
sealed source corpus. A separate three-file status addendum retains the current
packet text and hashes. Its manifest is linked by the private acceptance receipt.
The source corpus remains unchanged, D1-D14 are unchanged, and the reviewer is
told exactly which packet snapshots the addendum supersedes. PR #1047 was merged
by Benjamin; the separate P0g ratification/merge gate remains required before P1.

The Grok prompt includes all three immutable input sets, requires complete
proposed-code and 20-sample review with targeted reads of large reference
modules, and permits writes only to the round 1 JSONL and prose reports.
The supervisor refuses an existing handle or changed accepted manifest. No
round is accepted merely because a process exits successfully; coverage and
finding disposition remain Root's gates.
