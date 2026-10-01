# Turborepo cache conformance plan

## Status

Status: `active`
Lifecycle: `active`

Launched for the early handoff required by task qualification, under the
operator's delegated blocker-resolution authority. Work is integrated in
PR #1327 with one writer for Cache contracts and fixtures. This slice produces
local signed-boundary evidence; it does not claim whole-packet completion or
production readiness. Remaining comparison/deployment milestones retain their
SPEC gates. Prefer local fixtures with no incremental cloud resources.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Pins, corpus and budget plan | in-progress | Refresh exact releases/licenses, inventory the source contract, agree receipt interfaces and derive the lab deployment plan. | Immutable pins and case mapping; numeric cost/TTL/load bounds precede any deployment. |
| P1 Local differential runner | in-progress | Generate baseline cases and add semantic/adversarial fixtures behind Cache. | Spec/stable/canary verdicts remain separate; direct receipts expose fail-soft behavior. |
| P2 Disposable AWS lab | pending | Review the bounded deployment preview and provision isolated comparison topologies through repo infra. | Scoped lab is healthy, expiring, budgeted, and has a reproducible teardown. |
| P3 Execute and compare | pending | Run identical cases/load across incumbent, evolved incumbent, Bruno and Ducktors; consume trust fixes and rerun. | Every case is attributed; frozen rubric yields a recommendation or a substantiated no-eligible result. |
| P4 Verify and tear down | pending | Prove upgrade regeneration, fault reproducibility, artifact retention and lab teardown; hand off signed-boundary receipts. | Package/protocol checks pass, deletion targets are verified, cost and cleanup receipts exist. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted failures and reviews. | Yeet monitor reports merge-ready: yes on final head. |
| P6 Close | pending | Land comparison, reflection and lifecycle with final implementation work. | Reproducible evidence and same-PR closeout. |

## First action

Refresh exact source/client/backend pins and compile the existing 32-case corpus plan into an executable local fixture design.

## Dependency gates

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

pin manifest; generated/adversarial case manifest; deployment preview and
numeric budget; run receipts and comparison matrix; immutable topology
references; cost/expiry inventory; teardown proof and Yeet closeout.

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
   `bun run beep goals set-status turborepo-cache-conformance completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.

## Qualification prerequisite: bounded native signed probes

The expanded [stable](research/native-signed-expanded-stable-probe.json) and
[canary](research/native-signed-expanded-canary-probe.json) probes each exercise
six native runs and three direct authorization negatives. Native summaries
confirm an actual remote hit; stored-upload and download digests agree. Missing
or corrupted tags, corrupted bodies and wrong signing keys restore no output,
with fallback deliberately denied. Reader PUT, unknown bearer and cross-tenant
requests are denied without changing server objects. Independent report
relationship reviews pass. These are private synthetic probes, not the owned
schema-first runner, protected producer evidence, full corpus, cloud boundary
proof or three-pair real-pilot qualification. Integrate those remaining gates
before accepting a signed-boundary handoff.

## Observation-review implementation checkpoint: 2026-09-29

The isolated CLI implementation adds a bounded schema and `cache protocol-review`
command for producer, replay and four integrity-rejection observations. It checks
same-client/task identity, distinct cases/request ids/native summaries, accepted
writer upload, wire/archive relationships and matching native outcomes. It
retains synthetic observation authority and rejects qualification assertions.

Six focused tests pass. Full `@beep/repo-cli` package verification passes audit
(776.6 seconds) and docgen (20.2 seconds) after fixing the nonempty-array guard
narrowing error. The exact six-file snapshot and log digests are recorded in
[the implementation receipt](./research/protocol-observation-implementation.json).
This source is still isolated from the integration checkout while its earlier
full proof runs. It has not been published. Continue with the reusable signed
runner and importer; do not promote the pilot from this validator.

## Owned fixture component: 2026-09-29

The isolated implementation now includes a scoped Effect/Bun HTTP fixture with
schema-owned credentials, scenarios and sanitized events. It separates reader
and writer capabilities, preserves opaque artifact tags, rejects conflicting
writes atomically, allows identical retries, and bounds requests, body size and
object count. Missing/invalid tags and corrupt bodies are explicit read faults.
Optional events and batch routes return labelled unsupported responses.

Sixteen focused tests pass, including transport behavior, storage/capture bounds,
concurrency, capability separation, optional routes and scope-owned socket
cleanup. The first full CLI audit passed (683.2 seconds); its docgen phase found
missing alias docs. Those docs and the guard example are corrected, and the CLI
package docgen now passes all 1,950 examples. The final package retry passes audit (678.4 seconds) and docgen (21.1 seconds).
The [nine-file source snapshot](./research/owned-fixture-implementation.json)
binds that verification. No new source has been integrated or published yet.

The [stable](./research/owned-fixture-stable.json) and
[canary](./research/owned-fixture-canary.json) native probes each pass six signed
artifact cases against this owned component. A private harness runs the server
inside an outer private network namespace and native clients in nested
user/PID/mount namespaces. Independent review joins native summaries, one-task
execution, output digests and server exchanges. Both channels retain 59 files
under four MiB. Initial auxiliary 400 responses were attributed to optional
analytics routing; the corrected run labels both optional events responses 404,
with no unclassified rejection. Initial calibration runs remain retained.

The server component is reusable; the native orchestration harness is still
private. Reusable CLI orchestration, protected receipt/import contracts and real
lint pilot signed pairs remain incomplete. These are synthetic observations,
not an accepted qualification transition or a full conformance corpus verdict.

### Expanded read-fault checkpoint — 2026-09-29

The owned scoped fixture now supports truncated artifact bytes and explicit
429/503 reads without mutating stored objects. Eighteen focused protocol tests
pass. Both pinned clients separately passed nine native cases in private outer
network namespaces, with nested reader mounts and denied fallback execution.
Independent review joined native task hashes, raw summaries and wire events;
83 files per client were retained with verified digests. See the expanded
stable/canary receipts. These observations do not establish a reusable CLI
runner, real-pilot qualification, timeout/reset handling or full RC-023 closure.
The expanded fixture package audit passed in 665.9 seconds and docgen passed
in 22.6 seconds. Its verified source snapshot remains distinct from the
subsequent signed-runner integration.

### Owned CLI execution checkpoint — 2026-09-29

`cache protocol-run` now replaces the private synthetic execution harness for
new observations. Both exact clients pass all nine cases through this command;
three invalid requests and an unconfined worker are rejected. Scope cleanup and
retained report relationships were verified independently. Eighteen focused
tests pass, including JSON event round trips. Full package verification passed on the integrated runner: audit 653.4 seconds
and docgen 20.0 seconds. No real-pilot, protected producer, full-corpus
or qualification acceptance follows from this checkpoint.
