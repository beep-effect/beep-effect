# GOAL: Turborepo task qualification

Repo root is the Beep checkout in the current working directory. Do not assume
an absolute path. Outcome: Make cache reuse an enforced, evidence-backed contract for each quality computation, reuse layer, environment profile and epoch.

Read AGENTS.md, then:
- goals/turborepo-task-qualification/SPEC.md
- goals/turborepo-task-qualification/PLAN.md
- goals/turborepo-task-qualification/ops/manifest.json
- goals/turborepo-task-qualification/research/SOURCES.md
- explorations/turborepo-quality-cache/DECISIONS.md
- explorations/turborepo-quality-cache/MAP.md

The user approved the brief, first slice and four-goal map on 2026-09-08.
Launching this packet starts scoped implementation without repeating shape
approval. It is paused until launch. Inspect current state and use
`bun run beep goals set-status turborepo-task-qualification active` to begin P0.

First action: Refresh the executable census and define the qualification policy shared by the pilot, conformance runner and adoption audit.

In: repo-configs cache policy; Cache qualification commands and tests; a scoped Quality policy gate; pilot fixtures and computation configuration.
Out: broad task-family activation, backend deployment, production credentials, and changes to Yeet proof ownership.

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
