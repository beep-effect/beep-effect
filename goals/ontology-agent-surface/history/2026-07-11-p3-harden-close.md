# P3 Harden + Close Evidence

Date: 2026-07-11
Branch: `feat/ontology-agent-surface-p3-harden`
Status: `closeout evidence complete on host; P3 publication in flight`

## Deliverables

- Added [`ops/benchmark-stateless.ts`](../ops/benchmark-stateless.ts), which
  generates 1k, 10k, and 100k-triple Turtle files and invokes the public
  `OntologyToolService` through `OntologyToolsLive` with real N3, rdfc-1.0,
  Oxigraph, file-store, and ontology use-case layers.
- Added the authored product contract at
  [`docs/product/ontology-agent-surface.md`](../../../docs/product/ontology-agent-surface.md)
  and linked it from the packet README.
- Completed the criterion-by-criterion acceptance sweep below.
- Added explicit 120-second timeouts to the existing heavy real-engine SHACL,
  competency, ontology-tool, and MCP integration suites. This is test metadata
  only; no published package source changed and no changeset is required.
- Strengthened the stale-CAS real-engine test with a post-refusal Oxigraph SELECT
  proving the rejected subject is absent from the saved file.
- Added the schema-valid closeout reflection at
  [`history/reflections/2026-07-11-codex.md`](./reflections/2026-07-11-codex.md).
- Synchronized PLAN, manifest phases, README, lifecycle, and the generated
  [`goals/INDEX.md`](../../INDEX.md).

## Stateless Real-Stack Benchmark

### Method

Each case writes exactly the requested number of unique named-subject/literal
triples before timing. The three timed calls are independent public service
calls:

1. `openInspect`: fresh file read + Turtle parse + rdfc-1.0 fingerprint.
2. `snapshotDescribe`: fresh reopen + fingerprint + snapshot projection.
3. `sparqlQuery`: fresh reopen + fingerprint + Oxigraph SELECT with the
   server-owned result limit.

There is no fingerprint-only `OntologyToolService` method. The benchmark
therefore verifies that all three returned fingerprints agree instead of
bypassing the real service to isolate canonization. Generation and file write
are outside the timers. Cases run sequentially in one process with no warm-up;
normal OS page cache and JIT effects remain possible, but there is no ontology
session or application result cache.

The script keeps typed failures visible in timing cells, so an rdfc or engine
limit cannot be mistaken for a skipped row. After printing every row, any
failed operation or fingerprint mismatch makes the process exit nonzero.
Direct Node TypeScript execution is not runnable in this source checkout
because package source imports use `.js` specifiers whose built files are
absent; the established standalone TypeScript precedent runs under Bun with
Effect's `NodeRuntime` adapter.

### Sandbox diagnostic numbers

Command:

```sh
bun run goals/ontology-agent-surface/ops/benchmark-stateless.ts
```

These values are relative sandbox evidence only. The orchestrator must rerun
the command on the host and treat the host table as canonical.

| Triples | Open + rdfc-1.0 | Snapshot + reopen/rdfc-1.0 | SPARQL + reopen/rdfc-1.0 | Fingerprints agree | Snapshot resources | Query rows/limit |
| ---: | ---: | ---: | ---: | :---: | ---: | :--- |
| 1,000 | 784.10 ms | 889.53 ms | 1,148.69 ms | yes | 1,000 | 200/200 (injected) |
| 10,000 | 9,009.01 ms | 11,174.45 ms | 12,533.01 ms | yes | 10,000 | 200/200 (injected) |
| 100,000 | 182,417.07 ms | 241,422.78 ms | 176,462.90 ms | yes | 100,000 | 200/200 (injected) |

### Canonical host numbers (2026-07-11)

Run on the host via the recorded command; raw output archived at
[`2026-07-11-p3-benchmark-host.log`](./2026-07-11-p3-benchmark-host.log).
The host profile confirms the sandbox diagnostics within noise:

