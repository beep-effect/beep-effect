# Native Unicode HTML preparation and worker transport

HTML builtin dispatch now reads retained native Unicode from the scoped value
owner and sends that storage through `stageUnicode`. Preparation reads source
points directly for XML declaration rejection and HTML wrapper detection. It
validates canonical minimal 1/2/4-byte storage, alignment, point range and UTF-16
size before copying transport bytes. Kind-1 ASCII uses UTF-8, other kind-1 text
uses Latin-1, and kind-2/kind-4 text retains UTF-16LE/UTF-32LE respectively. No
JavaScript projection determines the transport encoding.

The complete worker frame is preflighted before allocation of its transport
buffer. Copying and scans yield cooperatively under the captured Clock and clean
deadline. The worker captures decoded policy durations and uses its existing
admission, owned child-process cleanup and reservation settlement paths. The
private preparation boundary borrows adapter-owned immutable storage; transport
returns a detached copy. The worker ABI, native asset and approved HTML safety
exception are unchanged.

Source issuance now has separate `sourceText`/`sourceUnicode` methods under the
source ceiling. Produced-value issuance retains the intermediate-value ceiling.
A source longer than the output allowance can therefore enter a shrinking
cleaner, while oversized produced values and oversized sources still fail with
the corresponding closed safety error. This owner issues handles; the real
pipeline continues to own reservation charging and closure.

Local validation:

- All 6,412 integrity-bound source snapshots pass native preparation and worker
  frame encode/decode with exact bytes and width preserved. The declaration,
  wrapper, malformed-layout and ambiguous-surrogate controls also pass.
- A complete-frame rejection control proves that control frames fit, while the
  larger input job exceeds the captured message allowance. No process starts,
  and admission returns to zero without quarantine or closing the worker.
- Captured-clock expiry rejects without partial output, even after the caller
  mutates the supplied duration. The final four preparation tests pass in
  2.03 seconds; no native worker executes in this local suite.
- Earlier focused runs passed 16 tests across preparation, existing input and
  protocol, and literal composition; a later 14-test run passed preparation,
  value ownership and literal composition after source admission was separated.
- Server source/test type checking and focused Oxlint passed. Portable source
  and divergence accounting are audited separately from target parity. The new
  evidence Markdown passes; PLAN retains 12 pre-existing line-length findings.

Hosted qualification is pending. The new integration test uses the real worker,
real reservation ledger and explicit native source adapter for all 2,016 source
histories, 6,412 snapshots and 482 expected parser failures. It checks reference
identity, native hashes and OS exit confirmation for the expected 1,025 child
processes. Its explicit 30-second clean/60-second operation policy stays within
existing absolute maxima. The test has no environment skip and is excluded from
unit/coverage tasks; `test:integration` routes it to hosted heavy integration.
It has not been executed locally, following the operator's publication direction.

The trusted fixture adapter and direct callable handles do not prove the still
unfinished general registry/callback/hash protocol. Full target parity, public
service wiring and repository/hosted acceptance remain open.
