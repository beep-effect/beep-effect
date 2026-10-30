# Turborepo cache trust and observability spec

## Objective

Enforce signed artifact reuse, independent upload authorization, tenant isolation and attributable cache outcomes with bounded safe telemetry.

Graduated 2026-09-08 after the user approved the complete
[brief](../../explorations/turborepo-quality-cache/BRIEF.md) and [goal map](../../explorations/turborepo-quality-cache/MAP.md).
The [decision record](../../explorations/turborepo-quality-cache/DECISIONS.md) supplies inherited trust,
qualification, rollout and ownership requirements.

## Non-goals

Out of scope: backend replacement, new PKI or a generic telemetry platform, broad task qualification, and changes to hosted proof semantics.
Preserve adjacent proof, timing/placement and ontology ownership. A new package
requires the approved consumer test and canonical generator. A cache hit never
substitutes for fresh required hosted proof.

## Source hierarchy

1. User objective and approved exploration decisions.
2. AGENTS.md, CLAUDE.md and required skills.
3. Binding architecture and package standards.
4. This SPEC.md.
5. PLAN.md, then GOAL.md.
6. Supporting evidence and the [source ledger](./research/SOURCES.md).

Higher sources govern conflicts. Refresh materially stale evidence without
reopening settled design decisions.

## Target surfaces

- [packages/tooling/tool/cli/src/commands/Cache/index.ts](../../packages/tooling/tool/cli/src/commands/Cache/index.ts): Cache-specific outcome and producer receipt contracts.
- [packages/tooling/tool/cli/src/internal/cli/TurboCache.ts](../../packages/tooling/tool/cli/src/internal/cli/TurboCache.ts): Reuse and harden existing secret-safe client posture.
- [infra/src/CiTurboCache.ts](../../infra/src/CiTurboCache.ts): Auth/storage/namespace/telemetry wiring and scoped incumbent rollout.
- [infra/lambda/turbo-cache/src](../../infra/lambda/turbo-cache/src): Opaque tags, tenant/method validation, invocation boundary and typed backend events.
- [standards/turbo-remote-cache.md](../../standards/turbo-remote-cache.md): Operator contract for key/epoch/read/write behavior.
- [packages/foundation/modeling/skill-contract/src/EvidenceReceipt.ts](../../packages/foundation/modeling/skill-contract/src/EvidenceReceipt.ts): Reference generic evidence contracts; no donation of cache-specific policy.

This goal owns tests beside its implementation and its packet evidence.
Record every additional touched workspace in the verification and ownership
list. Only change scripts/configuration where this contract names their role.

## Implementation contract

### Independent trust controls

Implement native Turbo HMAC artifact verification and opaque `x-artifact-tag`
carriage. Read/write bearer and storage capabilities are independent of the
shared HMAC key. Bind callers to the allowed tenant/namespace and reject
conflicting, encoded or escaping selectors. Test direct writer invocation and
the gateway-to-writer authentication boundary; do not confuse that HMAC with
Turbo's artifact HMAC.

Approved same-repo PRs and workstations can receive reader capability and the
verification key. Forks remain local-only. Protected writers alone receive
upload authority. The server preserves tags without possessing the artifact
signing key. A reader missing its required key uses attributable local-only
execution; protected writers and signing canaries missing it fail. Never permit
unsigned remote fallback inside a signed epoch.

### Epochs and producer evidence

Native verification uses one key, so rotate through explicit namespace epochs.
Bind relevant client/backend/profile/tenant identity and bounded retention to
the epoch. Prove old/new separation and restore the prior approved epoch during
rollback without mixed writes. Verify relevant warm-process secret-cache behavior.
Use approved secret references and redacted typed configuration; no raw item,
environment, bearer, signature-key or artifact payload is retained in git.

Issue protected producer receipts with bounded repository/workflow/source,
resolved workflow SHA, task hash, version digests, epoch and upload result.
The receipt must be tamper-evident through a demonstrated protected workflow
or storage mechanism. A freely editable local JSON file is insufficient.
Shared-key readers can forge tags offline, so a MAC alone cannot assert an
exact protected producer. Add asymmetric attestation only for a demonstrated
residual requirement and a new scoped decision.

### Attribution and observability

Own cache-specific typed outcomes, including genuine miss, auth/write/tenant
denial, missing/invalid signature, malformed metadata, corruption, rejected
payload, throttle/unavailability, ambiguous write, invalid receipt, and
profile/epoch mismatch. Translate technical failures at the consuming boundary.
A result may still trigger recomputation, but its cause remains in the receipt.

Correlate bounded receipts across source/workflow, task, request, object and
quality result. Use low-cardinality metric labels; exact SHAs/task hashes stay
in bounded detailed records. Start with stable Turbo summaries and explicit
backend events. Prove synthetic-secret/path/artifact-content redaction before
publishing logs or enabling OTEL. OTEL needs separate credentials, payload
capture, allowlist, sampling/queue/retention bounds, regression checks and a
disable switch. Generic evidence types may be reused without moving cache
policy into the foundation package.

### Production readiness

Lab fixes precede production signing/tenant activation. Produce a concrete
current deployment/credential receipt, resource diff, named source/workflow
cohort, compatible client policy, numeric cost/retention controls and rollback
plan before execution. Use already granted scope where it covers the action;
resolve only material ungranted budget or external authority from this concrete
plan. Coordinate task/CI edits with adoption; it owns broad consumer wiring.

If the incumbent is retained, this goal owns its scoped production hardening.
Observe the agreed seven/seven/fourteen-day backend windows and rehearse the
incumbent/prior-epoch fallback. If a replacement is selected, the conditional
migration goal owns cutover; supply passing contracts and readiness evidence.
Do not claim production trust from a lab pass or count absent observation as
successful completion.

## Dependencies and ownership

