# Turborepo cache trust and observability plan

## Status

Status: `active`
Lifecycle: `active`

Launched for the early handoff required by task qualification, under the
operator's delegated blocker-resolution authority. Initial work landed in PRs
#1327 and #1389. Current completion work is owned by
`codex/turborepo-goals-completion`, with one writer for Cache contracts and the
two requested packets. The retained qualification slice produces
local signed-boundary evidence; it does not claim whole-packet completion or
production readiness. Remaining comparison/deployment milestones retain their
SPEC gates. Prefer local fixtures with no incremental cloud resources.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Threat and receipt contracts | in-progress | Refresh actor/credential/namespace topology and agree typed outcomes with conformance and qualification. | Versioned contracts and explicit secret-safe configuration; no source-as-deployment claims. |
| P1 Posture and safe events | in-progress | Implement fail-closed client posture, bounded result/producer receipts and redaction fixtures. | Missing-key and synthetic-secret negative tests pass; metrics labels are bounded. |
| P2 Adapter and epoch remediation | pending | Implement opaque tags, independent method/storage policy, tenant binding and namespace rotation in the lab adapter. | Conformance negatives pass without distributing the artifact key to the backend. |
| P3 Production hardening and observation | pending | Prepare and execute scoped incumbent hardening after concrete rollout gates; coordinate cohort wiring with adoption. | Seven-day nonprod, seven-day cohort and fourteen-day broader evidence plus rollback, where production hardening is deployed. |
| P4 Verify and hand off | pending | Run package/Lambda/contract tests, direct fault attribution and key/epoch rollback drills. | Trust-readiness receipts are reproducible and available to adoption. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet and close reviews/hosted failures. | Yeet monitor reports merge-ready: yes on final head. |
| P6 Close | pending | Land trust evidence, reflection and lifecycle with final implementation work. | Same-PR closeout; deployed limitations remain explicit. |

## First action

Refresh the checked-in and applicable deployed trust boundary, then define the cache-result and protected-producer receipt contract with the conformance owner.

### Current checkpoint: 2026-10-28

The current producer, protocol and client-posture unit/fixture set passed 98
tests across three files at source base `8f19a8ad84`. These results do not prove
deployed signing, current native protocol behavior, tenant isolation, epoch
rotation or representative production observation. The current completion audit
in `research/current-completion-audit.json` keeps all nine acceptance criteria
and eight implementation-contract paragraphs unproven until their required
evidence is obtained. The old private-loopback qualification is retained under
its original source, profile, clients and epoch.

## Dependency gates

Receipt schemas can be authored alongside qualification's early policy
contract. Conformance consumes those schemas and supplies direct negative-case
results. Apply adapter fixes in its lab before production. Coordinate the named
hosted cohort with adoption, without waiting for adoption's entire program to
finish. If replacement is selected, cutover belongs to the reopened migration
packet; incumbent hardening remains this goal's responsibility otherwise.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

typed receipt schema/version; actor/capability and tenant matrix; signed and
corrupt artifact receipts; synthetic-secret captures; epoch/rollback drill;
scoped deployment and seven/seven/fourteen-day observation; package/Lambda
verification and Yeet proof.

Store compact receipts in research/history and large raw evidence in bounded
artifacts. Record source/tool/profile/epoch identity, command/case, result and
retention. Register new reports in the manifest. Record friction immediately
in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md). Missing evidence is unfinished
work, not an implied pass.

## Verification and attribution

Apply the SPEC matrix to actual changes. Package editors run package-verify
before handoff. Attribute failures as introduced, inherited, unrelated or
environment-only before repair. Preserve dirty work and use canonical
admission/worktree workflows for heavy experiments.

## P6 closeout checklist

P6 preparation can occur during P5 so final reflection/lifecycle land with the
final implementation. Acceptance still requires final Yeet proof. Do not defer
closeout to an unrelated state-only PR.

1. Confirm every SPEC criterion and applicable representative observation.
2. Use the reflect skill and copied reflection template to record tooling
   friction, implementation opportunities and prompt critique.
