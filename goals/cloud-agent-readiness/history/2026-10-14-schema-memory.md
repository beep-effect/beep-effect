# Schema-first memory ownership — 2026-10-14

Schema-first uses cross-file symbols, inherited data members and wrapper origins,
so a syntax-only single-file replacement would weaken its checks. At eb88285357,
the scan retains one semantic project for active production roots and relevant
ambient declarations. Imported dependencies resolve normally. Descendant node
wrappers are released after each completed production source.

Arbitrary test coverage remains complete in a separate syntax-only pass that
loads/checks/forgets each file. Test roots therefore do not seed the production
semantic program. LiteralKit const assertions are collected during the existing
production walk instead of building a second complete project. The public
makeSchemaFirstProject adapter is unchanged; the inventory orchestration owns
this bounded path.

All 91 schema-first tests pass. New regressions verify barrel symbol resolution
after descendant release, ambient inheritance, and arbitrary-coverage findings
from a test file outside the semantic root set. Package quick lint/type checks
and commit hooks pass.

## Worker measurements

An initial cache-release-only probe passed at 152.10 seconds with a 6.7G service
peak. That leaves insufficient room for parent-process overhead, so it was not
accepted as the final worker repair. The final phase-separated scan passed in
107.50 seconds, max RSS 6,149,228 KiB and service peak 5.8G, zero swap. The full
findings plus 3,698-file scanned report are byte-identical between the two
successful probes (SHA-256 f860ffa90f7f7ca654947cec837bfe890a18ec05855c5f23fffa66b13534416b).
Both reported 123 live/tracked entries, no missing/stale entries, no enforced
candidates and a clean parity ratchet. No inventory rewrite or exemption was
needed.

[Sanitized receipt](../research/2026-10-14-schema-memory.json) preserves these
measurements. The direct scan ran under the unchanged 7 GiB soft / 8 GiB hard /
256 MiB swap / two-CPU slice with a three-minute ceiling. Probe source was
checksum-verified, restored only at its owned patch path and fast-forwarded to
the committed source before detached rerun. Existing readiness configuration
edits were hash-preserved. The clean probe then submitted a real detached cheap-gate job at eb88285357,
with one lane and the unchanged ten-minute runtime ceiling. Import-law passed
in 97.13 seconds, then schema-first passed in 117.12 seconds with the same 123
live/tracked entries and clean parity ratchet. The whole proof service peaked
at 7,497,584,640 bytes, just below the 7 GiB soft threshold. Captured schema-first
pressure averages were zero; memory dropped below 1 GiB after the gate. This is
one measured acceptance run with little soft-limit headroom, not qualification
for concurrent proofs or future corpus growth.

Effect/Vitest, allowlist and dead-code gates also passed. Fallow audit reported
two introduced complexity findings against origin/main: readLocked in the earlier
detached-recovery implementation and bindingProblem in the earlier model-policy
work. Neither finding belongs to this scanner memory repair. One inherited
JSDoc titleSuggestionProblem finding was nonblocking. These are explicit branch
quality closeout items, not exceptions or a green verdict.

The deadline interrupted the final fallow:health check. Normal finalization
preserved timeout, exit status 130 and invocation identity, published the record
and job wait returned 3. No MemoryHigh relief, reset-failed or manual job edit
was needed. The complete cheap-gate tier remains unfinished; raising its deadline
should follow resolution of the known audit findings, not hide them.

Raw job logs, inbox/ack records, attempts and Turbo summaries were archived on
the worker in ~/.cache/beep/schema-memory/evidence.tgz and compared against the
originals before removing the owned clean probe worktree and branch. Direct
probe logs remain beside the archive. Host available memory returned to about
10 GiB. Eight existing readiness configuration edits were hash-preserved. No
push, PR, publication, heavy proof or reboot qualification occurred.
