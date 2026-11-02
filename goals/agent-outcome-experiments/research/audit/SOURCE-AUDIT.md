# AI metrics source audit

Date: 2026-10-27. Read-only implementation inspection at `e2e021ef75b975573dfaa04eab2f9a7f4e62aab9`. This report is the only file written by this audit. No real transcripts, prompt/output bodies, secret values, remote services, runtime configuration, or databases were read or changed. Existing tests were inspected, not executed. Findings establish behavior in this checkout; deployment parity and the numerical cause of the reported 6,674 traces / 285 sessions remain unproven.

## Scope and method

Read root `AGENTS.md`, `explorations/AGENTS.md`, packet manifest/README, the AI metrics package README, and the relevant Graft runbook. An initial `graft search` was rejected as an unknown command; the canonical `graft ask "Where are AI metrics session discovery parsing dedup checkpoint export forwarder implemented?" --source` succeeded before source inspection. Its graph description contained stale details (including shared budgets and directory concurrency), so findings below use actual source. Graft reported approximately 104,898 tokens saved; its monetary estimate is not independently verified.

Source references below are repository-relative, with current line numbers. The main owner is `packages/tooling/library/ai-metrics/src/`; CLI integration is `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts`.

## Confirmed implementation defects and coverage gaps

### 1. Clone/worktree coverage and source attribution disagree

`internal/transcript-utils.ts:56-67` resolves Claude to precisely `~/.claude/projects/<encoded-current-repo-path>` but Codex to the entire `~/.codex/sessions` tree. `forwarder.ts:1317-1343` consumes those files without filtering by session working directory or repository. The forwarder registers only `input.repoRoot` (`forwarder.ts:1485-1499`), snapshots that root (`1500-1505`), and supplies its root hash to all records (`1512-1515`, `1644-1653`). Agent task rows persist that same hash and snapshot (`derived-storage.ts:1498-1508`, `1517-1558`).

Consequence: a timer attached to clone A omits Claude sessions under clone B and linked worktree C while importing Codex sessions from unrelated directories and assigning them A's ingest context. The registry can describe linked worktrees (`identity-registry.ts:608-634`), but registration of one root does not enumerate the transcript namespaces of all roots. Repeating ingestion from another clone can replace a shared session's task/config association (`derived-storage.ts:1578-1597`, `1767-1828`). This affects repository/config comparisons even when event deduplication works.

Candidate focused reproduction: create two synthetic git roots and separate synthetic Claude project directories plus Codex session metadata with distinct `cwd` fields; invoke discovery/forwarder for root A with a temporary home and store. Assert coverage of B/C and inspect only hashed root/config associations. Re-ingest the same Codex file from root B and assert whether A attribution changes. No real transcripts are needed.

### 2. Newest-N selection can permanently starve older files

`forwarder.ts:1297-1314` sorts eligible files by descending mtime and takes `maxFiles`; `1330-1334` correctly allocates a separate budget to each source. The next pass repeats that selection without excluding already ingested files or keeping a scan cursor. Selected files are reread and archived (`1346-1388`). `includeAll` only bypasses the mtime predicate (`1184-1189`), not the newest-N cap. Files above `maxFileBytes` are excluded in entirety (`1191-1194`, `1226-1227`).

Consequence: once more than N eligible Codex files exist, repeated passes can ingest the same N files forever while older eligible files never reach storage. Busy recent files and global Codex scope increase competition. Large, long-running sessions stop contributing as soon as they cross the size cap. Coverage counts expose caps, but do not provide eventual progress or enumerate unseen files.

Candidate focused reproduction: synthesize N+1 files with fixed increasing mtimes, run twice with `maxFiles=N`, then verify the oldest source never receives an event. Append to a file until it crosses the byte cap and verify later events remain absent. Test `includeAll=true` separately.

### 3. Phoenix span times describe export time, with zero duration

