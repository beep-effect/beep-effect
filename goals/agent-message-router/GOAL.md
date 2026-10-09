# GOAL: Agent Message Router

Use the current checkout; paths are repo-relative. Outcome: Implement a local durable agent-message contract, transactional delivery store and routing service with per-session capabilities, policy fingerprints and explicit ambiguous recovery.

Read goals/agent-message-router/README.md, SPEC.md, PLAN.md, ops/manifest.json and
research/SOURCES.md first. The SPEC is normative; AGENTS.md, required skills and
architecture outrank packet prose. Read source exploration decisions and executed
spike receipts; do not confuse fixtures, controller-mediated browser replies or
managed CLI evidence with production autonomous tools or native app enrollment.

Merged-state declaration: completed-retained, effective only after PR #1571's exact final-head hosted checks, resolved reviews, 20-minute window and merge. Local implementation/full proofs passed; external closeout remains open until that gate. See README/SPEC for the prospective boundary; never treat this local manifest as a merge receipt.

Bounded first slice: Implement schemas, transactional store and one injected endpoint request/reply through the real router; prove duplicate identity, crash recovery and ambiguous acknowledgement before adding live provider adapters.

Before source edits activate schema-first-development/effect-first-development,
query graft, search live source/barrels for reuse, run architecture routing and
use create-package for a necessary new package. Root architecture review will
record exact topology. Preserve unrelated files/processes and sibling ownership.

In scope: local schema-backed communication, transactional receipt/recovery
contract or native managed adapter/tool integration as specified by this goal.
Out of scope: production orchestrator/merge-policy changes, global app settings,
new paid endpoints, native Desktop/browser production/federation claims without
the separately gated follow-ups. Preserve current model pins/fallback authority.

Run the phases through P4. Capture decisions and reversal in SPEC, actual new
behavior tests and sanitized receipts, and package-verify for each touched package.
Stop a provider route before inference if its effective permission/model identity
mismatches; keep ambiguous consumption owned and hold unsafe mutation retries.
Never silently resume a conversation another app owns or relay peer text as
operator authority. Existing subscription tests must be bounded/disposable.

Publish through Yeet once cheap gates/content are ready; mark ready at final
content, monitor exact-head hosted readiness, answer and resolve threads, wait the
review window, and merge at the current gate. Completion requires the merged or
mergeable implementation PR, scoped acceptance, verification, final reflection
and same-PR lifecycle update. Exploration evidence does not close this goal.

At P4 write history/reflections/YYYY-MM-DD-agent.md with valid frontmatter and
run reflection-artifacts; retire/sweep from the owning merged lane.

Packet checks: launcher <=4000 characters, valid manifest/provenance, goals doctor,
explore check and git diff --check. Exact package/local commands follow recorded
topology. Escalate money only; routine choices need a recorded reversible decision.
