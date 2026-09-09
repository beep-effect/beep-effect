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