Receipt schemas can be authored alongside qualification's early policy
contract. Conformance consumes those schemas and supplies direct negative-case
results. Apply adapter fixes in its lab before production. Coordinate the named
hosted cohort with adoption, without waiting for adoption's entire program to
finish. If replacement is selected, cutover belongs to the reopened migration
packet; incumbent hardening remains this goal's responsibility otherwise.

The [program map](../../explorations/turborepo-quality-cache/MAP.md) defines cross-goal handoffs. Assign one
writer to each shared file/artifact before concurrent work. A pending sibling
goal does not justify duplicating its schema, state or evidence.

## Constraints and governing references

- [Architecture constitution](../../standards/ARCHITECTURE.md) and
  [placement rationale](../../standards/architecture/07-non-slice-families.md).
- [Agent laws](../../AGENTS.md), schema-first/Effect-first skills for relevant
  implementation, and Yeet for quality/publishing work.
- [Remote-cache operator contract](../../standards/turbo-remote-cache.md).

Detailed contracts for this goal:

- [trust-model.md](../../explorations/turborepo-quality-cache/research/trust-model.md)
- [remote-cache-contract.md](../../explorations/turborepo-quality-cache/research/remote-cache-contract.md)
- [observability-and-economics.md](../../explorations/turborepo-quality-cache/research/observability-and-economics.md)
- [backend-rubric.md](../../explorations/turborepo-quality-cache/research/backend-rubric.md)
- [architecture-grill.md](../../explorations/turborepo-quality-cache/research/architecture-grill.md)

Use schema-first models, typed errors/tagged outcomes, Effect helpers/services,
explicit config boundaries and curated exports. Search live source/barrels
before adding helpers. Keep the standalone Lambda build boundary explicit;
exchange versioned JSON instead of CLI implementation imports. Reuse generic
evidence vocabulary only where it fits.

Artifact HMAC does not prove complete task inputs or a protected producer.
Separate task reuse, archive transport, lane proof, Yeet full proof and hosted
status. Keep raw artifacts/logs/traces out of git; store bounded sanitized
receipts and retention-controlled raw references. Resolve op from PATH and
follow the approved agent lane. Never reveal secret values or repair an agent
secret failure through desktop sign-in.

## Acceptance criteria

- [ ] Signed valid artifacts restore and missing/invalid/corrupt/wrong-team artifacts are rejected before output materialization.
- [ ] Reader, fork, writer, backend and storage roles satisfy the independent capability matrix; tenant escape and direct invocation negatives pass.
- [ ] Missing-key behavior, explicit epoch rotation, warm-process behavior and rollback are proven without unsigned fallback or backend possession of the artifact key.
- [ ] Protected producer receipts and direct result classes preserve provenance/fault causes despite Turbo recomputation.
- [ ] Logs/metrics/receipts pass synthetic-secret and artifact-content safety tests with bounded labels, volume and retention.
- [ ] Adoption receives current trust-readiness evidence; incumbent hardening or replacement handoff and applicable representative windows are completed and correctly attributed.
- [ ] Relevant package/protocol checks pass; failures are attributed and no
  introduced regression remains.
- [ ] The final implementation PR reaches Yeet `merge-ready: yes`, with
  required checks and reviews handled.
- [ ] Final evidence, reflection and lifecycle closeout land in that same PR.

Packet creation satisfies no implementation criterion. A partial or blocked
result remains active/paused with receipts, not completed-retained.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet conventions | `bun run beep goals doctor`; `bun run beep explore --check` | No new findings; attribute inherited fleet findings. |
| Launcher | `wc -m < goals/turborepo-cache-trust-observability/GOAL.md` | At most 4,000 characters; target at most 3,500. |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Pass after editing this package; include every other edited workspace. |
| Package handoff | `bun run beep quality package-verify @beep/infra` | Pass after editing this package; include every other edited workspace. |
| Behavioral proof | Acceptance-specific tests and experiments | Negative cases fail for the intended reason; source review cannot fabricate runtime proof. |
| Reflection and evidence | `bun run beep lint reflection-artifacts` and receipt review | Valid, safe evidence and a closeout reflection at completion. |
| Hosted acceptance | Yeet repair, verify, publish and monitor per current skill | Final head is merge-ready with required proof and handled reviews. |

For infra/Lambda edits, use its existing verification lane and inspect build/temp
targets first. A bundle build is not deployed conformance. Docs-only preparation
needs JSON/link/projection checks; actual implementation needs behavioral proof.

## Rollback

Disable affected remote use and run locally, preserving required statuses.
Restore the prior approved endpoint/epoch/config through the rehearsed path;
stop mixed writes and revoke only affected capabilities. Preserve sanitized
fault receipts. Remote fallback must never mean unsigned restore.

## Stop conditions

- Semantic divergence, failed invalidation, sensitive capture or unauthorized
  read/write/tenant access appears. Stop affected reuse and preserve a receipt.
- Required exact-version or dependency evidence is missing. Continue independent
  work but do not cross the gate.
- A concrete deployment/rollout exceeds scope or an unresolved numeric budget.
  Prepare the change/preview before requesting a missing material decision.
- A change would overwrite another owner's artifacts, weaken required statuses,
  or bypass the approved secret or runner-admission paths.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None approved | This goal | Goal executor | Record real exceptions before using them. | Every temporary exception needs a bounded removal condition. |

## Decision log

### Bound optional second-phase optimizer work, 2026-10-31 UTC

- The expansion budget alone still permits quadratic pairwise processing below
  its cap. Follow the patched upstream limit: skip optional deduplication above
  1,000 alternatives while retaining every alternative and matching behavior.
  Test the exact boundary, zero comparisons above it, and 4,096 alternatives
  through the existing scoped subprocess watchdog. Removing the guard must
  fail the bounded 1,001-alternative control, then restore source exactly.
- Remove the stray import text from the legacy helper's JSDoc; keep its real
  filesystem import. Re-prove this source wave rather than treating the older
  complete proof as current. Reversal is a reviewed Git revert of this wave;
  protected consumers remain held until a secure compatible repair is accepted.
  No cache deployment, credential, scanner exception or proof floor changes.

