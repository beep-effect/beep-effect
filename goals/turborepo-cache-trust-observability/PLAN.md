# Turborepo cache trust and observability plan

## Status

Status: `active`
Lifecycle: `active`

Launched for the early handoff required by task qualification, under the
operator's delegated blocker-resolution authority. The initial work landed in PR #1327; remaining implementation is on
`codex/qualification-signed-implementation`, with one writer for Cache contracts
and fixtures and one final PR planned. This slice produces
local signed-boundary evidence; it does not claim whole-packet completion or
production readiness. Remaining comparison/deployment milestones retain their
SPEC gates. Prefer local fixtures with no incremental cloud resources.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Threat and receipt contracts | in-progress | Refresh actor/credential/namespace topology and agree typed outcomes with conformance and qualification. | Versioned contracts and explicit secret-safe configuration; no source-as-deployment claims. |
| P1 Posture and safe events | pending | Implement fail-closed client posture, bounded result/producer receipts and redaction fixtures. | Missing-key and synthetic-secret negative tests pass; metrics labels are bounded. |
| P2 Adapter and epoch remediation | pending | Implement opaque tags, independent method/storage policy, tenant binding and namespace rotation in the lab adapter. | Conformance negatives pass without distributing the artifact key to the backend. |
| P3 Production hardening and observation | pending | Prepare and execute scoped incumbent hardening after concrete rollout gates; coordinate cohort wiring with adoption. | Seven-day nonprod, seven-day cohort and fourteen-day broader evidence plus rollback, where production hardening is deployed. |
| P4 Verify and hand off | pending | Run package/Lambda/contract tests, direct fault attribution and key/epoch rollback drills. | Trust-readiness receipts are reproducible and available to adoption. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet and close reviews/hosted failures. | Yeet monitor reports merge-ready: yes on final head. |
| P6 Close | pending | Land trust evidence, reflection and lifecycle with final implementation work. | Same-PR closeout; deployed limitations remain explicit. |

## First action

Refresh the checked-in and applicable deployed trust boundary, then define the cache-result and protected-producer receipt contract with the conformance owner.

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
