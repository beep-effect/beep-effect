# Graph3D scoped cleanup and native click proof

This is a partial P2 checkpoint, not package migration completion or hosted proof.
The saved inventory remains authoritative; its observability finding stays open.

## Changes and preservation

All five native renderer cases acquire their DOM container and renderer handles
with scoped fallback release. Explicit destroy, repeated destroy and remount
assertions remain. The click case retains its original 60-node fixture and the
negative assertion after programmatic selection. A second one-node renderer then
receives a real Chromium canvas-center click: exactly one callback for node 0 and
selection of node 0 are asserted. The native RAF and GPU subject remain live.

An AST comparison against the parent preserves all 18 original browser expect
expressions and identifies three additions. The pure equivalence case imports
the accepted instrumented tester. Browser cases still use upstream it.live.

## Proof recovered from completed runs

- Final package verification: audit passed in 7.9 seconds; docgen in 3.4 seconds.
- Chromium: five tests in one file passed, reported duration 3.77 seconds.
- Configured Node: one equivalence test passed; 4.507 seconds whole command.
- Configured Bun: one equivalence test passed; reported duration 1.11 seconds.
- Cache projection comparison: only seven graph-3d computation dependency lists
  changed; all other nodes and projection configuration/sources are unchanged.
- Detector completed: 1,163 files, 8,041 findings repository-wide. This is a scan,
  not a claim that its baseline or the migration ledger is closed.

The public timing context records load and pressure without adjusting duration.
The Node sample excludes browser tests. The baseline has different runtime
versions, so this receipt makes no causal performance comparison.

## Remaining prerequisite

Importing the instrumented runner in Chromium fails before test collection:
`NodeAsyncHooks.AsyncLocalStorage is not a constructor`. Normal Node/Bun proof
cannot establish browser support. Phase logs alone do not close L-OBS-01.
A portable context implementation must preserve concurrent and parameterized
runner behavior; a global mutable fallback would not satisfy that contract.

Next: resolve the browser runner prerequisite, update the reviewed scanner and
lens dispositions with exact commit provenance, then publish and complete the
hosted review gates. No root coverage or full proof was requested by this receipt.

## Reviewed dispositions

The implementation commit is `862cd3e2c9254dcdbba3e8db03502409a39811e0`.
Resource L-RES-02 and property L-PROP-04 are fixed with that provenance.
Five EV009 candidates are exceptions because the real browser renderer is the
subject. Five coverage-only rows remain unchanged. L-OBS-01 remains open.
All 13 package rows passed strict EffectVitestFinding decoding.

The ratchet rerun found no new Graph3D candidates, but failed on three inherited
Cosmos EV004 occurrences. Cosmos source is unchanged in this checkpoint; its
recent test-title change invalidated the occurrence identities of three already
reviewed shorter-scope exceptions. Repair their identities in the owning Cosmos
lane and propagate the commit. Do not refresh the repository baseline wholesale.