### Dependency security compatibility, 2026-10-31 UTC

- Resolve the inherited glob/minimatch advisories with patched dependencies and
  the existing expansion budget in the vendored optimizer. Keep scanner
  exceptions, qualification policy and quality floors unchanged.
- Preserve the minimatch 10 dialect with independent reference data captured
  from its verified published implementation and the accepted original test
  generators. Never derive expected results from the port. Keep fresh
  fragment candidates bounded while retaining the original round-trip and
  hostile-input checks. This is compatibility evidence, not qualification.
- Reverse the repair as a complete Git change in a recovery branch if needed;
  keep affected protected changes unmerged until a patched compatible option
  passes. No deployed namespace or credential state changes in this repair.

### Owned request-tag capture, 2026-10-29

- Retain the complete minimal native summary in each newly executed signed
  pilot run, decoded from the same supervised summary bytes before any task
  selection. Move the existing summary schema into the existing runner schema
  role and retain its original export. Decode historical absence as `None`;
  absence cannot satisfy a future producer upload join. This captures evidence
  only: full-graph comparison, actual adapter results and protected publication
  still need their owned integration and runtime proof. Reverse by reverting
  the additive field and schema move before enabling such a consumer.
- Retain only a SHA-256 digest of the actual incoming opaque artifact-tag header
  in fixture observations. Keep request evidence distinct from response tag
  presence, and decode historical events without this field as absent. The
  digest grants neither signature validity nor backend authorization. A real
  adapter result must still be observed independently before producer upload
  publication. Reverse by reverting the additive capture before activating any
  consumer that requires it.
- Develop the capture continuation in an unpublished sibling lane based on
  PR #2358's frozen head while its validation runs. Publish only after that
  dependency lands and the unpublished continuation is reconciled with main.
  This preserves the current proof's source and avoids parallel edits to its
  workflow owner. Reverse by archive-retiring the unpublished lane.

### Signed-client component, 2026-10-28

- Route optional artifact-key references through the existing cache secret-session
  allowlist; keep backend and storage credentials separate. A reference cannot
  reach a direct native child unresolved. Reverse by reverting this component
  before any signed epoch is activated.
- Resolve policy from the checkout root and reject alternate-root inputs before
  selection. Use the same forced local arguments for selection and execution;
  clear deprecated conflicting cache environment flags in inspection and fallback.
  The isolated native controls justify this behavior; it grants no trust or task
  qualification authority.
- Preserve the current unsigned configuration until deployment readiness, explicit
  epoch/role/tenant policy, bounded rollout and rollback evidence are complete.
  This component prepares enforcement; it does not activate a signed cohort.

### Resume and native execution, 2026-10-28

| Date | Decision and reason | Reversal |
| --- | --- | --- |
| 2026-10-28 | Resume in the dedicated `codex/turborepo-goals-completion` lane. Refresh current source, client pins and population before promoting anything; older qualification remains bound to its original tuple. | Retain the previous approved configuration and remove only this lane's changes through a reviewed revert. |
| 2026-10-28 | Treat the already approved R2 fleet as the current consumer path and retain AWS as its rollback. The user approved named trusted workstation writers; this grants upload capability, not protected-workflow producer identity. Refresh both boundaries before claiming production trust. | Disable affected remote reuse, stop mixed writes and restore the prior approved endpoint and epoch through a rehearsed path. |
| 2026-10-28 | Pin native experiment execution with `--skip-infer --single-package`; a zero-task fixture is a failure. Keep supervisor failures bounded to exit code or capture truncation without attaching private worker streams. | Revert the runner change through Yeet; keep promotion closed when exact native execution is unproven. |

### Receipt media-type safety

- 2026-10-29: Project response Content-Type evidence through the existing
  registered MimeType schema, discarding parameters and unknown subtypes at
  both direct and proxy capture boundaries. Actual synthetic-secret regressions
  demonstrated that truncation retained private material. Historical receipt
  decoding remains compatible. Reversal: disable the affected collection path
  while repairing its projection; raw header retention must not be re-enabled
  without passing the synthetic-secret/path/artifact controls. This is a
  receipt-safety repair and grants no deployment or task qualification.

### Pinned loopback policy component

2026-10-28: prepare a minimal patch against upstream adapter 4.0.20 commit
`0e893f63e1c7f1ac3c460d79e75fb63d4c9f7c85`. Each explicitly enabled process
binds one reader/writer role and one tenant/epoch namespace, independently of
artifact HMAC possession. Keep the artifact key in native clients. This closes
method and selector gaps in the disposable lab while retaining the existing
loopback adapter and object-store topology. Use synthetic local storage, one
canonical admitted job and two compiler workers; no new cloud spend or service.

The patch is opt-in preparation. Existing production `adapter.sh` stays on its
published binary pin. Rollback of this component is removal of the unused patch
and test artifacts; a production activation needs its own numeric rollout,
source-bound executable, cohort, grants, namespace/key and rollback evidence.
The local process report does not satisfy those deployment or observation gates.

### Startup isolation

- 2026-10-29: The pinned adapter must decide signed startup from its inherited
  process configuration. Reject policy introduced by dotenv before logging
  begins; retain the legacy metadata-failure warning as static text only. The
  previous executable failed the new startup control and the repaired exact
  binary passes. Reversal: keep this candidate inactive and continue using the
  incumbent while repairing the candidate; do not restore the mixed-mode path.
  This component decision grants no deployment or broad qualification.

### Finite backend-result capture

