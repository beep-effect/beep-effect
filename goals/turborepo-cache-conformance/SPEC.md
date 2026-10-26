# Turborepo cache conformance spec

## Objective

Deliver a reusable exact-version Remote Cache conformance corpus and a bounded, evidence-neutral comparison of the named backend topologies.

Graduated 2026-09-08 after the user approved the complete
[brief](../../explorations/turborepo-quality-cache/BRIEF.md) and [goal map](../../explorations/turborepo-quality-cache/MAP.md).
The [decision record](../../explorations/turborepo-quality-cache/DECISIONS.md) supplies inherited trust,
qualification, rollout and ownership requirements.

## Non-goals

Out of scope: production cache writes, production cutover, qualification-state ownership, and a new generic Remote Cache SDK.
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

- [packages/tooling/tool/cli/src/commands/Cache/index.ts](../../packages/tooling/tool/cli/src/commands/Cache/index.ts): Protocol runner and result rendering through curated Cache roles.
- [infra/src/CiTurboCache.ts](../../infra/src/CiTurboCache.ts): Existing infra topology; compose a disposable lab without silently changing production.
- [infra/lambda/turbo-cache/README.md](../../infra/lambda/turbo-cache/README.md): Incumbent replica and isolated Lambda build contract; coordinate adapter edits with trust.
- [packages/tooling/test-kit/test-utils/src/ConformanceLedger/ConformanceLedger.test-kit.ts](../../packages/tooling/test-kit/test-utils/src/ConformanceLedger/ConformanceLedger.test-kit.ts): Reuse only helpers whose semantics fit, not its document-conformance domain.

This goal owns tests beside its implementation and its packet evidence.
Record every additional touched workspace in the verification and ownership
list. Only change scripts/configuration where this contract names their role.

## Implementation contract

### Corpus and verdicts

Turn the source corpus plan into generated OpenAPI cases plus hand-authored
semantic/adversarial cases. Preserve case identity and versioned regeneration.
Refresh exact stable, published canary, platform executable digests, OpenAPI
blob and backend source/image/package digests. Keep unpublished main outside
scoring. Never execute an unpinned downloaded binary as a side effect of a
floating package-manager command.

Report strict OpenAPI, stable-client, canary-client, Beep security, observability
and capacity verdicts independently. Exercise status, signed PUT/HEAD/GET,
misses, metadata, optional batch/events, HTTP status differences, tenant/path
normalization, read/write authority, direct invocation, corruption, missing or
wrong tags, epoch changes, timeouts/throttles, ambiguous/concurrent writes,
read-during-write, payload limits, expiry, redaction and rollback. Unsupported
optional routes must be labelled; implemented routes still face their contract.

Turbo's successful task run or apparent miss cannot prove the remote result.
Correlate direct wire and backend/storage receipts, recording rejection before
restore where required. Reuse trust-owned receipt schemas and qualification
identities; do not create competing operational result vocabulary.

### Deployment boundary

Implement a disposable replica of the incumbent, its minimum remediation,
Bruno behind Beep's policy boundary, and an eligible Ducktors topology. Treat
upstream Ducktors and the deployed Lambda wrapper as distinct topologies.
Exact release licenses and deployment obligations must be recorded before use.

Before applying infrastructure, name account/region/stack/namespace, numeric
incremental cost ceiling and alarms, expiration, teardown owner/command,
immutable digests, approved credential lane, and a deployment preview. Derive
load from measured artifact sizes/concurrency, initially twice observed p99
size and 1.5 times peak concurrency. If measurements are unavailable, local
fixtures may continue; do not label guessed load representative. Resolve any
remaining material budget or external-authority choice against this concrete
plan before deployment. Keep the lab isolated from production credentials,
objects, endpoints and write namespaces.

### Comparison and selection handoff

Freeze the inherited rubric before execution. Record both failing baseline
and remediated results. Source inspection cannot earn a hard-gate pass. A
replacement must pass every hard gate and show at least ten weighted points,
at least twenty percent improvement on a predeclared metric, or removal of a
proven blocker without regression. Include retaining/evolving the incumbent.