| Triples | Open + rdfc-1.0 | Snapshot + reopen/rdfc-1.0 | SPARQL + reopen/rdfc-1.0 | Fingerprints agree | Snapshot resources | Query rows/limit |
| ---: | ---: | ---: | ---: | :---: | ---: | :--- |
| 1,000 | 848.84 ms | 970.97 ms | 1,272.85 ms | yes | 1,000 | 200/200 (injected) |
| 10,000 | 8,870.49 ms | 10,403.48 ms | 11,339.19 ms | yes | 10,000 | 200/200 (injected) |
| 100,000 | 238,902.77 ms | 253,033.16 ms | 174,966.11 ms | yes | 100,000 | 200/200 (injected) |

### Capacity interpretation

All three measured real-stack read paths completed at every size with stable
semantic fingerprints and bounded SPARQL results. The measured 1k calls took
roughly 0.8-1.1 seconds, the 10k calls already took 9.0-12.5 seconds, and the
three independent 100k calls took roughly 176-241 seconds each. A tenfold
increase from 10k to 100k cost roughly 14-22 times more wall time in this
sandbox.

V1 is therefore near-interactive only around the 1k diagnostic case, carries
substantial wait time at 10k, and is batch-oriented at 100k. No silent cache or
session repository was added to improve the result. If product requirements
demand repeated interactive 100k calls, that pressure must reopen the deferred
state/session ownership design rather than hide state behind this stateless
contract. Canonical host numbers are still required before setting a hard
product triple cutoff.

The related fixed limits remain:

- rdfc-1.0 canonicalization receives a 1,000 ms abort signal and work-factor
  cap of 1 for deep blank-node comparison; upstream observes the signal
  periodically, so neither control is a strict wall-clock canonization or
  end-to-end call deadline;
- SPARQL results: 200; search results: 100; validation results: 100;
- mutation batch: 256 operations; reasoner drift window: 64 operations;
- the structural reasoner covers subclass/subproperty closure, type and
  domain/range propagation, and disjointness detection, not OWL 2 DL
  `someValuesFrom`/`allValuesFrom` classification.

## Documentation Landed

[`docs/product/ontology-agent-surface.md`](../../../docs/product/ontology-agent-surface.md)
is the concise authored product home established by `docs/README.md`. It
documents:

- the six read tools and three mutation-gated tools;
- server-owned result, operation, and reasoner budgets;
- semantic rdfc-1.0 CAS behavior and the sidecar-only write-authority bound;
- every typed refusal contract and the no-silent-no-op rule;
- authenticated MCP actor derivation and per-change PROV-O attribution;
- the default-off `ONTOLOGY_MCP_MUTATIONS_ENABLED` registration gate plus the
  independent fail-closed TierGate;
- the actual structural reasoner, verified repair, and stateless performance
  limits.

The packet [`README.md`](../README.md) now points to that document and makes
the P3 evidence and reflection the latest closeout artifacts.

## SPEC Acceptance Checklist