- 2026-10-29: Preserve the pinned adapter’s finite result vocabulary in optional
  conformance exchange metadata. Both direct and proxy capture validate the
  method/status combination and replace unknown or inconsistent claims with a
  static invalid-evidence label. Historical exchanges decode with absent metadata.
  The field is an untrusted observation, grants no protected producer or HMAC
  authority, and cannot classify a not-found response as a genuine miss. Actual
  synthetic-secret and known-written-404 controls justify the boundary. Reversal:
  disable the optional projection while retaining independent transport outcomes;
  never retain raw header text as a fallback. No deployed collector is enabled.

### Bounded lab capture repair

- 2026-10-29: Retain the existing conformance proxy and finite backend-result
  projection. Enforce its request cap before forwarding and reject incomplete
  capture instead of silently dropping events. Defaults are 5,000 requests,
  64 MiB per body, 64 MiB of tagged upload attempts, 64 reserved replay keys and
  4 KiB per encoded record; schema-validated overrides only lower these bounds.
  Invalid capture yields a static typed error and refuses further proxy traffic.
  Interrupted request bodies cannot become empty upstream uploads; streamed
  oversized replies retain a payload-rejected cause. This is admitted lab
  traffic proof, not production telemetry or producer authority. Reversal is to
  stop the candidate experiment and retain the incumbent; do not restore silent
  truncation or the empty-body fallback. No live service or cloud change.

### Capture policy seam

- 2026-10-29: Separate the existing capture budget policy from HTTP orchestration
  in the same role file. CI found introduced handler complexity; fix its natural
  admission/recording seam while retaining public options, bounds and controls.
  No suppression or baseline change. Reversal is to halt candidate experiments;
  the live incumbent is unaffected.

### Complete request capture and hosted repair

- 2026-10-29: A capture is complete only when every admitted request has a
  recorded outcome. Receipt reads allow deliberate in-flight timeout probes to
  finish, polling through Effect Schedule every ten milliseconds for at most
  the configured hold plus five seconds. Invalid capture fails immediately;
  requests still unaccounted for at that bound refuse the receipt. This adds
  no backend, signing, credential or qualification authority. Reversal keeps
  affected evidence and reuse disabled rather than accepting a partial prefix.
- Synchronize the native interrupted-upload control with actual body-read and
  handler-completion signals. Preserve Boolean assertion polarity through
  canonical helpers. No expected error payload, baseline waiver, fixed sleep
  extension or test retry substitutes for those controls.

### Bounded adapter runtime component

- 2026-10-29: Pin the candidate adapter to two Tokio core workers, two HTTP
  workers and two blocking threads per runtime. The upstream worker default
  followed host parallelism; the read-only incumbent baseline observed 68 total
  threads, which is an observation rather than a configured maximum. Add a
  synthetic loopback lab envelope with a measured two-CPU quota, 256 MiB memory
  cap and sixteen-task cap. Worker environment variables cannot widen these
  source-pinned limits. This is preparation and grants no deployment readiness.
  Reverse by stopping candidate admission and selecting the prior reviewed
  artifact only after its applicable gates; the incumbent service and objects
  remain available. No live adapter, credentials or cloud resource changes.

### Owned lab cleanup review repair

- 2026-10-29: Attempt every owned unit and child before reporting a bounded
  aggregate cleanup failure. An ExitStack closes every log, temporary directory
  and storage fixture even if stopping or another closure fails. Publish success
  evidence only after teardown completes. Real-unit stop/status failure controls
  and a combined stop/log failure control precede the full synthetic replay.
  The reviewed Rust patch and binary are unchanged; production stays inactive.
  Reversal is to halt candidate experiments while retaining the incumbent.


### Native streaming control under Node CI

- 2026-10-29: The Node compatibility server collects the entire request body
  before handler dispatch. A streaming test that waits for that handler before
  completing its body cannot run against this shim. The Node suite now runs
  this same control through the installed Bun runtime and local Vitest entry,
  with one worker, a forty-five-second child deadline and 16,384 captured
  characters. Bun executes the original physical HTTP control directly. The
  five-second body/handler bounds remain unchanged. No skip, fabricated body
  failure, longer streaming timeout or test retry substitutes for native proof.
  Removed guards must fail both the native test and the Node parent. Reversal
  keeps unproven evidence disabled; the production proxy is unchanged.

### Hosted upload provenance preparation

- 2026-10-29: Use existing authenticated GitHub client/content operations and
  independently selected approval to verify an exact Actions artifact. Bind
  repository database identity, same-repository non-fork main execution,
  successful current attempt, approved workflow revision and ASCII bytes, immutable
  archive digest, and the entire existing computation/client/profile/epoch
  binding. A report cannot choose its own trust roots. Reusable workflows
  remain refused until their resolved identities have independent approval.
- The first cohort permits at most sixty-four KiB of ASCII workflow text. This
  rejects Unicode replacement and lossy text decoding before hashing. Unicode
  workflows require a raw-byte content route before this profile can widen.
- Bound the component to a one-MiB ZIP containing only `cache-producer.json`,
  sixty-four upload rows and sixty-four KiB of ASCII JSON, with a ten-second
  parser child and a twenty-four-hour receipt lifetime. Retain only finite
  status/result, canonical task/content hashes and byte counts. Read no tag,
  bearer, artifact payload, source path or caller URL into the receipt.
- This verifies an immutable hosted observation only. The actual closed
  protected producer, deployed environment/credential controls, current source
  qualification, semantic input closure, native HMAC checks and rollout remain
  prerequisites. No existing live endpoint, writer policy or signing setting
  changes. Reverse by removing the internal verifier and leaving reuse local
  at this unqualified boundary.


### Exact owned-task upload observation join

- 2026-10-29: Reuse the canonical sixteen-lowercase-hex native task-hash schema
  in optional exchange metadata; historical receipts decode absence. The first
  producer join requires one successful fresh task at the approved client and
  full computation identity, one exact matching artifact PUT and a settled
  capture bounded to two hundred events. Writer/tenant attribution, unfaulted
  complete outcomes, coherent successful upstream/delivered statuses, the finite
  adapter result `allowed`, bounded complete archive bytes/digest and opaque tag
  presence are mandatory. Only successful status/events metadata may accompany
  that upload. This is observation validation, not caller authentication, native
  HMAC verification, a qualification transition or protected producer issuance.
  The closed supervisor still owns source/command/capture and GitHub publication.
  Reversal leaves this preparatory component unwired; no live epoch changes.