`otlp.ts:890-892` chooses one current wall-clock timestamp for a send chunk. `readableSpanFor` assigns it to both start and end and sets `duration: [0, 0]` (`821-854`). Original turn time survives only as `ai_metrics.timestamp` (`594-605`); session projections have no original time field (`562-592`).

Consequence: Phoenix's native date filters and latency views cannot be interpreted as original work dates or elapsed work. A historical backfill appears in the export window, and every synthetic span has zero latency. This is a concrete obstacle to using a seven-day Phoenix count as a collection-completeness denominator or measuring agent speed.

Candidate focused reproduction: send a synthetic projection whose event timestamp is seven days old through a fake/capturing exporter with a fixed current clock; assert the resulting OTLP start/end values. Verify date-filter semantics against a disposable backend in a separate explicitly scoped test.

### 4. Unreadable or missing discovery branches collapse to successful emptiness

`internal/jsonl-discovery.ts:20-22` converts all stat errors to `None`. Missing roots, permission errors and other stat failures therefore share the empty result (`39-43`, `48-50`); directory read failures become an empty listing (`61-62`). Forwarder per-file stat errors also disappear (`forwarder.ts:1221-1223`). Its returned coverage includes candidate/included/size-excluded counts (`1305-1312`), with no discovery-error count.

Consequence: an inaccessible subtree can look like a genuinely empty source in a successful forwarder run. This is distinct from a selected file failing during its actual read, which correctly fails the run with a hashed diagnostic (`1355-1362`). The separate source-discovery command has status modeling, but it cannot recover errors discarded by the common recursive walker.

Candidate focused reproduction: inject filesystem stat/readDirectory failures for one source subtree using the existing test filesystem/fake layer. Assert that current forwarder coverage reports zero rather than an explicit incomplete state. Avoid Unix permissions alone when running as a privileged test user.

### 5. OpenClaw forwarding consumes a service unit, not session events

`forwarder.ts:1258-1287` resolves `.config/systemd/user/openclaw-gateway.service` and feeds this file through transcript processing. This is a metadata source, as the privacy path also labels it `gateway_metadata` (`privacy.ts:706-707`). Its mtime gate is the unit file's mtime (`forwarder.ts:1265-1266`).

Consequence: the presence of OpenClaw in source enums or coverage does not establish collection of OpenClaw conversations, tool activity, or recent use. With a recent-time scan, an unchanged installed service unit disappears from coverage despite active gateway work. This is a coverage gap, not proof that OpenClaw is in use on this host.

Candidate focused reproduction: provide a synthetic unchanged unit and separate synthetic gateway activity; assert that only the unit can enter the current forwarder and recent activity cannot alter its selection.

### 6. Session/event deduplication is path-bound, not logical-session-bound

`derived-storage.ts:1763-1767` keys sessions by source kind and path hash. Turns include source path hash, line number and raw-event hash (`1842-1847`). OTLP trace identity is likewise source kind, source role and source path hash (`otlp.ts:540-555`), even though a separate logical session ID hash is available.

Consequence: copying/restoring a transcript under another path produces another session and another set of turns; a path alias can split identity. Rewriting/reordering a transcript can mint more turn identities even when the same logical event survives. This is correct file-occurrence identity but insufficient for counting unique logical conversations across imports/restores/hosts. Cross-host path/salt collision behavior requires separate evidence and is not asserted here.

Candidate focused reproduction: ingest identical synthetic transcript bytes with the same session metadata ID under two paths, then compare session, turn and trace counts. Add a third fixture with leading blank lines or reordered records to make the intended physical-line/event identity contract explicit.

## Other correctness and measurement limitations

