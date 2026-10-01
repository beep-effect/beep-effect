# Native provenance and remaining lens review

Source `65755fc9bd` passed full CLI package verification: audit 651.8 seconds,
docgen 23.2 seconds. Its readiness/title changes passed all 75 affected tests
on Node and Bun, authoritative root test types, and the canonical ratchet.

## Native boundaries retained

- Eval scorer: the two real-law cases execute compiler/linter tools against
  physical fixtures and compare processed-file counts, TS2322, noVar, and
  fixture-config isolation. Virtual files cannot substitute for child inputs.
- Metrics: confirmed mirror sync executes physical shell shims and validates
  their command log. The test HTTP sink owns real sockets; all five listener
  shutdowns were independently verified on Node and Bun.
- Tmpfs: cwd, fd, flock, worktree state, and retained bytes are OS subjects.
  Explicit child readiness now precedes reference inspection.

These three EV010 rows are exceptions, not removed test coverage. Corpus
provenance is resolved by the additional control below. Agent command filesystem
promotion is being tested separately and is not included in this native exception
decision.

## Resolved lens findings

- Metrics console isolation uses per-test TestConsole construction; prior
  privacy and empty-output assertions remain (source `f669aba9c7`).
- The metrics explicit-run-selection title now describes the protobuf/span
  export actually exercised, without changing command arguments or assertions.
- Metrics polling was already repaired in #1323 (`4203a309f1`): finite retries
  run on the live clock. The old ledger entry was stale.
- Tmpfs descriptor/flock tests await an acknowledgement emitted after acquisition,
  with a bounded live timeout; spawn completion alone is no longer treated as
  readiness.

Together with the corpus exception below, eight reviewed rows change disposition.
Other human-lens records remain open pending their individual closeout; this is
not goal-wide acceptance.

## Corpus durability control

A private MemoryFileSystem substitution on the current corpus suite produced
four passing and nine failing cases. Failures included physical capacity-probe
cwd access for virtual-only paths and `BadResource: FileSystem.open` on an
archive directory. Production `Preservation.fsyncDirectory` opens that directory
and calls `handle.sync`; publication helpers sync both payload and directory
entries. The native 13-case suite and full package proof pass. The EV010 row is
therefore a native integration exception, not a proposal to emulate successful
durability in memory. The substitution was not applied to repository source.

## Historical evidence still outstanding

The original wave011 review records unresolved historical wrong-error tags for
corpus preservation, without identifying the original failing phase. Its flake
and observability records remain open. Current native test success establishes
the present suite result, but cannot attribute that historical failure. The
private Memory substitution is a separate experiment and does not resolve it.

## Agent command Memory filesystem qualification

All eleven cases now use MemoryFileSystem with the same committed comparison
receipts seeded at their original resolved fixture paths. Node passed all eleven
cases in 3.42 seconds; Bun passed them in 1.73 seconds. Root test types passed
after replacing the synchronous fixture encoder with the Effect encoder. Full
package verification passed: audit 869.5 seconds and docgen 45.5 seconds. The
EV010 disposition will reference the source commit recording this promotion.