### Separate Alchemy credential lifecycle and bounded signed trial

- 2026-10-29: Keep the existing private bucket in `BeepTurboR2Pilot` and place
  two bucket-scoped account-token resources in the separate
  `BeepTurboR2SignedCredentials` stack/stage. A normal bucket plan must neither
  create nor revoke the trial grants. Use the pinned provider's typed permission
  names and exact bucket resource shape; no Worker, bucket, VM or runner burst
  is added. Reader gets object read; writer gets object read/write. Require an
  explicit future expiry within thirty days, protect local state at mode0700,
  and omit token values from stack outputs. The approved secret lane owns
  consumer handoff; an artifact HMAC key is separate and never reaches storage.
- The first signed trial remains this workstation plus one protected-main AWS
  CI job, isolated writer19427/reader19428, namespace
  `team_beep_signed_canary_v1`, at most50MiB aggregate synthetic artifacts,
  200 Class A and2000 Class B operations, ten minutes of trial execution and
  thirty-day artifact retention. These are execution ceilings, not evidence
  the trial ran. Freeze current source/workflow and qualification approvals,
  prove grants and key delivery, and prepare rollback before activation.
  Existing ordinary cache services and prior-epoch recovery remain available.
- Reversal removes only the separate trial token resources after stopping trial
  consumers; it does not destroy the shared bucket or change ordinary grants.
  Actual signed activation, rotation and representative windows remain pending.


### Actual trial role creation, 2026-10-29

- Apply only the two separately owned Alchemy trial roles through the existing
  Cloudflare CLI OAuth authorization after the provisioning API token is denied.
  Keep the OAuth value in memory; do not create a broader management credential.
  Exact active policies and direct storage operations prove only those roles.
  Keep them unassigned until runtime/key handoff and signed readiness pass.
- Require whole-second UTC expiry at the API boundary. Accept an explicit
  reviewed-deploy confirmation through the wrapper while plan/destruction reject
  unattended confirmation. Preserve the original denied and invalid-date
  requests rather than rewriting the earlier plan checkpoint.
- Retain owner-only state and its private recovery archive. Reversal is to stop
  any trial consumers and destroy only this separate token stack using current
  approved management authorization. No bucket is removed. Actual revocation,
  epoch rollback and consumer requalification remain required before activation.


### Preserve the compiler interpreter in Docgen launches

- 2026-10-29: Remove only `--bun` from the repo CLI's `beep:docgen`
  implementation script. Docgen's executable already selects Bun by its
  shebang; forcing every child named `node` through Bun is unnecessary. Keep
  the canonical generated task wrapper, compiler argv, examples and checks.
- Two full default Docgen attempts in the producer lane ended with exit 130 during
  example typechecking, while all 3,560 generated examples compiled under the
  direct Node and Bun compilers and both Effect process backends. The complete
  launch without the force flag passed. A fresh repair-lane before/after pair
  also passed with both commands, so this is an intermittent compatibility
  observation, not a proven deterministic upstream compiler defect.
- Verification runs the real full Docgen command, the script generator and
  package lint/check. Reversal restores the prior implementation string;
  this change grants no cache qualification, credential access or signing.


### Signed supervisor runtime aliases, 2026-10-29

- Bind the exact selected Bun and Node files at private `/tools/bun` and
  `/tools/node` aliases, and search only `/tools:/usr/bin` in the outer signed
  worker. The real Bun file may be named `bun.native`; mounting that file at
  its original path does not provide the `bun` command used by tool discovery.
  Preserve original-path mounts, private networking, explicit clean runtime
  configuration and independent executable content checks. Add no host tools
  directory to the existing read-only mounts; use the fixed search path.
- Reversal leaves signed experiments disabled and reverts this launcher fix.
  This repair grants no producer, qualification or signed production authority.


### Deterministic contained-directory error control, 2026-10-29

- Exercise the existing filesystem parent-creation error adapter with a scoped
  service failure and its actual typed platform cause. Require the contained
  root, target and failing directory, preserved cause, and no target write.
  Restore the spy through its scope finalizer. Retain existing coverage floors;
  do not depend on incidental concurrent filesystem errors to reach the branch.
- This test-only repair changes no filesystem implementation or cache policy.
  Reversal removes only the new fixture; it grants no cache qualification or
  production authority. Fresh component final and consumer proof remain required.


### Owned graph upload join preparation

- 2026-10-29: Extend the existing pure upload join with the complete independently
  reviewed task-id closure, retaining the one-task default. Check exact graph
  membership, duplicates, the 64-task bound, canonical hashes and successful
  fresh execution for every node before selecting the upload task. This closes
  the selected-task filtering gap without creating a new producer authority.
  The supervisor must supply the reviewed closure and actual complete capture;
  caller-supplied schema values alone remain untrusted. Reversal is to stop
  multi-task producer publication and restore the single-task profile. No
  signing, production configuration or qualification state changes here.


### Private producer socket transport

- 2026-10-29: Keep the signed worker's private network namespace. Reuse the
  existing bounded conformance observer with a companion Unix listener and the
  platform's Unix-capable HTTP client. Allocate a fresh owner-only temporary
  directory/socket and redact its address; mount only the selected socket into
  the worker. Preserve the existing TCP API and upstream role/tenant enforcement.
- The socket is transport, not upload authority or producer attestation. Actual
  backend results, native task/byte capture, the approved supervisor and immutable
  protected publication remain required. Reversal leaves the companion unwired
  and keeps the existing loopback observer. No live service or credential changes.


### Combined prerequisite proof and private pilot storage

