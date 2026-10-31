# PR2364 repair — October 31

The published head still lacked four already-reviewed local repair commits. The
scanner dependency PR2366 has now merged at
`4a71782090acac558412687d387de7996aec4073`. Integration commit
`fcb2c70946c45267fc7102977b7c81b0ad14ed2f` incorporates current main, including that
policy and upstream dependency fixes. The only textual merge conflict was the
schema inventory generation date; the canonical writer regenerated the inventory.

The completed hosted Lint Policy log also exposed independent defects:

- Three error-message getters lacked documentation; exported helpers lacked
  parameter/return annotations, and a literal greater-than sign violated TSDoc.
  The scoped documentation lint now passes with zero warnings.
- Sixteen AI-metrics process fixtures and one CLI process fixture had no TypeScript
  configuration owner. Explicit strict fixture configurations now cover those
  files. Both configurations type-check, and both packages' deprecated-API lanes
  report zero unmatched TypeScript files and zero deprecated API findings.
- The exploration map pointed to a renamed profile service and two untracked
  downstream packet directories. The tracked service path is corrected; the
  downstream names are explicitly planned work rather than existing directories.

The generated inventory also exposed a missing example on the internal managed-session
observation helper. A compilable example was added without changing its implementation.

The full AI-metrics package audit passed in 148.1 seconds and documentation examples
passed in 13.6 seconds. The complete bounded verification job exited zero, with no
protective stop, PID-limit event or orphan. Its durable archive and exact commands
are recorded in `../ops/history/pr2364-repair-verification-20261031.json`.

Independent Astra accepted the narrow repair against the integration commit:
the initial nine source edits are documentation only, both fixture configurations have
correct ownership/paths, and the revised map/status prose matches tracked state.
The reviewer checked the initial nine hashes, then accepted the additional internal
provider example and all ten hashes in the revised runtime-equivalence receipt.
It made no mutations or test/service runs. The orchestrator separately observed
the package audit and all 53 provider documentation examples pass.

`../ops/documentation-runtime-equivalence-20261031.json` records identical emitted
JavaScript for all ten source files. Historical canary receipts remain bound to
their original bytes and dates; this comparison is not a fresh canary execution.
Current-head hosted gates and final delivery remain required. The original
forwarder service and timer are still masked and inactive; no historical data,
production enrollment, or recovery-hold state was changed.

Hosted follow-up found only the AI-metrics schema catalog stale. The earlier
production-build repair changed three codec helpers into function wrappers, so
those symbols no longer qualify as static catalog schemas. The canonical catalog
generator and renderer, with source enumeration restricted to the complete
AI-metrics package (250 inputs), removed exactly those three obsolete entries.
No catalog entry was hand-edited and no unrelated shard was touched. This scoped
generation took 18.4 seconds and peaked at 1.1 GiB; full hosted catalog validation
remains required. Three full-scan attempts were stopped by the retained host-memory
reserve and are archived as incomplete, not passed.

## Review and runtime-parity follow-up

Two discovery defects are repaired: non-UTF-8 entry names now consume a counted
`other` event without aborting valid siblings, and positively identified
noncanonical active roots fail configuration before helper acquisition. Missing
or inaccessible roots retain runtime availability reporting; retired roots are
never probed. All eleven discovery regressions passed before the adapter update.
Astra accepted both fixes at source level. These are runtime edits: historical
v3 canary bindings are retained, and do not qualify the new bytes as a fresh
canary run.

The recency-priority review suggestion is not adopted as a corrective change.
SPEC criterion 3 and its scheduling decision require fair selection, separately
from acceptance. A stable eligible population and positive cap receive bounded
selection slots through persisted rotation; this is not a guarantee of ingestion
through a fail-fast legacy batch. Strict changed-first selection can starve old
backlog under sustained writes. A future freshness policy must reserve fair
capacity, define cap-one behavior, and prove restart/refusal/hot-backlog cases.
The held legacy forwarder remains disabled.

CI's Node 22.23.4 runner exposed Bun-only SQLite imports in the new tests. The
in-process fixtures now use the existing Node SQLite adapter, with one catalog
devDependency. Four HTTP suites use real Node HTTP servers, including actual
Unix sockets; the shared Node Bun shim cannot prove streaming admission or Unix
socket ownership. Production SQL and explicit Bun subprocess fixtures are
unchanged. All 186 tests in these 21 suites passed under local Node before the
final assertion-style repair.

