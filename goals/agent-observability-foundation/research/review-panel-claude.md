# Independent foundation review — Claude panel seat

Assigned model: `claude-fable-5-1`, effort `xhigh`. Final report received after the tools-disabled continuation. This review covers the source snapshot described below; subsequent repairs need separate verification.

**Verdict: hold acceptance.** The foundation's receipt, replay, privacy projection and journal crash behaviour are sound as read. Three defects block a truthful "queue/retention/rollback" claim, and five acceptance items are only partially evidenced. No defect I found requires discarding evidence; all are fixable in the current tree.

## Snapshot and limits

I reviewed branch `feat/agent-observability-foundation` at base `bea57177a3` with the dirty tree listed at session start, plus the dankserver worktree at `33d932c` with its dirty Ansible files. My reads predate the parent's independent-health and event-lag repair and the multi-event order fix. The lag summary and the "source order" scheduler test were already present in my copy, but I did not run them. Graft, Bash digest comparison, the proof archive under `~/.local/state`, and the Phoenix OpenAPI lookup were denied, so I could not verify receipt fingerprints or the Phoenix span filter contract. I ran no tests and acknowledged no inbox rows.

## Findings, prioritized

**P1. The rendered worker unit pins the journal to 1 MiB.** `ObservationDeployment.ts:125` hard-codes `LimitFSIZE=2097152`. The process gate at `ObservationWorker.ts:155` refuses startup unless the soft file limit is at least `maxDatabasePages * 8192`, so only the schema minimum of 256 pages passes. The canary passed because its fixture journal was tiny. Any production-sized journal fails with `resources` before the listener opens. Derive the limit from the launch config, and add a plan test for a non-minimal page count.

**P1. Stuck events have no resolution path, and they block retirement.** An attempt that commits at `delivery-ledger.ts:336` and dies before the request is never resent: `native-schedule.ts:300` routes `unresolved` to read-back only, which returns `Missing` forever. A page whose enrollment hits `conflict` at `delivery-ledger.ts:288` can never be registered, so `payload-reclamation.ts:142` fails before expiry. A cross-epoch native duplicate re-sent after a seal produces two Phoenix spans with the same identifiers, which the reader rejects as `ambiguous` at `Phoenix.span-readback.ts:180`. In all three cases the page stays retained, `evidence-retention.ts:125` refuses to seal while pages remain, and expiry is opt-in with no default at `payload-reclamation.ts:47`. SPEC item 13 asks for dead-letter ownership; no dead-letter or explicit replay operation exists.

**P1. The deployed worker never reclaims, expires, backs up or seals.** The worker exposes those operations at `observation-worker.ts:143` to `observation-worker.ts:150`, but the socket handler at `ObservationWorker.ts:247` routes only health, metrics, pause, resume and intake, and the runtime loop at `observation-runtime.ts:232` calls only the scheduler tick. The installed journal grows until capacity refusal, then returns 503 until someone stops the process and runs library code out of band. That is not the owned retention path SPEC item 9 asks for.

**P2. The production collector route has no qualified transport.** The metadata receiver listens on container port 4319 at `otel-config.yaml.j2:25`, and `compose.yaml.j2:87` publishes only 4318 on loopback. A workstation worker cannot reach it, and publishing it would make an unauthenticated filter the only guard. The canary avoided this with a local collector. Applying the rendered template also removes raw traces from the 4318 pipeline at `otel-config.yaml.j2:130`, which stops the live harness-otel flow. The route notes acknowledge producer migration, but the SPEC decision log carries no rollout step with that reversal.

**P2. The desktop-marked fixture leaves no desktop evidence.** The canary marks surface only inside the session string at `live_canary_support.py:135`, which is hashed before export, and it strips launch intake at `live_canary_support.py:124`. The backend records in `live-canary-installed-verification.json` are indistinguishable apart from hashes. SPEC item 12 is met nominally, not evidentially.

**P2. Worker health has no external path.** Lag and phase gauges are rendered only on the private socket, and `ObservationWorker.ts:253` returns HTTP 200 for `stale` and `degraded` loops. No scrape, exporter or alert covers the worker, and nothing detects a source that stops producing. The collector alerts at `prometheus-alerts.yml.j2:126` onward cover their side. The parent is repairing this; I record the pre-repair state.

**P2. The worker inherits the whole shared environment file.** `ObservationDeployment.ts:146` denylists two names. The proof checks only those two. Any other secret in that file reaches the process.

**P3. The held forwarder gained a schema change.** `forwarder.ts:1290` to `forwarder.ts:1378` adds a DuckDB discovery cursor table to the masked forwarder path with no recorded reversal, and the hold is meant to stay untouched.

**P3. Pause is not atomic with scanner suspension.** `observation-worker.ts:116` acquires the exclusive permit twice, so a resume between the two calls fails the pause after the worker is already accepting.

**P3. Persistent `Missing` has no backoff.** `native-schedule.ts:302` re-queries every unresolved event each pass after one fixed delay.

**P3. Repository gate is red.** The checkout carries an unacknowledged P0 `@beep/repo-cli:audit` inbox row, nothing is committed, and the implementation log itself says the full CLI gate is not claimed.

## Acceptance status and unverified boundaries

Items 1 through 7, 10 and 11 are met at the synthetic level by the code and tests I read, with unknown populations preserved honestly in `observation-coverage.ts` and the inventory output. Items 8, 9, 12 and 13 are partial for the reasons above. Item 6 is implemented and tested but incomplete without a disposition path for un-enrollable pages.

Unverified: current file digests against `implementation-verification.json`, and `observation-runtime.ts:421` to `observation-runtime.ts:429` showed unformatted lines that suggest the receipt predates the file. The Phoenix `trace_id` and `span_id` filter contract, Phoenix behaviour on duplicate span identifiers, the retention reconciler script, the mirror target schema for the new `collector_root_hash` column, the discovery permission tests, the systemd masked state of the old forwarder, and the proof archive contents were not inspected by me.