- 2026-10-29: Integrate the same executor's Docgen, pinned-runtime and private
  transport prerequisites in PR2367. Preserve each original source and receipt;
  require one fresh combined package/final/hosted/review proof rather than
  repeatedly rebasing the same goal-document append conflicts. Original branches
  are retained until that integration passes and merges. This grants no trust
  readiness, task qualification or production activation.
- A synthetic bwrap probe confirmed that source-contained private files could
  be read through their guest alias. Move supervisor and experiment storage
  outside every source input mount, use scoped mode0700 directories and an
  explicit approved dependency link, and refuse source-visible storage before
  writing the request. Preserve exact runtime aliases and private networking.
  Actual repaired native confinement remains required; earlier original-path
  denial alone is insufficient. The larger upload-approval prototype stays in
  its own lane and must consume this accepted prerequisite through main.
- Reversal retains the original branches before merge and uses a reviewed
  revert after merge. No bucket, live service, credential, signing switch,
  proof floor or runner-capacity setting changes in this integration.


### Containment refusal proof strategy

The coverage repair changes only the orchestration fixture and its evidence.
Use package lint/type checks and both runtime replays for that edit, then require
the fresh complete canonical final and hosted coverage gates on the new head.
The prior complete package pass retains its original 0d source scope. A combined
coverage diagnostic guides the repair and never replaces fresh acceptance.
Preserve every coverage floor, uncovered-count bound and full-goal obligation.


### Closed upload execution and private scratch boundary

- 2026-10-29: Bind the upload target descriptor and artifact key to independent
  approval; snapshot the caller request and runtime, require the approved client,
  channel and live normal-source revision/profile, and authenticate the owned
  upload join inside the existing producer bundle. Reuse the bounded observer,
  full native summary, complete task closure and private Unix transport. Runtime
  descriptor agreement alone does not prove adapter process or storage-grant
  identity; the protected entrypoint still needs that actual evidence.
- An actual synthetic bwrap probe found that source-contained private files were
  readable through the guest checkout alias even while their original paths were
  absent. Move supervisor captures and pilot scratch outside every input mount,
  into scoped mode0700 temporary directories, and remove the source experiment
  writable bind. An explicit read-only dependency link preserves worker imports.
  Retain the failing layout as a counterexample. Earlier confinement observations
  do not establish the repaired native boundary. The qualification ledger has five
  excluded entries and no qualified grants; no ledger transition is needed here.
- Reversal keeps this source path unwired and stops any future trial consumers
  before reverting it. Ordinary R2, the bucket, live grants and signing activation
  are unchanged. Actual native execution, protected publication, credential
  handoff, rotation, rollback and representative windows remain required.


### Explicit signed adapter exec decision

Reuse the existing adapter launcher through an explicit `serve-signed` mode.
The ordinary installed service keeps its existing entrypoint. The new mode
requires an independently approved binary/digest, namespace and role, and sends
only the backend environment. The artifact signing key remains client-only.
This decision closes the missing launch-environment prerequisite without adding
a service or granting producer authority. The parent must still own and attest
the real process/listener, resource envelope, approved grants and cleanup.
Revert the additive mode to reverse it before use; no live activation accompanies
this source change. See the source-bound launch checkpoint.

### Owned upload backend lifecycle decision

Acquire the reviewed backend only inside the late upload phase, after the full
signed matrix, protocol experiment and independent workflow/configuration gates.
Bind its executable digest, storage endpoint and bucket into the approved
target. Snapshot parent-held storage capabilities separately from native client
capabilities. Reuse the existing private supervisor storage and process runner.

The shared user-unit runtime carries startup data through an anonymous pipe,
requires the measured 256 MiB/two-CPU/sixteen-task envelope, ten-minute lifetime
and ten-second stop bound, and checks the same executable/PID/listener before
and after the callback. Missing user-manager support fails explicitly. Include
the sanitized lifecycle and successful cleanup in the issuer-authenticated
bundle; an upload without its approved lifecycle cannot be issued.

2026-10-30: admit the entire upload before acquiring its owned backend. Reuse
one scheduler admission around acquisition, private proxy/worker, post-load
verification and cleanup; do not nest a second admission after backend startup.
The callback gets nine minutes after readiness inside the existing ten-minute
backend cap. The readiness and post-load frames each retain their twenty-second
bounds, and the unit retains its ten-second stop bound. A longer queue consumes
no backend lifetime. Prove this ordering with a queued eleven-minute control and
a timed-out callback whose real inert peer is gone before return. Reverse by
stopping future consumers before reverting the composition; never restore the
early-acquisition path for a live consumer. No live runtime cap is increased.

This is a local component and launch-contract change. Actual R2 grants, normal
source execution, immutable protected publication, platform qualification and
representative windows remain required. Reverse it by stopping any future
consumers before reverting the additive runtime/receipt path. The ordinary R2
service and CI launcher remain on their existing route; this commit activates
no consumer, key, grant, service, bucket or subscription.


### Canonical upload profile and shared dependency evidence

- 2026-10-30: Validate the complete canonical loopback and account-specific R2
  URLs rather than maintaining parallel component predicates. Retain every
  approval, capability, namespace, policy and executable-pin requirement. The
  bounded profile also refuses empty query/fragment delimiters, which do not
  belong in the approved endpoint identity. Counterexamples recompute matching
  approval digests first, so approval agreement alone cannot bypass the profile.
- Reuse one existing dependency owner's contained, digest-verified UTF-8/schema
  reader across the pilot and both supervisors. Installed-tree verification
  remains a separate requirement. The generated valid-byte replacement control
  must fail if digest verification is removed, and the source restores exactly.
- Reverse by reverting the additive extraction/profile change before enabling
  a consumer that requires it. No running cache, credential, signing mode,
  backend selection, paid service or proof threshold changes in this repair.


### Producer execution coverage and exact report decoding, 2026-10-30

