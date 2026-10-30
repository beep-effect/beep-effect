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
