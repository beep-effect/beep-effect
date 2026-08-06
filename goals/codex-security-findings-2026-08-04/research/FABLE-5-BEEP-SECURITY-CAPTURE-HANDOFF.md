# Fable 5 Handoff: Automate Codex Security Finding Packets

You are Fable 5 working at the repository root.

Research, design, plan, and orchestrate implementation of a `beep-cli` workflow
that captures the repository's open Codex Cloud security findings, bootstraps or
refreshes a goal packet, validates it, and leaves an immediately executable
goal launcher. PR #559 has merged as `e6c371e1f1`; sync a fresh feature branch
from `origin/main`, then re-audit current repo law, CLI topology, prior security
packets, and the live Codex export contract.

## Non-negotiable security boundary

Prefer the findings page's signed-in **Export findings as CSV** action through
browser control. Do not export, download, print, persist, log, serialize, or
pass through argv any raw browser cookie, bearer token, authorization header,
browser storage value, signed URL, or other credential. Treat the user's
original cookie-download idea as a threat-model input, not as an approved
design. If browser-mediated export is unavailable, rank safe alternatives such
as an authenticated browser/extension or CDP bridge with ephemeral in-memory
state, an OS-keyring secret reference, and a sanitized manual CSV import. Never
introduce a raw cookie file.

The adversarial invariant is: a secret canary must never appear in tracked
packet files, stdout/stderr, errors, snapshots, test artifacts, process argv,
or Yeet artifacts.

## Research first

Ground the design in live source and evidence:

1. Read `AGENTS.md`, `standards/ARCHITECTURE.md`, the relevant skills, and the
   current `beep-cli` command/service/schema conventions.
2. Compare at least the recent `goals/codex-security-findings-*` packets,
   especially this 2026-08-04 packet, its ignored raw CSV, triage schema,
   lifecycle, index generation, reflection, and closeout rules.
3. Inspect the live signed-in findings UI and exported CSV schema without
   inspecting cookies or browser storage. Record pagination/count behavior,
   filters, field types, multiline CSV behavior, ordering, finding IDs, source
   commits, severity values, and likely UI/schema drift.
4. Discover existing schemas, CSV codecs, browser-control boundaries, packet
   generators, goal commands, sanitizers, atomic-write helpers, and launch/Yeet
   orchestration before proposing anything new.
5. Threat-model authentication expiry, partial exports, duplicate findings,
   reruns, concurrent writers, CSV/formula injection, terminal controls,
   symlink/path traversal, absolute developer paths, malformed rows, and a
   source commit that is not an ancestor of the working head.

## Shape the command

Choose the command namespace only after auditing the live CLI topology. Prefer
the smallest coherent surface, likely separating authenticated capture from
deterministic packet generation so generation can be tested entirely offline.
The design must cover:

- capture/import, dry-run, explicit repository and slug/date inputs;
- stable ordering and stable `CSF-NNN` assignment keyed by Codex finding ID;
- idempotent reruns, refresh/diff behavior, deduplication, and removed/closed
  finding handling without silently renumbering existing records;
- all-pages/all-open count reconciliation and fail-closed partial capture;
- schema-first decoding at the external CSV boundary and typed Effect errors;
- ignored, mode-restricted raw evidence plus sanitized tracked records only;
- severity/disposition summaries, source-commit ancestry checks, packet JSON,
  finding Markdown, index, launcher, reflection scaffold, and goals index;
- atomic writes, path containment, symlink refusal, and concurrent-run safety;
- a clear next command to execute the goal, with any optional execution/Yeet
  mode explicit and separately authorized;
- useful `--help`, noninteractive fixtures, exit codes, and recovery guidance.

Do not smuggle browser automation, packet generation, remediation, and
publication into one opaque command. Keep the auth/capture boundary explicit
and make the deterministic half independently reusable.

## Repo implementation law

Use schema-first domain models, Effect-first services, typed tagged errors,
explicit dependency injection for browser/export access, canonical helpers,
and the simplest implementation that meets the contract. Avoid speculative
abstractions and new dependencies where platform/repo facilities suffice.
Document exported symbols with repo JSDoc grammar, add an appropriate
changeset, and preserve unrelated dirty work.

## Required proof

At minimum, test:

- CSV schema decoding, quoted multiline cells, malformed/truncated rows, and
  live-schema drift;
- pagination/export count reconciliation and partial/auth-expired failures;
- stable IDs, ordering, dedupe, refresh, and idempotent reruns;
- sanitization of secrets, terminal controls, CSV formulas, signed URLs, and
  developer-local absolute paths;
- traversal/symlink rejection, atomic writes, concurrent-run refusal or safe
  serialization, and dry-run non-mutation;
- offline packet fixtures against goal doctor/index/reflection contracts;
- command help, typed exit behavior, and the secret-canary invariant across
  output, errors, snapshots, packet files, and Yeet artifacts.

Use synthetic fixtures only for authentication and secret-bearing cases. Do
not record or commit a real authenticated export.

## Execution phases

1. **P0 Audit and research** - collect current evidence and alternatives.
2. **P1 Design** - write the threat model, command contract, schemas, service
   boundaries, idempotency rules, and decision log.
3. **P2 Goal packet** - graduate the approved design into an executable packet
   with explicit acceptance and verification commands.
4. **P3 Implementation** - orchestrate bounded implementation lanes with
   non-overlapping file ownership.
5. **P4 Adversarial closure** - run read-only security, Effect/schema, CLI UX,
   and over-engineering reviews; route every actionable finding to a fixer and
   repeat until zero required findings remain.
6. **P5 Yeet** - use the canonical Yeet path to publish, monitor hosted checks,
   address and resolve actionable review threads, and reach mergeable state.

Before implementation, deliver a durable research/design/plan package in the
new goal packet. State grounded facts separately from proposals, compare the
safe capture alternatives, recommend one design with explicit tradeoffs, and
ask only questions whose answers would materially change the implementation.
Once the design is approved, orchestrate the work through P5 rather than
stopping at a speculative plan.