- Current-head CI on the integrated producer exposed missing execution coverage
  in three files. Each trusted internal supervisor caller now supplies its exact
  schema decoder; remove redundant union guards after decoding while preserving
  capture, issuer-material and complete matrix verification.
- Test the actual scoped Unix transport with deterministic native-task execution,
  write-only access, complete fresh closure and failed-graph refusal. Cover the
  workflow upload composition, independent activation/source refusal and the
  admitted local route. These controlled tests grant no producer authority.
- The upload composition fixture uses `NodeHttpServer.layerTest` and an ephemeral
  TCP port. It asserts the worker's fixed Unix-agent request before routing the
  test agent to that port; `cache-private-socket.test.ts` separately owns actual
  Unix transport and scoped lifetime proof. Remove the rejected test-only native
  HTTP import and diagnostic suppression; no policy exemption is introduced.
- Preserve every coverage floor. The current focused Node diagnostic meets all
  three files' floors; empty initial include-filter reports count as no coverage.
  Full committed-source package/final/hosted proof, reviews and rollout gates
  remain required. See the source-bound coverage repair checkpoint.


The pre-push policy replay found three inline schema compilations and one
fixture verdict rule above the Fallow limit. Reuse the module-scoped JSON codec
and match the named exit cases before the existing mutation rules. Current
Node/Bun controls, root inline policy and both Fallow checks pass; every Node
coverage floor is unchanged and met. The failed publication pushed nothing.


### Singleton adapter frames and encoded provenance controls, 2026-10-30

- Let the existing Effect Stream own one decoded frame per pull through
  `rechunk(1)`. Remove the unreachable local tail queue while retaining the
  final pull that refuses every extra frame and the owned process cleanup.
- Build hosted forgery fixtures from the schema-encoded wire report. Runtime
  Option objects are not wire fixtures; decoding them refused before provenance.
  Assert the intended identity/binding/unique-upload error, plus both batched
  and delayed adapter-frame refusals. Guard-removal controls must fail.
- Reverse by restoring the local queue and its bounded final-pull check; retain
  the corrected schema-encoded controls. No trust, rollout or proof gate changes.



### Closed producer command and private execution settings, 2026-10-30

- Add `cache producer-run` as the operational caller of the existing owned
  producer workflow. Its arguments select an experiment request and bounded
  output; issuer, destination and credential selection come from supervisor
  configuration.
- `BEEP_CACHE_PRODUCER_STORE` selects an already provisioned owner-only store.
  Reuse its independently approved `approval.json` and existing issuer material;
  read the nonsecret target/executable profile from private `runtime.json` using
  the same bounded, no-follow, single-link record reader. Opening neither
  creates a store nor changes its approved binding.
- Authenticate approval and the destination digest before looking up signing,
  storage or transport capabilities. Apply the existing upload-profile checks
  and reject any artifact-key value reused as a backend capability. Keep all
  resolved capabilities redacted and unserialized.
- Provide the command's actual HTTP and admission services at its command
  boundary. Preserve existing approval-read diagnostics while sharing record IO.
- Reversal: remove this command and its private execution profile; retain the
  approved issuer, observations and ordinary R2 setup. No production activation
  or protected workflow execution is implied by this source change. Explicit
  trusted provisioning, actual runner qualification, immutable publication,
  normal-source qualification and the complete observation windows remain gates.


### Credential-free protected source inspection, 2026-10-30

- Reuse the existing producer workflow inspector through `cache producer-inspect`.
  Require an output file, bound the encoded report including its newline to four
  MiB, and print only a fixed status line. Inspection never opens the producer
  store, reads credential configuration, grants approval or runs a producer.
- Prepare a separate manual, main-only inspection workflow with exact source
  checkout and the existing protected environment/AWS runner. Explicitly disable
  cache and secret setup; limit runtime to ten minutes, concurrency to one group
  and the single run/attempt artifact to one-day retention. No workflow has run.
- Source/tool observations support independent provisioning. They do not prove
  namespace, user-manager or cgroup readiness and cannot substitute for the
  authenticated producer artifact. Those real host and producer gates remain.
- Reverse by removing this inspection caller and its workflow. Preserve the
  inspector and existing trust authorities; no runtime or cloud state changes.


- Resolve the inherited-adjacent baseline/transition reader clone in this touched
  command file. Share a named Effect reader and module-scoped existing codecs;
  preserve external review paths and caller-owned typed failures. The bounded
  contained experiment reader retains its distinct policy. Reverse by restoring
  the prior two equivalent readers; no authority or persistence model changes.


### Independently provisioned producer material, 2026-10-30

- A protected runner must use the issuer material whose binding the independent
  verifier already trusts. Generating an unrelated runner key cannot establish
  cross-host provenance. Reuse the existing approval, execution profile, issuer
  store and verification authority; do not add a PKI or parallel registry.
- Closed supervisor configuration selects private provisioning inputs and an
  exclusive execution store outside its source checkout. Each deployment must
  keep every material copy outside every worker mount; the current CLI enforces
  its supervisor-checkout boundary. The actual protected workflow remains a gate.
- Read existing strict bounded owner-only records plus optional redacted
  ninety-six-byte material. Check its binding suffix before reserving a store.
  The install command requires transferred material and never silently creates
  a replacement. Independent verifier material remains off the runner.
- Before installation, validate approval, destination digest, executable digest
  and live source identity. Reopen the installed private profile, compare exact
  encoded selection and inspect source again. Revoke a newly reserved store on
  post-reservation failure or interruption; preserve any pre-existing store.
- Local producer output remains bounded at eight MiB. This is not the hosted
  transport limit: the existing immutable archive and member bounds still apply.
  Secure material transport, a real protected execution and its publication are
  unfinished. No credential or secret value enters arguments, logs or artifacts.
- Reversal: revoke execution stores through the existing authority, remove these
  installation callers and private inputs, and retain verifier stores and prior
  observations. Ordinary R2 and signed-activation state remain independently held.