The hosted Check lane additionally rejected eleven nested test assertions under
the Effect call-style diagnostic. Equivalent direct discriminant assertions
preserve their narrowing and expectations. Build and Integration rejected two
worker resource-number schemas; these now use `S.Finite` with the same bounds.
AI-metrics check and the CLI production build pass after those changes. Final
changed-test validation is run separately under CI's pinned Node and Bun.

Final targeted validation passed all 211 tests in 24 changed modules under both
CI Node 22.23.4 (61.4 seconds) and Bun 1.4.4 (57.2 seconds), with no protective
stop or PID-limit event. Astra accepted the final assertion/schema changes.
Broader current-head hosted gates and runtime-canary requalification remain
separate; the held services and archives were not restored or modified.

## October 31 continuation: hosted failures and archival provenance

The hosted run at `1d19d4c51896e4545311659414f7c7aa0ee0620e` passed the
AI-metrics unit shard, build, integration, docgen and doctest. Its remaining
code failures were the CLI deployment-plan console fixture, four native HTTP
factory imports rejected by Effect diagnostics, and lint-policy findings.
Coverage comparison did not run: its prerequisite unit aggregate failed. No
coverage floor was lowered and no regression baseline was refreshed to hide it.

The socket repair uses the public Node test-server layer for TCP fixtures and
Bun's public adapter for Unix sockets. The test layer binds an ephemeral
wildcard address; fixture backend clients explicitly dial loopback. This is a
test-listener scope change, not a production listener change. The existing Node
Bun compatibility shim now honors Unix paths without reserving a TCP port and
provides the missing `ReadableStreamDefaultReader.readMany` API. The compatibility
method wraps one original read in one batch, preserving cancellation, rejection,
locking and terminal completion. Native Bun's implementation remains in place.
No Effect diagnostic directive, exemption or severity changed.

Node 22.23.4 passed all 34 tests across the five affected socket/crash modules,
plus five shim tests. The shim regression consumes `request.stream`, rather than
only `request.text`, and covers reload, shutdown, rebinding and occupied-path
refusal. Network streaming deadlines remain covered by the real Node server
suites; the Bun shim still buffers request bodies. Independent source review
accepted the compatibility method and those proof boundaries.

The deployment-plan test now installs its own console service around command
execution and captured output. Twenty-two callback wrappers now use
`Effect.fnUntraced` with unchanged arguments and bodies; source review retained
transaction, interruption, permit and cleanup boundaries. Scheduler pass-local
membership uses `MutableHashSet` with unchanged check/add ordering.

The reference gate identified 90 immutable execution receipts stored in the live
`ops` surface. They moved to `ops/history` byte-for-byte; the relocation index
records original paths and SHA-256 values. Historical internal source locations
retain their original meaning. Navigation links point to retained locations.
The captured operator request is likewise retained verbatim in the exploration's
research directory. The reference classifier and its zero-debt gate are unchanged.

Three moved receipts require exact historical path aliases for full-tree Gitleaks
scans. PR2393 preserves the old paths and exact source-key/digest constraints
while admitting only their three new destinations. An additional two-commit
experiment using the actual Git-history scanner confirmed that byte-identical
R100 renames pass the existing base policy with zero findings, so this policy
qualification need not hold the current repair push.
Positive and negative scanner cases passed: base policy flags the three new
paths, candidate policy accepts both locations, changed digests and unrelated
paths still fail. The base-pinned CI policy remains authoritative.

Current-source package/policy checks, canonical generated inventories, hosted
checks, final-check and closeout remain required. Guard-stopped scans and denied
admission are incomplete attempts. The historical canary source bindings remain
historical after these runtime wrapper edits. The recovery hold remains intact.


The canonical JSDoc inventory is regenerated through a source-reviewed bounded
orchestration: 182 freshly analyzed package rows plus exactly one retained UI row.
All 233 UI tracked files are byte-identical to the prior full canonical result;
independent review accepted equivalence of the only shared RegExp escaping delta.
The complete original UI row is retained unchanged. Current root policy, topology,
totals and rendering use the canonical functions. Full input/index/helper/context
hashes and per-record bindings were verified before output publication. The normal
single-process command remains incomplete; its stopped attempts are retained.
This orchestration does not replace hosted freshness or quality gates.

After all 22 callback rewrites, package types passed for AI-metrics, CLI, Phoenix
and the provider driver, and 11 focused CLI/deployment/managed-session tests passed
under Node22.23.4. The earlier 34 socket/crash tests precede the last callback-only
rewrites and are not presented as final current-source complete package proof.
The schema inventory refresh was stopped at the retained host reserve; its canonical
refresh and hosted policy check remain open while the coherent source repair wave
is published under the constrained-compute route.