This goal produces the evidence and recommendation. A passing replacement
recommendation reopens the exploration at decomposition for an explicit backend
selection and conditional migration packet. A substantiated no-eligible result
may complete the comparison goal, but it does not authorize adoption or satisfy
the overall cache program. No unexplained protocol failures may be dismissed.
Retain reproducible local fixtures and bounded comparison evidence after teardown.

## Dependencies and ownership

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.

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

- [remote-cache-contract.md](../../explorations/turborepo-quality-cache/research/remote-cache-contract.md)
- [conformance-corpus-plan.json](../../explorations/turborepo-quality-cache/research/conformance-corpus-plan.json)
- [backend-rubric.md](../../explorations/turborepo-quality-cache/research/backend-rubric.md)
- [version-manifest.json](../../explorations/turborepo-quality-cache/research/version-manifest.json)
- [trust-model.md](../../explorations/turborepo-quality-cache/research/trust-model.md)
- [observability-and-economics.md](../../explorations/turborepo-quality-cache/research/observability-and-economics.md)

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

- [x] The pinned corpus covers all source-plan cases with stable identities, deterministic regeneration and distinct spec/stable/canary verdicts.
- [x] Every executed case has exact-version, namespace/profile and direct wire/backend receipts; faults cannot masquerade as ordinary misses.
- [x] The named topologies receive comparable cases and measured load; source hypotheses are never scored as runtime passes.
- [x] Lab deployment has numeric cost/TTL/load controls, isolated resources/credentials, immutable pins, a preview and successful teardown evidence.
- [x] The frozen rubric yields an attributable recommendation or explicit no-eligible result, with no preselected migration.
- [x] Qualification can consume signed-boundary receipts and the corpus can be rerun as an upgrade gate.
- [x] Relevant package/protocol checks pass; failures are attributed and no
  introduced regression remains.
- [x] The final implementation PR reaches Yeet `merge-ready: yes`, with
  required checks and reviews handled.
- [x] Final evidence, reflection and lifecycle closeout land in that same PR.

Packet creation satisfies no implementation criterion. A partial or blocked
result remains active/paused with receipts, not completed-retained.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet conventions | `bun run beep goals doctor`; `bun run beep explore --check` | No new findings; attribute inherited fleet findings. |
| Launcher | `wc -m < goals/turborepo-cache-conformance/GOAL.md` | At most 4,000 characters; target at most 3,500. |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Pass after editing this package; include every other edited workspace. |
| Package handoff | `bun run beep quality package-verify @beep/infra` | Pass after editing this package; include every other edited workspace. |
| Behavioral proof | Acceptance-specific tests and experiments | Negative cases fail for the intended reason; source review cannot fabricate runtime proof. |
| Reflection and evidence | `bun run beep lint reflection-artifacts` and receipt review | Valid, safe evidence and a closeout reflection at completion. |
| Hosted acceptance | Yeet repair, verify, publish and monitor per current skill | Final head is merge-ready with required proof and handled reviews. |

For infra/Lambda edits, use its existing verification lane and inspect build/temp
targets first. A bundle build is not deployed conformance. Docs-only preparation
needs JSON/link/projection checks; actual implementation needs behavioral proof.

## Rollback

Stop load generation, revoke only lab credentials, and tear down only the
named lab resources after inventory/preview. Preserve sanitized verdicts and
bounded evidence. Report any orphaned resource and actual cost; a teardown
failure prevents lab closure. The production incumbent remains unchanged by
this goal.

## Stop conditions

- Semantic divergence, failed invalidation, sensitive capture or unauthorized
  read/write/tenant access appears. Stop affected reuse and preserve a receipt.
- Required exact-version or dependency evidence is missing. Continue independent
  work but do not cross the gate.
- A concrete deployment/rollout exceeds scope or an unresolved numeric budget.
  Prepare the change/preview before requesting a missing material decision.