- **Timestamp extrema are lexicographic.** `ingest.ts:167-170`, `218-228` sorts timestamp strings, not instants. Mixed ISO offsets/fractional precision can make first/last incorrect; parsers allow optional string timestamps. Reproduce with `2026-10-27T10:00:00+02:00` and `2026-10-27T09:00:00Z` and compare chronological order. Whether real logs contain mixed formats was not inspected.
- **Tool/provider inference is sparse.** `otlp.ts:438-446` emits provider `unknown` for Claude and Codex, and treats an event name containing `tool` as the tool's name. `452-470` infers LLM versus CHAIN from event-name fragments. These spans are event projections, not measured tool invocations or model requests; they cannot directly support per-tool success/latency or model efficiency claims.
- **Export retries acknowledge the collector, not query-visible backend storage.** Current code closes per-turn watermarks after exporter success. End-to-end reconciliation with Phoenix query-visible IDs is not present in this path. Treat collector acceptance and backend visibility as different evidence levels.
- **Export failures are deliberately nonfatal to local ingestion.** `Programs.ts:1681-1697`, `1701-1734` returns a tagged failed export with a sanitized message rather than failing the whole run. Good local durability behavior, but process success alone is not delivery success; health monitoring must inspect `otlpExport.status` and pending rows.
- **Potential unbounded memory/backlog work:** discovery walks the entire root before applying maxFiles (`jsonl-discovery.ts:34-65`, `forwarder.ts:1217-1242`); exporter builds projections for all pending turns before chunk delivery (`otlp.ts:657-669`, `1145-1155`). Large-history cost is a source-supported risk, not a measured failure.

## Existing reliability protections: do not report these as still missing

The checkout already contains meaningful repairs:

- Separate per-source file budgets and explicit starvation/size counts (`forwarder.ts:1297-1343`). This prevents Claude being starved solely by Codex consuming a shared cap, but does not solve starvation within a source.
- Stable per-path session and event IDs across ingest runs (`derived-storage.ts:1763-1767`, `1833-1889`). Historical per-run duplication is documented in comments, but is not the current key design.
- A pending-turn export watermark independent of ingest run (`otlp.ts:473-478`, `1145-1155`), with migrations for previously buried turns (`derived-storage.ts:635-715`). Do not claim a current run-only export filter.
- Deterministic trace/span IDs (`otlp.ts:540-555`) and grouping sessions adjacent to their turns so a session-only prefix cannot indefinitely block chunk progress (`657-669`).
- Acknowledged chunk delivery before watermark closure, bounded exponential retries for the recognized retryable exporter status (`otlp.ts:989-1017`), and explicit exporter callback confirmation (`856-879`). Delivery remains at-least-once across the delivery/checkpoint crash window.
- A canonical external data root, worktree-aware filesystem identity, registry writer locking/atomic persistence, and salt-namespace refusal. Registry identity is richer than the forwarder's discovery/attribution behavior.
- Selected-file read failure is hashed and reported; hook shard/gap completeness is explicitly modeled (`forwarder.ts:1527-1576`, `1669-1678`). These protections do not establish transcript discovery completeness.

## Test evidence and bounded follow-up

Inspected `test/forwarder.test.ts`, `test/otlp.test.ts`, `test/source-discovery.test.ts`, relevant `test/ingest.test.ts` sections and identity implementation. Most behavioral coverage lives in the large ingest test file, while the named forwarder/OTLP files chiefly cover schema/wire invariants.

Existing cases include watermark backfill/reopening (`ingest.test.ts:2546`, `3079`), retaining sessions after run retention (`2782`), collapsing legacy sessions (`2899`, `2987`), exporting pre-watermark stores (`3167`), stable traces across runs (`3245`), committing latest snapshot only after forwarder success (`3495`), source discovery (`3540`), unreadable-file skipping (`3647`), and oversized-file skipping (`3692`). Those assertions confirm intended skip behavior; they do not prove completeness across clones or progress across repeated bounded scans.

No broad suite was run. Prioritize the synthetic reproductions above, plus a focused actual-protobuf timestamp test, before a rewrite. Keep checks transport-free unless exercising backend acceptance explicitly. A definitive missing-collection audit still needs sanitized counts at each boundary: discovered eligible files, unseen/incomplete files, parsed accepted/rejected events, committed distinct events, pending export rows, collector-acknowledged IDs and backend-visible IDs. None requires reading prompt/output text.