The checklist follows [`SPEC.md` Acceptance Criteria](../SPEC.md#acceptance-criteria)
in order.

| # | Criterion | Status | Proof |
| ---: | --- | :---: | --- |
| 1 | Curated required capabilities have schema-typed inputs, outputs, and returned errors. | pass | Nine tool declarations and schemas: [`OntologyToolkit.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts#L644-L820). The returned failure union is defined at [`OntologyToolkit.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts#L269-L286). Per-tool real-engine evidence: [`P1`](./2026-07-11-p1-toolkit.md#real-engine-proof-per-tool). |
| 2 | An actual authenticated MCP client initializes, lists tools, and invokes capability metadata plus bounded Oxigraph SPARQL on loopback `/mcp`. | pass; host re-proof retained | Typed client flow: [`live-mcp-client.ts`](../ops/live-mcp-client.ts#L19-L91). Successful launched-sidecar transcript: [`p2-live-client.log`](./2026-07-11-p2-live-client.log#L1-L20). The repaired node-socket/session-replay and launched-sidecar reruns remain host commands below. |
| 3 | A typed batch is gated, applied, CAS-saved, returned with real deltas, and attributed in PROV-O. | pass | TierGate and authenticated actor: [`OntologyToolHandlers.ts`](../../../packages/ontology/server/src/tools/OntologyToolHandlers.ts#L70-L148). Apply/save/journal/delta sequence: [`OntologyToolService.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolService.ts#L218-L255). MCP caller/PROV proof: [`ontology-mcp-http.test.ts`](../../../apps/professional-desktop/test/integration/ontology-mcp-http.test.ts#L262-L345). |
| 4 | A stale caller receives the recoverable CAS conflict and cannot overwrite newer content. | pass within single-writer bound | Typed contract: [`OntologyToolkit.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts#L128-L146). CAS precedes apply/save: [`OntologyToolService.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolService.ts#L127-L140). The real behavioral test reopens through a bounded Oxigraph SELECT and proves the rejected subject is absent: [`OntologyTools.test.ts`](../../../packages/ontology/server/test/OntologyTools.test.ts#L149-L192). The in-process-only write-authority limit is documented. |
| 5 | Query/result and mutation budgets are enforced; TierGate and drift refusals are typed and visible. | pass | Fixed budgets and budget/drift schemas: [`OntologyToolkit.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts#L63-L193); TierGate refusal: [`OntologyToolkit.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolkit.ts#L233-L249). Mutation/drift enforcement: [`OntologyToolService.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolService.ts#L142-L169); validation/reasoner ceilings: [`OntologyToolService.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolService.ts#L275-L290); search/SPARQL ceilings: [`OntologyToolService.ts`](../../../packages/ontology/use-cases/src/tools/OntologyToolService.ts#L418-L457). Result proof: [`OntologyTools.test.ts`](../../../packages/ontology/server/test/OntologyTools.test.ts#L84-L127); mutation/drift proof: [`OntologyTools.test.ts`](../../../packages/ontology/server/test/OntologyTools.test.ts#L195-L227); visible MCP refusals: [`ontology-mcp-http.test.ts`](../../../apps/professional-desktop/test/integration/ontology-mcp-http.test.ts#L262-L345). |
| 6 | SHACL returns verified registry repairs whose application resolves the target violation. | pass | Four-strategy registry and verify-before-offer loop: [`Session.validation.ts`](../../../packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts#L504-L707). Real SHACL strategy proof: [`Session.validation.test.ts`](../../../packages/ontology/use-cases/test/Session.validation.test.ts#L217-L367). Tool apply/revalidate proof: [`OntologyTools.test.ts`](../../../packages/ontology/server/test/OntologyTools.test.ts#L230-L251). |
| 7 | Empty/base prefix fidelity and ROBOT interop pass on named fixtures. | partial: ROBOT host-gated | Full prefix round-trip and fingerprint proof: [`SessionServer.test.ts`](../../../packages/ontology/server/test/SessionServer.test.ts#L129-L170). Named ROBOT loop: [`validate-robot-interop.sh`](../ops/validate-robot-interop.sh#L13-L28). The sandbox has no ROBOT binary; host command remains below. |
| 8 | Stateless 1k/10k/100k benchmarks are recorded without hidden caching, and docs state reasoner limits. | pass locally; canonical host numbers gated | Script and sandbox table are recorded above. The authored limit contract is [`docs/product/ontology-agent-surface.md`](../../../docs/product/ontology-agent-surface.md#reasoner-repair-and-performance-limits). |
| 9 | Real-engine tests, authenticated protocol proof, repo gates, reflection lint, and mergeable Yeet state pass. | partial: P3 mergeability host-gated | Node-backed real-engine and MCP suites, full check/lint, and reflection lint passed below; the archived live transcript proves the protocol. Sandbox Yeet stopped at remote fetch, and this dispatch intentionally did not commit, publish, or monitor. |
| 10 | No unrelated refactors or formatting churn. | pass for local P3 diff | The P3 diff is limited to benchmark/docs/packet/index files, timeout metadata on the four existing heavy proof suites, and the focused post-refusal stale-CAS SPARQL assertion. No dependency, lockfile, production package source, session repository, transport, reasoner, or tool expansion changed. Final staged and unstaged whitespace checks pass below. |

## Packet Closeout State

- PLAN reports P0-P3 complete while retaining the precise host gates.
- Manifest phase statuses are all `complete`; P3 points to this evidence.
- `bun run beep goals set-status ontology-agent-surface completed-retained`
  atomically updated `initiative.status`, `lifecycle`, README Lifecycle, and
  `goals/INDEX.md`.
- README latest evidence points here and to the Codex reflection.
- `bun run beep lint reflection-artifacts` reports
  `blocking_findings=0`; its five advisories are unrelated completed packets
  with `reflectionRequired: false`.
- `bun run beep goals doctor` reports `blocking_new=0`; inherited baseline
  findings and schema-version advisories remain outside this packet.

This is deliberately an uncommitted pre-publication lifecycle state, as
requested. The completion gate still says the packet is not achieved until the
P3 PR is mergeable.

## Local Gate Results

Passed:

```text
bun run goals/ontology-agent-surface/ops/benchmark-stateless.ts
  1k/10k/100k rows completed; fingerprints agree; SPARQL 200/200

node-backed @beep/ontology-use-cases
  Session.validation.test.ts + WorkerImportGraph.test.ts
  2 files passed; 5 tests passed

node-backed @beep/ontology-server
  OntologyTools.test.ts + OntoauthorMatCompetency.test.ts + SessionServer.test.ts
  3 files passed; 19 tests passed

node-backed professional-desktop integration
  ontology-mcp-http.test.ts
  1 file passed; 4 tests passed

affected package check/lint
  ontology-use-cases: passed
  ontology-server: passed
  professional-desktop: passed with one pre-existing unused-suppression warning

bun run check
  114/114 package tasks, dtslint tsgo, 453 test files, and tsgo smoke passed

bun run lint
  all 23 blocking lanes passed

bun run beep laws terse-effect --check
  blocking_files=0

bun run beep lint reflection-artifacts
  blocking_findings=0

bun run beep goals index --check
  goals/INDEX.md matches manifests

bun run beep goals doctor
  blocking_new=0

manifest status/phase jq assertion + GOAL.md size gate
  passed

git diff --check + git diff --cached --check
  passed
```

Known inherited or environment-gated results:

```text
bun run config-sync:check
  failed with the inherited 106 unrelated package-docgen drifts
  no write/regeneration command was run

bun run beep yeet verify
  stopped at sandbox remote-baseline fetch:
  git fetch --quiet --no-tags origin refs/heads/main:refs/remotes/origin/main
  exit 255
```

## Exact Host Commands Remaining

### Canonical benchmark and ROBOT

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
set -o pipefail
bun run goals/ontology-agent-surface/ops/benchmark-stateless.ts 2>&1 | tee \
  goals/ontology-agent-surface/history/2026-07-11-p3-benchmark-host.log
goals/ontology-agent-surface/ops/validate-robot-interop.sh 2>&1 | tee \
  goals/ontology-agent-surface/history/2026-07-11-p3-robot-interop-host.log
```

Review the benchmark log, replace the sandbox diagnostic table in this file
with canonical host numbers (or add a clearly labeled host table), and archive
the successful ROBOT output without secrets.

### Repaired socket and launched-sidecar client re-proof

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8/apps/professional-desktop
BEEP_TEST_ONTOLOGY_MCP_SOCKET=1 node ../../node_modules/vitest/vitest.mjs run \
  --config vitest.integration.config.ts \
  test/integration/ontology-mcp-http.test.ts
```

In terminal one:

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
export BEEP_DESKTOP_RPC_SESSION_TOKEN="$(openssl rand -hex 32)"
export CHAT_AGENT=fixture
export CHAT_SIDECAR_PORT=3939
export ONTOLOGY_MCP_MUTATIONS_ENABLED=false
mkdir -p .beep/professional-desktop/ontology-workspace
cat > .beep/professional-desktop/ontology-workspace/live-proof.ttl <<'TTL'
@prefix ex: <https://example.test/> .
ex:alice a ex:Person ; ex:name "Alice" .
TTL
bun run --cwd apps/professional-desktop sidecar
```

In terminal two, with the same exported bearer token available:

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
set -o pipefail
export ONTOLOGY_MCP_URL=http://127.0.0.1:3939/mcp
export ONTOLOGY_MCP_ORIGIN=http://127.0.0.1:1421
export ONTOLOGY_MCP_ONTOLOGY_PATH=live-proof.ttl
bun run goals/ontology-agent-surface/ops/live-mcp-client.ts 2>&1 | tee \
  goals/ontology-agent-surface/history/2026-07-11-p2-live-client.log
```

Review the replacement transcript before committing; it must not contain the
Authorization value.

### Final quality and publication handoff

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
gh pr view 383 --json url,state,mergeStateStatus,baseRefName,headRefName,statusCheckRollup
(cd packages/ontology/use-cases && \
  node ../../../node_modules/vitest/vitest.mjs run \
    --config vitest.config.ts \
    test/Session.validation.test.ts \
    test/WorkerImportGraph.test.ts)
(cd packages/ontology/server && \
  node ../../../node_modules/vitest/vitest.mjs run \
    --config vitest.config.ts \
    test/OntologyTools.test.ts \
    test/OntoauthorMatCompetency.test.ts \
    test/SessionServer.test.ts)
bun run config-sync:check
bun run check
bun run lint
bun run beep lint reflection-artifacts
bun run beep goals index --check
git diff --check
git diff --cached --check
bun run beep yeet verify
```

If #383 lands before P3 publication, reconcile this branch onto the resulting
`origin/main` history before Yeet publish. If it remains stacked, the P3 PR
must explicitly use the P2 branch as its base and be retargeted after #383
lands; do not publish an accidental P0-P3 aggregate diff against `main`.

After reviewing the canonical evidence and resolving or explicitly waiving the
inherited config-sync drift, the host orchestrator owns the intentionally
unexecuted publication steps:

```sh
bun run beep yeet publish --message "feat(ontology): harden and close agent surface"
bun run beep yeet monitor
```

## Blocking Conditions For Achieved Closeout

Host resolution status (2026-07-11, orchestrator):

1. Canonical host benchmark numbers: DONE — host table above; raw log at
   [`2026-07-11-p3-benchmark-host.log`](./2026-07-11-p3-benchmark-host.log).
2. ROBOT fixture validation: RETAINED ENVIRONMENT GATE — the host still has no
   ROBOT binary; run archived at
   [`2026-07-11-p3-robot-interop-host.log`](./2026-07-11-p3-robot-interop-host.log)
   ("ROBOT is required but was not found on PATH."). The script remains
   runnable once ROBOT is installed; structural interop proof stands.
3. Node-socket and launched-sidecar re-proof: DONE — socket suite 4/4 on host;
   fresh launched-sidecar client transcript at
   [`2026-07-11-p3-live-client.log`](./2026-07-11-p3-live-client.log)
   (initialize, tools/list, capability metadata, bounded SPARQL, all
   non-error).
4. Config-sync drift: NOT REPRODUCIBLE ON HOST — `bun run config-sync:check`
   reports "tsconfig-sync: no drift detected"; the 106-file drift was a
   sandbox environment artifact.
5. P3 Yeet verification, publication, hosted checks, and merge-ready GitHub
   state: P2 PR #383 merged first; this branch was rebased onto the squashed
   `origin/main` before publish (no aggregate diff).

No session repository, stdio transport, OWL 2 DL reasoner, dependency,
additional tool, or production package source change was needed.