- A change would overwrite another owner's artifacts, weaken required statuses,
  or bypass the approved secret or runner-admission paths.

## Decision log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-23 | Score `turbo@2.11.10` (stable, matches the repo lock) and `2.11.9-canary.1` (the current `canary` dist-tag, which trails stable). | The SPEC asks for the exact published canary; npm published no canary after 2.11.9. | Re-pin when a newer canary is published; regenerate client receipts. |
| 2026-10-23 | Score Ducktors `2.14.3`; record `2.14.4` without scoring it. | 2.14.4 was published hours before the refresh; the repo's two-week supply-chain age floor applies. | Re-pin after 2026-11-06 and rerun the corpus. |
| 2026-10-23 | Bruno pin moves from 4.0.17 to 4.0.20, and a `bruno-loopback` topology joins the comparison. | PR #2000 put Bruno 4.0.20 on consumer-host loopback over R2 (opt-in, inactive); comparing a release nobody runs would be moot. The live R2 bucket is never a write target. | Drop the topology if the R2 cohort is retired. |
| 2026-10-23 | The local container lab lives in `infra/lambda/turbo-cache/lab/` and is not bundled. | Its gateway must load the pinned shim and the incumbent's own authorizer/writer source; that package already owns them and is outside fallow's scope. No adapter source changes. | Move the three files to their own directory and add an install step. |
| 2026-10-23 | The lab's S3-compatible store is `versity/versitygw` v1.0.17 by digest. | MinIO no longer publishes community images; versitygw is Apache-2.0 and serves a POSIX directory. | Swap the image line in `lab.sh`. |
| 2026-10-23 | The AWS lab is a separate Pulumi project reusing `CiTurboCache` unchanged under a `beep-tcl-<epoch>` name; Bruno and upstream Ducktors are not deployed to AWS. | One shared-file writer and no production stack contact. Both candidates deploy as single processes, so the local lab is their deployed shape. | Add Fargate services to the lab entry if a deployed candidate shape changes. |
| 2026-10-24 | `CiTurboCache` gains optional lab-only `remediation` arguments (tag passthrough, reserved concurrency); defaults equal the deployed values. | Lets the lab deploy the evolved incumbent without forking the component; the lab preview showed the existing 32 resources unchanged and production passes no remediation. | Remove the optional argument; no deployed stack uses it. |
| 2026-10-24 | The corpus now resolves response `$ref`s, so error responses carry their documented `application/json` type and strict scoring checks it; the five local topologies were rerun on all four executors, while the two AWS runs are kept. | Review finding: unresolved refs left every error response without a media type, so error content types were never scored. Every recorded AWS error exchange already carried `application/json`, so the stricter check yields the same AWS verdicts; redeploying would only re-measure them. | Revert the resolver and rerun the local lab. |
| 2026-10-24 | The final PR is #2238, one squashed commit on main, replacing #2226. | #2226's history held public digest fields (`openapiSha256`, `openapiGitBlob`) that hosted secret scanning flags as `generic-api-key` under main's config; a PR cannot widen its own allowlist and rewriting published history needs a force push. The fields were renamed to `specSha256`/`specGitBlob`. | Reopen #2226 only if #2238 is abandoned. |
| 2026-10-24 | The comparison recommends retaining and evolving the incumbent; no migration packet opens. | Frozen rubric: no topology passes G5, so no candidate is eligible; the evolved incumbent improves five gates with no regression. | Rerun the corpus when a candidate adds tenant binding. |
| 2026-10-23 | Lab spend (P2) escalated with a prepared preview; the operator approved a USD 10 ceiling, a 48-hour TTL and the read-only production size census in chat on 2026-10-23. | AGENTS.md autonomy charter: money escalates. | `lab-aws.sh destroy <epoch>` and inventory; the approval covers this lab only. |

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None approved | This goal | Goal executor | Record real exceptions before using them. | Every temporary exception needs a bounded removal condition. |