3. Run `bun run beep lint reflection-artifacts`.
4. Update phase evidence and use
   `bun run beep goals set-status turborepo-cache-trust-observability completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.

## Local reader confinement checkpoint: 2026-09-29

The [stable](./research/native-isolated-stable-probe.json) and
[canary](./research/native-isolated-canary-probe.json) probes each passed six
native cases and three direct authorization denials. Native clients run inside
separate user/PID/mount namespaces with only their fixture writable; protected
archive and producer-receipt files remain outside the mounts. Each of five
reader runs failed explicit read/write attempts against both protected files
and the host parent environment. Parent-side digests stayed unchanged.

Valid signed replay restores the producer output; missing/invalid tags, corrupt
bytes and the wrong key restore no output. All fixture files and captured
streams were scanned against the synthetic credentials before they left memory.
Independent review joined native summaries, request events, stored archive and
producer-receipt digests. Sixty files per channel are retained privately with
SHA-256 manifests, each below the four-MiB bound. Earlier write-only calibration
runs are retained separately and do not replace this stronger result.

This proves the stated local fixture boundary, not CI workflow provenance or a
qualification transition. The owned runner, trust/result contracts, importer
negative tests and three real-pilot signed pairs per channel remain required.
No production backend, AWS resource, credential lane or telemetry window was used.

## Producer envelope prototype: 2026-09-29

A private in-memory prototype now authenticates normalized v2 pilot receipts
using a separate supervisor-only HMAC-SHA256 key and fixed expected bindings.
It uses the standard Node crypto implementation; no new PKI is introduced.
The 26-check result is retained in
[producer-envelope-prototype.json](./research/producer-envelope-prototype.json).
Checks cover valid verification, payload/binding/time/MAC changes, unknown issuer,
invalid issuance, and mutation of a returned binding object. Trusted bindings
are snapshotted to prevent returned-object aliasing from changing issuer policy.

This prototype is not installed in the CLI. Its expected bindings are test
configuration; workflow approval, durable issuer storage/revocation and the
operational importer remain required. No promotion authority is claimed.

## Owned producer core: 2026-09-29

Integrated producer binding/body/envelope schemas and an internal in-memory
issuer factory. The factory snapshots trusted configuration, holds a separate
non-extractable Web Crypto HMAC key, checks source/workflow/client/channel/runtime/
profile/epoch bindings, and limits validity to 24 hours. It does not expose a
public signing command or persist its key. Shared signed-pilot test data now
lives in a test helper rather than duplicate fixture definitions.

Typechecking and all 42 focused tests pass, including true clock-driven expiry
and mutation of both input and returned binding objects. The owned implementation
also passes 28 checks against the real stable v2 receipt. That source snapshot passed full package proof
(audit 665.5 seconds; docgen 20.2 seconds). See [owned producer core](./research/owned-producer-core.json).
Independent workflow approval, durable issuer storage/revocation and operational
import remain unmet; no qualified state has been enabled.


## Durable producer lifecycle component

The internal issuer now has explicit exclusive provisioning, reopening and
revocation. Reopening verifies receipts across process restarts using a private
owner-only store. Each issue/verify rechecks store safety, revocation and key
replacement. Missing material is never silently regenerated. The implementation
reuses contained reads and private-directory validation; the trusted host
operator remains outside the adversary model.

Source checking and 13 issuer tests pass. Four separate Bun processes issued,
verified, revoked and rejected the issuer against the real stable v2 receipt.
The probe used synthetic workflow approval identities, removed its temporary
material and grants no qualification. That source snapshot passed full package verification
(audit 672.6 seconds; docgen 19.6 seconds). See [persistent issuer checkpoint](./research/owned-producer-store.json).
Independent workflow approval, actual store integration with the protected
supervisor and operational qualification import remain required.


## Approval binding and actual issuer probe

Provisioning now fixes a domain-separated digest of the approved binding in
private material. Reopening under any changed binding is refused. The 96-byte
format intentionally rejects the earlier 64-byte component format; no accepted
persistent issuer exists to migrate. All 15 issuer tests pass, including 12
changed bindings and a symbolic directory alias. The expanded focused set passes
51 tests. Full package proof of this newer source is running.

The signed supervisor can now probe a selected actual key path from every
nested reader and compare key bytes before/after the experiment. It never adds
that path to the mount list or passes key bytes to the worker. Evidence remains
optional and observation-only; an absent field is not issuer protection.
The native run initially rejected a stale activation due to changed host startup
libraries. Its current-host rerun uses separately refreshed activation/runtime
bindings; historical observations are not relabeled.
See [approval-bound component](./research/owned-producer-approval-bound.json).


The stable current-host experiment has now passed all three actual-key denial
checks, authenticated its new observation, reopened the same issuer to verify
it, and rejected verification after revocation. Temporary key material was
removed. [The compact receipt](./research/actual-persistent-issuer-stable.json)
keeps the synthetic workflow-approval limitation explicit. Canary also passed the same three-pair actual-key, authentication, reopen and
revocation checks; its [receipt](./research/actual-persistent-issuer-canary.json)
retains separate client/runtime bindings. Full package verification remains running; operational trust is not yet granted.

## Supervised issuer workflow checkpoint

[Owned workflow evidence](./research/owned-producer-workflow.json) records the
new closed issuance route. It opens an already provisioned approval-bound issuer,
checks the live workflow revision and implementation digest before and after the
owned signed pilot, and authenticates only that returned observation. A native
stable-client control passed; changed workflow identities and revoked material
were rejected. Twenty-seven focused tests and the source check pass. Full package
verification passed for the recorded source snapshot (audit 712.7 seconds,
docgen 24.8 seconds).

This is component evidence. The fixture policy approval is synthetic, and the
declared source inventory does not yet close ignored executable inputs or
workspace-local module resolution. Those profile gates and operational import
remain required before qualification. Current-host stable and canary probes
separately established denial of access to the actual persistent issuer material.

## Frozen execution profile implementation

The [frozen-profile checkpoint](./research/owned-producer-frozen-profile.json)
records workflow format v2. Inspection now requires clean declared source paths
and rejects ignored executable additions, workspace-local dependency overrides
and root dotenv names. Issuance also checks that the named checkout supplies
the loaded supervisor module. Signed workers disable Bun dotenv loading and
runtime automatic installs. Eleven workflow tests and the broader 33-test
focused set pass, as does the source check. Native dotenv suppression passed.
Supervised issuance and reopening passed under the new profile. Native
controls rejected a different claimed checkout, an ignored workspace module,
changed workflow identities and a revoked issuer. Full package verification
passed (audit 638.8 seconds, docgen 27.0 seconds). These checks do not grant policy approval or qualify a computation.

### Private approval verifier

The [private approval checkpoint](./research/owned-producer-private-approval.json)
records a verification-only capability loaded from supervisor-owned approval.
Provisioning writes the binding separately from submitted evidence and fixes its
digest in issuer material. Opening rejects edited, missing or unsafe approval;
live verification rechecks the approval, key material and revocation. All 39
focused tests and source type checking pass. Full package verification passes:
audit 649.6 seconds and docgen 39.2 seconds.
The accepted policy document, complete authenticated evidence bundle and
operational promotion importer remain open. No qualification is granted.

## 2026-10-28: signed-client posture component

The current component handles artifact-key reference routing through the existing
secret session, optional host references, fork/direct scrubbing, and metadata-only
reader/writer/canary decisions. A required missing or unresolved reader key forces
local selection and execution; writers and signing canaries fail closed. Canaries
also reject unsigned configuration. Root configuration is bounded, no-follow and
strict UTF-8; alternate config and working-directory overrides are refused before
selection. Native inspection clears conflicting legacy cache environment flags.

The [component checkpoint](research/signing-posture-checkpoint.json) binds source
hashes to 148 focused tests and ten real runtime controls on each pinned stable
and canary binary. The resolved-key positive control contacts the isolated remote
endpoint; missing-key readers execute with zero HTTP requests; prohibited writers,
canaries and alternate-policy requests produce no task output or HTTP request.
This is component preparation. The full package audit and docgen passed from the
default enrolled root (1125.9 and 37.3 seconds). No signing activation, credential
change, backend tenant hardening, namespace rotation, production qualification or
observation window is claimed. P1 and later acceptance remain open.

### Current native checkpoint: 2026-10-28

`research/current-native-checkpoint.json` binds the current protocol source
bytes to stable 2.11.10 and published canary 2.11.9-canary.1 runs. Each completed
six signing/replay cases and three transport-failure cases over nine isolated
roots and 23 wire events. Valid replay restored the expected 28 bytes; rejected
cases materialized no outputs. The focused runner/protocol/producer/posture
suite originally passed 136 tests; that verification snapshot is retained
separately. After signing-posture integration, the current combined suite passed
240 tests with refreshed verification-source bindings. The native artifact bytes
and protocol source hashes are unchanged. Wrong-team native proof, deployed
R2/AWS capabilities, epoch rotation, production provenance and representative
observation remain open. No whole acceptance criterion is closed by this checkpoint.

## 2026-10-29: finite backend-result capture

The optional exchange field preserves fifteen pinned adapter labels, with a
static invalid-evidence result for incompatible method/status pairs or unknown
claims. Direct and proxy controls retain failure causes through JSON and reject
synthetic credential/path/artifact text. A known-written object returning 404
remains not-found; the backend header cannot establish a genuine miss. Historical
receipts default to absent attribution. The focused set passes 34 tests, and
package lint/check pass. The full audit (1068.2 seconds) and docgen (275.4
seconds) passed on their frozen recorded source. The later test-codec hoist and
schema-catalog refresh have separate current-source checks in
[the component checkpoint](research/backend-result-checkpoint.json).
The corrected integrated source passes 236 tests across ten files, package
lint/type checks, repository oxlint and the current 9,328-entry schema catalog.
The census was refreshed and every recorded source digest verified.
Protected producer integration, production event capture and representative
observation remain open. No current adapter/service/cloud configuration changes.


### Current signing/backend-result integration

The reviewed signing component and backend-result component now pass 249 tests
across ten files on their combined source. Package lint (6.4 seconds) and check
(15.3 seconds) pass; the canonical catalog contains 9,333 entries in 173 shards.
All 427 census source bindings were verified. Original 136- and 240-test
verification snapshots and full-audit source maps remain separate historical
evidence. The original native artifact bytes and protocol sources are unchanged.
This integration does not close production, observation or adoption gates.

## 2026-10-29: fail-closed lab capture budgets

The former 5,000-event cap silently discarded later events, and the request-body
error fallback could forward an empty tagged upload. Actual negative controls
reproduce both problems. Atomic request/replay reservations, bounded streamed
replies and incomplete-receipt errors now reject affected traffic. Seven new
controls are part of the passing 256-test integrated suite; package lint/check
pass in 5.7/12.2 seconds, root oxlint passes and the schema catalog is current.
The 427 current census bindings verify. Historical full audits are not proof of
this new implementation. See the source-bound
[capture checkpoint](research/proxy-capture-bounds-checkpoint.json). The live
R2 service, producer integration and all representative windows are unchanged.

### Current capture seam and complexity repair

CI attributed one new complexity finding to the request handler. Capture budget
state and admission/recording now live in a private local component; transport
orchestration keeps its existing options and controls. The current combined
suite passes 256 tests in 29.20 seconds, package lint/check pass in 6.9/16.1
seconds, and the exact-source Fallow audit has zero findings. No suppression or
baseline waiver was added. The current source checkpoint retains the earlier
functional proof separately; production and overall acceptance remain open.

### Final main integration for this capture repair

Three reviewed main changes were merged without owned-source overlap. The
selected suite now passes 271 tests across eleven files, including the inherited
ecosystem-polarity tests. Current package lint/check pass in 5.8/15.7 seconds;
Fallow audit, Fallow health and repository oxlint pass with zero findings. The
catalog remains current and all 427 census source bindings verify. Earlier
256-test and full-audit snapshots remain separate historical evidence.

## 2026-10-29: hosted request-completion repair

The completed hosted run identified seven introduced assertion-style findings
and an interrupted-upload race. Canonical polarity-preserving assertions,
actual body/handler signals and bounded complete-request settlement now pass
271 tests across eleven files (26.43 seconds), package lint/check (6.6/13.8
seconds), zero-new-finding Fallow audit/health and the full Effect/Vitest scan.
Two separate counterfactuals fail at their intended assertions; three fresh
processes pass under one CPU and a three-GiB limit. See the source-bound
[completion checkpoint](research/proxy-request-completion-checkpoint.json).
Historical full audits are not transferred to these new implementation bytes.
The live R2 configuration, signing setting and all representative windows are
unchanged. Full goals remain active.

## 2026-10-29: bounded candidate adapter runtime

The patched candidate now fixes Tokio core workers, HTTP workers and per-runtime
blocking threads at two. Its portable build passes 49 Cargo tests and the real
20-wire/one-startup/twelve-native control matrix under a synthetic service
envelope. Reader and writer observations each show six threads, enforced
two-CPU/256-MiB/sixteen-task caps and an explicit backend environment. The
previous candidate fails the ambient-worker negative control for the intended
Tokio startup reason. Cleanup also stops an actually activating fixture unit.
The candidate remains inactive; deployed launcher/grant proof and all production
acceptance gates remain open. See the source-bound
[checkpoint](research/adapter-runtime-checkpoint.json) and
[actual process observations](research/adapter-runtime-lab.json).

### Cleanup review repair

The first-error cleanup gap is repaired. Three failure controls pass: an injected
stop timeout and a status-query failure still stop the remaining real owned unit
and reap its child; combined cleanup/log closure failure still attempts every
log and the storage fixture. The original helper fails the intended remaining-
unit assertion. Fresh 20-wire/one-startup/twelve-native controls and four measured
runtime observations pass with zero adapter output. Current infra audit/docgen
pass in 11.0/13.4 seconds. Success evidence is written after teardown. The prior
report remains separate, and the exact Rust patch and binary are unchanged.


### Actual streaming runtime in the Node CI suite

The hosted Node shard exposed a deterministic compatibility-shim deadlock,
reproduced locally before repair. Node now invokes the same physical control
in a bounded Bun child; Bun runs it directly. Both eleven-file suites pass
271 tests, the Node V8-instrumented control passes, and three independent
Node-to-Bun executions pass under a one-CPU quota. Removing either the early-
receipt or empty-upload guard fails both runtimes; exact proxy bytes are
restored. Current package, Fallow and Effect/Vitest checks pass. See
[the runtime checkpoint](research/proxy-node-runtime-checkpoint.json).
Fresh hosted acceptance remains pending; production proxy bytes are unchanged.