### Concrete private runtime validation, 2026-10-30

- Keep one implementation of upload target, key separation, adapter policy and
  owned capability snapshots. The optional experiment API retains paired
  approval/runtime absence; the private loader calls the concrete validator
  after requiring upload approval and checking its target before credentials.
- Do not unwrap a redundant optional result in the private loader. Its
  independently approved store and locally constructed capability are concrete.
  The same validator still returns the owned snapshot on both paths.
- Prove a store without upload approval fails before any credential provider
  is consulted; moving lookup earlier must trip the denying provider control.
  Existing optional no-upload experiments retain their behavior.
- Reverse by recombining the same validator with the optional API and restoring
  the loader caller. Keep the denial-before-lookup case and snapshot controls.
  No runtime, grant, profile or production setting changes.

### Complete observation publication binding, 2026-10-30

- Extend the existing bounded hosted report with a versioned complete-observation
  digest and exactly one owned upload. Keep v1 readable as upload-only evidence;
  it cannot satisfy the new complete-observation join. Hash the canonical schema
  encoding of the complete observation, including its envelope and both native
  matrices, which is the encoding consumed by the existing acceptance owner.
- Reuse authenticated GitHub metadata, approved workflow bytes and immutable ZIP
  verification. The strict join must also match the independent computation
  binding and exact owned upload. Keep the one-MiB ZIP, sixty-four-KiB member,
  ten-second inspection and twenty-four-hour lifetime unchanged.
- This component remains observation-only. Independent issuer/MAC verification,
  current-source admission and complete qualification policy stay mandatory.
  The protected publisher and acceptance consumer must use this join before any
  production qualification claim; no verified boolean or new trust store is added.
- Reversal leaves complete-observation consumption disabled and retains the
  legacy upload-only decoder. No endpoint, credential, signing or epoch changes.

- Publication preparation takes only an independently configured run/attempt,
  which exists before upload. Reuse that schema inside the later artifact
  reference, whose real artifact ID remains mandatory during verification.
  No placeholder identity is introduced and the report wire format is unchanged.


### Strict publication at acceptance and operational reads, 2026-10-30

- Require both channel publications in the existing authenticated import owner.
  Legacy requests remain decodable for preview, with explicit missing-publication
  failures; they cannot persist acceptance or authorize an operational transition.
  The fixed private issuer store supplies `publication.json`; submitted requests
  select neither workflow approval, credentials nor an alternate trust directory.
- Reuse the existing protected GitHub metadata and bounded immutable ZIP verifier.
  Bind the entire canonical observation and its exact owned upload, retain both
  issuer/MAC checks, and re-read both private publication approvals after both
  channel checks. Refuse a stable approval replaced during canary verification.
- Compose one lazy metadata capability into the existing cache and quality
  commands. Resolve credentials only for a supplied publication, scope each
  metadata client to one verification, and release it before returning on success
  or failure. Existing expiry, revocation, live-source and policy checks remain.
- Controlled physical ZIP, private-file and CLI tests cover acceptance, persistence
  and operational rereads; source-removal tests cover the strict join, final
  publication approval reads and final issuer checks. These tests use fixture
  metadata and do not prove a real protected publication or signed R2 execution.
- Continue locally from the committed producer lifecycle repair while its PR is
  open; keep this dependent branch unpublished. Retain a recovery ref and exact
  seven-commit patch, then replay only this branch's commits after its exact parent
  onto accepted main before publication. Never rebase the published parent PR.
- Reverse by disabling acceptance-driven qualification and reverting this consumer
  wiring while retaining prior private records and observations. Do not restore
  unsigned remote fallback or loosen the independent source and issuer policies.
  Ordinary R2 and inactive signed-trial state are unchanged.


### Manual inspection governance, 2026-10-30

- Classify the new manual source-inspection context through the existing explicit
  orchestration inventory. It emits operational source evidence, not a required
  quality verdict or a new CLI lane; do not expand required-status authority.
- Keep the workflow policy checker active. Pin dispatch-only execution, protected
  main, contents-read permission, the existing environment, ten-minute deadline,
  all five disabled setup capabilities, disabled inherited host cache and one-day
  artifact retention in the security suite.
- The first default package proof found the missing mapping (introduced). The
  repaired security/lane suite passes 127 cases on each runtime, with quick
  verification passing. Fresh default and combined final/hosted proof remain
  required; this does not prove actual protected inspection or signed execution.
- Reverse by removing the still-unused inspection workflow and its exact mapping
  and policy case together. No credential, permission, status or runtime change.

### Owned command publication output, 2026-10-30

- Extend the closed producer command with optional publication output rather than
  adding another runner or editable report authority. Derive the existing v2
  report from the exact observation returned by the owned execution.
- Read run/attempt from workflow configuration using the existing positive-safe
  identifier schemas before capabilities load. Require a separate private full
  observation file and the fixed `cache-producer.json` upload member. Never accept
  replacement uploads, issuer authority or artifact identity as command arguments.
- Preserve observation-only callers without GitHub configuration. Prepare the
  owned publication before either file is changed and keep report/observation
  bounds at 64 KiB/8 MiB including newline. Immutable publication, independent
  approval and authenticated acceptance remain later gates; local files alone
  confer no producer or qualification authority.
- Reverse by removing the optional publication flag and associated output wiring;
  retain existing observations and strict acceptance requirements. No credential,
  protected workflow, cache configuration or production change occurs here.

- Adjacent quality audit: consolidate the duplicated expected/actual diagnostic
  severity calculation into the existing one-pass Array idiom; preserve every
  diagnostic and refusal. Retain the separately reported filesystem-presence
  idiom: SAST canonical-path/security selection and JSDoc text diagnostics have
  different policies and absence results, with no shared behavior beyond the
  existing FileSystem primitive. Record the source judgment and leave the raw
  warning intact; add no suppression or baseline relaxation.
