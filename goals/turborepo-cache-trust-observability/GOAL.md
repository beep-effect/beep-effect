# GOAL: Turborepo cache trust and observability

Repo root is the Beep checkout in the current working directory. Do not assume
an absolute path. Outcome: Enforce signed artifact reuse, independent upload authorization, tenant isolation and attributable cache outcomes with bounded safe telemetry.

Read AGENTS.md, then:
- goals/turborepo-cache-trust-observability/SPEC.md
- goals/turborepo-cache-trust-observability/PLAN.md
- goals/turborepo-cache-trust-observability/ops/manifest.json
- goals/turborepo-cache-trust-observability/research/SOURCES.md
- explorations/turborepo-quality-cache/DECISIONS.md
- explorations/turborepo-quality-cache/MAP.md

The user approved the brief, first slice and four-goal map on 2026-09-08.
Launching this packet starts scoped implementation without repeating shape
approval. It is paused until launch. Inspect current state and use
`bun run beep goals set-status turborepo-cache-trust-observability active` to begin P0.

First action: Refresh the checked-in and applicable deployed trust boundary, then define the cache-result and protected-producer receipt contract with the conformance owner.

In: Cache result/producer schemas and posture; infra cache adapter/auth/tenant/signature support; bounded telemetry and scoped incumbent hardening.
Out: backend replacement, new PKI or a generic telemetry platform, broad task qualification, and changes to hosted proof semantics.

Follow SPEC and milestone dependencies. Consume accepted sibling artifacts
without waiting for whole-goal closure; continue independent work while a
dependency is pending. Preserve single writers and existing proof authorities.
Load turborepo for Turbo work, schema-first/effect-first skills for relevant
code, and Yeet for quality/publishing. Use architecture commands and package
generators where required; search source/barrels before adding helpers.

Refresh exact pins before experiments. Use isolated fixtures and the approved
secret/admission lane. Deployment/rollout needs SPEC's concrete numeric budget,
preview, cohort and rollback evidence. Prepare the change before resolving
only missing material choices. Never expose secrets, publish unsafe
logs, or accept cache reuse as required hosted proof.

Implement all acceptance criteria and negative cases. Run package-verify for
every edited workspace before handoff. Attribute failures before repair; do not
waive introduced failures. Keep PLAN, manifest and compact receipts current.
Record friction in research/OPPORTUNITIES.md; keep raw evidence bounded.

Drive the final implementation PR through Yeet repair, verify, publish and
monitor until `merge-ready: yes`, including required checks and reviews.
Land evidence, a reflect-skill closeout and completed-retained lifecycle in
that same PR. Partial or blocked observation is not completion.
SPEC is normative; this launcher is navigation.
