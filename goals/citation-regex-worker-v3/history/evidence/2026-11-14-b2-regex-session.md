# B2 stopped at the descriptor depth conflict

Branch `feat/citation-regex-session`, implementation base `7f6718a75ec`.
No B2 implementation was made. The implementation brief requires stopping and
committing a decision when the slice cannot land as designed. The required
descriptor reaches object depth 4; the design and brief require depth 3.

The source references and resolution options are in
[`the stop decision`](../../decisions/2026-11-14-stop-b2-at-the-descriptor-depth-conflict.md).
B2 remains pending. There is no in-review checkpoint or ten-process result.

## Structural probe

A read-only Bun evaluation in the server package constructed the design's v3
job schema from the existing v2 job fields with these overrides/additions:

```ts
const Job = S.Struct({
  ...CitationRegexWorkerJob.fields,
  version: S.tag("citation-regex-worker/v3"),
  sequence: S.Natural,
  descriptor: CitationRegexPatternDescriptor,
});
```

It encoded one job with the Schema JSON codec, using one-byte pattern/source
carriers, zero captures and an empty names record. The fingerprint was synthetic
schema-valid data; no registry binding or regex execution was attempted.
The encoded JSON retained `"names":{}`. The actual shared
`preflightCitationNativeJson` guard, with a property ceiling of 100, returned:

| Maximum depth | Identical schema-encoded job |
| --- | --- |
| 3 | Rejected with the supplied invalid-frame failure |
| 4 | Accepted by the structural guard |

The root-inclusive nesting is Evaluate (1), descriptor (2), profile (3), names
(4). A separate minimal structural probe reproduced the same depth result.
No guard was changed. Accepting depth 4 here proves structure only; it does not
prove the payload's descriptor identity or permit execution.

## Counts

These are the unchanged asserted B1 counts in
`packages/law-practice/server/test/CitationCanonicalFullSpan.fixtures.ts:118-185`,
also reported by the B1 reservation evidence. They were not remeasured in this
stopped slice. The target remains unproved.

| Count per ten plain-text Bun calls | Before B2 | After this stop | B2 target |
| --- | --- | --- | --- |
| Regex evaluations | 291 | Unchanged; not rerun | 291 |
| Regex child processes | 291 | Unchanged; not rerun | 10 |
| Metadata-operation installs | 0 | Unchanged; not rerun | 0 |
| Configuration detaches | 0 | Unchanged; not rerun | 0 |
| Tokenizer builds | 0 | Unchanged; not rerun | 0 |
| Regex evaluator constructions | 0 | Unchanged; not rerun | 0 |
| Regex descriptor bindings | 4 | Unchanged; not rerun | 4 |
| Physical native owners | 10 | Unchanged; not rerun | 10 |
| Native lane unit acquisitions | 10 | Unchanged; not rerun | 10 |
| Diff/Xml worker constructions | 0 | Unchanged; not rerun | 0 |

| Engine construction count | Before B2 | After this stop |
| --- | --- | --- |
| Metadata-operation installs | 16 | Unchanged; not rerun |
| Configuration detaches | 1 | Unchanged; not rerun |
| Tokenizer builds | 1 | Unchanged; not rerun |
| Regex evaluator constructions | 26 | Unchanged; not rerun |
| Regex evaluations / children / descriptor bindings | 0 / 0 / 0 | Unchanged; not rerun |
| Physical native owners | 1 | Unchanged; not rerun |
| Native lane unit acquisitions / Diff/Xml constructions | 0 / 0 | Unchanged; not rerun |

The B1 reservation evidence reports 58.86 seconds for its full-span file,
including construction and Node parity, at load 24.72 / 19.30 / 18.52. There is
no new B2 cohort wall time or latency claim.

## Verification and limits

| File or check run | Result |
| --- | --- |
| `CitationRegexWorkerProtocol.test.ts` via `nice -n 19 bunx vitest run test/CitationRegexWorkerProtocol.test.ts` | 14/14 pass; file duration 6.52 seconds |
| Schema-backed depth probe | Encoded names preserved; depth 3 rejected, depth 4 accepted |
| Minimal structural depth probe | Depth 3 rejected, depth 4 accepted |
| `bun run beep goals decisions write --slug citation-regex-worker-v3` | 15 decisions, 0 invalid, 0 remaining drift |

The eight required B2 real-process proofs were not implemented or run:

| Required proof | Bun child | Node child | B2 test name |
| --- | --- | --- | --- |
| Catastrophic pattern deadline, responsive parent, confirmed death before return | Not run | Not run | Not implemented |
| Later job fails closed without spawning | Not run | Not run | Not implemented |
| Wrong sequence kills | Not run | Not run | Not implemented |
| Early EOF kills | Not run | Not run | Not implemented |
| Oversize frame kills | Not run | Not run | Not implemented |
| Frame while idle kills | Not run | Not run | Not implemented |
| Interruption during Sent kills | Not run | Not run | Not implemented |
| Interruption during Running kills | Not run | Not run | Not implemented |

No production or test file changed. Accordingly, no server typecheck, quick
package verification, lint:laws, Fallow audit, docgen, Effect Vitest inventory,
schema-first inventory, source Oxlint, other Citation file or canonical replay
was run in this stopped slice. No whole suite, coverage, hosted CI, remote proof,
push, PR, rebase, stash, broad staging or subagent was used. All test processes
finished before handoff.

No by-design behavior change was made. Interpreting the mandated depth as 4,
flattening the descriptor or changing the shared depth convention would depart
from the explicit contract; none was done. The owner must resolve the contract
before B2 resumes.
