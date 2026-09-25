# Local stable and canary matrix v23

Date: 2026-09-25. Authority: **local observation only**. This receipt grants no
qualification, live cache activation, or signed-remote acceptance.

The frozen source revision is `ed2742ff4ff0c837e01df0cc38b452762c9a4d89`.
The candidate is `@beep/identity#lint`, reuse layer `turbo-task-result`, profile
`local-linux-x64-bun1.4.2`, epoch `qualification-v2`.

## Observed results

Both channels completed with exit 0. Each report contains 67 observations,
40 passing checks, and 10 equivalent shadow decisions with their input
expectations met. The runs cover fresh pairs, local replay, concurrent fresh
execution, absolute-root variation, declared environment variants, source and
configuration mutations, failed-source non-reuse, and non-execution cases.

- **stable**, Turbo `2.11.3`: report SHA-256
  `26d91819a03e3e55d903d0f727fb4ffdcb415aaf5f404dfedd4e26ec620472e5`; runtime-key digest
  `15532ffdb972123043bd0435d7d2c56dc5fecd1f2c8070b68da62496ca6c7695`.
- **canary**, Turbo `2.11.5-canary.2`: report SHA-256
  `923f636104b4055affa1fdbaf0ba3f1d596c2f2a88a676c4e8010424e2f647be`; runtime-key digest
  `21b8edb88fdee1096afa2fcb946ad1173a57a461d4a22388101317447af28783`.

The independent receipt reviewer reconstructed the runtime keys and checked
report relationships, including cache origin, log-byte digests, mutation
invalidation, and non-execution outcomes. It rejected altered loader and Git
exclusion inputs. These are receipt checks; raw archive validation and signed
transport validation remain explicitly false.

The v22 formatting divergence was resolved by preserving the disabled
configuration's formatting while changing the cache boolean. Stable and canary
v23 both used that correction. This does not justify accepting arbitrary
configuration changes or treating a failed computation as reusable.

## Retained evidence and limits

Private reports are retained as `stable-report-v23.json` and
`canary-report-v23.json` in the frozen runner's ignored qualification runtime
directory. Private evidence archives retain the reports and their input
receipts. The independent review is retained as
`v23-reconstruction-stable-canary.json`. Report hashes above were rechecked
when this compact receipt was authored; raw traces and workstation paths are
not published here.

Current native I/O observation completed with exit 0. Dependency and full
toolchain identity matched before and after execution. Independent read and
write reviews verified retained stream and compressed/expanded trace hashes.
The trace contains 439 repository read paths; only `.git` is outside the current
native task-input map. All 21 explicit scalar writes were attributed: two to
captured stderr, eleven to pipes, five to Unix sockets, two to the null device,
and one to an event descriptor. No positive scalar read lacked a descriptor
annotation, and no nonempty read buffer was retained.

Five successful ring setups and five ring entries remain uninterpreted. The
absence of vectored I/O in this execution and complete scalar-write attribution
do not establish hidden ring contents, all possible reads, or semantic closure.
The 14-file private backup was copied and hash-verified, including the compressed
trace and original streams; it totals 8,194,442 bytes.

A separate input review verified all 802 unique native input blob hashes against
the archived source mounted by the observer (850 task/input associations across
the four lint tasks). The current trace adds eleven repository read paths over
the historical trace, all in the expanded fc-runs/test-runner dependencies and
all covered by the current input map. No historical repository read path is
missing from this observation. This is source-byte and membership evidence,
not a claim that every possible semantic input was exercised.

Archived-source input-review SHA-256: `e5470428dee1212004c201488a45cb2a51aeb82ab89deb4e8c9f42c34c478fa6`.

Trace receipt SHA-256: `c081250ae4deedf32b15f4b85b253372502f2ee3ea881551b34304e3892c6218`.
Read-review SHA-256: `367b59169c76028b1109f6d3ed4c1a5b84a0c87ef2ceea2415c142d0d0ef2705`.
Write-review SHA-256: `353bd38a801d28c1a211b2f2fec93049d06078a9283605da0a1b97a292afbf5e`.

Remaining acceptance work includes semantic input and capture closure beyond
the bounded observations above, current-head validation of the
implemented ordinary-entrypoint runtime-key enforcement, accepted signed remote
comparisons,
census closure, adoption handoff, and the final goal closeout requirements.
The successful local matrices do not discharge those obligations.

## Current synthetic capture controls

Both exact clients passed five native capture observations after the disposable
fixture excluded its generated `.turbo/` logs. Independent retained-byte review
verified the fresh/local-hit origins, stable replay task hash, stream digests,
and actual carriage-return, invalid UTF-8 and oversized payload bytes. The
production parser accepted fresh and local-replay text with identical payloads,
and rejected all three unsafe cases for the expected reasons. Turbo prefixes
text after carriage returns; the byte review checks that observed framing while
still requiring the unsafe original byte.

The capture service verified the complete toolchain and retained dependencies
before and after execution. A 46-file private backup was copied and hash-checked
(194,194 bytes). Stable observation receipt SHA-256:
`3ba427a77ecf5f43cbbe858ae2df40b862046aaeb1a7d0492058cb4314147147`.
Canary observation receipt SHA-256:
`447e4c0037c55eee5000c3af95ef3fe36e2b1f1e7e3897f7905caa6c45c8ec8b`.

These controls establish local capture behavior only. Neither these controls
nor a single matching replay establishes deterministic stream ordering or
signed remote acceptance.

## Mixed-stream repetition: observed divergence

Ten fresh cache-bypassed executions per exact client retained one task hash
but produced two distinct selected-log payloads. The intended stdout lines
were always present and ordered relative to each other; `task-stderr` appeared
either before or after those lines. Bun's `$ python3 emit.py` command line
was also retained. Stable produced the stderr-first order six times and the
stderr-last order four times; canary produced those orders four and six times.
Independent review verified all forty stream digests, twenty native summaries,
local/remote cache bypass, and the two selected payload digests:

- stderr first: `f91c3b27df839e6b13b5fadbd8db3def5ab053d5df8f3ca18069cb6d04fa677e`
- stderr last: `d318038b0d6d0ebaaf3d6fde048bca284a1d82f43fd86e0a0b89d7ac1d752a6e`

The admitted service exited zero after dependency and complete toolchain
verification before and after the observations. A hash-verified private archive
retains seventy files (103,771 bytes), including the failed reviewer attempt,
corrected script, service logs, native summaries and raw streams.
Independent-review SHA-256:
`72d00748f29263164b4675c62f4967a0f56ec101a4c43ec79fa3c7d8dbe72240`.
Archive-manifest SHA-256:
`842981dbabb582140a2d0ff684af8ea1e98b398dff273045f7bc875e5b84aeb1`.

This fixture is ineligible for exact-log determinism. Do not sort or discard
lines to hide the divergence. The result does not establish divergence for
the quiet real lint pilot; that pilot retains its separate matrix and must
satisfy its own log contract. No reuse was enabled by this experiment.
