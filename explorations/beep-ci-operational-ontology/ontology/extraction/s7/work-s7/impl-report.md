# S7 CI-ops Projection Implementation Report

## Outcome

The S7 lane now provides a schema-first, deterministic admission projection,
an Effect service with a transactional live shell, canonical Turtle emission,
and strict differential replay against the frozen S6 journal. The replay passes
all 41 recorded admissions after one journal-grounded inferred dead-lease
eviction. The frozen S6 inputs were read only and were not regenerated.

## What was built

The implementation follows the binding design order: schemas, service
contract, pure engine, replay, then property and integration tests.

| File | Responsibility |
| --- | --- |
| `apps/labs/ciops/src/projection/Schemas.ts` | Schema-first policy, request, ledger, proposal, journal-event, planner-seam, and typed-error models. |
| `apps/labs/ciops/src/projection/AboxPolicy.ts` | Strict decoding of all ratified admission parameters and weights from the frozen S6 A-Box Turtle bytes. |
| `apps/labs/ciops/src/projection/CiOpsProjection.ts` | `Context.Service` contract, v2 planner seam, and `TxRef`/`TxQueue` live shell around the pure projection. |
| `apps/labs/ciops/src/projection/Engine.ts` | Deterministic canonical ordering, policy/ledger validation, capacity and review-fix-cap admission, and explicit deferred tail. |
| `apps/labs/ciops/src/projection/Turtle.ts` | Byte-deterministic schedule A-Box serialization with ratified and provisional vocabularies kept separate. |
| `apps/labs/ciops/src/projection/Replay.ts` | NDJSON decoding, ledger reconstruction, strict first-choice comparison, inferred phantom-grant eviction, diagnostics, and evidence rendering. |
| `apps/labs/ciops/scripts/generate-replay-evidence.ts` | Frozen-input replay entrypoint that writes the generated evidence and fails through `requireReplayMatch` on non-empty mismatches. |
| `apps/labs/ciops/test/projection.test.ts` | A-Box decode assertions, properties 1 through 5, exact frozen replay expectations, and the transactional wrapper/planner-seam test. |
| `apps/labs/ciops/test/health.test.ts` | In-memory Fetch-compatible `GET /health` contract test without opening a socket. |
| `explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md` | Generated PASS evidence with the inferred dead-lease eviction census. |

The package test runner uses Vitest's thread pool because fork workers could
not initialize in the managed execution environment. The health contract uses
`HttpRouter.toWebHandler`; `ApiLive` provides
`BunHttpServer.layerHttpServices`, following the existing labs pattern, so the
test exercises the real router without starting a dev server or binding a
port.

## Reuse decision

The deployed request and journal shapes were evaluated for direct reuse from
`@beep/repo-cli/test/RepoRun`. That path is a source-only test-kit export:
`packages/tooling/tool/cli/package.json` exposes `./test/*` in the workspace
source map but sets the test exports to `null` in `publishConfig` and excludes
the test sources from published files. The lab therefore mirrors the narrow
journal and request views it needs instead of coupling production-like S7 code
to a non-publishable test-kit surface. The mirror remains schema-decoded and is
covered by the frozen journal replay.

## Deviations and caveats

- `originKey` substitutes for the redacted pid component in the canonical
  tiebreak. The journal preserves `originKey` but not the deployed raw pid.
- Origin-already-leased and blocked-on-origin-stamp skippability are not
  modeled. Origin stamps and active-grant origin keys are absent from the
  journal/ledger view. Neither condition affected any first choice in the
  frozen golden journal.
- The starvation bound is interpreted at a single projection instant.
  Deferrals are lawful holds at that instant; temporal starvation is a
  cross-instant property deferred to the lane-DAG planner seam.
- The v2 lane-DAG planner remains an explicit typed
  `PlannerNotImplementedError` seam. S7 does not implement `Graph.topo` or
  replace the deployed scheduler.

## Differential replay adjudication

The initial replay reported six first-choice divergences at zero-based journal
event indices 66, 68, 71, 73, 75, and 78. The common reconstructed charge was
grant nonce `1813f29f...`, weight 5, admitted at event index 20 and never
released anywhere later in the journal. Retaining that charge made the six
recorded admissions appear infeasible. Removing it made every admission
exactly feasible under `activeTokenTotal + weightTokens <= capacityMaxTokens`;
each divergent instant had exactly one pending request, and the projection's
first choice then matched the recorded grant.

This is journal censorship, not a projection or deployed-invariant failure.
The deployed scheduler's dead-admission reaper uses pid plus `/proc` start-time
liveness without writing a corresponding journal release in
`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`.

Replay now precomputes admitted nonces with no later release. Immediately
before a recorded admission that is infeasible against the reconstructed
ledger, it evicts active members of that provably phantom set in oldest
admission order, one at a time, until the recorded transition is feasible. An
eviction removes the nonce's weight and review-fix membership and appends an
`InferredLeaseEviction` census row. If phantom candidates are exhausted while
the transition remains infeasible, the existing strict mismatch path remains
in force. Evictions are findings, not failures: `passed` remains exactly
`mismatches.length === 0`.

The frozen result is one inferred eviction at event 66: nonce `1813f29f`,
weight 5, reconstructed active tokens 8 to 3. All 41 first-choice comparisons
then pass. The run-2 censorship finding is: **journal lacks lease-eviction
events**; equivalently, lease death is unjournaled.

## Final verification

### Typecheck

Command:

```text
zsh -ic 'cd apps/labs/ciops && bun run check'
```

Green output:

```text
$ tsgo -p tsconfig.check.json
```

### Test suite

Command:

```text
zsh -ic 'cd apps/labs/ciops && bun run test'
```

Green output:

```text
RUN  v4.1.11 apps/labs/ciops

Test Files  2 passed (2)
Tests       8 passed (8)
Duration    1.85s
```

### Package verification

Command:

```text
zsh -ic 'bun run beep quality package-verify @beep/ciops'
```

Green output:

```text
pkg-verify @beep/ciops (apps/labs/ciops)
  ok audit 5.2s   ok docgen 3.0s
```

The package audit ran build, check, the full 8-test suite, and Biome lint.
Docgen found and typechecked 39 examples. Every new exported runtime symbol
carries a titled, compilable `**Example**` block and schema identity annotation
where applicable.
