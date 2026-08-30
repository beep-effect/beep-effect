# Round-3 Seat J — deployed-carrier fidelity audit

Read-only audit of `explorations/beep-ci-operational-ontology/` against this working tree (PR #870 present). No files were written; no git mutations.

**Method.** Each listed claim scored TRUE / FALSE / IMPRECISE against live source. Packet quotes first, then source `file:line` + verbatim evidence. Unlisted CQ-note carriers that fail the same test are at the end.

---

## Claim-by-claim scorecard

| # | Claim | Score |
|---|---|---|
| 1 | `AdmissionWorkKind` = `full-proof, merged-preview, review-fix, publish`; `AdmissionPriority` = `publish, verify` | **TRUE** |
| 2 | Weights 3/5/1/1; one token ≈ 5 GiB | **TRUE** (gloss is the default `slotSizeGib`, not an invariant) |
| 3 | Config defaults 120 / 3 / 10 / 15; snapshot `hardFloorEngaged` + `quarantined` | **TRUE** on fields/defaults; **FALSE** on CQ-023’s meaning of `quarantined` |
| 4 | Ticket `enqueuedAtMillis`+`nonce`; lease `admittedAtMillis`+`weightTokens`; `grantedFrom` from admitted ticket | Fields **TRUE**; stored `grantedFrom` edge **FALSE** |
| 5 | Review-fix class-capped, no checkout/origin gate; full-proof origin-exclusive | Review-fix half **TRUE**; “checkout exclusion” **FALSE** (origin, not checkout) |
| 6 | Publish’s embedded proof requested as `full-proof` (nobody requests `publish`) | **TRUE** in Handler (claim is **not** in kpi-measurement-rules §1) |
| 7 | TurboCacheMode `local:rw` / `local:rw,remote:r` → LocalOnly / LocalWriteRemoteRead; else fail-closed | Literals **TRUE**; unqualified fail-closed **IMPRECISE** |
| 8 | Ring buffer ~50/branch; step records carry `elapsedMs` + `failedStepId` | Retention **TRUE**; “step records” **FALSE** |
| 9 | `YeetProofTier` = `full \| cheap-gates \| review-fix`, distinct from `AdmissionWorkKind` | **TRUE** |

---

## BLOCKER — packet asserts something the source contradicts

### B1. CQ-023 `QuarantineException` is not a quarantined owner

**Packet** (`competency-questions.yaml` CQ-023 notes; `literal-domains.md` StarvationException row):

> Modeled exceptions are the deployed legal-degradation states (closed domain StarvationException: HardFloorException = AdmissionSnapshot.hardFloorEngaged memory floor, **QuarantineException = quarantined owner**)

> `StarvationException` | `HardFloorException`, `QuarantineException` | CQ-023; DEPLOYED carriers `AdmissionSnapshot.hardFloorEngaged` + `quarantined`

**Source.** `quarantined` is an array of **file paths** for **undecodable** ticket/lease JSON. Dead owners are **reaped** (deleted), not quarantined.

```458:468:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
const quarantineEntry = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  entryPath: string,
  reason: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  // ...
  yield* Console.error(`[yeet] quarantined malformed admission state ${entryPath} (${reason}) -> ${destination}`);
```

```517:520:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
      outcome.kind === "malformed"
        ? quarantineEntry(directories, entryPath, "undecodable")
        : outcome.kind === "dead"
          ? reapDeadAdmissionEntry(entryPath, outcome.entry, codec)
```

```562:564:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
    quarantined: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) => (outcome.kind === "malformed" ? O.some(entryPath) : O.none()))
    ),
```

```347:357:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
export class AdmissionSnapshot extends S.Class<AdmissionSnapshot>($I`AdmissionSnapshot`)(
  {
    capacityTokens: S.Finite,
    activeTokens: S.Finite,
    memAvailableGib: S.Finite,
    hardFloorEngaged: S.Boolean,
    leases: S.Array(YeetAdmissionLease),
    tickets: S.Array(YeetAdmissionTicket),
    dead: S.Array(S.String),
    quarantined: S.Array(S.String),
```

**Why this blocks.** CQ-023 treats `hasStarvationException` as a legal-degradation exception on a **SeatRequest**. Mapping `quarantined` onto “quarantined owner” licenses a starvation exception that the scheduler never records. Quarantine is corrupt-record isolation; owner death is reap.

`hardFloorEngaged` **does** exist and **is** `availableGib < config.hardFloorGib` (`QualityScheduler.ts:1273`). That half is a snapshot-global boolean, not a per-ticket field (see W5).

---

### B2. CQ-025’s `actualWallMs` carrier is not `elapsedMs` on journal step records

**Packet** (CQ-025 notes; kpi-measurement-rules §3 only names the ring buffer, not this field):

> actualWallMs (carrier: **elapsedMs in yeet-attempt-journal/v1 step records**)

**Source.** The journal has two event types. Neither is a step record. There is no `elapsedMs` on the journal event itself.

```42:57:packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts
export class YeetAttemptStarted extends S.Class<YeetAttemptStarted>($I`YeetAttemptStarted`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("attempt-started"),
    attemptId: UUID,
    runId: S.String,
    branch: S.String,
    base: S.String,
    head: S.String,
    mode: S.String,
    startedAt: S.String,
```

```73:84:packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts
export class YeetAttemptFinished extends S.Class<YeetAttemptFinished>($I`YeetAttemptFinished`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("attempt-finished"),
    attemptId: UUID,
    recordedAt: S.String,
    verdict: YeetVerdict,
```

What actually exists:

| Thing | Field | Level | Persisted in journal? |
|---|---|---|---|
| `YeetVerdict.elapsedMs` | `elapsedMs` (`Option`) | **whole attempt** | nested inside `attempt-finished.verdict` |
| `YeetVerdictLane.durationMs` | **`durationMs`**, not `elapsedMs` | planned/executed **lane** | nested in `verdict.lanes` |
| `RepoStepRunResult.elapsedMs` | `elapsedMs` | in-memory step | only if copied into `lane.durationMs` |

```143:151:packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts
export class YeetVerdictLane extends S.Class<YeetVerdictLane>($I`YeetVerdictLane`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    status: YeetLaneStatus,
    durationMs: S.optionalKey(S.Finite),
```

```499:506:packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts
    elapsedMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // ...
    failedStepId: S.optionalKey(S.String),
```

Handler writes **attempt** wall as `endedAtEpochMillis - startedAtEpochMillis` (`Handler.ts:1163`), and per-step wall as `YeetExecutedStep.durationMs` / `RepoStepRunResult.elapsedMs`, then `laneFromExecuted` stores it as **`durationMs`**.

**Why this blocks.** WorkUnitExecution calibration (actual vs P50/P95) cannot be ETL’d from `elapsedMs` on journal step records: those records do not exist. Using verdict-level `elapsedMs` would charge the **entire attempt** (prepare+feedback+proof+publish) as one WorkUnit wall. The per-lane carrier, if any, is `verdict.lanes[].durationMs`.

---

### B3. CQ-009’s deployed gate is origin-exclusive, not checkout-exclusive

**Packet** (CQ-009 notes):

> Round-2 seat F scoping (verified against deployed #870): **checkout exclusion holds for the heavy full-proof class only** — review-fix leases are class-capped (3) with no checkout gate.

**Source — review-fix half is true.** Class cap 3; empty `originKey`; `noAdmissionOriginGate`:

```364:380:packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts
// Review-fix loops take one admission token (class-capped at three concurrent
// leases) but never the per-origin proof lock, preserving the cheaper loop
// lane while a sibling full proof runs.
const runWithReviewFixAdmission = ...
  const request = AdmissionRequest.make({
    kind: "review-fix",
    weightTokens: admissionTokenWeight("review-fix"),
    priority: "verify",
    originKey: "",
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    command: "bun run beep yeet verify --tier review-fix",
  });
  return yield* schedulerErrorToYeetError(withQualityAdmission(request, noAdmissionOriginGate, use));
```

```636:639:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
  if (ticket.kind === "review-fix") {
    const activeReviewFix = A.length(A.filter(state.leases, ({ lease }) => lease.kind === "review-fix"));
    return activeReviewFix >= config.reviewFixClassCap;
  }
```

**Source — full-proof half is origin, not checkout.**

1. Origin key = basename of the **origin-scoped** proof lock (`remote.origin.url`), not `checkoutRoot`:

```168:177:packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts
 * @param context - Repo context whose origin identifies sibling checkouts.
export const proofLockPathForContext = Effect.fn("Yeet.proofLockPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, YeetCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const repositoryIdentity = yield* runGitOutput(context.repoRoot, ["config", "--get", "remote.origin.url"]);
  return yield* proofCoordinatorLockPath(repositoryIdentity);
```

```313:329:packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts
  const request = AdmissionRequest.make({
    kind: "full-proof",
    // ...
    originKey: path.basename(lockPath, ".lock"),
    checkoutRoot: context.repoRoot,
    // ...
  });
  const originGate: AdmissionOriginGate<...> = {
    tryAcquire: acquireFullProofLockOrObserveAtPath(lockPath, context, proofSteps),
    release: releaseProofLock,
  };
```

2. Scheduler skip is **`originKey` occupancy**, not `checkoutRoot`. It is **not kind-scoped**:

```614:628:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
// A ticket is skippable ... when
// its origin is already proving under an admission lease, when it recently
// reported its origin lock busy ... or when the review-fix
// class cap is saturated.
  if (Str.isNonEmpty(ticket.originKey) && A.some(state.leases, ({ lease }) => lease.originKey === ticket.originKey)) {
    return true;
  }
```

Scheduler module header says the same:

```12:14:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
 * The per-origin full-proof lock (`Yeet/internal/ProofState.ts`) is retained:
 * callers pass an {@link AdmissionOriginGate} so a contender whose origin is
 * already proving stays queued without blocking unrelated origins.
```

There is **no** `checkoutRoot` uniqueness check. Two full-proofs on **different checkouts of the same origin** are excluded by the deployed law and would **not** turn CQ-009 red (`occupiesCheckout` on `checkoutRoot`). `merged-preview` also sets `originKey` from the same lock and is origin-skipped, with `noAdmissionOriginGate` (`Handler.ts:352–361`).

**Why this blocks.** “Verified against deployed #870: checkout exclusion” is the wrong deployed invariant. The query as written under-enforces the live law (cross-checkout same-origin overlap is legal in CQ-009 and illegal in the scheduler). `closed-world.yaml` repeats the error: `occupiesCheckout` source = `"deployed lease records (checkoutRoot)"`.

---

### B4. `grantedFrom` is not a stored ticket→lease edge in the admission store

**Packet** (CQ-021 notes; `pre-glossary.csv` `grantedFrom`; `closed-world.yaml`):

> SeatGrant = YeetAdmissionLease (grantedFrom ties lease to its ticket — **deployed linkage is the admission handoff**)

> `grantedFrom` … complete_within: **"one admission-store snapshot (tickets dir x leases dir, read atomically)"**
> source: **"deployed #870 admission store (durable on-disk queue + lease records)"**

**What QualityScheduler actually copies.**

Lease body copies owner fields from the ticket. **`nonce` is not a lease field.**

```878:893:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
  const lease = YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: ticket.pid,
    procStart: ticket.procStart,
    kind: ticket.kind,
    weightTokens: ticket.weightTokens,
    priority: ticket.priority,
    originKey: ticket.originKey,
    checkoutRoot: ticket.checkoutRoot,
    branch: ticket.branch,
    command: request.command,
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    admittedAtMillis: nowMillis,
    heartbeatAtMillis: nowMillis,
  });
  const leasePath = path.join(directories.leases, `${ticket.nonce}-${ticket.pid}.lease.json`);
```

Ticket identity while queued is **`pid + nonce`** (`selfMayAttempt` at `QualityScheduler.ts:660`). On-disk stems match:

- ticket: `` `${ticket.nonce}-${ticket.pid}.ticket.json` `` (`:1168`)
- lease: `` `${ticket.nonce}-${ticket.pid}.lease.json` `` (`:893`)

**Then the ticket file is deleted:**

```961:967:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
  const attempt = yield* tryAdmitSelf(directories, request, ticket, gate, config);
  if (O.isNone(attempt.admitted)) {
    return { admitted: O.none(), info, originBusy: attempt.originBusy };
  }
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(ticketPath, { force: true }).pipe(Effect.ignore);
```

Lease schema (`QualityScheduler.schemas.ts:155–167`): `schemaVersion`, `admissionOwnerFields` (`pid`, `procStart`, `kind`, `weightTokens`, `priority`, `originKey`, `checkoutRoot`, `branch`), `command`, `startedAt`, `admittedAtMillis`, `heartbeatAtMillis`, `hotPaths`. **No `nonce`, no `grantedFrom`, no ticket id.**

**Linkage, stated precisely:**

1. **In process, during promotion:** same in-memory `YeetAdmissionTicket` object; lease filename stem = ticket filename stem (`nonce-pid`).
2. **On the lease record after admit:** copied `pid` + `procStart` (+ kind/weight/origin/checkout/branch). `nonce` survives only in the **lease filename**, not the JSON body.
3. **In an atomic tickets×leases snapshot:** the two records for one request **do not coexist**. CQ-021’s `FILTER NOT EXISTS { ?grant grantedFrom ?req }` cannot be discharged from the live store as a stored edge; queued-ness is “ticket still on disk,” granted-ness is “lease still on disk,” with no FK.

**Why this blocks.** Declaring `grantedFrom` closed-world complete inside one admission-store snapshot is false. ETL can reconstruct a historical handoff from filename stems **if it captured them**, or from `pid+procStart` across time, but that is not a deployed record field.

Ticket/lease **field** claims are otherwise true: ticket has `enqueuedAtMillis` + `nonce` (`schemas.ts:220,226`); lease has `admittedAtMillis` + `weightTokens` (`:161` and `admissionOwnerFields:115`).

---

## WARN — imprecise / underspecified

### W1. “One token ≈ 5 GiB” is the default slot, not a kind-weight identity

**Packet** (CQ-021 notes; pre-glossary `admissionChargeTokens`):

> admissionChargeTokens = weightTokens verbatim (… **5 GiB token units**)

**Source.**

```1:4:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
 * One admission token approximates 5 GiB of schedulable memory.
```

```82:109:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
 * Token weight for each admission kind, in 5 GiB token units (SPEC D1).
export const admissionTokenWeight = (kind: AdmissionWorkKind): number =>
  AdmissionWorkKind.$match(kind, {
    "full-proof": () => 3,
    "merged-preview": () => 5,
    "review-fix": () => 1,
    publish: () => 1,
  });
```

```270:273:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
    slotSizeGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5))),
    reserveGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    capacityMaxTokens: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    hardFloorGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(15))),
```

```168:173:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
  if (availableGib < config.hardFloorGib) {
    return 0;
  }
  const raw = Math.floor((availableGib - config.reserveGib) / config.slotSizeGib);
  return Math.max(0, Math.min(config.capacityMaxTokens, raw));
```

Weights 3/5/1/1 are exact. GiB gloss is `slotSizeGib` **default 5**, and capacity also subtracts `reserveGib` (default 10) and hard-floors at 15 GiB. A 3-token full-proof is **not** “15 GiB charged” as a measured RSS; it is 3 slots against that formula. Do not treat 5 GiB as a per-token physical measurement in the KPI.

---

### W2. TurboCache fail-closed is the env-quad rule; CI and `--cache=` bypass it

**Packet** (CQ-024 notes; `literal-domains.md`):

> TurboCacheMode LiteralKit … `'local:rw' -> LocalOnly`, `'local:rw,remote:r' -> LocalWriteRemoteRead`; **every other configuration fails closed to local-only**.

Literals and mapped names **match**:

```54:59:packages/tooling/tool/cli/src/internal/cli/TurboCache.ts
export const TurboCacheMode = LiteralKit({
  literals: ["local:rw", "local:rw,remote:r"],
  enumMapping: [
    ["local:rw", "LocalOnly"],
    ["local:rw,remote:r", "LocalWriteRemoteRead"],
  ],
```

The module header even uses the packet’s sentence (`TurboCache.ts:7–13`). The **resolver** is narrower:

```563:608:packages/tooling/tool/cli/src/internal/cli/TurboCache.ts
 * The decision is total and fails closed. CI and any caller-supplied cache flag
 * are left untouched; a complete quad pinned to `local:rw,remote:r` is honored;
 * anything else — a missing quad member, a blank value, or any other posture
 * including a remote *write* posture ... — resolves to local-only.
  if (options.ci) {
    return CallerControlledTurboCache.make({ reason: "ci" });
  }
  if (A.some(options.args, isTurboCacheControlArg)) {
    return CallerControlledTurboCache.make({ reason: "explicit-cache-arg" });
  }
```

`requestedTurboCacheMode` only accepts **`LocalWriteRemoteRead`** (`TurboCache.ts:556–557`). `TURBO_CACHE=local:rw` with a complete quad is `unsupported-cache-mode` → local-only. So `local:rw` is the **fail-closed output argument**, not an honored `TURBO_CACHE` input.

Unqualified “every other configuration fails closed” is false for CI and explicit `--cache=`. Those plans are `caller-controlled` and are **not** rewritten to local-only.

---

### W3. CQ-022 `failedStepId` lives on the nested verdict, not a journal step record

**Packet** (CQ-022 notes):

> once a failure commits in an episode (**carrier: failedStepId in yeet-attempt-journal/v1**)

The field exists, optional, on `YeetVerdict` (`Verdict.ts:506`). Handler sets it from the first non-zero `exitCode`, or the first unexecuted planned step on handler-error (`Handler.ts:1140–1154`). It is persisted only as `attempt-finished.verdict.failedStepId`. It is **not** a journal-event field and **not** on a step record.

Treat as IMPRECISE, not invented. ETL path is `attempts.ndjson` → `_tag=attempt-finished` → `verdict.failedStepId`. Last-write `verdict.json` is the same schema (`kpi-measurement-rules.md` already warns last-write-only).

---

### W4. Claim 6 is true in Handler, but it is not in kpi-measurement-rules §1

Prompt located the claim in kpi-measurement-rules §1. That file’s §1 is episode identity (`enqueuedAtMillis` / `startedAt`). The sentence lives on the **weight function**:

```83:88:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
 * The publish weight covers only the post-proof mutation phase; a publish's
 * embedded full proof is requested as `full-proof` with publish priority, so
 * no caller requests the `publish` kind yet (reserved with `hotPaths` for the
 * chartered follow-ups; see goals/ship-velocity/research/d1-admission-scheduler.md).
```

**Handler confirms it.** `packages/tooling/tool/cli/src/**` has **zero** `kind: "publish"` / `AdmissionWorkKind.Enum.Publish` request constructions.

Production requests:

| Caller | kind | priority | origin gate |
|---|---|---|---|
| `runWithFullProofCoordinator` | `"full-proof"` | `"verify"` default, **`"publish"`** when called from `runPublishMode` | proof lock |
| `runWithMergedPreviewAdmission` | `"merged-preview"` | `"verify"` | `noAdmissionOriginGate` |
| `runWithReviewFixAdmission` | `"review-fix"` | `"verify"` | `noAdmissionOriginGate` |

Publish mode’s embedded proof:

```619:666:packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts
      yield* runWithFullProofCoordinator(
        plan.context,
        fullSteps,
        Effect.gen(function* () { /* preflight, early push, full proof */ }),
        { priority: "publish" }
      );
```

Same for the non-early path at `:671`. Outer `runPlanExecution` does **not** wrap publish in a `kind: "publish"` lease (`:1292–1318`); commit runs **before** the full-proof coordinator. `publish` as an `AdmissionWorkKind` member is reserved, unused.

CQ-021 notes listing “publish 1 per admissionTokenWeight” as if it were a live charge are therefore a **latent** member, not an observed A-Box kind.

---

### W5. Starvation-exception carriers are snapshot-global, not per-SeatRequest

CQ-023 query: `?req hasStarvationException`. Deployed:

- `hardFloorEngaged: availableGib < config.hardFloorGib` — **machine-wide** (`QualityScheduler.ts:1273`). When true, `admissionCapacityTokensFor` returns 0 (`:169–170`). Every waiter sees the floor; there is no per-ticket bit.
- `quarantined: S.Array(S.String)` — malformed **paths**, not an owner exception (B1).

`observedQueueWaitMs` formulas in the CQ-023 note (queued: snapshot − `enqueuedAtMillis`; granted: `admittedAtMillis` − `enqueuedAtMillis`) are **computable** from deployed millis fields. The bound “derives from `publishAgingSeconds` (120s) … S5 ratifies the multiple” is honest that **120s is aging, not a starvation bound**:

```600:601:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
const effectivePriorityRank = (ticket: YeetAdmissionTicket, nowMillis: number, config: AdmissionConfig): number =>
  ticket.priority === "publish" || nowMillis - ticket.enqueuedAtMillis >= config.publishAgingSeconds * 1000 ? 0 : 1;
```

Aging promotes **priority**, not admission. Packet already says that. Do not ETL `starvationBoundMs := 120000`.

---

### W6. CQ-010 “remaining capacity at admission” is not a snapshot field

**Packet:** `capacityAtAdmissionTokens` is “ETL-materialized from the admission snapshot at grant time”; NL asks whether charge **exceeded remaining** capacity.

Snapshot fields: `capacityTokens` (ceiling now) and `activeTokens` (sum of live lease weights). Remaining = `capacityTokens - activeTokens`. Admission check is **before** the new lease:

```661:663:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
        !isTicketSkippable(state, ticket, nowMillis, config, true) &&
        activeTokenTotal(state) + ticket.weightTokens <= capacityTokens
```

A snapshot taken **after** grant includes the new lease in `activeTokens`. Materializing `capacityAtAdmissionTokens := capacityTokens - activeTokens` post-grant false-reds CQ-010. The packet must pin “remaining **before** the new charge,” or store `capacityTokens` (ceiling) and not compare `charge > ceiling` as if it were remaining.

---

### W7. Ring buffer is exactly 50 **attempt-started** events per **run-id file**, which is branch-keyed

**Packet** (kpi-measurement-rules §3): “newest ~50 attempts/branch, `AttemptJournal.ts`”.

```25:25:packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts
const RETAINED_ATTEMPTS = 50;
```

```203:211:packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts
  const firstRetainedIndex =
    A.length(startIndexes) <= RETAINED_ATTEMPTS
      ? 0
      : pipe(
          startIndexes,
          A.takeRight(RETAINED_ATTEMPTS),
          A.head,
          O.getOrElse(() => 0)
        );
```

Eviction: drop everything before the first of the newest 50 `attempt-started` indexes; also drop a torn trailing line. Path is `.beep/yeet/runs/<runId>/attempts.ndjson` with `runIdForContext` = sanitized branch + hash (`ArtifactPaths.ts:213–214`). So: **exactly 50 starts per branch-scoped file in a checkout**, not 50 events, not fleet-wide. The tilde in “~50” is fine.

---

## NOTE — confirmed, with nuance

### N1. Claim 1 — LiteralKits match

```36:36:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
export const AdmissionWorkKind = LiteralKit(["full-proof", "merged-preview", "review-fix", "publish"]).pipe(
```

```68:68:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts
export const AdmissionPriority = LiteralKit(["publish", "verify"]).pipe(
```

Ontology names `FullProofWork` / `PublishPriority` are packet-side; deployed spellings are the hyphenated / lowercase literals. `literal-domains.md` records both. Fine.

### N2. Claim 3 — AdmissionConfig defaults match

`publishAgingSeconds=120`, `reviewFixClassCap=3`, `capacityMaxTokens=10`, `hardFloorGib=15` (`schemas.ts:270–278`). Also present and **unclaimed** in the listed CQs: `slotSizeGib=5`, `reserveGib=10`, `heartbeatSeconds=5`, `suspectAfterSeconds=30`, `progressSeconds=15`.

### N3. Claim 9 — `YeetProofTier` is a distinct kit sharing only the `review-fix` spelling

```108:108:packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts
export const YeetProofTier = LiteralKit(["full", "cheap-gates", "review-fix"]).pipe(
```

`cheap-gates` is **not** an `AdmissionWorkKind`. `full` ≠ `full-proof`. `verify --tier cheap-gates` takes **no** admission wrap (`Handler.ts:1312–1318`). Do not ingest a cheap-gates verify as `ReviewFixWork` or `FullProofWork`.

### N4. Agent carrier `pid+procStart+checkoutRoot`

All three are on `admissionOwnerFields` (`schemas.ts:111–119`), hence on both ticket and lease. `procStart` is `/proc/<pid>` start time for pid-reuse reaping (`QualityScheduler.ts:8–9`). That is a process identity, not a coding-agent identity; many yeet invocations of the same agent are distinct `(pid, procStart)` pairs. Usable as SeatRequest owner **if** the packet accepts process-grain agents.

### N5. `hotPaths` on the lease

Default `[]` (`schemas.ts:163–166`). JSDoc reserves it for the unused `publish` kind. Empty in every current caller. Do not treat it as a deployed contention surface yet.

---

## Unlisted CQ-note / glossary carriers that fail the same test

### U1. CQ-019 notes: turbo `__typename` is decoded, then dropped

Notes: “turbo affected reasons are typed (`__typename`) and several are fail-open.”

True of the **query decoder**:

```31:37:packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts
class TurboQueryAffectedReason extends S.Class<TurboQueryAffectedReason>($I`TurboQueryAffectedReason`)(
  {
    __typename: S.String,
  },
```

False of the **plan snapshot** the rest of Yeet consumes:

```221:230:packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts
const turboPlanTaskFromAffectedTask =
  (pathsByName: Record<string, string>) =>
  (task: TurboQueryAffectedTask): TurboPlanTask => {
    const packagePath = R.get(pathsByName, task.package.name);
    return TurboPlanTask.make({
      taskId: task.fullName,
      packageName: task.package.name,
      task: task.name,
      ...(O.isSome(packagePath) ? { packagePath: packagePath.value } : {}),
    });
```

`TurboPlanTask` has no reason field (`RepoRun.models.ts:183–191`). `closed-world.yaml:87` already admits “TurboQuery.ts drops reason `__typename`” and says ingest **raw** turbo output. CQ-019 notes do not. If S4 lanes read `TurboPlanSnapshot`, FailOpenOutcome is unrecoverable. Severity: **WARN** (packet is internally split, not silently false).

### U2. `merged-preview` is origin-skipped without being in CQ-009

CQ-009 scopes to `FullProofWork` only. Deployed `isTicketSkippable` origin skip fires for **any** non-empty `originKey`. `runWithMergedPreviewAdmission` sets `originKey` from the same lock basename (`Handler.ts:352–356`) with `noAdmissionOriginGate`. A merged-preview lease and a full-proof lease on the same origin cannot both be active; CQ-009 will not see that pair. Severity: **WARN** (query under-coverage vs deployed origin law; same family as B3).

### U3. `GrantState` / `ExecutionState` / `CancelClass` are not deployed LiteralKits

`literal-domains.md` lists them as closed domains **without** a DEPLOYED carrier line (unlike AdmissionWorkKind / TurboCacheMode). Live store is ticket-vs-lease-vs-absent; verdict is `outcome: success|failure` plus optional `failedStepId`. Do not extract `ActiveGrant` from a field named `hasGrantState`. Not a CQ-note contradiction; a trap for S4 if someone treats the table as source enums.

---

## Confirmed TRUE (no extra finding)

- **AdmissionWorkKind / AdmissionPriority members** — claim 1.
- **`admissionTokenWeight` 3/5/1/1** — claim 2 numeric half.
- **AdmissionConfig four listed defaults** — claim 3 numeric half.
- **Ticket `enqueuedAtMillis`+`nonce`; lease `admittedAtMillis`+`weightTokens`** — claim 4 field half.
- **Review-fix: class cap 3, `originKey=""`, `noAdmissionOriginGate`** — claim 5 review-fix half.
- **Publish embedded proof is `kind: "full-proof"` + `priority: "publish"`** — claim 6 (source JSDoc, not kpi §1).
- **TurboCacheMode two literals + enumMapping** — claim 7 literal half.
- **`RETAINED_ATTEMPTS = 50` with drop-from-Nth-oldest-start eviction** — claim 8 retention half.
- **`YeetProofTier` `full | cheap-gates | review-fix`** — claim 9.

---

## What this seat did not treat as in-scope

Ontology SPARQL executability, S4 worksheet quality, and KPI probe math except where they name a **deployed source carrier**. Effect v4 / schema-law review of QualityScheduler was not requested.

Highest-leverage packet fixes, if a later pass is allowed to write: retarget CQ-009 to origin (`originKey` / proof lock), retarget CQ-023 quarantine to malformed-record paths, retarget CQ-025 to `verdict.lanes[].durationMs` (and attempt `elapsedMs` only if the WorkUnit is the whole run), and drop `grantedFrom` as a live-store closed-world predicate (filename-stem reconstruction or process-local handoff, not tickets×leases join).
